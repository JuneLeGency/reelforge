import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve as resolvePath } from 'node:path';
import { defineCommand } from 'citty';
import { captionsToSrt, wordTimingsToCaptions } from '@reelforge/captions';
import { createElevenLabsProvider } from '@reelforge/providers-tts-elevenlabs';

export const ttsCommand = defineCommand({
  meta: {
    name: 'tts',
    description: 'Synthesize narration via ElevenLabs (MP3 + optional SRT)',
  },
  args: {
    text: {
      type: 'positional',
      description: 'Text to synthesize',
      required: true,
    },
    output: {
      type: 'string',
      alias: 'o',
      description: 'Output MP3 path',
      default: 'narration.mp3',
    },
    voice: {
      type: 'string',
      description: 'ElevenLabs voice id',
      required: true,
    },
    model: {
      type: 'string',
      description: 'ElevenLabs model id',
      default: 'eleven_turbo_v2_5',
    },
    srt: {
      type: 'string',
      description: 'Also write an SRT file (per-word captions)',
    },
    apiKey: {
      type: 'string',
      description: 'ElevenLabs API key (else $ELEVENLABS_API_KEY)',
    },
  },
  async run({ args }) {
    const apiKey = args.apiKey ?? process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      console.error('Missing API key — pass --api-key or set ELEVENLABS_API_KEY.');
      process.exit(2);
    }

    const provider = createElevenLabsProvider({
      apiKey,
      modelId: args.model,
    });

    console.error(`→ synthesizing "${args.text.slice(0, 60)}${args.text.length > 60 ? '…' : ''}"`);
    const result = await provider.synthesize({
      text: args.text,
      voice: args.voice,
    });

    const outputPath = resolvePath(args.output);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, result.audio);
    console.error(`✓ ${outputPath} (${(result.durationMs / 1000).toFixed(2)}s)`);

    if (args.srt) {
      if (!result.wordTimings) {
        console.error('(no word timings returned; skipping SRT)');
      } else {
        const captions = wordTimingsToCaptions(result.wordTimings);
        const srtPath = resolvePath(args.srt);
        await mkdir(dirname(srtPath), { recursive: true });
        await writeFile(srtPath, captionsToSrt(captions), 'utf8');
        console.error(`✓ ${srtPath} (${captions.length} word${captions.length === 1 ? '' : 's'})`);
      }
    }
  },
});
