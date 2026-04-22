import { spawn } from 'node:child_process';

/**
 * Convert an arbitrary input audio file to 16 kHz mono s16 WAV — the only
 * format whisper.cpp reliably accepts. Returns once ffmpeg exits cleanly.
 */
export function buildWavConvertArgs(
  inputPath: string,
  outputPath: string,
): string[] {
  return [
    '-y',
    '-hide_banner',
    '-loglevel',
    'warning',
    '-i',
    inputPath,
    '-ar',
    '16000',
    '-ac',
    '1',
    '-c:a',
    'pcm_s16le',
    outputPath,
  ];
}

export async function convertToWhisperWav(
  ffmpegBinary: string,
  inputPath: string,
  outputPath: string,
): Promise<void> {
  const args = buildWavConvertArgs(inputPath, outputPath);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(ffmpegBinary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.once('error', (err) => reject(err));
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}\n${stderr}`));
    });
  });
}
