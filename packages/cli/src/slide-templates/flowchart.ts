import { escapeText } from './escape';
import type { SlideRenderOutput, SlideSpec, SlideTemplate } from './types';

/**
 * flowchart — a decision tree with up to 1 root + N branches. Bullets
 * encode a hierarchy:
 *
 *   bullets[0]: "Root question?"           → root node
 *   bullets[1..]: "branch-label | leaf"    → branches out of root
 *
 * Alternative: bullets of the form "A -> B -> C" (arrow chain) are
 * laid out as a single vertical chain. If mixed, arrow chains take
 * precedence when the bullet contains "->".
 *
 * Animation:
 *   - root pops first
 *   - each connector SVG line stroke-dashoffset draws toward its leaf
 *     with 260 ms stagger
 *   - each leaf pops after its connector finishes (translateY + fade)
 *
 * This is intentionally lightweight (no graph-layout library). Layouts
 * beyond "1 root → fanned leaves" or "linear chain" should use
 * arch-diagram or a hand-written slide instead.
 */
export const flowchart: SlideTemplate = (spec: SlideSpec): SlideRenderOutput => {
  const { index, startMs, endMs } = spec;
  const title = spec.title ?? '';
  const bullets = spec.bullets ?? [];

  const FADE_MS = 400;
  const inStart = startMs;
  const inEnd = startMs + FADE_MS;
  const outStart = endMs - FADE_MS;
  const outEnd = endMs;

  const id = `slide-${index}`;

  // Mode detection: if any bullet has "->", treat whole thing as chain.
  const isChain = bullets.some((b) => b.includes('->'));
  let rootLabel = '';
  const branches: { edge: string; leaf: string }[] = [];
  if (isChain) {
    // Split the first bullet with "->" into steps, ignore others.
    const steps = (bullets.find((b) => b.includes('->')) ?? '')
      .split('->')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    rootLabel = steps[0] ?? '';
    for (let i = 1; i < steps.length; i++) {
      branches.push({ edge: '', leaf: steps[i]! });
    }
  } else {
    rootLabel = bullets[0] ?? '';
    for (let i = 1; i < bullets.length; i++) {
      const raw = bullets[i]!;
      const idx = raw.indexOf('|');
      if (idx === -1) {
        branches.push({ edge: '', leaf: raw.trim() });
      } else {
        branches.push({
          edge: raw.slice(0, idx).trim(),
          leaf: raw.slice(idx + 1).trim(),
        });
      }
    }
  }

  // Layout: root at centre-top; leaves evenly along the bottom row
  // (fan-out) when isChain is false, or straight-vertical when true.
  const VB_W = 800;
  const VB_H = 340;
  const ROOT_Y = 56;
  const LEAF_Y = 280;
  const rootX = VB_W / 2;
  const leafCount = Math.max(1, branches.length);
  const leafXs: number[] = isChain
    ? branches.map(() => rootX) // same column, chain
    : branches.map((_b, i) => {
        if (leafCount === 1) return rootX;
        const gutter = 80;
        const stride = (VB_W - gutter * 2) / (leafCount - 1);
        return gutter + stride * i;
      });
  const leafYs: number[] = isChain
    ? branches.map((_b, i) => ROOT_Y + ((LEAF_Y - ROOT_Y) * (i + 1)) / leafCount)
    : branches.map(() => LEAF_Y);

  // Each edge is a straight segment from root → leaf; we also write the
  // edge label at its midpoint (when present).
  const edgeLengths: number[] = [];
  const edgesSvg = branches
    .map((b, i) => {
      const x2 = leafXs[i]!;
      const y2 = leafYs[i]!;
      const dx = x2 - rootX;
      const dy = y2 - ROOT_Y;
      const length = Math.sqrt(dx * dx + dy * dy);
      edgeLengths.push(length);
      const midX = (rootX + x2) / 2;
      const midY = (ROOT_Y + y2) / 2;
      return `
      <line class="edge" data-i="${i}"
        x1="${rootX}" y1="${ROOT_Y + 24}"
        x2="${x2}" y2="${y2 - 24}"
        stroke="rgba(255,255,255,0.55)" stroke-width="2.2"
        stroke-linecap="round"
        stroke-dasharray="${length.toFixed(2)}"
        stroke-dashoffset="${length.toFixed(2)}" />
      ${
        b.edge !== ''
          ? `<text class="edge-label" data-i="${i}" x="${midX}" y="${midY}" text-anchor="middle">${escapeText(b.edge)}</text>`
          : ''
      }`;
    })
    .join('');

  const leavesHtml = branches
    .map((b, i) => {
      const x = leafXs[i]!;
      const y = leafYs[i]!;
      return `
      <g class="leaf" data-i="${i}" transform="translate(${x} ${y})">
        <rect class="leaf-bg" x="-90" y="-22" width="180" height="44" rx="10" />
        <text class="leaf-label" x="0" y="6" text-anchor="middle">${escapeText(b.leaf)}</text>
      </g>`;
    })
    .join('');

  const html = `
  <section class="slide slide-flowchart" id="${id}" data-slide-index="${index}">
    ${title !== '' ? `<h1 class="title">${escapeText(title)}</h1>` : ''}
    <svg class="graph" viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="xMidYMid meet">
      ${edgesSvg}
      ${leavesHtml}
      <g class="root" transform="translate(${rootX} ${ROOT_Y})">
        <rect class="root-bg" x="-110" y="-26" width="220" height="52" rx="12" />
        <text class="root-label" x="0" y="6" text-anchor="middle">${escapeText(rootLabel)}</text>
      </g>
    </svg>
  </section>`.trim();

  const sel = (s: string) => `#${id}${s === '' ? '' : ' ' + s}`;

  const STAGGER_MS = 260;
  const DRAW_MS = 480;
  const edgeStart = inStart + 560;
  const edgeAnims = branches.flatMap((_b, i) => {
    const len = edgeLengths[i]!.toFixed(2);
    const start = edgeStart + i * STAGGER_MS;
    return [
      {
        selector: sel(`.edge[data-i="${i}"]`),
        easing: 'cubic-bezier(.45,0,.15,1)',
        keyframes: [
          { atMs: 0, props: { strokeDashoffset: len } },
          { atMs: Math.max(0, start - 1), props: { strokeDashoffset: len } },
          { atMs: start + DRAW_MS, props: { strokeDashoffset: '0' } },
          { atMs: outStart, props: { strokeDashoffset: '0' } },
          { atMs: outEnd, props: { strokeDashoffset: len } },
        ],
      },
      {
        selector: sel(`.edge-label[data-i="${i}"]`),
        easing: 'linear',
        keyframes: [
          { atMs: 0, props: { opacity: 0 } },
          { atMs: Math.max(0, start + DRAW_MS - 100 - 1), props: { opacity: 0 } },
          { atMs: start + DRAW_MS + 120, props: { opacity: 1 } },
          { atMs: outStart, props: { opacity: 1 } },
          { atMs: outEnd, props: { opacity: 0 } },
        ],
      },
      {
        selector: sel(`.leaf[data-i="${i}"]`),
        easing: 'cubic-bezier(.34,1.56,.64,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0 } },
          { atMs: Math.max(0, start + DRAW_MS - 60 - 1), props: { opacity: 0 } },
          { atMs: start + DRAW_MS + 280, props: { opacity: 1 } },
          { atMs: outStart, props: { opacity: 1 } },
          { atMs: outEnd, props: { opacity: 0 } },
        ],
      },
    ];
  });

  return {
    html,
    css: FLOWCHART_CSS,
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
      // Root pops first
      {
        selector: sel('.root'),
        easing: 'cubic-bezier(.34,1.56,.64,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0 } },
          { atMs: Math.max(0, inStart + 220 - 1), props: { opacity: 0 } },
          { atMs: inStart + 220 + 460, props: { opacity: 1 } },
          { atMs: outStart, props: { opacity: 1 } },
          { atMs: outEnd, props: { opacity: 0 } },
        ],
      },
      ...edgeAnims,
    ],
  };
};

