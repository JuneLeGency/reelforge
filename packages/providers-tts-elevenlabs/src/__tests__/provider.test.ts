import { describe, expect, test } from 'bun:test';
import { createElevenLabsProvider, type FetchLike } from '../index';

describe('createElevenLabsProvider', () => {
  test('throws when apiKey is empty', () => {
    expect(() => createElevenLabsProvider({ apiKey: '' })).toThrow(/apiKey/);
  });

  test('builds the right request and parses the mocked response', async () => {
    let captured: { url: string; method: string; headers: Headers; body: unknown } | null =
      null;
    const mockFetch: FetchLike = async (input, init) => {
      captured = {
        url: String(input),
        method: init?.method ?? 'GET',
        headers: new Headers(init?.headers),
        body: init?.body ? JSON.parse(init.body as string) : null,
      };
      const body = JSON.stringify({
        audio_base64: Buffer.from([0xff, 0xfb]).toString('base64'),
        alignment: {
          characters: ['H', 'i'],
          character_start_times_seconds: [0, 0.1],
          character_end_times_seconds: [0.1, 0.2],
        },
      });
      return new Response(body, {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };

    const provider = createElevenLabsProvider({
      apiKey: 'test-key',
      fetchImpl: mockFetch,
    });
    const result = await provider.synthesize({
      text: 'Hi',
      voice: 'voice-id-123',
    });

    expect(provider.id).toBe('elevenlabs');
    expect(captured).not.toBeNull();
    expect(captured!.url).toBe(
      'https://api.elevenlabs.io/v1/text-to-speech/voice-id-123/with-timestamps',
    );
    expect(captured!.method).toBe('POST');
    expect(captured!.headers.get('xi-api-key')).toBe('test-key');
    expect(captured!.headers.get('content-type')).toBe('application/json');
    expect(captured!.body).toMatchObject({
      text: 'Hi',
      model_id: 'eleven_turbo_v2_5',
      output_format: 'mp3_44100_128',
    });
    expect(result.mimeType).toBe('audio/mpeg');
    expect(result.durationMs).toBe(200);
    expect(result.wordTimings).toEqual([{ text: 'Hi', startMs: 0, endMs: 200 }]);
  });

  test('propagates language and speed into request body', async () => {
    let bodyCaptured: Record<string, unknown> | null = null;
    const mockFetch: FetchLike = async (_url, init) => {
      bodyCaptured = init?.body ? JSON.parse(init.body as string) : null;
      return new Response(
        JSON.stringify({
          audio_base64: Buffer.from([0]).toString('base64'),
          alignment: null,
        }),
        { status: 200 },
      );
    };
    const provider = createElevenLabsProvider({
      apiKey: 'k',
      fetchImpl: mockFetch,
    });
    await provider.synthesize({
      text: 'x',
      voice: 'v',
      language: 'en',
      speed: 1.1,
    });
    expect(bodyCaptured).toMatchObject({
      language_code: 'en',
      voice_settings: { speed: 1.1 },
    });
  });

  test('non-2xx response throws with status and body snippet', async () => {
    const mockFetch: FetchLike = async () =>
      new Response('unauthorized voice', { status: 401 });
    const provider = createElevenLabsProvider({ apiKey: 'k', fetchImpl: mockFetch });
    await expect(
      provider.synthesize({ text: 'x', voice: 'bad' }),
    ).rejects.toThrow(/401/);
  });
});
