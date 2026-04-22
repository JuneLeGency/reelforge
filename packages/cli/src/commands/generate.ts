import { copyFile, mkdir, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve as resolvePath } from 'node:path';
import { defineCommand } from 'citty';
import type { Caption, TikTokPage, WordTiming } from '@reelforge/captions';
import {
  captionsToSrt,
  createTikTokStyleCaptions,
  parseTimingsText,
  wordTimingsToCaptions,
} from '@reelforge/captions';
import { compileHtmlFile } from '@reelforge/html';
import { renderChrome } from '@reelforge/engine-chrome';
import { burnSubtitles, muxAudio } from '@reelforge/mux';
import { createWhisperCppProvider } from '@reelforge/providers-stt-whisper';
import { createElevenLabsProvider } from '@reelforge/providers-tts-elevenlabs';
import { resolveChrome } from '../util/chrome';

/**
 * Two shapes are accepted:
 *
 * 1. "synthesize" mode — call ElevenLabs to produce audio + timings:
 *    `{ narration, voice, images, ... }`
 *
 * 2. "byo" mode — user-supplied audio + timings:
 *    `{ audio, timings, images, ... }`
 *
 * Callers may mix: `narration` present but `audio`/`timings` override →
 * reuse the script text for display metadata only (TTS is skipped).
 */
export interface GenerateConfig {
  /** Narration text. Required in synthesize mode; optional decoration in byo mode. */
  narration?: string | undefined;
  /** ElevenLabs voice id. Required in synthesize mode; ignored in byo mode. */
  voice?: string | undefined;
  /** Pre-rendered audio file (mp3/wav/ogg). Triggers byo mode. */
  audio?: string | undefined;
  /** Word-level timings file (SRT or Whisper JSON). Triggers byo mode. */
  timings?: string | undefined;
  images: string[];
  apiKey?: string | undefined;
  modelId?: string | undefined;
  width: number;
  height: number;
  fps: number;
}

export class GenerateConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GenerateConfigError';
  }
}

export function parseGenerateConfig(raw: unknown): GenerateConfig {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new GenerateConfigError('config must be a JSON object');
  }
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.images) || r.images.length === 0) {
    throw new GenerateConfigError('config.images must be a non-empty array');
  }
  for (const img of r.images) {
    if (typeof img !== 'string' || img === '') {
      throw new GenerateConfigError('config.images entries must be non-empty strings');
    }
  }

  const hasAudio = typeof r.audio === 'string' && r.audio !== '';
  const hasTimings = typeof r.timings === 'string' && r.timings !== '';
  const hasNarration = typeof r.narration === 'string' && r.narration.trim() !== '';
  const hasVoice = typeof r.voice === 'string' && r.voice !== '';

  // config.timings without config.audio is never useful — the audio file is
  // needed to actually play the narration in the rendered video.
  if (hasTimings && !hasAudio) {
    throw new GenerateConfigError('config.audio is required when config.timings is present');
  }

  // config.audio without config.timings is allowed — the CLI may supply
  // --timings, or auto-transcribe via whisper. Run-time logic validates.

  if (!hasAudio && !hasTimings) {
    // Synthesize mode requires narration + voice.
    if (!hasNarration) {
      throw new GenerateConfigError(
        'config.narration is required when no pre-rendered audio/timings are supplied',
      );
    }
    if (!hasVoice) {
      throw new GenerateConfigError(
        'config.voice is required when no pre-rendered audio/timings are supplied',
      );
    }
  }

  return {
    images: r.images as string[],
    narration: hasNarration ? (r.narration as string) : undefined,
    voice: hasVoice ? (r.voice as string) : undefined,
    audio: hasAudio ? (r.audio as string) : undefined,
    timings: hasTimings ? (r.timings as string) : undefined,
    apiKey: typeof r.apiKey === 'string' ? r.apiKey : undefined,
    modelId: typeof r.modelId === 'string' ? r.modelId : undefined,
    width: typeof r.width === 'number' ? r.width : 1280,
    height: typeof r.height === 'number' ? r.height : 720,
    fps: typeof r.fps === 'number' ? r.fps : 30,
  };
}

