# 东北大学机考题库刷题网站

这是一个基于 Flask 的刷题网站，用来整理和浏览东北大学数学相关机考题库。

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
- 尽量保留图片、公式、换行和原始排版

## 数据分析结论

- 原始题库按科目存放在四个 zip 文件内。
- 每个章节对应一个 HTML 文件。
- 每道题对应 `main > div` 下的一个题块。
- 每题固定是 6 行表格：
  - 第 1 行是题干
  - 第 2 到第 5 行是 A-D 四个选项
  - 第 6 行是解析
- 正确选项通过题块内样式标记识别。
- 题干、选项、解析主要以嵌入图片的形式存在。
- 抽取脚本会把图片导出到 `static/generated/assets/`，并把题目结构写入 `data/extracted/`。

## 仓库内容

仓库包含：

- Flask 网站代码
- 题库抽取脚本
- 已抽取好的章节 JSON
- 已导出的静态图片资源
- Caddy 和 systemd 部署示例

仓库不包含：

- 原始压缩包 `高数.zip`、`线代.zip`、`概率论.zip`、`复变.zip`
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

## 本地部署教程

### 1. 准备环境

建议环境：

- Linux
- Python 3.11 及以上
- `venv`

先进入项目目录：

```bash
cd neumathe_lite
```

创建虚拟环境并安装依赖：

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. 直接使用仓库内现成数据启动

仓库已经包含抽取好的 JSON 和静态图片资源，所以本地测试时不需要重新抽取题库，直接启动即可。

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

- `deploy/neumathe-quiz.service`

可按下面方式安装：

```bash
sudo cp deploy/neumathe-quiz.service /etc/systemd/system/neumathe-quiz.service
sudo systemctl daemon-reload
sudo systemctl enable --now neumathe-quiz
```

查看状态：

```bash
systemctl status neumathe-quiz
```

### 2. 使用 Caddy 反向代理

仓库里提供了示例配置：

- `deploy/Caddyfile.example`

示例：

```caddy
mathe.kawwaii.de {
	encode zstd gzip
	reverse_proxy 127.0.0.1:5080
}
```

如果你已经把域名解析到服务器并且打开了 Cloudflare 代理，可以继续让 Caddy 在服务器本机处理证书和反代。

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
