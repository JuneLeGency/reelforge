import { mkdir } from 'node:fs/promises';
import { dirname, resolve as resolvePath } from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import type { VideoProject } from '@reelforge/ir';
import { planDuration } from '@reelforge/ir';
import { RUNTIME_SCRIPT } from './runtime';
import { spawnImagePipeFfmpeg } from './ffmpeg';

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
  const { project, htmlPath, outputPath, executablePath } = opts;
  const { width, height, fps } = project.config;
  const durationMs = planDuration(project);
  const totalFrames = opts.frameCount ?? Math.max(1, Math.ceil((durationMs / 1000) * fps));
  const frameStepMs = 1000 / fps;

  await mkdir(dirname(resolvePath(outputPath)), { recursive: true });

  const browser: Browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [...(opts.chromeArgs ?? []), ...DEFAULT_CHROME_ARGS],
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

    for (let frame = 0; frame < totalFrames; frame++) {
      const timeMs = frame * frameStepMs;
      await page.evaluate(async (t: number) => {
        const w = window as unknown as {
          __rf?: { seekFrame: (ms: number) => Promise<unknown> };
        };
        await w.__rf?.seekFrame(t);
      }, timeMs);
      const buffer = (await page.screenshot({
        type: 'png',
        omitBackground: false,
      })) as Uint8Array;
      await ff.write(Buffer.from(buffer));
      opts.onProgress?.({ frame: frame + 1, total: totalFrames });
    }
  } finally {
    await browser.close().catch(() => undefined);
  }

  await ff.finish();

  return { outputPath, frameCount: totalFrames, durationMs };
}
