# skills/

Agent instruction packs for Reelforge. Each subdirectory is a self-contained "skill" that another AI coding agent (Claude Code, Cursor, Codex CLI) can load as context before writing Reelforge compositions or invoking the CLI.

## Skills

| Skill | Purpose |
|---|---|
| [`reelforge/`](./reelforge) | Core mental model: IR, HTML authoring, WAAPI captions, library-clock adapters, common failure modes |
| [`reelforge-dsl/`](./reelforge-dsl) | Writing declarative JSON5 configs (clips, layers, titles, audio tracks) |
| [`reelforge-cli/`](./reelforge-cli) | Full CLI reference — every flag for every subcommand |

## Using these

With Claude Code, copy the contents of a `SKILL.md` as context:

```bash
# One-liner: prepend the main skill to your next prompt
cat skills/reelforge/SKILL.md | pbcopy   # macOS
```

Or once the agent-skills ecosystem matures (npm `skills add` style), these directories will install directly as slash commands.

## File format

Each skill is a single `SKILL.md` with YAML frontmatter:

```yaml
---
name: reelforge
description: (one paragraph — when the agent should load this skill)
---

# Body of the skill
```

Keep descriptions concrete and trigger-y. "Use when the user asks to render a video" rather than "comprehensive video framework documentation".
