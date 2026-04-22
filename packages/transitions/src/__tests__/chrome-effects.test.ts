import { describe, expect, test } from 'bun:test';
import {
  CHROME_EFFECTS,
  listChromeEffects,
  resolveChromeEffect,
} from '../chrome-effects';

describe('CHROME_EFFECTS registry', () => {
  test('exposes the starter set', () => {
    const names = listChromeEffects().sort();
    expect(names).toEqual(['flash-black', 'flash-white', 'radial-pulse', 'wipe-sweep']);
  });

  test('each effect has the required shape', () => {
    for (const name of listChromeEffects()) {
      const fx = CHROME_EFFECTS[name]!;
      expect(fx.name).toBe(name);
      expect(typeof fx.description).toBe('string');
      expect(fx.description.length).toBeGreaterThan(0);
      expect(typeof fx.css).toBe('string');
      expect(fx.css.length).toBeGreaterThan(0);
      expect(typeof fx.emit).toBe('function');
    }
  });

  test('resolveChromeEffect returns null for unknown / empty input', () => {
    expect(resolveChromeEffect('nope')).toBeNull();
    expect(resolveChromeEffect('')).toBeNull();
    expect(resolveChromeEffect(undefined)).toBeNull();
  });

  test('resolveChromeEffect matches by name', () => {
    for (const name of listChromeEffects()) {
      expect(resolveChromeEffect(name)).toBe(CHROME_EFFECTS[name]!);
    }
  });
});

describe('flash-white effect', () => {
  const fx = CHROME_EFFECTS['flash-white']!;

  test('emits a single white overlay with scoped id', () => {
    const out = fx.emit({ id: 't0', atMs: 2000, durationMs: 400, totalDurationMs: 10000 });
    expect(out.html).toContain('id="fx-t0"');
    expect(out.html).toContain('class="rf-fx-flash white"');
    expect(out.animations).toHaveLength(1);
    expect(out.animations[0]!.selector).toBe('#fx-t0');
  });

  test('peaks at opacity 1 at exactly atMs', () => {
    const out = fx.emit({ id: 't0', atMs: 3000, durationMs: 600, totalDurationMs: 10000 });
    const peak = out.animations[0]!.keyframes.find((kf) => kf.props.opacity === 1);
    expect(peak).toBeDefined();
    expect(peak!.atMs).toBe(3000);
  });

  test('end of window is atMs + durationMs/2', () => {
    const out = fx.emit({ id: 't0', atMs: 5000, durationMs: 800, totalDurationMs: 10000 });
    const kfs = out.animations[0]!.keyframes;
    expect(kfs.at(-1)!.atMs).toBe(5400);
    expect(kfs.at(-1)!.props.opacity).toBe(0);
  });
});

describe('flash-black effect', () => {
  const fx = CHROME_EFFECTS['flash-black']!;

  test('uses the same base class as flash-white but a black modifier', () => {
    const out = fx.emit({ id: 't1', atMs: 1500, durationMs: 400, totalDurationMs: 5000 });
    expect(out.html).toContain('class="rf-fx-flash black"');
  });

  test('shares CSS with flash-white (only one .rf-fx-flash block across effects)', () => {
    expect(fx.css).toBe(CHROME_EFFECTS['flash-white']!.css);
  });
});

describe('wipe-sweep effect', () => {
  const fx = CHROME_EFFECTS['wipe-sweep']!;

  test('sweeps translateX from -120% → 0 → 120% centered on atMs', () => {
    const out = fx.emit({ id: 't0', atMs: 2500, durationMs: 600, totalDurationMs: 10000 });
    const kfs = out.animations[0]!.keyframes;
    const center = kfs.find((kf) => kf.props.transform === 'translateX(0%)');
    expect(center).toBeDefined();
    expect(center!.atMs).toBe(2500);
    expect(kfs[0]!.props.transform).toBe('translateX(-120%)');
    expect(kfs.at(-1)!.props.transform).toBe('translateX(120%)');
    expect(kfs.at(-1)!.atMs).toBe(2800);
  });
});

describe('radial-pulse effect', () => {
  const fx = CHROME_EFFECTS['radial-pulse']!;

  test('blooms scale 0.4 → 1 → 1.4 with opacity peak at atMs', () => {
    const out = fx.emit({ id: 't0', atMs: 4000, durationMs: 500, totalDurationMs: 8000 });
    const kfs = out.animations[0]!.keyframes;
    const peak = kfs.find((kf) => kf.props.opacity === 1);
    expect(peak).toBeDefined();
    expect(peak!.atMs).toBe(4000);
    expect(peak!.props.transform).toBe('scale(1)');
    expect(kfs[0]!.props.transform).toBe('scale(0.4)');
    expect(kfs.at(-1)!.props.transform).toBe('scale(1.4)');
  });
});

describe('edge cases', () => {
  test('window clamps to 0..totalDurationMs', () => {
    // atMs == 100, duration 400 → should clamp leading edge at 0
    const out = CHROME_EFFECTS['flash-white']!.emit({
      id: 't0',
      atMs: 100,
      durationMs: 400,
      totalDurationMs: 5000,
    });
    const kfs = out.animations[0]!.keyframes;
    // First keyframe is always at 0; second "pre-start" should not dip below 0
    for (const kf of kfs) {
      expect(kf.atMs).toBeGreaterThanOrEqual(0);
      expect(kf.atMs).toBeLessThanOrEqual(5000);
    }
  });

  test('atMs near end clamps trailing edge', () => {
    const out = CHROME_EFFECTS['flash-white']!.emit({
      id: 't0',
      atMs: 4900,
      durationMs: 400,
      totalDurationMs: 5000,
    });
    const kfs = out.animations[0]!.keyframes;
    for (const kf of kfs) {
      expect(kf.atMs).toBeLessThanOrEqual(5000);
    }
  });
});
