# Reelforge

> **Programmatic forge for reels.** A universal framework for generating videos from HTML, JSON, TypeScript, or AI agents — with first-class TTS + STT, DOM-native captions, and image/video/audio composition.

**Status: M1–M3 done, full pipeline closed.** HTML → IR → Chrome / FFmpeg render → MP4. End-to-end validated with a GPU TTS service. See [`examples/intro-demo/`](./examples/intro-demo) for the flagship demo and [**DESIGN.md**](./DESIGN.md) for the architecture.

---

## Try it in 30 seconds (no API key)

```bash
bun install
bun packages/cli/src/bin.ts render examples/hello-world/index.html -o out/hello.mp4
open out/hello.mp4
```

3-second 1280×720 30 fps MP4 — inline-SVG background + WAAPI-animated title. Zero external assets, zero network.

**Requirements:** Node ≥ 22, `ffmpeg` on `PATH`, Google Chrome installed.

## Narration-driven generation

Three modes, all pass through the same `generate` command — Reelforge picks the mode from the config fields:

```bash
# 1. Reelforge calls ElevenLabs for you
ELEVENLABS_API_KEY=... reelforge generate config.json -o out.mp4    # { narration, voice, images }

# 2. Bring your own audio + pre-computed timings (SRT or Whisper JSON)
reelforge generate config.json -o out.mp4                            # { audio, timings, images }

# 3. Bring your own audio, let Reelforge run whisper.cpp locally
WHISPER_BINARY=/opt/whisper-cpp WHISPER_MODEL=.../ggml-base.en.bin \
  reelforge generate config.json -o out.mp4                          # { audio, images }
```

Slide durations auto-align to sentence boundaries. TikTok-style per-word highlights with `--tiktok-captions`. DOM-rendered captions work with **any** ffmpeg build — no libass required.

**Flagship demo:** [`examples/intro-demo/`](./examples/intro-demo) — a 47.64 s Chinese self-intro, narration synthesized by a remote VoxCPM2 GPU service, 8 sentence-aligned slides, word-by-word caption highlights.

## All CLI commands

| Command | Purpose |
|---|---|
| `reelforge init <dir>` | Scaffold a new project from the hello-world template |
| `reelforge preview <html>` | Live-reloading HTML preview server |
| `reelforge render <input> -o <mp4>` | Compile + render. Input: `.html` / `.json` / `.json5`. Auto-picks FFmpeg fast path when eligible; `--engine chrome/ffmpeg` to override; `--parallelism N` splits the frame range across N Chromes on long renders. |
| `reelforge tts "<text>" --voice <id>` | Standalone ElevenLabs narration (+ optional SRT) |
| `reelforge stt <audio>` | Transcribe an audio file via whisper.cpp → SRT / JSON / TXT |
| `reelforge captions <file>` | Inspect + convert SRT ↔ Whisper JSON ↔ TikTokPage pages |
| `reelforge generate <config.json>` | Full pipeline: narration → sentence cuts → captions → render. See modes above. |
| `reelforge mcp` | Start the MCP server on stdio for Claude Code / Cursor / Codex |

## Why another video framework?

Existing tools each own one dimension:

- **Hyperframes** — HTML-native, agent-friendly, deterministic rendering
- **Remotion** — React components, Lambda rendering, mature caption/TTS ecosystem
- **Motion Canvas / Revideo** — generator-based scene time control
- **editly** — declarative JSON clip/layer DSL
- **Mosaico** — asset/reference separation, protocol-based extensibility

Reelforge borrows from all of them and unifies them behind a single Intermediate Representation. Author with whatever frontend you prefer — HTML, JSON5, TypeScript generators, or an AI agent via MCP — and render through whichever backend fits: Chrome + HTML, Canvas + generators, or a fast FFmpeg filter path for pure media stitching.

## Architecture at a glance

```
Authoring   →   HTML  | JSON5 DSL  | TS Generator  | AI Agent (Skills + MCP)
                                  ↓
    IR      →   VideoProject (assets · timeline · captions · transitions)
                                  ↓
Orchestrator →  TTS · STT · LLM · Storage · Image Providers (Protocol-based)
                                  ↓
Renderers   →   Chrome+HTML  |  FFmpeg fast path (xfade)  |  Canvas+Generator  |  WebCodecs
                                  ↓
   Output   →   Audio mix · DOM / libass captions · MP4 / WebM / GIF
```

Full detail in [DESIGN.md](./DESIGN.md).

## Packages

| Package | What it does |
|---|---|
| [`@reelforge/ir`](./packages/ir) | TypeScript types + Zod schema for `VideoProject` (the IR everyone compiles to) |
| [`@reelforge/captions`](./packages/captions) | Word-timings → captions, TikTok-style pagination, SRT ↔ Whisper JSON parsers |
| [`@reelforge/transitions`](./packages/transitions) | 46-name xfade catalog + 20 curated aliases (fade / wipe-left / slide-up / …) |
| [`@reelforge/html`](./packages/html) | HTML frontend — compile `data-*`-annotated HTML into IR, including `data-rf-transition-{in,out}` |
| [`@reelforge/dsl`](./packages/dsl) | JSON5 DSL frontend — editly-style clip/layer config → HTML → IR |
| [`@reelforge/engine-chrome`](./packages/engine-chrome) | Chrome backend — WAAPI / GSAP / image / video adapters, image2pipe → ffmpeg, opt-in BeginFrame CDP, parallel frame segments, WAAPI cross-fade transitions |
| [`@reelforge/engine-ffmpeg`](./packages/engine-ffmpeg) | Fast-path backend — IR → filter_complex (with xfade chain) → mp4, no Chrome |
| [`@reelforge/mux`](./packages/mux) | Mix IR audio clips onto silent video, optional libass subtitle burn |
| [`@reelforge/providers-tts-elevenlabs`](./packages/providers-tts-elevenlabs) | ElevenLabs TTS with character-level alignment → word timings |
| [`@reelforge/providers-stt-whisper`](./packages/providers-stt-whisper) | Local whisper.cpp — audio file → word-level timings |
| [`@reelforge/mcp`](./packages/mcp) | MCP server — expose compile / introspect tools to AI agents over stdio |
| [`@reelforge/cli`](./packages/cli) | `reelforge` command — init / preview / render / tts / stt / captions / generate / mcp |

