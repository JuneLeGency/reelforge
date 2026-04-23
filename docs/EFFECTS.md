# Chrome-path effects

Overlay-based visual effects usable as inter-slide transitions
(declared on a slide's `transition` field). 10 total, all CSS +
manual-keyframes (no WebGL). Source:
`packages/transitions/src/chrome-effects.ts`.

## Catalog

| Name | Reads as | Notes |
|---|---|---|
| `flash-white` | Full-screen white pulse at the cut | Chapter break |
| `flash-black` | Full-screen black pulse | Dramatic blink-cut |
| `wipe-sweep` | Angled black panel sweeps across | Scene change under the sweep |
| `radial-pulse` | Bright radial glow blooms from centre | Subtle beat / emphasis |
| `rgb-split` | Mag + cy layers offset on X, screen blend | Chromatic aberration flavour |
| `film-grain` | SVG feTurbulence noise overlay, mix-blend overlay | Analog grain dust |
| `scanlines` | Repeating horizontal lines, multiply blend | CRT / terminal feel |
| `glitch-crack` | Two horizontal color bands + steps(4) flicker | Fast glitch |
| `shake` | #stage itself translates with 7-step shake | Impact; captions shake too |
| `zoom-blur` | #stage filter blur(0→7px→0) + scale | Emphasis hit; caption blurs too |

## Config usage

Effects are declared on the **source slide's `transition` field**;
they fire when that slide ends and the next begins.

```json
{
  "slides": [
    {
      "template": "hero-fade-up",
      "title": "Opening",
      "transition": "flash-white",
      "transitionDurationMs": 300
    },
    { "template": "bullet-stagger", "title": "Act I", "bullets": [...] }
  ]
}
```

`transitionDurationMs` is the visible duration of the effect (default
400 ms). It's symmetrical around the cut point, so the effect starts
`duration/2` before the cut and ends `duration/2` after.

## What happens under the hood

`render-composition.ts` iterates the slides' `transition` values and
pushes one effect invocation per transition into
`animationPlans[]` (same pipeline as slides + captions). Each
effect's `emit()` function in `chrome-effects.ts` returns:
- `html` — a brief overlay `<div>`  (or empty string for effects that
  animate `#stage` directly, like shake / zoom-blur)
- `animations` — the keyframe plan(s) for the overlay

The CSS for each effect is emitted once (deduped by CSS-string
identity so effects sharing a base class — flash-white and flash-
black share `.rf-fx-flash` — don't double-emit).

## Design choices

- **No WebGL**. Reelforge's chrome path renders a live DOM, not an
  image pair; true gl-transitions need both frames as textures,
  which doesn't fit. CSS overlays cover ~80% of the "visual-break"
  use case at ~10% of the code.
- **Last kf offset = 1**. Unlike slide animations, effect plans
  always end at offset 1.0 (i.e. `atMs = totalDurationMs`), so they
  never trip the old Chromium WAAPI scaling bug (not that it
  matters post-manual-keyframes — but consistent, in case).
- **Shake / zoom-blur affect `#stage`**. These are "meta" effects
  that shake or blur the entire composition, captions included, as
  the intended hit. If you need a shake that doesn't touch
  captions, write a custom template instead.

## Adding a new effect

1. Add a `ChromeEffect` to `chrome-effects.ts` exporting
   `name / description / css / emit`.
2. Add to `CHROME_EFFECTS` registry in the same file.
3. Update the catalog test in
   `packages/transitions/src/__tests__/chrome-effects.test.ts`
   (expected sorted-name array).

Effects don't need to be exposed through `@reelforge/transitions`
index.ts — they're consumed via `CHROME_EFFECTS` + `resolveChromeEffect`
APIs that already re-export the whole registry.

## xfade transitions (FFmpeg-path)

Separate from chrome-path effects. Applied when using the
`engine-ffmpeg` fast path (pure-slideshow mode, 13× realtime). 46
ffmpeg built-ins + 20 curated aliases. See
`packages/transitions/src/catalog.ts` for the alias map and
`packages/transitions/src/xfade.ts` for the built-in list.

Currently not composable with chrome-path effects — they're two
different engines. `rf compose` (section §7.3 R9 in GAPS.md) will
bridge them for multi-scene MP4s.
