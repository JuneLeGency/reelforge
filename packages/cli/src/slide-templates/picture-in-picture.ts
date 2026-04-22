import { escapeAttr, escapeText } from './escape';
import type { SlideRenderOutput, SlideSpec, SlideTemplate } from './types';

/**
 * picture-in-picture — main full-bleed image with a smaller floating
 * "pip" window in the bottom-right corner. Useful for reaction-style
 * videos (main = screen recording, pip = face-cam), or side-by-side
 * contrast (main = hero shot, pip = detail).
 *
 * Slots:
 *   - image             → main (full-bleed) image
 *   - extras.pipImage   → pip image (bottom-right window)
 *   - title             → optional title overlay, top-left
 *   - subtitle          → optional subtitle under title
 */
export const pictureInPicture: SlideTemplate = (spec: SlideSpec): SlideRenderOutput => {
  const { index, startMs, endMs } = spec;
  const title = spec.title ?? '';
  const subtitle = spec.subtitle ?? '';
  const image = spec.image ?? '';
  const pipImage = String(spec.extras?.pipImage ?? '');
  // When extras.blurBg is truthy, the main image gets a blur filter
  // (to keep focus on the pip window and any overlay text). The pip
  // window itself stays sharp.
  const blurRaw = spec.extras?.blurBg;
  const blurPx = (() => {
    if (blurRaw === undefined || blurRaw === '' || blurRaw === 'false' || blurRaw === 0) return 0;
    const n = typeof blurRaw === 'number' ? blurRaw : Number.parseFloat(String(blurRaw));
    if (Number.isFinite(n)) return Math.max(0, Math.min(40, n));
    return 8; // default when extras.blurBg is "true" / truthy non-number
  })();

  const FADE_MS = 400;
  const inStart = startMs;
  const inEnd = startMs + FADE_MS;
  const outStart = endMs - FADE_MS;
  const outEnd = endMs;

  const id = `slide-${index}`;
  const bgStyle = blurPx > 0 ? ` style="filter: blur(${blurPx}px);"` : '';
  const html = `
  <section class="slide slide-pip${blurPx > 0 ? ' has-blur-bg' : ''}" id="${id}" data-slide-index="${index}">
    ${image !== '' ? `<img class="bg" src="${escapeAttr(image)}" alt=""${bgStyle}>` : ''}
    ${title !== '' || subtitle !== '' ? `<div class="titleblock">
      ${title !== '' ? `<h1 class="title">${escapeText(title)}</h1>` : ''}
      ${subtitle !== '' ? `<div class="subtitle">${escapeText(subtitle)}</div>` : ''}
    </div>` : ''}
    ${pipImage !== '' ? `<div class="pip-window"><img class="pip" src="${escapeAttr(pipImage)}" alt=""></div>` : ''}
  </section>`.trim();

  const sel = (s: string) => `#${id}${s === '' ? '' : ' ' + s}`;

  return {
    html,
    css: PIP_CSS,
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
      // bg slow zoom (1.0 → 1.04)
      {
        selector: sel('.bg'),
        easing: 'linear',
        keyframes: [
          { atMs: 0, props: { transform: 'scale(1)' } },
          { atMs: startMs, props: { transform: 'scale(1)' } },
          { atMs: endMs, props: { transform: 'scale(1.04)' } },
        ],
      },
      // title fade-up
      {
        selector: sel('.title'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'translateY(18px)' } },
          { atMs: Math.max(0, inStart + 200 - 1), props: { opacity: 0, transform: 'translateY(18px)' } },
          { atMs: inStart + 200 + 600, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'translateY(-8px)' } },
        ],
      },
      // subtitle fade-up later
      {
        selector: sel('.subtitle'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'translateY(14px)' } },
          { atMs: Math.max(0, inStart + 420 - 1), props: { opacity: 0, transform: 'translateY(14px)' } },
          { atMs: inStart + 420 + 500, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'translateY(-6px)' } },
        ],
      },
      // pip window pops from corner: scale + slight translate
      {
        selector: sel('.pip-window'),
        easing: 'cubic-bezier(.34,1.56,.64,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'scale(0.3)' } },
          { atMs: Math.max(0, inStart + 520 - 1), props: { opacity: 0, transform: 'scale(0.3)' } },
          { atMs: inStart + 520 + 650, props: { opacity: 1, transform: 'scale(1)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'scale(1)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'scale(0.6)' } },
        ],
      },
    ],
  };
};

export const PIP_CSS = `
  .slide-pip {
    position: absolute; inset: 0;
    opacity: 0;
    overflow: hidden;
    color: white;
  }
  .slide-pip .bg {
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    object-fit: cover;
    transform: scale(1);
    transform-origin: center center;
  }
  .slide-pip .titleblock {
    position: absolute;
    top: 56px; left: 64px;
    max-width: 60%;
    z-index: 2;
  }
  .slide-pip .title {
    font-size: 64px;
    font-weight: 800;
    letter-spacing: -1px;
    margin: 0 0 12px 0;
    line-height: 1.1;
    text-shadow: 0 6px 24px rgba(0,0,0,0.55);
    opacity: 0;
    transform: translateY(18px);
  }
  .slide-pip .subtitle {
    font-size: 26px;
    font-weight: 500;
    color: rgba(255,255,255,0.9);
    text-shadow: 0 4px 18px rgba(0,0,0,0.55);
    opacity: 0;
    transform: translateY(14px);
  }
  .slide-pip .pip-window {
    position: absolute;
    bottom: 56px; right: 56px;
    width: 28%;
    aspect-ratio: 16 / 9;
    border-radius: 16px;
    overflow: hidden;
    border: 3px solid rgba(255,255,255,0.95);
    box-shadow: 0 20px 48px rgba(0,0,0,0.55);
    opacity: 0;
    transform: scale(0.3);
    transform-origin: bottom right;
    z-index: 3;
  }
  .slide-pip .pip {
    width: 100%; height: 100%;
    object-fit: cover;
    display: block;
  }
`;
