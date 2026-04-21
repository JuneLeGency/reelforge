import type { WordTiming } from '@reelforge/captions';

export interface CharacterAlignment {
  characters: readonly string[];
  character_start_times_seconds: readonly number[];
  character_end_times_seconds: readonly number[];
}

const WHITESPACE = /\s/;

/**
 * Reduce ElevenLabs' character-level alignment into word-level timings.
 *
 * - Whitespace (space / newline / tab) delimits words.
 * - Punctuation stays attached to whatever word it trailed (matches the text).
 * - A word's `startMs` is the start of its first non-whitespace char, `endMs`
 *   the end of its last.
 */
export function charAlignmentToWordTimings(a: CharacterAlignment): WordTiming[] {
  const { characters, character_start_times_seconds: starts, character_end_times_seconds: ends } = a;
  if (characters.length !== starts.length || characters.length !== ends.length) {
    throw new RangeError(
      'ElevenLabs alignment arrays are misaligned — characters/starts/ends must be same length',
    );
  }

  const words: WordTiming[] = [];
  let buffer = '';
  let currentStart: number | null = null;
  let currentEnd = 0;

  for (let i = 0; i < characters.length; i++) {
    const char = characters[i]!;
    const start = starts[i]!;
    const end = ends[i]!;

    if (WHITESPACE.test(char)) {
      if (buffer !== '' && currentStart !== null) {
        words.push({
          text: buffer,
          startMs: Math.round(currentStart * 1000),
          endMs: Math.round(currentEnd * 1000),
        });
      }
      buffer = '';
      currentStart = null;
      continue;
    }

    if (currentStart === null) currentStart = start;
    buffer += char;
    currentEnd = end;
  }

  if (buffer !== '' && currentStart !== null) {
    words.push({
      text: buffer,
      startMs: Math.round(currentStart * 1000),
      endMs: Math.round(currentEnd * 1000),
    });
  }

  return words;
}
