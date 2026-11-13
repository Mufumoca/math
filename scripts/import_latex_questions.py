from __future__ import annotations

import argparse
import html
import json
import re
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from chapter_order import chapter_sort_key, normalize_chapter_title, reorder_manifest_subjects  # noqa: E402

DATA_DIR = PROJECT_ROOT / "data"
MANIFEST_PATH = DATA_DIR / "subjects.json"
EXTRACTED_DIR = DATA_DIR / "extracted"
STATIC_ASSETS_DIR = PROJECT_ROOT / "static" / "generated"

SUBJECT_FOLDERS = {
    "advanced-math": ("高数", "高数.zip", "gs"),
    "linear-algebra": ("线代", "线代.zip", "xd"),
    "probability": ("概率论", "概率论.zip", "gl"),
    "complex-analysis": ("复变", "复变.zip", "fb_(1)"),
}

# Clean LaTeX transcriptions for the handful of fields where OCR emitted
# empty/tikzpicture/unitlength stubs while the original PNG in repo had content.
MANUAL_FIELD_OVERRIDES: dict[tuple[str, int, str], str] = {
    ("linear-algebra/初等变换和初等矩阵", 9, "analysis"): (
        r"$$\begin{aligned}"
        r"&\begin{bmatrix}1&2&3\\2&3&4\\3&4&5\end{bmatrix}\begin{bmatrix}0&0&1\\0&1&0\\1&0&0\end{bmatrix}=\begin{bmatrix}3&2&1\\4&3&2\\5&4&3\end{bmatrix};"
        r"\quad \begin{bmatrix}3&2&1\\4&3&2\\5&4&3\end{bmatrix}\begin{bmatrix}0&0&1\\0&1&0\\1&0&0\end{bmatrix}=\begin{bmatrix}1&2&3\\2&3&4\\3&4&5\end{bmatrix},\\"
        r"&\text{因此}\quad \left(\begin{bmatrix}1&2&3\\2&3&4\\3&4&5\end{bmatrix}\begin{bmatrix}0&0&1\\0&1&0\\1&0&0\end{bmatrix}\right)^{2011}=\begin{bmatrix}3&2&1\\4&3&2\\5&4&3\end{bmatrix},\quad \text{又因}\\"
        r"&\begin{bmatrix}1&0&0\\0&1&0\\0&2&1\end{bmatrix}\begin{bmatrix}3&2&1\\4&3&2\\5&4&3\end{bmatrix}=\begin{bmatrix}1&0&0\\0&1&0\\0&2&1\end{bmatrix}\begin{bmatrix}a_1\\a_2\\a_3\end{bmatrix}=\begin{bmatrix}a_1\\a_2\\a_3+2a_2\end{bmatrix},\\"
        r"&\begin{bmatrix}1&0&0\\0&1&0\\0&2&1\end{bmatrix}^{2}\begin{bmatrix}3&2&1\\4&3&2\\5&4&3\end{bmatrix}=\begin{bmatrix}1&0&0\\0&1&0\\0&2&1\end{bmatrix}\begin{bmatrix}a_1\\a_2\\a_3+2a_2\end{bmatrix}=\begin{bmatrix}a_1\\a_2\\a_3+4a_2\end{bmatrix},\\"
        r"&\begin{bmatrix}1&0&0\\0&1&0\\0&2&1\end{bmatrix}^{2010}\begin{bmatrix}a_1\\a_2\\a_3\end{bmatrix}=\begin{bmatrix}a_1\\a_2\\a_3+2010(2a_2)\end{bmatrix}=\begin{bmatrix}3&2&1\\4&3&2\\16085&12064&8043\end{bmatrix}."
        r"\end{aligned}$$"
    ),
    ("advanced-math/9.4.1 第二类曲面积分的概念及性质", 4, "analysis"): (
        r"$$\begin{aligned}"
        r"&\text{解答：}\Sigma\text{ 在 }yOz\text{ 面上无投影区域，故 }\iint_{\Sigma}(1+x)\,dy\,dz=0\text{，}"
        r"\Sigma\text{ 在 }zOx\text{ 面上无投影区域，故 }\iint_{\Sigma}(y-1)\,dz\,dx=0\text{，}\\"
        r"&\text{该柱面与 }xOy\text{ 面垂直，因而 }\iint_{\Sigma}z\,dx\,dy=0\text{。}\Sigma\text{ 在 }yOz\text{ 面与 }zOx\text{ 面上投影为矩形区域：}\\"
        r"&D_{yz}:0\leq y\leq 1,\ 0\leq z\leq 3;\qquad D_{zx}:0\leq x\leq 1,\ 0\leq z\leq 3.\\"
        r"&\text{原式}=\iint_{\Sigma}xy\,dz\,dx+\iint_{\Sigma}yz\,dx\,dy=\iint_{D_{yz}}\sqrt{1-y^2}\,dy\,dz+\iint_{D_{zx}}\sqrt{1-x^2}\,dz\,dx\\"
        r"&=\int_0^1 dy\int_0^3\sqrt{1-y^2}\,dz+\int_0^1 dx\int_0^3\sqrt{1-x^2}\,dz=2\cdot 3\int_0^1\sqrt{1-x^2}\,dx\\"
        r"&=6\left[\frac{x}{2}\sqrt{1-x^2}+\frac{1}{2}\arcsin x\right]_0^1=6\cdot\frac{1}{2}\cdot\frac{\pi}{2}=\frac{3}{2}\pi."
        r"\end{aligned}$$"
    ),
    ("probability/1.6.3事件的独立性应用", 15, "prompt"): (
        r"$$\begin{aligned}"
        r"&\text{如图是一个串并联电路系统，}A,B,C,D,E,F,G,H\text{ 都是电路中的元件：}\\"
        r"&\text{电路由 }A(0.95)\text{ 与 }B(0.95)\text{ 串联，再与 }C,D,E(\text{各 }0.70)\text{ 的并联支路串联，}\\"
        r"&\text{再与 }F,G(\text{各 }0.75)\text{ 的并联支路串联，最后与 }H(0.95)\text{ 串联。}\\"
        r"&\text{它们各自正常工作的概率如上所示，则电路系统的可靠性为（ }\ \text{）。}"
        r"\end{aligned}$$"
    ),
    ("probability/2.3.2 分布函数与分布律", 6, "analysis"): (
        r"$$\begin{aligned}"
        r"&\text{由题意知 }X\text{ 的分布律为：}\quad"
        r"\begin{array}{|c|c|c|c|}\hline X & 1 & 3 & 5 \\\hline P_k & 0.3 & 0.5 & 0.2 \\\hline\end{array}\\"
        r"&\text{所以其分布函数：}\quad F(x)=P\{X\leq x\}=\begin{cases}0,&x<1,\\0.3,&1\leq x<3,\\0.8,&3\leq x<5,\\1,&x\geq 5.\end{cases}"
        r"\end{aligned}$$"
    ),
    ("probability/2.3.2 分布函数与分布律", 16, "analysis"): (
        r"$$\begin{aligned}"
        r"&\text{由题意知 }X\text{ 的分布律为：}\quad"
        r"\begin{array}{|c|c|c|c|}\hline X & 1 & 3 & 5 \\\hline P_k & 0.3 & 0.5 & 0.2 \\\hline\end{array}\\"
        r"&\text{所以其分布函数：}\quad F(x)=P\{X\leq x\}=\begin{cases}0,&x<1,\\0.3,&1\leq x<3,\\0.8,&3\leq x<5,\\1,&x\geq 5.\end{cases}"
        r"\end{aligned}$$"
    ),
    ("probability/2.4.1 离散型随机变量的函数的分布", 6, "analysis"): (
        r"$$\begin{aligned}"
        r"&\text{构造对照表：}\\"
        r"&\begin{array}{|c|c|c|c|c|c|}\hline p_i & 1/5 & 1/6 & 1/5 & 1/15 & 11/30 \\\hline X & -2 & -1 & 0 & 1 & 3 \\\hline X^2 & 4 & 1 & 0 & 1 & 9 \\\hline\end{array}\\"
        r"&\text{所以 }Y=X^2\text{ 的分布律为}\\"
        r"&\begin{array}{|c|c|c|c|c|}\hline X^2 & 0 & 1 & 4 & 9 \\\hline p_i & 1/5 & 7/30 & 1/5 & 11/30 \\\hline\end{array}"
        r"\end{aligned}$$"
    ),
    ("probability/3.2.1.1 联合分布律", 4, "analysis"): (
        r"$$\begin{aligned}"
        r"&\text{依题意有，}\\"
        r"&\begin{array}{|c|c|c|c|c|c|c|c|c|c|}\hline & (-1,-1) & (-1,0) & (-1,1) & (0,-1) & (0,0) & (0,1) & (1,-1) & (1,0) & (1,1) \\\hline p & 1/8 & 1/8 & 1/8 & 1/8 & 0 & 1/8 & 1/8 & 1/8 & 1/8 \\\hline \xi & 1 & 0 & -1 & 0 & 0 & 0 & -1 & 0 & 1 \\\hline\end{array}\\"
        r"&\text{即}\quad \begin{array}{|c|c|c|c|}\hline \xi & -1 & 0 & 1 \\\hline p & 1/4 & 1/2 & 1/4 \\\hline\end{array}\\"
        r"&\text{所以 }P(\xi=1)=\frac{1}{4}."
        r"\end{aligned}$$"
    ),
    ("probability/3.5.2 离散型随机变量的独立性", 5, "analysis"): (
        r"$$\begin{aligned}"
        r"&\text{对离散型随机变量 }(X,Y)\text{ 若 }p_{ij}=p_i\cdot p_j\text{，则 }X\text{ 与 }Y\text{ 相互独立。}\\"
        r"&\text{两个离散型选项的边缘分布律分别为}\\"
        r"&\begin{array}{|c|c|c|c|}\hline X & 1/2 & 1 & 2 \\\hline p_i & 1/4 & 1/4 & 1/2 \\\hline\end{array}\quad\text{与}\quad\begin{array}{|c|c|c|c|}\hline Y & -1 & 0 & 1 \\\hline p_j & 2/5 & 1/5 & 2/5 \\\hline\end{array}\\"
        r"&\text{与}\quad \begin{array}{|c|c|c|c|}\hline X & 1 & 2 & 3 \\\hline p_i & 0.1 & 0.2 & 0.7 \\\hline\end{array}\quad\text{，}\quad\begin{array}{|c|c|c|c|}\hline Y & 1 & 2 & 3 \\\hline p_j & 0.1 & 0.3 & 0.6 \\\hline\end{array}\\"
        r"&\text{均满足 }p_i\cdot p_j=p_{ij}\text{，故 }X\text{ 与 }Y\text{ 相互独立。}\\"
        r"&\text{对于连续型随机变量 }(X,Y)\text{，若 }f(x,y)=f_X(x)f_Y(y)\text{，则 }X\text{ 与 }Y\text{ 相互独立。}\\"
        r"&f_X(x)=\int_{-\infty}^{+\infty}f(x,y)\,dy=\int_0^1(x+y)\,dy=x+\frac{1}{2},\quad (0\leq x\leq 1);\\"
        r"&f_Y(y)=\int_{-\infty}^{+\infty}f(x,y)\,dx=\int_0^1(x+y)\,dx=y+\frac{1}{2},\quad (0\leq y\leq 1),\\"
        r"&f_X(x)f_Y(y)=\left(x+\frac{1}{2}\right)\left(y+\frac{1}{2}\right)\neq f(x,y)=x+y\quad (0\leq x\leq 1,\ 0\leq y\leq 1),\\"
        r"&\text{所以 }X\text{ 与 }Y\text{ 不相互独立。}\\"
        r"&\text{同理可验证，概率密度为 }f(x,y)=\begin{cases}\frac{1}{5},&1\leq x\leq 2,\ 0\leq y\leq 5\\0,&\text{其他}\end{cases}\text{ 的 }X\text{ 与 }Y\text{ 相互独立。}"
        r"\end{aligned}$$"
    ),
    ("probability/3.6.2 二维连续型随机变量的函数的分布", 9, "analysis"): (
        r"$$\begin{aligned}"
        r"&\text{先求 }Z\text{ 的分布函数}\\"
        r"&F_Z(z)=P\{|X-Y|\leq z\}=\begin{cases}0,&z\leq 0,\\P\{-z\leq X-Y\leq z\},&0<z<1,\\1,&z\geq 1,\end{cases}=\begin{cases}0,&z\leq 0,\\1-(1-z)^2,&0<z<1,\\1,&z\geq 1.\end{cases}\\"
        r"&\text{于是 }Z=|X-Y|\text{ 的概率密度为}\\"
        r"&f_Z(z)=F'_Z(z)=\begin{cases}2(1-z),&0<z<1,\\0,&\text{其他}.\end{cases}"
        r"\end{aligned}$$"
    ),
    ("probability/3.6.3 最大、最小函数的分布", 1, "analysis"): (
        r"$$\begin{aligned}"
        r"&\text{依题意有}\quad"
        r"\begin{array}{|c|c|c|c|c|}\hline (X,Y) & (0,0) & (0,1) & (1,0) & (1,1) \\\hline P & 1/9 & 2/9 & 2/9 & 4/9 \\\hline Z & 0 & 1 & 1 & 1 \\\hline\end{array}\\"
        r"&\text{于是 }Z\text{ 的分布律为}\quad"
        r"\begin{array}{|c|c|c|}\hline Z & 0 & 1 \\\hline P & 1/9 & 8/9 \\\hline\end{array}"
        r"\end{aligned}$$"
    ),
    ("probability/8.4 总体分布的假设检验", 3, "prompt"): (
        r"$$\begin{aligned}"
        r"&\text{下表记录了 }2880\text{ 个婴儿的出生时刻（时间区间及出生个数 }f_i\text{）：}\\"
        r"&\begin{array}{|c|c|c|c|c|c|c|c|c|}\hline \text{区间} & [0,1) & [1,2) & [2,3) & [3,4) & [4,5) & [5,6) & [6,7) & [7,8) \\\hline f_i & 127 & 139 & 143 & 138 & 134 & 115 & 129 & 113 \\\hline \text{区间} & [8,9) & [9,10) & [10,11) & [11,12) & [12,13) & [13,14) & [14,15) & [15,16) \\\hline f_i & 126 & 122 & 121 & 119 & 130 & 125 & 112 & 97 \\\hline \text{区间} & [16,17) & [17,18) & [18,19) & [19,20) & [20,21) & [21,22) & [22,23) & [23,24) \\\hline f_i & 115 & 94 & 99 & 97 & 100 & 119 & 127 & 139 \\\hline\end{array}\\"
        r"&\text{试问婴儿的出生时刻是否服从均匀分布 }U[0,24)\text{（显著性水平 }\alpha=0.05\text{）？}"
        r"\end{aligned}$$"
    ),
    ("probability/8.4 总体分布的假设检验", 4, "analysis"): (
        r"$$\begin{aligned}"
        r"&\text{检验假设 }H_0\text{：一页的印刷错误个数 }X\text{ 服从泊松分布，}P\{X=i\}=\frac{\lambda^i e^{-\lambda}}{i!},\ i=0,1,2,\cdots.\\"
        r"&\text{先估计未知参数 }\lambda\text{：}\hat{\lambda}=\bar{x}=\frac{1}{100}(0\times 36+1\times 40+2\times 19+3\times 2+4\times 0+5\times 2+6\times 1)=1.\\"
        r"&\text{在 }H_0\text{ 成立下，}\hat{p}_i=\hat{P}\{X=i\}=\frac{e^{-1}}{i!},\ i=0,1,2,\cdots.\\"
        r"&\text{用 }\chi^2\text{ 检验法，}\chi^2=\sum_{i=1}^k\frac{(f_i-n\hat{p}_i)^2}{n\hat{p}_i}\sim\chi^2(k-r-1)\text{，本题中 }r=1\text{。}\\"
        r"&\text{合并 }n\hat{p}_i<5\text{ 的组后，自由度为 }4-1-1=2\text{，查表得 }\chi^2_{0.05}(2)=5.991\text{。}\\"
        r"&\text{计算 }\chi^2=0.0170+0.2801+0.0202+1.1423=1.4596<5.991\text{，故接受 }H_0\text{，认为一页的印刷错误个数服从泊松分布。}"
        r"\end{aligned}$$"
    ),
    ("probability/8.4 总体分布的假设检验", 5, "analysis"): (
        r"$$\begin{aligned}"
        r"&\text{这是分布的拟合检验问题，将整个区间划分为 }(-\infty,100),\ [100,200),\ [200,300),\ [300,+\infty)\text{，列表计算：}\\"
        r"&\begin{array}{|c|c|c|c|c|}\hline \text{区间} & f_i & np_i & f_i-np_i & (f_i-np_i)^2/np_i \\\hline (-\infty,100) & 121 & 118.0 & 3 & 0.0763 \\\hline [100,200) & 78 & 71.6 & 6.4 & 0.572 \\\hline [200,300) & 43 & 43.4 & -0.4 & 0.004 \\\hline [300,+\infty) & 58 & 66.9 & -8.9 & 1.184 \\\hline \sum & 300 & 300 & & 1.8631 \\\hline\end{array}\\"
        r"&\text{由 }k=4\text{，未知参数个数 }r=0\text{，查表知 }\chi^2_{0.05}(3)=7.815\text{。}\\"
        r"&\text{因 }\chi^2=1.8631<\chi^2_{0.05}(3)=7.815\text{，故接受 }H_0\text{，认为灯泡的寿命服从该指数分布。}"
        r"\end{aligned}$$"
    ),
}