export interface Sentence {
  text: string;
  startMs: number;
  endMs: number;
}

const SENTENCE_TERMINATOR = /[.!?。！？]/;

/**
 * Split word timings into sentences using terminal punctuation. A trailing
 * buffer without punctuation is flushed as the last sentence.
 */
export function splitSentences(words: readonly WordTiming[]): Sentence[] {
  const sentences: Sentence[] = [];
  let buffer: WordTiming[] = [];
  const flush = () => {
    if (buffer.length === 0) return;
    sentences.push({
      text: buffer.map((w) => w.text).join(' '),
      startMs: buffer[0]!.startMs,
      endMs: buffer[buffer.length - 1]!.endMs,
    });
    buffer = [];
  };
  for (const word of words) {
    buffer.push(word);
    if (SENTENCE_TERMINATOR.test(word.text.slice(-1))) flush();
  }
  flush();
  return sentences;
}

export interface SlideSpec {
  image: string;
  startMs: number;
  durationMs: number;
}

/**
 * Pair sentences with images. Strategy:
 * - equal counts: 1:1
 * - fewer sentences: use first N images, ignore the rest (for MVP)
 * - more sentences: cycle through images
 * Sentences are adjacent in time; output slides are strictly sequential.
 */
export function assignSlides(
  sentences: readonly Sentence[],
  images: readonly string[],
): SlideSpec[] {
  if (sentences.length === 0 || images.length === 0) return [];
  const slides: SlideSpec[] = [];
  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i]!;
    slides.push({
      image: images[i % images.length]!,
      startMs: s.startMs,
      durationMs: s.endMs - s.startMs,
    });
  }
  return slides;
}

export interface CaptionOverlayStyle {
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  background?: string;
  padding?: string;
  borderRadius?: string;
  marginBottomPct?: number; // 0..50
  maxWidthPct?: number; // 0..100
  /** Highlight colour for the currently-spoken word in TikTok mode. */
  tokenHighlightColor?: string;
  /** Colour for words already spoken. */
  tokenPastColor?: string;
  /** Colour for upcoming words / the base page colour. */
  tokenBaseColor?: string;
}

export interface BuildHtmlOptions {
  width: number;
  height: number;
  fps: number;
  slides: readonly SlideSpec[];
  audioRelative: string;
  audioDurationMs: number;
  title?: string;
  /** Sentence-level captions rendered as WAAPI-animated overlay divs. */
  captions?: readonly Caption[];
  /** TikTok-style pages with per-word color highlights. Takes priority over `captions`. */
  tikTokPages?: readonly TikTokPage[];
  captionStyle?: CaptionOverlayStyle;
  /**
   * Total timeline duration for animation keyframe math. Defaults to
   * `audioDurationMs`. Lets callers align animation math to a different
   * reference if needed.
   */
  totalDurationMs?: number;
}

const DEFAULT_CAPTION_STYLE: Required<CaptionOverlayStyle> = {
  fontSize: 36,
  fontFamily: '-apple-system, system-ui, "Segoe UI", Roboto, sans-serif',
  color: '#ffffff',
  background: 'rgba(0, 0, 0, 0.55)',
  padding: '14px 28px',
  borderRadius: '12px',
  marginBottomPct: 8,
  maxWidthPct: 80,
  tokenHighlightColor: '#ffe666',
  tokenPastColor: 'rgba(255, 255, 255, 0.95)',
  tokenBaseColor: 'rgba(255, 255, 255, 0.75)',
};

/**
 * Turn sentence boundaries into one {@link Caption} per sentence — suitable
 * for burning into video as readable subtitles. For word-level captions use
 * {@link wordTimingsToCaptions} on the raw TTS wordTimings instead.
 */
