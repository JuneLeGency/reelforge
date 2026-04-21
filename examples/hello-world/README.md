# hello-world

Minimum end-to-end demo of Reelforge — **zero external assets, zero API keys**.

- Background is an inline `data:image/svg+xml` gradient (no image file on disk).
- Title uses WAAPI `element.animate()` so the library-clock adapter can seek it frame-accurate.
- Output: 3 s, 1280×720, 30 fps H.264 MP4.

## Run it

```bash
# From the repo root:
bun install     # once

bun packages/cli/src/bin.ts render examples/hello-world/index.html -o out/hello.mp4
```

Expected output:

```
→ compiling examples/hello-world/index.html
→ rendering 1280x720 @ 30fps
  frame 30/90  frame 60/90  frame 90/90
→ muxing audio
✓ /.../out/hello.mp4 (0 audio clips)
```

Open with:

```bash
open out/hello.mp4
```

## What it proves

- **HTML frontend** compiles `<img data-start data-duration>` + `<html data-rf-*>` into a valid IR `VideoProject`.
- **Chrome engine** launches local Chrome via `puppeteer-core`, injects the library-clock runtime, and captures each of the 90 frames deterministically.
- **WAAPI adapter** pauses the title's `element.animate()` timeline and seeks it via `currentTime = frameTimeMs` — frame 0 has the title at `opacity: 0`, frame 45 shows it mid-fade, frame 90 shows it settled. Extracting frames at 0 s / 1 s / 2.5 s (via `ffmpeg -ss $T -i out/hello.mp4 -frames:v 1 frame.png`) confirms the state progression.
- **image2pipe → ffmpeg** streams frames straight into `libx264 / yuv420p / +faststart` without hitting disk.

## Requirements

- Node ≥ 22
- `ffmpeg` on `PATH`
- Google Chrome (macOS: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` is auto-detected; override with `--chrome <path>` or `$CHROME_PATH`)

## Try a variation

- **Add narration**: set `$ELEVENLABS_API_KEY`, then run `bun packages/cli/src/bin.ts tts "Hello reelforge" --voice <voice-id> -o examples/hello-world/narration.mp3`, add `<audio src="./narration.mp3" data-start="0" data-duration="3"></audio>` inside `<div id="stage">`, and re-render.
- **Change aspect ratio**: edit `data-rf-width` / `data-rf-height` on the `<html>` element (e.g. `1080 / 1920` for TikTok portrait).
- **More animations**: every `element.animate()` call is auto-paused and seeked — drop in as many as you want.
