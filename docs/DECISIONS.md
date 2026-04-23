# Decisions & bug history

**Read this before debugging anything rendering-related.** Every
entry is a bug we've already hit, root-caused, and fixed. If your
current symptom matches one of these, the fix is already in the repo
— you don't need to re-discover it.

---

## Retiring WAAPI (fix: manual-keyframes adapter)

**Commit**: `4473bd8`

**Symptom**: every animated slide template rendered mostly blank —
title / subtitle / accent-rule / chart bars / value labels
invisible. Scene-index, watermark, and bar-label (all opacity-only
animations) were fine. Anything with a `transform` animation was
missing.

**Root cause**: **two bugs stacked**.

1. **Chromium's WAAPI keyframe-interpolation**: when an animation is
   created with keyframes whose *last offset is < 1* and is then
   paused + seeked, Chromium scales progress against `lastOffset`
   instead of 1, so any seek past ~15% of duration flips straight to
   the last keyframe. Confirmed at `t=2000 / duration=28000` with
   `lastOffset=0.159`: computed opacity was ~0 (kf[4] value) instead
   of ~1 (kf[2]/kf[3] value).

2. **Headless Puppeteer screenshot timing**: new-style `headless: true`
   captures don't reliably sync with DOM mutations — even with
   `commitStyles()` and double rAF, the screenshot shows the pre-seek
   frame. WAAPI animations under headless run on wall-clock, not
   `seekFrame(t)`, so slide animations raced ahead.

**Fix**:
- `runtime.ts`: retired the WAAPI pause+seek adapter. New
  `manual-keyframes` adapter reads plans from `window.__rf.plans`,
  brackets t against each plan's atMs keyframes, linearly interpolates
  opacity + transform axes, writes directly to `el.style`
  (+ `el.setAttribute` for SVG presentation props).
- `render-composition.ts`: inline script no longer calls
  `el.animate()`. Plans are published to `window.__rf.plans` and the
  manual adapter reads from there per frame.

---

## headless: 'shell' (fix: not 'true')

**Commit**: same as above, within `4473bd8`.

**Symptom**: even after the WAAPI fix above, Chromium new-style
headless still rendered out of sync — styles were written to inline
but screenshots captured the unmutated paint tree.

**Root cause**: new Chromium headless mode's paint pipeline is
out-of-sync with style mutations. The old `headless_shell` binary
doesn't have this issue.

**Fix**: `puppeteer.launch({ headless: 'shell' as unknown as boolean })`.
Puppeteer accepts the string literal to select the old shell.

**Do NOT go back to `headless: true`** — it will silently break
seek+screenshot again.

---

## Captions synchronized via plans (not WAAPI)

**Commit**: `5d3f2a0`

**Symptom**: slide timing was fine after manual-keyframes, but
caption text was out-of-sync with the narration — caption #3 would
show over slide #1, etc.

**Root cause**: slides + chrome effects + page counter all went
through `window.__rf.plans`, but captions' fade animations were still
created by an inline `<script>` that called `el.animate(...)`
(WAAPI). WAAPI runs on wall-clock under headless; seekFrame didn't
touch caption animations, so captions drifted.

**Fix**: `render-composition.ts` now builds caption fade animations
as plans (opacity keyframes with edge offsets) and pushes them into
`animationPlans[]` alongside slide animations. Same treatment for
TikTok page fades + per-word color token animations.

**The rule**: any animation that must be frame-sync with the
pipeline **must** be a plan. No WAAPI fallback. This is non-
negotiable.

---

## chart-pie: `<path>` not `<circle stroke-dashoffset>`

**Commit**: `a79359e`

**Symptom**: chart-pie rendered the grey track ring but no coloured
slices on top — `manual-keyframes` plans for each slice correctly
wrote `stroke-dashoffset: 0` but the paint didn't update.

**Root cause**: Chromium headless shell renders `stroke-dashoffset`
updates on `<circle>` elements inconsistently mid-animation. The
style is set, but the SVG path isn't repainted.

**Fix**: each slice is now an SVG `<path>` drawing an explicit arc
(using `M x1 y1 A r r 0 largeArc 1 x2 y2`). Animation switched from
dashoffset sweep to opacity+scale pop with stagger. Same stagger
feel, always paints.

**Lesson**: for any SVG "draw-in" effect, prefer `<path>` with
explicit coordinates over `<circle>` + `stroke-dasharray` tricks.

---

## SVG presentation props need setAttribute too

**Commit**: `a79359e`

**Symptom**: chart-line, flowchart, chart-pie — any SVG-heavy
template — had occasional paint lag on stroke/fill/opacity changes.

