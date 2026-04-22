---
name: reelforge-dsl
description: Write declarative JSON5 video configs for Reelforge (clips, layers, titles, audio tracks). Use when asked to compose a video without writing raw HTML — e.g. "a 30-second slide video with three images and a title overlay", or when editing an existing `.json5` DSL config. Covers the schema, the compile-time error messages, and how DSL features map to the underlying HTML.
---

# Reelforge DSL

A narrow, declarative JSON5 config format. Compiles to HTML, then to IR, then renders. Good when the composition is **slides + titles + narration**; reach for raw HTML whenever you need anything more complex.

## Canonical example

```json5
{
  config: { width: 1280, height: 720, fps: 30, background: '#000' },
  meta: { title: 'Product pitch' },
  clips: [
    {
      duration: 4,
      layers: [
        { type: 'image', src: './hero.jpg', fit: 'cover' },
        {
          type: 'title',
          text: 'Welcome',
          style: { color: '#fff', fontSize: 108, position: 'center' },
          entrance: 'slide-up',
        },
      ],
    },
    {
      duration: 6,
      layers: [
        { type: 'image', src: './product.jpg', fit: 'cover' },
        {
          type: 'title',
          text: 'Key features',
          style: { color: '#fff', fontSize: 72, position: 'bottom' },
          entrance: 'fade',
        },
      ],
    },
  ],
  audio: [
    { src: './narration.mp3', volume: 1 },
    { src: './music.mp3', volume: 0.3 },
  ],
}
```

Compile + render in one shot: `reelforge render config.json5 -o out.mp4`.

## Schema

```
{
  config?: { width?, height?, fps?, background? },
  defaults?: { transition?, duration? },
  clips: [
    {
      duration: <seconds>,        // required, > 0
      transition?: 'fade' | 'none',
      layers: [ <Layer>, ... ],    // required, length ≥ 1
    },
    ...
  ],
  audio?: [ { src, volume?, start?, duration? }, ... ],
  meta?: { title?, description?, author? },
}
```

### Layers

**`{ type: 'image', src, fit? }`** — full-frame image clip, hidden outside the clip's time window (handled by the engine image adapter). `fit`: `'cover' | 'contain' | 'fill'`.

**`{ type: 'title', text, style?, entrance? }`** — a single text overlay for the clip. `style`:

| Field | Example |
|---|---|
| `color` | `'#ffffff'` |
| `background` | `'rgba(0,0,0,0.55)'` |
| `fontSize` | `96` (numeric px) |
| `fontFamily` | `'Helvetica'` |
| `fontWeight` | `700` or `'bold'` |
| `padding` | `'14px 28px'` (CSS string) |
| `borderRadius` | `'12px'` |
| `position` | `'top'` / `'center'` / `'bottom'` |

`entrance`: `'fade'` (default) / `'slide-up'` / `'none'`.

**`{ type: 'audio', src, volume? }`** — per-clip audio that starts with the clip and stops with it. For soundtrack that spans the whole video, put it in top-level `audio[]` instead.

### Top-level `audio`

```json5
audio: [
  { src: './bgm.mp3', volume: 0.3 },            // full duration
  { src: './sfx.mp3', volume: 1, start: 5, duration: 2 }
]
```

If `duration` is omitted, runs to the end of the timeline. Start is in seconds.

## Validation

`parseDsl(raw)` throws `DslError` with a JSON-Pointer-style path on invalid input. Common errors:

| Error | Cause |
|---|---|
| `config.clips must be a non-empty array` | Missing or empty `clips` |
| `clips[N].duration is required and must be > 0` | Forgot duration / set to 0 or negative |
| `clips[N].layers[M].type "X" is not supported` | Unsupported layer type. MVP is `image` / `title` / `audio` |
| `clips[N].transition must be "fade" or "none"` | Only those two today |
| `clips[N].layers[M].fit must be cover/contain/fill` | Invalid `fit` value |

## What the DSL deliberately doesn't do

- Bespoke animation timelines beyond the canned `entrance` values — use HTML + WAAPI for anything else.
- Per-element CSS overrides — DSL only lets you style titles. Raw HTML for a fully custom design.
- Multiple titles per clip — one `title` layer per clip is intentional to keep DSL narrow. If you need two titles, either split into two clips or write raw HTML.

## Mental model: DSL → HTML → IR

When you run `reelforge render ./video.json5 -o out.mp4`:

1. `compileDslFile` parses JSON5, validates the shape, and builds an HTML composition.
2. That HTML is written to `__reelforge-dsl-<name>.html` (ignored by git).
3. The HTML frontend compiles it to IR (`VideoProject`).
4. `engine-chrome` renders to silent mp4, `mux` adds audio, final mp4 lands at `-o`.

If the rendered video looks wrong, check the generated HTML — the bug is either in how the DSL maps to HTML (file a @reelforge/dsl issue) or in the composition itself (edit the HTML directly and re-render with `reelforge render __reelforge-dsl-<name>.html`).

## For narration-driven DSL

`reelforge generate` takes a narration + images + voice config and builds the whole DSL equivalent internally, then renders. See the [`reelforge`](../reelforge/SKILL.md) skill's narration section. Writing DSL manually is only for cases where you don't want TTS.
