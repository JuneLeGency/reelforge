import { escapeAttr, escapeText } from './escape';
import type { SlideRenderOutput, SlideSpec, SlideTemplate } from './types';

/**
 * image-left-text — 50/50 split: image on the left half, title +
 * subtitle + accent rule on the right. Image slides in from the outer
 * edge with a subtle scale; text staggers fade-up.
 *
 * The mirror layout (image on the right) shares this template's CSS —
 * see image-right-text.ts.
 */
export const imageLeftText: SlideTemplate = (spec: SlideSpec): SlideRenderOutput =>
  renderImageTextSplit(spec, 'left');

/**
 * image-right-text — mirror of image-left-text. Image fills the right
 * half, text the left. Shares CSS and animation choreography.
 */
export const imageRightText: SlideTemplate = (spec: SlideSpec): SlideRenderOutput =>
  renderImageTextSplit(spec, 'right');

function renderImageTextSplit(
  spec: SlideSpec,
  side: 'left' | 'right',
): SlideRenderOutput {
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
  const className = side === 'left' ? 'slide-image-left-text' : 'slide-image-right-text';
  const imageX0 = side === 'left' ? -40 : 40;

  const imageCol = `
    <div class="image-col">
      ${image !== '' ? `<img class="image" src="${escapeAttr(image)}" alt="">` : ''}
    </div>`;
  const textCol = `
    <div class="text-col">
      ${eyebrow !== '' ? `<div class="eyebrow">${escapeText(eyebrow)}</div>` : ''}
      <div class="accent-rule"></div>
      ${title !== '' ? `<h1 class="title">${escapeText(title)}</h1>` : ''}
      ${subtitle !== '' ? `<div class="subtitle">${escapeText(subtitle)}</div>` : ''}
    </div>`;

  const html = `
  <section class="slide ${className}" id="${id}" data-slide-index="${index}">
    ${side === 'left' ? imageCol : textCol}
    ${side === 'left' ? textCol : imageCol}
  </section>`.trim();

  const sel = (s: string) => `#${id}${s === '' ? '' : ' ' + s}`;

  return {
    html,
    css: IMAGE_TEXT_SPLIT_CSS,
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
      // image slides in from outer edge + gentle scale-up
      {
        selector: sel('.image'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: `translateX(${imageX0}px) scale(0.95)` } },
          { atMs: Math.max(0, inStart + 160 - 1), props: { opacity: 0, transform: `translateX(${imageX0}px) scale(0.95)` } },
          { atMs: inStart + 160 + 800, props: { opacity: 1, transform: 'translateX(0px) scale(1)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'translateX(0px) scale(1)' } },
          { atMs: outEnd, props: { opacity: 0, transform: `translateX(${imageX0 * 0.4}px) scale(1)` } },
        ],
      },
      // eyebrow
      {
        selector: sel('.eyebrow'),
        easing: 'linear',
        keyframes: [
          { atMs: 0, props: { opacity: 0 } },
          { atMs: Math.max(0, inStart + 120 - 1), props: { opacity: 0 } },
          { atMs: inStart + 120 + 400, props: { opacity: 1 } },
          { atMs: outStart, props: { opacity: 1 } },
          { atMs: outEnd, props: { opacity: 0 } },
        ],
      },
      // accent rule
      {
        selector: sel('.accent-rule'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { transform: 'scaleX(0)' } },
          { atMs: Math.max(0, inStart + 220 - 1), props: { transform: 'scaleX(0)' } },
          { atMs: inStart + 220 + 520, props: { transform: 'scaleX(1)' } },
          { atMs: outStart, props: { transform: 'scaleX(1)' } },
          { atMs: outEnd, props: { transform: 'scaleX(0)' } },
        ],
      },
      // title fade-up
      {
        selector: sel('.title'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'translateY(32px)' } },
          { atMs: Math.max(0, inStart + 320 - 1), props: { opacity: 0, transform: 'translateY(32px)' } },
          { atMs: inStart + 320 + 700, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'translateY(-16px)' } },
        ],
      },
      // subtitle fade-up
      {
        selector: sel('.subtitle'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'translateY(24px)' } },
          { atMs: Math.max(0, inStart + 560 - 1), props: { opacity: 0, transform: 'translateY(24px)' } },
          { atMs: inStart + 560 + 650, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'translateY(-10px)' } },
        ],
      },
    ],
  };
}

export const IMAGE_TEXT_SPLIT_CSS = `
  .slide-image-left-text,
  .slide-image-right-text {
    position: absolute; inset: 0;
    display: flex;
    opacity: 0;
    color: white;
    overflow: hidden;
  }
  .slide-image-left-text .image-col,
  .slide-image-right-text .image-col {
    flex: 1 1 50%;
    position: relative;
    overflow: hidden;
    background: rgba(0,0,0,0.2);
  }
  .slide-image-left-text .text-col,
  .slide-image-right-text .text-col {
    flex: 1 1 50%;
    display: flex; flex-direction: column;
    justify-content: center;
    padding: 0 72px;
    box-sizing: border-box;
  }
  .slide-image-left-text .image,
  .slide-image-right-text .image {
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    object-fit: cover;
    opacity: 0;
    transform: translateX(-40px) scale(0.95);
    transform-origin: center center;
  }
  .slide-image-right-text .image {
    transform: translateX(40px) scale(0.95);
  }
  .slide-image-left-text .eyebrow,
  .slide-image-right-text .eyebrow {
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 6px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.7);
    margin-bottom: 20px;
    opacity: 0;
  }
  .slide-image-left-text .accent-rule,
  .slide-image-right-text .accent-rule {
    width: 72px; height: 4px;
    background: rgba(255,255,255,0.9);
    margin-bottom: 28px;
    border-radius: 2px;
    transform: scaleX(0);
    transform-origin: left center;
  }
  .slide-image-left-text .title,
  .slide-image-right-text .title {
    font-size: 72px;
    font-weight: 800;
    letter-spacing: -1.5px;
    margin: 0 0 20px 0;
    line-height: 1.1;
    text-shadow: 0 6px 24px rgba(0,0,0,0.35);
    opacity: 0;
    transform: translateY(32px);
  }
  .slide-image-left-text .subtitle,
  .slide-image-right-text .subtitle {
    font-size: 30px;
    font-weight: 500;
    color: rgba(255,255,255,0.88);
    line-height: 1.35;
    opacity: 0;
    transform: translateY(24px);
  }
`;
