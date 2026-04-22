import { escapeAttr, escapeText } from './escape';
import type { SlideRenderOutput, SlideSpec, SlideTemplate } from './types';

/**
 * ken-burns-zoom — full-bleed image with slow scale + pan, optional
 * title/subtitle overlay. Classic "documentary" feel.
 *
 * The image scales from 1.0 → 1.08 linearly over the slide's full
 * duration; a gentle vignette darkens the edges so text stays legible.
 */
export const kenBurnsZoom: SlideTemplate = (spec: SlideSpec): SlideRenderOutput => {
  const { index, startMs, endMs } = spec;
  const title = spec.title ?? '';
  const subtitle = spec.subtitle ?? '';
  const image = spec.image ?? '';

  const FADE_MS = 400;
  const inStart = startMs;
  const inEnd = startMs + FADE_MS;
  const outStart = endMs - FADE_MS;
  const outEnd = endMs;

  const id = `slide-${index}`;
  const html = `
  <section class="slide slide-ken-burns" id="${id}" data-slide-index="${index}">
    ${image !== '' ? `<img class="bg" src="${escapeAttr(image)}" alt="">` : ''}
    <div class="vignette"></div>
    <div class="copy">
      ${title !== '' ? `<h1 class="title">${escapeText(title)}</h1>` : ''}
      ${subtitle !== '' ? `<div class="subtitle">${escapeText(subtitle)}</div>` : ''}
    </div>
  </section>`.trim();

  const sel = (s: string) => `#${id}${s === '' ? '' : ' ' + s}`;

  return {
    html,
    css: KEN_BURNS_CSS,
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
      // image slow zoom (1.0 → 1.08 over full slide)
      {
        selector: sel('.bg'),
        easing: 'linear',
        keyframes: [
          { atMs: 0, props: { transform: 'scale(1)' } },
          { atMs: startMs, props: { transform: 'scale(1)' } },
          { atMs: endMs, props: { transform: 'scale(1.08)' } },
        ],
      },
      // title fade-up
      {
        selector: sel('.title'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'translateY(24px)' } },
          { atMs: Math.max(0, inStart + 260 - 1), props: { opacity: 0, transform: 'translateY(24px)' } },
          { atMs: inStart + 260 + 700, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'translateY(-12px)' } },
        ],
      },
      // subtitle fade-up
      {
        selector: sel('.subtitle'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'translateY(18px)' } },
          { atMs: Math.max(0, inStart + 520 - 1), props: { opacity: 0, transform: 'translateY(18px)' } },
          { atMs: inStart + 520 + 650, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'translateY(-8px)' } },
        ],
      },
    ],
  };
};

export const KEN_BURNS_CSS = `
  .slide-ken-burns {
    position: absolute; inset: 0;
    overflow: hidden;
    opacity: 0;
  }
  .slide-ken-burns .bg {
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    object-fit: cover;
    transform-origin: center center;
    transform: scale(1);
  }
  .slide-ken-burns .vignette {
    position: absolute; inset: 0;
    background: radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%);
    pointer-events: none;
  }
  .slide-ken-burns .copy {
    position: absolute; inset: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: flex-end;
    padding: 0 48px 88px 48px;
    color: white;
    text-align: center;
  }
  .slide-ken-burns .title {
    font-size: 96px; font-weight: 800;
    letter-spacing: -1.5px;
    margin: 0 0 20px 0;
    text-shadow: 0 6px 24px rgba(0,0,0,0.55);
    opacity: 0;
    transform: translateY(24px);
  }
  .slide-ken-burns .subtitle {
    font-size: 38px; font-weight: 500;
    color: rgba(255,255,255,0.94);
    text-shadow: 0 4px 18px rgba(0,0,0,0.55);
    opacity: 0;
    transform: translateY(18px);
  }
`;
