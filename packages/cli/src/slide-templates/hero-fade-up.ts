import type { SlideRenderOutput, SlideSpec, SlideTemplate } from './types';
import { escapeAttr, escapeText } from './escape';

/**
 * hero-fade-up — centered title + subtitle, scene-index pill, accent
 * rule, watermark. Standard "promo intro" layout.
 *
 * Choreography:
 *   - scene cross-fade in/out 400 ms (overlaps with neighbours)
 *   - accent rule   scaleX 0→1    @ +120 ms (500 ms ease-out)
 *   - title         y 40→0 + fade @ +220 ms (700 ms ease-out)
 *   - subtitle      y 30→0 + fade @ +480 ms (650 ms ease-out)
 *   - scene index   opacity pop   @ +350 ms (400 ms linear)
 *   - watermark     opacity pop   @ +450 ms (400 ms linear)
 */
export const heroFadeUp: SlideTemplate = (spec: SlideSpec): SlideRenderOutput => {
  const { index, startMs, endMs } = spec;
  const title = spec.title ?? '';
  const subtitle = spec.subtitle ?? '';
  const image = spec.image ?? '';
  const indexLabel = String(spec.extras?.indexLabel ?? `${String(index + 1).padStart(2, '0')}`);
  const totalLabel = String(spec.extras?.totalLabel ?? '');
  const watermark = String(spec.extras?.watermark ?? 'REELFORGE');
  const hasImage = image !== '';

  const FADE_MS = 400;
  const inStart = startMs;
  const inEnd = startMs + FADE_MS;
  const outStart = endMs - FADE_MS;
  const outEnd = endMs;

  const id = `slide-${index}`;
  // scene-index is now handled globally by render-composition — removed
  // here to avoid rendering it twice. indexLabel / totalLabel kept
  // available on spec.extras for templates that still want a local pill.
  void indexLabel;
  void totalLabel;
  const html = `
  <section class="slide slide-hero-fade-up${hasImage ? ' has-bg-image' : ''}" id="${id}" data-slide-index="${index}">
    ${hasImage ? `<img class="bg-image" src="${escapeAttr(image)}" alt="">` : ''}
    ${hasImage ? `<div class="bg-scrim"></div>` : ''}
    <div class="accent-rule"></div>
    ${title !== '' ? `<h1 class="title">${escapeText(title)}</h1>` : ''}
    ${subtitle !== '' ? `<div class="subtitle">${escapeText(subtitle)}</div>` : ''}
    ${watermark !== '' ? `<div class="watermark">${escapeText(watermark)}</div>` : ''}
  </section>`.trim();

  const sel = (s: string) => `#${id}${s === '' ? '' : ' ' + s}`;

  return {
    html,
    css: HERO_FADE_UP_CSS,
    animations: [
      // outer scene cross-fade
      {
        selector: sel(''),
        easing: 'linear',
        keyframes: [
          { atMs: 0, props: { opacity: 0 } },
          { atMs: Math.max(0, inStart - 1), props: { opacity: 0 } },
          { atMs: inEnd, props: { opacity: 1 } },
          { atMs: outStart, props: { opacity: 1 } },
          { atMs: outEnd, props: { opacity: 0 } },
        ],
      },
      // accent rule scale
      {
        selector: sel('.accent-rule'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { transform: 'scaleX(0)' } },
          { atMs: Math.max(0, inStart + 120 - 1), props: { transform: 'scaleX(0)' } },
          { atMs: inStart + 120 + 500, props: { transform: 'scaleX(1)' } },
          { atMs: outStart, props: { transform: 'scaleX(1)' } },
          { atMs: outEnd, props: { transform: 'scaleX(0)' } },
        ],
      },
      // title
      {
        selector: sel('.title'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'translateY(40px)' } },
          { atMs: Math.max(0, inStart + 220 - 1), props: { opacity: 0, transform: 'translateY(40px)' } },
          { atMs: inStart + 220 + 700, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'translateY(-20px)' } },
        ],
      },
      // subtitle
      {
        selector: sel('.subtitle'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'translateY(30px)' } },
          { atMs: Math.max(0, inStart + 480 - 1), props: { opacity: 0, transform: 'translateY(30px)' } },
          { atMs: inStart + 480 + 650, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'translateY(-16px)' } },
        ],
      },
      // watermark pop
      {
        selector: sel('.watermark'),
        easing: 'linear',
        keyframes: [
          { atMs: 0, props: { opacity: 0 } },
          { atMs: Math.max(0, inStart + 450 - 1), props: { opacity: 0 } },
          { atMs: inStart + 450 + 400, props: { opacity: 1 } },
          { atMs: outStart, props: { opacity: 1 } },
          { atMs: outEnd, props: { opacity: 0 } },
        ],
      },
      // Optional background-image slow zoom (1.0 → 1.05) — only when
      // spec.image is set. No-op otherwise, since there's no element.
      ...(hasImage
        ? [
            {
              selector: sel('.bg-image'),
              easing: 'linear',
              keyframes: [
                { atMs: 0, props: { transform: 'scale(1)' } },
                { atMs: startMs, props: { transform: 'scale(1)' } },
                { atMs: endMs, props: { transform: 'scale(1.05)' } },
              ],
            },
          ]
        : []),
    ],
  };
};

