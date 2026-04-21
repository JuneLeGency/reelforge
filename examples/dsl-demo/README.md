# dsl-demo

Shows `@reelforge/dsl` — an editly-style JSON5 config compiled to HTML and then rendered.

## Run

```bash
bun packages/cli/src/bin.ts render examples/dsl-demo/video.json5 -o out/dsl.mp4
open out/dsl.mp4
```

The CLI picks the frontend from the file extension:

| Extension | Frontend |
|---|---|
| `.html` | `@reelforge/html` (raw HTML) |
| `.json` / `.json5` | `@reelforge/dsl` → generates HTML → compiles |

The generated HTML is left as a sibling of the config (e.g. `__reelforge-dsl-video.html`) so you can inspect / tweak it.

## What the DSL supports today

| Layer type | Fields |
|---|---|
| `image` | `src`, `fit: cover/contain/fill` |
| `title` | `text`, `style: {color,background,fontSize,fontFamily,fontWeight,padding,borderRadius,position}`, `entrance: fade/slide-up/none` |
| `audio` | `src`, `volume` |

Top level: `config`, `defaults`, `clips`, `audio`, `meta`. Clips concat in timeline order; durations are in seconds.

Anything beyond these six knobs → author directly in HTML. The DSL is intentionally narrow.