**241 tests across 13 packages, all green.**

## Design principles

1. Author once, render anywhere — any frontend compiles to the same IR.
2. Agent-first — CLI non-interactive by default, Skills + MCP built in, IR is structured JSON.
3. Deterministic rendering — same IR + assets = byte-identical output.
4. **Reelforge is a consumer of TTS, not a producer.** Bring your own narration from any service; we align, caption, and render.
5. DOM > libass — text is a graphics problem solved in the render layer, never in ffmpeg filters.
6. Composable, not monolithic — every Provider / Layer / Transition / Effect / FrameAdapter is a plugin.

## Performance (measured)

Benchmarks on a M-series MacBook, local Chrome + Homebrew ffmpeg:

| Workload | Engine | Time | Notes |
|---|---|---|---|
| hello-world (3 s, 90 f) | chrome, p=1 | 6.9 s | Single Chrome |
| hello-world (3 s, 90 f) | chrome, p=4 | 3.3 s | 2.1× speedup; short video, parallel startup cost amortizes |
| fastpath-demo (6 s, 180 f) | chrome, p=1 | 8.7 s | Single Chrome |
| fastpath-demo (6 s, 180 f) | **ffmpeg**  | **0.6 s** | **13× speedup** — IR is fast-path eligible (pure media, no animations) |
| intro-demo (47.6 s, 1430 f) | chrome, p=1 | **123 s** | 2.6× realtime (~12 rendered fps). Target baseline. |
| intro-demo (47.6 s, 1430 f) | chrome, p=4 | 336 s | **2.7× slower** — 4 Chromes contend on laptop cores |

Takeaways:

- **FFmpeg fast path is the big win** when the project qualifies (image/video/audio clips, no caption tracks, no effects).
- **Chrome parallelism is a laptop anti-pattern for long videos** — Chrome is already single-thread-CPU-bound during screenshot; multiple processes thrash. Parallelism shines on Linux servers with real core counts and on short videos where startup dominates.
- The main frame-level optimization still in flight: **BeginFrame CDP on Linux** (`--use-begin-frame`) + eventually WebCodecs for in-browser rendering.

## Status & Roadmap

- ✅ **M0 — Architecture + skeleton** — IR contract, monorepo, toolchain, DESIGN.md
- ✅ **M1 — End-to-end MVP** — HTML + Chrome + ElevenLabs + mux + CLI
- ✅ **M2 — Multiple frontends + agent** — JSON5 DSL, TikTok per-word captions, MCP server
- ✅ **M3 — Multiple backends** — BeginFrame CDP, FFmpeg fast path (xfade chain), parallel segments, WAAPI cross-fade on Chrome
- ✅ **M4a — TTS product consumption** — BYO audio/timings, whisper.cpp integration, standalone `stt` + `captions` CLIs, end-to-end GPU-TTS intro demo
- 🟡 **M4b — Ecosystem polish** — ✅ Skills packs (`/reelforge`, `/reelforge-dsl`, `/reelforge-cli`); 🔜 cloud deploy templates (Lambda / Docker), Canvas-generator frontend, Remotion-style WebCodecs renderer

Full roadmap in [DESIGN.md §11](./DESIGN.md#11-路线图).

## Contributing

```bash
bun install          # install workspace deps
bun run typecheck    # tsc --noEmit across every package
bun run test         # bun test across every package
bun run lint         # oxlint
```

Don't commit `ref/` (the 9 shallow-cloned reference repos) or `.claude/settings.local.json` — both are already gitignored. Render artifacts (`.mp4`, `.webm`, …) are gitignored too.

## License

Apache 2.0 (planned). Commercial use at any scale, no per-render fees.

## Inspiration / shoulders of giants

Reelforge explicitly borrows ideas from:

- [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) — HTML-native rendering, library-clock pattern, `BeginFrame` CDP trick, `image2pipe` streaming
- [remotion-dev/remotion](https://github.com/remotion-dev/remotion) — `Caption` data model, TikTok-style word pagination, provider adapters, `OffthreadVideo` concept
- [mifi/editly](https://github.com/mifi/editly) — JSON5 clip/layer/transition schema, gl-transitions catalog
- [folhasp/mosaico](https://github.com/folhasp/mosaico) — asset vs reference separation, Protocol-based extensibility, three positioning strategies
- [motion-canvas/motion-canvas](https://github.com/motion-canvas/motion-canvas) + [redotvideo/revideo](https://github.com/redotvideo/revideo) — generator-based tweening, signal-reactive scene graph
- [ncounterspecialist/twick](https://github.com/ncounterspecialist/twick) — timeline data model, browser/server dual-path export

Credit where credit is due — Reelforge would not exist without this prior art.
