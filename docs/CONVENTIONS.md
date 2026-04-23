# Conventions

Don't invent new ones — stick to these so existing tooling keeps
working.

## Package manager

**Bun workspaces** only. Never run `npm install` / `pnpm install`
— both will corrupt `bun.lock`. Use:

```bash
bun install                           # all workspaces
bun run typecheck                     # all packages
bun --filter '@reelforge/*' test      # runs only our packages, skips ref/
bun --filter '@reelforge/cli' test    # single package
bun run lint                          # oxlint
bun run format                        # oxfmt (write)
```

`bun test` at the repo root includes `ref/` (competitor clones with
broken deps) — always filter to `@reelforge/*` instead.

## Test framework

`import { describe, expect, test } from 'bun:test';`

Never use `vitest` / `@jest/globals` / Node's `node:test`. Tests live
in `packages/*/src/__tests__/*.test.ts` and are picked up by bun's
filesystem scan.

Pass before every commit:
```bash
bun run typecheck && bun --filter '@reelforge/*' test
```

## Commit style

Recent examples (run `git log --oneline -10` to sanity-check before
writing a new one):

```
feat(cli): batch 1/4 — code-block / data-grid / news-title / gradient-bg
fix(engine-chrome): replace WAAPI with manual-keyframes adapter + headless 'shell' mode
docs(gaps): §7 near-term roadmap — R1-R9 scored against ref/ competitors
```

- **prefix**: `feat` / `fix` / `docs` / `test` / `refactor` / `chore`
- **scope**: package or subsystem (cli, engine-chrome, transitions,
  showcase, gaps, …)
- **subject**: one line, no period, specific. "fix WAAPI bug" is weak;
  "replace WAAPI with manual-keyframes adapter" is right.
- **body**: what & why, not how (the diff is how). Include root-cause
  for bugs; include new APIs / behaviors / test count for features.

Co-author trailer is added automatically:
```
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

Always use the HEREDOC form for multi-line messages:
```bash
git commit -m "$(cat <<'EOF'
<subject>

<body>

Co-Authored-By: …
EOF
)"
```

## CLI flag naming

citty maps kebab-case on the command line to camelCase in the args
object. **Our flag schema keys are camelCase**, so the flag itself
is `--noCaptions` not `--no-captions`.

Same pattern for: `--useBeginFrame`, `--tiktokCaptions`,
`--keepWorkdir`, `--apiKey`, `--subtitleStyle`, `--parallelism`, etc.

## Code style

- **oxlint + oxfmt** (not eslint / prettier / biome). `bun run lint`
  / `bun run format`.
- **ESM-only**. Every package sets `"type": "module"`.
- **Zod for all IR types**. TS types are `z.infer<typeof …Schema>`
  — never hand-written when a schema exists.
- **Don't create .md files unless asked**. The only docs we ship
  are the ones already tracked.
- **Don't add emojis** to code or docs unless the user explicitly
  asks. Emojis are fine in test descriptions only if the test name
  reads better that way.

## Don't commit

- `.claude/settings.local.json`
- `ref/` (competitor repos, not ours)
- `*.mp4`, `*.webm`, `*.wav` (render artifacts; already in
  `.gitignore`)
- `examples/**/__generate_*` (work dirs from `--keepWorkdir`)
- API keys, even temporarily. Environment is `.env` locally or
  via the CLI's explicit `--apiKey` flag.

## Template development

See [`TEMPLATES.md`](./TEMPLATES.md) for the full checklist. Summary:

1. One file per template in `packages/cli/src/slide-templates/`.
2. Register in `registry.ts`'s `SLIDE_TEMPLATES` + `SLIDE_TEMPLATE_CSS`.
3. Re-export from `index.ts`.
4. Update the catalog list + `resolveTemplate` assertions in
   `__tests__/slide-templates.test.ts`.
5. 2-4 shape / animation assertions per new template.
6. Animation `atMs` values are **absolute** (relative to composition
   start, not slide start). Templates multiply `spec.startMs` by
   nothing — just use it directly.
7. CSS selectors are always id-scoped: `.slide-X .title` — never
   `.title` alone.

## Showcase asset staging

`generate.ts` auto-stages any image path it finds in:
- `slide.image`
- `slide.bullets[*]` for templates `image-grid` or `ui-3d-reveal`
- `slide.extras.*` values ending in `.png/.jpg/.jpeg/.gif/.webp/.avif/.svg`
- Same recursion for `composite` children

So config authors write `"image": "../assets/hero.png"` and
`rf generate` copies it into the render workdir automatically. Don't
write manual copy scripts.

## Animation timing units

All time values **in templates and plans** are absolute milliseconds
on the composition timeline. The serialized `window.__rf.plans`
also uses absolute ms; `manual-keyframes` brackets `t` against these
values directly.

**Exception**: spring easing expansion (`spring.ts`) produces dense
keyframes, still in absolute ms, via physics sampling — you don't
need to think about this unless writing a new easing helper.

## Engine-chrome render options

Never go back to `headless: true`. It breaks seek+screenshot sync.
Use `headless: 'shell' as unknown as boolean` (puppeteer's escape
hatch for the old shell binary).
