# captions-demo

Zero-dependency proof that **captions work without libass**. A 3-second video where three caption overlays swap at each second, animated via WAAPI and seeked per-frame by the engine-chrome WAAPI adapter.

No external assets. No API keys. No `subtitles` ffmpeg filter.

## Run it

```bash
bun install    # once
bun packages/cli/src/bin.ts render examples/captions-demo/index.html -o out/captions.mp4
open out/captions.mp4
```

## How it works (and why this is the right approach)

Captions are **DOM elements** styled with CSS and animated via WAAPI:

```js
element.animate([
  { opacity: 0, offset: 0 },
  { opacity: 0, offset: pre },
  { opacity: 1, offset: on },
  { opacity: 1, offset: off },
  { opacity: 0, offset: postOff },
  { opacity: 0, offset: 1 }
], { duration: total, fill: 'both', easing: 'linear' });
```

The WAAPI adapter in `@reelforge/engine-chrome` calls `animation.pause()` then `animation.currentTime = frameTimeMs` before each screenshot. The browser applies whichever keyframe is active, the adapter-side seek is deterministic, and ffmpeg never sees any text.

## Why not the `subtitles` ffmpeg filter?

Every mainstream programmatic video framework (Hyperframes, Remotion, Revideo, Motion Canvas, Editly) does the same thing: **text is a graphics problem, solved in the rendering layer — not in ffmpeg**. The `subtitles` filter requires libass, which stock Homebrew ffmpeg on macOS doesn't bundle, so relying on it would break every Mac user's first `brew install ffmpeg`.

Shape of the decision:

| | DOM/WAAPI overlay | `subtitles` ffmpeg filter |
|---|---|---|
| Style control | Full CSS | libass ASS format subset |
| Fonts | Any system font | Requires libass+fontconfig to resolve |
| Animations | Any WAAPI keyframe | Fade-in/out, position hints |
| Portability | Works everywhere | Blocked by stock Homebrew ffmpeg |
| Library dependency | None | libass + libharfbuzz + libfreetype + libfontconfig |

The `--burn` flag on `reelforge generate` is still available for users who need an actual embedded subtitle stream, but it's opt-in and requires a libass-enabled ffmpeg.

## Extending the demo

- **More captions**: add more `<div class="caption" id="caption-N">` + append to the `caps` array in the script.
- **Word-level highlight** (TikTok style): split each caption into `<span>`s and animate each span's `color` independently — the WAAPI adapter will seek those the same way.
- **Custom style**: the `.caption` CSS block is the entire visual definition. Edit in place.

## Verified per-frame seek

Extract a frame inside each caption's active window and PSNR-compare:

```bash
for t in 0.3 1.2 2.3; do ffmpeg -ss "$t" -i out/captions.mp4 -frames:v 1 "frame_${t}.png"; done
```

Expected PSNR between any two of them: **20–25 dB** (caption region changes, everything else is identical). If the adapter failed and captions stayed at `opacity: 0`, PSNR would be 45+ dB.
