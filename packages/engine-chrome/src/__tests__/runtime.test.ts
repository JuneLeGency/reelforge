import { describe, expect, test } from 'bun:test';
import { RUNTIME_SCRIPT } from '../runtime';

describe('RUNTIME_SCRIPT', () => {
  test('parses as valid JavaScript (no syntax errors)', () => {
    expect(() => new Function(RUNTIME_SCRIPT)).not.toThrow();
  });

  test('exposes window.__rf API when executed in a minimal DOM shim', () => {
    const w: Record<string, unknown> = {};
    const doc = {
      readyState: 'complete',
      getAnimations: () => [],
      querySelectorAll: () => [],
    };
    const fn = new Function(
      'window',
      'document',
      'console',
      'addEventListener',
      RUNTIME_SCRIPT,
    );
    fn(w, doc, console, () => undefined);
    const rf = w.__rf as {
      ready: boolean;
      registerAdapter: (a: { name: string; seek: () => void }) => void;
      seekFrame: (ms: number) => Promise<unknown>;
      adapters: unknown[];
    };
    expect(typeof rf).toBe('object');
    expect(typeof rf.registerAdapter).toBe('function');
    expect(typeof rf.seekFrame).toBe('function');
    expect(rf.ready).toBe(true);
    expect(Array.isArray(rf.adapters)).toBe(true);
    // WAAPI adapter got auto-registered because document.getAnimations exists.
    // No video adapter since querySelectorAll returns [].
    expect(rf.adapters).toHaveLength(1);
  });

  test('seekFrame invokes each adapter, swallows errors, and returns a Promise', async () => {
    const w: Record<string, unknown> = {};
    const doc = {
      readyState: 'complete',
      getAnimations: undefined,
      querySelectorAll: () => [],
    };
    const fn = new Function('window', 'document', 'console', 'addEventListener', RUNTIME_SCRIPT);
    fn(w, doc, { warn: () => undefined }, () => undefined);
    const rf = w.__rf as {
      registerAdapter: (a: { name: string; seek: (ctx: unknown) => unknown }) => void;
      seekFrame: (ms: number) => Promise<unknown>;
    };
    const bag: { ctx: { timeMs: number; timeSec: number } | null; asyncDone: boolean } = {
      ctx: null,
      asyncDone: false,
    };
    rf.registerAdapter({
      name: 'sync',
      seek: (ctx) => {
        bag.ctx = ctx as { timeMs: number; timeSec: number };
      },
    });
    rf.registerAdapter({
      name: 'async',
      seek: () =>
        new Promise<void>((resolve) => {
          setTimeout(() => {
            bag.asyncDone = true;
            resolve();
          }, 5);
        }),
    });
    rf.registerAdapter({
      name: 'boom',
      seek: () => {
        throw new Error('nope');
      },
    });
    await rf.seekFrame(1500);
    expect(bag.ctx).toEqual({ timeMs: 1500, timeSec: 1.5 });
    expect(bag.asyncDone).toBe(true);
  });

  test('registers a video adapter only when <video data-start> exists', () => {
    const fakeVideo = {
      currentTime: 0,
      paused: false,
      pause: () => undefined,
      style: { visibility: 'visible' },
      getAttribute: (k: string) =>
        (({ 'data-start': '0', 'data-duration': '5' }) as Record<string, string>)[k] ?? null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    };
    const w: Record<string, unknown> = {};
    const doc = {
      readyState: 'complete',
      getAnimations: undefined,
      querySelectorAll: (sel: string) =>
        sel === 'video[data-start]' ? [fakeVideo] : [],
    };
    const fn = new Function('window', 'document', 'console', 'addEventListener', RUNTIME_SCRIPT);
    fn(w, doc, { warn: () => undefined }, () => undefined);
    const rf = w.__rf as {
      adapters: Array<{ name: string; seek: (ctx: unknown) => unknown }>;
    };
    const videoAdapter = rf.adapters.find((a) => a.name === 'video');
    expect(videoAdapter).toBeDefined();
  });

  test('video adapter sets currentTime inside the clip window and hides it outside', async () => {
    const events: Array<{ type: string; listener: () => void }> = [];
    const fakeVideo = {
      currentTime: 0,
      paused: true,
      pause: () => undefined,
      style: { visibility: '' },
      getAttribute: (k: string) =>
        (
          ({
            'data-start': '1',
            'data-duration': '3',
            'data-source-start': '2',
          }) as Record<string, string>
        )[k] ?? null,
      addEventListener: (type: string, listener: () => void) => {
        events.push({ type, listener });
      },
      removeEventListener: () => undefined,
    };
    const w: Record<string, unknown> = {};
    const doc = {
      readyState: 'complete',
      getAnimations: undefined,
      querySelectorAll: (sel: string) =>
        sel === 'video[data-start]' ? [fakeVideo] : [],
    };
    const fn = new Function('window', 'document', 'console', 'addEventListener', RUNTIME_SCRIPT);
    fn(w, doc, { warn: () => undefined }, () => undefined);
    const rf = w.__rf as { seekFrame: (ms: number) => Promise<unknown> };

    // Seek before the clip starts: video should hide, no currentTime change.
    await rf.seekFrame(500);
    expect(fakeVideo.style.visibility).toBe('hidden');
    expect(fakeVideo.currentTime).toBe(0);

    // Seek 500 ms inside the clip (absolute 1.5s) → sourceStart 2s + 0.5s = 2.5s.
    const pending = rf.seekFrame(1500);
    // The adapter wired a `seeked` listener; fire it to resolve.
    const seeked = events.find((e) => e.type === 'seeked');
    seeked?.listener();
    await pending;
    expect(fakeVideo.currentTime).toBeCloseTo(2.5, 3);
    expect(fakeVideo.style.visibility).toBe('visible');

    // After the clip (t > startMs + duration = 4000), hide again.
    await rf.seekFrame(5000);
    expect(fakeVideo.style.visibility).toBe('hidden');
  });
});
