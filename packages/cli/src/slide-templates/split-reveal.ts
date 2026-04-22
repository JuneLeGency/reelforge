import { escapeText } from './escape';
import type { SlideRenderOutput, SlideSpec, SlideTemplate } from './types';

/**
 * split-reveal — title split horizontally across the middle; top half
 * drops from above, bottom half rises from below; subtitle fades in
 * underneath. Dramatic for chapter cards.
 */
export const splitReveal: SlideTemplate = (spec: SlideSpec): SlideRenderOutput => {
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
  <section class="slide slide-split-reveal" id="${id}" data-slide-index="${index}">
    <div class="title-split" aria-label="${escapeText(title)}">
      <div class="split-top"><span>${escapeText(title)}</span></div>
      <div class="split-bottom"><span>${escapeText(title)}</span></div>
    </div>
    ${subtitle !== '' ? `<div class="subtitle">${escapeText(subtitle)}</div>` : ''}
    <div class="center-line"></div>
  </section>`.trim();

  const sel = (s: string) => `#${id}${s === '' ? '' : ' ' + s}`;

  return {
    html,
    css: SPLIT_REVEAL_CSS,
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
      // center divider line expands
      {
        selector: sel('.center-line'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { transform: 'scaleX(0)' } },
          { atMs: Math.max(0, inStart + 160 - 1), props: { transform: 'scaleX(0)' } },
          { atMs: inStart + 160 + 500, props: { transform: 'scaleX(1)' } },
          { atMs: outStart, props: { transform: 'scaleX(1)' } },
          { atMs: outEnd, props: { transform: 'scaleX(0)' } },
        ],
      },
      // top half drops down
      {
        selector: sel('.split-top span'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { transform: 'translateY(-80px)' } },
          { atMs: Math.max(0, inStart + 320 - 1), props: { transform: 'translateY(-80px)' } },
          { atMs: inStart + 320 + 750, props: { transform: 'translateY(0px)' } },
          { atMs: outStart, props: { transform: 'translateY(0px)' } },
          { atMs: outEnd, props: { transform: 'translateY(-30px)' } },
        ],
      },
      // bottom half rises up
      {
        selector: sel('.split-bottom span'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { transform: 'translateY(80px)' } },
          { atMs: Math.max(0, inStart + 320 - 1), props: { transform: 'translateY(80px)' } },
          { atMs: inStart + 320 + 750, props: { transform: 'translateY(0px)' } },
          { atMs: outStart, props: { transform: 'translateY(0px)' } },
          { atMs: outEnd, props: { transform: 'translateY(30px)' } },
        ],
      },
      // subtitle fade-up
      {
        selector: sel('.subtitle'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'translateY(20px)' } },
          { atMs: Math.max(0, inStart + 720 - 1), props: { opacity: 0, transform: 'translateY(20px)' } },
          { atMs: inStart + 720 + 600, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'translateY(-10px)' } },
        ],
      },
    ],
  };
};

export const SPLIT_REVEAL_CSS = `
  .slide-split-reveal {
    position: absolute; inset: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    opacity: 0;
    color: white;
    overflow: hidden;
  }
  .slide-split-reveal .title-split {
    position: relative;
    width: 100%;
    height: 240px;
    display: flex; align-items: center; justify-content: center;
    overflow: hidden;
  }
  .slide-split-reveal .split-top,
  .slide-split-reveal .split-bottom {
    position: absolute;
    left: 0; right: 0;
    height: 50%;
    overflow: hidden;
    display: flex; align-items: center; justify-content: center;
  }
  .slide-split-reveal .split-top { top: 0; align-items: flex-end; }
  .slide-split-reveal .split-bottom { bottom: 0; align-items: flex-start; }
  .slide-split-reveal .split-top span,
  .slide-split-reveal .split-bottom span {
    display: inline-block;
    font-size: 140px;
    font-weight: 900;
    letter-spacing: -3px;
    line-height: 1;
    text-shadow: 0 10px 40px rgba(0,0,0,0.35);
  }
  .slide-split-reveal .split-top span { transform: translateY(-80px); }
  .slide-split-reveal .split-bottom span { transform: translateY(80px); }
  .slide-split-reveal .center-line {
    position: absolute;
    left: 10vw; right: 10vw;
    top: 50%;
    height: 2px;
    background: rgba(255,255,255,0.5);
    transform: scaleX(0);
    transform-origin: center;
    z-index: 2;
  }
  .slide-split-reveal .subtitle {
    margin-top: 36px;
    font-size: 38px;
    font-weight: 500;
    color: rgba(255,255,255,0.9);
    opacity: 0;
    transform: translateY(20px);
  }
`;
