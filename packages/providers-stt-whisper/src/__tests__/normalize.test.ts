import { describe, expect, test } from 'bun:test';
import { parseWhisperJson } from '@reelforge/captions';
import { createWhisperCppProvider, normalizeWhisperCppJson, WhisperProviderError } from '../provider';

describe('normalizeWhisperCppJson', () => {
  test('rewrites whisper.cpp transcription[].offsets into {words:[]}', () => {
    const raw = {
      transcription: [
        { text: ' Hello', offsets: { from: 0, to: 500 } },
        { text: ' world', offsets: { from: 500, to: 1100 } },
      ],
    };
    const normalized = normalizeWhisperCppJson(raw) as {
      words: Array<{ word: string; start: number; end: number }>;
    };
    expect(normalized.words).toEqual([
      { word: ' Hello', start: 0, end: 0.5 },
      { word: ' world', start: 0.5, end: 1.1 },
    ]);
  });

  test('strips whisper.cpp meta tokens like [_BEG_] and [_TT_100]', () => {
    const raw = {
      transcription: [
        { text: '[_BEG_]', offsets: { from: 0, to: 0 } },
        { text: ' real', offsets: { from: 0, to: 400 } },
        { text: '[_TT_100]', offsets: { from: 400, to: 400 } },
      ],
    };
    const normalized = normalizeWhisperCppJson(raw) as {
      words: Array<{ word: string }>;
    };
    expect(normalized.words.map((w) => w.word.trim())).toEqual(['real']);
  });

  test('pass-through when input is already {segments: [{words: []}]}', () => {
    const raw = {
      segments: [
        { words: [{ word: 'hi', start: 0, end: 0.3 }] },
      ],
    };
    expect(normalizeWhisperCppJson(raw)).toBe(raw);
  });

  test('pass-through when input is already {words: []}', () => {
    const raw = { words: [{ word: 'hi', start: 0, end: 0.3 }] };
    expect(normalizeWhisperCppJson(raw)).toBe(raw);
  });

  test('round-trip: whisper.cpp JSON → normalized → parseWhisperJson → WordTiming[]', () => {
    const raw = {
      transcription: [
        { text: ' Hi', offsets: { from: 0, to: 300 } },
        { text: ' there.', offsets: { from: 300, to: 900 } },
      ],
    };
    const normalized = normalizeWhisperCppJson(raw);
    const words = parseWhisperJson(normalized);
    expect(words).toEqual([
      { text: 'Hi', startMs: 0, endMs: 300 },
      { text: 'there.', startMs: 300, endMs: 900 },
    ]);
  });
});

describe('createWhisperCppProvider — construction errors', () => {
  test('rejects missing whisperBinary', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => createWhisperCppProvider({ modelPath: 'm' } as any)).toThrow(
      WhisperProviderError,
    );
  });

  test('rejects missing modelPath', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => createWhisperCppProvider({ whisperBinary: 'w' } as any)).toThrow(
      WhisperProviderError,
    );
  });

  test('returns a provider with id="whisper-cpp"', () => {
    const p = createWhisperCppProvider({ whisperBinary: 'w', modelPath: 'm' });
    expect(p.id).toBe('whisper-cpp');
  });
});
