import { describe, expect, test } from 'bun:test';
import {
  bulletStagger,
  heroFadeUp,
  kenBurnsZoom,
  listTemplateNames,
  renderTemplatedComposition,
  resolveTemplate,
  splitReveal,
} from '../slide-templates';

describe('SLIDE_TEMPLATES registry', () => {
  test('exposes exactly the four starter templates', () => {
    const names = listTemplateNames().sort();
    expect(names).toEqual(['bullet-stagger', 'hero-fade-up', 'ken-burns-zoom', 'split-reveal']);
  });

  test('resolveTemplate returns null for unknown names', () => {
    expect(resolveTemplate('nope')).toBeNull();
    expect(resolveTemplate('')).toBeNull();
    expect(resolveTemplate(undefined)).toBeNull();
  });

  test('resolveTemplate returns the template for known names', () => {
    expect(resolveTemplate('hero-fade-up')).toBe(heroFadeUp);
    expect(resolveTemplate('ken-burns-zoom')).toBe(kenBurnsZoom);
    expect(resolveTemplate('bullet-stagger')).toBe(bulletStagger);
    expect(resolveTemplate('split-reveal')).toBe(splitReveal);
  });
});

describe('heroFadeUp template', () => {
  const out = heroFadeUp({
    index: 0,
    startMs: 0,
    endMs: 5000,
    title: 'Reelforge',
    subtitle: '程序化视频生成框架',
  });

  test('emits a single rooted section with expected classes', () => {
    expect(out.html).toContain('class="slide slide-hero-fade-up"');
    expect(out.html).toContain('id="slide-0"');
    expect(out.html).toContain('class="title"');
    expect(out.html).toContain('class="subtitle"');
    expect(out.html).toContain('class="accent-rule"');
    expect(out.html).toContain('class="scene-index"');
    expect(out.html).toContain('class="watermark"');
  });

  test('HTML-escapes user content', () => {
    const hostile = heroFadeUp({ index: 0, startMs: 0, endMs: 1000, title: '<script>' });
    expect(hostile.html).not.toContain('<script>');
    expect(hostile.html).toContain('&lt;script&gt;');
  });

  test('all animations are selector-scoped to this slide id', () => {
    for (const a of out.animations) {
      expect(a.selector.startsWith('#slide-0')).toBe(true);
    }
  });

  test('keyframes are sorted ascending and bounded to [0, slide.endMs]', () => {
    for (const a of out.animations) {
      for (let i = 1; i < a.keyframes.length; i++) {
        expect(a.keyframes[i]!.atMs).toBeGreaterThanOrEqual(a.keyframes[i - 1]!.atMs);
      }
      // All keyframes must be within the slide's visible window (or before it).
      for (const kf of a.keyframes) {
        expect(kf.atMs).toBeGreaterThanOrEqual(0);
        expect(kf.atMs).toBeLessThanOrEqual(5000);
      }
    }
  });

  test('exposes the scene cross-fade as the first animation', () => {
    expect(out.animations[0]!.selector).toBe('#slide-0');
  });
});

describe('kenBurnsZoom template', () => {
  test('scales the background image over the slide duration', () => {
    const out = kenBurnsZoom({
      index: 1,
      startMs: 2000,
      endMs: 7000,
      image: 'hero.jpg',
      title: 'Ken Burns',
    });
    expect(out.html).toContain('src="hero.jpg"');
    const bgAnim = out.animations.find((a) => a.selector.endsWith('.bg'));
    expect(bgAnim).toBeDefined();
    const last = bgAnim!.keyframes.at(-1)!;
    expect(last.props.transform).toBe('scale(1.08)');
  });

  test('omits <img> when no image is provided', () => {
    const out = kenBurnsZoom({ index: 0, startMs: 0, endMs: 1000, title: 'x' });
    expect(out.html).not.toContain('<img');
  });
});

describe('bulletStagger template', () => {
  test('emits one <li> per bullet with data-i index', () => {
    const out = bulletStagger({
      index: 0,
      startMs: 0,
      endMs: 8000,
      title: '三个核心',
      bullets: ['IR', '多前端', '多后端'],
    });
    expect(out.html).toContain('data-i="0"');
    expect(out.html).toContain('data-i="1"');
    expect(out.html).toContain('data-i="2"');
    expect(out.html).not.toContain('data-i="3"');
  });

  test('registers one entrance animation per bullet', () => {
    const out = bulletStagger({
      index: 0,
      startMs: 0,
      endMs: 6000,
      bullets: ['a', 'b', 'c'],
    });
    const bulletAnims = out.animations.filter((a) => a.selector.includes('.bullet['));
    expect(bulletAnims).toHaveLength(3);
  });

  test('staggers bullet entrance times by 150 ms each', () => {
    const out = bulletStagger({
      index: 0,
      startMs: 0,
      endMs: 6000,
      bullets: ['a', 'b', 'c'],
    });
    const starts = out.animations
      .filter((a) => a.selector.includes('.bullet['))
      .map((a) => a.keyframes.find((kf) => (kf.props.transform as string) === 'translateX(0px)')!.atMs)
      .sort((a, b) => a - b);
    expect(starts[1]! - starts[0]!).toBe(150);
    expect(starts[2]! - starts[1]!).toBe(150);
  });
});

