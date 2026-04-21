# @reelforge/cli

The `reelforge` command-line. Short alias: `rf`.

## Commands

### `reelforge render <html> [-o out.mp4]`

Compile an HTML composition to IR, render frames via Chrome, mix audio, write MP4.

```bash
reelforge render ./video.html -o out/final.mp4
```

Flags:

| Flag | Description | Default |
|---|---|---|
| `-o, --output <path>` | Output MP4 path | `out/video.mp4` |
| `--chrome <path>` | Chrome/Chromium executable | auto-detect |
| `--ffmpeg <path>` | ffmpeg binary | `ffmpeg` |
| `--keep-silent` | Keep intermediate silent MP4 | false |

Requirements: `ffmpeg` on `PATH`, Chrome/Chromium installed.

### `reelforge tts <text> [-o out.mp3]`

Synthesize narration via ElevenLabs. Optionally emit an SRT file alongside the audio.

```bash
reelforge tts "Hello, world" \
  --voice Xb7hH8MSUJpSbSDYk0k2 \
  -o narration.mp3 \
  --srt narration.srt
```

Flags:

| Flag | Description | Default |
|---|---|---|
| `-o, --output <path>` | Output MP3 | `narration.mp3` |
| `--voice <id>` | ElevenLabs voice id | required |
| `--model <id>` | ElevenLabs model id | `eleven_turbo_v2_5` |
| `--srt <path>` | Also write an SRT (per-word) | off |
| `--api-key <key>` | API key (else `$ELEVENLABS_API_KEY`) | from env |
