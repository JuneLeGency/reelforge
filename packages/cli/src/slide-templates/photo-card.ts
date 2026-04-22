import { escapeAttr, escapeText } from './escape';
import type { SlideRenderOutput, SlideSpec, SlideTemplate } from './types';

/**
 * photo-card — full-bleed image + floating card at the bottom with
 * title / subtitle / eyebrow. Instagram / 小红书 / podcast-cover feel.
 *
 * Unlike ken-burns-zoom, the image stays still; the card slides up
 * from the bottom. Contrast is guaranteed by the card's own
 * background — text stays legible against any photo.
 */
export const photoCard: SlideTemplate = (spec: SlideSpec): SlideRenderOutput => {
  const { index, startMs, endMs } = spec;
  const title = spec.title ?? '';
  const subtitle = spec.subtitle ?? '';
  const image = spec.image ?? '';
  const eyebrow = String(spec.extras?.eyebrow ?? '');

  const FADE_MS = 400;
  const inStart = startMs;
  const inEnd = startMs + FADE_MS;
  const outStart = endMs - FADE_MS;
  const outEnd = endMs;

  const id = `slide-${index}`;
  const html = `
  <section class="slide slide-photo-card" id="${id}" data-slide-index="${index}">
    ${image !== '' ? `<img class="bg" src="${escapeAttr(image)}" alt="">` : ''}
    <div class="bg-scrim"></div>
    <article class="card">
      ${eyebrow !== '' ? `<div class="eyebrow">${escapeText(eyebrow)}</div>` : ''}
      ${title !== '' ? `<h1 class="title">${escapeText(title)}</h1>` : ''}
      ${subtitle !== '' ? `<div class="subtitle">${escapeText(subtitle)}</div>` : ''}
    </article>
  </section>`.trim();

  const sel = (s: string) => `#${id}${s === '' ? '' : ' ' + s}`;

  return {
    html,
    css: PHOTO_CARD_CSS,
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
      // image gentle scale (smaller than ken-burns: 1.0 → 1.04)
      {
        selector: sel('.bg'),
        easing: 'linear',
        keyframes: [
          { atMs: 0, props: { transform: 'scale(1)' } },
          { atMs: startMs, props: { transform: 'scale(1)' } },
          { atMs: endMs, props: { transform: 'scale(1.04)' } },
        ],
      },
      // card slides up from below
      {
        selector: sel('.card'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'translateY(60px)' } },
          { atMs: Math.max(0, inStart + 300 - 1), props: { opacity: 0, transform: 'translateY(60px)' } },
          { atMs: inStart + 300 + 750, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'translateY(20px)' } },
        ],
      },
    ],
  };
};

export const PHOTO_CARD_CSS = `
  .slide-photo-card {
    position: absolute; inset: 0;
    overflow: hidden;
    opacity: 0;
  }
  .slide-photo-card .bg {
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    object-fit: cover;
    transform-origin: center center;
    transform: scale(1);
  }
  .slide-photo-card .bg-scrim {
    position: absolute; inset: 0;
    background: linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.35) 100%);
    pointer-events: none;
  }
  .slide-photo-card .card {
    position: absolute;
    left: 8%; right: 8%;
    bottom: 8%;
    padding: 40px 44px 44px 44px;
    border-radius: 20px;
    background: rgba(15, 15, 20, 0.82);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    box-shadow: 0 24px 60px rgba(0,0,0,0.45);
    color: white;
    opacity: 0;
    transform: translateY(60px);
  }
  .slide-photo-card .eyebrow {
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 6px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.7);
    margin-bottom: 14px;
  }
  .slide-photo-card .title {
    font-size: 64px;
    font-weight: 800;
    letter-spacing: -1.5px;
    margin: 0 0 16px 0;
    line-height: 1.1;
    text-shadow: 0 4px 20px rgba(0,0,0,0.4);
  }
  .slide-photo-card .subtitle {
    font-size: 26px;
    font-weight: 500;
    color: rgba(255,255,255,0.88);
    line-height: 1.35;
    margin: 0;
  }
`;
