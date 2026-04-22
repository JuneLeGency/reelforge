import { escapeText } from './escape';
import type { SlideRenderOutput, SlideSpec, SlideTemplate } from './types';

/**
 * chart-pie — donut chart with a centre value + animated slice sweep.
 * Bullets format: "Label: value" — each bullet is one slice; values
 * are normalized against their sum. Percentages appear on the legend
 * to the right of the donut.
 *
 * Animation: the donut ring draws in a clockwise sweep (via
 * stroke-dashoffset on each arc); slices stagger 180 ms; legend
 * items fade in as their slice lands.
 */
export const chartPie: SlideTemplate = (spec: SlideSpec): SlideRenderOutput => {
  const { index, startMs, endMs } = spec;
  const title = spec.title ?? '';
  const bullets = spec.bullets ?? [];

  const FADE_MS = 400;
  const inStart = startMs;
  const inEnd = startMs + FADE_MS;
  const outStart = endMs - FADE_MS;
  const outEnd = endMs;

  const id = `slide-${index}`;
  const SLICE_COLORS = ['#05d9e8', '#ff2a6d', '#ffd166', '#9aff75', '#c49bff', '#ffa657'];
  const slices = bullets
    .map((raw) => {
      const idx = raw.lastIndexOf(':');
      if (idx === -1) return null;
      const label = raw.slice(0, idx).trim();
      const v = Number.parseFloat(raw.slice(idx + 1).trim());
      if (!Number.isFinite(v) || v <= 0 || label === '') return null;
      return { label, value: v };
    })
    .filter((s): s is { label: string; value: number } => s !== null)
    .map((s, i) => ({ ...s, color: SLICE_COLORS[i % SLICE_COLORS.length]! }));

  const total = slices.reduce((a, s) => a + s.value, 0) || 1;

  const CX = 150;
  const CY = 150;
  const R = 110;
  const CIRC = 2 * Math.PI * R;

  // Compute each slice as a real SVG arc path. Chromium headless
  // renders <circle stroke-dashoffset> updates unreliably under the
  // seek+screenshot pipeline, so we use explicit arc paths and animate
  // opacity + scale instead.
  let cumulativeRad = -Math.PI / 2; // start at 12 o'clock
  const arcs = slices.map((s) => {
    const frac = s.value / total;
    const arcRad = frac * Math.PI * 2;
    const start = cumulativeRad;
    const end = cumulativeRad + arcRad;
    cumulativeRad += arcRad;
    const x1 = CX + R * Math.cos(start);
    const y1 = CY + R * Math.sin(start);
    const x2 = CX + R * Math.cos(end);
    const y2 = CY + R * Math.sin(end);
    const largeArc = arcRad > Math.PI ? 1 : 0;
    // Arc path (stroke only — keeps the donut ring look).
    const path = `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
    return { ...s, path, percent: frac * 100 };
  });

  const slicesSvg = arcs
    .map(
      (a, i) =>
        `<path class="slice" data-i="${i}"
        d="${a.path}"
        fill="none"
        stroke="${a.color}"
        stroke-width="30"
        stroke-linecap="butt" />`,
    )
    .join('');

  const legendHtml = arcs
    .map(
      (a, i) => `
        <div class="legend-item" data-i="${i}">
          <span class="legend-dot" style="background:${a.color}"></span>
          <span class="legend-label">${escapeText(a.label)}</span>
          <span class="legend-value">${a.percent.toFixed(1)}%</span>
        </div>`,
    )
    .join('');

  const html = `
  <section class="slide slide-chart-pie" id="${id}" data-slide-index="${index}">
    ${title !== '' ? `<h1 class="title">${escapeText(title)}</h1>` : ''}
    <div class="donut-row">
      <svg class="donut" viewBox="0 0 300 300">
        <circle class="track" cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="30"/>
        ${slicesSvg}
        <text class="centre-total" x="${CX}" y="${CY}" text-anchor="middle" dominant-baseline="middle">${formatTotal(total)}</text>
      </svg>
      <div class="legend">${legendHtml}</div>
    </div>
  </section>`.trim();

  const sel = (s: string) => `#${id}${s === '' ? '' : ' ' + s}`;

  const STAGGER_MS = 180;
  const SWEEP_MS = 500;
  const sweepStart = inStart + 360;
  const sliceAnims = arcs.flatMap((_a, i) => {
    const delay = sweepStart + i * STAGGER_MS;
    return [
      // Slice fades + scales from centre — sweep/stagger still reads clearly.
      {
        selector: sel(`.slice[data-i="${i}"]`),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'scale(0.82)' } },
          { atMs: Math.max(0, delay - 1), props: { opacity: 0, transform: 'scale(0.82)' } },
          { atMs: delay + SWEEP_MS, props: { opacity: 1, transform: 'scale(1)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'scale(1)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'scale(0.95)' } },
        ],
      },
      {
        selector: sel(`.legend-item[data-i="${i}"]`),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'translateX(-10px)' } },
          { atMs: Math.max(0, delay + 160 - 1), props: { opacity: 0, transform: 'translateX(-10px)' } },
          { atMs: delay + 160 + 360, props: { opacity: 1, transform: 'translateX(0px)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'translateX(0px)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'translateX(0px)' } },
        ],
      },
    ];
  });

  return {
    html,
    css: CHART_PIE_CSS,
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
        selector: sel('.centre-total'),
        easing: 'cubic-bezier(.34,1.56,.64,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'scale(0.6)' } },
          {
            atMs: Math.max(0, inStart + 360 + SWEEP_MS - 1),
            props: { opacity: 0, transform: 'scale(0.6)' },
          },
          {
            atMs: inStart + 360 + SWEEP_MS + 460,
            props: { opacity: 1, transform: 'scale(1)' },
          },
          { atMs: outStart, props: { opacity: 1, transform: 'scale(1)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'scale(0.9)' } },
        ],
      },
      ...sliceAnims,
    ],
  };
};

