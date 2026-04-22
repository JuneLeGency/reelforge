# @reelforge/transitions

Transition registry for Reelforge. Defines a stable name → implementation mapping for ffmpeg's built-in `xfade` catalog, plus a small handful of curated aliases the DSL uses (`fade`, `cross-fade`, `wipe-left`, etc.).

## Why

When a `VideoProject` IR contains a clip with `transitionOut: { name: 'fade', durationMs: 500 }`, someone has to translate that name into a concrete ffmpeg invocation. This package owns that mapping. Both `@reelforge/engine-ffmpeg` (fast path) and future `@reelforge/engine-chrome` CSS fallbacks read from it.

## API

```ts
import { resolveTransition, listTransitions, XFADE_TRANSITIONS } from '@reelforge/transitions';

resolveTransition({ name: 'fade', durationMs: 500 });
// → { kind: 'xfade', xfade: 'fade', durationMs: 500 }

resolveTransition({ name: 'wipe-left', durationMs: 800 });
// → { kind: 'xfade', xfade: 'wipeleft', durationMs: 800 }

listTransitions();
// → ['fade', 'cross-fade', 'wipe-left', ..., 'xfade:slideleft', ...]
```

Unknown names throw `TransitionResolveError` — callers can fall back to a stream concat with no transition.

## Catalog

- **Curated aliases** (friendly names, DSL-facing): `fade`, `cross-fade`, `fade-black`, `fade-white`, `wipe-left`, `wipe-right`, `wipe-up`, `wipe-down`, `slide-left`, `slide-right`, `slide-up`, `slide-down`, `dissolve`, `pixelize`, `circle-open`, `circle-close`, `radial`.
- **Raw xfade passthroughs** (expert mode): every `xfade:<name>` where `<name>` is one of ffmpeg's 40+ built-ins (see `XFADE_TRANSITIONS`).

Custom GLSL transitions (editly-style `gl-transitions`) aren't wired yet — they'll slot in as `{ kind: 'glsl', source: '...' }` and the fast path will route via `xfade_opencl` or similar when needed. Out of scope for v1.

## Integration

```ts
// engine-ffmpeg
import { resolveTransition } from '@reelforge/transitions';

if (clip.transitionOut) {
  const resolved = resolveTransition(clip.transitionOut);
  // resolved.xfade is 'fade', 'wipeleft', etc. — drop straight into
  // `xfade=transition=<name>:duration=<sec>:offset=<sec>`
}
```
