import { mkdir } from 'node:fs/promises';
import { dirname, resolve as resolvePath } from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import type { VideoProject } from '@reelforge/ir';
import { planDuration } from '@reelforge/ir';
import { RUNTIME_SCRIPT } from './runtime';
import { spawnImagePipeFfmpeg } from './ffmpeg';
import {
  BEGIN_FRAME_CHROME_ARGS,
  createBeginFrameCapturer,
  enableBeginFrameControl,
} from './begin-frame';

export interface RenderChromeOptions {
  project: VideoProject;
  htmlPath: string;
  outputPath: string;
  /** Absolute path to a Chrome / Chromium / Edge executable. */
  executablePath: string;
  /** Extra flags for Chrome (prepended before the built-in defaults). */
  chromeArgs?: string[];
  ffmpegBinary?: string;
  /**
   * Override the total frame count. Default derives from
   * `planDuration(project) * project.config.fps`.
   */
  frameCount?: number;
  onProgress?: (p: { frame: number; total: number }) => void;
  /**
   * Opt into the `HeadlessExperimental.beginFrame` capture path. Deterministic
   * and faster on Linux. Disables HTML <video>/<audio> *playback* in the page
   * (compositor is paused between frames), so the built-in video adapter
   * won't produce moving video frames — use the standard screenshot path
   * for compositions that rely on real video playback.
   */
  useBeginFrame?: boolean;
}

export interface RenderChromeResult {
  outputPath: string;
  frameCount: number;
  durationMs: number;
}

const DEFAULT_CHROME_ARGS = [
  '--hide-scrollbars',
  '--mute-audio',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
  '--no-sandbox',
];

export async function renderChrome(opts: RenderChromeOptions): Promise<RenderChromeResult> {
  const { project, htmlPath, outputPath, executablePath, useBeginFrame } = opts;
  const { width, height, fps } = project.config;
  const durationMs = planDuration(project);
  const totalFrames = opts.frameCount ?? Math.max(1, Math.ceil((durationMs / 1000) * fps));
  const frameStepMs = 1000 / fps;

  await mkdir(dirname(resolvePath(outputPath)), { recursive: true });

  const flagSet = [
    ...(opts.chromeArgs ?? []),
    ...(useBeginFrame ? BEGIN_FRAME_CHROME_ARGS : []),
    ...DEFAULT_CHROME_ARGS,
  ];

  const browser: Browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: flagSet,
    defaultViewport: { width, height, deviceScaleFactor: 1 },
  });

  const ff = spawnImagePipeFfmpeg({ fps, outputPath }, opts.ffmpegBinary ?? 'ffmpeg');

  try {
    const page: Page = await browser.newPage();
    await page.evaluateOnNewDocument(RUNTIME_SCRIPT);
    await page.goto(pathToFileURL(resolvePath(htmlPath)).toString(), {
      waitUntil: 'networkidle0',
    });
    await page.waitForFunction(() => (window as unknown as { __rf?: { ready?: boolean } }).__rf?.ready === true, {
      timeout: 15_000,
    });

    // Absolute ticks for BeginFrame only need to be monotonic; a fixed epoch
    // keeps the sequence identical across runs.
    const TICK_EPOCH = 1_700_000_000_000;
    let captureFrame: (timeMs: number) => Promise<Buffer>;
    if (useBeginFrame) {
      const client = await page.createCDPSession();
      await enableBeginFrameControl(client);
      const capturer = createBeginFrameCapturer(client, { format: 'png' });
      captureFrame = (timeMs) => capturer(TICK_EPOCH + timeMs, frameStepMs);
    } else {
      captureFrame = async () => {
        const buf = (await page.screenshot({
          type: 'png',
          omitBackground: false,
        })) as Uint8Array;
        return Buffer.from(buf);
      };
    }

    for (let frame = 0; frame < totalFrames; frame++) {
      const timeMs = frame * frameStepMs;
      await page.evaluate(async (t: number) => {
        const w = window as unknown as {
          __rf?: { seekFrame: (ms: number) => Promise<unknown> };
        };
        await w.__rf?.seekFrame(t);
      }, timeMs);
      const buffer = await captureFrame(timeMs);
      await ff.write(buffer);
      opts.onProgress?.({ frame: frame + 1, total: totalFrames });
    }
  } finally {
    await browser.close().catch(() => undefined);
  }

  await ff.finish();

  return { outputPath, frameCount: totalFrames, durationMs };
}
