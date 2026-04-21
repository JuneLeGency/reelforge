# @reelforge/mcp

Model Context Protocol server exposing Reelforge compilation + IR inspection to AI agents (Claude Code, Cursor, Codex CLI, etc.). Runs on stdio.

## Tools

| Tool | Purpose |
|---|---|
| `rf_compile_html` | Compile an HTML composition path into an IR VideoProject JSON |
| `rf_compile_dsl` | Compile a JSON / JSON5 DSL config file into an IR VideoProject |
| `rf_compile_dsl_inline` | Compile a JSON5 string directly (no file on disk) |
| `rf_plan_duration` | Given an IR VideoProject, return the total duration in ms |

Tools return structured JSON; errors go back as MCP `isError: true` with human-readable messages. Every path is treated relative to the agent's working directory — absolute paths are honored verbatim.

## Run

```bash
# Stdio transport:
bun packages/mcp/src/bin.ts
```

Register with Claude Code in `~/.claude/mcp_servers.json`:

```jsonc
{
  "reelforge": {
    "command": "bun",
    "args": ["/abs/path/to/reelforge/packages/mcp/src/bin.ts"]
  }
}
```

## Design notes

This package intentionally does **not** expose `rf_render` or `rf_tts` today. Render spawns Chrome + ffmpeg (minutes of wall time, large outputs); TTS hits a paid API. Both are better surfaced as shell commands in the agent's tool belt — use `reelforge render` / `reelforge generate` / `reelforge tts` directly via Bash, and reserve MCP for **structured compilation + introspection** where returning JSON is the value.

Future: once the render pipeline supports streaming progress + cancellation, we'll add `rf_render_stream`.
