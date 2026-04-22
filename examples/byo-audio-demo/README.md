# byo-audio-demo

**Bring your own audio + timings.** Reelforge doesn't have to be the TTS — if you already have a narration audio file (from ElevenLabs / Azure / OpenAI / your own service / a recording) plus word-level timings (SRT from your TTS provider, or a Whisper transcription of the audio), `reelforge generate` uses those directly and skips the synthesize step entirely.

## Config shape

```json
{
  "audio": "./narration.mp3",
  "timings": "./narration.srt",
  "images": ["../fastpath-demo/slide-a.png", "../fastpath-demo/slide-b.png"],
  "width": 1280,
  "height": 720,
  "fps": 30
}
```

No `voice`, no `narration`, no ElevenLabs API key required.

## Timings formats

Auto-detected by the leading character — `{` or `[` → JSON, else SRT.

### SRT (one cue per word is best; per-sentence cues get linearly split)

```srt
1
00:00:00,000 --> 00:00:00,500
Hello

2
00:00:00,500 --> 00:00:01,200
from
```

### Whisper JSON

```json
{
  "segments": [
    {
      "words": [
        { "word": " Hello", "start": 0.0,  "end": 0.5 },
        { "word": " from",  "start": 0.5,  "end": 1.2 },
        { "word": " you.",  "start": 1.2,  "end": 1.8 }
      ]
    }
  ]
}
```

Matches the output of `whisper.cpp -oj -pp` and `openai-whisper --word_timestamps True`.

## Run

```bash
bun packages/cli/src/bin.ts generate examples/byo-audio-demo/config.json -o out/byo.mp4
```

Expected output:

```
→ loading audio .../narration.mp3
→ parsing timings .../narration.srt
→ rendering 1280x720 @ 30fps, 2 sentence(s) → 2 slide(s)
  frame 30/120  frame 60/120  frame 90/120  frame 120/120
→ muxing audio
✓ .../byo.srt
✓ .../byo.mp4
```

## CLI flag overrides

```bash
# Same config, but override the audio/timings at the call site:
bun packages/cli/src/bin.ts generate examples/byo-audio-demo/config.json \
  -o out/byo.mp4 \
  --audio /path/to/new-narration.mp3 \
  --timings /path/to/new-narration.json
```

## Relationship to `reelforge tts`

If you want Reelforge to call ElevenLabs for you, use the original synthesize-mode config:

```json
{
  "narration": "Hello from Reelforge. Slides sync perfectly.",
  "voice": "Xb7hH8MSUJpSbSDYk0k2",
  "images": [...]
}
```

Either mode produces the same IR → DOM-captions → render pipeline. `generate` picks the mode from the config fields.