export const FLOWCHART_CSS = `
  .slide-flowchart {
    position: absolute; inset: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    opacity: 0;
    color: white;
    padding: 40px 64px;
    gap: 14px;
    box-sizing: border-box;
  }
  .slide-flowchart .title {
    font-size: 40px;
    font-weight: 800;
    letter-spacing: -1px;
    margin: 0;
    text-align: center;
    opacity: 0;
    transform: translateY(14px);
  }
  .slide-flowchart .graph {
    width: 100%;
    max-width: 920px;
    height: auto;
  }
  .slide-flowchart .root-bg,
  .slide-flowchart .leaf-bg {
    fill: rgba(255,255,255,0.06);
    stroke: rgba(255,255,255,0.28);
    stroke-width: 1.5;
  }
  .slide-flowchart .root-bg {
    fill: rgba(255,42,109,0.18);
    stroke: rgba(255,42,109,0.55);
  }
  .slide-flowchart .root-label {
    fill: rgba(255,255,255,0.98);
    font-size: 18px;
    font-weight: 800;
    letter-spacing: -0.3px;
    font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
  }
  .slide-flowchart .leaf-label {
    fill: rgba(255,255,255,0.92);
    font-size: 15px;
    font-weight: 700;
    font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
  }
  .slide-flowchart .edge-label {
    fill: rgba(255,255,255,0.58);
    font-size: 12px;
    font-weight: 600;
    font-family: ui-monospace, "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace;
    opacity: 0;
    paint-order: stroke;
    stroke: #0a0a18;
    stroke-width: 4;
  }
  .slide-flowchart .root,
  .slide-flowchart .leaf {
    opacity: 0;
  }
`;
