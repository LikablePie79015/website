---
title: "使用 Vite 搭建静态博客"
date: "2026-08-25"
tags: ["前端", "教程"]
---

# 使用 Vite 搭建静态博客

这篇笔记记录了我如何使用 [Vite](https://vitejs.dev) 快速搭建一个支持 Markdown 与 LaTeX 的静态博客。

## 核心思路

静态博客的核心逻辑很简单：

1. 把 Markdown 文件转换为 HTML
2. 针对数学公式使用 KaTeX 进行渲染
3. 借助 Vite 实现开发与构建

## Markdown 转 HTML

使用 `marked` 这个轻量级库即可：

```javascript
import { marked } from "marked";

const html = marked.parse(markdownText);
```

## LaTeX 渲染

### 拆分行内公式与块级公式

在渲染 Markdown 之前，先把数学公式的定界符替换为占位符，这样 `marked` 就不会把它们当成普通文本：

```javascript
import katex from "katex";

// 处理块级公式 $$...$$
content = content.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
  return "%%MATH_BLOCK%%" + Buffer.from(tex).toString("base64") + "%%END%%";
});

// 处理行内公式 $...$
content = content.replace(/\$([^$]+?)\$/g, (_, tex) => {
  return "%%MATH_INLINE%%" + Buffer.from(tex).toString("base64") + "%%END%%";
});
```

### 恢复占位符

Markdown 转换完成后，把占位符恢复成 KaTeX 渲染后的 HTML：

```javascript
result = result.replace(/%%MATH_BLOCK%%([A-Za-z0-9+/=]+)%%END%%/g, (_, b64) => {
  const tex = Buffer.from(b64, "base64").toString("utf-8");
  return `<div class="math-block">${katex.renderToString(tex, {
    displayMode: true
  })}</div>`;
});
```

## 常用快捷键

| 动作 | 说明 |
| ---- | ---- |
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建生产版本 |
| `npm run preview` | 预览构建结果 |

希望这份笔记对你有帮助！
