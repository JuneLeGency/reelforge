import { escapeAttr, escapeText } from './escape';
import type { SlideRenderOutput, SlideSpec, SlideTemplate } from './types';

/**
 * image-grid — mosaic of N images arranged in a responsive grid. Each
 * tile pops in with a scale + fade stagger; picks columns based on
 * count (2, 3, or 4 wide). Great for a photo contact-sheet, portfolio
 * moment, or "here's everything at a glance" beat.
 *
 * Image paths are passed through bullets — one bullet per image.
 * (generate.ts special-cases the image-grid template: bullets that
 * look like relative paths are staged as assets the same way
 * spec.image is.) Non-path bullets fall back to rendering as a
 * coloured placeholder tile with the bullet text.
 *
 * Slots:
 *   - title              → banner heading above the grid
 *   - subtitle           → smaller lead line
 *   - bullets            → image paths (relative to config) OR text
 *                          placeholders
 *   - extras.columns     → force column count 2..5 (default: auto by count)
 */
export const imageGrid: SlideTemplate = (spec: SlideSpec): SlideRenderOutput => {
  const { index, startMs, endMs } = spec;
  const title = spec.title ?? '';
  const subtitle = spec.subtitle ?? '';
  const items = spec.bullets ?? [];
  const cols = resolveColumns(items.length, spec.extras?.columns);

  const FADE_MS = 400;
  const inStart = startMs;
  const inEnd = startMs + FADE_MS;
  const outStart = endMs - FADE_MS;
  const outEnd = endMs;

  const id = `slide-${index}`;
  const tilesHtml = items
    .map((raw, i) => {
      const looksLikePath = /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(raw);
      const inner = looksLikePath
        ? `<img src="${escapeAttr(raw)}" alt="" />`
        : `<div class="placeholder">${escapeText(raw)}</div>`;
      return `<div class="tile" data-i="${i}">${inner}</div>`;
    })
    .join('');

  const html = `
  <section class="slide slide-image-grid" id="${id}" data-slide-index="${index}">
    ${title !== '' ? `<h1 class="title">${escapeText(title)}</h1>` : ''}
    ${subtitle !== '' ? `<div class="subtitle">${escapeText(subtitle)}</div>` : ''}
    <div class="grid" data-cols="${cols}" style="grid-template-columns: repeat(${cols}, 1fr);">
      ${tilesHtml}
    </div>
  </section>`.trim();

  const sel = (s: string) => `#${id}${s === '' ? '' : ' ' + s}`;

  const STAGGER_MS = 90;
  const tileStart = inStart + 380;
  const tileAnims = items.map((_v, i) => {
    const delay = tileStart + i * STAGGER_MS;
    return {
      selector: sel(`.tile[data-i="${i}"]`),
      easing: 'cubic-bezier(.34,1.56,.64,1)',
      keyframes: [
        { atMs: 0, props: { opacity: 0, transform: 'scale(0.85)' } },
        { atMs: Math.max(0, delay - 1), props: { opacity: 0, transform: 'scale(0.85)' } },
        { atMs: delay + 480, props: { opacity: 1, transform: 'scale(1)' } },
        { atMs: outStart, props: { opacity: 1, transform: 'scale(1)' } },
        { atMs: outEnd, props: { opacity: 0, transform: 'scale(0.96)' } },
      ],
    };
  });

  return {
    html,
    css: IMAGE_GRID_CSS,
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
          { atMs: inStart + 80 + 420, props: { opacity: 1, transform: 'translateY(0px)' } },
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
          { atMs: inStart + 200 + 400, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'translateY(-4px)' } },
        ],
      },
      ...tileAnims,
    ],
  };
};

function resolveColumns(count: number, override: string | number | undefined): number {
  if (override !== undefined) {
    const n = typeof override === 'number' ? override : Number.parseInt(String(override), 10);
    if (Number.isFinite(n) && n >= 2 && n <= 5) return Math.round(n);
  }
  if (count <= 4) return 2;
  if (count <= 6) return 3;
  if (count <= 9) return 3;
  return 4;
}

export const IMAGE_GRID_CSS = `
  .slide-image-grid {
    position: absolute; inset: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    opacity: 0;
    color: white;
    padding: 40px 64px;
    gap: 12px;
    box-sizing: border-box;
  }
  .slide-image-grid .title {
    font-size: 40px;
    font-weight: 800;
    letter-spacing: -1px;
    margin: 0;
    text-align: center;
    opacity: 0;
    transform: translateY(14px);
  }
  .slide-image-grid .subtitle {
    font-size: 18px;
    color: rgba(255,255,255,0.65);
    letter-spacing: 0.4px;
    margin-bottom: 10px;
    opacity: 0;
    transform: translateY(10px);
  }
  .slide-image-grid .grid {
    display: grid;
    gap: 14px;
    width: 100%;
    max-width: 960px;
  }
  .slide-image-grid .tile {
    aspect-ratio: 16 / 10;
    border-radius: 12px;
    overflow: hidden;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    box-shadow: 0 12px 30px rgba(0,0,0,0.4);
    opacity: 0;
    transform: scale(0.85);
  }
  .slide-image-grid .tile img {
    width: 100%; height: 100%;
    object-fit: cover;
    display: block;
  }
  .slide-image-grid .placeholder {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    font-size: 20px;
    font-weight: 700;
    color: rgba(255,255,255,0.65);
    background: linear-gradient(135deg, rgba(5,217,232,0.25), rgba(255,42,109,0.22));
    padding: 14px;
    text-align: center;
    letter-spacing: 0.3px;
  }
`;
