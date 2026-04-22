import { escapeAttr, escapeText } from './escape';
import type { SlideRenderOutput, SlideSpec, SlideTemplate } from './types';

/**
 * testimonial — portrait on the left, quoted testimonial on the right.
 * Large opening quote-mark glyph as a decorative anchor. Designed for
 * case studies, customer stories, interview pull-outs.
 *
 * Slots:
 *   - title    → the quote body
 *   - subtitle → attribution ("Jane Doe, CTO")
 *   - image    → portrait (cover-fit into a circular crop)
 *   - extras.company → small caption above the quote ("STRIPE", "NOTION")
 */
export const testimonial: SlideTemplate = (spec: SlideSpec): SlideRenderOutput => {
  const { index, startMs, endMs } = spec;
  const title = spec.title ?? '';
  const subtitle = spec.subtitle ?? '';
  const image = spec.image ?? '';
  const company = String(spec.extras?.company ?? '');

  const FADE_MS = 400;
  const inStart = startMs;
  const inEnd = startMs + FADE_MS;
  const outStart = endMs - FADE_MS;
  const outEnd = endMs;

  const id = `slide-${index}`;
  const html = `
  <section class="slide slide-testimonial" id="${id}" data-slide-index="${index}">
    <div class="portrait-col">
      ${image !== '' ? `<div class="portrait-frame"><img class="portrait" src="${escapeAttr(image)}" alt=""></div>` : ''}
    </div>
    <div class="quote-col">
      <div class="glyph" aria-hidden="true">&ldquo;</div>
      ${company !== '' ? `<div class="company">${escapeText(company)}</div>` : ''}
      ${title !== '' ? `<blockquote class="quote">${escapeText(title)}</blockquote>` : ''}
      ${subtitle !== '' ? `<div class="attribution">${escapeText(subtitle)}</div>` : ''}
    </div>
  </section>`.trim();

  const sel = (s: string) => `#${id}${s === '' ? '' : ' ' + s}`;

  return {
    html,
    css: TESTIMONIAL_CSS,
    animations: [
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
      // portrait fades + scales in from slight zoom
      {
        selector: sel('.portrait-frame'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'scale(0.85)' } },
          { atMs: Math.max(0, inStart + 160 - 1), props: { opacity: 0, transform: 'scale(0.85)' } },
          { atMs: inStart + 160 + 720, props: { opacity: 1, transform: 'scale(1)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'scale(1)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'scale(0.95)' } },
        ],
      },
      // glyph scale pop
      {
        selector: sel('.glyph'),
        easing: 'cubic-bezier(.34,1.56,.64,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'scale(0.5)' } },
          { atMs: Math.max(0, inStart + 260 - 1), props: { opacity: 0, transform: 'scale(0.5)' } },
          { atMs: inStart + 260 + 600, props: { opacity: 1, transform: 'scale(1)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'scale(1)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'scale(0.85)' } },
        ],
      },
      // company tag
      {
        selector: sel('.company'),
        easing: 'linear',
        keyframes: [
          { atMs: 0, props: { opacity: 0 } },
          { atMs: Math.max(0, inStart + 340 - 1), props: { opacity: 0 } },
          { atMs: inStart + 340 + 400, props: { opacity: 1 } },
          { atMs: outStart, props: { opacity: 1 } },
          { atMs: outEnd, props: { opacity: 0 } },
        ],
      },
      // quote body fade-up
      {
        selector: sel('.quote'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'translateY(24px)' } },
          { atMs: Math.max(0, inStart + 480 - 1), props: { opacity: 0, transform: 'translateY(24px)' } },
          { atMs: inStart + 480 + 700, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'translateY(-12px)' } },
        ],
      },
      // attribution slide-in from right
      {
        selector: sel('.attribution'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'translateX(14px)' } },
          { atMs: Math.max(0, inStart + 820 - 1), props: { opacity: 0, transform: 'translateX(14px)' } },
          { atMs: inStart + 820 + 500, props: { opacity: 1, transform: 'translateX(0px)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'translateX(0px)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'translateX(-6px)' } },
        ],
      },
    ],
  };
};

export const TESTIMONIAL_CSS = `
  .slide-testimonial {
    position: absolute; inset: 0;
    display: flex;
    opacity: 0;
    color: white;
    padding: 72px 96px;
    box-sizing: border-box;
    gap: 56px;
    align-items: center;
  }
  .slide-testimonial .portrait-col {
    flex: 0 0 36%;
    display: flex; align-items: center; justify-content: center;
  }
  .slide-testimonial .portrait-frame {
    width: 360px;
    height: 360px;
    border-radius: 50%;
    overflow: hidden;
    border: 4px solid rgba(255,255,255,0.12);
    box-shadow: 0 24px 60px rgba(0,0,0,0.45);
    opacity: 0;
    transform: scale(0.85);
  }
  .slide-testimonial .portrait {
    width: 100%; height: 100%;
    object-fit: cover;
    display: block;
  }
  .slide-testimonial .quote-col {
    flex: 1 1 auto;
    position: relative;
    padding-left: 24px;
  }
  .slide-testimonial .glyph {
    position: absolute;
    top: -48px; left: -4px;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 200px;
    font-weight: 700;
    line-height: 1;
    color: rgba(255,255,255,0.18);
    opacity: 0;
    transform: scale(0.5);
    transform-origin: top left;
  }
  .slide-testimonial .company {
    position: relative;
    font-size: 16px;
    font-weight: 800;
    letter-spacing: 5px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.7);
    margin-bottom: 18px;
    opacity: 0;
  }
  .slide-testimonial .quote {
    position: relative;
    font-size: 40px;
    font-weight: 500;
    line-height: 1.35;
    margin: 0 0 24px 0;
    color: rgba(255,255,255,0.96);
    opacity: 0;
    transform: translateY(24px);
  }
  .slide-testimonial .attribution {
    position: relative;
    font-size: 22px;
    font-weight: 600;
    color: rgba(255,255,255,0.78);
    letter-spacing: 0.5px;
    opacity: 0;
    transform: translateX(14px);
  }
`;
