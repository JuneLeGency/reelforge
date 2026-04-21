# Reelforge

> **Programmatic forge for reels.** A universal framework for generating videos from HTML, JSON, TypeScript, or AI agents — with first-class TTS, captions, and image/video/audio composition.

**Status: M1 end-to-end pipeline working.** HTML → IR → Chrome-captured frames → ffmpeg-muxed MP4. See [**DESIGN.md**](./DESIGN.md) for the full architecture.

---

## Try it in 30 seconds

```bash
bun install
bun packages/cli/src/bin.ts render examples/hello-world/index.html -o out/hello.mp4
open out/hello.mp4
```

That renders a 3-second 1280×720 30 fps MP4 from an inline-SVG background + WAAPI-animated title — no external assets, no API keys. See [`examples/hello-world/`](./examples/hello-world) for the details and variations (adding narration, changing aspect ratio, etc.).

**Requirements:** Node ≥ 22, `ffmpeg` on `PATH`, Google Chrome installed.

### Going further: narration-driven generation

With an `ELEVENLABS_API_KEY`, the pipeline can take a script + slides and produce a fully narrated video:

```bash
bun packages/cli/src/bin.ts generate examples/narration-demo/config.json \
  -o out/narration.mp4 --srt out/narration.srt
```

Slide durations are aligned to sentence-level TTS word timings — no manual timing. DOM-overlay captions are baked in automatically (see [`examples/captions-demo/`](./examples/captions-demo) for the standalone proof — captions work with **any** ffmpeg, no libass required). See [`examples/narration-demo/`](./examples/narration-demo).

### All CLI commands

| Command | Purpose |
|---|---|
| `reelforge init <dir>` | Scaffold a new project from the hello-world template |
| `reelforge preview <html>` | Live-reloading HTML preview server (WebSocket hot-reload) |
| `reelforge render <html> -o <mp4>` | Compile HTML → IR → rendered MP4 |
| `reelforge tts "<text>" --voice <id> -o <mp3>` | Standalone narration synthesis (+ optional SRT) |
| `reelforge generate <config.json> -o <mp4>` | Full script→slides→video pipeline (add `--tiktok-captions` for per-word highlights) |
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
    IR      →   VideoProject (assets · timeline · captions · effects)
                                  ↓
Orchestrator →  TTS · STT · LLM · Storage · Image Providers (Protocol-based)
                                  ↓
Renderers   →   Chrome+HTML  |  Canvas+Generator  |  FFmpeg fast path  |  WebCodecs
                                  ↓
   Output   →   Audio mix · Caption burn/SRT · MP4 / WebM / GIF
```

Full detail in [DESIGN.md](./DESIGN.md).

## Packages

| Package | What it does |
|---|---|
| [`@reelforge/ir`](./packages/ir) | TypeScript types + Zod schema for `VideoProject` (the IR everyone compiles to) |
| [`@reelforge/captions`](./packages/captions) | Word-timings → captions, TikTok-style pagination, SRT round-trip |
| [`@reelforge/html`](./packages/html) | HTML frontend — compile `data-*`-annotated HTML into IR |
| [`@reelforge/dsl`](./packages/dsl) | JSON5 DSL frontend — editly-style clip/layer config → HTML → IR |
| [`@reelforge/engine-chrome`](./packages/engine-chrome) | Chrome backend — library-clock adapters (GSAP / WAAPI / image / video), image2pipe → ffmpeg, opt-in BeginFrame CDP path |
| [`@reelforge/mux`](./packages/mux) | Mix IR audio clips onto silent video (`atrim` + `adelay` + `amix`), optional libass subtitle burn |
| [`@reelforge/providers-tts-elevenlabs`](./packages/providers-tts-elevenlabs) | ElevenLabs TTS with character-level alignment → word timings |
| [`@reelforge/mcp`](./packages/mcp) | MCP server — exposes compile / introspect tools to AI agents over stdio |
| [`@reelforge/cli`](./packages/cli) | `reelforge render` / `generate` / `preview` / `init` / `tts` / `mcp` |

**167 tests across 9 packages, all green.**

## Design principles

1. Author once, render anywhere — any frontend compiles to the same IR.
2. Agent-first — CLI non-interactive by default, Skills + MCP built in, IR is structured JSON.
3. Deterministic rendering — same IR + assets = byte-identical output.
4. Audio-driven time — TTS word-level timestamps are the master clock.
5. Composable, not monolithic — every Provider / Layer / Transition / Effect / FrameAdapter is a plugin.

## Status & Roadmap

- ✅ **M0 — Architecture and skeleton** — IR contract, monorepo, toolchain, DESIGN.md
- ✅ **M1 — End-to-end MVP** — HTML + Chrome engine + ElevenLabs TTS + mux + CLI
- ✅ **M2 — Multiple frontends + agent integration** — JSON5 DSL, `generate` pipeline with TikTok-style word highlights, MCP server with 4 structured tools
- 🟡 **M3 — Multiple backends** — ✅ BeginFrame CDP opt-in; 🔜 FFmpeg fast path, Canvas + generators, parallel frame segments
- 🔜 **M4 — Ecosystem** — cloud deploy templates, more TTS/STT/image providers, Skills for agents, community marketplace

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
