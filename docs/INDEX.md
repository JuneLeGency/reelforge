# Reelforge — docs index

**Agent / new-session onboarding**. Start here.

> This index is the **single entry point**. Read this first, then jump
> to the doc you need. Don't read everything — context is precious.

---

## 30-second orientation

Reelforge is a **programmatic video generation framework**.

```
config.json  ─►  rf generate  ─►  engine-chrome  ─►  ffmpeg mux  ─►  mp4
  (slides,         (CLI entry,      (Puppeteer         (silent.mp4 +
   templates,       builds HTML      headless: 'shell'  audio.mp3 ──►
   style, TTS       + plans +        per-frame seek     mp4)
   audio paths)    animations)      + screenshot)
```

- 13 TypeScript packages, **bun workspaces**, ESM-only, tsc project refs
- 31 slide templates (including the meta `composite`), 10 Chrome-path
  effects, 66 ffmpeg xfade transitions, 6 named visual styles
- 224 CLI tests green; all packages typecheck

---

## Pick the doc you actually need

**I'm adding a new slide template** → [`TEMPLATES.md`](./TEMPLATES.md)
  Slot contract, registry wiring, test pattern, CSS conventions,
  animation plan shape.

**I'm working on a nested / multi-widget slide** → [`COMPOSITE.md`](./COMPOSITE.md)
  6 layout presets, child time model, id namespacing, CSS grid.

**Something renders wrong (blank, misaligned, out of sync)** → [`RENDERING.md`](./RENDERING.md) + [`DECISIONS.md`](./DECISIONS.md)
  RENDERING explains the manual-keyframes adapter + SVG attribute
  mirror + headless:'shell' path. DECISIONS has every rendering bug
  we've already fixed — **check here before re-debugging a known issue**.

**I'm changing the pipeline plumbing (CLI, config shape, IR, transitions, captions)** → [`ARCHITECTURE.md`](./ARCHITECTURE.md)
  Package responsibilities, data flow, and which files own which
  concerns.

**I'm about to commit** → [`CONVENTIONS.md`](./CONVENTIONS.md)
  Commit message style, test runner, lint, don't-commit-this list,
  CLI flag naming (`--noCaptions` not `--no-captions`).

**I want a chrome effect** → [`EFFECTS.md`](./EFFECTS.md) — catalog of
10 chrome-path effects, their parameters, visual purpose.

---

## Reference material outside docs/

These aren't repeated in `docs/` — they live at the repo root:

- [`/DESIGN.md`](../DESIGN.md) — the long-form architecture doc (719 lines).
  The single source of truth for the IR / engine split / roadmap.
  Read sections §1–§4 once when you first land on the repo.
- [`/GAPS.md`](../GAPS.md) — the running gap log vs Hyperframes /
  Remotion / etc. Near-term roadmap (R1–R9) and status are here.
- [`/CLAUDE.md`](../CLAUDE.md) — project-level AI instructions (bun /
  oxlint / no emojis / do NOT run `npm install`).
- [`/README.md`](../README.md) — user-facing "hello world".
- `/packages/cli/src/visual-styles/DESIGN.md` — per-style design guide
  (palette, easing signature, anti-patterns, template pairings).

## Quick pointers to code

| Concern | File |
|---|---|
| Template registry | `packages/cli/src/slide-templates/registry.ts` |
| Template contract | `packages/cli/src/slide-templates/types.ts` |
| Render pipeline | `packages/cli/src/slide-templates/render-composition.ts` |
| Manual-keyframes seek | `packages/engine-chrome/src/runtime.ts` |
| Puppeteer launch | `packages/engine-chrome/src/render.ts` |
| CLI config schema | `packages/cli/src/commands/generate.ts` (SlideContent) |
| Chrome effects | `packages/transitions/src/chrome-effects.ts` |
| Spring easing | `packages/cli/src/slide-templates/spring.ts` |
| Showcase demo | `examples/showcase-demo/{synth.py,stitch.py,config.json}` |
