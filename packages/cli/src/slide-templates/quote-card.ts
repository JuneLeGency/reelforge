import { escapeText } from './escape';
import type { SlideRenderOutput, SlideSpec, SlideTemplate } from './types';

/**
 * quote-card — centered pull-quote treatment. Large decorative opening
 * quote mark pops in first, then the quote body fades up, then a
 * leader line extends and the attribution (subtitle) slides in from
 * the right. No image.
 *
 * Slots:
 *   - title    → quote body text (required for a useful output)
 *   - subtitle → attribution line ("— Author, Role")
 */
export const quoteCard: SlideTemplate = (spec: SlideSpec): SlideRenderOutput => {
  const { index, startMs, endMs } = spec;
  const title = spec.title ?? '';
  const subtitle = spec.subtitle ?? '';

  const FADE_MS = 400;
  const inStart = startMs;
  const inEnd = startMs + FADE_MS;
  const outStart = endMs - FADE_MS;
  const outEnd = endMs;

  const id = `slide-${index}`;
  const html = `
  <section class="slide slide-quote-card" id="${id}" data-slide-index="${index}">
    <div class="card">
      <div class="glyph" aria-hidden="true">&ldquo;</div>
      ${title !== '' ? `<blockquote class="body">${escapeText(title)}</blockquote>` : ''}
      ${subtitle !== '' ? `<div class="attribution"><span class="rule"></span><span class="who">${escapeText(subtitle)}</span></div>` : ''}
    </div>
  </section>`.trim();

  const sel = (s: string) => `#${id}${s === '' ? '' : ' ' + s}`;

  return {
    html,
    css: QUOTE_CARD_CSS,
    animations: [
      // scene cross-fade
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
      // opening quote mark: scale pop + fade
      {
        selector: sel('.glyph'),
        easing: 'cubic-bezier(.34,1.56,.64,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'scale(0.4)' } },
          { atMs: Math.max(0, inStart + 120 - 1), props: { opacity: 0, transform: 'scale(0.4)' } },
          { atMs: inStart + 120 + 620, props: { opacity: 1, transform: 'scale(1)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'scale(1)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'scale(0.8)' } },
        ],
      },
      // quote body fade-up
      {
        selector: sel('.body'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'translateY(30px)' } },
          { atMs: Math.max(0, inStart + 420 - 1), props: { opacity: 0, transform: 'translateY(30px)' } },
          { atMs: inStart + 420 + 760, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'translateY(-14px)' } },
        ],
      },
      // attribution rule expands
      {
        selector: sel('.rule'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { transform: 'scaleX(0)' } },
          { atMs: Math.max(0, inStart + 880 - 1), props: { transform: 'scaleX(0)' } },
          { atMs: inStart + 880 + 500, props: { transform: 'scaleX(1)' } },
          { atMs: outStart, props: { transform: 'scaleX(1)' } },
          { atMs: outEnd, props: { transform: 'scaleX(0)' } },
        ],
      },
      // attribution name slides in
      {
        selector: sel('.who'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'translateX(20px)' } },
          { atMs: Math.max(0, inStart + 1000 - 1), props: { opacity: 0, transform: 'translateX(20px)' } },
          { atMs: inStart + 1000 + 500, props: { opacity: 1, transform: 'translateX(0px)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'translateX(0px)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'translateX(-8px)' } },
        ],
      },
    ],
  };
};

export const QUOTE_CARD_CSS = `
  .slide-quote-card {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    opacity: 0;
    color: white;
  }
  .slide-quote-card .card {
    max-width: 1000px;
    width: 84%;
    text-align: left;
    position: relative;
    padding: 80px 64px 48px 64px;
  }
  .slide-quote-card .glyph {
    position: absolute;
    top: -32px; left: 28px;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 240px;
    font-weight: 700;
    line-height: 1;
    color: rgba(255,255,255,0.18);
    opacity: 0;
    transform: scale(0.4);
    transform-origin: top left;
  }
  .slide-quote-card .body {
    position: relative;
    font-size: 52px;
    font-weight: 500;
    line-height: 1.35;
    letter-spacing: -0.3px;
    margin: 0 0 36px 0;
    color: rgba(255,255,255,0.96);
    opacity: 0;
    transform: translateY(30px);
  }
  .slide-quote-card .attribution {
    display: flex;
    align-items: center;
    gap: 18px;
  }
  .slide-quote-card .rule {
    display: inline-block;
    width: 64px;
    height: 3px;
    background: rgba(255,255,255,0.75);
    border-radius: 2px;
    transform: scaleX(0);
    transform-origin: left center;
  }
  .slide-quote-card .who {
    display: inline-block;
    font-size: 24px;
    font-weight: 600;
    letter-spacing: 1px;
    color: rgba(255,255,255,0.85);
    opacity: 0;
    transform: translateX(20px);
  }
`;
