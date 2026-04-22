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
    // WAAPI auto-registered (document.getAnimations exists) + lottie (always
    // registered when window is available). No video/three/image since their
    // feature checks fail in this mock.
    const names = (rf.adapters as Array<{ name: string }>).map((a) => a.name).sort();
    expect(names).toEqual(['lottie', 'waapi']);
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

  test('registers a three.js adapter that sets __rf.threeTime and dispatches rf-seek', () => {
    const dispatched: Array<{ type: string; detail: unknown }> = [];
    class FakeCustomEvent {
      type: string;
      detail: unknown;
      constructor(type: string, init?: { detail?: unknown }) {
        this.type = type;
        this.detail = init?.detail;
      }
    }
    const w: Record<string, unknown> = {
      CustomEvent: FakeCustomEvent,
      dispatchEvent: (evt: { type: string; detail: unknown }) => {
        dispatched.push({ type: evt.type, detail: evt.detail });
        return true;
      },
    };
    const doc = {
      readyState: 'complete',
      getAnimations: undefined,
      querySelectorAll: () => [],
    };
    // Provide CustomEvent to the new Function sandbox explicitly — it's
    // referenced as an unscoped identifier by runtime.ts.
    const fn = new Function(
      'window',
      'document',
      'console',
      'addEventListener',
      'CustomEvent',
      RUNTIME_SCRIPT,
    );
    fn(w, doc, { warn: () => undefined }, () => undefined, FakeCustomEvent);
    const rf = w.__rf as {
      adapters: Array<{ name: string }>;
      seekFrame: (ms: number) => Promise<unknown>;
      threeTime?: number;
    };
    expect(rf.adapters.find((a) => a.name === 'three')).toBeDefined();
    rf.seekFrame(1500);
    expect(rf.threeTime).toBe(1500);
    const seekEvents = dispatched.filter((e) => e.type === 'rf-seek');
    expect(seekEvents.length).toBeGreaterThanOrEqual(1);
    expect((seekEvents[0]!.detail as { timeMs: number }).timeMs).toBe(1500);
  });

  test('lottie adapter calls goToAndStop per registered instance', () => {
    const calls: Array<{ frame: number; name: string }> = [];
    const makeAnim = (name: string, frameRate: number, totalFrames: number) => ({
      frameRate,
      totalFrames,
      goToAndStop: (frame: number) => {
        calls.push({ frame, name });
      },
    });
    const w: Record<string, unknown> = {};
    const doc = {
      readyState: 'complete',
      getAnimations: undefined,
      querySelectorAll: () => [],
    };
    const fn = new Function(
      'window',
      'document',
      'console',
      'addEventListener',
      'CustomEvent',
      RUNTIME_SCRIPT,
    );
    fn(w, doc, { warn: () => undefined }, () => undefined, undefined);
    const rf = w.__rf as {
      lottie: unknown[];
      seekFrame: (ms: number) => Promise<unknown>;
      adapters: Array<{ name: string }>;
    };
    expect(rf.adapters.find((a) => a.name === 'lottie')).toBeDefined();
    rf.lottie.push(makeAnim('plain', 30, 60));
    rf.lottie.push({ anim: makeAnim('scoped', 30, 60), startMs: 500 });
    rf.seekFrame(1000);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual({ frame: 30, name: 'plain' });
    expect(calls[1]).toEqual({ frame: 15, name: 'scoped' });
  });

  test('lottie adapter clamps frame to totalFrames - 1', () => {
    const calls: number[] = [];
    const anim = {
      frameRate: 30,
      totalFrames: 30,
      goToAndStop: (frame: number) => {
        calls.push(frame);
      },
    };
    const w: Record<string, unknown> = {};
    const doc = {
      readyState: 'complete',
      getAnimations: undefined,
      querySelectorAll: () => [],
    };
    const fn = new Function(
      'window',
      'document',
      'console',
      'addEventListener',
      'CustomEvent',
      RUNTIME_SCRIPT,
    );
    fn(w, doc, { warn: () => undefined }, () => undefined, undefined);
    const rf = w.__rf as { lottie: unknown[]; seekFrame: (ms: number) => Promise<unknown> };
    rf.lottie.push(anim);
    rf.seekFrame(100_000);
    expect(calls).toEqual([29]);
  });

  test('fade images install a WAAPI animation and are excluded from the simple visibility adapter', () => {
    const animations: Array<{ keyframes: unknown; opts: unknown }> = [];
    const makeImg = (start: string, duration: string, extra: Record<string, string> = {}) => {
      const attrs: Record<string, string> = {
        'data-start': start,
        'data-duration': duration,
        ...extra,
      };
      return {
        style: { visibility: '' },
        getAttribute: (k: string) => attrs[k] ?? null,
        animate: (keyframes: unknown, opts: unknown) => {
          animations.push({ keyframes, opts });
          return { pause: () => undefined, currentTime: 0 };
        },
      };
    };
    const imgs = [
      makeImg('0', '2', { 'data-rf-transition-out-ms': '500' }),
      makeImg('2', '2', { 'data-rf-transition-in-ms': '500', 'data-rf-transition-out-ms': '500' }),
    ];
    const w: Record<string, unknown> = {};
    const doc = {
      readyState: 'complete',
      getAnimations: undefined,
      documentElement: {
        getAttribute: (k: string) => (k === 'data-rf-duration' ? '4' : null),
      },
      querySelectorAll: (sel: string) =>
        sel === 'img[data-start][data-duration]' ? imgs : [],
    };
    const fn = new Function('window', 'document', 'console', 'addEventListener', RUNTIME_SCRIPT);
    fn(w, doc, { warn: () => undefined }, () => undefined);
    const rf = w.__rf as { adapters: Array<{ name: string }> };
    expect(animations.length).toBe(2);
    const opts = animations[0]!.opts as { duration: number; fill: string };
    expect(opts.duration).toBe(4000);
    expect(opts.fill).toBe('both');
    // With every img opted into fade, no simple-image adapter is registered.
    const imageAdapter = rf.adapters.find((a) => a.name === 'image');
    expect(imageAdapter).toBeUndefined();
  });

  test('image adapter toggles visibility based on the active time window', () => {
    const imgs = [
      {
        style: { visibility: '' },
        getAttribute: (k: string) =>
          (({ 'data-start': '0', 'data-duration': '2' }) as Record<string, string>)[k] ?? null,
      },
      {
        style: { visibility: '' },
        getAttribute: (k: string) =>
          (({ 'data-start': '2', 'data-duration': '3' }) as Record<string, string>)[k] ?? null,
      },
    ];
    const w: Record<string, unknown> = {};
    const doc = {
      readyState: 'complete',
      getAnimations: undefined,
      querySelectorAll: (sel: string) =>
        sel === 'img[data-start][data-duration]' ? imgs : [],
    };
    const fn = new Function('window', 'document', 'console', 'addEventListener', RUNTIME_SCRIPT);
    fn(w, doc, { warn: () => undefined }, () => undefined);
    const rf = w.__rf as { seekFrame: (ms: number) => Promise<unknown> };

    // t = 500ms → first image visible, second hidden.
    rf.seekFrame(500);
    expect(imgs[0]!.style.visibility).toBe('visible');
    expect(imgs[1]!.style.visibility).toBe('hidden');

    // t = 2500ms → swap.
    rf.seekFrame(2500);
    expect(imgs[0]!.style.visibility).toBe('hidden');
    expect(imgs[1]!.style.visibility).toBe('visible');

    // t = 6000ms → both past end.
    rf.seekFrame(6000);
    expect(imgs[0]!.style.visibility).toBe('hidden');
    expect(imgs[1]!.style.visibility).toBe('hidden');
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