# Exact targeted fixes for the ~13 OCR LaTeX syntax typos verified against KaTeX.
EXACT_LATEX_TYPO_FIXES: list[tuple[str, str]] = [
    (r"f(z)=\frac{e^{iz}}{(z^2+1))(z^2+9) \text{有一阶极点}", r"f(z)=\frac{e^{iz}}{(z^2+1)(z^2+9)} \text{有一阶极点}"),
    (r"\frac{\frac{e^{iz}}{(z^2+1))(z^2+9)}", r"\frac{e^{iz}}{(z^2+1)(z^2+9)}"),
    (r"\frac{e^{iz}}{(z^2+1))(z^2+9)", r"\frac{e^{iz}}{(z^2+1)(z^2+9)}"),
    (r"\frac{\left|2x+3-\frac{2}{3}\right|}{3x}=\frac{\left|2x+3-2x\right|}{3x}", r"\frac{\left|2x+3-\frac{2}{3}\right|}{3x}=\frac{\left|2x+3-2x\right|}{3x}"),
    (r"\frac{\left|2x+3}{3x}-\frac{2}{3}\right|", r"\left|\frac{2x+3}{3x}-\frac{2}{3}\right|"),
    (r"c_{-1}^{\quad \end{aligned}}", r"c_{-1} \end{aligned}"),
    (r"c_{-1}^{\,\,\,\,\,\,\,\,\,\,\,\,\,\,\,\,\,\,\,\,\,\,\,\,\,\,\,\,\,\,\,\,\,\,\,\,\,\,\,\,\,\,\,\,\,\,\,\,\,\,\,\,\,\,\,\,\,\,\,\,\,\end{aligned}}", r"c_{-1} \end{aligned}"),
    (r"\frac{2n-1}{2^{n}}=", r"\frac{2n-1}{2^{n}}}="),
    (r"\chi^2_{\text{拟合检验法}", r"\chi^2\text{ 拟合检验法"),
    (r"^{\frac{3{2}}}", r"^{\frac{3}{2}}"),
    (r"\frac{3{2}}", r"\frac{3}{2}"),
    (r"\frac{\pi{2}", r"\frac{\pi}{2}"),
    (r"\text{F=ma}", r"F=ma"),
    (r"t_{\alpha}(n)\text\end{aligned}", r"t_{\alpha}(n)\text{。}\end{aligned}"),
    (r"t_{\alpha}(n)\text", r"t_{\alpha}(n)\text{。}"),
    (r"x>1\2x-1)\frac{\pi}{2}", r"x>1\\(2x-1)\frac{\pi}{2}"),
    (r"\int_{-\frac{\pi}{2}}^{\frac{\pi}{2}}_{\pi}", r"\int_{-\frac{\pi}{2}}^{\frac{\pi}{2}}"),
    (r"\left|\text{gradu}\right|_{(-1,1,\frac{1}{4})}=\sqrt{1^{2}+(-2)^{2}+1^{2}}=\sqrt{6}.\end{aligned}\right.", r"\left|\text{grad }u\right|_{(-1,1,\frac{1}{4})}=\sqrt{1^{2}+(-2)^{2}+1^{2}}=\sqrt{6}.\end{aligned}"),
    (r"y''=\frac{x^2-x+4}{\left(1-x\right)^{\frac{3}{2}}>0,", r"y''=\frac{x^2-x+4}{(1-x)^{\frac{3}{2}}}>0,"),
    (r"\text{ y''=\frac{x^2-x+4}{\left(1-x\right)^{\frac{3}{2}}>0,}", r"y''=\frac{x^2-x+4}{(1-x)^{\frac{3}{2}}}>0,"),
    (r"\left(-\infty,-1\right) \text{}\text{内}", r"\left(-\infty,-1\right)\text{ 内 }"),
    (r"\left(-\infty,-1\right) \text{ \text{内} }", r"\left(-\infty,-1\right)\text{ 内 }"),
    (r"\text{\left(-\infty,-1\right) \text{}\text{内}\text{ y''=\frac{x^2-x+4}{\left(1-x\right)^{\frac{3}{2}}>0,}", r"\left(-\infty,-1\right)\text{ 内 }y''=\frac{x^2-x+4}{(1-x)^{\frac{3}{2}}}>0,"),
    (r"\text{\left[-\frac{\pi{2},\frac{\pi}{2}\right] }", r"\left[-\frac{\pi}{2},\frac{\pi}{2}\right] "),
    (r"\text{ dp=pdA,\\ p=", r"dp=pdA,\\ p="),
    (r"{\text{一位中学校长", r"\text{一位中学校长"),
    (r"\end{array}{\overset", r"\end{array}}{\overset"),
    (r"\end{array} {\overset", r"\end{array}}{\overset"),
    (r"^{\frac{\pi}{2}}^{[\frac{\pi}{2}]}", r"^{\frac{\pi}{2}}"),
    (r"\text{\\ & }", r"\\ & "),
]


