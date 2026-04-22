import { describe, expect, test } from 'bun:test';
import {
  listVisualStyleNames,
  resolveVisualStyle,
  VISUAL_STYLES,
} from '../visual-styles';
import { renderTemplatedComposition } from '../slide-templates';

describe('VISUAL_STYLES registry', () => {
  test('exposes six curated preset styles', () => {
    const names = listVisualStyleNames().sort();
    expect(names).toEqual([
      'dark-premium',
      'mint-fresh',
      'neon-electric',
      'swiss-pulse',
      'terminal-green',
      'warm-editorial',
    ]);
  });

  test('each style has the required shape', () => {
    for (const name of listVisualStyleNames()) {
      const s = VISUAL_STYLES[name]!;
      expect(s.name).toBe(name);
      expect(typeof s.description).toBe('string');
      expect(s.description.length).toBeGreaterThan(0);
      expect(typeof s.background).toBe('string');
      expect(s.background.length).toBeGreaterThan(0);
      expect(Array.isArray(s.palette)).toBe(true);
      expect(s.palette.length).toBeGreaterThanOrEqual(3);
      expect(typeof s.color).toBe('string');
      expect(typeof s.colorMuted).toBe('string');
      expect(typeof s.fontFamilyHeading).toBe('string');
      expect(typeof s.fontFamilyBody).toBe('string');
    }
  });

  test('resolveVisualStyle returns null for unknown / empty input', () => {
    expect(resolveVisualStyle('nope')).toBeNull();
    expect(resolveVisualStyle('')).toBeNull();
    expect(resolveVisualStyle(undefined)).toBeNull();
  });

  test('resolveVisualStyle matches registry entries exactly', () => {
    for (const name of listVisualStyleNames()) {
      expect(resolveVisualStyle(name)).toBe(VISUAL_STYLES[name]!);
    }
  });
});

describe('renderTemplatedComposition — visual style integration', () => {
  const baseOpts = {
    width: 1280,
    height: 720,
    fps: 30,
    totalDurationMs: 4000,
    slides: [
      {
        template: 'hero-fade-up',
        title: 'Hi',
        subtitle: 'World',
        startMs: 0,
        endMs: 4000,
      },
    ],
  };

  test('no style → default background and font', () => {
    const html = renderTemplatedComposition({ ...baseOpts });
    expect(html).toContain('#0a0a0f');
    expect(html).toContain('-apple-system');
  });

  test('style: "swiss-pulse" injects its background + CSS', () => {
    const html = renderTemplatedComposition({ ...baseOpts, style: 'swiss-pulse' });
    expect(html).toContain('background: #000000');
    expect(html).toContain('#ff2d2d'); // swiss-pulse's accent in extraCss
    expect(html).toContain('Helvetica'); // heading font family
  });

  test('style: "neon-electric" emits the gradient title CSS', () => {
    const html = renderTemplatedComposition({ ...baseOpts, style: 'neon-electric' });
    expect(html).toContain('-webkit-background-clip: text');
    expect(html).toContain('#05d9e8');
  });

  test('style: "terminal-green" uses monospace font and phosphor tint', () => {
    const html = renderTemplatedComposition({ ...baseOpts, style: 'terminal-green' });
    expect(html).toContain('#00ff41');
    expect(html).toMatch(/monospace/);
  });

  test('unknown style name throws', () => {
    expect(() =>
      renderTemplatedComposition({ ...baseOpts, style: 'does-not-exist' }),
    ).toThrow(/Unknown visual style/);
  });

  test('accepts a full VisualStyle object directly', () => {
    const html = renderTemplatedComposition({
      ...baseOpts,
      style: {
        name: 'custom',
        description: 'test',
        background: '#abcdef',
        palette: ['#111', '#222', '#333'],
        color: '#fff',
        colorMuted: '#eee',
        fontFamilyHeading: 'Comic Sans MS',
        fontFamilyBody: 'serif',
      },
    });
    expect(html).toContain('#abcdef');
    expect(html).toContain('Comic Sans MS');
  });
});
