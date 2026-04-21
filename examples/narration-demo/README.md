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
  -o out/narration.mp4 \
  --srt out/narration.srt
open out/narration.mp4
```

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
