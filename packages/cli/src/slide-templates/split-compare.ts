import { escapeText } from './escape';
import type { SlideRenderOutput, SlideSpec, SlideTemplate } from './types';

/**
 * split-compare — two-column contrast. A vertical divider in the
 * middle; each half has its own title + body (which may be a multi-
 * line code sample, a bullet list, or prose). Designed for
 * "before / after", "手写 vs DSL", "old vs new" narratives.
 *
 * Slots:
 *   - title          → banner title above both columns (optional)
 *   - subtitle       → banner subtitle (optional)
 *   - extras.leftTitle   → left-column header
 *   - extras.leftBody    → left-column body; newlines render as
 *                          separate <div class="line"> rows so
 *                          inline code / bullet lists read cleanly
 *   - extras.rightTitle  → right-column header
 *   - extras.rightBody   → right-column body (same format)
 *   - extras.leftTag     → small pill above leftTitle (e.g. "BEFORE")
 *   - extras.rightTag    → small pill above rightTitle (e.g. "AFTER")
 */
export const splitCompare: SlideTemplate = (spec: SlideSpec): SlideRenderOutput => {
  const { index, startMs, endMs } = spec;
  const title = spec.title ?? '';
  const subtitle = spec.subtitle ?? '';
  const leftTitle = String(spec.extras?.leftTitle ?? '');
  const leftBody = String(spec.extras?.leftBody ?? '');
  const rightTitle = String(spec.extras?.rightTitle ?? '');
  const rightBody = String(spec.extras?.rightBody ?? '');
  const leftTag = String(spec.extras?.leftTag ?? '');
  const rightTag = String(spec.extras?.rightTag ?? '');

  const FADE_MS = 400;
  const inStart = startMs;
  const inEnd = startMs + FADE_MS;
  const outStart = endMs - FADE_MS;
  const outEnd = endMs;

  const id = `slide-${index}`;

  const bodyLines = (raw: string) =>
    raw
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .map((l) => `<div class="line">${escapeText(l)}</div>`)
      .join('');

  const html = `
  <section class="slide slide-split-compare" id="${id}" data-slide-index="${index}">
    ${title !== '' || subtitle !== '' ? `
    <div class="banner">
      ${title !== '' ? `<h1 class="title">${escapeText(title)}</h1>` : ''}
      ${subtitle !== '' ? `<div class="subtitle">${escapeText(subtitle)}</div>` : ''}
    </div>` : ''}
    <div class="compare">
      <div class="column left">
        ${leftTag !== '' ? `<div class="col-tag left-tag">${escapeText(leftTag)}</div>` : ''}
        ${leftTitle !== '' ? `<h2 class="col-title">${escapeText(leftTitle)}</h2>` : ''}
        <div class="col-body">${bodyLines(leftBody)}</div>
      </div>
      <div class="divider"></div>
      <div class="column right">
        ${rightTag !== '' ? `<div class="col-tag right-tag">${escapeText(rightTag)}</div>` : ''}
        ${rightTitle !== '' ? `<h2 class="col-title">${escapeText(rightTitle)}</h2>` : ''}
        <div class="col-body">${bodyLines(rightBody)}</div>
      </div>
    </div>
  </section>`.trim();

  const sel = (s: string) => `#${id}${s === '' ? '' : ' ' + s}`;

  return {
    html,
    css: SPLIT_COMPARE_CSS,
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
      // banner fade-up
      {
        selector: sel('.banner'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'translateY(14px)' } },
          { atMs: Math.max(0, inStart + 100 - 1), props: { opacity: 0, transform: 'translateY(14px)' } },
          { atMs: inStart + 100 + 500, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'translateY(-8px)' } },
        ],
      },
      // divider grows vertically from top
      {
        selector: sel('.divider'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { transform: 'scaleY(0)' } },
          { atMs: Math.max(0, inStart + 200 - 1), props: { transform: 'scaleY(0)' } },
          { atMs: inStart + 200 + 600, props: { transform: 'scaleY(1)' } },
          { atMs: outStart, props: { transform: 'scaleY(1)' } },
          { atMs: outEnd, props: { transform: 'scaleY(0)' } },
        ],
      },
      // left column slides in from left
      {
        selector: sel('.column.left'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'translateX(-30px)' } },
          { atMs: Math.max(0, inStart + 380 - 1), props: { opacity: 0, transform: 'translateX(-30px)' } },
          { atMs: inStart + 380 + 600, props: { opacity: 1, transform: 'translateX(0px)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'translateX(0px)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'translateX(-10px)' } },
        ],
      },
      // right column slides in from right (later, so eye reads L → R)
      {
        selector: sel('.column.right'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'translateX(30px)' } },
          { atMs: Math.max(0, inStart + 620 - 1), props: { opacity: 0, transform: 'translateX(30px)' } },
          { atMs: inStart + 620 + 600, props: { opacity: 1, transform: 'translateX(0px)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'translateX(0px)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'translateX(10px)' } },
        ],
      },
    ],
  };
};

export const SPLIT_COMPARE_CSS = `
  .slide-split-compare {
    position: absolute; inset: 0;
    display: flex; flex-direction: column;
    opacity: 0;
    color: white;
    padding: 48px 64px;
    box-sizing: border-box;
    gap: 28px;
  }
  .slide-split-compare .banner {
    text-align: center;
    flex: 0 0 auto;
    opacity: 0;
    transform: translateY(14px);
  }
  .slide-split-compare .banner .title {
    font-size: 40px;
    font-weight: 800;
    letter-spacing: -1px;
    margin: 0 0 6px 0;
  }
  .slide-split-compare .banner .subtitle {
    font-size: 18px;
    font-weight: 500;
    color: rgba(255,255,255,0.65);
    letter-spacing: 0.5px;
  }
  .slide-split-compare .compare {
    flex: 1 1 auto;
    display: flex;
    align-items: stretch;
    gap: 0;
    min-height: 0;
  }
  .slide-split-compare .column {
    flex: 1 1 0;
    display: flex; flex-direction: column;
    gap: 14px;
    padding: 0 28px;
    min-width: 0;
    opacity: 0;
  }
  .slide-split-compare .column.left { transform: translateX(-30px); }
  .slide-split-compare .column.right { transform: translateX(30px); }
  .slide-split-compare .divider {
    width: 2px;
    background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.35), rgba(255,255,255,0.05));
    transform: scaleY(0);
    transform-origin: top center;
    border-radius: 1px;
  }
  .slide-split-compare .col-tag {
    display: inline-block;
    align-self: flex-start;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 3px;
    text-transform: uppercase;
    padding: 3px 10px;
    border-radius: 3px;
  }
  .slide-split-compare .col-tag.left-tag {
    color: rgba(255, 120, 120, 0.95);
    border: 1.5px solid rgba(255, 120, 120, 0.55);
  }
  .slide-split-compare .col-tag.right-tag {
    color: rgba(140, 230, 160, 0.98);
    border: 1.5px solid rgba(140, 230, 160, 0.55);
  }
  .slide-split-compare .col-title {
    font-size: 26px;
    font-weight: 700;
    letter-spacing: -0.3px;
    margin: 0;
    line-height: 1.2;
  }
  .slide-split-compare .col-body {
    display: flex; flex-direction: column;
    gap: 6px;
    font-family: ui-monospace, "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace;
    font-size: 16px;
    line-height: 1.45;
    color: rgba(255,255,255,0.82);
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px;
    padding: 14px 16px;
  }
  .slide-split-compare .line {
    white-space: pre-wrap;
    word-break: break-word;
  }
`;
