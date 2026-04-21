import { describe, expect, test } from 'bun:test';
import { RUNTIME_SCRIPT } from '../runtime';

describe('RUNTIME_SCRIPT', () => {
  test('parses as valid JavaScript (no syntax errors)', () => {
    expect(() => new Function(RUNTIME_SCRIPT)).not.toThrow();
  });

  test('exposes window.__rf API when executed in a minimal DOM shim', () => {
    const w: Record<string, unknown> = {};
    const addedListeners: Array<{ event: string; cb: () => void }> = [];
    const doc = {
      readyState: 'complete',
      getAnimations: () => [],
    };
    const sandboxGlobals = {
      window: w,
      document: doc,
      console: console,
    };
    const fn = new Function(
      'window',
      'document',
      'console',
      'addEventListener',
      RUNTIME_SCRIPT,
    );
    fn(
      sandboxGlobals.window,
      sandboxGlobals.document,
      sandboxGlobals.console,
      (event: string, cb: () => void) => {
        addedListeners.push({ event, cb });
      },
    );
    const rf = w.__rf as {
      ready: boolean;
      registerAdapter: (a: { name: string; seek: () => void }) => void;
      seekFrame: (ms: number) => void;
      adapters: unknown[];
    };
    expect(typeof rf).toBe('object');
    expect(typeof rf.registerAdapter).toBe('function');
    expect(typeof rf.seekFrame).toBe('function');
    expect(rf.ready).toBe(true);
    expect(Array.isArray(rf.adapters)).toBe(true);
    // WAAPI adapter got auto-registered because document.getAnimations exists.
    expect(rf.adapters).toHaveLength(1);
  });

  test('seekFrame invokes each adapter and swallows errors', () => {
    const w: Record<string, unknown> = {};
    const doc = { readyState: 'complete', getAnimations: undefined };
    const fn = new Function('window', 'document', 'console', 'addEventListener', RUNTIME_SCRIPT);
    fn(w, doc, { warn: () => undefined }, () => undefined);
    const rf = w.__rf as {
      registerAdapter: (a: { name: string; seek: (ctx: unknown) => void }) => void;
      seekFrame: (ms: number) => void;
    };
    const bag: { ctx: { timeMs: number; timeSec: number } | null } = { ctx: null };
    rf.registerAdapter({
      name: 'test',
      seek: (ctx) => {
        bag.ctx = ctx as { timeMs: number; timeSec: number };
      },
    });
    rf.registerAdapter({
      name: 'boom',
      seek: () => {
        throw new Error('nope');
      },
    });
    rf.seekFrame(1500);
    expect(bag.ctx).toEqual({ timeMs: 1500, timeSec: 1.5 });
  });
});
