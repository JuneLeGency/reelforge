import { escapeText } from './escape';
import type { SlideRenderOutput, SlideSpec, SlideTemplate } from './types';

/**
 * timeline-roadmap — horizontal timeline with N evenly-spaced nodes.
 * Each bullet parses as "Label | period" or "Label: period" (period
 * can be "Q1 2024", "2024-06", "Launch", anything). Nodes alternate
 * label-above / label-below for visual rhythm.
 *
 * Animation:
 *   - title fade-up
 *   - rail scaleX 0 → 1 from the left
 *   - each node's dot scale-pops in stagger (180 ms apart)
 *   - label + period fade in after the dot
 */
export const timelineRoadmap: SlideTemplate = (spec: SlideSpec): SlideRenderOutput => {
  const { index, startMs, endMs } = spec;
  const title = spec.title ?? '';
  const bullets = spec.bullets ?? [];

  const FADE_MS = 400;
  const inStart = startMs;
  const inEnd = startMs + FADE_MS;
  const outStart = endMs - FADE_MS;
  const outEnd = endMs;

  const id = `slide-${index}`;
  const nodes = bullets.map(parseTimelineNode);

  const nodesHtml = nodes
    .map((n, i) => {
      const above = i % 2 === 0;
      return `
      <div class="node" data-i="${i}">
        ${above ? labelHtml(n.label, 'above') : ''}
        ${above ? periodHtml(n.period, 'below') : ''}
        <div class="node-dot"></div>
        ${!above ? labelHtml(n.label, 'below') : ''}
        ${!above ? periodHtml(n.period, 'above') : ''}
      </div>`;
    })
    .join('');

  const html = `
  <section class="slide slide-timeline-roadmap" id="${id}" data-slide-index="${index}">
    ${title !== '' ? `<h1 class="title">${escapeText(title)}</h1>` : ''}
    <div class="timeline" data-node-count="${nodes.length}">
      <div class="rail"></div>
      ${nodesHtml}
    </div>
  </section>`.trim();

  const sel = (s: string) => `#${id}${s === '' ? '' : ' ' + s}`;

  const STAGGER_MS = 180;
  const RAIL_ENTRANCE_MS = 650;
  const nodeStart = inStart + 420 + RAIL_ENTRANCE_MS - 200;

  const nodeAnims = nodes.flatMap((_, i) => {
    const delay = nodeStart + i * STAGGER_MS;
    return [
      {
        selector: sel(`.node[data-i="${i}"] .node-dot`),
        easing: 'cubic-bezier(.34,1.56,.64,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'translateY(-50%) scale(0)' } },
          { atMs: Math.max(0, delay - 1), props: { opacity: 0, transform: 'translateY(-50%) scale(0)' } },
          { atMs: delay + 500, props: { opacity: 1, transform: 'translateY(-50%) scale(1)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'translateY(-50%) scale(1)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'translateY(-50%) scale(0.6)' } },
        ],
      },
      {
        selector: sel(`.node[data-i="${i}"] .node-label`),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'translateX(-50%) translateY(8px)' } },
          {
            atMs: Math.max(0, delay + 200 - 1),
            props: { opacity: 0, transform: 'translateX(-50%) translateY(8px)' },
          },
          { atMs: delay + 200 + 420, props: { opacity: 1, transform: 'translateX(-50%) translateY(0px)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'translateX(-50%) translateY(0px)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'translateX(-50%) translateY(-4px)' } },
        ],
      },
      {
        selector: sel(`.node[data-i="${i}"] .node-period`),
        easing: 'linear',
        keyframes: [
          { atMs: 0, props: { opacity: 0 } },
          { atMs: Math.max(0, delay + 300 - 1), props: { opacity: 0 } },
          { atMs: delay + 300 + 380, props: { opacity: 1 } },
          { atMs: outStart, props: { opacity: 1 } },
          { atMs: outEnd, props: { opacity: 0 } },
        ],
      },
    ];
  });

  return {
    html,
    css: TIMELINE_ROADMAP_CSS,
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
          { atMs: 0, props: { opacity: 0, transform: 'translateY(22px)' } },
          { atMs: Math.max(0, inStart + 120 - 1), props: { opacity: 0, transform: 'translateY(22px)' } },
          { atMs: inStart + 120 + 600, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'translateY(-10px)' } },
        ],
      },
      {
        selector: sel('.rail'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { transform: 'scaleX(0)' } },
          { atMs: Math.max(0, inStart + 420 - 1), props: { transform: 'scaleX(0)' } },
          { atMs: inStart + 420 + RAIL_ENTRANCE_MS, props: { transform: 'scaleX(1)' } },
          { atMs: outStart, props: { transform: 'scaleX(1)' } },
          { atMs: outEnd, props: { transform: 'scaleX(0)' } },
        ],
      },
      ...nodeAnims,
    ],
  };
};

