# narration-demo

End-to-end demo of `reelforge generate`: takes a script + a few slides, calls ElevenLabs, aligns slides to sentence timings, renders to MP4.

## What you get

A ~12-second 1280×720 30 fps MP4 where:

- Three SVG slides crossfade at sentence boundaries.
- Narration audio is the ElevenLabs synthesis of the script in `config.json`.
- Slide durations come from TTS word-level timestamps — no manual timing.

## Run it

Requires `ELEVENLABS_API_KEY` in your environment (get one at <https://elevenlabs.io>). Everything else (Chrome, ffmpeg) follows the same requirements as `reelforge render`.

```bash
export ELEVENLABS_API_KEY=...
bun packages/cli/src/bin.ts generate examples/narration-demo/config.json \
  -o out/narration.mp4
# → out/narration.mp4  (images timed to sentences, narration baked in, DOM captions rendered in)
# → out/narration.srt  (sentence-level captions, also written as a sidecar)
```

**Captions are on by default** — rendered as DOM overlays with WAAPI animations, seeked per-frame by the engine-chrome adapter. No libass, no ffmpeg subtitles filter. See [`../captions-demo/`](../captions-demo) for the standalone proof. To disable:

```bash
bun packages/cli/src/bin.ts generate ... --no-captions
```

### Optional: also burn captions via ffmpeg (libass)

```bash
bun packages/cli/src/bin.ts generate ... --burn
```

This runs an extra ffmpeg pass with the `subtitles` filter, creating a second (redundant) burnt layer. Requires an ffmpeg with libass; **stock Homebrew `ffmpeg` on macOS does not include it** — install a pre-built binary from [BtbN's FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds/releases). Most users don't need this path; DOM captions already produce a fully-burnt video.

## How alignment works

1. `reelforge generate` sends `config.json#narration` to ElevenLabs `with-timestamps`.
2. The returned character-level alignment is converted to word timings.
3. Words are partitioned into sentences on `. ! ? 。！？` terminators.
4. Each sentence picks up one slide (cycles if sentences outnumber images).
5. A temporary HTML composition is emitted into a workdir with:
   ```html
   <img src="asset_0.svg" data-start="0.000" data-duration="3.20" ...>
   <img src="asset_1.svg" data-start="3.20" data-duration="4.50" ...>
   <audio src="narration.mp3" data-start="0" data-duration="..."></audio>
   ```
6. Chrome engine renders; `mux` adds the audio; `rm -rf` the workdir.

## Customize

- **Voice**: swap `voice` for any ElevenLabs voice id.
- **Aspect ratio**: change `width` / `height` (e.g. 1080 / 1920 for TikTok portrait).
- **More slides**: drop more SVG/PNG/JPG into this folder, add entries to `images`. If `images.length < sentences.length`, images cycle.
- **Different script**: any prose works — keep sentences concise enough to read while their slide is on screen.
