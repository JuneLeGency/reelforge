import { describe, expect, test } from 'bun:test';
import {
  parseTimingsText,
  parseWhisperJson,
  parseWhisperJsonText,
  parseWordLevelSrt,
  TimingsParseError,
} from '../index';

describe('parseWordLevelSrt', () => {
  test('reads a per-word SRT into WordTiming[]', () => {
    const srt = `1
00:00:00,000 --> 00:00:00,500
Hello

2
00:00:00,500 --> 00:00:01,000
world
`;
    const t = parseWordLevelSrt(srt);
    expect(t).toEqual([
      { text: 'Hello', startMs: 0, endMs: 500 },
      { text: 'world', startMs: 500, endMs: 1000 },
    ]);
  });

  test('splits multi-word cues by linear interpolation', () => {
    const srt = `1
00:00:00,000 --> 00:00:03,000
three words here
`;
    const t = parseWordLevelSrt(srt);
    expect(t).toHaveLength(3);
    expect(t[0]).toEqual({ text: 'three', startMs: 0, endMs: 1000 });
    expect(t[1]).toEqual({ text: 'words', startMs: 1000, endMs: 2000 });
    expect(t[2]).toEqual({ text: 'here', startMs: 2000, endMs: 3000 });
  });

  test('empty input yields empty array', () => {
    expect(parseWordLevelSrt('')).toEqual([]);
  });
});

describe('parseWhisperJson', () => {
  test('accepts the {segments:[{words:[...]}]} shape', () => {
    const data = {
      segments: [
        { words: [{ word: ' hi', start: 0, end: 0.3 }] },
        { words: [{ word: ' you', start: 0.3, end: 0.6 }] },
      ],
    };
    expect(parseWhisperJson(data)).toEqual([
      { text: 'hi', startMs: 0, endMs: 300 },
      { text: 'you', startMs: 300, endMs: 600 },
    ]);
  });

  test('accepts the flat {words:[...]} shape', () => {
    const data = {
      words: [
        { word: 'one', start: 0, end: 0.4 },
        { word: 'two', start: 0.4, end: 0.8 },
      ],
    };
    expect(parseWhisperJson(data)).toHaveLength(2);
  });

  test('rejects input with no word-level data', () => {
    expect(() =>
      parseWhisperJson({ segments: [{ text: 'no words', start: 0, end: 1 }] }),
    ).toThrow(TimingsParseError);
  });

  test('rejects non-object input', () => {
    expect(() => parseWhisperJson(null)).toThrow(TimingsParseError);
    expect(() => parseWhisperJson('hello')).toThrow(TimingsParseError);
  });

  test('surface parse errors on invalid JSON text', () => {
    expect(() => parseWhisperJsonText('not json {')).toThrow(TimingsParseError);
  });
});

describe('parseTimingsText (auto-detect)', () => {
  test('dispatches to JSON parser on leading {', () => {
    const t = parseTimingsText(
      JSON.stringify({ words: [{ word: 'a', start: 0, end: 0.2 }] }),
    );
    expect(t).toEqual([{ text: 'a', startMs: 0, endMs: 200 }]);
  });

  test('dispatches to SRT parser on other input', () => {
    const t = parseTimingsText(`1\n00:00:00,000 --> 00:00:00,300\nhello\n`);
    expect(t).toEqual([{ text: 'hello', startMs: 0, endMs: 300 }]);
  });

  test('tolerates leading whitespace before the dispatch char', () => {
    const t = parseTimingsText(
      `   \n  {"words":[{"word":"ok","start":0,"end":0.2}]}`,
    );
    expect(t[0]!.text).toBe('ok');
  });
});
