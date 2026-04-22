---
name: reelforge-cli
description: Invoke the `reelforge` CLI correctly (init / preview / render / tts / generate / mcp). Use when asked to render a Reelforge project, scaffold a new one, run a live preview server, synthesize narration, or start the MCP server for another agent. Covers every flag and the common failure modes.
---

# Reelforge CLI

Command reference. All commands accept `--help`.

## `reelforge init <dir>`

Scaffold a new video project from the hello-world template.

```bash
reelforge init my-video
# Writes: my-video/index.html, my-video/README.md
```

| Flag | Default | Meaning |
|---|---|---|
| `--force` | `false` | Overwrite `<dir>` if it exists |

## `reelforge preview <html>`

Live-reloading HTML server. File changes broadcast `reload` via WebSocket to every connected client.

```bash
reelforge preview ./index.html         # localhost:3000
reelforge preview ./index.html -p 4000 # custom port
```

| Flag | Default | Meaning |
|---|---|---|
| `-p, --port` | `3000` | Listen port |

**Safety:** path traversal outside the HTML's parent directory returns 404. MIME types cover images/video/audio/fonts.

## `reelforge render <html|json|json5> [-o <mp4>]`

Compile a composition and render to mp4. File extension picks the frontend:

- `.html` → raw HTML (via `@reelforge/html`)
- `.json` / `.json5` → DSL (via `@reelforge/dsl`)

```bash
reelforge render ./index.html -o out/video.mp4
reelforge render ./video.json5 -o out/video.mp4
reelforge render ./index.html -o out.mp4 --use-begin-frame
reelforge render ./index.html -o out.mp4 --burn-subtitles subs.srt
```

| Flag | Default | Meaning |
|---|---|---|
| `-o, --output` | `out/video.mp4` | Output mp4 path |
| `--chrome` | auto-detect | Path to Chrome/Chromium executable (or set `$CHROME_PATH`) |
| `--ffmpeg` | `ffmpeg` | ffmpeg binary |
| `--keep-silent` | `false` | Don't delete the intermediate silent mp4 |
| `--use-begin-frame` | `false` | Use `HeadlessExperimental.beginFrame` for deterministic atomic capture. Disables `<video>`/`<audio>` playback (compositor paused). Use only for DOM/WAAPI/GSAP-only compositions. |
| `--burn-subtitles` | — | SRT file to burn into the output (requires ffmpeg with libass; macOS Homebrew ffmpeg does not have it) |
| `--subtitle-style` | — | libass `force_style` override, e.g. `'FontSize=32,Alignment=2'` |

**Requirements:** Node ≥ 22, ffmpeg on `$PATH`, Chrome/Chromium installed.

## `reelforge tts <text> [--voice <id>]`

Standalone ElevenLabs narration.

```bash
export ELEVENLABS_API_KEY=...
reelforge tts "Hello world" \
  --voice Xb7hH8MSUJpSbSDYk0k2 \
  -o narration.mp3 \
  --srt narration.srt
```

| Flag | Default | Meaning |
|---|---|---|
| `-o, --output` | `narration.mp3` | Output mp3 |
| `--voice` | **required** | ElevenLabs voice ID |
| `--model` | `eleven_turbo_v2_5` | ElevenLabs model ID |
| `--srt` | — | Also write a per-word SRT |
| `--api-key` | `$ELEVENLABS_API_KEY` | API key |

## `reelforge generate <config.json> [-o <mp4>]`

Full pipeline: TTS → sentence-split → slide assignment → DOM captions → Chrome render → audio mux.

```bash
reelforge generate examples/narration-demo/config.json -o out/narration.mp4
reelforge generate config.json -o out.mp4 --tiktok-captions --tiktok-threshold 900
reelforge generate config.json -o out.mp4 --no-captions      # no DOM overlay
reelforge generate config.json -o out.mp4 --burn             # extra libass burn on top
```

`config.json` shape:

```json
{
  "narration": "Full script.",
  "images": ["./slide-1.svg", "./slide-2.svg"],
  "voice": "<elevenlabs voice id>",
  "width": 1280,
  "height": 720,
  "fps": 30,
  "modelId": "eleven_turbo_v2_5"
}
```

A sentence-level `.srt` is always written alongside the mp4. With `--srt <path>`, a word-level SRT is also emitted.

| Flag | Default | Meaning |
|---|---|---|
| `-o, --output` | `out/video.mp4` | Output mp4 |
| `--tiktok-captions` | `false` | Per-word highlighted captions (TikTok style) |
| `--tiktok-threshold` | `1200` | ms gap between words that forces a new page |
| `--no-captions` | `false` | Skip DOM captions entirely |
| `--burn` | `false` | Extra libass pass on top of DOM captions |
| `--srt` | — | Also write a word-level SRT |
| `--keep-workdir` | `false` | Preserve the intermediate HTML + audio |
| `--api-key` | `$ELEVENLABS_API_KEY` | API key |
| `--chrome` | auto-detect | Chrome path |
| `--ffmpeg` | `ffmpeg` | ffmpeg binary |

## `reelforge mcp`

Start the MCP server on stdio. Register with Claude Code / Cursor / Codex:

```jsonc
// ~/.claude/mcp_servers.json
{
  "reelforge": {
    "command": "bun",
    "args": ["/abs/path/to/reelforge/packages/cli/src/bin.ts", "mcp"]
  }
}
```

Exposed tools: `rf_compile_html`, `rf_compile_dsl`, `rf_compile_dsl_inline`, `rf_plan_duration`. See [`@reelforge/mcp`](../../packages/mcp/README.md).

## Error cheatsheet

| Message | Cause |
|---|---|
| `Could not find Chrome/Chromium` | Install Chrome, or pass `--chrome <path>` |
| `ffmpeg exited with code ...` | Check stderr; most common is a missing codec. Install a full `ffmpeg`. |
| `Unknown filter 'subtitles'` | Your ffmpeg has no libass. Use DOM captions (default) instead of `--burn`. |
| `ElevenLabs API error 401` | Check `ELEVENLABS_API_KEY` / `--api-key`. |
| `compile did not return an htmlPath` | Passed a file extension the CLI doesn't know. Use `.html`, `.json`, or `.json5`. |