def norm_key(name: str) -> str:
    return re.sub(r"[\s_]+", "", name)


def fix_text_mode_math(s: str) -> str:
    # First, close any `\text{...` that runs straight into another `\text{`, `\\`, or `\end{` without closing brace.
    out = []
    i = 0
    n = len(s)
    while i < n:
        m = re.match(r"\\(text|textit|texttt|textbf)\s*\{", s[i:])
        if m:
            cmd = m.group(1)
            start_brace = i + m.end() - 1
            depth = 1
            j = start_brace + 1
            hit_unclosed_boundary = False
            while j < n and depth > 0:
                if s[j] == "\\" and j + 1 < n:
                    # If we hit `\text{` or `\end{` or `\\` at depth == 1, the outer \text{ was unclosed!
                    if depth == 1 and (
                        s[j:].startswith(r"\text{")
                        or s[j:].startswith(r"\end{")
                        or s[j : j + 2] == r"\\"
                    ):
                        hit_unclosed_boundary = True
                        break
                    j += 2
                    continue
                if s[j] == "{":
                    depth += 1
                elif s[j] == "}":
                    depth -= 1
                j += 1
            if hit_unclosed_boundary:
                inner = s[start_brace + 1 : j]
                end_pos = j
            elif depth == 0:
                inner = s[start_brace + 1 : j - 1]
                end_pos = j
            else:
                inner = s[start_brace + 1 :]
                end_pos = n

            if re.search(r"\\[A-Za-z]+|[_^]", inner):
                inner_clean = re.sub(r"\\text\s*\{([^}]*)\}", r"\1", inner)
                parts = re.split(r"([\u4e00-\u9fff，。；：？！、“”‘’（）《》【】]+)", inner_clean)
                rebuilt = []
                for part in parts:
                    if not part:
                        continue
                    if re.fullmatch(r"[\u4e00-\u9fff，。；：？！、“”‘’（）《》【】]+", part):
                        rebuilt.append(f"\\{cmd}{{{part}}}")
                    elif re.search(r"\\[A-Za-z]+|[_^]", part):
                        rebuilt.append(" " + part + " ")
                    else:
                        rebuilt.append(f"\\{cmd}{{{part}}}")
                out.append("".join(rebuilt))
                i = end_pos
                continue
            elif hit_unclosed_boundary or depth > 0:
                out.append(f"\\{cmd}{{{inner}}}")
                i = end_pos
                continue
        out.append(s[i])
        i += 1
    return "".join(out)


