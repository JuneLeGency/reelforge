import type { WordTiming } from '@reelforge/captions';

/**
 * Minimal provider protocol. Once `@reelforge/core` lands this type moves
 * there; for now we host it here so the provider is self-contained.
 */
export interface TTSProvider {
  readonly id: string;
  synthesize(input: TTSInput): Promise<TTSResult>;
}

export interface TTSInput {
  text: string;
  /** Provider-specific voice identifier. For ElevenLabs this is the voice id. */
  voice: string;
  /** BCP-47 tag, optional hint for provider language selection. */
  language?: string;
  /** Playback speed multiplier, 1.0 = natural. Providers may ignore. */
  speed?: number;
}

export interface TTSResult {
  audio: Buffer;
  mimeType: string;
  durationMs: number;
  /** Word-level timings when the provider supports alignment. */
  wordTimings?: WordTiming[];
}
