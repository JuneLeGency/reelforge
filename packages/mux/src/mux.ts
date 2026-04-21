import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve as resolvePath } from 'node:path';
import type { VideoProject } from '@reelforge/ir';
import { buildCopyArgs, buildMuxArgs } from './args';
import { collectAudioClips } from './resolve';

export interface MuxAudioOptions {
  silentVideoPath: string;
  outputPath: string;
  project: VideoProject;
  baseDir: string;
  ffmpegBinary?: string;
  audioBitrate?: string;
}

export interface MuxAudioResult {
  outputPath: string;
  audioClipCount: number;
}

export async function muxAudio(opts: MuxAudioOptions): Promise<MuxAudioResult> {
  const { silentVideoPath, outputPath, project, baseDir } = opts;
  const ffmpegBinary = opts.ffmpegBinary ?? 'ffmpeg';

  await mkdir(dirname(resolvePath(outputPath)), { recursive: true });

  const resolved = collectAudioClips(project, baseDir);

  if (resolved.length === 0) {
    await runFfmpeg(buildCopyArgs(silentVideoPath, outputPath), ffmpegBinary);
    return { outputPath, audioClipCount: 0 };
  }

  const audioInputs = resolved.map(({ clip, asset, filePath }) => ({
    filePath,
    startMs: clip.startMs,
    durationMs: clip.durationMs,
    sourceStartMs: clip.sourceStartMs ?? 0,
    volume: clip.volume ?? 1,
    // `asset` pinned so future options (e.g. per-asset gain) can flow through.
    _asset: asset,
  }));

  const args = buildMuxArgs({
    silentVideoPath,
    outputPath,
    audioInputs,
    ...(opts.audioBitrate !== undefined ? { audioBitrate: opts.audioBitrate } : {}),
  });

  await runFfmpeg(args, ffmpegBinary);

  return { outputPath, audioClipCount: resolved.length };
}

function runFfmpeg(args: string[], binary: string): Promise<void> {
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
