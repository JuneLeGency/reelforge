# Templates

31 templates total. Each is a pure function
`(SlideSpec) → SlideRenderOutput`. Source of truth:
`packages/cli/src/slide-templates/registry.ts`.

## Catalog (by category)

### Text fundamentals
| Name | Slots used | Typical use |
|---|---|---|
| `hero-fade-up` | title, subtitle, image(optional bg), extras.watermark | Main intro slide, chapter cards |
| `kinetic-type` | title (per-char split), subtitle | Opening beat; default easing is `spring-bouncy` |
| `split-reveal` | title (clip-path split top/bottom), subtitle | Dramatic chapter break |
| `bullet-stagger` | title, bullets[] (3-5) | Feature lists |
| `quote-card` | title (quote body), subtitle (attribution) | Pull quotes |

### Data viz
| Name | Slot format |
|---|---|
| `data-chart-reveal` | bullets `"Label: value"` → vertical bars, normalized against max |
| `data-grid` | bullets `"Label: value"` → 2/3/4-col KPI grid |
| `chart-line` | `"x: labels,..."` + `"series: v1,v2,..."` (up to 4 series) |
| `chart-pie` | bullets `"Label: value"` → donut ring (arc paths, not dashoffset) |
| `audio-waveform` | extras.bars (8-64), pseudo-spectrum scaleY baked into keyframes |
| `timeline-roadmap` | bullets `"Label \| period"` → horizontal timeline |

### Structure / comparison
| Name | Slot format |
|---|---|
| `arch-diagram` | bullets `"label \| caption"` → vertical pipeline with SVG arrows |
| `flowchart` | bullets, two modes: `"Root?"+"edge\|leaf"` fan-out OR `"A -> B -> C"` chain |
| `split-compare` | title + extras.{leftTag, leftTitle, leftBody, rightTag, rightTitle, rightBody} |
| `code-block` | bullets (code lines, preserve indent), subtitle (filename) |

### Banner / ambient
| Name | Slot format |
|---|---|
| `news-title` | title, subtitle, bullets (ticker) + extras.{tag, source} |
| `gradient-bg` | title, subtitle + extras.{from, via, to} |

### Photo-driven (image-based)
| Name | Slot format |
|---|---|
| `ken-burns-zoom` | image (full-bleed, slow 1.0→1.08 zoom), title, subtitle |
| `photo-card` | image (full-bleed) + floating card (title/subtitle/extras.eyebrow) |
| `image-left-text` | image (left 50%) + text (right), extras.eyebrow |
| `image-right-text` | mirror of above |
| `image-grid` | bullets = image paths (or text placeholders). Auto-cols: 2/3/4 |
| `picture-in-picture` | image (main) + extras.pipImage + extras.blurBg (0-40 px) |
| `testimonial` | image (portrait) + title (quote) + subtitle (attribution) + extras.company |
| `lower-third` | title + subtitle + image (optional bg) + extras.tag |

### Media widgets
| Name | Slot format |
|---|---|
| `ui-3d-reveal` | title, subtitle, image + extras.angle (0-75°) |
| `music-card` | title, subtitle + extras.{album, duration, accent, platform} |
| `social-follow` | title, subtitle + extras.{platform, cta, counter} — 6 platforms: github, youtube, instagram, tiktok, x, reddit |

### Outro
| Name | Slot format |
|---|---|
| `logo-outro` | title (wordmark) or image (logo art) + subtitle (tagline) |
| `end-card` | title (CTA), subtitle, extras.{icons, actions} |

### Meta
| Name | Purpose |
|---|---|
| `composite` | nested layouts; see [`COMPOSITE.md`](./COMPOSITE.md) |

## Slot conventions

All templates read from the same SlideSpec fields:
- **`title`**: one-line heading
- **`subtitle`**: secondary line
- **`image`**: single image path (already staged by generate.ts
  when from a config)
- **`bullets`**: array of strings; each template parses them differently
  - e.g. chart-pie parses `"Label: 42"`, flowchart parses `"edge | leaf"`
