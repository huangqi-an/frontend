---
title: pnpm workspace 的第一印象
date: 2026-09-17
tags:
  - pnpm
  - Monorepo
summary: 记录个人前端工作台为什么采用 pnpm workspace，以及哪些能力应该留到以后再加。
draft: false
---

# pnpm workspace 的第一印象

个人仓库最容易出现的问题，不是代码太少，而是不同成熟度的内容混在一起。组件、一次性实验和文章如果都在同一层目录里，几个月后就很难快速找到可复用的部分。

pnpm workspace 适合这里的第一个原因，是它能用很低的配置成本建立包边界：

- `packages/` 承载稳定、可复用的代码。
- `apps/` 承载需要运行的 demo 或站点。
- `labs/` 保留自由度，不强迫每个想法立刻工程化。

暂时不需要 Turborepo、Changesets 或完整 CI。只有出现多包构建缓存、独立发布或多人协作时，这些工具才有足够价值。
