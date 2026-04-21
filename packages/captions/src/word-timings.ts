import type { Caption } from '@reelforge/ir';
import type { WordTiming } from './types';

export interface WordTimingsToCaptionsOptions {
  /**
   * Prepend a space to every non-first token's text so that the resulting
   * Caption[] can be fed into {@link createTikTokStyleCaptions} — that
   * function uses leading whitespace as a phrase boundary signal.
   *
   * @default true
   */
  addLeadingSpace?: boolean;
}

/**
 * Convert provider-level word timings into the canonical Caption[] shape.
 * Each word becomes one Caption; the middle of the interval is stored in
 * `timestampMs` (Remotion convention).
 */
export function wordTimingsToCaptions(
  words: readonly WordTiming[],
  opts: WordTimingsToCaptionsOptions = {},
): Caption[] {
  const addLeadingSpace = opts.addLeadingSpace ?? true;
  return words.map((w, i) => ({
    text: addLeadingSpace && i > 0 ? ` ${w.text}` : w.text,
    startMs: w.startMs,
    endMs: w.endMs,
    timestampMs: (w.startMs + w.endMs) / 2,
    confidence: null,
  }));
}
