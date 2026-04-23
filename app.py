from __future__ import annotations

import json
import os
import time
from pathlib import Path

from flask import Flask, abort, render_template

from chapter_order import reorder_manifest_subjects


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
MANIFEST_PATH = DATA_DIR / "subjects.json"
EXTRACTED_DIR = DATA_DIR / "extracted"

app = Flask(__name__)
app.config["ASSET_VERSION"] = int(time.time())


@app.context_processor
def inject_asset_version() -> dict:
    return {"asset_version": app.config["ASSET_VERSION"]}


def load_manifest() -> dict:
    if not MANIFEST_PATH.exists():
        raise FileNotFoundError(
            f"Missing manifest: {MANIFEST_PATH}. Run scripts/extract_questions.py first."
        )
    with MANIFEST_PATH.open("r", encoding="utf-8") as handle:
        return reorder_manifest_subjects(json.load(handle))


def get_subject_or_404(subject_id: str) -> dict:
    manifest = load_manifest()
    for subject in manifest["subjects"]:
        if subject["id"] == subject_id:
            return subject
    abort(404)


def get_chapter_or_404(subject: dict, chapter_id: str) -> dict:
    for chapter in subject["chapters"]:
        if chapter["id"] == chapter_id:
            return chapter
    abort(404)


def load_chapter_data(subject_id: str, chapter_id: str) -> dict:
    chapter_path = EXTRACTED_DIR / subject_id / f"{chapter_id}.json"
    if not chapter_path.exists():
        abort(404)
    with chapter_path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


@app.route("/")
def index():
    manifest = load_manifest()
    return render_template("index.html", manifest=manifest, subjects=manifest["subjects"])


@app.route("/subjects/<subject_id>")
def subject_detail(subject_id: str):
    manifest = load_manifest()
    subject = get_subject_or_404(subject_id)
    return render_template(
        "subject.html",
        manifest=manifest,
        subject=subject,
        subjects=manifest["subjects"],
    )


@app.route("/subjects/<subject_id>/chapters/<chapter_id>")
def chapter_detail(subject_id: str, chapter_id: str):
    manifest = load_manifest()
    subject = get_subject_or_404(subject_id)
    chapter = get_chapter_or_404(subject, chapter_id)
    chapter_data = load_chapter_data(subject_id, chapter_id)
    initial_question = chapter_data["questions"][0] if chapter_data["questions"] else None
    return render_template(
        "chapter.html",
        manifest=manifest,
        subject=subject,
        chapter=chapter,
        chapter_data=chapter_data,
        initial_question=initial_question,
        subjects=manifest["subjects"],
    )


@app.route("/favorites")
def favorites():
    manifest = load_manifest()
    return render_template(
        "favorites.html",
        manifest=manifest,
        subjects=manifest["subjects"],
    )


@app.route("/healthz")
def healthz():
    return {"ok": True}


if __name__ == "__main__":
    host = os.environ.get("HOST", "::")
    port = int(os.environ.get("PORT", "5080"))
    app.run(host=host, port=port, debug=False)
