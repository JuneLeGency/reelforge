import type { Caption } from '@reelforge/ir';
import type { TikTokPage, TikTokToken } from './types';

export interface CreateTikTokStyleCaptionsInput {
  captions: readonly Caption[];
  /**
   * Merge consecutive words into the same page while the gap between them
   * stays at or below this threshold. A leading-space boundary still starts
   * a new page if the total page duration already exceeds this value.
   */
  combineTokensWithinMs: number;
}

export interface CreateTikTokStyleCaptionsOutput {
  pages: TikTokPage[];
}

/**
 * Partition per-word {@link Caption}s into phrase-level pages for TikTok-style
 * display. Each page exposes per-word timings so a renderer can highlight the
 * active word as the playhead advances.
 *
 * Algorithm concept inspired by Remotion's `createTikTokStyleCaptions`.
 * Independent re-implementation under Apache-2.0.
 */
export function createTikTokStyleCaptions(
  input: CreateTikTokStyleCaptionsInput,
): CreateTikTokStyleCaptionsOutput {
  const { captions, combineTokensWithinMs } = input;
  const pages: TikTokPage[] = [];

  let pageText = '';
  let pageTokens: TikTokToken[] = [];
  let pageStart = 0;
  let pageEnd = 0;

  const flushPage = () => {
    pages.push({
      text: pageText.trimStart(),
      startMs: pageStart,
      tokens: pageTokens,
      // Placeholder; finalized when the next page begins or when we exit.
      durationMs: 0,
    });
    const prev = pages.at(-2);
    if (prev) prev.durationMs = pageStart - prev.startMs;
  };

  for (const cap of captions) {
    const { text } = cap;
    const hasLeadingSpace = text.startsWith(' ');
    const openLong = pageEnd - pageStart > combineTokensWithinMs;
    const shouldStartNewPage = hasLeadingSpace && openLong && pageText !== '';

    if (shouldStartNewPage) {
      flushPage();
      pageText = text.trimStart();
      pageTokens = pageText === ''
        ? []
        : [{ text: pageText, fromMs: cap.startMs, toMs: cap.endMs }];
      pageStart = cap.startMs;
      pageEnd = cap.endMs;
      continue;
    }

    if (pageText === '') pageStart = cap.startMs;
    pageText = (pageText + text).trimStart();
    if (text.trim() !== '') {
      pageTokens.push({
        text: pageTokens.length === 0 ? pageText : text,
        fromMs: cap.startMs,
        toMs: cap.endMs,
      });
    }
    pageEnd = cap.endMs;
  }

  if (pageText !== '') {
    flushPage();
    const last = pages.at(-1);
    if (last) last.durationMs = pageEnd - last.startMs;
  }

  return { pages };
}
