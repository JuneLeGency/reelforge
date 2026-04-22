import { describe, expect, test } from 'bun:test';
import {
  SPRING_PRESETS,
  expandSpringAnimation,
  isSpringEasingName,
  listSpringPresetNames,
  parseTransform,
  resolveSpringConfig,
  sampleSpring,
  serializeTransform,
} from '../slide-templates/spring';
import type { SlideAnimation } from '../slide-templates';

describe('SPRING_PRESETS registry', () => {
  test('exposes the three starter presets', () => {
    const names = listSpringPresetNames().sort();
    expect(names).toEqual(['spring-bouncy', 'spring-soft', 'spring-stiff']);
  });

  test('each preset has tension + friction', () => {
    for (const name of listSpringPresetNames()) {
      const cfg = SPRING_PRESETS[name]!;
      expect(cfg.tension).toBeGreaterThan(0);
      expect(cfg.friction).toBeGreaterThan(0);
    }
  });

  test('isSpringEasingName is strict', () => {
    expect(isSpringEasingName('spring-soft')).toBe(true);
    expect(isSpringEasingName('spring-bouncy')).toBe(true);
    expect(isSpringEasingName('cubic-bezier(.22,.9,.32,1)')).toBe(false);
    expect(isSpringEasingName('linear')).toBe(false);
    expect(isSpringEasingName(undefined)).toBe(false);
    expect(isSpringEasingName('')).toBe(false);
  });

  test('resolveSpringConfig matches by name', () => {
    expect(resolveSpringConfig('spring-soft')).toBe(SPRING_PRESETS['spring-soft']!);
    expect(resolveSpringConfig('nope')).toBeNull();
  });
});

describe('sampleSpring — physics sampling', () => {
  test('bouncy overshoots 1 at least once', () => {
    const cfg = SPRING_PRESETS['spring-bouncy']!;
    const samples = sampleSpring(cfg, 32);
    const max = Math.max(...samples);
    expect(max).toBeGreaterThan(1);
  });

  test('stiff damps quickly, peaks near 1 without much overshoot', () => {
    const cfg = SPRING_PRESETS['spring-stiff']!;
    const samples = sampleSpring(cfg, 32);
    const max = Math.max(...samples);
    expect(max).toBeLessThan(1.1);
  });

  test('all presets start at 0 and end near 1', () => {
    for (const name of listSpringPresetNames()) {
      const samples = sampleSpring(SPRING_PRESETS[name]!, 48);
      expect(samples[0]).toBe(0);
      expect(samples.at(-1)!).toBeGreaterThan(0.9);
      expect(samples.at(-1)!).toBeLessThan(1.1);
    }
  });

  test('returns samples+1 values (includes both endpoints)', () => {
    const out = sampleSpring(SPRING_PRESETS['spring-soft']!, 20);
    expect(out).toHaveLength(21);
  });
});

describe('parseTransform / serializeTransform', () => {
  test('single-function parse', () => {
    expect(parseTransform('translateY(40px)')).toEqual([
      { fn: 'translateY', value: 40, unit: 'px' },
    ]);
  });

  test('multi-function parse preserves order', () => {
    expect(parseTransform('translateY(22px) rotate(12deg)')).toEqual([
      { fn: 'translateY', value: 22, unit: 'px' },
      { fn: 'rotate', value: 12, unit: 'deg' },
    ]);
  });

  test('unitless numerics (scale)', () => {
    expect(parseTransform('scale(0.95)')).toEqual([
      { fn: 'scale', value: 0.95, unit: '' },
    ]);
  });

  test('negative values', () => {
    expect(parseTransform('translateX(-40px)')).toEqual([
      { fn: 'translateX', value: -40, unit: 'px' },
    ]);
  });

  test('comma multi-arg → null (not supported)', () => {
    expect(parseTransform('translate(10px, 20px)')).toBeNull();
    expect(parseTransform('scale(1, 0.5)')).toBeNull();
  });

  test('empty / none → empty array', () => {
    expect(parseTransform('')).toEqual([]);
    expect(parseTransform('none')).toEqual([]);
  });

  test('garbage → null', () => {
    expect(parseTransform('not-a-transform')).toBeNull();
    expect(parseTransform('translateY(abc)')).toBeNull();
  });

  test('round-trip serialize', () => {
    const parsed = parseTransform('translateY(22px) rotate(12deg)');
    expect(serializeTransform(parsed!)).toBe('translateY(22px) rotate(12deg)');
  });
});

