from __future__ import annotations

import re


TITLE_OVERRIDES = {
    ("probability", "随机事件的概念"): "1.1.1 随机事件的概念",
}

SUBJECT_CHAPTER_SEQUENCE = {
    "linear-algebra": [
        "行列式概念、性质及其计算",
        "Cramer法则",
        "矩阵及其运算、分块矩阵",
        "逆矩阵、矩阵方程",
        "初等变换和初等矩阵",
        "线性方程组解判定及其求解",
        "向量概念及其性质、内积、正交",
        "向量的线性表示、向量组的线性相关性",
        "极大无关组、向量和矩阵的秩",
        "基础解系和解的结构",
        "向量空间",
        "线性空间",
        "矩阵特征值和特征向量",
        "矩阵相似及相似对角化",
        "线性变换、欧几里得空间",
        "二次型概念、惯性定理、正定二次型",
        "矩阵合同，化二次型为标准形",
    ],
    "complex-analysis": [
        "复数的概念、表示及运算",
        "乘幂与方根",
        "平面点集",
        "初等解析函数",
        "函数的连续、导数和解析",
        "函数可导的充要条件",
        "解析函数的原函数",
        "积分的概念、积分存在的条件及积分的性质",
        "Cauchy积分定理",
        "复合闭路定理",
        "Cauchy积分公式",
        "Cauchy导数公式",
        "函数的零点",
        "复数项级数",
        "幂级数",
        "Taylor级数",
        "Laurent级数",
        "孤立奇点",
        "留数的一般理论及留数的计算",
        "极点留数的计算",
        "留数的应用",
        "调和函数",
        "第5章 保角映射",
        "第6章 积分变换的预备知识",
        "Laplace变换的定义及性质",
        "Laplace逆变换",
        "Laplace变换的应用",
        "第7章 Fourier变换",
    ],
}


def normalize_chapter_title(subject_id: str, title: str) -> str:
    return TITLE_OVERRIDES.get((subject_id, title), title)


def chapter_sort_key(subject_id: str, title: str, index: int) -> tuple:
    normalized_title = normalize_chapter_title(subject_id, title)
    sequence = SUBJECT_CHAPTER_SEQUENCE.get(subject_id)
    if sequence:
        try:
            return (0, sequence.index(normalized_title), normalized_title)
        except ValueError:
            pass

    numeric_prefix = re.match(r"^\s*(\d+(?:\.\d+)*)", normalized_title)
    if numeric_prefix:
        return (
            1,
            tuple(int(part) for part in numeric_prefix.group(1).split(".")),
            normalized_title,
        )

    chapter_number = re.match(r"^\s*第\s*(\d+)\s*章", normalized_title)
    if chapter_number:
        return (2, int(chapter_number.group(1)), normalized_title)

    return (3, index, normalized_title)


def reorder_manifest_subjects(manifest: dict) -> dict:
    for subject in manifest.get("subjects", []):
        indexed_chapters = []
        for index, chapter in enumerate(subject.get("chapters", [])):
            updated_chapter = dict(chapter)
            updated_chapter["name"] = normalize_chapter_title(subject["id"], chapter["name"])
            indexed_chapters.append((index, updated_chapter))

        indexed_chapters.sort(
            key=lambda item: chapter_sort_key(subject["id"], item[1]["name"], item[0]),
        )
        subject["chapters"] = [chapter for _, chapter in indexed_chapters]

    return manifest
