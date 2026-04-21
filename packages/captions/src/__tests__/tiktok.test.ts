import { describe, expect, test } from 'bun:test';
import type { Caption } from '@reelforge/ir';
import { createTikTokStyleCaptions, wordTimingsToCaptions, type WordTiming } from '../index';

const w = (text: string, startMs: number, endMs: number): WordTiming => ({ text, startMs, endMs });

describe('createTikTokStyleCaptions', () => {
  test('groups words into one page when gaps are short', () => {
    const words = [w('Hello', 0, 300), w('world', 320, 600), w('today', 620, 900)];
    const captions = wordTimingsToCaptions(words);
    const { pages } = createTikTokStyleCaptions({
      captions,
      combineTokensWithinMs: 1200,
    });
    expect(pages).toHaveLength(1);
    expect(pages[0]!.text).toBe('Hello world today');
    expect(pages[0]!.tokens).toHaveLength(3);
    expect(pages[0]!.tokens[0]!.text).toBe('Hello');
    expect(pages[0]!.tokens[1]!.text).toBe(' world');
    expect(pages[0]!.tokens[2]!.text).toBe(' today');
    expect(pages[0]!.durationMs).toBe(900);
  });

  test('starts a new page on leading-space boundary when page is already long', () => {
    const words = [
      w('First', 0, 400),
      w('phrase', 410, 800),
      w('here', 820, 1300),
      w('Second', 2800, 3200),
      w('phrase', 3210, 3600),
    ];
    const captions = wordTimingsToCaptions(words);
    const { pages } = createTikTokStyleCaptions({
      captions,
      combineTokensWithinMs: 1200,
    });
    expect(pages).toHaveLength(2);
    expect(pages[0]!.text).toBe('First phrase here');
    expect(pages[0]!.startMs).toBe(0);
    expect(pages[0]!.durationMs).toBe(2800);
    expect(pages[1]!.text).toBe('Second phrase');
    expect(pages[1]!.startMs).toBe(2800);
    expect(pages[1]!.durationMs).toBe(800);
  });

  test('empty input returns empty pages', () => {
    const { pages } = createTikTokStyleCaptions({
      captions: [],
      combineTokensWithinMs: 1200,
    });
    expect(pages).toEqual([]);
  });

  test('tokens preserve per-word timings for highlighting', () => {
    const words = [w('A', 0, 100), w('B', 110, 200), w('C', 210, 300)];
    const { pages } = createTikTokStyleCaptions({
      captions: wordTimingsToCaptions(words),
      combineTokensWithinMs: 1000,
    });
    expect(pages[0]!.tokens.map((t) => [t.fromMs, t.toMs])).toEqual([
      [0, 100],
      [110, 200],
      [210, 300],
    ]);
  });

  test('single page with captions having no leading spaces', () => {
    const captions: Caption[] = [
      { text: 'a', startMs: 0, endMs: 100, timestampMs: 50, confidence: null },
      { text: 'b', startMs: 100, endMs: 200, timestampMs: 150, confidence: null },
    ];
    const { pages } = createTikTokStyleCaptions({ captions, combineTokensWithinMs: 1000 });
    expect(pages).toHaveLength(1);
    expect(pages[0]!.text).toBe('ab');
  });
});
