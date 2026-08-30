# 个人博客

基于 Vite + Markdown 的个人博客，支持 LaTeX 数学公式渲染（使用 KaTeX）与代码块语法高亮（使用 highlight.js）。文章浏览页带有一个类「洛谷文章」的侧边目录，点击可跳转到各级标题，并支持滚动高亮当前章节。

## 使用

```bash
npm install        # 安装依赖
npm run dev        # 开发模式，访问 http://localhost:3000
npm run build      # 构建到 dist/
npm run preview    # 预览构建结果
```

## 功能特性

- **Markdown 渲染**：标题、列表、引用、链接、表格、图片等
- **LaTeX 数学公式**（KaTeX）：行内 `$...$` 与块级 `$$...$$`
- **代码块高亮**（highlight.js）：支持多种语言，带语言标签和一键复制
- **文章目录**（TOC）：文章浏览页右侧/顶部侧边目录，点击跳转各级标题，滚动高亮当前章节
- **全局搜索**（Ctrl+K）：按 `Ctrl+K`（Mac 为 `Cmd+K`）呼出搜索框，支持标题/章节/正文搜索，可跳转到具体标题
- **深色/浅色主题**：跟随系统自动切换

## 项目结构

```
blog/
├── index.html          # 入口
├── posts/              # Markdown 文章目录（在此添加 .md 文件）
│   ├── welcome.md
│   ├── linear-algebra-notes.md
│   └── build-blog-with-vite.md
├── src/
│   ├── main.js         # 入口逻辑
│   ├── blog.js         # Markdown + LaTeX 渲染
│   ├── style.css       # 样式
│   └── config.json     # 站点配置（标题、作者等）
└── vite.config.js
```

## 写新文章

在 `posts/` 目录下新建 `.md` 文件，并在 `src/main.js` 的 `dirNames` 数组中注册文件名。

文章头部使用 front-matter 格式：

```markdown
---
title: "文章标题"
date: "2026-08-30"
tags: ["标签1", "标签2"]
---

正文内容...
```

## 数学公式

- 行内公式：`$E = mc^2$`
- 块级公式：`$$ f(x) = \frac{1}{\sqrt{2\pi}\sigma} e^{-\frac{(x-\mu)^2}{2\sigma^2}} $$`
