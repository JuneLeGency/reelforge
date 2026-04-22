import { escapeText } from './escape';
import type { SlideRenderOutput, SlideSpec, SlideTemplate } from './types';

/**
 * bullet-stagger — title left-aligned, bullets slide in from the left
 * with a 150 ms stagger. Ideal for feature lists / 3-5 item takeaways.
 */
export const bulletStagger: SlideTemplate = (spec: SlideSpec): SlideRenderOutput => {
  const { index, startMs, endMs } = spec;
  const title = spec.title ?? '';
  const bullets = spec.bullets ?? [];

  const FADE_MS = 400;
  const inStart = startMs;
  const inEnd = startMs + FADE_MS;
  const outStart = endMs - FADE_MS;
  const outEnd = endMs;

  const id = `slide-${index}`;
  const bulletHtml = bullets
    .map((b, i) => `<li class="bullet" data-i="${i}">${escapeText(b)}</li>`)
    .join('\n        ');

  const html = `
  <section class="slide slide-bullet-stagger" id="${id}" data-slide-index="${index}">
    <div class="pane">
      ${title !== '' ? `<h1 class="title">${escapeText(title)}</h1>` : ''}
      <ul class="bullets">
        ${bulletHtml}
      </ul>
    </div>
  </section>`.trim();

  const sel = (s: string) => `#${id}${s === '' ? '' : ' ' + s}`;

  const STAGGER_MS = 150;
  const BULLET_ENTRANCE_MS = 600;
  const bulletAnims = bullets.map((_, i) => {
    const delay = inStart + 420 + i * STAGGER_MS;
    return {
      selector: sel(`.bullet[data-i="${i}"]`),
      easing: 'cubic-bezier(.22,.9,.32,1)',
      keyframes: [
        { atMs: 0, props: { opacity: 0, transform: 'translateX(-40px)' } },
        { atMs: Math.max(0, delay - 1), props: { opacity: 0, transform: 'translateX(-40px)' } },
        { atMs: delay + BULLET_ENTRANCE_MS, props: { opacity: 1, transform: 'translateX(0px)' } },
        { atMs: outStart, props: { opacity: 1, transform: 'translateX(0px)' } },
        { atMs: outEnd, props: { opacity: 0, transform: 'translateX(16px)' } },
      ],
    };
  });

  return {
    html,
    css: BULLET_STAGGER_CSS,
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
      {
        selector: sel('.title'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'translateY(24px)' } },
          { atMs: Math.max(0, inStart + 140 - 1), props: { opacity: 0, transform: 'translateY(24px)' } },
          { atMs: inStart + 140 + 650, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'translateY(-12px)' } },
        ],
      },
      ...bulletAnims,
    ],
  };
};

export const BULLET_STAGGER_CSS = `
  .slide-bullet-stagger {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: flex-start;
    padding: 0 120px;
    opacity: 0;
    color: white;
  }
  .slide-bullet-stagger .pane {
    max-width: 860px;
  }
  .slide-bullet-stagger .title {
    font-size: 88px;
    font-weight: 800;
    letter-spacing: -1.5px;
    margin: 0 0 48px 0;
    opacity: 0;
    transform: translateY(24px);
  }
  .slide-bullet-stagger .bullets {
    list-style: none;
    padding: 0; margin: 0;
  }
  .slide-bullet-stagger .bullet {
    font-size: 48px;
    font-weight: 600;
    line-height: 1.25;
    padding: 12px 0 12px 40px;
    position: relative;
    color: rgba(255,255,255,0.95);
    opacity: 0;
    transform: translateX(-40px);
  }
  .slide-bullet-stagger .bullet::before {
    content: "";
    position: absolute;
    left: 0; top: 50%;
    width: 20px; height: 4px;
    background: currentColor;
    transform: translateY(-50%);
    border-radius: 2px;
    opacity: 0.85;
  }
`;
