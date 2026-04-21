import { charAlignmentToWordTimings, type CharacterAlignment } from './alignment';
import type { TTSInput, TTSProvider, TTSResult } from './types';

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface ElevenLabsProviderOptions {
  apiKey: string;
  /** Default: "eleven_turbo_v2_5" — fast multilingual model with alignment. */
  modelId?: string;
  /** Default: "mp3_44100_128". See ElevenLabs docs for supported values. */
  audioFormat?: string;
  /** Base API URL. Override for mocking/self-hosting. */
  baseUrl?: string;
  /** Override fetch (Node 22 has native global fetch). */
  fetchImpl?: FetchLike;
}

export interface ElevenLabsResponse {
  audio_base64: string;
  alignment: CharacterAlignment | null;
  normalized_alignment?: CharacterAlignment | null;
}

const DEFAULT_BASE_URL = 'https://api.elevenlabs.io';
const DEFAULT_MODEL_ID = 'eleven_turbo_v2_5';
const DEFAULT_AUDIO_FORMAT = 'mp3_44100_128';

export function createElevenLabsProvider(opts: ElevenLabsProviderOptions): TTSProvider {
  const {
    apiKey,
    modelId = DEFAULT_MODEL_ID,
    audioFormat = DEFAULT_AUDIO_FORMAT,
    baseUrl = DEFAULT_BASE_URL,
    fetchImpl = fetch,
  } = opts;

  if (!apiKey) {
    throw new Error('ElevenLabs apiKey is required');
  }

  return {
    id: 'elevenlabs',
    async synthesize(input: TTSInput): Promise<TTSResult> {
      const url = `${baseUrl}/v1/text-to-speech/${encodeURIComponent(input.voice)}/with-timestamps`;
      const body: Record<string, unknown> = {
        text: input.text,
        model_id: modelId,
        output_format: audioFormat,
      };
      if (input.language) body.language_code = input.language;
      if (input.speed !== undefined) {
        body.voice_settings = { speed: input.speed };
      }

      const response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`ElevenLabs API error ${response.status}: ${text.slice(0, 500)}`);
      }

      const json = (await response.json()) as ElevenLabsResponse;
      return parseElevenLabsResponse(json);
    },
  };
}

/**
 * Convert the raw ElevenLabs JSON response into our TTSResult. Exposed for
 * testing and for users who want to call the API themselves.
 */
export function parseElevenLabsResponse(json: ElevenLabsResponse): TTSResult {
  const audio = Buffer.from(json.audio_base64, 'base64');
  const alignment = json.normalized_alignment ?? json.alignment;
  const wordTimings = alignment ? charAlignmentToWordTimings(alignment) : undefined;
  const durationMs =
    wordTimings && wordTimings.length > 0
      ? wordTimings[wordTimings.length - 1]!.endMs
      : 0;

  return {
    audio,
    mimeType: 'audio/mpeg',
    durationMs,
    ...(wordTimings ? { wordTimings } : {}),
  };
}
