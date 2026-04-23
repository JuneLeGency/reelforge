# Reelforge

Universal programmatic video generation framework.

## 🧭 Agent onboarding

**Read [`docs/INDEX.md`](./docs/INDEX.md) first** — a 30-second
orientation + pointers to the doc you actually need. Don't read every
doc; jump from the index.

Key reads when you touch specific areas:
- Adding a template → [`docs/TEMPLATES.md`](./docs/TEMPLATES.md)
- Nested / multi-widget slides → [`docs/COMPOSITE.md`](./docs/COMPOSITE.md)
- Rendering bugs → [`docs/DECISIONS.md`](./docs/DECISIONS.md) + [`docs/RENDERING.md`](./docs/RENDERING.md) (check DECISIONS first — many bugs are already fixed)
- Commit / test conventions → [`docs/CONVENTIONS.md`](./docs/CONVENTIONS.md)
- Full architecture → [`DESIGN.md`](./DESIGN.md) (long-form) or [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) (short)
- Running roadmap + status → [`GAPS.md`](./GAPS.md)

## Packages

13 packages, all `@reelforge/<name>`, bun workspaces. Major ones:

```
@reelforge/ir             IR schema (Zod)
@reelforge/dsl            config.json / DSL → IR
@reelforge/cli            CLI: rf init/preview/render/tts/stt/captions/generate/compose/mcp
@reelforge/engine-chrome  Puppeteer headless:'shell' renderer + manual-keyframes adapter
@reelforge/engine-ffmpeg  Pure-slideshow fast path (xfade, 13× realtime)
@reelforge/transitions    xfade catalog (ffmpeg) + CHROME_EFFECTS (chrome overlays)
@reelforge/captions       SRT / Whisper JSON parsing, TikTok pagination
@reelforge/mux            ffmpeg audio mux + subtitle burn
@reelforge/html           HTML composition helpers
@reelforge/mcp            MCP server
@reelforge/providers-*    TTS (ElevenLabs) / STT (whisper.cpp) adapters
```

Slide templates and visual styles live inside `@reelforge/cli`:
- `packages/cli/src/slide-templates/` — 31 templates + composite + render orchestrator
- `packages/cli/src/visual-styles/` — 6 named styles + DESIGN.md per-style guide

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