**Fix**: manual-keyframes adapter now mirrors a small set of
presentation props to the SVG attribute layer in addition to
`el.style`:

```js
SVG_MIRROR_ATTRS = {
  opacity, transform, fill, stroke, stroke-width,
  stroke-dashoffset, stroke-dasharray,
  fill-opacity, stroke-opacity
}
```

On SVGElement targets we run both `el.style.setProperty(...)` and
`el.setAttribute(...)`. Harmless for non-SVG elements (the SVG check
skips them).

---

## split-reveal: clip-path not overflow:hidden

**Commit**: `5d3f2a0`

**Symptom**: the "title split across the middle" effect showed two
full copies of the title stacked on top of each other, with a
center-line drawn between. Not the intended "one glyph sliced in
half" look.

**Root cause**: original CSS used `height: 50%` + `overflow: hidden`
for each half. With default `line-height: 1.5`, the glyphs were
taller than each half but barely clipped, so both copies read as
full glyphs.

**Fix**: each half absolute-fills a 160 px container; each uses
`clip-path: polygon(0 0, 100% 0, 100% 50%, 0 50%)` for top and
`polygon(0 50%, 100% 50%, 100% 100%, 0 100%)` for bottom. Both spans
are at the same vertical position; clips assemble a single glyph
whose seam is exactly the center-line.

---

## Chart-pie hero-kpi grid columns

**Commit**: `f9f3a56`

**Symptom**: hero-kpi layout had 4 KPI tiles in the config but only
2 were visible.

**Root cause**: `grid-template-columns: 3fr 2fr` (2 columns) but
`grid-template-areas: 'main kpi-tl kpi-tr' 'main kpi-bl kpi-br'`
(3 columns per row). Browsers autoplaced the overflow, swallowing
`kpi-tr` and `kpi-br`.

**Fix**: `grid-template-columns: 3fr 1fr 1fr`.

**Lesson**: when defining new layout presets in `composite.ts`,
**count the areas per row** and make sure `grid-template-columns`
has the same number of tracks.

---

## citty camelCases kebab CLI flags

**Commit**: first demo run (pre-5d3f2a0); lesson applies forever.

**Symptom**: `rf generate … --no-captions` didn't disable captions —
they rendered with wrong timing on top of everything.

**Root cause**: citty maps kebab flags to camelCase object keys. We
have `noCaptions` as the schema name, so the CLI flag is
`--noCaptions` (the exact schema name), **not** `--no-captions`.

**Fix**: use the camelCase flag. Same pattern for any of our
generate flags: `--useBeginFrame`, `--tiktokCaptions`,
`--tiktokThreshold`, `--keepWorkdir`, `--noCaptions`, etc.

---

## composite children id must not collide with siblings

**Commit**: `f9f3a56`

**Decision**: child index = `100_000 + parentIndex * 100 + childPosition`.

Parent slides live in index 0..N (usually <100), so the
100_000 base + 100/parent stride means children **never** collide
with sibling slide ids or other composite children.

**Don't change this scheme lightly** — the child template's
`id="slide-${index}"` and its animation selectors `#slide-${index} .…`
depend on the numbering being unique across the whole composition.

---

## Test: bun, not jest / vitest

Commit script uses `bun test`. The package.json entry is
`"test": "bun test"`, and workspace runs use `bun --filter
'@reelforge/*' test`. Tests import from `'bun:test'`, never from
`'vitest'` or `'@jest/globals'`. Tests outside `ref/` must pass
before any commit.

`ref/` contains 9 shallow-cloned competitor repos. Their tests
break under our setup (missing peer deps) — this is expected; we
filter them out with `bun --filter`.

---

## Don't run `npm install`

This is a **bun workspace** repo. `npm install` or `pnpm install`
will corrupt `bun.lock` and make typecheck fail. Use `bun install`
exclusively.

The CLAUDE.md at repo root repeats this.

---

## SSH access to the GPU TTS server

VoxCPM2 (preferred for showcase), IndexTTS2, and Qwen3-TTS live on
a remote Ubuntu server at `192.168.31.47`. Ports:

- `9092` Qwen3-TTS
- `9093` IndexTTS2
- `9094` VoxCPM2 (default, nano-vLLM, RTF ~0.1)
- `9099` voice-router (single-slot orchestrator)

Local network reaches these ports directly; no SSH required for
TTS. `ssh pi` SSH config lives in `~/.ssh/config` for
admin / status checks.

The showcase demo hits `http://192.168.31.47:9094/v1/tts` from the
local `synth.py`. If the VM is down, `curl -m 3 http://192.168.31.47:9094/health`
is the fastest health check.
