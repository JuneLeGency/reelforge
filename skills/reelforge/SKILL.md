---
name: reelforge
description: Create programmatic video compositions with Reelforge. Use when asked to render a video from HTML / a JSON5 DSL config / a TTS script, to author captions (sentence-level or TikTok-style per-word highlights), to drive slide timings from narration, or to run the `reelforge` CLI (init / preview / render / tts / generate / mcp). Covers the IR, the HTML and DSL frontends, the Chrome engine's library-clock adapters (WAAPI / GSAP / image / video), and the DOM-captions-over-libass design rule.
---

# Reelforge

**Reelforge is a programmatic video framework.** Compositions are authored as HTML or as a JSON5 DSL, compiled to a single IR (`VideoProject`), and rendered by a headless Chrome backend that seeks every animation per frame — deterministic, reproducible, no wall-clock dependence.

## Mental model

```
Author (HTML | DSL) → compile → IR VideoProject → Chrome engine → silent mp4
                                    ↓
                            audio mix (ffmpeg)
                                    ↓
                                final mp4
```

**The HTML is the source of truth for the visual.** The IR is a time-line metadata layer on top of it. The renderer seeks every WAAPI / GSAP / image / video animation to the exact frame time, then screenshots. That's why captions, effects, and animations all go through WAAPI keyframes rather than ffmpeg filters.

## Rules

### 1. Do NOT use the ffmpeg `subtitles` filter.

Every serious programmatic video framework (Hyperframes, Remotion, Revideo, Motion Canvas, editly) renders text in the rendering layer, never via ffmpeg. The `subtitles` filter depends on libass, which stock Homebrew ffmpeg on macOS doesn't include. **Use DOM captions.** They are:

- a `<div class="caption">` (or `<div class="tt-page">` with `<span class="tt-token">`s)
- styled with CSS
- animated via `element.animate([...], { duration, fill: 'both' })`
- seeked per-frame automatically by the engine's WAAPI adapter

`--burn` on `reelforge generate` exists as an escape hatch for users who want an extra baked libass pass, but the DOM captions are already burnt into the pixels.

### 2. Any seekable animation belongs on a tracked element.

The engine auto-seeks:
- Every GSAP timeline (`gsap.globalTimeline` is paused then seeked via `totalTime(seconds, false)`)
- Every WAAPI animation returned by `document.getAnimations()`
- Every `<img data-start data-duration>` (visibility toggled by time window)
- Every `<video data-start data-duration data-source-start>` (paused, `currentTime` set per frame)

If an animation isn't one of those, it won't land on the right frame. Use CSS transitions only for states the engine won't need to seek (e.g. page chrome that's static during render).

### 3. Always declare `data-rf-width`, `data-rf-height`, `data-rf-fps` on `<html>`.

The engine reads these directly for canvas sizing and frame-count math. Compositions without clips (e.g. captions-only or title-only) must also set `data-rf-duration="<seconds>"` so the engine knows when to stop.

### 4. Time is master-driven by the audio/narration when available.

For narration videos, call `reelforge tts` first, then cut slides at sentence boundaries using the word-level timestamps. The `generate` command does this automatically — don't hand-tune clip durations when a TTS track exists.

### 5. Use the DSL for slide+title compositions; HTML for anything richer.

```json5
{
  config: { width: 1280, height: 720, fps: 30 },
  clips: [
    { duration: 4, layers: [
      { type: 'image', src: './a.jpg', fit: 'cover' },
      { type: 'title', text: 'Hello', style: { fontSize: 96 }, entrance: 'slide-up' }
    ]},
  ],
}
```

The DSL compiles to HTML under the hood, so anything authored in DSL can be extended by editing the generated HTML. But don't try to express complex GSAP timelines, canvas shaders, or custom WAAPI tweens in DSL — use HTML for those.

## Composition anatomy

```html
<!DOCTYPE html>
<html data-rf-width="1280" data-rf-height="720" data-rf-fps="30">
<head>
  <style>
    html, body { margin: 0; background: #000; overflow: hidden; }
    #stage { position: relative; width: 100vw; height: 100vh; }
    #stage img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; visibility: hidden; }
  </style>
</head>
<body>
  <div id="stage">
    <img src="./slide-1.jpg" data-start="0" data-duration="3" data-fit="cover">
    <img src="./slide-2.jpg" data-start="3" data-duration="3" data-fit="cover">
    <audio src="./narration.mp3" data-start="0" data-duration="6"></audio>
  </div>
</body>
</html>
```

**Key attributes:**

| Attribute | Meaning |
|---|---|
| `data-start` (seconds) | when the clip becomes visible / starts playing |
| `data-duration` (seconds) | how long the clip stays on |
| `data-source-start` | for `<video>`, offset into the source media |
| `data-fit` | `cover` / `contain` / `fill` (images only) |
| `data-volume` | 0..1, for audio clips |

See the [`@reelforge/html` README](../../packages/html/README.md) for the full list.

## Caption overlay (DOM, no libass)

```html
<div class="caption" id="caption-0">Hello from the first cue.</div>
<script>
  const total = 6000;
  const el = document.getElementById('caption-0');
  const s = 0, e = 2000;
  el.animate([
    { opacity: 0, offset: 0 },
    { opacity: 0, offset: (s - 16) / total },
    { opacity: 1, offset: s / total },
    { opacity: 1, offset: e / total },
    { opacity: 0, offset: Math.min(1, (e + 16) / total) },
    { opacity: 0, offset: 1 }
  ], { duration: total, fill: 'both', easing: 'linear' });
</script>
```

The WAAPI adapter pauses that animation and sets `currentTime` per frame — caption appears/disappears exactly at `s`/`e`.

For TikTok-style per-word highlights, split the page into `<span class="tt-token">`s and animate each span's `color` independently with its own `fromMs`/`toMs`. `reelforge generate --tiktok-captions` emits this shape for you.

## When to invoke the CLI

| Goal | Command |
|---|---|
| Scaffold a new project | `reelforge init my-video` |
| Live-preview HTML changes | `reelforge preview ./index.html` |
| Render HTML / DSL to mp4 | `reelforge render ./video.html -o out.mp4` |
| Standalone narration | `reelforge tts "..." --voice <id> -o narr.mp3 --srt narr.srt` |
| Script → fully narrated video with captions | `reelforge generate config.json -o out.mp4 [--tiktok-captions]` |
| Expose tools to other agents | `reelforge mcp` (MCP stdio server) |

See [`reelforge-cli`](../reelforge-cli/SKILL.md) for per-flag details.

## Common failure modes

- **Black frames / captions never show.** You set `data-rf-width/height` but forgot `data-rf-fps`, or you authored animations with `requestAnimationFrame` (the engine only seeks WAAPI / GSAP). Move the animation to `element.animate([...])`.
- **libass "Unknown filter 'subtitles'".** You used `--burn` with a stock ffmpeg. Either install a libass-enabled ffmpeg or remove `--burn` — the DOM captions are already baked in.
- **Video element stays frozen.** You used `useBeginFrame: true` (or `--use-begin-frame` on the CLI). BeginFrame pauses the compositor, which disables video/audio playback. Drop the flag for video-heavy compositions.
- **Duration is zero / "no clips".** You have a caption-only or title-only composition. Add `data-rf-duration="<seconds>"` on `<html>`.
