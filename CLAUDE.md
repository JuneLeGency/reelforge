# Reelforge

Universal programmatic video generation framework. **Architecture lives in [DESIGN.md](./DESIGN.md)** — read it first.

## Packages

```
packages/
  ir/   @reelforge/ir   — types + Zod schema for VideoProject (the IR all frontends compile to)
```

More packages (`core`, `html`, `dsl`, `script`, `engine-chrome`, `engine-canvas`, `engine-ffmpeg`, providers, cli, ...) will land per the M1–M4 roadmap in DESIGN.md §11.

## Toolchain

- **Runtime:** Node ≥ 22. Bun for package management and test runner.
- **Lint/Format:** oxlint and oxfmt (not eslint/prettier/biome).
- **License:** Apache-2.0.

**Do NOT run `npm install` or `pnpm install`.** This repo uses bun workspaces — `bun install` only.

## Development

```bash
bun install          # install deps across all workspaces
bun run typecheck    # tsc -b across project references
bun test             # run all workspace tests via bun test
bun run lint         # oxlint packages
bun run format       # oxfmt packages (write)
```

## Package conventions

- Every package under `packages/` is `@reelforge/<name>`, ESM-only, `"type": "module"`.
- Entry points import TS source directly in dev (`"main": "./src/index.ts"`); npm build comes later.
- Zod is the single source of truth for IR types — every TS type is `z.infer<typeof ...Schema>`.
- Import paths within a package use `.ts` internally is avoided — we use extensionless imports resolved via `moduleResolution: "bundler"`. When we switch to emitting to `dist/`, we add `.js` suffixes.

## Agent notes

- Don't commit `.claude/settings.local.json`, `ref/`, or render artifacts (`.mp4`/`.webm`). Already in `.gitignore`.
- The `ref/` directory holds 9 shallow-cloned reference repos (hyperframes, remotion, revideo, motion-canvas, twick, editly, mosaico, PPT2Video, presentation-ai) — consult but never modify.