export function sentenceCaptions(sentences: readonly Sentence[]): Caption[] {
  return sentences.map((s) => ({
    text: s.text,
    startMs: s.startMs,
    endMs: s.endMs,
    timestampMs: null,
    confidence: null,
  }));
}

export function buildGenerateHtml(opts: BuildHtmlOptions): string {
  const { width, height, fps, slides, audioRelative, audioDurationMs } = opts;
  const title = opts.title ?? 'Reelforge generated video';
  const totalMs = opts.totalDurationMs ?? audioDurationMs;
  const captions = opts.captions ?? [];
  const tikTokPages = opts.tikTokPages ?? [];
  const useTikTok = tikTokPages.length > 0;
  const style = { ...DEFAULT_CAPTION_STYLE, ...(opts.captionStyle ?? {}) };

  const imgTags = slides
    .map((s, i) => {
      const startSec = (s.startMs / 1000).toFixed(3);
      const durationSec = (s.durationMs / 1000).toFixed(3);
      return `    <img src="${escapeAttr(s.image)}" data-start="${startSec}" data-duration="${durationSec}" data-fit="cover" alt="slide ${i + 1}">`;
    })
    .join('\n');

  let overlayDivs = '';
  let overlayScript = '';

  if (useTikTok) {
    overlayDivs = renderTikTokDivs(tikTokPages);
    overlayScript = renderTikTokScript(tikTokPages, totalMs, style);
  } else if (captions.length > 0) {
    overlayDivs = captions
      .map(
        (c, i) =>
          `    <div class="caption" id="caption-${i}">${escapeText(c.text.trim())}</div>`,
      )
      .join('\n');
    overlayScript = renderCaptionScript(captions, totalMs);
  }

  const audioDurSec = (audioDurationMs / 1000).toFixed(3);
  const captionBottomVh = style.marginBottomPct;
  const captionMaxWidthVw = style.maxWidthPct;

  const tiktokCss = useTikTok
    ? `
    .tt-page {
      position: absolute;
      left: 50%;
      bottom: ${captionBottomVh}vh;
      transform: translateX(-50%);
      max-width: ${captionMaxWidthVw}vw;
      text-align: center;
      font-size: ${style.fontSize + 8}px;
      font-weight: 800;
      line-height: 1.25;
      color: ${style.tokenBaseColor};
      text-shadow: 0 3px 16px rgba(0,0,0,0.6);
      letter-spacing: -0.5px;
      opacity: 0;
      pointer-events: none;
      white-space: pre-wrap;
    }
    .tt-token {
      display: inline-block;
      color: ${style.tokenBaseColor};
      transition: none;
    }`
    : '';

  const sentenceCss = !useTikTok && captions.length > 0
    ? `
    .caption {
      position: absolute;
      left: 50%;
      bottom: ${captionBottomVh}vh;
      transform: translateX(-50%);
      max-width: ${captionMaxWidthVw}vw;
      text-align: center;
      font-size: ${style.fontSize}px;
      font-weight: 600;
      line-height: 1.3;
      color: ${style.color};
      background: ${style.background};
      padding: ${style.padding};
      border-radius: ${style.borderRadius};
      opacity: 0;
      pointer-events: none;
      white-space: pre-wrap;
    }`
    : '';

  return `<!DOCTYPE html>
<html data-rf-width="${width}" data-rf-height="${height}" data-rf-fps="${fps}">
<head>
  <meta charset="utf-8">
  <title>${escapeText(title)}</title>
  <style>
    html, body { margin: 0; padding: 0; background: #000; overflow: hidden; font-family: ${style.fontFamily}; }
    #stage { position: relative; width: 100vw; height: 100vh; }
    #stage img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      visibility: hidden;
    }${sentenceCss}${tiktokCss}
  </style>
</head>
<body>
  <div id="stage">
${imgTags}
${overlayDivs}
    <audio src="${escapeAttr(audioRelative)}" data-start="0" data-duration="${audioDurSec}"></audio>
  </div>${overlayScript}
</body>
</html>
`;
}

