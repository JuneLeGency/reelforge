# intro-demo-templated

Same narration as [`../intro-demo/`](../intro-demo), but driven by the **slide template system** + **visual styles**. Generate `hero-fade-up` animated slides from a ~15-line config, no hand-written HTML.

## Config (15 lines)

```jsonc
{
  "audio": "../intro-demo/narration.mp3",
  "timings": "../intro-demo/narration.srt",
  "template": "hero-fade-up",
  "slides": [
    { "title": "Reelforge", "subtitle": "程序化视频生成框架" },
    { "title": "三个核心设计", "subtitle": "IR · 多前端 · 多后端" },
    // ... 6 more
  ],
  "width": 1280, "height": 720, "fps": 30
}
```

Every slide entry picks up the global `template: hero-fade-up` unless it sets its own. Templates pair 1:1 with sentence boundaries from the SRT.

## Render

```bash
# default styling
bun packages/cli/src/bin.ts generate examples/intro-demo-templated/config.json \
  -o out/intro-templated.mp4 --tiktok-captions

# with a named visual style
bun packages/cli/src/bin.ts generate examples/intro-demo-templated/config.json \
  -o out/intro-styled.mp4 --style neon-electric --tiktok-captions
```

## Available templates

| Template | Per-slide animation |
|---|---|
| `hero-fade-up` | accent rule scaleX → title translateY 40→0 → subtitle stagger. Cinematic promo. |
| `ken-burns-zoom` | Full-bleed image with slow 1.0→1.08 scale + vignette + overlay copy. |
| `bullet-stagger` | Title + 3-5 bullets sliding in from the left with 150 ms stagger. |
| `split-reveal` | Title split horizontally: top half drops, bottom half rises, meeting in the middle. |

## Available visual styles

| Style | Palette / feel |
|---|---|
| `swiss-pulse` | Black / white / red, bold sans, editorial. |
| `dark-premium` | Deep midnight + gold accent, quiet luxury. |
| `neon-electric` | Purple/magenta/cyan neon glow, short-form energy. |
| `warm-editorial` | Off-white paper + serif headlines + orange accent. |
| `mint-fresh` | Light mint + charcoal ink, tech product explainer. |
| `terminal-green` | Pitch-black + phosphor mono + scanlines, hacker demo. |

Styles are compositional — you pick one `style` for the whole video; the template decides per-slide choreography.

## Compared to `../intro-demo/`

| | `intro-demo` | **this demo** | `animated-intro-demo` |
|---|---|---|---|
| Slide source | 8 hand-drawn SVGs | 8 config entries + template | 8 hand-written HTML sections |
| Per-element entrance | None | ✅ from template | ✅ hand-coded |
| Visual style switch | Would need re-drawing all SVGs | ✅ `--style neon-electric` | Would need rewriting the HTML |
| Lines of config / HTML | ~20 (config) + 8 SVGs | ~15 (config only) | 260 (HTML) |

The template + style path **is** the path agents should take by default: declarative config, animated output, reusable across any narration.

## What `generate` does when it sees `slides + template`

1. Parse config, validate each `SlideContent`.
2. TTS / BYO audio pipeline produces sentences from the SRT as usual.
3. For each sentence, pick the matching `slides[i]` (cycling if fewer entries than sentences).
4. Call `renderTemplatedComposition({ slides: BuildSlideInstance[], style })`:
   - Each instance → template(spec) → `{ html, css, animations }`
   - Per-template CSS is deduplicated
   - All animations are concatenated into one `<script>` block that uses WAAPI `element.animate()`
5. Write `index.html` into the workdir and feed to engine-chrome.

The WAAPI adapter in `engine-chrome/runtime.ts` already seeks per frame — **zero changes to the engine were needed** for animated output. The entire template system lives inside `@reelforge/cli`.
