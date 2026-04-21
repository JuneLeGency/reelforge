import { describe, expect, test } from 'bun:test';
import { charAlignmentToWordTimings, parseElevenLabsResponse } from '../index';

describe('charAlignmentToWordTimings', () => {
  test('splits on spaces and preserves per-word timing', () => {
    const chars = ['H', 'i', ' ', 'y', 'o', 'u'];
    const starts = [0.0, 0.05, 0.1, 0.12, 0.18, 0.22];
    const ends = [0.05, 0.1, 0.12, 0.18, 0.22, 0.28];
    const words = charAlignmentToWordTimings({
      characters: chars,
      character_start_times_seconds: starts,
      character_end_times_seconds: ends,
    });
    expect(words).toEqual([
      { text: 'Hi', startMs: 0, endMs: 100 },
      { text: 'you', startMs: 120, endMs: 280 },
    ]);
  });

  test('punctuation stays attached to the preceding word', () => {
    const chars = ['H', 'i', ',', ' ', 'y', 'o', 'u', '.'];
    const starts = [0, 0.05, 0.1, 0.11, 0.12, 0.18, 0.22, 0.28];
    const ends = [0.05, 0.1, 0.11, 0.12, 0.18, 0.22, 0.28, 0.3];
    const words = charAlignmentToWordTimings({
      characters: chars,
      character_start_times_seconds: starts,
      character_end_times_seconds: ends,
    });
    expect(words).toEqual([
      { text: 'Hi,', startMs: 0, endMs: 110 },
      { text: 'you.', startMs: 120, endMs: 300 },
    ]);
  });

  test('handles a single word with no whitespace', () => {
    const chars = ['H', 'e', 'l', 'l', 'o'];
    const starts = [0, 0.1, 0.2, 0.3, 0.4];
    const ends = [0.1, 0.2, 0.3, 0.4, 0.5];
    const words = charAlignmentToWordTimings({
      characters: chars,
      character_start_times_seconds: starts,
      character_end_times_seconds: ends,
    });
    expect(words).toEqual([{ text: 'Hello', startMs: 0, endMs: 500 }]);
  });

  test('swallows leading / trailing / consecutive whitespace', () => {
    const chars = [' ', 'a', ' ', ' ', 'b', '\n', 'c', ' '];
    const starts = [0, 0.1, 0.2, 0.21, 0.22, 0.3, 0.31, 0.4];
    const ends = [0.1, 0.2, 0.21, 0.22, 0.3, 0.31, 0.4, 0.5];
    const words = charAlignmentToWordTimings({
      characters: chars,
      character_start_times_seconds: starts,
      character_end_times_seconds: ends,
    });
    expect(words.map((w) => w.text)).toEqual(['a', 'b', 'c']);
  });

  test('empty input yields empty list', () => {
    expect(
      charAlignmentToWordTimings({
        characters: [],
        character_start_times_seconds: [],
        character_end_times_seconds: [],
      }),
    ).toEqual([]);
  });

  test('mismatched array lengths throw', () => {
    expect(() =>
      charAlignmentToWordTimings({
        characters: ['a', 'b'],
        character_start_times_seconds: [0],
        character_end_times_seconds: [0.1],
      }),
    ).toThrow(RangeError);
  });
});

describe('parseElevenLabsResponse', () => {
  test('decodes base64 audio, extracts word timings, and computes duration', () => {
    const audio = Buffer.from([0xff, 0xfb, 0x30, 0x40]).toString('base64');
    const result = parseElevenLabsResponse({
      audio_base64: audio,
      alignment: {
        characters: ['O', 'k'],
        character_start_times_seconds: [0, 0.2],
        character_end_times_seconds: [0.2, 0.4],
      },
    });
    expect(result.mimeType).toBe('audio/mpeg');
    expect(Buffer.isBuffer(result.audio)).toBe(true);
    expect(result.audio).toHaveLength(4);
    expect(result.durationMs).toBe(400);
    expect(result.wordTimings).toEqual([{ text: 'Ok', startMs: 0, endMs: 400 }]);
  });

  test('prefers normalized_alignment over alignment when provided', () => {
    const audio = Buffer.from([0]).toString('base64');
    const result = parseElevenLabsResponse({
      audio_base64: audio,
      alignment: {
        characters: ['A'],
        character_start_times_seconds: [0],
        character_end_times_seconds: [0.5],
      },
      normalized_alignment: {
        characters: ['A'],
        character_start_times_seconds: [0.1],
        character_end_times_seconds: [0.6],
      },
    });
    expect(result.wordTimings).toEqual([{ text: 'A', startMs: 100, endMs: 600 }]);
  });

  test('no alignment → no wordTimings, duration 0', () => {
    const audio = Buffer.from([0]).toString('base64');
    const result = parseElevenLabsResponse({ audio_base64: audio, alignment: null });
    expect(result.wordTimings).toBeUndefined();
    expect(result.durationMs).toBe(0);
  });
});
