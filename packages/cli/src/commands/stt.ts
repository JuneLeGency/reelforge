import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve as resolvePath } from 'node:path';
import { defineCommand } from 'citty';
import { captionsToSrt, wordTimingsToCaptions } from '@reelforge/captions';
import { createWhisperCppProvider } from '@reelforge/providers-stt-whisper';

/**
 * Standalone speech-to-text command. Mirrors `reelforge tts` in spirit:
 * takes an audio file, produces word-level timings. Useful for
 *
 *   1. preparing `timings` ahead of time so `generate` can run byo-full
 *      without configuring WHISPER_* on every invocation,
 *   2. transcribing a recording for any downstream pipeline — the SRT is
 *      a standard interchange format.
 *
 * Output formats:
 *   - `.srt`  (default) — one cue per word, ready for reelforge generate
 *   - `.json`           — Whisper-style JSON (segments[0].words[])
 *   - `.txt`            — plain transcript, no timings
 */
export const sttCommand = defineCommand({
  meta: {
    name: 'stt',
    description: 'Transcribe an audio file to word-level timings (whisper.cpp)',
  },
  args: {
    input: {
      type: 'positional',
      description: 'Audio file to transcribe (mp3/wav/flac/…)',
      required: true,
    },
    output: {
      type: 'string',
      alias: 'o',
      description: 'Output path. Extension picks format: .srt / .json / .txt',
      default: '',
    },
    format: {
      type: 'string',
      description: 'Force output format: srt / json / txt. Overrides extension.',
      default: '',
    },
    whisperBinary: {
      type: 'string',
      description: 'whisper.cpp binary (defaults to $WHISPER_BINARY)',
    },
    whisperModel: {
      type: 'string',
      description: 'ggml whisper model path (defaults to $WHISPER_MODEL)',
    },
    lang: {
      type: 'string',
      description: 'Language hint (e.g. en, zh). Empty → auto-detect.',
      default: '',
    },
    ffmpeg: {
      type: 'string',
      description: 'ffmpeg binary used to convert input to 16 kHz mono wav',
      default: 'ffmpeg',
    },
  },
  async run({ args }) {
    const binary =
      (typeof args.whisperBinary === 'string' && args.whisperBinary !== ''
        ? args.whisperBinary
        : undefined) ?? process.env.WHISPER_BINARY;
    const model =
      (typeof args.whisperModel === 'string' && args.whisperModel !== ''
        ? args.whisperModel
        : undefined) ?? process.env.WHISPER_MODEL;
    if (!binary || !model) {
      console.error(
        'Missing whisper configuration. Pass --whisper-binary + --whisper-model, or set $WHISPER_BINARY + $WHISPER_MODEL.',
      );
      process.exit(2);
    }

    const inputAbs = resolvePath(args.input);
    const lang = typeof args.lang === 'string' ? args.lang : '';

    const stt = createWhisperCppProvider({
      whisperBinary: binary,
      modelPath: model,
      ffmpegBinary: args.ffmpeg,
    });

    console.error(`→ transcribing ${inputAbs}`);
    const result = await stt.transcribe({
      audioPath: inputAbs,
      ...(lang !== '' ? { language: lang } : {}),
    });
    const wordCount = result.wordTimings.length;
    const durationSec =
      wordCount > 0 ? (result.wordTimings[wordCount - 1]!.endMs / 1000).toFixed(2) : '0';
    console.error(`  ✓ ${wordCount} words, ${durationSec}s`);

    const format = pickFormat(args.format, args.output, inputAbs);
    const outPath = resolveOutPath(args.output, inputAbs, format);
    await mkdir(dirname(outPath), { recursive: true });

    if (format === 'srt') {
      const captions = wordTimingsToCaptions(result.wordTimings);
      await writeFile(outPath, captionsToSrt(captions), 'utf8');
    } else if (format === 'json') {
      const payload = {
        text: result.text,
        language: result.language ?? null,
        segments: [
          {
            start: 0,
            end: (result.wordTimings.at(-1)?.endMs ?? 0) / 1000,
            text: result.text,
            words: result.wordTimings.map((w) => ({
              word: w.text,
              start: w.startMs / 1000,
              end: w.endMs / 1000,
            })),
          },
        ],
      };
      await writeFile(outPath, JSON.stringify(payload, null, 2), 'utf8');
    } else {
      // txt
      await writeFile(outPath, result.text + '\n', 'utf8');
    }
    console.error(`✓ ${outPath}`);
  },
});

function pickFormat(
  forcedFormat: string,
  outputPath: string,
  inputPath: string,
): 'srt' | 'json' | 'txt' {
  if (forcedFormat === 'srt' || forcedFormat === 'json' || forcedFormat === 'txt') {
    return forcedFormat;
  }
  const probe = outputPath === '' ? inputPath : outputPath;
  const ext = probe.toLowerCase().slice(probe.lastIndexOf('.') + 1);
  if (ext === 'json') return 'json';
  if (ext === 'txt') return 'txt';
  return 'srt';
}

function resolveOutPath(
  rawOutput: string,
  inputPath: string,
  format: 'srt' | 'json' | 'txt',
): string {
  if (rawOutput !== '') return resolvePath(rawOutput);
  const base = inputPath.replace(/\.[^.]+$/, '');
  return resolvePath(`${base}.${format}`);
}
