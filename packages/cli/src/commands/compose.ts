import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve as resolvePath } from 'node:path';
import { spawnSync } from 'node:child_process';
import { defineCommand, runCommand } from 'citty';
import { generateCommand } from './generate';
import { resolveChrome } from '../util/chrome';

/**
 * Compose stitches multiple independently-rendered scenes into one
 * final MP4. Each scene is a full `generate` config — narration, slides,
 * captions, the works — rendered separately, then concatenated.
 *
 * This is the "Remotion <Composition>" / "Hyperframes data-composition-id"
 * equivalent for Reelforge: agents can author one scene at a time,
 * reuse them, and compose them without changing the IR or engine.
 *
 * Scope (MVP):
 *   - No inter-scene visual transitions (use per-slide chrome effects
 *     at the last slide of each scene for that).
 *   - Concat demuxer with stream copy → requires scenes to share
 *     resolution / fps / codec. Enforced by rendering every scene
 *     through the same `rf generate` pipeline with consistent flags.
 */

export interface ComposeSceneEntry {
  /** Path to the scene's generate config (absolute or relative to the compose config). */
  config: string;
  /** Optional --audio override passed to generate. */
  audio?: string | undefined;
  /** Optional --timings override. */
  timings?: string | undefined;
  /** Optional --template override. */
  template?: string | undefined;
  /** Optional --style override. */
  style?: string | undefined;
}

export interface ComposeConfig {
  scenes: ComposeSceneEntry[];
}

export class ComposeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ComposeConfigError';
  }
}

export function parseComposeConfig(raw: unknown): ComposeConfig {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new ComposeConfigError('config must be a JSON object');
  }
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.scenes) || r.scenes.length === 0) {
    throw new ComposeConfigError('config.scenes must be a non-empty array');
  }
  const scenes: ComposeSceneEntry[] = [];
  for (const [i, entry] of (r.scenes as unknown[]).entries()) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new ComposeConfigError(`config.scenes[${i}] must be an object`);
    }
    const s = entry as Record<string, unknown>;
    if (typeof s.config !== 'string' || s.config === '') {
      throw new ComposeConfigError(
        `config.scenes[${i}].config must be a non-empty string (path to a generate config)`,
      );
    }
    for (const key of ['audio', 'timings', 'template', 'style']) {
      if (s[key] !== undefined && typeof s[key] !== 'string') {
        throw new ComposeConfigError(
          `config.scenes[${i}].${key} must be a string`,
        );
      }
    }
    scenes.push({
      config: s.config,
      ...(typeof s.audio === 'string' && s.audio !== '' ? { audio: s.audio } : {}),
      ...(typeof s.timings === 'string' && s.timings !== '' ? { timings: s.timings } : {}),
      ...(typeof s.template === 'string' && s.template !== '' ? { template: s.template } : {}),
      ...(typeof s.style === 'string' && s.style !== '' ? { style: s.style } : {}),
    });
  }
  return { scenes };
}

/**
 * Build the ffmpeg concat demuxer list-file body for a sequence of
 * scene MP4 paths. ffmpeg needs absolute paths OR `-safe 0` + relative.
 * We emit absolute paths and quote-escape single quotes.
 */
export function buildConcatList(absMp4Paths: readonly string[]): string {
  return (
    absMp4Paths
      .map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
      .join('\n') + '\n'
  );
}

export const composeCommand = defineCommand({
  meta: {
    name: 'compose',
    description:
      'Compose a multi-scene video: render N scenes (each via `generate`) then concatenate into one MP4.',
  },
  args: {
    config: {
      type: 'positional',
      description: 'Compose config JSON (points to per-scene generate configs)',
      required: true,
    },
    output: {
      type: 'string',
      alias: 'o',
      description: 'Output MP4 path',
      default: 'out/composed.mp4',
    },
    chrome: {
      type: 'string',
      description: 'Chrome/Chromium executable path (default: auto-detect)',
    },
    ffmpeg: {
      type: 'string',
      description: 'ffmpeg binary',
      default: 'ffmpeg',
    },
    apiKey: {
      type: 'string',
      description: 'ElevenLabs API key (forwarded to each scene, if needed)',
    },
    parallelism: {
      type: 'string',
      description: 'Per-scene Chrome worker count (forwarded to generate)',
      default: '1',
    },
    keepWorkdir: {
      type: 'boolean',
      description: 'Keep the intermediate per-scene MP4s and concat list',
      default: false,
    },
    noCaptions: {
      type: 'boolean',
      description: 'Forwarded to generate — suppress DOM captions for all scenes',
      default: false,
    },
  },
  async run({ args }) {
    const composeConfigPath = resolvePath(args.config);
    const composeConfigDir = dirname(composeConfigPath);
    const raw = JSON.parse(await readFile(composeConfigPath, 'utf8')) as unknown;
    const config = parseComposeConfig(raw);

    const chromePath =
      args.chrome ?? resolveChrome({ envValue: process.env.CHROME_PATH });
    if (!chromePath) {
      console.error('Could not find Chrome/Chromium. Pass --chrome <path>.');
      process.exit(2);
    }

    const outputPath = resolvePath(args.output);
    await mkdir(dirname(outputPath), { recursive: true });
    const workdir = await mkdtemp(join(tmpdir(), 'rf-compose-'));

    const sceneMp4s: string[] = [];
    for (let i = 0; i < config.scenes.length; i++) {
      const scene = config.scenes[i]!;
      const sceneConfigAbs = isAbsolute(scene.config)
        ? scene.config
        : resolvePath(composeConfigDir, scene.config);
      const sceneOut = join(workdir, `scene-${String(i).padStart(3, '0')}.mp4`);
      const rawArgs: string[] = [
        sceneConfigAbs,
        '--output',
        sceneOut,
        '--chrome',
        chromePath,
        '--ffmpeg',
        args.ffmpeg,
        '--parallelism',
        args.parallelism,
      ];
      if (args.apiKey) rawArgs.push('--api-key', args.apiKey);
      if (args.noCaptions) rawArgs.push('--no-captions');
      if (scene.audio) rawArgs.push('--audio', scene.audio);
      if (scene.timings) rawArgs.push('--timings', scene.timings);
      if (scene.template) rawArgs.push('--template', scene.template);
      if (scene.style) rawArgs.push('--style', scene.style);

      console.error(`→ scene ${i + 1}/${config.scenes.length}: ${scene.config}`);
      await runCommand(generateCommand, { rawArgs });
      sceneMp4s.push(sceneOut);
    }

    const listPath = join(workdir, 'concat.txt');
    await writeFile(listPath, buildConcatList(sceneMp4s), 'utf8');

    console.error(`→ concatenating ${sceneMp4s.length} scene(s) → ${outputPath}`);
    const res = spawnSync(
      args.ffmpeg,
      ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', outputPath],
      { stdio: 'inherit' },
    );
    if (res.status !== 0) {
      console.error(
        'ffmpeg concat failed (scenes may have mismatched codec/fps/resolution). ' +
          'Consider re-encoding each scene with identical settings.',
      );
      process.exit(res.status ?? 3);
    }

    if (!args.keepWorkdir) {
      await rm(workdir, { recursive: true, force: true });
    } else {
      console.error(`  workdir kept: ${workdir}`);
    }

    console.error(`✓ ${outputPath}`);
  },
});
