import { describe, expect, test } from 'bun:test';
import {
  CHROME_EFFECTS,
  listChromeEffects,
  resolveChromeEffect,
} from '../chrome-effects';

describe('CHROME_EFFECTS registry', () => {
  test('exposes the full effect catalog', () => {
    const names = listChromeEffects().sort();
    expect(names).toEqual([
      'film-grain',
      'flash-black',
      'flash-white',
      'glitch-crack',
      'radial-pulse',
      'rgb-split',
      'scanlines',
      'shake',
      'wipe-sweep',
      'zoom-blur',
    ]);
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

describe('rgb-split effect', () => {
  const fx = CHROME_EFFECTS['rgb-split']!;

  test('emits two tinted layers (mag + cy) that peak at atMs', () => {
    const out = fx.emit({ id: 't0', atMs: 2000, durationMs: 500, totalDurationMs: 8000 });
    expect(out.html).toContain('rgb-layer mag');
    expect(out.html).toContain('rgb-layer cy');
    expect(out.animations).toHaveLength(2);
    for (const anim of out.animations) {
      const peak = anim.keyframes.find((kf) => kf.props.opacity === 1);
      expect(peak).toBeDefined();
      expect(peak!.atMs).toBe(2000);
    }
  });

  test('mag layer offsets negative X; cy layer offsets positive X', () => {
    const out = fx.emit({ id: 't0', atMs: 1000, durationMs: 400, totalDurationMs: 5000 });
    const mag = out.animations.find((a) => a.selector.includes('.mag'))!;
    const cy = out.animations.find((a) => a.selector.includes('.cy'))!;
    expect((mag.keyframes[0]!.props.transform as string)).toContain('translateX(-');
    expect((cy.keyframes[0]!.props.transform as string)).toMatch(/translateX\(\d/);
  });
});

describe('film-grain effect', () => {
  const fx = CHROME_EFFECTS['film-grain']!;

  test('uses an inline SVG noise background image', () => {
    expect(fx.css).toContain('data:image/svg+xml');
    expect(fx.css).toContain('feTurbulence');
  });

  test('emits a single overlay that pulses opacity', () => {
    const out = fx.emit({ id: 't0', atMs: 1500, durationMs: 400, totalDurationMs: 5000 });
    expect(out.html).toContain('rf-fx-film-grain');
    expect(out.animations).toHaveLength(1);
    const peak = out.animations[0]!.keyframes.find((kf) => kf.props.opacity === 1);
    expect(peak).toBeDefined();
    expect(peak!.atMs).toBe(1500);
  });
});

describe('scanlines effect', () => {
  const fx = CHROME_EFFECTS['scanlines']!;

  test('uses repeating-linear-gradient for the scan line pattern', () => {
    expect(fx.css).toContain('repeating-linear-gradient');
    expect(fx.css).toContain('mix-blend-mode: multiply');
  });

  test('peaks at atMs', () => {
    const out = fx.emit({ id: 't0', atMs: 3000, durationMs: 600, totalDurationMs: 9000 });
    const peak = out.animations[0]!.keyframes.find((kf) => kf.props.opacity === 1);
    expect(peak!.atMs).toBe(3000);
  });
});

describe('glitch-crack effect', () => {
  const fx = CHROME_EFFECTS['glitch-crack']!;

  test('uses ::before + ::after for the two colour bands', () => {
    expect(fx.css).toContain('::before');
    expect(fx.css).toContain('::after');
  });

  test('uses stepped easing for a flicker feel', () => {
    const out = fx.emit({ id: 't0', atMs: 1200, durationMs: 300, totalDurationMs: 5000 });
    expect(out.animations[0]!.easing).toMatch(/steps/);
  });
});

describe('shake effect', () => {
  const fx = CHROME_EFFECTS['shake']!;

  test('targets #stage (not an overlay) and emits empty HTML', () => {
    const out = fx.emit({ id: 't0', atMs: 2000, durationMs: 400, totalDurationMs: 6000 });
    expect(out.html).toBe('');
    expect(out.animations).toHaveLength(1);
    expect(out.animations[0]!.selector).toBe('#stage');
  });

  test('keyframes start and end at translate(0,0) so the stage settles', () => {
    const out = fx.emit({ id: 't0', atMs: 2500, durationMs: 500, totalDurationMs: 8000 });
    const kfs = out.animations[0]!.keyframes;
    expect(kfs[0]!.props.transform).toBe('translate(0px, 0px)');
    expect(kfs.at(-1)!.props.transform).toBe('translate(0px, 0px)');
    // At least one intermediate frame has a non-zero offset.
    const hasOffset = kfs.some(
      (kf) => typeof kf.props.transform === 'string' && kf.props.transform !== 'translate(0px, 0px)',
    );
    expect(hasOffset).toBe(true);
  });
});

describe('zoom-blur effect', () => {
  const fx = CHROME_EFFECTS['zoom-blur']!;

  test('targets #stage; peak frame has filter: blur + scale up', () => {
    const out = fx.emit({ id: 't0', atMs: 1800, durationMs: 300, totalDurationMs: 6000 });
    expect(out.html).toBe('');
    expect(out.animations[0]!.selector).toBe('#stage');
    const peak = out.animations[0]!.keyframes.find(
      (kf) =>
        typeof kf.props.filter === 'string' && (kf.props.filter as string).includes('blur(7px)'),
    );
    expect(peak).toBeDefined();
    expect((peak!.props.transform as string)).toBe('scale(1.06)');
  });

  test('returns to blur(0) scale(1) after the peak', () => {
    const out = fx.emit({ id: 't0', atMs: 2000, durationMs: 300, totalDurationMs: 6000 });
    const last = out.animations[0]!.keyframes.at(-1)!;
    expect(last.props.filter).toBe('blur(0px)');
    expect(last.props.transform).toBe('scale(1)');
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
