# @reelforge/providers-stt-whisper

Local `whisper.cpp` wrapper. Takes an audio file (mp3/wav/flac/…), runs transcription, returns word-level `WordTiming[]`. Feeds `reelforge generate` in byo mode when the user has audio but no timings.

## Why local whisper.cpp?

- Zero network dependency → reproducible, no paid API, no rate limits.
- Binary is small (~50 MB) plus the model file (39 MB for tiny, 466 MB for base).
- Word-level timestamps come out of the box with `-oj -pp`.

For API-hosted Whisper (OpenAI), use the existing `@reelforge/captions` `parseWhisperJson` on the response directly — no dedicated provider needed.

## Usage

```ts
import { createWhisperCppProvider } from '@reelforge/providers-stt-whisper';

const stt = createWhisperCppProvider({
  whisperBinary: '/opt/whisper.cpp/main',
  modelPath: '/opt/whisper.cpp/models/ggml-base.en.bin',
  // ffmpegBinary defaults to 'ffmpeg' — required to convert non-wav input
  // to the 16kHz mono wav that whisper.cpp expects.
});

const { wordTimings, text } = await stt.transcribe('./narration.mp3');
```

## How it works

1. Convert the input audio to 16 kHz mono signed-16 WAV via `ffmpeg -ar 16000 -ac 1 -c:a pcm_s16le`. whisper.cpp only accepts this format.
2. Spawn `whisperBinary -m <model> -f <wav> -oj -pp -ojf -otxt` (one pass, `-oj` emits JSON with word timings, `-pp` prints partial progress, `-otxt` keeps a plain transcript).
3. Read the emitted JSON sidecar, reuse `parseWhisperJson` from `@reelforge/captions`.
4. Discard the temporary wav on exit.

## CLI integration

`reelforge generate` picks up Whisper automatically when you pass `--audio <file>` without `--timings`. Point the binary + model via env:

```bash
export WHISPER_BINARY=/opt/whisper.cpp/main
export WHISPER_MODEL=/opt/whisper.cpp/models/ggml-base.en.bin
reelforge generate examples/byo-audio-demo/config.json \
  -o out/byo.mp4 \
  --audio ./narration.mp3
```

(coming in the next CLI patch)

## Installing whisper.cpp

```bash
# macOS Homebrew:
brew install whisper-cpp
ls $(brew --prefix)/bin/whisper-cpp   # binary name is `whisper-cpp`

# Or build from source:
git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp && make -j && ./models/download-ggml-model.sh base.en
```
