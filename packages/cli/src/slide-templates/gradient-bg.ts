import { escapeText } from './escape';
import type { SlideRenderOutput, SlideSpec, SlideTemplate } from './types';

/**
 * gradient-bg — full-screen animated gradient behind a centered title
 * + subtitle. The gradient slowly rotates its angle and shifts through
 * a 3-stop colour cycle over the slide's full lifetime, giving an
 * "alive" ambient background without needing images.
 *
 * Slots:
 *   - title         → large heading
 *   - subtitle      → smaller lead line
 *   - extras.from / extras.via / extras.to → 3 CSS colours to cycle
 *                     through. Defaults produce a warm magenta →
 *                     purple → cyan loop.
 */
export const gradientBg: SlideTemplate = (spec: SlideSpec): SlideRenderOutput => {
  const { index, startMs, endMs } = spec;
  const title = spec.title ?? '';
  const subtitle = spec.subtitle ?? '';
  const fromColor = String(spec.extras?.from ?? '#ff2a6d');
  const viaColor = String(spec.extras?.via ?? '#7209b7');
  const toColor = String(spec.extras?.to ?? '#05d9e8');

  const FADE_MS = 400;
  const inStart = startMs;
  const inEnd = startMs + FADE_MS;
  const outStart = endMs - FADE_MS;
  const outEnd = endMs;

  const id = `slide-${index}`;
  const html = `
  <section class="slide slide-gradient-bg" id="${id}" data-slide-index="${index}">
    <div class="bg-a" style="background: linear-gradient(115deg, ${fromColor} 0%, ${viaColor} 55%, ${toColor} 100%);"></div>
    <div class="bg-b" style="background: linear-gradient(295deg, ${toColor} 0%, ${viaColor} 45%, ${fromColor} 100%);"></div>
    <div class="veil"></div>
    <div class="copy">
      ${title !== '' ? `<h1 class="title">${escapeText(title)}</h1>` : ''}
      ${subtitle !== '' ? `<div class="subtitle">${escapeText(subtitle)}</div>` : ''}
    </div>
  </section>`.trim();

  const sel = (s: string) => `#${id}${s === '' ? '' : ' ' + s}`;

  return {
    html,
    css: GRADIENT_BG_CSS,
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
      // bg-a zooms + rotates slightly over the whole slide
      {
        selector: sel('.bg-a'),
        easing: 'linear',
        keyframes: [
          { atMs: 0, props: { transform: 'scale(1.05) rotate(0deg)' } },
          { atMs: startMs, props: { transform: 'scale(1.05) rotate(0deg)' } },
          { atMs: endMs, props: { transform: 'scale(1.15) rotate(8deg)' } },
        ],
      },
      // bg-b cross-fades in/out against bg-a — gives the colour shift
      {
        selector: sel('.bg-b'),
        easing: 'linear',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'scale(1.1) rotate(0deg)' } },
          { atMs: startMs, props: { opacity: 0, transform: 'scale(1.1) rotate(0deg)' } },
          {
            atMs: (startMs + endMs) / 2,
            props: { opacity: 0.55, transform: 'scale(1.08) rotate(-6deg)' },
          },
          { atMs: endMs, props: { opacity: 1, transform: 'scale(1.12) rotate(-12deg)' } },
        ],
      },
      // title
      {
        selector: sel('.title'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'translateY(20px)' } },
          { atMs: Math.max(0, inStart + 180 - 1), props: { opacity: 0, transform: 'translateY(20px)' } },
          { atMs: inStart + 180 + 600, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'translateY(-10px)' } },
        ],
      },
      // subtitle
      {
        selector: sel('.subtitle'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'translateY(16px)' } },
          { atMs: Math.max(0, inStart + 440 - 1), props: { opacity: 0, transform: 'translateY(16px)' } },
          { atMs: inStart + 440 + 520, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'translateY(-6px)' } },
        ],
      },
    ],
  };
};

export const GRADIENT_BG_CSS = `
  .slide-gradient-bg {
    position: absolute; inset: 0;
    overflow: hidden;
    opacity: 0;
    color: white;
  }
  .slide-gradient-bg .bg-a,
  .slide-gradient-bg .bg-b {
    position: absolute; inset: -6%;
    transform-origin: center center;
    will-change: transform, opacity;
  }
  .slide-gradient-bg .veil {
    position: absolute; inset: 0;
    background: radial-gradient(ellipse at center, rgba(0,0,0,0) 40%, rgba(0,0,0,0.45) 100%);
    pointer-events: none;
  }
  .slide-gradient-bg .copy {
    position: absolute; inset: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 0 64px;
    text-align: center;
  }
  .slide-gradient-bg .title {
    font-size: 96px;
    font-weight: 900;
    letter-spacing: -2px;
    line-height: 1.05;
    margin: 0 0 16px 0;
    text-shadow: 0 8px 36px rgba(0,0,0,0.55);
    opacity: 0;
    transform: translateY(20px);
  }
  .slide-gradient-bg .subtitle {
    font-size: 28px;
    font-weight: 500;
    color: rgba(255,255,255,0.94);
    text-shadow: 0 4px 18px rgba(0,0,0,0.55);
    opacity: 0;
    transform: translateY(16px);
  }
`;
