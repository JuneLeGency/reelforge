import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

export interface FfmpegImagePipeOptions {
  fps: number;
  outputPath: string;
  /** Input frame codec; 'png' is what `page.screenshot()` produces. */
  inputCodec?: 'png' | 'mjpeg';
  /** Output video codec. */
  videoCodec?: 'libx264' | 'libx265' | 'libvpx-vp9';
  /** x264 preset; higher speed → faster encode, bigger file. */
  preset?: 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast' | 'medium';
  /** Extra args injected right before the output path (escape hatch). */
  extraArgs?: string[];
}

/**
 * Build the ffmpeg argv for an image2pipe encode.
 *
 * Usage: `spawn('ffmpeg', buildImagePipeArgs({...}))`.
 */
export function buildImagePipeArgs(opts: FfmpegImagePipeOptions): string[] {
  const inputCodec = opts.inputCodec ?? 'png';
  const videoCodec = opts.videoCodec ?? 'libx264';
  const preset = opts.preset ?? 'veryfast';
  const extra = opts.extraArgs ?? [];
  return [
    '-y',
    '-hide_banner',
    '-loglevel',
    'warning',
    '-f',
    'image2pipe',
    '-framerate',
    String(opts.fps),
    '-vcodec',
    inputCodec,
    '-i',
    '-',
    '-pix_fmt',
    'yuv420p',
    '-vcodec',
    videoCodec,
    '-preset',
    preset,
    '-movflags',
    '+faststart',
    ...extra,
    opts.outputPath,
  ];
}

export interface FfmpegProcess {
  readonly child: ChildProcessWithoutNullStreams;
  write(frame: Buffer): Promise<void>;
  finish(): Promise<void>;
}

/**
 * Start ffmpeg with an image2pipe input and return a Promise-friendly handle.
 * `write(frame)` resolves when the chunk has been flushed (handles backpressure).
 * `finish()` resolves on a clean exit code 0; rejects with stderr on failure.
 */
export function spawnImagePipeFfmpeg(
  opts: FfmpegImagePipeOptions,
  binary = 'ffmpeg',
): FfmpegProcess {
  const args = buildImagePipeArgs(opts);
  const child = spawn(binary, args, { stdio: ['pipe', 'pipe', 'pipe'] });

  let stderrBuffer = '';
  child.stderr.on('data', (chunk: Buffer) => {
    stderrBuffer += chunk.toString('utf8');
  });

  const write = (frame: Buffer): Promise<void> =>
    new Promise((resolve, reject) => {
      const ok = child.stdin.write(frame, (err) => {
        if (err) reject(err);
      });
      if (ok) resolve();
      else child.stdin.once('drain', () => resolve());
    });

  const finish = (): Promise<void> =>
    new Promise((resolve, reject) => {
      child.stdin.end(() => {
        child.once('exit', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`ffmpeg exited with code ${code}\n${stderrBuffer}`));
        });
        child.once('error', (err) => reject(err));
      });
    });

  return { child, write, finish };
}
