/**
 * Parallel-segment rendering for @reelforge/engine-chrome.
 *
 * Strategy: split the [0..totalFrames) range into N contiguous segments,
 * run `renderChrome` once per segment (each launches its own Chrome +
 * ffmpeg), and merge the resulting silent mp4 shards with ffmpeg's
 * `concat` demuxer (`-c copy`, no re-encode).
 *
 * Because each worker uses the same frame-step and the IR's library-clock
 * is deterministic, shard boundaries are seamless — a frame at `segment
 * boundary - 1` from shard[i] plus the frame at `segment boundary` from
 * shard[i+1] reconstruct the same sequence as a single-worker render.
 */
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve as resolvePath } from 'node:path';
import type { VideoProject } from '@reelforge/ir';
import { planDuration } from '@reelforge/ir';
import {
  renderChrome,
  type RenderChromeOptions,
  type RenderChromeResult,
} from './render';

export interface RenderChromeParallelOptions
  extends Omit<
    RenderChromeOptions,
    'frameStart' | 'frameEnd' | 'outputPath' | 'onProgress'
  > {
  outputPath: string;
  /** Number of concurrent Chrome workers. Defaults to 4. */
  parallelism?: number;
  /** Progress callback aggregated across all shards. */
  onProgress?: (p: { frame: number; total: number; shard: number }) => void;
}

/**
 * Planned frame segments — exposed for tests and observability.
 */
export interface FrameSegment {
  shard: number;
  frameStart: number; // inclusive
  frameEnd: number; // exclusive
}

export function planSegments(totalFrames: number, parallelism: number): FrameSegment[] {
  const workers = Math.max(1, Math.min(parallelism, totalFrames));
  const segments: FrameSegment[] = [];
  // Even-ish distribution: earlier shards pick up the remainder one frame at a time.
  const base = Math.floor(totalFrames / workers);
  const extra = totalFrames % workers;
  let cursor = 0;
  for (let i = 0; i < workers; i++) {
    const size = base + (i < extra ? 1 : 0);
    segments.push({ shard: i, frameStart: cursor, frameEnd: cursor + size });
    cursor += size;
  }
  return segments;
}

export async function renderChromeParallel(
  opts: RenderChromeParallelOptions,
): Promise<RenderChromeResult> {
  const durationMs = planDuration(opts.project);
  const totalFrames =
    opts.frameCount ??
    Math.max(1, Math.ceil((durationMs / 1000) * opts.project.config.fps));
  const parallelism = Math.max(1, opts.parallelism ?? 4);
  const segments = planSegments(totalFrames, parallelism);

  const finalOutput = resolvePath(opts.outputPath);
  await mkdir(dirname(finalOutput), { recursive: true });

  const workdir = await mkdtemp(join(tmpdir(), 'reelforge-parallel-'));
  try {
    const completed = new Array<number>(segments.length).fill(0);

    const shardResults = await Promise.all(
      segments.map(async (seg) => {
        const shardPath = join(workdir, `shard_${seg.shard}.mp4`);
        return renderChrome({
          ...opts,
          outputPath: shardPath,
          frameStart: seg.frameStart,
          frameEnd: seg.frameEnd,
          frameCount: totalFrames,
          onProgress: ({ frame }) => {
            completed[seg.shard] = frame;
            const totalCompleted = completed.reduce((a, b) => a + b, 0);
            opts.onProgress?.({
              frame: totalCompleted,
              total: totalFrames,
              shard: seg.shard,
            });
          },
        });
      }),
    );

    await concatMp4Shards(
      shardResults.map((r) => r.outputPath),
      finalOutput,
      opts.ffmpegBinary ?? 'ffmpeg',
      workdir,
    );
  } finally {
    await rm(workdir, { recursive: true, force: true }).catch(() => undefined);
  }

  return { outputPath: finalOutput, frameCount: totalFrames, durationMs };
}

/**
 * ffmpeg concat-demuxer merge. Requires every shard to share codec +
 * container params (which they do — same renderChrome code emitted them).
 */
export async function concatMp4Shards(
  shardPaths: readonly string[],
  outputPath: string,
  ffmpegBinary: string,
  workdir: string,
): Promise<void> {
  if (shardPaths.length === 0) {
    throw new Error('concatMp4Shards: need at least one shard');
  }
  if (shardPaths.length === 1) {
    // Single shard — just re-mux to the final path (stream copy).
    await runFfmpeg(ffmpegBinary, [
      '-y',
      '-hide_banner',
      '-loglevel',
      'warning',
      '-i',
      shardPaths[0]!,
      '-c',
      'copy',
      outputPath,
    ]);
    return;
  }

  const listPath = join(workdir, 'concat.txt');
  const body = shardPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n') + '\n';
  await writeFile(listPath, body, 'utf8');

  await runFfmpeg(ffmpegBinary, [
    '-y',
    '-hide_banner',
    '-loglevel',
    'warning',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    listPath,
    '-c',
    'copy',
    '-movflags',
    '+faststart',
    outputPath,
  ]);
}

function runFfmpeg(binary: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr?.on('data', (c: Buffer) => {
      stderr += c.toString('utf8');
    });
    child.once('error', (err) => reject(err));
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}\n${stderr}`));
    });
  });
}
