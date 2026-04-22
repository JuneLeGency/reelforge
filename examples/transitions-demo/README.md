# transitions-demo

Pure-ffmpeg cross-fade between 3 slides using the **xfade** filter. No Chrome, no libass — a single `filter_complex` chain does the blending.

## Run

```bash
bun packages/cli/src/bin.ts render examples/transitions-demo/video.json5 --engine ffmpeg -o out/transitions.mp4
open out/transitions.mp4
```

Output: **5 seconds** (3 clips × 2 s = 6 s, minus 2 × 0.5 s fade overlap).

## Config

```json5
{
  config: { width: 1280, height: 720, fps: 30 },
  clips: [
    { duration: 2, transition: 'fade', layers: [{ type: 'image', src: './slide-a.png' }] },
    { duration: 2, transition: 'fade', layers: [{ type: 'image', src: './slide-b.png' }] },
    { duration: 2,                     layers: [{ type: 'image', src: './slide-c.png' }] }
  ],
}
```

DSL `clip.transition` compiles to HTML `data-rf-transition-out="fade"` +
`data-rf-transition-out-ms="500"`, which `@reelforge/html` turns into IR
`clip.transitionOut`. The fast path detects the chain and emits:

```
[v0][v1] xfade=transition=fade:duration=0.500:offset=1.500 [x0]
[x0][v2] xfade=transition=fade:duration=0.500:offset=3.100 [vout]
```

## Supported transition names

Author-facing aliases (resolve into ffmpeg xfade built-ins):

| Alias | xfade name |
|---|---|
| `fade` / `cross-fade` / `crossfade` | `fade` |
| `fade-black` | `fadeblack` |
| `fade-white` | `fadewhite` |
| `wipe-left` / `wipe-right` / `wipe-up` / `wipe-down` | `wipeleft` etc. |
| `slide-left` / `slide-right` / `slide-up` / `slide-down` | `slideleft` etc. |
| `dissolve` | `dissolve` |
| `pixelize` | `pixelize` |
| `circle-open` / `circle-close` | `circleopen` / `circleclose` |
| `radial` | `radial` |
| `zoom` / `zoom-in` | `zoomin` |

Raw xfade names (expert path): prefix with `xfade:`, e.g. `xfade:hlslice`, `xfade:zoomin`, `xfade:hblur`.

Full catalog in `@reelforge/transitions` (`XFADE_TRANSITIONS`).

## When is xfade used?

The fast path upgrades to an `xfade` chain automatically when **every adjacent clip pair** has a resolvable transition AND clips have no gap. Otherwise it falls back to the `overlay + enable` path (instant cuts). You don't opt in explicitly — just set `transition` on each clip and the engine picks the right graph.

## Verification

Frames extracted at `1.0 / 1.75 / 2.5 / 3.25 / 3.55 / 4.5`s:

| Pair | Expected | PSNR |
|---|---|---|
| 1.0s vs 1.75s | Both should still be mostly slide-a, but at 1.75s the fade is halfway into slide-b → blended | **9.56 dB** (blended) |
| 1.0s vs 2.5s | 1.0s is pure slide-a; 2.5s is pure slide-b | **4.10 dB** (fully different) |

A sharp-cut (no transition) would have given PSNR >45 dB for the first pair and the same ~4 dB for the second.