def balance_environments(s: str) -> str:
    token_re = re.compile(r"\\(begin|end)\{([a-zA-Z*]+)\}")
    stack: list[str] = []
    out: list[str] = []
    last = 0
    for m in token_re.finditer(s):
        out.append(s[last : m.start()])
        kind, env = m.group(1), m.group(2)
        if kind == "begin":
            stack.append(env)
            out.append(m.group(0))
        else:
            if stack and stack[-1] == env:
                stack.pop()
                out.append(m.group(0))
            elif stack and env in stack:
                while stack and stack[-1] != env:
                    unclosed = stack.pop()
                    out.append(f"\\end{{{unclosed}}}")
                stack.pop()
                out.append(m.group(0))
            elif not stack:
                pass
            else:
                top = stack.pop()
                out.append(f"\\end{{{top}}}")
        last = m.end()
    out.append(s[last:])
    while stack:
        top = stack.pop()
        out.append(f"\\end{{{top}}}")
    return "".join(out)


def balance_braces_in_math(s: str) -> str:
    s = re.sub(r"([_^])\{([0-9A-Za-z\\]+)\\quad\s*\\end", lambda m: f"{m.group(1)}{{{m.group(2)}}}\\quad \\end", s)
    s = re.sub(r"([_^])\{([0-9A-Za-z]+)\\prime\\quad\s*\\end", lambda m: f"{m.group(1)}{{{m.group(2)}}}'\\quad \\end", s)
    depth = 0
    unmatched_close = []
    open_stack = []
    i = 0
    while i < len(s):
        if s[i] == "\\" and i + 1 < len(s):
            i += 2
            continue
        if s[i] == "{":
            open_stack.append(i)
            depth += 1
        elif s[i] == "}":
            if open_stack:
                open_stack.pop()
                depth -= 1
            else:
                unmatched_close.append(i)
        i += 1
    if unmatched_close:
        bad = set(unmatched_close)
        s = "".join(ch for idx, ch in enumerate(s) if idx not in bad)
    if depth > 0:
        if s.endswith(r"\end{aligned}"):
            s = s[: -len(r"\end{aligned}")] + ("}" * depth) + r"\end{aligned}"
        elif s.endswith(r"\end{array}"):
            s = s[: -len(r"\end{array}")] + ("}" * depth) + r"\end{array}"
        else:
            s = s + ("}" * depth)
    return s