function renderTikTokDivs(pages: readonly TikTokPage[]): string {
  const lines: string[] = [];
  for (let p = 0; p < pages.length; p++) {
    const page = pages[p]!;
    lines.push(`    <div class="tt-page" id="tt-page-${p}">`);
    for (let t = 0; t < page.tokens.length; t++) {
      const tok = page.tokens[t]!;
      lines.push(
        `      <span class="tt-token" id="tt-token-${p}-${t}">${escapeText(tok.text)}</span>`,
      );
    }
    lines.push(`    </div>`);
  }
  return lines.join('\n');
}

function renderTikTokScript(
  pages: readonly TikTokPage[],
  totalMs: number,
  style: Required<CaptionOverlayStyle>,
): string {
  const total = Math.max(1, Math.round(totalMs));
  const edge = 16;
  const pageEntries: string[] = [];
  const tokenEntries: string[] = [];
  for (let p = 0; p < pages.length; p++) {
    const page = pages[p]!;
    const startMs = Math.round(page.startMs);
    const endMs = Math.round(page.startMs + page.durationMs);
    pageEntries.push(`    {i:${p},s:${startMs},e:${endMs}}`);
    for (let t = 0; t < page.tokens.length; t++) {
      const tok = page.tokens[t]!;
      tokenEntries.push(
        `    {p:${p},t:${t},s:${Math.round(tok.fromMs)},e:${Math.round(tok.toMs)}}`,
      );
    }
  }
  return `
  <script>
    (function () {
      var total = ${total};
      var edge = ${edge};
      var baseColor = ${JSON.stringify(style.tokenBaseColor)};
      var hiColor = ${JSON.stringify(style.tokenHighlightColor)};
      var pastColor = ${JSON.stringify(style.tokenPastColor)};
      var pages = [
${pageEntries.join(',\n')}
      ];
      var tokens = [
${tokenEntries.join(',\n')}
      ];
      pages.forEach(function (pg) {
        var el = document.getElementById('tt-page-' + pg.i);
        if (!el) return;
        var pre = Math.max(0, (pg.s - edge) / total);
        var on = pg.s / total;
        var off = Math.min(1, pg.e / total);
        var postOff = Math.min(1, (pg.e + edge) / total);
        el.animate([
          { opacity: 0, offset: 0 },
          { opacity: 0, offset: pre },
          { opacity: 1, offset: on },
          { opacity: 1, offset: off },
          { opacity: 0, offset: postOff },
          { opacity: 0, offset: 1 }
        ], { duration: total, fill: 'both', easing: 'linear' });
      });
      tokens.forEach(function (tk) {
        var el = document.getElementById('tt-token-' + tk.p + '-' + tk.t);
        if (!el) return;
        var preOn = Math.max(0, (tk.s - 1) / total);
        var on = tk.s / total;
        var off = tk.e / total;
        var postOff = Math.min(1, (tk.e + 1) / total);
        el.animate([
          { color: baseColor, offset: 0 },
          { color: baseColor, offset: preOn },
          { color: hiColor, offset: on },
          { color: hiColor, offset: off },
          { color: pastColor, offset: postOff },
          { color: pastColor, offset: 1 }
        ], { duration: total, fill: 'both', easing: 'linear' });
      });
    })();
  </script>`;
}

function renderCaptionScript(captions: readonly Caption[], totalMs: number): string {
  const entries = captions
    .map(
      (c, i) =>
        `    {id:'caption-${i}',startMs:${Math.round(c.startMs)},endMs:${Math.round(c.endMs)}}`,
    )
    .join(',\n');
  const total = Math.max(1, Math.round(totalMs));
  const edge = 16;
  return `
  <script>
    (function () {
      var caps = [
${entries}
      ];
      var total = ${total};
      caps.forEach(function (c) {
        var el = document.getElementById(c.id);
        if (!el) return;
        var pre = Math.max(0, (c.startMs - ${edge}) / total);
        var on = c.startMs / total;
        var off = Math.min(1, (c.endMs) / total);
        var postOff = Math.min(1, (c.endMs + ${edge}) / total);
        el.animate([
          { opacity: 0, offset: 0 },
          { opacity: 0, offset: pre },
          { opacity: 1, offset: on },
          { opacity: 1, offset: off },
          { opacity: 0, offset: postOff },
          { opacity: 0, offset: 1 }
        ], { duration: total, fill: 'both', easing: 'linear' });
      });
    })();
  </script>`;
}

