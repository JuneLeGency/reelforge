import { escapeText } from './escape';
import type { SlideRenderOutput, SlideSpec, SlideTemplate } from './types';

/**
 * chart-line — SVG line chart with 1-3 series. Bullets format:
 *   - First bullet optionally starts with "x: " to set x-axis labels,
 *     comma-separated:  "x: Jan,Feb,Mar,Apr,May,Jun"
 *   - Each other bullet is a series:  "Revenue: 10, 24, 19, 42, 55, 70"
 *     (series name : comma-separated numeric values)
 *
 * Animation: axes fade in, then each series' path `stroke-dashoffset`
 * draws from full length down to 0 with 350 ms stagger, then dots
 * pop in along the line.
 */
export const chartLine: SlideTemplate = (spec: SlideSpec): SlideRenderOutput => {
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

  // Parse bullets into xLabels + series.
  let xLabels: string[] | null = null;
  const series: { name: string; values: number[]; color: string }[] = [];
  const SERIES_COLORS = ['#05d9e8', '#ff2a6d', '#ffd166', '#9aff75'];
  for (const raw of bullets) {
    const lower = raw.toLowerCase().replace(/\s/g, '');
    if (lower.startsWith('x:')) {
      xLabels = raw
        .slice(raw.indexOf(':') + 1)
        .split(',')
        .map((s) => s.trim());
      continue;
    }
    const idx = raw.indexOf(':');
    if (idx === -1) continue;
    const name = raw.slice(0, idx).trim();
    const values = raw
      .slice(idx + 1)
      .split(',')
      .map((s) => Number.parseFloat(s.trim()))
      .filter((v) => Number.isFinite(v));
    if (values.length === 0) continue;
    series.push({
      name,
      values,
      color: SERIES_COLORS[series.length % SERIES_COLORS.length]!,
    });
  }

  const maxPoints = series.reduce((m, s) => Math.max(m, s.values.length), 0);
  if (!xLabels) {
    xLabels = Array.from({ length: maxPoints }, (_v, i) => String(i + 1));
  }

  // SVG viewBox is 600×280; plot area inset for labels.
  const VB_W = 600;
  const VB_H = 280;
  const INSET_L = 32;
  const INSET_R = 12;
  const INSET_T = 10;
  const INSET_B = 30;
  const plotW = VB_W - INSET_L - INSET_R;
  const plotH = VB_H - INSET_T - INSET_B;

  const allValues = series.flatMap((s) => s.values);
  const maxVal = allValues.length ? Math.max(...allValues, 1) : 1;

  const pointX = (i: number, total: number) =>
    total <= 1 ? INSET_L + plotW / 2 : INSET_L + (plotW * i) / (total - 1);
  const pointY = (v: number) => INSET_T + plotH - (v / maxVal) * plotH;

  const seriesHtml = series
    .map((s, si) => {
      const total = s.values.length;
      const pts = s.values.map((v, i) => `${pointX(i, total).toFixed(1)},${pointY(v).toFixed(1)}`);
      const polyline = pts.join(' ');
      const dots = s.values
        .map(
          (v, i) =>
            `<circle class="dot" data-s="${si}" data-i="${i}" cx="${pointX(i, total).toFixed(1)}" cy="${pointY(v).toFixed(1)}" r="4" fill="${s.color}" />`,
        )
        .join('');
      return `
      <g class="series" data-s="${si}" style="color: ${s.color};">
        <polyline class="series-path" data-s="${si}" points="${polyline}"
                  fill="none" stroke="${s.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        ${dots}
      </g>`;
    })
    .join('');

  const legendHtml = series
    .map(
      (s) =>
        `<div class="legend-item"><span class="legend-dot" style="background:${s.color}"></span>${escapeText(s.name)}</div>`,
    )
    .join('');

  const xLabelsHtml = xLabels
    .map((l, i) => {
      const x = pointX(i, xLabels!.length);
      return `<text class="x-label" x="${x.toFixed(1)}" y="${VB_H - 6}" text-anchor="middle">${escapeText(l)}</text>`;
    })
    .join('');

  const gridHtml = [0, 0.25, 0.5, 0.75, 1]
    .map((r) => {
      const y = INSET_T + plotH * (1 - r);
      const v = (r * maxVal).toFixed(0);
      return `<line class="grid-line" x1="${INSET_L}" y1="${y}" x2="${INSET_L + plotW}" y2="${y}" />
              <text class="y-label" x="${INSET_L - 6}" y="${y + 4}" text-anchor="end">${v}</text>`;
    })
    .join('');

  const html = `
  <section class="slide slide-chart-line" id="${id}" data-slide-index="${index}">
    ${title !== '' ? `<h1 class="title">${escapeText(title)}</h1>` : ''}
    ${subtitle !== '' ? `<div class="subtitle">${escapeText(subtitle)}</div>` : ''}
    <svg class="chart" viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="xMidYMid meet">
      <g class="grid">${gridHtml}</g>
      ${seriesHtml}
      <g class="x-labels">${xLabelsHtml}</g>
    </svg>
    ${series.length > 0 ? `<div class="legend">${legendHtml}</div>` : ''}
  </section>`.trim();

  const sel = (s: string) => `#${id}${s === '' ? '' : ' ' + s}`;

  // stroke-dashoffset trick requires an approximate path length; polyline
  // length is sum of segment distances. We set stroke-dasharray = length
  // and animate stroke-dashoffset from length → 0.
  const seriesAnims = series.flatMap((s, si) => {
    const total = s.values.length;
    let length = 0;
    for (let i = 1; i < total; i++) {
      const dx = pointX(i, total) - pointX(i - 1, total);
      const dy = pointY(s.values[i]!) - pointY(s.values[i - 1]!);
      length += Math.sqrt(dx * dx + dy * dy);
    }
    const drawDelay = inStart + 420 + si * 350;
    const drawEnd = drawDelay + 900;
    const pathAnim = {
      selector: sel(`.series-path[data-s="${si}"]`),
      easing: 'cubic-bezier(.45,0,.15,1)',
      keyframes: [
        { atMs: 0, props: { strokeDasharray: length.toFixed(1), strokeDashoffset: length.toFixed(1) } },
        {
          atMs: Math.max(0, drawDelay - 1),
          props: { strokeDasharray: length.toFixed(1), strokeDashoffset: length.toFixed(1) },
        },
        {
          atMs: drawEnd,
          props: { strokeDasharray: length.toFixed(1), strokeDashoffset: '0' },
        },
        { atMs: outStart, props: { strokeDasharray: length.toFixed(1), strokeDashoffset: '0' } },
        { atMs: outEnd, props: { strokeDasharray: length.toFixed(1), strokeDashoffset: '0' } },
      ],
    };
    const dotAnims = s.values.map((_v, i) => {
      const dotDelay = drawEnd - 200 + i * 80;
      return {
        selector: sel(`.dot[data-s="${si}"][data-i="${i}"]`),
        easing: 'cubic-bezier(.34,1.56,.64,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'scale(0)' } },
          { atMs: Math.max(0, dotDelay - 1), props: { opacity: 0, transform: 'scale(0)' } },
          { atMs: dotDelay + 280, props: { opacity: 1, transform: 'scale(1)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'scale(1)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'scale(0.6)' } },
        ],
      };
    });
    return [pathAnim, ...dotAnims];
  });

  return {
    html,
    css: CHART_LINE_CSS,
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
      ...seriesAnims,
    ],
  };
};

