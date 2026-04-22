# @reelforge/dsl

Declarative JSON5-based authoring frontend — inspired by editly's clip/layer model. Compiles to HTML, then reuses `@reelforge/html` to produce a validated `VideoProject` IR.

## Schema overview

```json5
{
  config: { width: 1280, height: 720, fps: 30, background: '#000' },
  defaults: {
    transition: 'fade',      // applied to every clip boundary unless overridden
    duration: 3,
  },
  clips: [
    {
      duration: 4,
      transition: 'fade',     // optional, overrides defaults.transition
      layers: [
        { type: 'image', src: './hero.jpg', fit: 'cover' },
        { type: 'title', text: 'Welcome', style: { color: '#fff', fontSize: 96 } },
      ],
    },
    {
      duration: 3,
      layers: [
        { type: 'image', src: './product.jpg' },
      ],
    },
  ],
  audio: [
    { src: './narration.mp3', volume: 1 },
    { src: './music.mp3', volume: 0.3 },
  ],
}
```

Clips are concatenated in order. Layer `type` values supported today: **image**, **title**, **audio**. A top-level `audio[]` is a shortcut for per-clip audio layers that span the whole timeline.

Each clip may also set `transition: 'fade' | 'cross-fade' | 'wipe-left' | 'wipe-right' | 'wipe-up' | 'wipe-down' | 'slide-left' | 'slide-right' | 'slide-up' | 'slide-down' | 'dissolve' | 'pixelize' | 'circle-open' | 'circle-close' | 'radial' | 'zoom-in' | 'none'`, or an `xfade:<name>` passthrough for any built-in ffmpeg xfade. See [`@reelforge/transitions`](../transitions) for the full catalog. On the fast path these compile to an `xfade` filter chain; on the Chrome path they are currently ignored (coming later).

## API

```ts
import { compileDsl, compileDslFile } from '@reelforge/dsl';

const result = compileDsl(configObject, { baseDir: '.' });
// → { project: VideoProject, html: string, htmlPath?: string, baseDir: string }

const fromDisk = await compileDslFile('./video.json5');
// → same shape, htmlPath populated for the generated HTML
```

`compileDslFile` parses JSON5, compiles to HTML, writes the HTML to the user's chosen output location (or a sibling of the config), then runs `compileHtmlFile` to get a validated IR.

## Design

The DSL is a **thin layer** — it doesn't add new rendering capabilities. Every feature already works in HTML; the DSL just exposes the subset that's worth authoring declaratively:

- Clips are converted to time-windowed `<img>` / `<div>` / `<audio>` elements with `data-start` / `data-duration`.
- Title layers become WAAPI-animated overlays (fade + slide-up on entry, fade on exit).
- Fade transitions between clips compile to overlapping opacity animations.
- Image `fit: cover/contain/fill` maps to `object-fit`.

Things the DSL intentionally does NOT handle (author in HTML for these):
- Bespoke CSS / GSAP animation
- Canvas / WebGL effects
- Arbitrary DOM structure
