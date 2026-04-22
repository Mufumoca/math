# Neumathe Lite

基于四个科目压缩包抽取出来的 Flask 刷题网站，保留原始题库 HTML 中的图片、公式、换行和解析内容。

当前仓库包含：

- 网站代码
- 题库抽取脚本
- 已抽取好的章节 JSON
- 已导出的静态图片资源
- Caddy 和 systemd 部署示例

当前仓库不包含：

- 原始题库压缩包 `高数.zip`、`线代.zip`、`概率论.zip`、`复变.zip`
- 本地虚拟环境和运行日志

## 数据结构结论

- 原始题库按科目存放在四个 zip 内。
- 每个章节对应一个 HTML 文件。
- 每题对应 `main > div` 下的一个题块。
- 每题固定是 6 行表格：
  - 第 1 行题干
  - 第 2 到第 5 行选项 A-D
  - 第 6 行解析
- 题干、选项、解析主要以嵌入图片形式存在于 HTML 中。
- 抽取阶段会把图片导出到 `static/generated/assets/`，并把结构化题目写入 `data/extracted/`。

## 当前功能

- 首页按科目进入
- 科目页按章节进入
- 刷题页左侧章节栏可整体收起
- 每页同时显示 10 题
- 顶部和底部都支持上一页 / 下一页翻页
- 点击选项立即判题
- 当前页题号导航会标记答对 / 答错 / 已收藏
- 解析内嵌显示在题目下方
- 每题支持收藏
- 收藏页按科目 / 章节分组浏览收藏题
- 收藏题可查看原题、取消收藏、展开解析
- 保留原始图片、公式和排版效果

## 目录结构

```text
.
├── app.py
├── requirements.txt
├── run.sh
├── README.md
├── scripts/
│   └── extract_questions.py
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
│   └── generated/assets/
└── deploy/
    ├── Caddyfile.example
    └── neumathe-quiz.service
```

## 本地启动

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
HOST=:: PORT=5080 .venv/bin/python app.py
```

或使用 Gunicorn：

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
HOST=127.0.0.1 PORT=5080 ./run.sh
```

访问：

```text
http://[服务器IPv6]:5080/
```

## 重新抽取题库

把四个原始 zip 放在上级目录，例如：

```text
../高数.zip
../线代.zip
../概率论.zip
../复变.zip
```

然后执行：

```bash
.venv/bin/python scripts/extract_questions.py
```

抽取结果会输出到：

- `data/subjects.json`
- `data/extracted/<subject_id>/<chapter_id>.json`
- `static/generated/assets/...`

## 部署

### systemd

可参考：

- `deploy/neumathe-quiz.service`

启用方式：

```bash
sudo cp deploy/neumathe-quiz.service /etc/systemd/system/neumathe-quiz.service
sudo systemctl daemon-reload
sudo systemctl enable --now neumathe-quiz
```

### Caddy

可参考：

- `deploy/Caddyfile.example`

如果使用域名并反代到本机：

```caddy
mathe.kawwaii.de {
	reverse_proxy 127.0.0.1:5080
}
```