export const CHART_LINE_CSS = `
  .slide-chart-line {
    position: absolute; inset: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    opacity: 0;
    color: white;
    padding: 40px 64px;
    gap: 12px;
    box-sizing: border-box;
  }
  .slide-chart-line .title {
    font-size: 40px;
    font-weight: 800;
    letter-spacing: -1px;
    margin: 0;
    text-align: center;
    opacity: 0;
    transform: translateY(14px);
  }
  .slide-chart-line .subtitle {
    font-size: 18px;
    color: rgba(255,255,255,0.65);
    letter-spacing: 0.5px;
  }
  .slide-chart-line .chart {
    width: 100%;
    max-width: 900px;
    height: auto;
  }
  .slide-chart-line .grid-line {
    stroke: rgba(255,255,255,0.1);
    stroke-width: 1;
  }
  .slide-chart-line .y-label,
  .slide-chart-line .x-label {
    fill: rgba(255,255,255,0.52);
    font-size: 12px;
    font-family: ui-monospace, "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace;
  }
  .slide-chart-line .dot {
    opacity: 0;
    transform-box: fill-box;
    transform-origin: center;
    transform: scale(0);
  }
  .slide-chart-line .legend {
    display: flex; gap: 20px; flex-wrap: wrap; justify-content: center;
    margin-top: 8px;
  }
  .slide-chart-line .legend-item {
    display: flex; align-items: center; gap: 8px;
    font-size: 15px;
    color: rgba(255,255,255,0.82);
    letter-spacing: 0.3px;
  }
  .slide-chart-line .legend-dot {
    width: 10px; height: 10px;
    border-radius: 50%;
    display: inline-block;
  }
`;
