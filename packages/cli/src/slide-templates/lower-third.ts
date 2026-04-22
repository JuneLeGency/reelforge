import { escapeAttr, escapeText } from './escape';
import type { SlideRenderOutput, SlideSpec, SlideTemplate } from './types';

/**
 * lower-third — broadcast-style name/role bar anchored to the bottom
 * left. Typically used as an overlay on a talking-head or b-roll
 * slide. The bar slides in from the left, contents stagger fade.
 *
 * Slots:
 *   - title        → person / entity name
 *   - subtitle     → role / affiliation
 *   - image        → optional full-bleed background (e.g. talking-head photo)
 *   - extras.tag   → small colored pill above the name (e.g. "LIVE", "CEO")
 */
export const lowerThird: SlideTemplate = (spec: SlideSpec): SlideRenderOutput => {
  const { index, startMs, endMs } = spec;
  const title = spec.title ?? '';
  const subtitle = spec.subtitle ?? '';
  const image = spec.image ?? '';
  const tag = String(spec.extras?.tag ?? '');

  const FADE_MS = 400;
  const inStart = startMs;
  const inEnd = startMs + FADE_MS;
  const outStart = endMs - FADE_MS;
  const outEnd = endMs;

  const id = `slide-${index}`;
  const html = `
  <section class="slide slide-lower-third" id="${id}" data-slide-index="${index}">
    ${image !== '' ? `<img class="bg" src="${escapeAttr(image)}" alt="">` : ''}
    <div class="bar">
      <div class="accent-strip"></div>
      <div class="content">
        ${tag !== '' ? `<div class="tag">${escapeText(tag)}</div>` : ''}
        ${title !== '' ? `<div class="name">${escapeText(title)}</div>` : ''}
        ${subtitle !== '' ? `<div class="role">${escapeText(subtitle)}</div>` : ''}
      </div>
    </div>
  </section>`.trim();

  const sel = (s: string) => `#${id}${s === '' ? '' : ' ' + s}`;

  return {
    html,
    css: LOWER_THIRD_CSS,
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
      // bar slides in from left
      {
        selector: sel('.bar'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'translateX(-60px)' } },
          { atMs: Math.max(0, inStart + 160 - 1), props: { opacity: 0, transform: 'translateX(-60px)' } },
          { atMs: inStart + 160 + 650, props: { opacity: 1, transform: 'translateX(0px)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'translateX(0px)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'translateX(-30px)' } },
        ],
      },
      // accent strip grows from top
      {
        selector: sel('.accent-strip'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { transform: 'scaleY(0)' } },
          { atMs: Math.max(0, inStart + 260 - 1), props: { transform: 'scaleY(0)' } },
          { atMs: inStart + 260 + 500, props: { transform: 'scaleY(1)' } },
          { atMs: outStart, props: { transform: 'scaleY(1)' } },
          { atMs: outEnd, props: { transform: 'scaleY(0)' } },
        ],
      },
      // tag pop
      {
        selector: sel('.tag'),
        easing: 'cubic-bezier(.34,1.56,.64,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'scale(0.6)' } },
          { atMs: Math.max(0, inStart + 440 - 1), props: { opacity: 0, transform: 'scale(0.6)' } },
          { atMs: inStart + 440 + 400, props: { opacity: 1, transform: 'scale(1)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'scale(1)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'scale(0.9)' } },
        ],
      },
      // name fade-up
      {
        selector: sel('.name'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'translateY(14px)' } },
          { atMs: Math.max(0, inStart + 520 - 1), props: { opacity: 0, transform: 'translateY(14px)' } },
          { atMs: inStart + 520 + 500, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'translateY(-6px)' } },
        ],
      },
      // role fade-up later
      {
        selector: sel('.role'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'translateY(12px)' } },
          { atMs: Math.max(0, inStart + 680 - 1), props: { opacity: 0, transform: 'translateY(12px)' } },
          { atMs: inStart + 680 + 450, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'translateY(-6px)' } },
        ],
      },
    ],
  };
};

export const LOWER_THIRD_CSS = `
  .slide-lower-third {
    position: absolute; inset: 0;
    opacity: 0;
    overflow: hidden;
    color: white;
  }
  .slide-lower-third .bg {
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    object-fit: cover;
  }
  .slide-lower-third .bar {
    position: absolute;
    left: 60px; bottom: 72px;
    min-width: 420px;
    max-width: 60vw;
    display: flex; align-items: stretch;
    background: rgba(10, 10, 18, 0.82);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-radius: 4px;
    box-shadow: 0 12px 32px rgba(0,0,0,0.35);
    opacity: 0;
    transform: translateX(-60px);
  }
  .slide-lower-third .accent-strip {
    width: 6px;
    background: linear-gradient(180deg, #ff2d2d 0%, #ff6b6b 100%);
    transform: scaleY(0);
    transform-origin: top center;
    border-radius: 4px 0 0 4px;
  }
  .slide-lower-third .content {
    padding: 20px 28px 22px 24px;
    display: flex; flex-direction: column;
    gap: 6px;
  }
  .slide-lower-third .tag {
    display: inline-block;
    align-self: flex-start;
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #ff2d2d;
    padding: 3px 10px;
    border: 1.5px solid rgba(255, 45, 45, 0.6);
    border-radius: 3px;
    margin-bottom: 4px;
    opacity: 0;
    transform: scale(0.6);
    transform-origin: left center;
  }
  .slide-lower-third .name {
    font-size: 42px;
    font-weight: 800;
    letter-spacing: -0.5px;
    line-height: 1.15;
    opacity: 0;
    transform: translateY(14px);
  }
  .slide-lower-third .role {
    font-size: 20px;
    font-weight: 500;
    color: rgba(255,255,255,0.75);
    letter-spacing: 0.5px;
    opacity: 0;
    transform: translateY(12px);
  }
`;
