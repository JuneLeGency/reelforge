import { escapeText } from './escape';
import type { SlideRenderOutput, SlideSpec, SlideTemplate } from './types';

/**
 * news-title — broadcast-style breaking-news banner. A red "BREAKING"
 * pill slides in from the left; the main headline animates to the
 * right of it; a ticker band at the bottom scrolls a secondary line.
 *
 * Slots:
 *   - title         → main headline (the large red + white part)
 *   - subtitle      → sub-line under the headline (smaller, lighter)
 *   - bullets       → ticker lines — joined with "  •  " and scrolled
 *   - extras.tag    → pill label, default "BREAKING"
 *   - extras.source → small source badge top-right (e.g. "REELFORGE LIVE")
 */
export const newsTitle: SlideTemplate = (spec: SlideSpec): SlideRenderOutput => {
  const { index, startMs, endMs } = spec;
  const title = spec.title ?? '';
  const subtitle = spec.subtitle ?? '';
  const bullets = spec.bullets ?? [];
  const tag = String(spec.extras?.tag ?? 'BREAKING');
  const source = String(spec.extras?.source ?? 'REELFORGE LIVE');

  const FADE_MS = 400;
  const inStart = startMs;
  const inEnd = startMs + FADE_MS;
  const outStart = endMs - FADE_MS;
  const outEnd = endMs;

  const id = `slide-${index}`;
  const tickerText = bullets.join('  •  ');

  const html = `
  <section class="slide slide-news-title" id="${id}" data-slide-index="${index}">
    ${source !== '' ? `<div class="source">${escapeText(source)}</div>` : ''}
    <div class="headline-row">
      ${tag !== '' ? `<div class="tag">${escapeText(tag)}</div>` : ''}
      <div class="headline-text">
        ${title !== '' ? `<h1 class="headline">${escapeText(title)}</h1>` : ''}
        ${subtitle !== '' ? `<div class="subhead">${escapeText(subtitle)}</div>` : ''}
      </div>
    </div>
    ${tickerText !== '' ? `
    <div class="ticker">
      <div class="ticker-label">LIVE</div>
      <div class="ticker-rail">
        <div class="ticker-text">${escapeText(tickerText)}</div>
      </div>
    </div>` : ''}
  </section>`.trim();

  const sel = (s: string) => `#${id}${s === '' ? '' : ' ' + s}`;

  return {
    html,
    css: NEWS_TITLE_CSS,
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
      // source chip
      {
        selector: sel('.source'),
        easing: 'linear',
        keyframes: [
          { atMs: 0, props: { opacity: 0 } },
          { atMs: Math.max(0, inStart + 80 - 1), props: { opacity: 0 } },
          { atMs: inStart + 80 + 380, props: { opacity: 1 } },
          { atMs: outStart, props: { opacity: 1 } },
          { atMs: outEnd, props: { opacity: 0 } },
        ],
      },
      // BREAKING tag slides in from left
      {
        selector: sel('.tag'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'translateX(-40px)' } },
          { atMs: Math.max(0, inStart + 160 - 1), props: { opacity: 0, transform: 'translateX(-40px)' } },
          { atMs: inStart + 160 + 500, props: { opacity: 1, transform: 'translateX(0px)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'translateX(0px)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'translateX(-8px)' } },
        ],
      },
      // headline fades up
      {
        selector: sel('.headline'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'translateY(14px)' } },
          { atMs: Math.max(0, inStart + 360 - 1), props: { opacity: 0, transform: 'translateY(14px)' } },
          { atMs: inStart + 360 + 500, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'translateY(-6px)' } },
        ],
      },
      // subhead
      {
        selector: sel('.subhead'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'translateY(10px)' } },
          { atMs: Math.max(0, inStart + 540 - 1), props: { opacity: 0, transform: 'translateY(10px)' } },
          { atMs: inStart + 540 + 450, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'translateY(-4px)' } },
        ],
      },
      // ticker text scrolls right-to-left across the full slide duration
      {
        selector: sel('.ticker-text'),
        easing: 'linear',
        keyframes: [
          { atMs: 0, props: { transform: 'translateX(100%)' } },
          { atMs: Math.max(0, inStart + 700 - 1), props: { transform: 'translateX(100%)' } },
          { atMs: outEnd, props: { transform: 'translateX(-100%)' } },
        ],
      },
    ],
  };
};

export const NEWS_TITLE_CSS = `
  .slide-news-title {
    position: absolute; inset: 0;
    background: linear-gradient(180deg, #0e1624 0%, #0b0f1a 100%);
    opacity: 0;
    color: white;
    overflow: hidden;
    display: flex; flex-direction: column; justify-content: center;
    padding: 0;
  }
  .slide-news-title .source {
    position: absolute;
    top: 28px; right: 36px;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 4px;
    color: rgba(255,255,255,0.6);
    opacity: 0;
  }
  .slide-news-title .source::before {
    content: "● ";
    color: #ff2d2d;
    animation: rf-news-pulse 1.2s ease-in-out infinite;
  }
  @keyframes rf-news-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.35; }
  }
  .slide-news-title .headline-row {
    display: flex; align-items: center;
    gap: 20px;
    padding: 0 56px;
    margin-bottom: 20px;
  }
  .slide-news-title .tag {
    flex: 0 0 auto;
    align-self: stretch;
    padding: 10px 18px;
    display: flex; align-items: center;
    background: #e60023;
    color: white;
    font-weight: 900;
    font-size: 22px;
    letter-spacing: 3px;
    border-radius: 3px;
    box-shadow: 0 6px 20px rgba(230, 0, 35, 0.42);
    opacity: 0;
    transform: translateX(-40px);
  }
  .slide-news-title .headline-text {
    flex: 1 1 auto;
    min-width: 0;
  }
  .slide-news-title .headline {
    font-size: 52px;
    font-weight: 900;
    line-height: 1.1;
    letter-spacing: -1px;
    margin: 0;
    text-shadow: 0 4px 16px rgba(0,0,0,0.4);
    opacity: 0;
    transform: translateY(14px);
  }
  .slide-news-title .subhead {
    margin-top: 10px;
    font-size: 22px;
    font-weight: 500;
    color: rgba(255,255,255,0.74);
    letter-spacing: 0.3px;
    opacity: 0;
    transform: translateY(10px);
  }
  .slide-news-title .ticker {
    position: absolute;
    left: 0; right: 0; bottom: 6%;
    height: 44px;
    display: flex; align-items: stretch;
    background: #0a0a14;
    border-top: 1px solid rgba(255,255,255,0.06);
  }
  .slide-news-title .ticker-label {
    flex: 0 0 auto;
    padding: 0 18px;
    background: #e60023;
    color: white;
    display: flex; align-items: center;
    font-size: 14px;
    font-weight: 900;
    letter-spacing: 4px;
  }
  .slide-news-title .ticker-rail {
    flex: 1 1 auto;
    position: relative;
    overflow: hidden;
    display: flex; align-items: center;
  }
  .slide-news-title .ticker-text {
    white-space: nowrap;
    font-size: 18px;
    font-weight: 600;
    padding: 0 24px;
    color: rgba(255,255,255,0.88);
    letter-spacing: 0.3px;
    transform: translateX(100%);
    will-change: transform;
  }
`;