/**
 * Inject into the composition's global <style> block. The caller
 * deduplicates — `heroFadeUp` is called once per slide but the CSS is
 * static, so emit once per template family.
 */
export const HERO_FADE_UP_CSS = `
  .slide-hero-fade-up {
    position: absolute; inset: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    opacity: 0;
    color: white;
    overflow: hidden;
  }
  .slide-hero-fade-up::before {
    content: "";
    position: absolute;
    border-radius: 50%;
    width: 600px; height: 600px;
    background: radial-gradient(circle, rgba(255,255,255,0.5), transparent 70%);
    top: -150px; left: -150px;
    filter: blur(40px); opacity: 0.35;
    pointer-events: none;
  }
  .slide-hero-fade-up::after {
    content: "";
    position: absolute;
    border-radius: 50%;
    width: 500px; height: 500px;
    background: radial-gradient(circle, rgba(255,255,255,0.3), transparent 70%);
    bottom: -200px; right: -150px;
    filter: blur(40px); opacity: 0.35;
    pointer-events: none;
  }
  .slide-hero-fade-up .accent-rule {
    width: 80px; height: 4px;
    background: rgba(255,255,255,0.9);
    margin-bottom: 36px;
    border-radius: 2px;
    transform: scaleX(0);
    transform-origin: left center;
  }
  .slide-hero-fade-up .title {
    font-size: 108px;
    font-weight: 800;
    letter-spacing: -2px;
    text-align: center;
    margin: 0 0 28px 0;
    text-shadow: 0 8px 32px rgba(0,0,0,0.4);
    transform: translateY(40px);
    opacity: 0;
  }
  .slide-hero-fade-up .subtitle {
    font-size: 42px;
    font-weight: 500;
    color: rgba(255,255,255,0.92);
    letter-spacing: 0.5px;
    transform: translateY(30px);
    opacity: 0;
  }
  .slide-hero-fade-up .scene-index {
    position: absolute;
    top: 48px; left: 48px;
    font-size: 20px;
    letter-spacing: 4px;
    color: rgba(255,255,255,0.6);
    font-weight: 600;
    opacity: 0;
  }
  .slide-hero-fade-up .watermark {
    position: absolute;
    bottom: 48px; right: 48px;
    font-size: 18px;
    letter-spacing: 6px;
    color: rgba(255,255,255,0.45);
    font-weight: 500;
    opacity: 0;
  }
  .slide-hero-fade-up .bg-image {
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    object-fit: cover;
    transform-origin: center center;
    transform: scale(1);
    z-index: 0;
  }
  .slide-hero-fade-up .bg-scrim {
    position: absolute; inset: 0;
    background: radial-gradient(ellipse at center, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.7) 100%);
    pointer-events: none;
    z-index: 1;
  }
  /* When a background photo is present, dim the decorative blurs so
     the photo reads clearly and text keeps its contrast. */
  .slide-hero-fade-up.has-bg-image::before,
  .slide-hero-fade-up.has-bg-image::after {
    opacity: 0.12;
  }
  .slide-hero-fade-up.has-bg-image .accent-rule,
  .slide-hero-fade-up.has-bg-image .title,
  .slide-hero-fade-up.has-bg-image .subtitle,
  .slide-hero-fade-up.has-bg-image .scene-index,
  .slide-hero-fade-up.has-bg-image .watermark {
    position: relative;
    z-index: 2;
  }
`;

// Re-export the attr-escape helper so sibling templates can share it.
export { escapeAttr };
