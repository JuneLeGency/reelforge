import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve as resolvePath } from 'node:path';
import type { WordTiming } from '@reelforge/captions';
import { parseWhisperJson } from '@reelforge/captions';
import { convertToWhisperWav } from './convert';
import { buildWhisperArgs } from './whisper-args';
import type { STTInput, STTProvider, STTResult } from './types';

export interface WhisperCppProviderOptions {
  /** Absolute path to the whisper.cpp binary (`main` / `whisper-cpp`). */
  whisperBinary: string;
  /** Absolute path to a ggml model file (ggml-base.en.bin, ggml-small.bin, …). */
  modelPath: string;
  /** ffmpeg binary used for the 16kHz mono wav conversion. Defaults to `ffmpeg`. */
  ffmpegBinary?: string;
  /** Extra whisper.cpp flags (e.g. ['-t', '8']). */
  extraArgs?: readonly string[];
}

export class WhisperProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WhisperProviderError';
  }
}

export function createWhisperCppProvider(opts: WhisperCppProviderOptions): STTProvider {
  if (!opts.whisperBinary) {
    throw new WhisperProviderError('whisperBinary is required');
  }
  if (!opts.modelPath) {
    throw new WhisperProviderError('modelPath is required');
  }

  return {
    id: 'whisper-cpp',
    async transcribe(input: STTInput): Promise<STTResult> {
      const audioAbs = resolvePath(input.audioPath);
      const workdir = await mkdtemp(join(tmpdir(), 'reelforge-whisper-'));
      try {
        const wavPath = join(workdir, 'audio.wav');
        await convertToWhisperWav(opts.ffmpegBinary ?? 'ffmpeg', audioAbs, wavPath);

        const outputPrefix = join(workdir, 'out');
        const whisperArgs = buildWhisperArgs({
          modelPath: opts.modelPath,
          wavPath,
          outputPrefix,
          ...(input.language !== undefined ? { language: input.language } : {}),
          ...(opts.extraArgs ? { extraArgs: opts.extraArgs } : {}),
        });
        await runWhisper(opts.whisperBinary, whisperArgs);

        const jsonPath = `${outputPrefix}.json`;
        const raw = await readFile(jsonPath, 'utf8');
        const data = JSON.parse(raw) as unknown;
        const wordTimings: WordTiming[] = parseWhisperJson(
          normalizeWhisperCppJson(data),
        );
        return {
          wordTimings,
          text: wordTimings.map((w) => w.text).join(' '),
          ...(typeof (data as { language?: string }).language === 'string'
            ? { language: (data as { language?: string }).language! }
            : {}),
        };
      } finally {
        await rm(workdir, { recursive: true, force: true }).catch(() => undefined);
      }
    },
  };
}

/**
 * whisper.cpp's JSON output nests words under `transcription[].offsets.from/to`
 * (integer ms, not seconds), which differs slightly from the openai-whisper
 * shape that `parseWhisperJson` understands. Normalize to the canonical
 * `{ segments: [{ words: [{ word, start, end }] }] }` layout.
 *
 * When the input already matches (openai-whisper style), this function is
 * a near no-op — it returns the object unchanged.
 */
export function normalizeWhisperCppJson(raw: unknown): unknown {
  if (raw === null || typeof raw !== 'object') return raw;
  const obj = raw as Record<string, unknown>;
  // Already openai-style.
  if (Array.isArray(obj.segments) || Array.isArray(obj.words)) return raw;
  // whisper.cpp emits `transcription: [{ offsets: { from, to }, text }, ...]`.
  const transcription = obj.transcription;
  if (!Array.isArray(transcription)) return raw;
  const words = transcription
    .map((entry) => {
      const e = entry as {
        offsets?: { from?: number; to?: number };
        text?: string;
      };
      const fromMs = e.offsets?.from ?? 0;
      const toMs = e.offsets?.to ?? fromMs;
      return {
        word: e.text ?? '',
        start: fromMs / 1000,
        end: toMs / 1000,
      };
    })
    .filter((w) => w.word.trim() !== '' && !/^\[.*\]$/.test(w.word.trim()));
  return { words };
}

function runWhisper(binary: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.once('error', (err) => reject(err));
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else reject(new WhisperProviderError(`whisper exited with code ${code}\n${stderr}`));
    });
  });
}
