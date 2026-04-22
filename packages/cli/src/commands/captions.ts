import { readFile, writeFile } from 'node:fs/promises';
import { resolve as resolvePath } from 'node:path';
import { defineCommand } from 'citty';
import {
  captionsToSrt,
  createTikTokStyleCaptions,
  parseSrt,
  parseTimingsText,
  wordTimingsToCaptions,
  type Caption,
} from '@reelforge/captions';

/**
 * Utility command for working with caption + timing files. Three
 * sub-features, selected by --to:
 *
 *   info   (default)   — print summary stats about the input file
 *   srt                — convert any input to word-level SRT
 *   json               — convert to Whisper-style {segments:[{words:[...]}]}
 *   tiktok             — convert to TikTokPage[] JSON (ready for
 *                        buildGenerateHtml's tikTokPages option)
 */
export const captionsCommand = defineCommand({
  meta: {
    name: 'captions',
    description: 'Inspect / convert caption + timing files (SRT ↔ Whisper JSON ↔ TikTok pages)',
  },
  args: {
    input: {
      type: 'positional',
      description: 'SRT or Whisper JSON file',
      required: true,
    },
    to: {
      type: 'string',
      description: 'Output format: info (default) / srt / json / tiktok',
      default: 'info',
    },
    output: {
      type: 'string',
      alias: 'o',
      description: 'Output path. Defaults to stdout.',
      default: '',
    },
    threshold: {
      type: 'string',
      description: 'TikTok grouping threshold in ms (only for --to tiktok)',
      default: '1200',
    },
  },
  async run({ args }) {
    const inputAbs = resolvePath(args.input);
    const raw = await readFile(inputAbs, 'utf8');
    const wordTimings = parseTimingsText(raw);

    const mode = args.to as 'info' | 'srt' | 'json' | 'tiktok';

    if (mode === 'info') {
      printInfo(inputAbs, raw, wordTimings);
      return;
    }

    let body: string;
    if (mode === 'srt') {
      const captions = wordTimingsToCaptions(wordTimings);
      body = captionsToSrt(captions);
    } else if (mode === 'json') {
      body = JSON.stringify(
        {
          segments: [
            {
              start: 0,
              end: (wordTimings.at(-1)?.endMs ?? 0) / 1000,
              text: wordTimings.map((w) => w.text).join(''),
              words: wordTimings.map((w) => ({
                word: w.text,
                start: w.startMs / 1000,
                end: w.endMs / 1000,
              })),
            },
          ],
        },
        null,
        2,
      );
    } else if (mode === 'tiktok') {
      const captions = wordTimingsToCaptions(wordTimings);
      const thresholdMs = Number.parseInt(args.threshold, 10);
      const { pages } = createTikTokStyleCaptions({
        captions,
        combineTokensWithinMs: Number.isFinite(thresholdMs) ? thresholdMs : 1200,
      });
      body = JSON.stringify({ pages }, null, 2);
    } else {
      console.error(`Unknown --to value "${mode}". Use info / srt / json / tiktok.`);
      process.exit(2);
    }

    if (args.output === '') {
      process.stdout.write(body);
      if (!body.endsWith('\n')) process.stdout.write('\n');
    } else {
      const outPath = resolvePath(args.output);
      await writeFile(outPath, body, 'utf8');
      console.error(`✓ ${outPath}`);
    }
  },
});

function printInfo(path: string, raw: string, words: readonly { text: string; startMs: number; endMs: number }[]) {
  const detected = detectFormat(raw);
  const srtCues = detected === 'srt' ? parseSrt(raw) : null;
  const durationMs = words.at(-1)?.endMs ?? 0;
  const durationSec = (durationMs / 1000).toFixed(2);
  const phraseCount = srtCues?.length ?? 0;
  const text = words.map((w) => w.text).join(' ');

  console.log(`file:     ${path}`);
  console.log(`format:   ${detected}`);
  console.log(`duration: ${durationSec}s`);
  console.log(`words:    ${words.length}`);
  if (srtCues) {
    console.log(`cues:     ${phraseCount} (SRT phrase-level entries)`);
  }
  console.log('');
  console.log('--- text ---');
  console.log(truncate(text, 400));
  if (words.length > 0) {
    console.log('');
    console.log('--- sample timings ---');
    const sample = sampleTimings(words);
    for (const w of sample) {
      console.log(`  [${formatTime(w.startMs)}→${formatTime(w.endMs)}] ${w.text}`);
    }
  }
}

function detectFormat(raw: string): 'srt' | 'whisper-json' {
  const trimmed = raw.trimStart();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'whisper-json';
  return 'srt';
}

function sampleTimings(
  words: readonly { text: string; startMs: number; endMs: number }[],
): readonly { text: string; startMs: number; endMs: number }[] {
  if (words.length <= 6) return words;
  const ends = [words[0]!, words[1]!, words[2]!];
  const starts = [words.at(-3)!, words.at(-2)!, words.at(-1)!];
  const middle = words[Math.floor(words.length / 2)]!;
  return [...ends, { text: '…', startMs: middle.startMs, endMs: middle.endMs }, ...starts];
}

function formatTime(ms: number): string {
  const totalSec = ms / 1000;
  const m = Math.floor(totalSec / 60);
  const s = (totalSec - m * 60).toFixed(2);
  return `${m}:${s.padStart(5, '0')}`;
}

function truncate(s: string, limit: number): string {
  if (s.length <= limit) return s;
  return s.slice(0, limit - 1) + '…';
}

// Re-export for type ergonomics in tests.
export type { Caption };
