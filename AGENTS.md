# Repository Guidelines

## Project Structure & Module Organization

- `apps/playground/`: Vite application that previews Vue and React components together.
- `packages/core/`: framework-agnostic TypeScript utilities, shared types, tests, and `--fl-*` design tokens.
- `packages/ui-vue/`: Vue 3 components, composables, and colocated tests.
- `packages/ui-react/`: React 19 components, hooks, and colocated tests.
- `content/notes/`, `content/posts/`, `content/assets/`: Markdown notes, publishable drafts, and media.
- `labs/`: isolated experiments; do not add them to the root workspace until they mature.
- `tools/`: reusable scripts and future CLIs.

Place tests beside source as `*.test.ts` or `*.test.tsx`. Internal dependencies must follow `apps -> UI packages -> core`; never import Vue or React from `core`.

## Build, Test, and Development Commands

- `pnpm install`: install the pinned Node 24/pnpm 11 toolchain.
- `pnpm dev`: start the playground at `http://127.0.0.1:5173`.
- `pnpm lint`: run ESLint across the workspace.
- `pnpm typecheck`: run `tsc` or `vue-tsc` for every package.
- `pnpm test`: run all Vitest suites once.
- `pnpm test:watch`: run package tests in watch mode.
- `pnpm build`: build the playground with Vite.
- `pnpm format` / `pnpm format:check`: write or verify Prettier formatting.

## Coding Style & Naming Conventions

Use ESM and strict TypeScript. Prettier controls formatting; ESLint enforces framework and TypeScript rules. Use PascalCase for components, types, and interfaces, camelCase for functions and variables, and kebab-case for content filenames. Name internal packages `@frontend-lab/*`, reference them with `workspace:*`, and export public APIs from each package’s `src/index.ts`.

## Testing Guidelines

Vitest is the test framework. `core` uses the Node environment; Vue and React packages use jsdom. Add focused tests for behavior, props, and edge cases. Run `pnpm test`, or target one package with `pnpm --filter @frontend-lab/ui-vue test`. No coverage threshold or E2E suite is configured yet.

## Commit & Pull Request Guidelines

No usable Git history exists because `.git` is currently a read-only placeholder. After initialization, use Conventional Commits such as `feat:`, `fix:`, `docs:`, and `chore:`. Keep pull requests focused and describe the change, rationale, linked issue, and verification commands. Include screenshots for UI changes. Do not commit `node_modules`, `dist`, secrets, or generated coverage.

## Agent-Specific Instructions

Before handing off, run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`. Add dependencies to the owning package, then run `pnpm install`; do not edit `pnpm-lock.yaml` manually. Preserve the read-only `.git`, `.agents`, and `.codex` placeholders and do not initialize Git in this workspace.
