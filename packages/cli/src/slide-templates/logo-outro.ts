import { escapeAttr, escapeText } from './escape';
import type { SlideRenderOutput, SlideSpec, SlideTemplate } from './types';

/**
 * logo-outro — designed for the closing slide. Logo (image or
 * stylized text) pops into the center, an optional tagline fades up
 * beneath it, then in the last second the logo shrinks and migrates
 * toward the bottom-right corner before the scene cross-fades out.
 *
 * Slot usage:
 *   - spec.image    → <img class="logo-art"> (preferred visual logo)
 *   - spec.title    → large wordmark. Rendered when no image is set,
 *                     OR alongside the image as a caption line.
 *   - spec.subtitle → tagline under the logo (e.g. "thanks for watching")
 *
 * For slides shorter than ~1.4 s, the shrink phase is compressed
 * automatically so entrance + shrink don't overlap.
 */
export const logoOutro: SlideTemplate = (spec: SlideSpec): SlideRenderOutput => {
  const { index, startMs, endMs } = spec;
  const title = spec.title ?? '';
  const subtitle = spec.subtitle ?? '';
  const image = spec.image ?? '';
  const hasImage = image !== '';
  const hasTextMark = title !== '' && !hasImage;

  const FADE_MS = 400;
  const inStart = startMs;
  const inEnd = startMs + FADE_MS;
  const outStart = endMs - FADE_MS;
  const outEnd = endMs;

  const id = `slide-${index}`;

  const logoBody = hasImage
    ? `<img class="logo-art" src="${escapeAttr(image)}" alt="${escapeText(title)}">`
    : hasTextMark
      ? `<div class="wordmark">${escapeText(title)}</div>`
      : '';

  const html = `
  <section class="slide slide-logo-outro" id="${id}" data-slide-index="${index}">
    <div class="logo-wrap">
      <div class="logo">
        ${logoBody}
        ${hasImage && title !== '' ? `<div class="wordmark small">${escapeText(title)}</div>` : ''}
      </div>
    </div>
    ${subtitle !== '' ? `<div class="tagline">${escapeText(subtitle)}</div>` : ''}
  </section>`.trim();

  const sel = (s: string) => `#${id}${s === '' ? '' : ' ' + s}`;

  const entranceStart = inStart + 80;
  const ENTRANCE_MS = 720;
  const entranceEnd = entranceStart + ENTRANCE_MS;
  // Shrink phase: ideally 600 ms before outStart. If there isn't room,
  // compress gracefully so entrance + shrink still play in order.
  const desiredShrinkStart = outStart - 700;
  const shrinkStart = Math.max(entranceEnd + 100, desiredShrinkStart);
  const shrinkEnd = Math.max(shrinkStart + 200, outStart - 100);

  return {
    html,
    css: LOGO_OUTRO_CSS,
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
      // logo: entrance (bounce-pop into center), hold, shrink to corner
      {
        selector: sel('.logo'),
        easing: 'cubic-bezier(.34,1.56,.64,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'translate(0,0) scale(0.6)' } },
          {
            atMs: Math.max(0, entranceStart - 1),
            props: { opacity: 0, transform: 'translate(0,0) scale(0.6)' },
          },
          {
            atMs: entranceEnd,
            props: { opacity: 1, transform: 'translate(0,0) scale(1)' },
          },
          {
            atMs: shrinkStart,
            props: { opacity: 1, transform: 'translate(0,0) scale(1)' },
          },
          {
            atMs: shrinkEnd,
            props: { opacity: 1, transform: 'translate(38vw, 38vh) scale(0.25)' },
          },
          {
            atMs: outEnd,
            props: { opacity: 0, transform: 'translate(38vw, 38vh) scale(0.25)' },
          },
        ],
      },
      // tagline fade-up after logo entrance; fade-out at shrink start.
      // Transform keeps translateX(-50%) for horizontal centering (see CSS).
      {
        selector: sel('.tagline'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'translateX(-50%) translateY(18px)' } },
          {
            atMs: Math.max(0, entranceEnd + 120 - 1),
            props: { opacity: 0, transform: 'translateX(-50%) translateY(18px)' },
          },
          {
            atMs: Math.min(shrinkStart - 50, entranceEnd + 120 + 620),
            props: { opacity: 1, transform: 'translateX(-50%) translateY(0px)' },
          },
          { atMs: shrinkStart, props: { opacity: 1, transform: 'translateX(-50%) translateY(0px)' } },
          { atMs: shrinkEnd, props: { opacity: 0, transform: 'translateX(-50%) translateY(-8px)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'translateX(-50%) translateY(-8px)' } },
        ],
      },
    ],
  };
};

export const LOGO_OUTRO_CSS = `
  .slide-logo-outro {
    position: absolute; inset: 0;
    opacity: 0;
    color: white;
    overflow: hidden;
  }
  .slide-logo-outro .logo-wrap {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    pointer-events: none;
  }
  .slide-logo-outro .logo {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 16px;
    opacity: 0;
    transform: translate(0,0) scale(0.6);
    transform-origin: center center;
    will-change: transform, opacity;
  }
  .slide-logo-outro .logo-art {
    max-width: 36vw;
    max-height: 40vh;
    width: auto;
    height: auto;
    object-fit: contain;
    display: block;
    filter: drop-shadow(0 20px 40px rgba(0,0,0,0.35));
  }
  .slide-logo-outro .wordmark {
    font-size: 128px;
    font-weight: 900;
    letter-spacing: -2px;
    line-height: 1;
    text-shadow: 0 8px 32px rgba(0,0,0,0.4);
  }
  .slide-logo-outro .wordmark.small {
    font-size: 36px;
    font-weight: 700;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.85);
  }
  .slide-logo-outro .tagline {
    position: absolute;
    left: 50%; bottom: 18%;
    transform: translateX(-50%) translateY(18px);
    font-size: 28px;
    font-weight: 500;
    color: rgba(255,255,255,0.8);
    letter-spacing: 1px;
    opacity: 0;
    text-align: center;
  }
`;
