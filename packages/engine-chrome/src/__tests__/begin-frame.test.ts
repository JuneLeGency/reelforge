import { describe, expect, test } from 'bun:test';
import {
  BEGIN_FRAME_CHROME_ARGS,
  beginFrameCapture,
  createBeginFrameCapturer,
  enableBeginFrameControl,
} from '../begin-frame';
import type { CDPSession } from 'puppeteer-core';

interface MockSessionOptions {
  responses: Array<{ hasDamage: boolean; screenshotData?: string }>;
  pendingErrorsBefore?: number;
}

function mockSession(opts: MockSessionOptions): { client: CDPSession; calls: unknown[] } {
  const calls: unknown[] = [];
  let idx = 0;
  let pendingLeft = opts.pendingErrorsBefore ?? 0;
  const enableCalls: string[] = [];

  const send = async (method: string, params?: unknown): Promise<unknown> => {
    calls.push({ method, params });
    if (method === 'HeadlessExperimental.enable') {
      enableCalls.push(method);
      return undefined;
    }
    if (method === 'HeadlessExperimental.beginFrame') {
      if (pendingLeft > 0) {
        pendingLeft -= 1;
        throw new Error('Another frame is pending');
      }
      const resp = opts.responses[idx++] ?? { hasDamage: false };
      return resp;
    }
    throw new Error(`mock: unexpected method ${method}`);
  };

  return { client: { send } as unknown as CDPSession, calls };
}

const PNG_B64 = Buffer.from('PNG-BODY').toString('base64');
const PNG2_B64 = Buffer.from('PNG-BODY-2').toString('base64');

describe('BEGIN_FRAME_CHROME_ARGS', () => {
  test('includes the mandatory determinism flags', () => {
    expect(BEGIN_FRAME_CHROME_ARGS).toContain('--run-all-compositor-stages-before-draw');
    expect(BEGIN_FRAME_CHROME_ARGS).toContain('--disable-threaded-animations');
  });
});

describe('enableBeginFrameControl', () => {
  test('issues HeadlessExperimental.enable', async () => {
    const { client, calls } = mockSession({ responses: [] });
    await enableBeginFrameControl(client);
    expect((calls[0] as { method: string }).method).toBe('HeadlessExperimental.enable');
  });
});

describe('beginFrameCapture', () => {
  test('decodes base64 screenshotData into a Buffer', async () => {
    const { client } = mockSession({
      responses: [{ hasDamage: true, screenshotData: PNG_B64 }],
    });
    const result = await beginFrameCapture(client, 1000, 33.33);
    expect(result.hasDamage).toBe(true);
    expect(result.buffer.toString('utf8')).toBe('PNG-BODY');
  });

  test('empty buffer when compositor reports no damage', async () => {
    const { client } = mockSession({ responses: [{ hasDamage: false }] });
    const result = await beginFrameCapture(client, 1000, 33.33);
    expect(result.hasDamage).toBe(false);
    expect(result.buffer).toHaveLength(0);
  });

  test('PNG by default; JPEG forwards quality', async () => {
    const { client, calls } = mockSession({
      responses: [{ hasDamage: true, screenshotData: PNG_B64 }],
    });
    await beginFrameCapture(client, 1000, 33, { format: 'jpeg', quality: 90 });
    const params = (calls[0] as { params: { screenshot?: { format: string; quality?: number } } }).params;
    expect(params.screenshot?.format).toBe('jpeg');
    expect(params.screenshot?.quality).toBe(90);
  });

  test('retries up to 5 times on "Another frame is pending"', async () => {
    const { client } = mockSession({
      pendingErrorsBefore: 3,
      responses: [{ hasDamage: true, screenshotData: PNG_B64 }],
    });
    const result = await beginFrameCapture(client, 1000, 33);
    expect(result.buffer.length).toBeGreaterThan(0);
  });
});

describe('createBeginFrameCapturer', () => {
  test('returns last-good buffer when hasDamage=false', async () => {
    const { client } = mockSession({
      responses: [
        { hasDamage: true, screenshotData: PNG_B64 },
        { hasDamage: false }, // no new paint — reuse
        { hasDamage: true, screenshotData: PNG2_B64 },
      ],
    });
    const capture = createBeginFrameCapturer(client);
    const f0 = await capture(1000, 33);
    const f1 = await capture(1033, 33);
    const f2 = await capture(1066, 33);
    expect(f0.toString('utf8')).toBe('PNG-BODY');
    expect(f1.toString('utf8')).toBe('PNG-BODY'); // reused
    expect(f2.toString('utf8')).toBe('PNG-BODY-2');
  });

  test('forces a paint with a time-nudge on the very first no-damage frame', async () => {
    const { client } = mockSession({
      responses: [
        { hasDamage: false }, // primary call
        { hasDamage: true, screenshotData: PNG_B64 }, // nudge retry succeeds
      ],
    });
    const capture = createBeginFrameCapturer(client);
    const out = await capture(1000, 33);
    expect(out.toString('utf8')).toBe('PNG-BODY');
  });
});
