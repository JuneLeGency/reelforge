import { escapeText } from './escape';
import type { SlideRenderOutput, SlideSpec, SlideTemplate } from './types';

/**
 * arch-diagram — vertical pipeline / architecture flow. Each bullet
 * becomes a rounded node; arrows connect adjacent nodes. Useful for
 * showing "config → generate → chrome → ffmpeg → mp4" style
 * architecture in a single glance.
 *
 * Slots:
 *   - title   → heading above the diagram
 *   - bullets → one node per bullet, rendered in source order.
 *               Each bullet may embed a secondary caption with "|":
 *               "rf generate | CLI entry" → box label "rf generate",
 *               caption "CLI entry" under the label.
 *
 * Animation:
 *   - title fade-up
 *   - nodes stagger 200 ms each: translateY(30)+fade → 0
 *   - arrows appear 80 ms after the node above lands (scaleY 0→1)
 */
export const archDiagram: SlideTemplate = (spec: SlideSpec): SlideRenderOutput => {
  const { index, startMs, endMs } = spec;
  const title = spec.title ?? '';
  const bullets = spec.bullets ?? [];

  const FADE_MS = 400;
  const inStart = startMs;
  const inEnd = startMs + FADE_MS;
  const outStart = endMs - FADE_MS;
  const outEnd = endMs;

  const id = `slide-${index}`;

  const nodes = bullets.map(parseArchNode);

  const itemsHtml = nodes
    .map((n, i) => {
      const caption = n.caption
        ? `<div class="node-caption">${escapeText(n.caption)}</div>`
        : '';
      const box = `
      <div class="node" data-i="${i}">
        <div class="node-box">
          <div class="node-label">${escapeText(n.label)}</div>
          ${caption}
        </div>
      </div>`;
      if (i === nodes.length - 1) return box;
      return `${box}
      <div class="arrow" data-i="${i}">
        <svg viewBox="0 0 16 40" preserveAspectRatio="none" aria-hidden="true">
          <line x1="8" y1="2" x2="8" y2="32" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <polyline points="3,26 8,36 13,26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>`;
    })
    .join('');

  const html = `
  <section class="slide slide-arch-diagram" id="${id}" data-slide-index="${index}">
    ${title !== '' ? `<h1 class="title">${escapeText(title)}</h1>` : ''}
    <div class="pipeline" data-node-count="${nodes.length}">
      ${itemsHtml}
    </div>
  </section>`.trim();

  const sel = (s: string) => `#${id}${s === '' ? '' : ' ' + s}`;

  const STAGGER_MS = 200;
  const NODE_ENTRANCE_MS = 520;
  const firstNodeStart = inStart + 420;

  const nodeAnims = nodes.flatMap((_, i) => {
    const delay = firstNodeStart + i * STAGGER_MS;
    const anims = [
      {
        selector: sel(`.node[data-i="${i}"]`),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'translateY(30px)' } },
          { atMs: Math.max(0, delay - 1), props: { opacity: 0, transform: 'translateY(30px)' } },
          { atMs: delay + NODE_ENTRANCE_MS, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'translateY(-10px)' } },
        ],
      },
    ];
    if (i < nodes.length - 1) {
      const arrowDelay = delay + NODE_ENTRANCE_MS - 180;
      anims.push({
        selector: sel(`.arrow[data-i="${i}"]`),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'scaleY(0)' } },
          { atMs: Math.max(0, arrowDelay - 1), props: { opacity: 0, transform: 'scaleY(0)' } },
          { atMs: arrowDelay + 320, props: { opacity: 1, transform: 'scaleY(1)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'scaleY(1)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'scaleY(0)' } },
        ],
      });
    }
    return anims;
  });

  return {
    html,
    css: ARCH_DIAGRAM_CSS,
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
      // title
      {
        selector: sel('.title'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'translateY(20px)' } },
          { atMs: Math.max(0, inStart + 120 - 1), props: { opacity: 0, transform: 'translateY(20px)' } },
          { atMs: inStart + 120 + 500, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'translateY(-8px)' } },
        ],
      },
      ...nodeAnims,
    ],
  };
};

interface ArchNode {
  label: string;
  caption: string;
}

function parseArchNode(raw: string): ArchNode {
  const idx = raw.indexOf('|');
  if (idx === -1) return { label: raw.trim(), caption: '' };
  return {
    label: raw.slice(0, idx).trim(),
    caption: raw.slice(idx + 1).trim(),
  };
}

export const ARCH_DIAGRAM_CSS = `
  .slide-arch-diagram {
    position: absolute; inset: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    opacity: 0;
    color: white;
    padding: 40px 64px;
    gap: 20px;
    box-sizing: border-box;
  }
  .slide-arch-diagram .title {
    font-size: 40px;
    font-weight: 800;
    letter-spacing: -1px;
    margin: 0;
    text-align: center;
    opacity: 0;
    transform: translateY(20px);
  }
  .slide-arch-diagram .pipeline {
    display: flex; flex-direction: column; align-items: center;
    width: 100%;
    max-width: 520px;
    gap: 0;
  }
  .slide-arch-diagram .node {
    width: 100%;
    opacity: 0;
    transform: translateY(30px);
    display: flex; justify-content: center;
  }
  .slide-arch-diagram .node-box {
    min-width: 300px;
    max-width: 100%;
    padding: 10px 24px;
    border-radius: 10px;
    background: rgba(255,255,255,0.06);
    border: 1.5px solid rgba(255,255,255,0.22);
    box-shadow: 0 6px 22px rgba(0,0,0,0.35);
    text-align: center;
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
  }
  .slide-arch-diagram .node-label {
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.3px;
    color: rgba(255,255,255,0.98);
    line-height: 1.2;
  }
  .slide-arch-diagram .node-caption {
    margin-top: 2px;
    font-size: 13px;
    font-weight: 500;
    color: rgba(255,255,255,0.62);
    letter-spacing: 0.5px;
    line-height: 1.2;
  }
  .slide-arch-diagram .arrow {
    width: 20px;
    height: 28px;
    display: flex; align-items: center; justify-content: center;
    color: rgba(255,255,255,0.5);
    opacity: 0;
    transform: scaleY(0);
    transform-origin: top center;
  }
  .slide-arch-diagram .arrow svg {
    width: 14px; height: 28px;
    overflow: visible;
  }
`;
