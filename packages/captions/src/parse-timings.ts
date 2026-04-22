/**
 * Parsers for external word-level timing files. Reelforge treats word
 * timings as the **master signal** driving slide cuts, caption overlays,
 * and TikTok-style highlights. This module turns the most common
 * interchange formats (per-word SRT, Whisper JSON, ElevenLabs alignment)
 * into the canonical `WordTiming[]` shape.
 */
import type { WordTiming } from './types';
import { parseSrt } from './srt';

export interface WhisperWord {
  word: string;
  start: number; // seconds
  end: number; // seconds
}

/**
 * Shape produced by `whisper.cpp ... -oj` (JSON output), `openai-whisper`
 * CLI with `--word_timestamps True`, and most web services that quote
 * Whisper's data model.
 */
export interface WhisperJson {
  text?: string;
  language?: string;
  segments?: Array<{
    text?: string;
    words?: WhisperWord[];
    /** whisper.cpp emits `start` and `end` at the segment level too. */
    start?: number;
    end?: number;
  }>;
  /** Some implementations flatten all words at the top level. */
  words?: WhisperWord[];
}

/**
 * Take the raw text of an external file (SRT or Whisper-style JSON) and
 * return `WordTiming[]`. Format is auto-detected by a trimmed leading
 * character heuristic — `{` or `[` → JSON, else SRT.
 */
export function parseTimingsText(source: string): WordTiming[] {
  const trimmed = source.trimStart();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return parseWhisperJsonText(source);
  }
  return parseWordLevelSrt(source);
}

/**
 * Parse a *word-level* SRT into `WordTiming[]`. Each cue is one word;
 * multi-word cues are split on whitespace and sub-timings are linearly
 * interpolated. A phrase-level SRT (sentence per cue) will therefore
 * yield one `WordTiming` per word with approximated boundaries, which is
 * usually fine for slide cuts but sub-optimal for per-word highlights.
 */
export function parseWordLevelSrt(srt: string): WordTiming[] {
  const cues = parseSrt(srt);
  const timings: WordTiming[] = [];
  for (const cue of cues) {
    const words = cue.text
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => w !== '');
    if (words.length === 0) continue;
    if (words.length === 1) {
      timings.push({ text: words[0]!, startMs: cue.startMs, endMs: cue.endMs });
      continue;
    }
    const span = cue.endMs - cue.startMs;
    const per = span / words.length;
    for (let i = 0; i < words.length; i++) {
      timings.push({
        text: words[i]!,
        startMs: Math.round(cue.startMs + per * i),
        endMs: Math.round(cue.startMs + per * (i + 1)),
      });
    }
  }
  return timings;
}

/**
 * Parse a Whisper JSON blob (stringified) into `WordTiming[]`.
 * Accepts both `{segments: [{words: [...]}]}` and `{words: [...]}`.
 */
export function parseWhisperJsonText(source: string): WordTiming[] {
  let data: unknown;
  try {
    data = JSON.parse(source);
  } catch (err) {
    throw new TimingsParseError(
      `Could not parse timings JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  return parseWhisperJson(data);
}

/**
 * Normalize a parsed Whisper-style object into `WordTiming[]`.
 */
export function parseWhisperJson(data: unknown): WordTiming[] {
  if (data === null || typeof data !== 'object') {
    throw new TimingsParseError('Whisper JSON must be an object');
  }
  const obj = data as WhisperJson;
  const words = collectWhisperWords(obj);
  if (words.length === 0) {
    throw new TimingsParseError(
      'No word-level timings found — pass `--word_timestamps True` to whisper, or `-oj -pp` to whisper.cpp',
    );
  }
  return words.map((w) => ({
    text: (w.word ?? '').trim(),
    startMs: Math.round((w.start ?? 0) * 1000),
    endMs: Math.round((w.end ?? w.start ?? 0) * 1000),
  }));
}

export class TimingsParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimingsParseError';
  }
}

function collectWhisperWords(obj: WhisperJson): WhisperWord[] {
  if (Array.isArray(obj.words) && obj.words.length > 0) return obj.words;
  const collected: WhisperWord[] = [];
  for (const seg of obj.segments ?? []) {
    if (Array.isArray(seg.words)) collected.push(...seg.words);
  }
  return collected;
}
