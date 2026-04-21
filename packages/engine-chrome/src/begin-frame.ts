/**
 * BeginFrame-based capture path — deterministic atomic frame capture via
 * Chrome's `HeadlessExperimental.beginFrame` CDP method.
 *
 * One CDP call advances the compositor clock, runs layout/paint/composite,
 * and returns a screenshot. No wall-clock waits, no rAF races. The price is
 * that Chrome's video/audio pipelines rely on wall-clock in headless mode
 * and are effectively disabled — compositions with HTML <video> or <audio>
 * playback must stay on the standard screenshot path.
 *
 * Credit: algorithm borrowed from hyperframes' `screenshotService.ts`
 * (Apache 2.0). Our implementation is from-scratch, minus the naming of the
 * CDP parameters themselves.
 */
import type { CDPSession } from 'puppeteer-core';

/** Chrome CLI flags required for BeginFrame-based capture. */
export const BEGIN_FRAME_CHROME_ARGS = [
  '--run-all-compositor-stages-before-draw',
  '--disable-new-content-rendering-timeout',
  '--disable-threaded-animations',
  '--disable-threaded-scrolling',
  '--disable-checker-imaging',
  '--disable-image-animation-resync',
];

export interface BeginFrameCaptureOptions {
  format?: 'png' | 'jpeg';
  /** JPEG quality, 0..100. Ignored for PNG. */
  quality?: number;
}

export interface BeginFrameResult {
  buffer: Buffer;
  hasDamage: boolean;
}

const PENDING_FRAME_RETRIES = 5;

type BeginFrameRequest = {
  frameTimeTicks: number;
  interval: number;
  noDisplayUpdates?: boolean;
  screenshot?: { format: 'png' | 'jpeg'; quality?: number; optimizeForSpeed?: boolean };
};

type BeginFrameResponse = { hasDamage: boolean; screenshotData?: string };

/**
 * Enable HeadlessExperimental on the given CDP session. Safe to call more
 * than once; Chrome tolerates repeat enables but we only need one.
 */
export async function enableBeginFrameControl(client: CDPSession): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client.send as (m: string, p?: unknown) => Promise<unknown>)(
    'HeadlessExperimental.enable',
  );
}

async function sendBeginFrame(
  client: CDPSession,
  params: BeginFrameRequest,
): Promise<BeginFrameResponse> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const send = client.send as (method: string, params?: unknown) => Promise<unknown>;
  for (let attempt = 0; ; attempt++) {
    try {
      return (await send('HeadlessExperimental.beginFrame', params)) as BeginFrameResponse;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const pending = msg.includes('Another frame is pending');
      if (pending && attempt < PENDING_FRAME_RETRIES) {
        await new Promise((r) => setTimeout(r, 50 * 2 ** attempt));
        continue;
      }
      if (pending) {
        throw new Error(
          `[reelforge] beginFrame still pending after ${PENDING_FRAME_RETRIES} retries. ` +
            `Reduce parallelism or fall back to the standard screenshot path.`,
        );
      }
      throw err;
    }
  }
}

/**
 * Capture one frame via BeginFrame. `frameTimeTicks` is absolute time in ms
 * since epoch (Chrome requires monotonically non-decreasing ticks across
 * calls), `interval` is the frame step in ms.
 *
 * When Chrome reports `hasDamage=false` the compositor produced no visual
 * change; the caller should reuse the previous buffer rather than call
 * Page.captureScreenshot (which blocks in BeginFrame mode).
 */
export async function beginFrameCapture(
  client: CDPSession,
  frameTimeTicks: number,
  interval: number,
  options: BeginFrameCaptureOptions = {},
): Promise<BeginFrameResult> {
  const format = options.format ?? 'png';
  const screenshot = {
    format,
    optimizeForSpeed: true,
    ...(format === 'jpeg' ? { quality: options.quality ?? 80 } : {}),
  };
  const result = await sendBeginFrame(client, { frameTimeTicks, interval, screenshot });
  const buffer = result.screenshotData
    ? Buffer.from(result.screenshotData, 'base64')
    : Buffer.alloc(0);
  return { buffer, hasDamage: result.hasDamage };
}

/**
 * Wrap beginFrameCapture with a last-frame cache so hasDamage=false frames
 * reuse the previous screenshot instead of returning an empty buffer.
 */
export function createBeginFrameCapturer(client: CDPSession, options: BeginFrameCaptureOptions = {}) {
  let last: Buffer | null = null;
  return async (frameTimeTicks: number, interval: number): Promise<Buffer> => {
    const result = await beginFrameCapture(client, frameTimeTicks, interval, options);
    if (result.buffer.length > 0) {
      last = result.buffer;
      return result.buffer;
    }
    if (last) return last;
    // Frame 0 and nothing cached yet — nudge time by a sub-ms tick to force a paint.
    const fallback = await beginFrameCapture(
      client,
      frameTimeTicks + 0.001,
      interval,
      options,
    );
    if (fallback.buffer.length > 0) {
      last = fallback.buffer;
      return fallback.buffer;
    }
    // Genuinely blank frame (rare); return empty buffer. Callers should handle.
    return Buffer.alloc(0);
  };
}