function formatTotal(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace(/\.?0+$/, '');
}

export const CHART_PIE_CSS = `
  .slide-chart-pie {
    position: absolute; inset: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    opacity: 0;
    color: white;
    padding: 40px 64px;
    gap: 16px;
    box-sizing: border-box;
  }
  .slide-chart-pie .title {
    font-size: 40px;
    font-weight: 800;
    letter-spacing: -1px;
    margin: 0;
    text-align: center;
    opacity: 0;
    transform: translateY(14px);
  }
  .slide-chart-pie .donut-row {
    display: flex; align-items: center; gap: 40px;
  }
  .slide-chart-pie .donut {
    width: 320px; height: 320px;
  }
  .slide-chart-pie .slice {
    transform-origin: 150px 150px;
    transform-box: fill-box;
    transform: scale(0.82);
    opacity: 0;
  }
  .slide-chart-pie .centre-total {
    font-size: 56px;
    font-weight: 800;
    fill: white;
    font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
    opacity: 0;
    transform-box: fill-box;
    transform-origin: center;
  }
  .slide-chart-pie .legend {
    display: flex; flex-direction: column;
    gap: 10px;
    min-width: 220px;
  }
  .slide-chart-pie .legend-item {
    display: flex; align-items: center; gap: 10px;
    font-size: 17px;
    color: rgba(255,255,255,0.9);
    opacity: 0;
    transform: translateX(-10px);
  }
  .slide-chart-pie .legend-dot {
    width: 12px; height: 12px;
    border-radius: 3px;
    display: inline-block;
    flex: 0 0 auto;
  }
  .slide-chart-pie .legend-label {
    flex: 1 1 auto;
    color: rgba(255,255,255,0.92);
  }
  .slide-chart-pie .legend-value {
    font-family: ui-monospace, "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace;
    color: rgba(255,255,255,0.72);
    font-size: 15px;
  }
`;
