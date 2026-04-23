from __future__ import annotations

import argparse
import base64
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

from bs4 import BeautifulSoup
from zipfile import ZipFile


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = PROJECT_ROOT.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
DATA_DIR = PROJECT_ROOT / "data"
EXTRACTED_DIR = DATA_DIR / "extracted"
STATIC_ASSETS_DIR = PROJECT_ROOT / "static" / "generated" / "assets"

from chapter_order import chapter_sort_key, normalize_chapter_title  # noqa: E402

SUBJECTS = {
    "高数.zip": {"id": "advanced-math", "name": "高数"},
    "线代.zip": {"id": "linear-algebra", "name": "线代"},
    "概率论.zip": {"id": "probability", "name": "概率论"},
    "复变.zip": {"id": "complex-analysis", "name": "复变"},
}

OPTION_LABELS = ["A", "B", "C", "D"]
MIME_EXTENSIONS = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
}


def strip_question_count(filename: str) -> str:
    title = Path(filename).stem
    return re.sub(r"\(\d+题\)$", "", title).strip()


def parse_question_count(filename: str) -> int | None:
    match = re.search(r"\((\d+)题\)$", Path(filename).stem)
    return int(match.group(1)) if match else None


def decode_data_uri(src: str) -> tuple[str, bytes]:
    if not src.startswith("data:"):
        raise ValueError(f"Unsupported image source: {src[:64]}")
    header, encoded = src.split(",", 1)
    mime_type = header[5:].split(";", 1)[0].lower()
    return mime_type, base64.b64decode(encoded)


def image_to_html(img_tag, image_name: str, asset_dir: Path, asset_url_dir: str) -> str:
    mime_type, image_bytes = decode_data_uri(img_tag["src"])
    extension = MIME_EXTENSIONS.get(mime_type, ".bin")
    asset_path = asset_dir / f"{image_name}{extension}"
    asset_path.parent.mkdir(parents=True, exist_ok=True)
    if not asset_path.exists():
        asset_path.write_bytes(image_bytes)

    new_tag = BeautifulSoup(str(img_tag), "html.parser").img
    new_tag["src"] = f"{asset_url_dir}/{asset_path.name}"
    return str(new_tag)


def parse_difficulty(header_text: str) -> str:
    if "-" not in header_text:
        return ""
    return header_text.split("-", 1)[1].strip()


def parse_question_block(
    block,
    question_number: int,
    asset_dir: Path,
    asset_url_dir: str,
) -> dict:
    header = block.find("div", recursive=False)
    header_text = header.get_text(strip=True) if header else f"#{question_number}"
    table = block.find("table")
    rows = table.find_all("tr", recursive=False) if table else []
    if len(rows) != 6:
        raise ValueError(f"Question #{question_number} has {len(rows)} rows instead of 6")

    def extract_row(row, suffix: str) -> str:
        img = row.find("img")
        if img is None:
            raise ValueError(f"Question #{question_number} row {suffix} is missing image")
        return image_to_html(
            img_tag=img,
            image_name=f"q{question_number:04d}_{suffix}",
            asset_dir=asset_dir,
            asset_url_dir=asset_url_dir,
        )

    correct_index = None
    options = []
    for index, row in enumerate(rows[1:5]):
        label = OPTION_LABELS[index]
        if "g" in (row.get("class") or []):
            correct_index = index
        options.append(
            {
                "label": label,
                "html": extract_row(row, f"option_{label}"),
            }
        )

    if correct_index is None:
        raise ValueError(f"Question #{question_number} has no highlighted correct answer")

    return {
        "id": f"q{question_number:04d}",
        "number": question_number,
        "header": header_text,
        "difficulty": parse_difficulty(header_text),
        "prompt_html": extract_row(rows[0], "prompt"),
        "options": options,
        "answer": OPTION_LABELS[correct_index],
        "answer_index": correct_index,
        "analysis_html": extract_row(rows[5], "analysis"),
    }


