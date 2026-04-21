# Reelforge

> **Programmatic forge for reels.** A universal framework for generating videos from HTML, JSON, TypeScript, or AI agents — with first-class TTS, captions, and image/video/audio composition.

**Status: pre-alpha.** Architecture draft only. No code yet. See [**DESIGN.md**](./DESIGN.md).

---

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

## Design principles

1. Author once, render anywhere — any frontend compiles to the same IR.
2. Agent-first — CLI non-interactive by default, Skills + MCP built in, IR is structured JSON.
3. Deterministic rendering — same IR + assets = byte-identical output.
4. Audio-driven time — TTS word-level timestamps are the master clock.
5. Composable, not monolithic — every Provider / Layer / Transition / Effect / FrameAdapter is a plugin.

## Status & Roadmap

- **M0 — Architecture and skeleton** (current)
- **M1 — End-to-end MVP**: `@reelforge/html` + `@reelforge/engine-chrome` + ElevenLabs TTS + Whisper captions. Goal: one-sentence → slide video with narration and word-level captions.
- **M2 — Multiple frontends**: DSL, Agent Skills, MCP
- **M3 — Multiple backends**: FFmpeg fast path, Canvas + generators
- **M4 — Ecosystem**: cloud deploy templates, more providers, community skill marketplace

Full roadmap in [DESIGN.md §11](./DESIGN.md#11-路线图).

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
