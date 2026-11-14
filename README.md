<div align="center">

# 📐 Math · 数学题库

*把注意力留给题目本身 · 基于 Flask + KaTeX 的极简数学刷题工作台*

[![Online Demo](https://img.shields.io/badge/Online-mathe.kawwaii.de-4F46E5?style=flat-square&logo=cloudflare)](https://mathe.kawwaii.de)
[![Python](https://img.shields.io/badge/Python-3.11%2B-blue?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-3.0-black?style=flat-square&logo=flask)](https://flask.palletsprojects.com/)
[![KaTeX](https://img.shields.io/badge/Render-KaTeX-059669?style=flat-square&logo=latex&logoColor=white)](https://katex.org/)
[![Stars](https://img.shields.io/github/stars/Mufumoca/math?style=flat-square&logo=github&color=ff69b4)](https://github.com/Mufumoca/math/stargazers)

<br>

<p>
  <a href="https://github.com/Mufumoca/math">
    <img src="https://count.getloli.com/@Mufumoca-math?theme=moebooru" alt="Moe Counter" />
  </a>
</p>

</div>

---

这是一个基于 Flask 的数学刷题网站。

题库来源是四个原始压缩包中的章节 HTML 文件：

- 高数
- 线代
- 概率论
- 复变函数

这些原始 HTML 不是普通文本题库，题干、选项、答案标记、解析大多都嵌在 HTML 结构和内联图片里。这个项目做了两件事：

1. 分析原始 HTML 结构，抽取出结构化题目 JSON。
2. 基于抽取结果搭建可直接运行的刷题网站。

项目尽量保留原始题库内容的展示效果，不改原始压缩包，也不改原始 HTML 文件。

## 网站功能

- 首页按科目进入
- 科目页按章节进入
- 刷题页左侧章节栏支持整体收起
- 每页同时显示 10 题
- 支持顶部和底部翻页
- 用户点击选项后立即判题
- 题号导航会标记答对、答错、已收藏
- 解析直接显示在题目下方
- 每道题支持收藏
- 收藏页按科目和章节分组浏览
- 收藏题支持查看原题、取消收藏、展开解析
- 支持浅色、深色、跟随系统三种主题模式
- 题目、选项与解析使用本地 KaTeX 渲染 LaTeX 公式

## 题库格式说明

- 题库已从早期内嵌图片格式替换为结构化 LaTeX JSON（位于 `data/extracted/`），不再依赖 `static/generated/assets/` 下的海量图片。
- 可通过 `scripts/import_latex_questions.py` 将 `../数学题库OCR_全部` 中的 Markdown/LaTeX 题库重新导入 `data/`。

## 仓库内容

仓库包含：

- Flask 网站代码
- 题库抽取与 LaTeX 导入脚本
- 已转为 LaTeX 格式的章节 JSON
- 本地 KaTeX 静态资源（`static/vendor/katex/`）
- Caddy 和 systemd 部署示例

仓库不包含：

- 原始压缩包 `高数.zip`、`线代.zip`、`概率论.zip`、`复变.zip`
- OCR 原始 Markdown 目录 `数学题库OCR_全部`
- 本地虚拟环境
- 运行日志

## 项目结构

```text
.
├── app.py
├── requirements.txt
├── run.sh
├── README.md
├── scripts/
│   ├── extract_questions.py
│   └── import_latex_questions.py
├── data/
│   ├── subjects.json
│   └── extracted/
├── templates/
│   ├── base.html
│   ├── index.html
│   ├── subject.html
│   ├── chapter.html
│   └── favorites.html
├── static/
│   ├── css/style.css
│   ├── js/app.js
│   └── vendor/katex/
└── deploy/
    ├── Caddyfile.example
    └── math.service
```

## 本地部署教程

### 1. 准备环境

建议环境：

- Linux
- Python 3.11 及以上
- `venv`

先进入项目目录：

```bash
cd math
```

创建虚拟环境并安装依赖：

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. 直接使用仓库内现成数据启动

仓库已经包含转为 LaTeX 格式的题目 JSON 和本地 KaTeX 静态资源，所以本地测试时不需要重新导入题库，直接启动即可。

开发模式：

```bash
source .venv/bin/activate
HOST=127.0.0.1 PORT=5080 python app.py
```

或使用 Gunicorn：

```bash
source .venv/bin/activate
HOST=127.0.0.1 PORT=5080 ./run.sh
```

浏览器访问：

```text
http://127.0.0.1:5080/
```

如果你本机支持 IPv6，也可以这样启动：

```bash
source .venv/bin/activate
HOST=:: PORT=5080 python app.py
```

### 3. 本地开发时常见问题

如果页面样式或脚本看起来没更新：

- 强制刷新浏览器缓存
- 重新启动 Flask 或 Gunicorn

如果端口被占用，可以换一个端口：

```bash
HOST=127.0.0.1 PORT=8000 python app.py
```

## 从原始压缩包重新抽取题库

如果你要基于新的原始题库重建数据，需要把四个 zip 放到项目上级目录，例如：

```text
../高数.zip
../线代.zip
../概率论.zip
../复变.zip
```

然后执行：

```bash
source .venv/bin/activate
python scripts/extract_questions.py
```

抽取结果会写入：

- `data/subjects.json`
- `data/extracted/<subject_id>/<chapter_id>.json`
- `static/generated/assets/...`

原始 zip 和 HTML 不会被修改。

## 生产部署

### 1. 使用 systemd 托管

仓库里提供了示例服务文件：

- `deploy/math.service`

可按下面方式安装：

```bash
sudo cp deploy/math.service /etc/systemd/system/math.service
sudo systemctl daemon-reload
sudo systemctl enable --now math
```

查看状态：

```bash
systemctl status math
```

### 2. 使用 Caddy 反向代理

仓库里提供了示例配置：

- `deploy/Caddyfile.example`

示例：

```caddy
example.com {
	encode zstd gzip
	reverse_proxy 127.0.0.1:5080
}
```

## 启动命令总结

开发启动：

```bash
HOST=127.0.0.1 PORT=5080 python app.py
```

Gunicorn 启动：

```bash
HOST=127.0.0.1 PORT=5080 ./run.sh
```

重新抽取：

```bash
python scripts/extract_questions.py
```
