import { describe, expect, test } from 'bun:test';
import { wordTimingsToCaptions, type WordTiming } from '../index';

describe('wordTimingsToCaptions', () => {
  const words: WordTiming[] = [
    { text: 'Hello', startMs: 0, endMs: 500 },
    { text: 'world', startMs: 500, endMs: 1000 },
    { text: 'again', startMs: 1000, endMs: 1500 },
  ];

  test('adds leading space to non-first words by default', () => {
    const caps = wordTimingsToCaptions(words);
    expect(caps.map((c) => c.text)).toEqual(['Hello', ' world', ' again']);
  });

  test('preserves times and computes timestampMs as midpoint', () => {
    const caps = wordTimingsToCaptions(words);
    expect(caps[0]).toMatchObject({ startMs: 0, endMs: 500, timestampMs: 250 });
    expect(caps[1]).toMatchObject({ startMs: 500, endMs: 1000, timestampMs: 750 });
  });

  test('confidence is null (not supplied by word timings)', () => {
    const caps = wordTimingsToCaptions(words);
    for (const c of caps) expect(c.confidence).toBeNull();
  });

  test('respects addLeadingSpace=false', () => {
    const caps = wordTimingsToCaptions(words, { addLeadingSpace: false });
    expect(caps.map((c) => c.text)).toEqual(['Hello', 'world', 'again']);
  });
});