- **`extras`**: `Record<string, string | number | undefined>` —
  everything else. Values must be JSON-safe (no nested arrays/objects)

The `generate.ts` pipeline automatically stages image paths found in:
- `image` (always, all templates)
- `bullets[]` (only for `image-grid` / `ui-3d-reveal`)
- `extras[*]` values ending in `.png/.jpg/.jpeg/.gif/.webp/.avif/.svg`

So config authors can write `"image": "my-photo.jpg"` or
`"extras": { "pipImage": "face.png" }` and the file will be copied
into the workdir automatically.

## Adding a new template — checklist

1. **Create** `packages/cli/src/slide-templates/my-template.ts`
   with the `SlideTemplate` export:
   ```ts
   export const myTemplate: SlideTemplate = (spec) => ({
     html: `<section class="slide slide-my-template" id="slide-${spec.index}">…</section>`,
     css: MY_TEMPLATE_CSS,
     animations: [/* { selector, easing, keyframes } */],
   });
   export const MY_TEMPLATE_CSS = `.slide-my-template { … }`;
   ```

2. **Register** in `registry.ts`:
   ```ts
   import { myTemplate, MY_TEMPLATE_CSS } from './my-template';
   // add to SLIDE_TEMPLATES
   'my-template': myTemplate,
   // add to SLIDE_TEMPLATE_CSS
   'my-template': MY_TEMPLATE_CSS,
   ```

3. **Export** in `index.ts`:
   ```ts
   export { myTemplate, MY_TEMPLATE_CSS } from './my-template';
   ```

4. **Test** in `__tests__/slide-templates.test.ts`:
   - Import `myTemplate` in the top block
   - Add `'my-template'` to the catalog alphabetical-order list
   - Add `expect(resolveTemplate('my-template')).toBe(myTemplate)` line
   - Add a `describe('myTemplate template', ...)` with 2-4 shape /
     animation assertions

5. **Verify**:
   ```bash
   bun --filter '@reelforge/cli' typecheck
   bun --filter '@reelforge/cli' test
   ```

## Animation contract

Every animation goes through **manual-keyframes** — see
[`RENDERING.md`](./RENDERING.md). The template's `animations[]` entries
get flattened into `window.__rf.plans` and seek'd per frame.

Keyframe times are **absolute ms on the composition timeline** — not
relative to the slide. `render-composition.ts` takes care of the
offset math and spring expansion. Templates just use `spec.startMs` /
`spec.endMs` directly.

Selectors are always scoped to the slide's id:
`#slide-${spec.index} .my-class`. **Never use global selectors**
(`.title`, `.foo`) — they'd collide with sibling slides.

Easing options:
- `'linear'` / `'cubic-bezier(a,b,c,d)'` — CSS timing functions
  (passed through to manual-keyframes as-is, but since manual-
  keyframes only does linear interpolation, cubic-bezier is a hint
  for future paths, not actually honored yet)
- `'spring-soft'` / `'spring-bouncy'` / `'spring-stiff'` — expanded
  into ~16 dense keyframes by `spring.ts` at render time

## CSS conventions

- Scope all selectors to your template's top-level class:
  `.slide-my-template .title { … }` (not `.title`)
- Initial state matches the first animation keyframe
  (opacity: 0 + transform: translateY(X) usually)
- The slide container itself is `position: absolute; inset: 0`
  (already set globally in render-composition); don't override
- Child slides (inside `composite`) get `position: absolute; inset: 0`
  relative to their region, not the viewport

## Spring easing

If you want overshoot / bounce, use `easing: 'spring-bouncy'` etc.
WAAPI can't natively overshoot, so `spring.ts` expands the keyframe
range into dense linear samples via a damped-oscillator simulation.

Supported presets (in `spring.ts`):
- `spring-soft`   — gentle settle, no overshoot
- `spring-bouncy` — visible overshoot, good for kinetic type
- `spring-stiff`  — snappy, minimal ring
