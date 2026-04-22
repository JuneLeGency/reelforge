import { escapeText } from './escape';
import type { SlideRenderOutput, SlideSpec, SlideTemplate } from './types';

/**
 * data-grid — dashboard-style KPI grid. 2×2, 3×2, or 4×2 depending on
 * bullet count. Each bullet is "label: value" (value can carry units),
 * rendered as a big value + muted label per tile. Tiles stagger-pop
 * with an 80 ms offset.
 *
 * Slots:
 *   - title    → banner heading
 *   - subtitle → banner subtitle
 *   - bullets  → one tile each, "Label: 42" or "Label: 42M" format.
 *                Non-numeric values render as-is (big text tile).
 */
export const dataGrid: SlideTemplate = (spec: SlideSpec): SlideRenderOutput => {
  const { index, startMs, endMs } = spec;
  const title = spec.title ?? '';
  const subtitle = spec.subtitle ?? '';
  const bullets = spec.bullets ?? [];

  const FADE_MS = 400;
  const inStart = startMs;
  const inEnd = startMs + FADE_MS;
  const outStart = endMs - FADE_MS;
  const outEnd = endMs;

  const id = `slide-${index}`;
  const tiles = bullets.map(parseTile);
  const cols = pickColumns(tiles.length);

  const tilesHtml = tiles
    .map(
      (t, i) => `
      <div class="tile" data-i="${i}">
        <div class="value">${escapeText(t.value)}</div>
        <div class="label">${escapeText(t.label)}</div>
      </div>`,
    )
    .join('');

  const html = `
  <section class="slide slide-data-grid" id="${id}" data-slide-index="${index}">
    ${title !== '' ? `<h1 class="title">${escapeText(title)}</h1>` : ''}
    ${subtitle !== '' ? `<div class="subtitle">${escapeText(subtitle)}</div>` : ''}
    <div class="grid" data-cols="${cols}" style="grid-template-columns: repeat(${cols}, 1fr);">
      ${tilesHtml}
    </div>
  </section>`.trim();

  const sel = (s: string) => `#${id}${s === '' ? '' : ' ' + s}`;

  const STAGGER_MS = 80;
  const tileStart = inStart + 360;
  const tileAnims = tiles.map((_t, i) => {
    const delay = tileStart + i * STAGGER_MS;
    return {
      selector: sel(`.tile[data-i="${i}"]`),
      easing: 'cubic-bezier(.34,1.56,.64,1)',
      keyframes: [
        { atMs: 0, props: { opacity: 0, transform: 'translateY(18px) scale(0.92)' } },
        { atMs: Math.max(0, delay - 1), props: { opacity: 0, transform: 'translateY(18px) scale(0.92)' } },
        { atMs: delay + 500, props: { opacity: 1, transform: 'translateY(0px) scale(1)' } },
        { atMs: outStart, props: { opacity: 1, transform: 'translateY(0px) scale(1)' } },
        { atMs: outEnd, props: { opacity: 0, transform: 'translateY(-6px) scale(0.96)' } },
      ],
    };
  });

  return {
    html,
    css: DATA_GRID_CSS,
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
          { atMs: 0, props: { opacity: 0, transform: 'translateY(14px)' } },
          { atMs: Math.max(0, inStart + 80 - 1), props: { opacity: 0, transform: 'translateY(14px)' } },
          { atMs: inStart + 80 + 400, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'translateY(-6px)' } },
        ],
      },
      {
        selector: sel('.subtitle'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'translateY(10px)' } },
          { atMs: Math.max(0, inStart + 200 - 1), props: { opacity: 0, transform: 'translateY(10px)' } },
          { atMs: inStart + 200 + 420, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'translateY(-4px)' } },
        ],
      },
      ...tileAnims,
    ],
  };
};

function parseTile(raw: string): { label: string; value: string } {
  const idx = raw.lastIndexOf(':');
  if (idx === -1) return { label: raw.trim(), value: '' };
  return {
    label: raw.slice(0, idx).trim(),
    value: raw.slice(idx + 1).trim(),
  };
}

function pickColumns(n: number): number {
  if (n <= 2) return n; // 1×2 for 2 tiles
  if (n <= 4) return 2;
  if (n <= 6) return 3;
  return 4;
}

export const DATA_GRID_CSS = `
  .slide-data-grid {
    position: absolute; inset: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    opacity: 0;
    color: white;
    padding: 40px 64px;
    gap: 18px;
    box-sizing: border-box;
  }
  .slide-data-grid .title {
    font-size: 40px;
    font-weight: 800;
    letter-spacing: -1px;
    margin: 0;
    text-align: center;
    opacity: 0;
    transform: translateY(14px);
  }
  .slide-data-grid .subtitle {
    font-size: 18px;
    font-weight: 500;
    color: rgba(255,255,255,0.65);
    letter-spacing: 0.5px;
    margin-bottom: 10px;
    opacity: 0;
    transform: translateY(10px);
  }
  .slide-data-grid .grid {
    display: grid;
    gap: 16px;
    width: 100%;
    max-width: 960px;
  }
  .slide-data-grid .tile {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 14px;
    padding: 22px 18px;
    text-align: center;
    opacity: 0;
    transform: translateY(18px) scale(0.92);
    box-shadow: 0 10px 30px rgba(0,0,0,0.35);
  }
  .slide-data-grid .value {
    font-size: 52px;
    font-weight: 900;
    letter-spacing: -1.5px;
    line-height: 1.05;
    color: rgba(255,255,255,0.98);
    font-variant-numeric: tabular-nums;
  }
  .slide-data-grid .label {
    margin-top: 6px;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0.5px;
    color: rgba(255,255,255,0.58);
    text-transform: uppercase;
  }
`;