function escapeAttr(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    if (c === '&') return '&amp;';
    if (c === '<') return '&lt;';
    if (c === '>') return '&gt;';
    if (c === '"') return '&quot;';
    return '&#39;';
  });
}

function escapeText(s: string): string {
  return s.replace(/[&<>]/g, (c) => {
    if (c === '&') return '&amp;';
    if (c === '<') return '&lt;';
    return '&gt;';
  });
}

export const generateCommand = defineCommand({
  meta: {
    name: 'generate',
    description:
      'Generate a video. Two modes: synthesize (narration + voice → ElevenLabs TTS) or byo (pre-rendered audio + word-level timings).',
  },
  args: {
    config: {
      type: 'positional',
      description: 'JSON config file',
      required: true,
    },
    output: {
      type: 'string',
      alias: 'o',
      description: 'Output MP4 path',
      default: 'out/video.mp4',
    },
    audio: {
      type: 'string',
      description: 'Pre-rendered audio file — switches to byo mode, overrides config.audio',
    },
    timings: {
      type: 'string',
      description: 'Word-level timings file (SRT or Whisper JSON) — overrides config.timings',
    },
    chrome: {
      type: 'string',
      description: 'Chrome/Chromium executable path (default: auto-detect)',
    },
    ffmpeg: {
      type: 'string',
      description: 'ffmpeg binary',
      default: 'ffmpeg',
    },
    apiKey: {
      type: 'string',
      description: 'ElevenLabs API key (synthesize mode; else $ELEVENLABS_API_KEY)',
    },
    srt: {
      type: 'string',
      description: 'Also write a word-level SRT file (sentence-level SRT is always written next to the MP4)',
    },
    noCaptions: {
      type: 'boolean',
      description: 'Do not inject a DOM caption overlay into the generated HTML',
      default: false,
    },
    tiktokCaptions: {
      type: 'boolean',
      description: 'Use TikTok-style paged captions with per-word color highlight (instead of sentence-level)',
      default: false,
    },
    tiktokThreshold: {
      type: 'string',
      description: 'Milliseconds threshold for grouping words into a TikTok page (default 1200)',
      default: '1200',
    },
    burn: {
      type: 'boolean',
      description: 'Also burn the sentence-level SRT into the video via ffmpeg (requires ffmpeg with libass). DOM captions are the recommended path — this flag is for users who need an additional ffmpeg-burnt layer.',
      default: false,
    },
    subtitleStyle: {
      type: 'string',
      description: 'libass style override for burnt subtitles',
    },
    keepWorkdir: {
      type: 'boolean',
      description: 'Keep the intermediate HTML + audio',
      default: false,
    },
  },
  async run({ args }) {
    const configPath = resolvePath(args.config);
    const configDir = dirname(configPath);
    const raw = JSON.parse(await readFile(configPath, 'utf8')) as unknown;
    const config = parseGenerateConfig(raw);

    // CLI --audio / --timings override the config fields.
    const audioOverride = typeof args.audio === 'string' ? args.audio : undefined;
    const timingsOverride = typeof args.timings === 'string' ? args.timings : undefined;

    const effectiveAudio = audioOverride ?? config.audio;
    const effectiveTimings = timingsOverride ?? config.timings;

    const whisperBinary: string | undefined =
      typeof args.whisperBinary === 'string' && args.whisperBinary !== ''
        ? args.whisperBinary
        : process.env.WHISPER_BINARY;
    const whisperModel: string | undefined =
      typeof args.whisperModel === 'string' && args.whisperModel !== ''
        ? args.whisperModel
        : process.env.WHISPER_MODEL;
    const whisperLang: string =
      typeof args.whisperLang === 'string' ? args.whisperLang : '';
    const canAutoTranscribe = Boolean(whisperBinary && whisperModel);

    // Modes: byo-full (audio+timings) / byo-whisper (audio, auto-STT) / synthesize.
    const byoMode = Boolean(effectiveAudio);
    const needsWhisper = byoMode && !effectiveTimings;

    if (effectiveTimings && !effectiveAudio) {
      console.error('--timings / config.timings requires --audio / config.audio');
      process.exit(2);
    }
    if (needsWhisper && !canAutoTranscribe) {
      console.error(
        'audio supplied without timings — pass --timings, or set --whisper-binary + --whisper-model (or $WHISPER_BINARY + $WHISPER_MODEL) for auto-transcription',
      );
      process.exit(2);
    }

    const chromePath =
      args.chrome ?? resolveChrome({ envValue: process.env.CHROME_PATH });
    if (!chromePath) {
      console.error('Could not find Chrome/Chromium. Pass --chrome <path>.');
      process.exit(2);
    }

    const outputPath = resolvePath(args.output);
    await mkdir(dirname(outputPath), { recursive: true });
    const workdir = resolvePath(dirname(outputPath), `__generate_${Date.now()}`);
    await mkdir(workdir, { recursive: true });

    // Produce audioBuffer + wordTimings regardless of mode.
    let audioBuffer: Buffer;
    let audioExt: string;
    let wordTimings: WordTiming[];
    let audioDurationMs: number;

    if (byoMode) {
      const audioAbs = resolvePath(configDir, effectiveAudio!);
      console.error(`→ loading audio ${audioAbs}`);
      audioBuffer = await readFile(audioAbs);
      audioExt = extname(audioAbs) || '.mp3';

      if (effectiveTimings) {
        const timingsAbs = resolvePath(configDir, effectiveTimings);
        console.error(`→ parsing timings ${timingsAbs}`);
        const timingsText = await readFile(timingsAbs, 'utf8');
        wordTimings = parseTimingsText(timingsText);
      } else {
        console.error(`→ transcribing via whisper.cpp (${whisperBinary})`);
        const stt = createWhisperCppProvider({
          whisperBinary: whisperBinary!,
          modelPath: whisperModel!,
          ffmpegBinary: args.ffmpeg,
        });
        const sttResult = await stt.transcribe({
          audioPath: audioAbs,
          ...(whisperLang !== '' ? { language: whisperLang } : {}),
        });
        wordTimings = sttResult.wordTimings;
      }

      if (wordTimings.length === 0) {
        console.error('No word-level timings produced — cannot align slides.');
        process.exit(3);
      }
      audioDurationMs = wordTimings[wordTimings.length - 1]!.endMs;
    } else {
      const apiKey = args.apiKey ?? config.apiKey ?? process.env.ELEVENLABS_API_KEY;
      if (!apiKey) {
        console.error('Missing API key — pass --api-key or set ELEVENLABS_API_KEY.');
        process.exit(2);
      }
      console.error(
        `→ synthesizing narration (${config.narration!.length} chars, voice=${config.voice})`,
      );
      const tts = createElevenLabsProvider({
        apiKey,
        ...(config.modelId ? { modelId: config.modelId } : {}),
      });
      const result = await tts.synthesize({
        text: config.narration!,
        voice: config.voice!,
      });
      if (!result.wordTimings || result.wordTimings.length === 0) {
        console.error('ElevenLabs did not return word timings — cannot align slides.');
        process.exit(3);
      }
      audioBuffer = result.audio;
      audioExt = '.mp3';
      wordTimings = result.wordTimings;
      audioDurationMs = result.durationMs;
    }

    const sentences = splitSentences(wordTimings);
    const resolvedImages = config.images.map((img) => resolvePath(configDir, img));
    const stagedImages: string[] = [];
    for (let i = 0; i < resolvedImages.length; i++) {
      const src = resolvedImages[i]!;
      const ext = extname(src) || '.png';
      const dest = join(workdir, `asset_${i}${ext}`);
      await copyFile(src, dest);
      stagedImages.push(basename(dest));
    }
    const slides = assignSlides(sentences, stagedImages);

    const audioFile = `narration${audioExt}`;
    const audioPath = join(workdir, audioFile);
    await writeFile(audioPath, audioBuffer);

    const sentenceCaps = sentenceCaptions(sentences);
    let tiktokPages: TikTokPage[] | undefined;
    if (!args.noCaptions && args.tiktokCaptions) {
      const wordCaps = wordTimingsToCaptions(wordTimings);
      const thresholdMs = Number.parseInt(args.tiktokThreshold, 10);
      const { pages } = createTikTokStyleCaptions({
        captions: wordCaps,
        combineTokensWithinMs: Number.isFinite(thresholdMs) ? thresholdMs : 1200,
      });
      tiktokPages = pages;
    }

    const htmlPath = join(workdir, 'index.html');
    await writeFile(
      htmlPath,
      buildGenerateHtml({
        width: config.width,
        height: config.height,
        fps: config.fps,
        slides,
        audioRelative: audioFile,
        audioDurationMs,
        ...(args.noCaptions
          ? {}
          : tiktokPages
            ? { tikTokPages: tiktokPages }
            : { captions: sentenceCaps }),
      }),
    );

    console.error(
      `→ rendering ${config.width}x${config.height} @ ${config.fps}fps, ${sentences.length} sentence(s) → ${slides.length} slide(s)`,
    );

    const compiled = await compileHtmlFile(htmlPath);
    const silentPath = join(workdir, 'silent.mp4');
    const progressEvery = Math.max(1, Math.floor(config.fps));
    await renderChrome({
      project: compiled.project,
      htmlPath: compiled.htmlPath!,
      outputPath: silentPath,
      executablePath: chromePath,
      ffmpegBinary: args.ffmpeg,
      onProgress: ({ frame, total }) => {
        if (frame % progressEvery === 0 || frame === total) {
          process.stderr.write(`\r  frame ${frame}/${total}`);
        }
      },
    });
    process.stderr.write('\n');

    console.error(`→ muxing audio`);
    const sentenceSrtPath = outputPath.replace(/\.mp4$/i, '.srt');
    const sentenceSrtBody = captionsToSrt(sentenceCaps);
    await writeFile(sentenceSrtPath, sentenceSrtBody, 'utf8');

    const muxOutput = args.burn ? join(workdir, 'muxed.mp4') : outputPath;
    await muxAudio({
      silentVideoPath: silentPath,
      outputPath: muxOutput,
      project: compiled.project,
      baseDir: compiled.baseDir,
      ffmpegBinary: args.ffmpeg,
    });

    if (args.burn) {
      console.error(`→ burning subtitles`);
      await burnSubtitles({
        videoPath: muxOutput,
        subtitlesPath: sentenceSrtPath,
        outputPath,
        ffmpegBinary: args.ffmpeg,
        ...(args.subtitleStyle ? { style: args.subtitleStyle } : {}),
      });
      await unlink(muxOutput).catch(() => undefined);
    }

    if (args.srt) {
      const captions = wordTimingsToCaptions(wordTimings);
      await writeFile(resolvePath(args.srt), captionsToSrt(captions), 'utf8');
      console.error(`✓ ${resolvePath(args.srt)} (${captions.length} word captions)`);
    }

    if (!args.keepWorkdir) {
      await rm(workdir, { recursive: true, force: true });
    } else {
      console.error(`  workdir kept: ${workdir}`);
    }

    console.error(`✓ ${sentenceSrtPath}`);
    console.error(`✓ ${outputPath}`);
  },
});
