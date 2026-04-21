/**
 * Word-level timestamp as returned by TTS/STT providers.
 * This is the *input* to {@link wordTimingsToCaptions}.
 */
export interface WordTiming {
  text: string;
  startMs: number;
  endMs: number;
}

/**
 * One word inside a TikTok page, carrying its own timing so a renderer can
 * highlight it in real time.
 */
export interface TikTokToken {
  text: string;
  fromMs: number;
  toMs: number;
}

/**
 * A phrase-level group of words, suitable for displaying as a single line
 * of captions while highlighting the currently-spoken word.
 */
export interface TikTokPage {
  text: string;
  startMs: number;
  durationMs: number;
  tokens: TikTokToken[];
}