def balance_delimiters(s: str) -> str:
    s = re.sub(r"\\left\s*\{\s*l\s*\}", "l", s)
    s = re.sub(r"\\left\s+l\b", "l", s)
    s = re.sub(r"\\left\s*/", "/", s)
    s = re.sub(r"\\right\{=\}", r"\\right. =", s)
    s = s.replace(r"\big{(", r"\big(")
    s = re.sub(r"\\end\{(aligned|array)\}\s*\\right[.)\]]", r"\\end{\1}", s)
    left_count = len(re.findall(r"\\left(?![A-Za-z])", s))
    right_count = len(re.findall(r"\\right(?![A-Za-z])", s))
    if left_count != right_count:
        s = re.sub(r"\\left\s*\.", "", s)
        s = re.sub(r"\\right\s*\.", "", s)
        s = re.sub(r"\\left(?![A-Za-z])\s*", "", s)
        s = re.sub(r"\\right(?![A-Za-z])\s*", "", s)
    return s


def normalize_latex(expr: str) -> str:
    s = expr.strip()
    s = re.sub(r"^```(?:latex)?\s*", "", s)
    s = re.sub(r"\s*```$", "", s)
    for bad, good in EXACT_LATEX_TYPO_FIXES:
        if bad in s:
            s = s.replace(bad, good)
    # Collapse `... \end{aligned}}}` trailing extra braces that came from unclosed `\text{...`
    s = re.sub(r"(\\end\{(?:aligned|array)\})\}+$", r"\1", s)
    s = s.replace(r"\upleftarrow", "").replace(r"\circlearrowend", "").replace(r"\tinyarrow", "")
    s = re.sub(r"(?<!\\)%", r"\\%", s)
    s = re.sub(r"\\text\{\\boldmath([A-Za-z]+)\}", lambda m: r"\boldsymbol{" + m.group(1) + "}", s)
    s = re.sub(r"\\text\{\\boldmath(\\[A-Za-z]+)([^}]*)\}", lambda m: r"\boldsymbol{" + m.group(1) + "}" + m.group(2), s)
    s = re.sub(r"\\boldmath\s+([0-9.]+)", lambda m: r"\mathbf{" + m.group(1) + "}", s)
    s = s.replace(r"\boldmath", r"\boldsymbol")
    s = re.sub(r"\\textbf\s*\{\s*\\em\s+([^}]+)\}", lambda m: r"\boldsymbol{" + m.group(1) + "}", s)
    s = re.sub(r"\\em\b", "", s)
    s = s.replace(r"\textsc", r"\text")
    s = re.sub(r"\\arccot\b", r"\\operatorname{arccot}", s)
    s = re.sub(r"\\arctg\b", r"\\arctan", s)
    s = re.sub(r"\\ctg\b", r"\\cot", s)
    s = re.sub(r"\\tg\b", r"\\tan", s)
    s = re.sub(r"\\limarctan\b", r"\\lim \\arctan", s)
    s = re.sub(r"\\ddfrac\b", r"\\dfrac", s)
    s = re.sub(r"\\schi\b", r"\\chi", s)
    s = re.sub(r"\\ntext\b", r"\\text", s)
    s = re.sub(r"\\@cdots\b", r"\\cdots", s)
    s = re.sub(r"\\displaylimits\b", r"\\limits", s)
    s = re.sub(r"\\textless\b", "<", s)
    s = re.sub(r"\\textgreater\b", ">", s)
    s = re.sub(r"\\eqno\{([^}]*)\}", lambda m: r"\quad " + m.group(1), s)
    s = s.replace(r"\hfill", r"\quad ").replace(r"\hskip 20pt", r"\quad ")
    s = s.replace(r"\upmu", r"\mu")
    s = re.sub(r"(?<!\\)\\L(?![a-z])", "L", s)
    s = s.replace(r"\。", "。").replace(r"\）", "）").replace(r"\、", "、")
    s = s.replace(r"\begin{garray}", r"\begin{array}").replace(r"\end{garray}", r"\end{array}")
    s = re.sub(r"\\begin\{minipage\}(?:\[[^\]]*\])?\{[^}]*\}", "", s)
    s = s.replace(r"\end{minipage}", "")
    s = re.sub(r"\\intertext\{((?:[^{}]|\{[^{}]*\})*)\}", lambda m: r"\\ " + m.group(1) + r" \\", s)
    s = re.sub(r"\\tag\*?\{([^}]*)\}", lambda m: r"\quad " + m.group(1), s)
    if r"\begin{equation}" in s and r"\end{aligned}" in s and r"\end{equation}" not in s:
        s = s.replace(r"\begin{equation}", r"\begin{aligned}")
    s = re.sub(r"\\hbox to [^\{]+\{\\hss([^}]*)\}", lambda m: m.group(1), s)
    s = re.sub(r"\\hbox\{([^}]*)\}", lambda m: m.group(1), s)
    s = re.sub(r"\\mathop\{\\vrule[^}]*\}", "", s)
    s = re.sub(r"\\setlength\{\\unitlength\}\{[^}]*\}", "", s)
    s = re.sub(r"(?:\\!\s*){6,}", "", s)
    s = re.sub(r"(?:\\quad\s*){6,}", r"\\quad ", s)
    s = re.sub(r"(?:\\,\s*){8,}", r"\\quad ", s)
    s = re.sub(r"(?<!\\)\\([asedi0-9\-])(?![A-Za-z])", lambda m: r"\\" + m.group(1), s)
    s = re.sub(r"(?<!\\)\\\(", r"\\\\(", s)
    s = re.sub(r"\\vdot\b", "", s)
    s = re.sub(r"\\bin$", "", s)
    s = re.sub(r"@\{[^}]*\}", "", s)
    s = re.sub(r"\\left\|\\limits", r"\\Big|", s)
    s = re.sub(r"(\d+|\})\s*\\limits_\{([^}]*)\}\^\{([^}]*)\}", lambda m: f"{m.group(1)}\\Big|_{{{m.group(2)}}}^{{{m.group(3)}}}", s)
    s = re.sub(r"\|\s*\\limits", r"\\Big|", s)
    s = re.sub(r"(\\limits_\{[^}]*\})\\limits_\{([^}]*)\}", lambda m: m.group(1) + r"\," + m.group(2), s)
    s = re.sub(r"_\{([^}]+)\}_\{([^}]+)\}", lambda m: f"_{{{m.group(1)}}}^{{{m.group(2)}}}", s)
    s = re.sub(r"\^\{([^}]+)\}_\{([^}]+)\}\^\{([^}]+)\}", lambda m: f"_{{{m.group(2)}}}^{{{m.group(1)} {m.group(3)}}}", s)
    s = re.sub(r"_\{([^}]+)\}\^\{([^}]+)\}\^\{([^}]+)\}", lambda m: f"_{{{m.group(1)}}}^{{{m.group(2)} {m.group(3)}}}", s)
    s = re.sub(r"([A-Za-z])_\{([^}]+)\}\^\{\\prime\}\^\{([^}]+)\}", lambda m: f"{{{m.group(1)}_{{{m.group(2)}}}'}}^{{{m.group(3)}}}", s)
    s = re.sub(r"(\\frac\{[^}]+\}\{[^}]+\})\s*\\over(?![a-zA-Z])\s*([^\]\s,]+)", lambda m: f"\\frac{{{m.group(1)}}}{{{m.group(2)}}}", s)
    s = s.replace(r"^'", "'")
    s = re.sub(r"\\multicolumn\{(\d+)\}\{[^}]*\}\{([^}]*)\}", lambda m: m.group(2) + (" & " * (int(m.group(1)) - 1)), s)
    if s.startswith(r"\frac {x ="):
        s = s[len(r"\frac {") : -1]
    s = s.replace(r"\text{\\ & }", r"\\ & ").replace(r"\text{\\&}", r"\\&")
    s = s.replace(r"\text{  \\ & }", r"\\ & ").replace(r"\text{ \\ & }", r"\\ & ")
    s = fix_text_mode_math(s)
    s = re.sub(r"\\text\s*\{\s*\\\\\s*&\s*\}", r"\\\\ & ", s)
    s = re.sub(r"\\text\s*\\end", r"\\end", s)
    s = re.sub(r"\\right\s*=", r"\\right. =", s)
    s = balance_delimiters(s)
    s = balance_environments(s)
    s = balance_braces_in_math(s)
    if "&" in s and not re.search(r"\\begin\{(aligned|array|cases|pmatrix|bmatrix|vmatrix|matrix|smallmatrix)\}", s):
        s = r"\begin{aligned}" + s + r"\end{aligned}"
    return s.strip()


