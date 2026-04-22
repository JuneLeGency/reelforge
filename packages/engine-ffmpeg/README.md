# @reelforge/engine-ffmpeg

**Fast-path renderer.** For IRs that only use image / video / audio clips — no HTML animations, no DOM captions — renders via a single ffmpeg `filter_complex` instead of spinning up Chrome. Seconds of startup instead of 10+, and the file never leaves the audio/video pipeline.

## When is an IR "fast-path eligible"?

`canUseFastPath(project)` returns `true` when *all* of:

- Every asset is `image`, `video`, or `audio` (no text / font / shader / lottie).
- No `captions` tracks on the project.
- No `overlay` tracks on the timeline (those imply custom DOM).
- No clip has `effects` (they'd need a compositor to render).
- No clip has `transitionIn` / `transitionOut` (future — once xfade is wired, these will flip to supported).

If any of those fail, fall through to `@reelforge/engine-chrome`.

## Pipeline

1. Collect image clips → each becomes a `-loop 1 -t <duration> -i <path>` input, run through `scale + pad + trim + setpts + tpad + format` to normalize to the project's canvas size + duration.
2. Collect video clips → each becomes an `-i <path>` input with `trim + setpts + scale + pad + tpad + format`.
3. The normalized streams are stacked by `[0][1][2]...overlay` chains so each clip paints in its own time window on a shared base color canvas.
4. Audio clips flow into `@reelforge/mux` exactly as they do for Chrome-path output.

Gotcha: this backend does **not** support image slides that extend `<video>` clips' timeline — it's "time-windowed overlay on a blank canvas", not compositor-level z-ordering.

## API

```ts
import { canUseFastPath, renderFfmpeg } from '@reelforge/engine-ffmpeg';

if (canUseFastPath(project)) {
  await renderFfmpeg({ project, baseDir: '.', outputPath: 'out.mp4' });
}
```

## Design

Inspired by editly's `-filter_complex` approach but consumes our IR directly — no Fabric.js / node-canvas step.
