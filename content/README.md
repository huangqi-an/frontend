# Content

`notes/` 保存随笔、学习笔记和踩坑记录，`posts/` 保存可发布的博客草稿与正式文章，`assets/` 保存配图。

每篇 Markdown 使用以下 frontmatter：

```yaml
---
title: 文章标题
date: 2026-09-17
tags:
  - Vue
  - TypeScript
summary: 一句话摘要
draft: true
---
```

内容类型由所在目录决定，不需要额外维护 `type` 字段。