def iter_sorted_html_members(zip_file: ZipFile) -> Iterable[str]:
    html_members = [name for name in zip_file.namelist() if name.lower().endswith((".html", ".htm"))]
    indexed = list(enumerate(html_members))
    subject_zip_name = Path(zip_file.filename).name
    subject_id = SUBJECTS[subject_zip_name]["id"]
    sorted_members = sorted(
        indexed,
        key=lambda item: chapter_sort_key(subject_id, strip_question_count(item[1]), item[0]),
    )
    for _, member in sorted_members:
        yield member


def extract_subject(zip_name: str, source_dir: Path) -> dict:
    subject_meta = SUBJECTS[zip_name]
    subject_id = subject_meta["id"]
    subject_name = subject_meta["name"]
    zip_path = source_dir / zip_name
    chapters = []
    subject_question_total = 0

    with ZipFile(zip_path) as archive:
        for chapter_index, member in enumerate(iter_sorted_html_members(archive), start=1):
            chapter_title = normalize_chapter_title(subject_id, strip_question_count(member))
            chapter_id = f"ch{chapter_index:03d}"
            chapter_asset_dir = STATIC_ASSETS_DIR / subject_id / chapter_id
            chapter_asset_url_dir = f"/static/generated/assets/{subject_id}/{chapter_id}"
            soup = BeautifulSoup(archive.read(member).decode("utf-8"), "html.parser")
            main = soup.find("main")
            question_blocks = main.find_all("div", recursive=False) if main else []
            questions = [
                parse_question_block(
                    block=block,
                    question_number=number,
                    asset_dir=chapter_asset_dir,
                    asset_url_dir=chapter_asset_url_dir,
                )
                for number, block in enumerate(question_blocks, start=1)
            ]

            chapter_data = {
                "subject_id": subject_id,
                "subject_name": subject_name,
                "chapter_id": chapter_id,
                "chapter_name": chapter_title,
                "source_zip": zip_name,
                "source_html": member,
                "declared_question_count": parse_question_count(member),
                "question_count": len(questions),
                "questions": questions,
            }

            chapter_output_dir = EXTRACTED_DIR / subject_id
            chapter_output_dir.mkdir(parents=True, exist_ok=True)
            chapter_output_path = chapter_output_dir / f"{chapter_id}.json"
            chapter_output_path.write_text(
                json.dumps(chapter_data, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )

            chapters.append(
                {
                    "id": chapter_id,
                    "name": chapter_title,
                    "source_html": member,
                    "question_count": len(questions),
                    "declared_question_count": parse_question_count(member),
                    "json_path": f"data/extracted/{subject_id}/{chapter_id}.json",
                }
            )
            subject_question_total += len(questions)

    return {
        "id": subject_id,
        "name": subject_name,
        "source_zip": zip_name,
        "chapter_count": len(chapters),
        "question_count": subject_question_total,
        "chapters": chapters,
    }


def build_manifest(source_dir: Path) -> dict:
    subjects = [extract_subject(zip_name, source_dir) for zip_name in SUBJECTS]
    total_questions = sum(subject["question_count"] for subject in subjects)
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_dir": str(source_dir),
        "total_subjects": len(subjects),
        "total_questions": total_questions,
        "subjects": subjects,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract quiz questions from HTML zip packages.")
    parser.add_argument(
        "--source-dir",
        default=str(SOURCE_ROOT),
        help="Directory containing the source zip files. Defaults to the parent of quiz_site.",
    )
    args = parser.parse_args()

    source_dir = Path(args.source_dir).resolve()
    EXTRACTED_DIR.mkdir(parents=True, exist_ok=True)
    STATIC_ASSETS_DIR.mkdir(parents=True, exist_ok=True)

    manifest = build_manifest(source_dir)
    (DATA_DIR / "subjects.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(
        f"Extracted {manifest['total_questions']} questions from "
        f"{manifest['total_subjects']} subjects into {EXTRACTED_DIR}"
    )


if __name__ == "__main__":
    main()
