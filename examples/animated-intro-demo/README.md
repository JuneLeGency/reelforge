# animated-intro-demo

Side-by-side comparison with [`intro-demo`](../intro-demo): **same narration audio + same 8 sentences**, but this version has **per-element entrance animations** on every scene — title slide-up, subtitle stagger, accent rule scale, scene cross-fade, captions with their own timing.

This is the "what Hyperframes-style production quality looks like" counterpart to the plain-slide intro-demo.

## What's different

| | `intro-demo/` | `animated-intro-demo/` |
|---|---|---|
| Scenes | 8 static SVG files swapped via `<img data-start>` | 8 HTML `<section>` blocks, each a full DOM scene |
| Per-element animation | None — slides are already-rendered images | Title, subtitle, accent rule, scene-index, watermark — each with its own WAAPI stagger |
| Scene transitions | Hard cut | Cross-fade via WAAPI opacity |
| Caption overlay | TikTok word-level via `generate` | Sentence-level, hand-timed via WAAPI |
| Pipeline | `reelforge generate <config.json>` | `reelforge render <html>` (HTML-native) |
| Lines of code | ~15 (config) | ~260 (HTML + CSS + JS) |

## Why this exists

Gap feedback: the original intro-demo looks like PowerPoint export. To show that **Reelforge the framework has no animation-capability gap** against Hyperframes, this demo uses only WAAPI — which the `engine-chrome` WAAPI adapter auto-seeks per frame — plus a single `<audio>` tag that `@reelforge/mux` picks up.

The gap is in **templates**, not capability. Hyperframes ships 9 blocks + 8 named visual styles in its `registry/`; we have one `hello-world` template. See [`../../GAPS.md`](../../GAPS.md) §2.

## Run

```bash
# Uses the narration.mp3 from ../intro-demo/. Re-record it with:
#   bun scripts/gpu-tts-to-srt.ts --script examples/intro-demo/script.txt --out examples/intro-demo/narration
#
# Then render:
bun packages/cli/src/bin.ts render examples/animated-intro-demo/index.html -o out/animated-intro.mp4
```

## How the per-scene animation is wired

Every animated element on every scene is a single `element.animate(keyframes, { duration: TOTAL, fill: 'both' })` call. The `fill: 'both'` keeps the animation's final state visible between frames, and `engine-chrome`'s WAAPI adapter seeks `currentTime = frameTimeMs` on every captured frame, so the entire 47.64 s timeline is deterministic.

Per-scene choreography:

1. **Scene cross-fade** — outer `.scene` container does a 400 ms opacity fade-in at `scene.start` and fade-out at `scene.end - 400`. Adjacent scenes' fade windows overlap → real cross-fade.
2. **Accent rule** — `transform: scaleX(0 → 1)` at `scene.start + 120 ms`, 500 ms `cubic-bezier(.22,.9,.32,1)`.
3. **Title** — `translateY(40 → 0)` + opacity `0 → 1`, delayed 220 ms, 700 ms ease-out.
4. **Subtitle** — `translateY(30 → 0)` + opacity, delayed 480 ms, 650 ms ease-out.
5. **Scene index + watermark** — opacity pop at +350 ms / +450 ms, linear.
6. **Caption pill** — opacity + subtle translate, starts 80 ms after scene begin, ends 80 ms before scene end.

All animations run through the SAME WAAPI adapter that drives GSAP-free vanilla Reelforge compositions — no framework-level change.

## Known limitations in this demo

- Sentence boundaries are **char-proportional splits of the total 47.64 s**, not true word-level timestamps. Captions here are sentence-level only; for TikTok-style per-word highlighting drive this demo through `generate` instead (or feed the narration to `reelforge stt` first).
- Transforms inside rotating perspective (CSS `rotate-x` / `rotate-y`) are not exercised here; WAAPI handles them fine but the demo stays flat to keep the code easy to read.

## Next: template library

The natural follow-up is turning the per-scene choreography (accent-rule + title fade-up + subtitle stagger) into a named **slide template**:

```json5
// planned DSL extension
{
  clips: [
    {
      duration: 5,
      template: 'hero-fade-up',
      title: 'Reelforge',
      subtitle: '程序化视频生成框架',
    },
  ],
}
```

That gives `reelforge generate` the same per-element entrance quality as this demo, without forcing users to hand-write 260 lines.

See [`../../GAPS.md`](../../GAPS.md) §4.1.
