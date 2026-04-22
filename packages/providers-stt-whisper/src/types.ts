import type { WordTiming } from '@reelforge/captions';

/**
 * Generic STT provider contract. Every implementation (local whisper.cpp,
 * OpenAI Whisper HTTP, AssemblyAI, …) accepts a path to an audio file and
 * returns word-level timings Reelforge can align slides against.
 */
export interface STTProvider {
  readonly id: string;
  transcribe(input: STTInput): Promise<STTResult>;
}

export interface STTInput {
  /** Absolute or cwd-relative path to an audio file. */
  audioPath: string;
  /** BCP-47 hint for the language; empty = auto-detect. */
  language?: string;
}

export interface STTResult {
  /** Word-level timings — the primary output Reelforge consumes. */
  wordTimings: WordTiming[];
  /** Best-effort full transcript. May be empty for providers that only return words. */
  text: string;
  /** Detected language, if the provider exposes it. */
  language?: string;
}
