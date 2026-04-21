import { copyFile, mkdir, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve as resolvePath } from 'node:path';
import { defineCommand } from 'citty';
import type { Caption, WordTiming } from '@reelforge/captions';
import { captionsToSrt, wordTimingsToCaptions } from '@reelforge/captions';
import { compileHtmlFile } from '@reelforge/html';
import { renderChrome } from '@reelforge/engine-chrome';
import { burnSubtitles, muxAudio } from '@reelforge/mux';
import { createElevenLabsProvider } from '@reelforge/providers-tts-elevenlabs';
import { resolveChrome } from '../util/chrome';

export interface GenerateConfig {
  narration: string;
  images: string[];
  voice: string;
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
  if (typeof r.narration !== 'string' || r.narration.trim() === '') {
    throw new GenerateConfigError('config.narration must be a non-empty string');
  }
  if (!Array.isArray(r.images) || r.images.length === 0) {
    throw new GenerateConfigError('config.images must be a non-empty array');
  }
  for (const img of r.images) {
    if (typeof img !== 'string' || img === '') {
      throw new GenerateConfigError('config.images entries must be non-empty strings');
    }
  }
  if (typeof r.voice !== 'string' || r.voice === '') {
    throw new GenerateConfigError('config.voice is required');
  }
  return {
    narration: r.narration,
    images: r.images as string[],
    voice: r.voice,
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
}

export interface BuildHtmlOptions {
  width: number;
  height: number;
  fps: number;
  slides: readonly SlideSpec[];
  audioRelative: string;
  audioDurationMs: number;
  title?: string;
  /** When provided, each entry becomes a WAAPI-animated overlay div. */
  captions?: readonly Caption[];
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
  const style = { ...DEFAULT_CAPTION_STYLE, ...(opts.captionStyle ?? {}) };

  const imgTags = slides
    .map((s, i) => {
      const startSec = (s.startMs / 1000).toFixed(3);
      const durationSec = (s.durationMs / 1000).toFixed(3);
      return `    <img src="${escapeAttr(s.image)}" data-start="${startSec}" data-duration="${durationSec}" data-fit="cover" alt="slide ${i + 1}">`;
    })
    .join('\n');

  const captionDivs = captions
    .map(
      (c, i) =>
        `    <div class="caption" id="caption-${i}">${escapeText(c.text.trim())}</div>`,
    )
    .join('\n');

  const captionScript =
    captions.length > 0
      ? renderCaptionScript(captions, totalMs)
      : '';

  const audioDurSec = (audioDurationMs / 1000).toFixed(3);
  const captionBottomVh = style.marginBottomPct;
  const captionMaxWidthVw = style.maxWidthPct;

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
    }
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
    }
  </style>
</head>
<body>
  <div id="stage">
${imgTags}
${captionDivs}
    <audio src="${escapeAttr(audioRelative)}" data-start="0" data-duration="${audioDurSec}"></audio>
  </div>${captionScript}
</body>
</html>
`;
}

function renderCaptionScript(captions: readonly Caption[], totalMs: number): string {
  const entries = captions
    .map(
      (c, i) =>
        `    {id:'caption-${i}',startMs:${Math.round(c.startMs)},endMs:${Math.round(c.endMs)}}`,
    )
    .join(',\n');
  const total = Math.max(1, Math.round(totalMs));
  const edge = 16; // ms — shorter than one frame at 60 fps, to snap opacity changes.
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
    description: 'Generate a video from a script + images via ElevenLabs TTS',
  },
  args: {
    config: {
      type: 'positional',
      description: 'JSON config file (narration, images, voice, ...)',
      required: true,
    },
    output: {
      type: 'string',
      alias: 'o',
      description: 'Output MP4 path',
      default: 'out/video.mp4',
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
      description: 'ElevenLabs API key (else $ELEVENLABS_API_KEY)',
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

    const apiKey = args.apiKey ?? config.apiKey ?? process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      console.error('Missing API key — pass --api-key or set ELEVENLABS_API_KEY.');
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

    console.error(
      `→ synthesizing narration (${config.narration.length} chars, voice=${config.voice})`,
    );
    const tts = createElevenLabsProvider({
      apiKey,
      ...(config.modelId ? { modelId: config.modelId } : {}),
    });
    const result = await tts.synthesize({
      text: config.narration,
      voice: config.voice,
    });
    if (!result.wordTimings || result.wordTimings.length === 0) {
      console.error('ElevenLabs did not return word timings — cannot align slides.');
      process.exit(3);
    }

    const sentences = splitSentences(result.wordTimings);
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

    const audioPath = join(workdir, 'narration.mp3');
    await writeFile(audioPath, result.audio);

    const sentenceCaps = sentenceCaptions(sentences);
    const htmlPath = join(workdir, 'index.html');
    await writeFile(
      htmlPath,
      buildGenerateHtml({
        width: config.width,
        height: config.height,
        fps: config.fps,
        slides,
        audioRelative: 'narration.mp3',
        audioDurationMs: result.durationMs,
        ...(args.noCaptions ? {} : { captions: sentenceCaps }),
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
      const captions = wordTimingsToCaptions(result.wordTimings);
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
