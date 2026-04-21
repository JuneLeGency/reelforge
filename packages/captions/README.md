# @reelforge/captions

Word-level caption utilities. Compatible with the `Caption` shape in [`@reelforge/ir`](../ir) (which itself matches Remotion's `@remotion/captions`).

## Exports

- `wordTimingsToCaptions(words, opts?)` — turn TTS word-level timestamps into `Caption[]`.
- `createTikTokStyleCaptions({ captions, combineTokensWithinMs })` — group per-word captions into phrase-level pages with per-word highlight timings.
- `captionsToSrt(captions)` / `parseSrt(srt)` — SRT format round-trip.
- Types: `WordTiming`, `TikTokToken`, `TikTokPage`.

## Credit

The TikTok-style pagination algorithm is inspired by Remotion's `@remotion/captions` (`createTikTokStyleCaptions`). The concept — grouping word-timed captions into pages separated by leading-space boundaries and a silence threshold — is theirs; the implementation here is an independent re-write.