def is_block_math(expr: str) -> bool:
    if "\n" in expr or r"\\" in expr:
        return True
    if any(env in expr for env in (r"\begin{aligned}", r"\begin{array}", r"\begin{cases}", r"\begin{pmatrix}", r"\begin{bmatrix}", r"\begin{vmatrix}", r"\begin{matrix}")):
        return True
    return False


def render_math_span(expr: str, display: bool) -> str:
    escaped = html.escape(expr, quote=True)
    cls = "math-tex math-block" if display else "math-tex math-inline"
    tag = "div" if display else "span"
    disp_attr = "true" if display else "false"
    return f'<{tag} class="{cls}" data-display="{disp_attr}" data-tex="{escaped}">{escaped}</{tag}>'


def field_to_html(raw: str, is_option: bool = False) -> str:
    s = raw.strip()
    if s == "*（原图失效）*":
        return '<span class="missing-source">（原题库源图失效，暂无内容）</span>'

    if "$$" in s:
        parts = re.split(r"(\$\$[\s\S]*?\$\$)", s)
        html_chunks: list[str] = []
        for part in parts:
            if not part:
                continue
            if part.startswith("$$") and part.endswith("$$"):
                inner = normalize_latex(part[2:-2])
                if not inner:
                    continue
                display = (not is_option) and is_block_math(inner)
                html_chunks.append(render_math_span(inner, display=display))
            else:
                text = part.strip()
                if not text:
                    continue
                for para in re.split(r"\n{2,}", text):
                    para = para.strip()
                    if para:
                        html_chunks.append(f'<span class="latex-text">{html.escape(para)}</span>')
        return "\n".join(html_chunks) if html_chunks else '<span class="missing-source">（暂无内容）</span>'

    if re.search(r"\\[a-zA-Z]+|[_^{}]", s):
        inner = normalize_latex(s)
        display = (not is_option) and is_block_math(inner)
        return render_math_span(inner, display=display)

    # Pure plain text or simple numeric/symbolic expression (e.g. "3", "- 3", "y = x", "充分必要条件")
    # If it contains no Chinese characters and looks like a short math formula (e.g. "x - 2", "- 1 < a < 1", "0 . 2"),
    # normalize spaces like "0 . 2" -> "0.2" and render cleanly as inline math or text.
    if not re.search(r"[\u4e00-\u9fff]", s):
        compact = re.sub(r"(\d)\s*\.\s*(\d)", r"\1.\2", s)
        return render_math_span(compact, display=False)

    return f'<span class="latex-text">{html.escape(s)}</span>'


