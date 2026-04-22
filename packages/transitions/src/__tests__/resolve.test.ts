import { describe, expect, test } from 'bun:test';
import {
  ALIAS_TO_XFADE,
  XFADE_TRANSITIONS,
  buildXFadeExpr,
  isXFadeName,
  resolveTransition,
  TransitionResolveError,
} from '../index';

describe('isXFadeName', () => {
  test('accepts built-in ffmpeg xfade names', () => {
    for (const name of XFADE_TRANSITIONS) {
      expect(isXFadeName(name)).toBe(true);
    }
  });
  test('rejects unknown names', () => {
    expect(isXFadeName('not-a-real-xfade')).toBe(false);
    expect(isXFadeName('')).toBe(false);
  });
});

describe('resolveTransition — curated aliases', () => {
  test('"fade" maps to xfade:fade', () => {
    const t = resolveTransition({ name: 'fade', durationMs: 500 });
    expect(t).toEqual({ kind: 'xfade', xfade: 'fade', durationMs: 500 });
  });

  test('"cross-fade" alias → fade', () => {
    expect(resolveTransition({ name: 'cross-fade', durationMs: 500 })!.xfade).toBe('fade');
  });

  test('"wipe-left" → wipeleft (strips hyphen)', () => {
    expect(resolveTransition({ name: 'wipe-left', durationMs: 400 })!.xfade).toBe('wipeleft');
  });

  test('is case-insensitive on input', () => {
    expect(resolveTransition({ name: 'FADE', durationMs: 500 })!.xfade).toBe('fade');
  });

  test('preserves easing hint when provided', () => {
    const t = resolveTransition({
      name: 'fade',
      durationMs: 500,
      easing: 'ease-in-out',
    })!;
    expect(t.easing).toBe('ease-in-out');
  });
});

describe('resolveTransition — xfade: passthrough', () => {
  test('xfade:<name> honoured when the raw name is in XFADE_TRANSITIONS', () => {
    const t = resolveTransition({ name: 'xfade:slideleft', durationMs: 300 });
    expect(t).toEqual({ kind: 'xfade', xfade: 'slideleft', durationMs: 300 });
  });

  test('bare xfade names without prefix also resolve', () => {
    expect(resolveTransition({ name: 'fadeblack', durationMs: 500 })!.xfade).toBe('fadeblack');
  });

  test('xfade:nonexistent rejected with a helpful error', () => {
    expect(() =>
      resolveTransition({ name: 'xfade:nonexistent', durationMs: 500 }),
    ).toThrow(TransitionResolveError);
  });
});

describe('resolveTransition — edge cases', () => {
  test('name === "none" returns null', () => {
    expect(resolveTransition({ name: 'none', durationMs: 500 })).toBeNull();
  });

  test('empty name returns null', () => {
    expect(resolveTransition({ name: '', durationMs: 500 })).toBeNull();
  });

  test('non-positive duration rejected', () => {
    expect(() =>
      resolveTransition({ name: 'fade', durationMs: 0 }),
    ).toThrow(TransitionResolveError);
    expect(() =>
      resolveTransition({ name: 'fade', durationMs: -100 }),
    ).toThrow(TransitionResolveError);
  });

  test('unknown name rejected', () => {
    expect(() =>
      resolveTransition({ name: 'spiral-of-death', durationMs: 500 }),
    ).toThrow(/Unknown transition/);
  });

  test('every curated alias resolves without throwing', () => {
    for (const alias of Object.keys(ALIAS_TO_XFADE)) {
      const r = resolveTransition({ name: alias, durationMs: 500 });
      expect(r).not.toBeNull();
      expect(r!.kind).toBe('xfade');
    }
  });
});

describe('buildXFadeExpr', () => {
  test('formats a drop-in filter expression', () => {
    const t = { kind: 'xfade', xfade: 'fade', durationMs: 500 } as const;
    expect(buildXFadeExpr(t, 2.5)).toBe(
      'xfade=transition=fade:duration=0.500:offset=2.500',
    );
  });

  test('offsets and durations rounded to 3 decimals', () => {
    const t = { kind: 'xfade', xfade: 'wipeleft', durationMs: 333 } as const;
    expect(buildXFadeExpr(t, 1.234567)).toBe(
      'xfade=transition=wipeleft:duration=0.333:offset=1.235',
    );
  });
});
