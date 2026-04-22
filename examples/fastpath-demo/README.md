# fastpath-demo

Pure-ffmpeg render, no Chrome. Three `<img>` slides concatenated into a 6-second 1280×720 mp4 using `filter_complex` + `overlay` + `setpts` + `enable` expressions.

## Run

```bash
# Auto (the CLI detects a fast-path-eligible IR and uses ffmpeg):
bun packages/cli/src/bin.ts render examples/fastpath-demo/index.html -o out/fp.mp4

# Or force one engine or the other:
bun packages/cli/src/bin.ts render examples/fastpath-demo/index.html -o out/fp-ffmpeg.mp4 --engine ffmpeg
bun packages/cli/src/bin.ts render examples/fastpath-demo/index.html -o out/fp-chrome.mp4 --engine chrome
```

## What makes an IR "fast-path eligible"?

`canUseFastPath(project)` returns `true` when *all* of:

- Every referenced asset is `image`, `video`, or `audio`.
- No caption tracks on the project.
- No `caption` / `overlay` track kinds in the timeline (only `video` + `audio`).
- No clip has `effects[]` or `transitionIn` / `transitionOut` set.

If any of these fail, the CLI automatically falls through to `--engine chrome` when you pass `--engine auto` (the default).

## Benchmarks (local, 6-second 1280×720 @ 30fps, 3 image clips)

| Engine | Time | Speedup |
|---|---|---|
| Chrome (puppeteer + screenshot per frame) | **~8.7 s** | 1× |
| FFmpeg fast path | **~0.6 s** | **~13×** |

Per-frame screenshots + Chrome startup dominate the Chrome path. The fast path is a single `ffmpeg` invocation with a filter graph — no browser.

## How it renders each slide

For every image clip `{ startMs, durationMs }`:

1. **Input flag**: `-loop 1 -t <durationSec> -i <image>` — turns one file into a stream of that duration.
2. **Per-clip filter chain**:

   ```
   [N:v] scale=W:H:force_original_aspect_ratio=decrease,
         pad=W:H:(ow-iw)/2:(oh-ih)/2:color=black,
         setsar=1, format=yuv420p, fps=<fps>,
         setpts=PTS-STARTPTS+<startSec>/TB [vN]
   ```

   The `setpts` shifts the stream onto its real timeline position, so overlays can reason about absolute time.

3. **Chain of overlays** onto a full-duration `color=black` base:

   ```
   [base][v0] overlay=shortest=0:enable='between(t,0,2)' [o0]
   [o0][v1]   overlay=shortest=0:enable='between(t,2,4)' [o1]
   [o1][v2]   overlay=shortest=0:enable='between(t,4,6)' [vout]
   ```

   `enable=between(t,start,end)` gates each overlay to its own window — no black-flash from overlapping streams.

## Verification

Frames extracted at 0.5s / 2.5s / 4.5s (one per slide):

```
t=0.5s vs 2.5s: PSNR 4.1 dB   (slide A vs slide B — totally different content)
t=2.5s vs 4.5s: PSNR 5.7 dB   (slide B vs slide C)
t=0.5s vs 4.5s: PSNR 4.7 dB   (slide A vs slide C)
```

All three pairs are "completely different content" — the engine really is swapping slides on the right frames. If `enable` were miswired we'd see ~45 dB on at least one pair.
