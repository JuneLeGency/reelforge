# tiktok-captions-demo

Portrait 1080×1920 (TikTok / Reels aspect) with per-word highlighted captions, entirely WAAPI — zero libass, zero external assets.

## Run

```bash
bun packages/cli/src/bin.ts render examples/tiktok-captions-demo/index.html -o out/tiktok.mp4
open out/tiktok.mp4
```

## Structure

Each "page" is a `.tt-page` div containing one `.tt-token` `<span>` per word. Two WAAPI animations drive each frame:

1. **Page opacity** — the div's `opacity` keyframes go `0 → 1 → 0` around `startMs` / `endMs`.
2. **Per-token color** — each span's `color` keyframes go `base → highlight → past` around `fromMs` / `toMs`.

Both are paused and per-frame-seeked by the engine-chrome WAAPI adapter, so every frame reflects the exact state at that timeline point.

## Verification

Pair-wise PSNR on extracted frames:

| Pair | PSNR | Means |
|---|---|---|
| t=0.2s vs 0.7s (same page, different active word) | **32.5 dB** | Text identical, just highlight colour moves |
| t=0.7s vs 1.2s (same page, next active word) | **33.7 dB** | Same — colour-only delta |
| t=1.7s vs 2.2s (page 0 last word vs page 1 first word) | **21.6 dB** | Completely different caption text |
| t=0.2s vs 3.7s (first page vs last page) | **21.6 dB** | Completely different caption text |

Reference anchors:
- A frozen frame pair → PSNR > 45 dB
- 32–35 dB = "text same, only colour changes" (per-word highlight working)
- ~20 dB = "captions have swapped entirely"

Every value lands where expected.

## In `reelforge generate`

The code generator that writes these pages lives in `@reelforge/cli`:

```bash
reelforge generate config.json -o out.mp4 --tiktok-captions
reelforge generate config.json -o out.mp4 --tiktok-captions --tiktok-threshold 900
```

Pipeline:

1. TTS returns per-word timings.
2. `wordTimingsToCaptions()` turns them into `Caption[]`.
3. `createTikTokStyleCaptions({ combineTokensWithinMs })` groups words into pages.
4. `buildGenerateHtml({ tikTokPages })` emits the exact structure this demo shows.
5. Chrome renders → WAAPI adapter seeks page + token animations per frame → MP4.
