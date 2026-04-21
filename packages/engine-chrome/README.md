# @reelforge/engine-chrome

Chrome-based deterministic frame capture backend. Given a `VideoProject` IR and an HTML composition file, produces a silent MP4.

## What it does

1. Launch headless Chrome via `puppeteer-core` (you bring your own Chrome executable — usually the system one or `@puppeteer/browsers`).
2. Inject a **library-clock runtime** into the page — pauses GSAP / WAAPI animations and exposes `window.__rf.seekFrame(timeMs)` to drive them frame-by-frame.
3. For each frame at `n * (1000/fps)` ms:
   1. `page.evaluate('__rf.seekFrame(t)')`
   2. `page.screenshot()` → PNG buffer
   3. pipe buffer to `ffmpeg -f image2pipe -vcodec png -i -`
4. Close ffmpeg stdin, wait for encode to finish. Output is a silent MP4 (audio is mixed in by `@reelforge/mux`).

## Requirements

- `ffmpeg` on `PATH`.
- Chrome/Chromium executable path (pass via `executablePath` option, or install `@puppeteer/browsers`).

## Status

MVP:
- WAAPI + GSAP adapters (auto-detect).
- Uses `Page.captureScreenshot` (portable). `HeadlessExperimental.BeginFrame` + frame-segment parallelism land after M1.
- `<video>` elements are not yet frame-accurate; browser plays natively.

## API

```ts
import { renderChrome } from '@reelforge/engine-chrome';

const { outputPath, frameCount } = await renderChrome({
  project,         // from @reelforge/html or any other frontend
  htmlPath,        // absolute path
  outputPath: 'out/silent.mp4',
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  onProgress: ({ frame, total }) => console.log(`${frame}/${total}`),
});
```
