#!/usr/bin/env bun
/**
 * GPU-side TTS → WAV + char-proportional SRT helper.
 *
 * Talks to a VoxCPM2 / Qwen3-TTS / IndexTTS2 server on the LAN (or through
 * an ssh tunnel) and produces:
 *   - <out>.wav   the raw audio
 *   - <out>.mp3   the converted audio (via ffmpeg, if requested)
 *   - <out>.srt   sentence-level timings computed from the audio duration
 *                 and the character count of each sentence
 *
 * The servers don't emit word-level timings, so we split the narration on
 * Chinese + ASCII sentence terminators and distribute the audio duration
 * proportionally to the character count of each sentence. That's enough
 * precision for Reelforge to cut slides at sentence boundaries.
 */
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve as resolvePath } from 'node:path';

interface TtsResponse {
  audio_base64: string;
  sample_rate: number;
  duration_seconds: number;
  inference_time?: number;
  chunks?: number;
}

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        out[key] = 'true';
      } else {
        out[key] = next;
        i++;
      }
    }
  }
  return out;
}

function die(msg: string): never {
  console.error(`gpu-tts: ${msg}`);
  process.exit(1);
}

/**
 * Split text on terminal punctuation (Chinese + ASCII) and return each
 * sentence with its character count. Punctuation stays with the sentence
 * it closes.
 */
function splitSentences(text: string): Array<{ text: string; charCount: number }> {
  const TERMINATORS = /[.!?。！？]/;
  const sentences: Array<{ text: string; charCount: number }> = [];
  let buffer = '';
  for (const ch of text) {
    buffer += ch;
    if (TERMINATORS.test(ch)) {
      const trimmed = buffer.trim();
      if (trimmed !== '') {
        sentences.push({ text: trimmed, charCount: [...trimmed].length });
      }
      buffer = '';
    }
  }
  const tail = buffer.trim();
  if (tail !== '') {
    sentences.push({ text: tail, charCount: [...tail].length });
  }
  return sentences;
}

function formatSrtTime(ms: number): string {
  const clamped = Math.max(0, Math.floor(ms));
  const h = Math.floor(clamped / 3_600_000);
  const m = Math.floor((clamped % 3_600_000) / 60_000);
  const s = Math.floor((clamped % 60_000) / 1000);
  const milli = clamped % 1000;
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const pad3 = (n: number) => String(n).padStart(3, '0');
  return `${pad2(h)}:${pad2(m)}:${pad2(s)},${pad3(milli)}`;
}

function buildProportionalSrt(
  sentences: ReadonlyArray<{ text: string; charCount: number }>,
  totalDurationMs: number,
): string {
  const totalChars = sentences.reduce((acc, s) => acc + s.charCount, 0);
  if (totalChars === 0) return '';
  let cursor = 0;
  const cues: string[] = [];
  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i]!;
    const share = (s.charCount / totalChars) * totalDurationMs;
    const start = Math.round(cursor);
    const end = Math.round(cursor + share);
    cues.push(
      `${i + 1}\n${formatSrtTime(start)} --> ${formatSrtTime(end)}\n${s.text}`,
    );
    cursor += share;
  }
  return cues.join('\n\n') + '\n';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const scriptPath = args.script ?? args.text;
  if (!scriptPath) die('missing --script <path>');
  const out = args.out ?? 'narration';
  const endpoint =
    args.endpoint ?? process.env.TTS_ENDPOINT ?? 'http://192.168.31.47:9094/v1/tts';
  const cfgValue = Number.parseFloat(args['cfg-value'] ?? '2.0');
  const timesteps = Number.parseInt(args['timesteps'] ?? '10', 10);
  const instruct = args.instruct ?? '';

  const text = (await readFile(resolvePath(scriptPath), 'utf8')).trim();
  if (text === '') die(`script ${scriptPath} is empty`);
  const finalText = instruct !== '' ? `(${instruct})${text}` : text;

  console.error(`→ posting ${text.length} chars to ${endpoint}`);
  const started = Date.now();
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: finalText,
      cfg_value: cfgValue,
      inference_timesteps: timesteps,
      stream: false,
    }),
  });
  if (!resp.ok) {
    die(`TTS server returned ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  }
  const body = (await resp.json()) as TtsResponse;
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  const durationMs = Math.round(body.duration_seconds * 1000);
  const sampleRate = body.sample_rate;
  console.error(
    `  ✓ ${body.duration_seconds.toFixed(2)}s audio @ ${sampleRate}Hz (server: ${body.inference_time ?? '?'}s, wall: ${elapsed}s, chunks: ${body.chunks ?? 1})`,
  );

  const wavPath = resolvePath(`${out}.wav`);
  const mp3Path = resolvePath(`${out}.mp3`);
  const srtPath = resolvePath(`${out}.srt`);
  await mkdir(dirname(wavPath), { recursive: true });
  const wavBuf = Buffer.from(body.audio_base64, 'base64');
  await writeFile(wavPath, wavBuf);
  console.error(`  ✓ ${wavPath} (${wavBuf.byteLength} bytes)`);

  // Optional: convert WAV → MP3 for size.
  if (args['no-mp3'] !== 'true') {
    const result = spawnSync(
      'ffmpeg',
      ['-y', '-hide_banner', '-loglevel', 'error', '-i', wavPath, '-q:a', '2', mp3Path],
      { stdio: 'inherit' },
    );
    if (result.status === 0) {
      console.error(`  ✓ ${mp3Path}`);
    } else {
      console.error(`  ! ffmpeg conversion failed (status ${result.status}) — keeping wav only`);
    }
  }

  const sentences = splitSentences(text);
  const srt = buildProportionalSrt(sentences, durationMs);
  await writeFile(srtPath, srt, 'utf8');
  console.error(
    `  ✓ ${srtPath} (${sentences.length} sentence${sentences.length === 1 ? '' : 's'})`,
  );
  console.error('');
  console.error('done. Feed into reelforge via:');
  const preferredAudio = args['no-mp3'] === 'true' ? wavPath : mp3Path;
  console.error(`  "audio":   "${preferredAudio}"`);
  console.error(`  "timings": "${srtPath}"`);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.stack ?? err.message : String(err);
  console.error(msg);
  process.exit(1);
});