def parse_markdown_questions(md_path: Path, subject_id: str, chapter_name: str) -> tuple[str, dict[int, dict]]:
    txt = md_path.read_text(encoding="utf-8")
    if "源数据缺失" in txt:
        return "missing_source", {}

    blocks = re.split(r"(?m)^### 第 (\d+) 题[^\n]*\n", txt)
    questions: dict[int, dict] = {}
    override_prefix = f"{subject_id}/{chapter_name}"

    for i in range(1, len(blocks), 2):
        qnum = int(blocks[i])
        body = blocks[i + 1]
        m = re.match(r"^(.*?)\n(- A\..*?)<details><summary>解析</summary>(.*?)</details>", body, re.S)
        if not m:
            raise ValueError(f"Failed to parse question #{qnum} in {md_path}")
        prompt_raw = m.group(1).strip()
        opts_block = m.group(2).strip()
        analysis_raw = m.group(3).strip()

        opt_parts = re.split(r"(?m)^- ([ABCD])\. ", opts_block)
        if len(opt_parts) != 9:
            raise ValueError(f"Unexpected option count for question #{qnum} in {md_path}")
        opts_raw = {opt_parts[j]: opt_parts[j + 1].strip() for j in range(1, 9, 2)}

        prompt_raw = MANUAL_FIELD_OVERRIDES.get((override_prefix, qnum, "prompt"), prompt_raw)
        analysis_raw = MANUAL_FIELD_OVERRIDES.get((override_prefix, qnum, "analysis"), analysis_raw)
        for lbl in ("A", "B", "C", "D"):
            opts_raw[lbl] = MANUAL_FIELD_OVERRIDES.get((override_prefix, qnum, lbl), opts_raw[lbl])

        questions[qnum] = {
            "prompt": prompt_raw,
            "options": opts_raw,
            "analysis": analysis_raw,
        }

    return "ok", questions


