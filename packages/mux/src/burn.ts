import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve as resolvePath } from 'node:path';

export const DEFAULT_SUBTITLE_STYLE =
  'FontName=sans-serif,FontSize=24,Alignment=2,MarginV=48,' +
  'PrimaryColour=&H00FFFFFF&,OutlineColour=&H00000000&,BackColour=&H80000000&,' +
  'BorderStyle=1,Outline=2,Shadow=0';

export interface BurnSubtitlesOptions {
  videoPath: string;
  subtitlesPath: string;
  outputPath: string;
  /** libass ASS style string, passed into `force_style`. */
  style?: string;
  ffmpegBinary?: string;
  /** x264 preset; trades speed for file size. */
  preset?: 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast' | 'medium';
  /** CRF (constant rate factor) 0–51; lower = higher quality. */
  crf?: number;
}

export interface BurnSubtitlesResult {
  outputPath: string;
}

/**
 * Escape a path so it can be embedded in ffmpeg's `-vf "subtitles='...'"`.
 * ffmpeg parses filters in two passes: the single-quoted path is passed to
 * libass, but backslashes, single-quotes, and colons must be escaped *twice*
 * because they're also meaningful in the filter-graph syntax.
 */
export function escapeFilterPath(path: string): string {
  return path
    .replace(/\\/g, '\\\\\\\\')
    .replace(/'/g, "\\\\\\'")
    .replace(/:/g, '\\\\:');
}

export function buildBurnArgs(opts: BurnSubtitlesOptions): string[] {
  const style = opts.style ?? DEFAULT_SUBTITLE_STYLE;
  const preset = opts.preset ?? 'veryfast';
  const crf = opts.crf ?? 20;
  const escapedStyle = style.replace(/'/g, "\\\\\\'");
  const escapedPath = escapeFilterPath(opts.subtitlesPath);
  const filter = `subtitles='${escapedPath}':force_style='${escapedStyle}'`;
  return [
    '-y',
    '-hide_banner',
    '-loglevel',
    'warning',
    '-i',
    opts.videoPath,
    '-vf',
    filter,
    '-c:v',
    'libx264',
    '-preset',
    preset,
    '-crf',
    String(crf),
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'copy',
    '-movflags',
    '+faststart',
    opts.outputPath,
  ];
}

export async function burnSubtitles(
  opts: BurnSubtitlesOptions,
): Promise<BurnSubtitlesResult> {
  await mkdir(dirname(resolvePath(opts.outputPath)), { recursive: true });
  const args = buildBurnArgs(opts);
  const binary = opts.ffmpegBinary ?? 'ffmpeg';
  await runFfmpeg(binary, args);
  return { outputPath: opts.outputPath };
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