describe('expandSpringAnimation', () => {
  const baseAnim: SlideAnimation = {
    selector: '#slide-0 .title',
    easing: 'spring-bouncy',
    keyframes: [
      { atMs: 0, props: { opacity: 0, transform: 'translateY(40px)' } },
      { atMs: 1000, props: { opacity: 1, transform: 'translateY(0px)' } },
    ],
  };

  test('expands into many keyframes with linear easing', () => {
    const expanded = expandSpringAnimation(baseAnim);
    expect(expanded.easing).toBe('linear');
    expect(expanded.keyframes.length).toBeGreaterThan(baseAnim.keyframes.length);
  });

  test('first and last keyframes match the source endpoints (values AND time)', () => {
    const expanded = expandSpringAnimation(baseAnim);
    expect(expanded.keyframes[0]!.atMs).toBe(0);
    expect(expanded.keyframes[0]!.props.opacity).toBe(0);
    expect(expanded.keyframes.at(-1)!.atMs).toBe(1000);
  });

  test('non-spring easing is returned unchanged', () => {
    const anim: SlideAnimation = {
      selector: '#x',
      easing: 'cubic-bezier(.22,.9,.32,1)',
      keyframes: [
        { atMs: 0, props: { opacity: 0 } },
        { atMs: 500, props: { opacity: 1 } },
      ],
    };
    const expanded = expandSpringAnimation(anim);
    expect(expanded).toBe(anim);
  });

  test('produces overshoot for bouncy — some intermediate opacity > 1', () => {
    const expanded = expandSpringAnimation(baseAnim);
    const opacities = expanded.keyframes
      .map((kf) => kf.props.opacity)
      .filter((v): v is number => typeof v === 'number');
    expect(Math.max(...opacities)).toBeGreaterThan(1);
  });

  test('transform interpolation happens per-axis', () => {
    const expanded = expandSpringAnimation(baseAnim);
    const midFrame = expanded.keyframes[Math.floor(expanded.keyframes.length / 2)]!;
    expect(typeof midFrame.props.transform).toBe('string');
    expect(midFrame.props.transform as string).toMatch(/translateY\(-?\d/);
  });

  test('multi-function transform interpolates each independently', () => {
    const anim: SlideAnimation = {
      selector: '#x',
      easing: 'spring-soft',
      keyframes: [
        { atMs: 0, props: { transform: 'translateY(22px) rotate(12deg)' } },
        { atMs: 500, props: { transform: 'translateY(0px) rotate(0deg)' } },
      ],
    };
    const expanded = expandSpringAnimation(anim);
    const mid = expanded.keyframes[Math.floor(expanded.keyframes.length / 2)]!;
    const m = (mid.props.transform as string).match(
      /translateY\((-?\d+(?:\.\d+)?)px\) rotate\((-?\d+(?:\.\d+)?)deg\)/,
    );
    expect(m).not.toBeNull();
    const y = Number.parseFloat(m![1]!);
    const rot = Number.parseFloat(m![2]!);
    // Should be somewhere between the endpoints.
    expect(y).toBeLessThan(22);
    expect(rot).toBeLessThan(12);
  });

  test('gracefully falls back when transform signatures mismatch', () => {
    const anim: SlideAnimation = {
      selector: '#x',
      easing: 'spring-soft',
      keyframes: [
        { atMs: 0, props: { transform: 'translateY(40px)' } },
        { atMs: 500, props: { transform: 'scale(1.2) rotate(30deg)' } },
      ],
    };
    // Should NOT throw; fallback keeps the non-interpolatable kf pair linear.
    const expanded = expandSpringAnimation(anim);
    expect(expanded.easing).toBe('linear');
    expect(expanded.keyframes.length).toBeGreaterThanOrEqual(2);
  });

  test('three-keyframe animation expands each segment independently', () => {
    const anim: SlideAnimation = {
      selector: '#x',
      easing: 'spring-stiff',
      keyframes: [
        { atMs: 0, props: { opacity: 0 } },
        { atMs: 500, props: { opacity: 1 } },
        { atMs: 1000, props: { opacity: 0 } },
      ],
    };
    const expanded = expandSpringAnimation(anim);
    // First kf at 0, last at 1000, both endpoints preserved.
    expect(expanded.keyframes[0]!.atMs).toBe(0);
    expect(expanded.keyframes.at(-1)!.atMs).toBe(1000);
    // Some kf should land near the 500ms midpoint.
    const mids = expanded.keyframes.filter(
      (kf) => kf.atMs > 400 && kf.atMs < 600,
    );
    expect(mids.length).toBeGreaterThan(0);
  });
});
