import { spawn } from 'node:child_process';
import { mkdir, unlink } from 'node:fs/promises';
import { dirname, join, resolve as resolvePath } from 'node:path';
import type { VideoProject } from '@reelforge/ir';
import { muxAudio } from '@reelforge/mux';
import { buildFastPathArgs, buildFastPathFfmpegArgs, FastPathError } from './filter';
import { canUseFastPath, explainFastPath } from './detect';

export interface RenderFfmpegOptions {
  project: VideoProject;
  baseDir: string;
  outputPath: string;
  ffmpegBinary?: string;
  /** Force the fast path even if `canUseFastPath` would return false. Useful for testing. */
  force?: boolean;
  onProgress?: (p: { stage: 'video' | 'audio'; label?: string }) => void;
}

export interface RenderFfmpegResult {
  outputPath: string;
  audioClipCount: number;
  durationMs: number;
}

export async function renderFfmpeg(opts: RenderFfmpegOptions): Promise<RenderFfmpegResult> {
  const { project, baseDir, outputPath } = opts;
  if (!opts.force) {
    const reason = explainFastPath(project);
    if (reason) {
      throw new FastPathError(`project not fast-path eligible: ${reason}`);
    }
  }

  const ffmpegBinary = opts.ffmpegBinary ?? 'ffmpeg';
  const outputAbs = resolvePath(outputPath);
  await mkdir(dirname(outputAbs), { recursive: true });

  const fastArgs = buildFastPathArgs(project, resolvePath(baseDir));
  const silentPath = join(dirname(outputAbs), `__fastpath_silent_${Date.now()}.mp4`);

  // Pass 1: build silent video via filter_complex.
  opts.onProgress?.({ stage: 'video' });
  const videoArgv = buildFastPathFfmpegArgs(fastArgs, silentPath);
  await runFfmpeg(ffmpegBinary, videoArgv);

  // Pass 2: mux audio on top (same logic the Chrome engine uses).
  opts.onProgress?.({ stage: 'audio' });
  const muxed = await muxAudio({
    silentVideoPath: silentPath,
    outputPath: outputAbs,
    project,
    baseDir: resolvePath(baseDir),
    ffmpegBinary,
  });

  await unlink(silentPath).catch(() => undefined);

  return {
    outputPath: outputAbs,
    audioClipCount: muxed.audioClipCount,
    durationMs: Math.round(fastArgs.durationSec * 1000),
  };
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

export { canUseFastPath, explainFastPath };
