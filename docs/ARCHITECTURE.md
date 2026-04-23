# Architecture

The short version. For long-form rationale see [`/DESIGN.md`](../DESIGN.md).

## Package map

```
@reelforge/ir                 Zod-backed VideoProject schema (single
                              source of type truth)
@reelforge/dsl                Parses config.json / DSL inputs into IR
@reelforge/html               HTML composition utilities shared by
                              engine-chrome
@reelforge/transitions        xfade catalog (FFmpeg) + CHROME_EFFECTS
                              registry (Chrome overlays)
@reelforge/captions           SRT / Whisper JSON parsing, TikTok
                              per-word pagination
@reelforge/engine-chrome      Puppeteer + runtime.ts (manual-keyframes
                              seek adapter) — renders a per-frame png
                              pipe to ffmpeg
@reelforge/engine-ffmpeg      Fast path: xfade + concat for pure
                              image/video slideshows (13× realtime)
@reelforge/mux                ffmpeg audio mux + subtitle burn helpers
@reelforge/providers-tts-*    TTS adapter (ElevenLabs)
@reelforge/providers-stt-*    STT adapter (whisper.cpp)
@reelforge/mcp                MCP server for Claude Code
@reelforge/cli                Commands: init / preview / render / tts /
                              stt / captions / generate / compose / mcp
                              + slide-templates/ + visual-styles/
```

**Bun workspaces** (never `npm install`). ESM-only. tsc project refs.

## The "slide-templates" system (in `@reelforge/cli`)

Where almost all "make a video pretty" code lives.

```
packages/cli/src/slide-templates/
  types.ts              SlideSpec / SlideRenderOutput / SlideTemplate
                        / CompositeChild contracts
  registry.ts           SLIDE_TEMPLATES map (31 entries) + resolve* helpers
  render-composition.ts The orchestrator: slides + captions + page-
                        counter + chrome-effects → single HTML doc
                        with an inline <script> that puts animation
                        plans on window.__rf.plans
  <template>.ts × 31    One per template. Pure function:
                        (SlideSpec) → { html, css, animations }
  spring.ts             Physics-based easing (pre-sampled keyframes)
  composite.ts          The "nested layout" meta-template
```

### Render data flow

```
 config.json
      │
      ▼  parseGenerateConfig (generate.ts)
 SlideContent[]
      │
      ▼  map sentence ↔ slide content, stage images
 BuildSlideInstance[]  ← startMs/endMs come from SRT
      │
      ▼  renderTemplatedComposition
 ┌────────────────────────────────────────────────────────────┐
 │ for each slide:                                            │
 │   spec = { index, startMs, endMs, title, …, children }     │
 │   template = resolveTemplate(slide.template)               │
 │   output = template(spec)  // html + css + animations      │
 │                                                            │
 │ for each caption / tiktok page / transition effect:        │
 │   push an animation plan (SAME shape as slide anims)       │
 │                                                            │
 │ for each slide (N > 1):                                    │
 │   push a global page-counter plan (NN / total)             │
 │                                                            │
 │ expand spring easings into dense linear keyframes          │
 │ (runtime.ts does not understand 'spring-*' easing)         │
 │                                                            │
 │ serialize plans into `window.__rf.plans = [...]`           │
 └────────────────────────────────────────────────────────────┘
      │
      ▼  index.html with inline <script> + <style> + <section>s
 @reelforge/engine-chrome
      │
      ▼  renderChrome(opts)
 puppeteer headless:'shell'
      │
      ▼  for each frame (absolute ms, 30/60 fps):
        await window.__rf.seekFrame(timeMs)
          → runtime.ts's manual-keyframes adapter iterates
            window.__rf.plans, brackets t against each plan's
            keyframes, linearly interpolates per-property,
            writes the result to el.style (+ el.setAttribute
            for SVG presentation props) directly
        await rAF × 2           (let paint commit)
        page.screenshot(png)
      │
      ▼  spawned ffmpeg stdin accepts the png pipe → silent.mp4
      │
      ▼  @reelforge/mux adds audio → final .mp4
```

**Key design commitment**: animation plans (JSON) live on
`window.__rf.plans` and run through a **single manual-keyframes
adapter** in runtime.ts. No WAAPI, no GSAP ticker, no CSS animations
that drift on wall-clock. Slide anims + caption anims + page counter
anims + chrome-effect anims **all** go through this one path.

## SlideSpec contract

Templates are pure functions. A template emits HTML with a stable
`id="slide-{index}"` and animation selectors scoped to that id.

```ts
interface SlideSpec {
  index: number;        // DOM id: slide-{index}
  startMs, endMs: number;
  title?, subtitle?, image?: string;
  bullets?: readonly string[];
  extras?: Record<string, string | number | undefined>;
  children?: CompositeChild[];  // composite only
  layout?: string;              // composite only
}

interface SlideRenderOutput {
  html: string;                 // exactly one top-level element
  css: string;                  // injected once per template family
  animations: SlideAnimation[]; // one per element.animate()-equivalent
}

interface SlideAnimation {
  selector: string;                             // e.g. #slide-0 .title
  easing?: string;                              // cubic-bezier / spring-*
  keyframes: { atMs: number; props: {...} }[]; // ABSOLUTE ms, not ratio
}
```

All templates live in `@reelforge/cli/src/slide-templates/`. Adding
one = create the file, register in `registry.ts`, export from
`index.ts`, add tests to `__tests__/slide-templates.test.ts`. See
[`TEMPLATES.md`](./TEMPLATES.md).

## Why this split (IR / engine / CLI)

- **IR**: type-safe composition model (Zod). Frontends compile to this;
  engines consume this.
- **Engines**: `engine-chrome` (DOM, full flexibility, ~12-30 fps) vs
  `engine-ffmpeg` (pure slideshow, 13× realtime, no WAAPI). CLI picks.
- **CLI**: opinionated convenience layer — `rf generate` / `rf compose`
  wire together TTS → SRT → templates → render → mux.

Frontends (DSL, future MCP / Studio) all converge on IR. Engines are
fungible.

## Recent architectural upgrades

- **manual-keyframes adapter** (replaces WAAPI) — see
  [`RENDERING.md`](./RENDERING.md) and [`DECISIONS.md`](./DECISIONS.md).
- **headless: 'shell'** (not `true`) — known Chromium bug, decision in
  [`DECISIONS.md`](./DECISIONS.md).
- **composite template** — one-level nested layouts, see
  [`COMPOSITE.md`](./COMPOSITE.md).
- **SlideContent.extras** — free-form JSON-safe record for per-slide
  template data (split-compare.leftBody, photo-card.eyebrow, etc.)
- **`generate.ts` auto-stages images** from `bullets[]` and `extras`
  when paths end in `.png/.jpg/.svg/...` — no manual copy.