describe('splitReveal template', () => {
  test('renders the title twice (top + bottom halves)', () => {
    const out = splitReveal({ index: 0, startMs: 0, endMs: 4000, title: 'Split' });
    const occurrences = (out.html.match(/>Split</g) || []).length;
    expect(occurrences).toBe(2);
  });

  test('top and bottom halves animate with opposite initial translateY', () => {
    const out = splitReveal({ index: 0, startMs: 0, endMs: 4000, title: 'x' });
    const top = out.animations.find((a) => a.selector.endsWith('.split-top span'))!;
    const bottom = out.animations.find((a) => a.selector.endsWith('.split-bottom span'))!;
    expect(top.keyframes[0]!.props.transform).toBe('translateY(-80px)');
    expect(bottom.keyframes[0]!.props.transform).toBe('translateY(80px)');
  });
});

describe('renderTemplatedComposition', () => {
  test('produces a valid-looking HTML document with stage + audio tag', () => {
    const html = renderTemplatedComposition({
      width: 1280,
      height: 720,
      fps: 30,
      totalDurationMs: 8000,
      slides: [
        {
          template: 'hero-fade-up',
          title: 'Hello',
          subtitle: 'World',
          startMs: 0,
          endMs: 4000,
        },
        {
          template: 'hero-fade-up',
          title: 'Second',
          startMs: 4000,
          endMs: 8000,
        },
      ],
      audioRelative: 'narr.mp3',
      audioDurationMs: 8000,
    });
    expect(html).toContain('data-rf-width="1280"');
    expect(html).toContain('data-rf-duration="8.000"');
    expect(html).toContain('<audio src="narr.mp3"');
    expect(html).toContain('id="slide-0"');
    expect(html).toContain('id="slide-1"');
    expect(html).toContain('var TOTAL = 8000');
  });

  test('injects template CSS only for templates that are used', () => {
    const html = renderTemplatedComposition({
      width: 1280,
      height: 720,
      fps: 30,
      totalDurationMs: 4000,
      slides: [
        {
          template: 'hero-fade-up',
          title: 'hi',
          startMs: 0,
          endMs: 4000,
        },
      ],
    });
    expect(html).toContain('.slide-hero-fade-up');
    // No other template was referenced — their CSS shouldn't leak in.
    expect(html).not.toContain('.slide-bullet-stagger');
    expect(html).not.toContain('.slide-split-reveal');
    expect(html).not.toContain('.slide-ken-burns');
  });

  test('mixed templates pull in each CSS block', () => {
    const html = renderTemplatedComposition({
      width: 1280,
      height: 720,
      fps: 30,
      totalDurationMs: 6000,
      slides: [
        { template: 'hero-fade-up', title: 'a', startMs: 0, endMs: 3000 },
        { template: 'bullet-stagger', title: 'b', bullets: ['x'], startMs: 3000, endMs: 6000 },
      ],
    });
    expect(html).toContain('.slide-hero-fade-up');
    expect(html).toContain('.slide-bullet-stagger');
  });

  test('throws on unknown template names with a helpful message', () => {
    expect(() =>
      renderTemplatedComposition({
        width: 1280,
        height: 720,
        fps: 30,
        totalDurationMs: 3000,
        slides: [{ template: 'no-such', startMs: 0, endMs: 3000 }],
      }),
    ).toThrow(/Unknown slide template/);
  });

  test('captions overlay JSON carries the correct sentence count', () => {
    const html = renderTemplatedComposition({
      width: 1280,
      height: 720,
      fps: 30,
      totalDurationMs: 4000,
      slides: [{ template: 'hero-fade-up', title: 'x', startMs: 0, endMs: 4000 }],
      captions: [
        { text: 'hi', startMs: 0, endMs: 2000, timestampMs: null, confidence: null },
        { text: 'bye', startMs: 2000, endMs: 4000, timestampMs: null, confidence: null },
      ],
    });
    expect(html).toContain('id="caption-0"');
    expect(html).toContain('id="caption-1"');
    expect(html).not.toContain('id="caption-2"');
  });
});
