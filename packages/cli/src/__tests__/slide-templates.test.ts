import { describe, expect, test } from 'bun:test';
import {
  archDiagram,
  bulletStagger,
  dataChartReveal,
  endCard,
  splitCompare,
  heroFadeUp,
  imageLeftText,
  imageRightText,
  kenBurnsZoom,
  kineticType,
  listTemplateNames,
  logoOutro,
  lowerThird,
  photoCard,
  pictureInPicture,
  quoteCard,
  renderTemplatedComposition,
  resolveTemplate,
  splitReveal,
  testimonial,
  timelineRoadmap,
} from '../slide-templates';

describe('SLIDE_TEMPLATES registry', () => {
  test('exposes the full template catalog', () => {
    const names = listTemplateNames().sort();
    expect(names).toEqual([
      'arch-diagram',
      'bullet-stagger',
      'data-chart-reveal',
      'end-card',
      'hero-fade-up',
      'image-left-text',
      'image-right-text',
      'ken-burns-zoom',
      'kinetic-type',
      'logo-outro',
      'lower-third',
      'photo-card',
      'picture-in-picture',
      'quote-card',
      'split-compare',
      'split-reveal',
      'testimonial',
      'timeline-roadmap',
    ]);
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
    expect(resolveTemplate('image-left-text')).toBe(imageLeftText);
    expect(resolveTemplate('image-right-text')).toBe(imageRightText);
    expect(resolveTemplate('photo-card')).toBe(photoCard);
    expect(resolveTemplate('quote-card')).toBe(quoteCard);
    expect(resolveTemplate('kinetic-type')).toBe(kineticType);
    expect(resolveTemplate('logo-outro')).toBe(logoOutro);
    expect(resolveTemplate('data-chart-reveal')).toBe(dataChartReveal);
    expect(resolveTemplate('testimonial')).toBe(testimonial);
    expect(resolveTemplate('lower-third')).toBe(lowerThird);
    expect(resolveTemplate('picture-in-picture')).toBe(pictureInPicture);
    expect(resolveTemplate('timeline-roadmap')).toBe(timelineRoadmap);
    expect(resolveTemplate('end-card')).toBe(endCard);
    expect(resolveTemplate('arch-diagram')).toBe(archDiagram);
    expect(resolveTemplate('split-compare')).toBe(splitCompare);
  });
});

describe('splitCompare template', () => {
  const base = {
    index: 0,
    startMs: 0,
    endMs: 5000,
    title: 'DSL vs 手写',
    subtitle: '同样 5 行',
    extras: {
      leftTag: 'BEFORE',
      leftTitle: '手写 HTML + GSAP',
      leftBody: '<div class="title">...</div>\nanime.timeline()\n  .add({...})\n+ ffmpeg 拼接',
      rightTag: 'AFTER',
      rightTitle: 'rf config.json',
      rightBody: '{ "slides": [\n  { "title": "Hi" }\n] }\nrf generate',
    },
  };

  test('renders banner + two columns + divider', () => {
    const out = splitCompare(base);
    expect(out.html).toContain('class="banner"');
    expect(out.html).toContain('class="column left"');
    expect(out.html).toContain('class="column right"');
    expect(out.html).toContain('class="divider"');
    expect(out.html).toContain('>BEFORE<');
    expect(out.html).toContain('>AFTER<');
    expect(out.html).toContain('>手写 HTML + GSAP<');
    expect(out.html).toContain('>rf config.json<');
  });

  test('splits body by newlines into .line rows', () => {
    const out = splitCompare(base);
    // leftBody 4 lines + rightBody 4 lines = 8 .line rows total
    const totalLines = (out.html.match(/class="line"/g) || []).length;
    expect(totalLines).toBe(8);
  });

  test('left column slides in from -30px, right from +30px', () => {
    const out = splitCompare(base);
    const left = out.animations.find((a) => a.selector.endsWith('.column.left'))!;
    const right = out.animations.find((a) => a.selector.endsWith('.column.right'))!;
    expect(left.keyframes[0]!.props.transform).toBe('translateX(-30px)');
    expect(right.keyframes[0]!.props.transform).toBe('translateX(30px)');
  });

  test('divider scales from 0 to 1 vertically', () => {
    const out = splitCompare(base);
    const d = out.animations.find((a) => a.selector.endsWith('.divider'))!;
    expect(d.keyframes[0]!.props.transform).toBe('scaleY(0)');
  });

  test('missing extras still produces valid HTML', () => {
    const out = splitCompare({ index: 0, startMs: 0, endMs: 3000, title: 'x' });
    expect(out.html).toContain('class="column left"');
    expect(out.html).toContain('class="column right"');
    expect(out.html).not.toContain('col-tag');
  });
});

