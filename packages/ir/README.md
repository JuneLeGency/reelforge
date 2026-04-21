# @reelforge/ir

The **Intermediate Representation** that every Reelforge frontend compiles to and every renderer reads from.

One type tree, one Zod schema, one source of truth.

## What's inside

| Module | Exports |
|---|---|
| `config.ts` | `ProjectConfig`, `ProjectConfigSchema` |
| `positions.ts` | `Position`, `Transform`, `Anchor` |
| `assets.ts` | `Asset` (discriminated union of Image/Video/Audio/Text/Font/Shader/Lottie), `AssetSource` |
| `effects.ts` | `EffectSpec`, `EffectRef`, `TransitionSpec`, `TransitionRef` |
| `timeline.ts` | `Timeline`, `Track`, `Clip` |
| `captions.ts` | `Caption`, `CaptionTrack`, `CaptionStyle` (Remotion-compatible model) |
| `project.ts` | `VideoProject`, `VideoProjectSchema` — the top-level IR |
| `validate.ts` | `parse`, `safeParse`, `planDuration`, `collectAssetRefs`, `VideoProjectValidationError` |

## Usage

```ts
import { parse, planDuration } from '@reelforge/ir';

const project = parse(jsonInput);   // throws on invalid
const durationMs = planDuration(project);
```

## Contracts enforced

- Zod schema validation (shape + primitive constraints).
- Referential integrity:
  - every `Clip.assetRef` points to an existing key in `project.assets`
  - every named `effect` / `transition` reference resolves in `effectsLibrary` / `transitionsLibrary`
- Time invariants: `clip.durationMs > 0`, `startMs >= 0`.

See [`DESIGN.md §3`](../../DESIGN.md#3-ir-videoproject-规范) for the full spec.
