# Frontend Workbench

一个用于积累、检索、复用和实验的个人前端工作台。仓库采用 pnpm Monorepo，并同时支持 Vue 与 React。

## 目录

```text
apps/playground/        Vue/React 组件演示与联调入口
packages/core/          框架无关的 TypeScript 工具、类型与 design tokens
packages/ui-vue/        Vue 3 组件与 composables
packages/ui-react/      React 组件与 hooks
content/notes/          随笔、学习笔记、踩坑记录
content/posts/          可发布的博客草稿与正式文章
content/assets/         内容配图
labs/                   一次性实验，默认不纳入 pnpm workspace
tools/                  可复用脚本、CLI 与代码生成器
```

## 环境

- Node.js 24.20.0
- pnpm 11.25.0

## 常用命令

```bash
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm format
```

## 使用约定

- 稳定、可复用的代码放在 `packages/`。
- 需要运行和预览的内容放在 `apps/`。
- 尚未确定价值的实验先放在 `labs/`，成熟后再提升到 workspace。
- 文章使用 Markdown 和 frontmatter，最小字段为 `title`、`date`、`tags`、`summary`、`draft`。
- 依赖方向为 `apps -> UI packages -> core`，`core` 不依赖任何 UI 框架。
- 组件先保持私有，暂不建立 npm 发布流程。

## Git 说明

当前目录中的 `.git` 是只读挂载占位，不能直接执行 `git init`。仓库内容已按 Git-ready 方式组织；在 Git 元数据可写后，再初始化并提交。