def build_md_index(ocr_root: Path) -> dict[str, dict[str, Path]]:
    index: dict[str, dict[str, Path]] = {}
    for subject_id, (_, _, folder_name) in SUBJECT_FOLDERS.items():
        subj_dir = ocr_root / folder_name
        if not subj_dir.exists():
            raise FileNotFoundError(f"Missing OCR directory: {subj_dir}")
        index[subject_id] = {norm_key(p.stem): p for p in subj_dir.rglob("*.md")}
    return index


def convert_all(ocr_root: Path, remove_images: bool) -> dict:
    if not MANIFEST_PATH.exists():
        raise FileNotFoundError(f"Missing manifest: {MANIFEST_PATH}")

    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    md_index = build_md_index(ocr_root)

    total_questions = 0
    total_chapters = 0
    missing_source_chapters: list[str] = []

    for subject in manifest["subjects"]:
        subject_id = subject["id"]
        subject_total = 0

        for chapter in subject["chapters"]:
            chapter_id = chapter["id"]
            chapter_json_path = PROJECT_ROOT / chapter["json_path"]
            chapter_data = json.loads(chapter_json_path.read_text(encoding="utf-8"))

            if chapter["question_count"] == 0:
                chapter_data["format"] = "latex"
                chapter_json_path.write_text(
                    json.dumps(chapter_data, ensure_ascii=False, indent=2),
                    encoding="utf-8",
                )
                total_chapters += 1
                continue

            stem_key = norm_key(Path(chapter["source_html"]).stem)
            md_path = md_index[subject_id].get(stem_key)
            if md_path is None:
                raise FileNotFoundError(f"No OCR markdown matched {subject_id}/{chapter_id}: {chapter['source_html']}")

            status, md_questions = parse_markdown_questions(md_path, subject_id, chapter["name"])
            if status == "missing_source":
                missing_source_chapters.append(f"{subject['name']} / {chapter['name']}")
                chapter_data["question_count"] = 0
                chapter_data["questions"] = []
                chapter_data["format"] = "latex"
                chapter_data["source_missing"] = True
                chapter["question_count"] = 0
                chapter_json_path.write_text(
                    json.dumps(chapter_data, ensure_ascii=False, indent=2),
                    encoding="utf-8",
                )
                total_chapters += 1
                continue

            if len(md_questions) != len(chapter_data["questions"]):
                raise ValueError(
                    f"Question count mismatch in {subject_id}/{chapter_id}: "
                    f"JSON={len(chapter_data['questions'])} vs MD={len(md_questions)}"
                )

            for q in chapter_data["questions"]:
                qnum = q["number"]
                md_q = md_questions[qnum]
                q["prompt_html"] = field_to_html(md_q["prompt"], is_option=False)
                for opt in q["options"]:
                    opt["html"] = field_to_html(md_q["options"][opt["label"]], is_option=True)
                q["analysis_html"] = field_to_html(md_q["analysis"], is_option=False)

            chapter_data["format"] = "latex"
            chapter_data["source_md"] = md_path.relative_to(ocr_root).as_posix()
            chapter_json_path.write_text(
                json.dumps(chapter_data, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )

            subject_total += len(chapter_data["questions"])
            total_chapters += 1

        subject["question_count"] = subject_total
        total_questions += subject_total

    manifest["generated_at"] = datetime.now(timezone.utc).isoformat()
    manifest["format"] = "latex"
    manifest["source_dir"] = ocr_root.name
    manifest["total_questions"] = total_questions
    manifest = reorder_manifest_subjects(manifest)
    MANIFEST_PATH.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    if remove_images and STATIC_ASSETS_DIR.exists():
        shutil.rmtree(STATIC_ASSETS_DIR)

    return {
        "total_subjects": len(manifest["subjects"]),
        "total_chapters": total_chapters,
        "total_questions": total_questions,
        "missing_source_chapters": missing_source_chapters,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Replace image question banks with LaTeX OCR markdown.")
    parser.add_argument(
        "--ocr-dir",
        default=str(PROJECT_ROOT.parent / "数学题库OCR_全部"),
        help="Directory containing OCR markdown files (gs, xd, gl, fb_(1)).",
    )
    parser.add_argument(
        "--keep-images",
        action="store_true",
        help="Keep static/generated/assets PNG files instead of deleting them.",
    )
    args = parser.parse_args()

    result = convert_all(Path(args.ocr_dir).resolve(), remove_images=not args.keep_images)
    print(
        f"Converted {result['total_questions']} questions across {result['total_chapters']} chapters "
        f"({result['total_subjects']} subjects) to LaTeX format."
    )
    if result["missing_source_chapters"]:
        print("Chapters with missing source images (set to 0 questions):", result["missing_source_chapters"])


if __name__ == "__main__":
    main()