interface TimelineNode {
  label: string;
  period: string;
}

function parseTimelineNode(s: string): TimelineNode {
  // Prefer ' | ' (allows ':' inside labels like "v1.0: beta release | 2024");
  // fall back to last ':' otherwise.
  const pipeIdx = s.lastIndexOf('|');
  if (pipeIdx !== -1) {
    return {
      label: s.slice(0, pipeIdx).trim(),
      period: s.slice(pipeIdx + 1).trim(),
    };
  }
  const colonIdx = s.lastIndexOf(':');
  if (colonIdx !== -1) {
    return {
      label: s.slice(0, colonIdx).trim(),
      period: s.slice(colonIdx + 1).trim(),
    };
  }
  return { label: s.trim(), period: '' };
}

function labelHtml(label: string, pos: 'above' | 'below'): string {
  if (label === '') return '';
  return `<div class="node-label ${pos}">${escapeText(label)}</div>`;
}

function periodHtml(period: string, pos: 'above' | 'below'): string {
  if (period === '') return '';
  return `<div class="node-period ${pos}">${escapeText(period)}</div>`;
}

export const TIMELINE_ROADMAP_CSS = `
  .slide-timeline-roadmap {
    position: absolute; inset: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    opacity: 0;
    color: white;
    padding: 0 96px;
  }
  .slide-timeline-roadmap .title {
    font-size: 64px;
    font-weight: 800;
    letter-spacing: -1.5px;
    margin: 0 0 80px 0;
    opacity: 0;
    transform: translateY(22px);
    text-align: center;
  }
  .slide-timeline-roadmap .timeline {
    position: relative;
    width: 100%;
    max-width: 1200px;
    height: 200px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .slide-timeline-roadmap .rail {
    position: absolute;
    left: 0; right: 0;
    top: 50%;
    height: 3px;
    background: linear-gradient(90deg, rgba(255,255,255,0.15), rgba(255,255,255,0.85) 20%, rgba(255,255,255,0.85) 80%, rgba(255,255,255,0.15));
    transform: scaleX(0);
    transform-origin: left center;
    border-radius: 2px;
  }
  .slide-timeline-roadmap .node {
    position: relative;
    flex: 1 1 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    height: 100%;
  }
  .slide-timeline-roadmap .node-dot {
    width: 22px; height: 22px;
    border-radius: 50%;
    background: white;
    box-shadow: 0 0 0 6px rgba(255,255,255,0.2), 0 4px 16px rgba(0,0,0,0.4);
    position: absolute;
    top: 50%;
    transform: translateY(-50%) scale(0);
    opacity: 0;
    z-index: 2;
  }
  .slide-timeline-roadmap .node-label {
    position: absolute;
    left: 50%; transform: translateX(-50%) translateY(8px);
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.3px;
    white-space: nowrap;
    opacity: 0;
    color: rgba(255,255,255,0.96);
  }
  .slide-timeline-roadmap .node-label.above { top: 12px; }
  .slide-timeline-roadmap .node-label.below { bottom: 12px; }
  .slide-timeline-roadmap .node-period {
    position: absolute;
    left: 50%; transform: translateX(-50%);
    font-size: 16px;
    font-weight: 600;
    letter-spacing: 0.5px;
    color: rgba(255,255,255,0.65);
    text-transform: uppercase;
    white-space: nowrap;
    opacity: 0;
  }
  .slide-timeline-roadmap .node-period.above { top: 48px; }
  .slide-timeline-roadmap .node-period.below { bottom: 48px; }
`;
