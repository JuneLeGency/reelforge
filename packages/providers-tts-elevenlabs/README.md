# @reelforge/providers-tts-elevenlabs

[ElevenLabs](https://elevenlabs.io) TTS adapter.

Calls `POST /v1/text-to-speech/{voice}/with-timestamps` directly via `fetch` (no SDK dep) and converts ElevenLabs' **character-level** alignment into Reelforge's **word-level** `WordTiming[]` — ready to feed into `@reelforge/captions`' TikTok pagination.

## Usage

```ts
import { createElevenLabsProvider } from '@reelforge/providers-tts-elevenlabs';
import { wordTimingsToCaptions, createTikTokStyleCaptions } from '@reelforge/captions';

const tts = createElevenLabsProvider({ apiKey: process.env.ELEVENLABS_API_KEY! });

const result = await tts.synthesize({
  text: 'Reelforge is a universal video generation framework.',
  voice: 'Xb7hH8MSUJpSbSDYk0k2',            // Alice
});

// result.audio: Buffer (mp3)
// result.durationMs
// result.wordTimings: [{ text, startMs, endMs }, ...]
const captions = wordTimingsToCaptions(result.wordTimings!);
const { pages } = createTikTokStyleCaptions({ captions, combineTokensWithinMs: 1200 });
```

## Notes

- Requires `ELEVENLABS_API_KEY` environment variable or pass `apiKey` directly.
- Default model is `eleven_turbo_v2_5` — fast and supports alignment.
- Output is MP3; pass `audioFormat` to override (`mp3_44100_128`, `pcm_16000`, etc.).
- Word splitter treats whitespace as the boundary; punctuation stays attached to the previous word (matches the text the API returned).
