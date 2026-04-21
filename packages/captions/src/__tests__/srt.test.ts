import { describe, expect, test } from 'bun:test';
import type { Caption } from '@reelforge/ir';
import { captionsToSrt, parseSrt } from '../index';

describe('captionsToSrt', () => {
  test('formats times with comma separator and pads milliseconds', () => {
    const caps: Caption[] = [
      { text: 'Hello', startMs: 0, endMs: 1500, timestampMs: null, confidence: null },
      {
        text: 'World',
        startMs: 1500,
        endMs: 3020,
        timestampMs: null,
        confidence: null,
      },
    ];
    const srt = captionsToSrt(caps);
    expect(srt).toBe(
      '1\n00:00:00,000 --> 00:00:01,500\nHello\n\n2\n00:00:01,500 --> 00:00:03,020\nWorld\n',
    );
  });

  test('handles hours / minutes correctly', () => {
    const caps: Caption[] = [
      {
        text: 'late',
        startMs: 3_723_456,
        endMs: 3_724_000,
        timestampMs: null,
        confidence: null,
      },
    ];
    const srt = captionsToSrt(caps);
    expect(srt).toContain('01:02:03,456 --> 01:02:04,000');
  });
});

describe('parseSrt', () => {
  test('round-trips a simple document', () => {
    const original: Caption[] = [
      { text: 'One', startMs: 0, endMs: 1000, timestampMs: null, confidence: null },
      { text: 'Two', startMs: 1000, endMs: 2000, timestampMs: null, confidence: null },
    ];
    const srt = captionsToSrt(original);
    const parsed = parseSrt(srt);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({ text: 'One', startMs: 0, endMs: 1000 });
    expect(parsed[1]).toMatchObject({ text: 'Two', startMs: 1000, endMs: 2000 });
  });

  test('accepts dot-separated milliseconds (VTT-style)', () => {
    const srt = '1\n00:00:01.250 --> 00:00:02.500\nHi\n';
    const [c] = parseSrt(srt);
    expect(c).toMatchObject({ startMs: 1250, endMs: 2500 });
  });

  test('supports multi-line cue text', () => {
    const srt = '1\n00:00:00,000 --> 00:00:02,000\nLine one\nLine two\n';
    const [c] = parseSrt(srt);
    expect(c!.text).toBe('Line one\nLine two');
  });

  test('ignores malformed cues without throwing', () => {
    const srt = 'garbage\n\n1\n00:00:01,000 --> 00:00:02,000\nOK\n';
    const parsed = parseSrt(srt);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.text).toBe('OK');
  });

  test('empty string returns empty array', () => {
    expect(parseSrt('')).toEqual([]);
  });
});