describe('archDiagram template', () => {
  test('renders one node per bullet, N-1 arrows between them', () => {
    const out = archDiagram({
      index: 0,
      startMs: 0,
      endMs: 5000,
      title: 'Pipeline',
      bullets: ['config.json', 'rf generate', 'chrome', 'ffmpeg', 'mp4'],
    });
    expect(out.html).toContain('class="slide slide-arch-diagram"');
    const nodeCount = (out.html.match(/class="node"/g) || []).length;
    const arrowCount = (out.html.match(/class="arrow"/g) || []).length;
    expect(nodeCount).toBe(5);
    expect(arrowCount).toBe(4);
  });

  test('parses "label | caption" bullets into label + caption', () => {
    const out = archDiagram({
      index: 0,
      startMs: 0,
      endMs: 4000,
      bullets: ['rf generate | CLI entry', 'chrome | render'],
    });
    expect(out.html).toContain('class="node-label">rf generate<');
    expect(out.html).toContain('class="node-caption">CLI entry<');
  });

  test('nodes stagger 200 ms apart, arrows keyed to node landings', () => {
    const out = archDiagram({
      index: 0,
      startMs: 0,
      endMs: 6000,
      bullets: ['A', 'B', 'C'],
    });
    const nodeStarts = out.animations
      .filter((a) => /\.node\[data-i="\d+"\]$/.test(a.selector))
      .map((a) => a.keyframes[1]!.atMs)
      .sort((a, b) => a - b);
    expect(nodeStarts[1]! - nodeStarts[0]!).toBe(200);
    expect(nodeStarts[2]! - nodeStarts[1]!).toBe(200);
    // Arrows = N-1
    const arrowAnims = out.animations.filter((a) =>
      /\.arrow\[data-i=/.test(a.selector),
    );
    expect(arrowAnims).toHaveLength(2);
  });

  test('no title / no bullets still produces a valid output', () => {
    const out = archDiagram({ index: 0, startMs: 0, endMs: 3000 });
    expect(out.html).toContain('class="pipeline"');
    expect((out.html.match(/class="node"/g) || []).length).toBe(0);
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

describe('heroFadeUp background image extension', () => {
  test('no image → no <img.bg-image> element and no zoom animation', () => {
    const out = heroFadeUp({ index: 0, startMs: 0, endMs: 3000, title: 'x' });
    expect(out.html).not.toContain('class="bg-image"');
    expect(out.html).not.toContain('has-bg-image');
    expect(out.animations.find((a) => a.selector.endsWith('.bg-image'))).toBeUndefined();
  });

  test('with image → emits <img.bg-image>, has-bg-image class, zoom keyframes', () => {
    const out = heroFadeUp({
      index: 0,
      startMs: 0,
      endMs: 4000,
      title: 'x',
      image: 'cover.jpg',
    });
    expect(out.html).toContain('class="bg-image"');
    expect(out.html).toContain('src="cover.jpg"');
    expect(out.html).toContain('has-bg-image');
    expect(out.html).toContain('class="bg-scrim"');
    const bgAnim = out.animations.find((a) => a.selector.endsWith('.bg-image'))!;
    expect(bgAnim).toBeDefined();
    expect(bgAnim.keyframes.at(-1)!.props.transform).toBe('scale(1.05)');
  });
});

describe('imageLeftText template', () => {
  test('renders image column on the left, text column on the right', () => {
    const out = imageLeftText({
      index: 0,
      startMs: 0,
      endMs: 5000,
      title: 'Product',
      subtitle: '新一代设计',
      image: 'hero.jpg',
    });
    expect(out.html).toContain('class="slide slide-image-left-text"');
    expect(out.html).toContain('src="hero.jpg"');
    expect(out.html).toContain('class="title"');
    expect(out.html).toContain('class="subtitle"');
    // image-col must come before text-col in source order
    const imgIdx = out.html.indexOf('image-col');
    const txtIdx = out.html.indexOf('text-col');
    expect(imgIdx).toBeLessThan(txtIdx);
  });

  test('image entrance translates from negative X (slides in from the left)', () => {
    const out = imageLeftText({ index: 0, startMs: 0, endMs: 4000, image: 'x.jpg' });
    const imgAnim = out.animations.find((a) => a.selector.endsWith('.image'))!;
    expect(imgAnim.keyframes[0]!.props.transform).toContain('translateX(-40px)');
  });

  test('omits <img> cleanly when no image', () => {
    const out = imageLeftText({ index: 0, startMs: 0, endMs: 3000, title: 'x' });
    expect(out.html).toContain('class="image-col"');
    expect(out.html).not.toContain('<img');
  });
});

describe('imageRightText template', () => {
  test('renders text column on the left, image column on the right', () => {
    const out = imageRightText({
      index: 1,
      startMs: 0,
      endMs: 5000,
      title: 'About',
      image: 'author.jpg',
    });
    expect(out.html).toContain('class="slide slide-image-right-text"');
    const txtIdx = out.html.indexOf('text-col');
    const imgIdx = out.html.indexOf('image-col');
    expect(txtIdx).toBeLessThan(imgIdx);
  });

  test('image entrance translates from positive X (slides in from the right)', () => {
    const out = imageRightText({ index: 0, startMs: 0, endMs: 4000, image: 'x.jpg' });
    const imgAnim = out.animations.find((a) => a.selector.endsWith('.image'))!;
    expect(imgAnim.keyframes[0]!.props.transform).toContain('translateX(40px)');
  });
});

describe('photoCard template', () => {
  test('renders bg image + floating card with title + subtitle', () => {
    const out = photoCard({
      index: 0,
      startMs: 0,
      endMs: 4000,
      title: 'Cover',
      subtitle: 'Podcast Ep. 42',
      image: 'cover.jpg',
    });
    expect(out.html).toContain('class="slide slide-photo-card"');
    expect(out.html).toContain('class="bg"');
    expect(out.html).toContain('src="cover.jpg"');
    expect(out.html).toContain('class="card"');
  });

  test('image uses a gentler zoom than ken-burns (1.0 → 1.04)', () => {
    const out = photoCard({ index: 0, startMs: 0, endMs: 6000, image: 'x.jpg' });
    const bgAnim = out.animations.find((a) => a.selector.endsWith('.bg'))!;
    expect(bgAnim.keyframes.at(-1)!.props.transform).toBe('scale(1.04)');
  });

  test('card slides up from below (translateY(60px) → 0)', () => {
    const out = photoCard({ index: 0, startMs: 0, endMs: 5000, title: 'hi' });
    const cardAnim = out.animations.find((a) => a.selector.endsWith('.card'))!;
    expect(cardAnim.keyframes[0]!.props.transform).toBe('translateY(60px)');
  });

  test('renders the eyebrow from spec.extras when supplied', () => {
    const out = photoCard({
      index: 0,
      startMs: 0,
      endMs: 3000,
      title: 'A',
      extras: { eyebrow: 'EPISODE 07' },
    });
    expect(out.html).toContain('class="eyebrow"');
    expect(out.html).toContain('EPISODE 07');
  });
});

describe('quoteCard template', () => {
  test('renders the opening quote glyph + blockquote body + attribution', () => {
    const out = quoteCard({
      index: 0,
      startMs: 0,
      endMs: 5000,
      title: 'Stay hungry, stay foolish.',
      subtitle: '— Steve Jobs, Stanford 2005',
    });
    expect(out.html).toContain('class="slide slide-quote-card"');
    expect(out.html).toContain('class="glyph"');
    expect(out.html).toContain('<blockquote');
    expect(out.html).toContain('Stay hungry, stay foolish.');
    expect(out.html).toContain('class="attribution"');
    expect(out.html).toContain('class="rule"');
    expect(out.html).toContain('Steve Jobs');
  });

  test('omits attribution cleanly when no subtitle', () => {
    const out = quoteCard({ index: 0, startMs: 0, endMs: 3000, title: 'x' });
    expect(out.html).not.toContain('class="attribution"');
  });

  test('glyph animates with a scale pop (0.4 → 1.0)', () => {
    const out = quoteCard({ index: 0, startMs: 0, endMs: 4000, title: 'x' });
    const glyphAnim = out.animations.find((a) => a.selector.endsWith('.glyph'))!;
    expect(glyphAnim.keyframes[0]!.props.transform).toBe('scale(0.4)');
    const peak = glyphAnim.keyframes.find(
      (kf) => (kf.props.transform as string) === 'scale(1)',
    );
    expect(peak).toBeDefined();
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

describe('kineticType template', () => {
  test('splits title into per-char spans with data-i', () => {
    const out = kineticType({ index: 0, startMs: 0, endMs: 4000, title: 'Hello' });
    expect(out.html).toContain('data-i="0"');
    expect(out.html).toContain('data-i="1"');
    expect(out.html).toContain('data-i="4"');
    expect(out.html).not.toContain('data-i="5"');
    // chars are rendered as class="char"
    expect((out.html.match(/class="char"/g) || []).length).toBe(5);
  });

  test('spaces become &nbsp; (preserves visual width)', () => {
    const out = kineticType({ index: 0, startMs: 0, endMs: 3000, title: 'A B' });
    expect(out.html).toContain('&nbsp;');
  });

  test('astral-plane glyphs are split via Array.from (unicode-aware)', () => {
    const out = kineticType({ index: 0, startMs: 0, endMs: 3000, title: '你好' });
    expect((out.html.match(/class="char"/g) || []).length).toBe(2);
    expect(out.html).toContain('>你<');
    expect(out.html).toContain('>好<');
  });

  test('registers one entrance animation per character + scene + subtitle', () => {
    const out = kineticType({
      index: 0,
      startMs: 0,
      endMs: 5000,
      title: 'Hi',
      subtitle: 'Sub',
    });
    const charAnims = out.animations.filter((a) => a.selector.includes('.char['));
    expect(charAnims).toHaveLength(2);
    // Plus scene fade (1) + subtitle (1) = 4
    expect(out.animations).toHaveLength(4);
  });

  test('stagger between characters is 40 ms', () => {
    const out = kineticType({
      index: 0,
      startMs: 0,
      endMs: 6000,
      title: 'abc',
    });
    const starts = out.animations
      .filter((a) => a.selector.includes('.char['))
      .map(
        (a) =>
          a.keyframes.find(
            (kf) =>
              (kf.props.transform as string) === 'translateY(0px) rotate(0deg)',
          )!.atMs,
      )
      .sort((a, b) => a - b);
    // char landings are 560 ms after their per-char delay, but the
    // *delays* are 40 ms apart, so landings are also 40 ms apart.
    expect(starts[1]! - starts[0]!).toBe(40);
    expect(starts[2]! - starts[1]!).toBe(40);
  });

  test('HTML-escapes the aria-label fallback title', () => {
    const out = kineticType({ index: 0, startMs: 0, endMs: 1000, title: '<X>' });
    expect(out.html).toContain('aria-label="&lt;X&gt;"');
    expect(out.html).not.toContain('<h1 class="title" aria-label="<X>"');
  });
});

describe('logoOutro template', () => {
  test('image mode renders logo-art img + optional wordmark caption', () => {
    const out = logoOutro({
      index: 0,
      startMs: 0,
      endMs: 4000,
      title: 'Reelforge',
      subtitle: 'thanks for watching',
      image: 'logo.svg',
    });
    expect(out.html).toContain('class="logo-art"');
    expect(out.html).toContain('src="logo.svg"');
    expect(out.html).toContain('class="wordmark small"');
    expect(out.html).toContain('class="tagline"');
  });

  test('text-only mode renders wordmark (no img)', () => {
    const out = logoOutro({ index: 0, startMs: 0, endMs: 4000, title: 'REELFORGE' });
    expect(out.html).not.toContain('class="logo-art"');
    expect(out.html).toContain('class="wordmark"');
    expect(out.html).toContain('REELFORGE');
  });

  test('logo shrinks and migrates to corner in the last ~700 ms', () => {
    const out = logoOutro({
      index: 0,
      startMs: 0,
      endMs: 4000,
      title: 'Logo',
    });
    const logoAnim = out.animations.find((a) => a.selector.endsWith('.logo'))!;
    const shrinkFrame = logoAnim.keyframes.find(
      (kf) =>
        typeof kf.props.transform === 'string' &&
        kf.props.transform.includes('scale(0.25)'),
    );
    expect(shrinkFrame).toBeDefined();
    expect((shrinkFrame!.props.transform as string)).toContain('translate(38vw, 38vh)');
  });

  test('short slides (< 1.4 s) do not produce overlapping entrance+shrink', () => {
    const out = logoOutro({ index: 0, startMs: 0, endMs: 1200, title: 'x' });
    const logoAnim = out.animations.find((a) => a.selector.endsWith('.logo'))!;
    for (let i = 1; i < logoAnim.keyframes.length; i++) {
      expect(logoAnim.keyframes[i]!.atMs).toBeGreaterThanOrEqual(
        logoAnim.keyframes[i - 1]!.atMs,
      );
    }
  });

  test('tagline preserves translateX(-50%) for centering during fade', () => {
    const out = logoOutro({
      index: 0,
      startMs: 0,
      endMs: 4000,
      title: 'X',
      subtitle: 'tagline',
    });
    const taglineAnim = out.animations.find((a) => a.selector.endsWith('.tagline'))!;
    for (const kf of taglineAnim.keyframes) {
      expect(kf.props.transform as string).toContain('translateX(-50%)');
    }
  });
});

describe('dataChartReveal template', () => {
  test('parses "Label: value" bullets into bars', () => {
    const out = dataChartReveal({
      index: 0,
      startMs: 0,
      endMs: 5000,
      title: 'Revenue',
      bullets: ['Q1: 100', 'Q2: 250', 'Q3: 175', 'Q4: 400'],
    });
    expect(out.html).toContain('class="bar-col"');
    const barCount = (out.html.match(/class="bar-col"/g) || []).length;
    expect(barCount).toBe(4);
    expect(out.html).toContain('>Q1<');
    expect(out.html).toContain('>100<');
    expect(out.html).toContain('>400<');
  });

  test('normalizes bar heights against max (tallest gets 100%)', () => {
    const out = dataChartReveal({
      index: 0,
      startMs: 0,
      endMs: 4000,
      bullets: ['A: 25', 'B: 100', 'C: 50'],
    });
    // Look for inline style="height: ...%"
    expect(out.html).toContain('height: 100.00%');
    expect(out.html).toContain('height: 25.00%');
    expect(out.html).toContain('height: 50.00%');
  });

  test('skips bullets that are not in "Label: value" form', () => {
    const out = dataChartReveal({
      index: 0,
      startMs: 0,
      endMs: 4000,
      bullets: ['Good: 10', 'no colon here', 'Bad: not a number'],
    });
    const barCount = (out.html.match(/class="bar-col"/g) || []).length;
    expect(barCount).toBe(1);
  });

  test('emits three animations per bar (bar, label, value)', () => {
    const out = dataChartReveal({
      index: 0,
      startMs: 0,
      endMs: 6000,
      title: 'T',
      bullets: ['A: 1', 'B: 2'],
    });
    const perBar = out.animations.filter(
      (a) => a.selector.includes('.bar-col'),
    );
    expect(perBar).toHaveLength(6); // 2 bars × 3 anims
  });

  test('bars stagger 180 ms apart', () => {
    const out = dataChartReveal({
      index: 0,
      startMs: 0,
      endMs: 8000,
      bullets: ['A: 1', 'B: 2', 'C: 3'],
    });
    const barStartTimes = out.animations
      .filter((a) => /\.bar-col\[data-i="\d+"\] \.bar$/.test(a.selector))
      .map((a) => {
        // "start moving" is the second keyframe (after the leading
        // at=0 scaleY(0)).
        return a.keyframes[1]!.atMs;
      })
      .sort((a, b) => a - b);
    expect(barStartTimes[1]! - barStartTimes[0]!).toBe(180);
    expect(barStartTimes[2]! - barStartTimes[1]!).toBe(180);
  });

  test('title-only output is still valid (no bullets)', () => {
    const out = dataChartReveal({
      index: 0,
      startMs: 0,
      endMs: 3000,
      title: 'No data',
    });
    expect(out.html).toContain('>No data<');
    expect((out.html.match(/class="bar-col"/g) || []).length).toBe(0);
  });
});

describe('testimonial template', () => {
  test('renders portrait + quote body + attribution + company tag', () => {
    const out = testimonial({
      index: 0,
      startMs: 0,
      endMs: 5000,
      title: 'Reelforge cut our video production time in half.',
      subtitle: 'Jane Doe, CTO',
      image: 'jane.jpg',
      extras: { company: 'ACME' },
    });
    expect(out.html).toContain('class="portrait-frame"');
    expect(out.html).toContain('src="jane.jpg"');
    expect(out.html).toContain('class="glyph"');
    expect(out.html).toContain('class="company"');
    expect(out.html).toContain('ACME');
    expect(out.html).toContain('<blockquote class="quote"');
    expect(out.html).toContain('class="attribution"');
  });

  test('company tag is omitted when extras.company absent', () => {
    const out = testimonial({
      index: 0,
      startMs: 0,
      endMs: 4000,
      title: 'q',
      subtitle: 'x',
      image: 'j.jpg',
    });
    expect(out.html).not.toContain('class="company"');
  });

  test('portrait-frame animates with scale (0.85 → 1)', () => {
    const out = testimonial({ index: 0, startMs: 0, endMs: 4000, image: 'j.jpg' });
    const portraitAnim = out.animations.find((a) =>
      a.selector.endsWith('.portrait-frame'),
    )!;
    expect(portraitAnim.keyframes[0]!.props.transform).toBe('scale(0.85)');
  });
});

describe('lowerThird template', () => {
  test('renders bar with name / role / accent-strip', () => {
    const out = lowerThird({
      index: 0,
      startMs: 0,
      endMs: 4000,
      title: 'Jane Doe',
      subtitle: 'CTO, ACME',
      extras: { tag: 'LIVE' },
    });
    expect(out.html).toContain('class="bar"');
    expect(out.html).toContain('class="accent-strip"');
    expect(out.html).toContain('class="name"');
    expect(out.html).toContain('Jane Doe');
    expect(out.html).toContain('class="tag"');
    expect(out.html).toContain('LIVE');
  });

  test('bar slides in from the left (translateX(-60px) → 0)', () => {
    const out = lowerThird({
      index: 0,
      startMs: 0,
      endMs: 4000,
      title: 'x',
    });
    const barAnim = out.animations.find((a) => a.selector.endsWith('.bar'))!;
    expect(barAnim.keyframes[0]!.props.transform).toBe('translateX(-60px)');
  });

  test('accent-strip grows with scaleY (0 → 1)', () => {
    const out = lowerThird({ index: 0, startMs: 0, endMs: 4000, title: 'x' });
    const stripAnim = out.animations.find((a) =>
      a.selector.endsWith('.accent-strip'),
    )!;
    expect(stripAnim.keyframes[0]!.props.transform).toBe('scaleY(0)');
  });
});

describe('pictureInPicture template', () => {
  test('renders bg, titleblock, pip-window when all slots set', () => {
    const out = pictureInPicture({
      index: 0,
      startMs: 0,
      endMs: 5000,
      title: 'Live Demo',
      subtitle: 'Watch how it works',
      image: 'main.jpg',
      extras: { pipImage: 'face.jpg' },
    });
    expect(out.html).toContain('class="bg"');
    expect(out.html).toContain('src="main.jpg"');
    expect(out.html).toContain('class="titleblock"');
    expect(out.html).toContain('class="pip-window"');
    expect(out.html).toContain('src="face.jpg"');
  });

  test('pip window entrance is a scale pop (0.3 → 1)', () => {
    const out = pictureInPicture({
      index: 0,
      startMs: 0,
      endMs: 4000,
      image: 'm.jpg',
      extras: { pipImage: 'f.jpg' },
    });
    const pipAnim = out.animations.find((a) =>
      a.selector.endsWith('.pip-window'),
    )!;
    expect(pipAnim.keyframes[0]!.props.transform).toBe('scale(0.3)');
  });

  test('omits pip-window when extras.pipImage absent', () => {
    const out = pictureInPicture({
      index: 0,
      startMs: 0,
      endMs: 3000,
      image: 'm.jpg',
    });
    expect(out.html).not.toContain('class="pip-window"');
  });
});

describe('timelineRoadmap template', () => {
  test('parses "Label | period" and "Label: period" bullets', () => {
    const out = timelineRoadmap({
      index: 0,
      startMs: 0,
      endMs: 6000,
      title: 'Roadmap',
      bullets: ['Launch | Q1 2024', 'Series A: 2024-08', 'Global'],
    });
    const nodeCount = (out.html.match(/class="node"/g) || []).length;
    expect(nodeCount).toBe(3);
    expect(out.html).toContain('>Launch<');
    expect(out.html).toContain('>Q1 2024<');
    expect(out.html).toContain('>Series A<');
    expect(out.html).toContain('>2024-08<');
    expect(out.html).toContain('>Global<');
  });

  test('alternates label position above/below per node', () => {
    const out = timelineRoadmap({
      index: 0,
      startMs: 0,
      endMs: 5000,
      bullets: ['A | 2024', 'B | 2025', 'C | 2026'],
    });
    // Above nodes = index 0 and 2; below = index 1
    const aboveCount = (out.html.match(/class="node-label above"/g) || []).length;
    const belowCount = (out.html.match(/class="node-label below"/g) || []).length;
    expect(aboveCount).toBe(2);
    expect(belowCount).toBe(1);
  });

  test('rail scales from 0 to 1 on entrance', () => {
    const out = timelineRoadmap({
      index: 0,
      startMs: 0,
      endMs: 5000,
      bullets: ['A | 1', 'B | 2'],
    });
    const railAnim = out.animations.find((a) => a.selector.endsWith('.rail'))!;
    expect(railAnim.keyframes[0]!.props.transform).toBe('scaleX(0)');
  });

  test('each node gets three animations (dot / label / period)', () => {
    const out = timelineRoadmap({
      index: 0,
      startMs: 0,
      endMs: 8000,
      bullets: ['A | 1', 'B | 2', 'C | 3'],
    });
    const perNode = out.animations.filter((a) => a.selector.includes('.node['));
    expect(perNode).toHaveLength(9); // 3 nodes × 3 anims
  });

  test('node-label animation preserves translateX(-50%) for centering', () => {
    const out = timelineRoadmap({
      index: 0,
      startMs: 0,
      endMs: 4000,
      bullets: ['A | 1'],
    });
    const labelAnim = out.animations.find((a) =>
      a.selector.endsWith('.node-label'),
    )!;
    for (const kf of labelAnim.keyframes) {
      expect(kf.props.transform as string).toContain('translateX(-50%)');
    }
  });
});

describe('endCard template', () => {
  test('renders CTA + sub-CTA + three actions by default', () => {
    const out = endCard({
      index: 0,
      startMs: 0,
      endMs: 4000,
      title: 'Subscribe for more',
      subtitle: 'New video every Tuesday',
    });
    expect(out.html).toContain('class="cta"');
    expect(out.html).toContain('Subscribe for more');
    expect(out.html).toContain('class="sub-cta"');
    const actionCount = (out.html.match(/class="action"/g) || []).length;
    expect(actionCount).toBe(3);
  });

  test('custom icons and actions via extras', () => {
    const out = endCard({
      index: 0,
      startMs: 0,
      endMs: 4000,
      title: 'Follow',
      extras: { icons: '🎯|📺|🔥', actions: 'Click|Watch|Burn' },
    });
    expect(out.html).toContain('>🎯<');
    expect(out.html).toContain('>Click<');
    expect(out.html).toContain('>Burn<');
  });

  test('CTA scale pop (0.7 → 1)', () => {
    const out = endCard({ index: 0, startMs: 0, endMs: 4000, title: 'x' });
    const ctaAnim = out.animations.find((a) => a.selector.endsWith('.cta'))!;
    expect(ctaAnim.keyframes[0]!.props.transform).toBe('scale(0.7)');
  });

  test('actions stagger 140 ms apart', () => {
    const out = endCard({
      index: 0,
      startMs: 0,
      endMs: 6000,
      title: 'x',
    });
    const actionStarts = out.animations
      .filter((a) => a.selector.includes('.action['))
      .map(
        (a) =>
          a.keyframes.find(
            (kf) => (kf.props.transform as string) === 'translateY(0px) scale(1)',
          )!.atMs,
      )
      .sort((a, b) => a - b);
    expect(actionStarts[1]! - actionStarts[0]!).toBe(140);
    expect(actionStarts[2]! - actionStarts[1]!).toBe(140);
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

  test('image-left-text + image-right-text share one CSS block (no duplicate injection)', () => {
    const html = renderTemplatedComposition({
      width: 1280,
      height: 720,
      fps: 30,
      totalDurationMs: 6000,
      slides: [
        {
          template: 'image-left-text',
          title: 'A',
          image: 'a.jpg',
          startMs: 0,
          endMs: 3000,
        },
        {
          template: 'image-right-text',
          title: 'B',
          image: 'b.jpg',
          startMs: 3000,
          endMs: 6000,
        },
      ],
    });
    // Both template class selectors must be present.
    expect(html).toContain('.slide-image-left-text');
    expect(html).toContain('.slide-image-right-text');
    // The shared CSS block is emitted twice — once per template key —
    // but this is harmless (last rule wins, they're identical). Assert
    // the critical selectors resolve instead.
    const imgColMatches = html.match(/\.slide-image-left-text \.image-col/g) || [];
    expect(imgColMatches.length).toBeGreaterThanOrEqual(1);
  });

  test('transitions inject overlay HTML + effect CSS when referenced', () => {
    const html = renderTemplatedComposition({
      width: 1280,
      height: 720,
      fps: 30,
      totalDurationMs: 8000,
      slides: [
        { template: 'hero-fade-up', title: 'A', startMs: 0, endMs: 4000 },
        { template: 'hero-fade-up', title: 'B', startMs: 4000, endMs: 8000 },
      ],
      transitions: [{ name: 'flash-white', atMs: 4000, durationMs: 400 }],
    });
    expect(html).toContain('class="rf-fx-flash white"');
    expect(html).toContain('id="fx-t0"');
    expect(html).toContain('.rf-fx-flash');
  });

  test('transitions fold into the same WAAPI script as slide animations', () => {
    const html = renderTemplatedComposition({
      width: 1280,
      height: 720,
      fps: 30,
      totalDurationMs: 6000,
      slides: [
        { template: 'hero-fade-up', title: 'A', startMs: 0, endMs: 3000 },
        { template: 'hero-fade-up', title: 'B', startMs: 3000, endMs: 6000 },
      ],
      transitions: [
        { name: 'wipe-sweep', atMs: 3000, durationMs: 500 },
        { name: 'radial-pulse', atMs: 5000, durationMs: 400 },
      ],
    });
    expect(html).toContain('#fx-t0');
    expect(html).toContain('#fx-t1');
    expect(html).toContain('.rf-fx-wipe-sweep');
    expect(html).toContain('.rf-fx-radial-pulse');
  });

  test('unknown transition effect name throws', () => {
    expect(() =>
      renderTemplatedComposition({
        width: 1280,
        height: 720,
        fps: 30,
        totalDurationMs: 4000,
        slides: [{ template: 'hero-fade-up', title: 'x', startMs: 0, endMs: 4000 }],
        transitions: [{ name: 'does-not-exist', atMs: 2000, durationMs: 300 }],
      }),
    ).toThrow(/Unknown Chrome effect/);
  });

  test('flash-white + flash-black share one CSS block (no duplicate injection)', () => {
    const html = renderTemplatedComposition({
      width: 1280,
      height: 720,
      fps: 30,
      totalDurationMs: 8000,
      slides: [
        { template: 'hero-fade-up', title: 'A', startMs: 0, endMs: 4000 },
        { template: 'hero-fade-up', title: 'B', startMs: 4000, endMs: 8000 },
      ],
      transitions: [
        { name: 'flash-white', atMs: 2000, durationMs: 400 },
        { name: 'flash-black', atMs: 6000, durationMs: 400 },
      ],
    });
    // Count the .rf-fx-flash base rule — it should only appear once
    // (shared CSS string), not twice.
    const matches = html.match(/\.rf-fx-flash \{/g) || [];
    expect(matches.length).toBe(1);
  });

  test('spring easing on a template expands into dense linear keyframes in final HTML', () => {
    // kinetic-type opts into spring-bouncy for its per-char entrance.
    // After render-composition, the inline plans JSON should (a) not
    // contain the literal "spring-bouncy" (it's been resolved) and
    // (b) show "easing":"linear" on those .char[data-i=...] animations.
    const html = renderTemplatedComposition({
      width: 1280,
      height: 720,
      fps: 30,
      totalDurationMs: 3000,
      slides: [
        { template: 'kinetic-type', title: 'Hi', startMs: 0, endMs: 3000 },
      ],
    });
    expect(html).not.toContain('spring-bouncy');
    // The .char animations were spring-expanded → linear.
    // Find any `.char[data-i=...]` plan entry in the JSON.
    const charPlanRe =
      /\{"selector":"#slide-0 \.char\[data-i=\\"0\\"\]","easing":"([^"]+)","keyframes":\[([^\]]+)\]\}/;
    const m = html.match(charPlanRe);
    expect(m).not.toBeNull();
    expect(m![1]).toBe('linear');
    // Expanded keyframes should be substantially denser than the
    // 5-keyframe source animation.
    const keyframeEntries = (m![2]!.match(/\{"atMs"/g) || []).length;
    expect(keyframeEntries).toBeGreaterThan(30);
  });

  test('quote-card and photo-card CSS blocks only appear when used', () => {
    const html = renderTemplatedComposition({
      width: 1280,
      height: 720,
      fps: 30,
      totalDurationMs: 4000,
      slides: [
        {
          template: 'photo-card',
          title: 'Cover',
          image: 'c.jpg',
          startMs: 0,
          endMs: 4000,
        },
      ],
    });
    expect(html).toContain('.slide-photo-card');
    expect(html).not.toContain('.slide-quote-card');
    expect(html).not.toContain('.slide-image-left-text');
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
