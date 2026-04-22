import { escapeAttr, escapeText } from './escape';
import type { SlideRenderOutput, SlideSpec, SlideTemplate } from './types';

/**
 * data-chart-reveal — title + animated bar chart. Each bullet is
 * parsed as "Label: value" (value can be decimal, optionally followed
 * by units which are kept in the label for display).
 *
 * Choreography:
 *   - title fade-up first
 *   - each bar scaleY 0 → 1 from bottom, 180 ms stagger
 *   - value and label fade-in after the bar lands
 *
 * Values are normalized against the max so the tallest bar fills the
 * chart area. If no bullets parse as numbers, the template renders
 * the title only.
 */
export const dataChartReveal: SlideTemplate = (spec: SlideSpec): SlideRenderOutput => {
  const { index, startMs, endMs } = spec;
  const title = spec.title ?? '';
  const bullets = spec.bullets ?? [];

  const FADE_MS = 400;
  const inStart = startMs;
  const inEnd = startMs + FADE_MS;
  const outStart = endMs - FADE_MS;
  const outEnd = endMs;

  const id = `slide-${index}`;

  const bars = bullets.map(parseBar).filter((x): x is ParsedBar => x !== null);
  const maxValue = bars.reduce((m, b) => Math.max(m, b.value), 0) || 1;

  const barsHtml = bars
    .map((b, i) => {
      const ratio = Math.max(0, b.value) / maxValue;
      const heightPct = (ratio * 100).toFixed(2);
      return `
      <div class="bar-col" data-i="${i}">
        <div class="bar-value">${escapeText(formatValue(b.value))}</div>
        <div class="bar-track">
          <div class="bar" style="height: ${heightPct}%"></div>
        </div>
        <div class="bar-label" title="${escapeAttr(b.label)}">${escapeText(b.label)}</div>
      </div>`;
    })
    .join('');

  const html = `
  <section class="slide slide-data-chart-reveal" id="${id}" data-slide-index="${index}">
    ${title !== '' ? `<h1 class="title">${escapeText(title)}</h1>` : ''}
    <div class="chart-area" data-bar-count="${bars.length}">
      ${barsHtml}
    </div>
  </section>`.trim();

  const sel = (s: string) => `#${id}${s === '' ? '' : ' ' + s}`;

  const STAGGER_MS = 180;
  const BAR_ENTRANCE_MS = 700;
  const chartStart = inStart + 320;

  const barAnims = bars.flatMap((_, i) => {
    const barDelay = chartStart + i * STAGGER_MS;
    const valueDelay = barDelay + BAR_ENTRANCE_MS - 120;
    const labelDelay = barDelay + 80;
    return [
      // bar scaleY 0 → 1
      {
        selector: sel(`.bar-col[data-i="${i}"] .bar`),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { transform: 'scaleY(0)' } },
          { atMs: Math.max(0, barDelay - 1), props: { transform: 'scaleY(0)' } },
          { atMs: barDelay + BAR_ENTRANCE_MS, props: { transform: 'scaleY(1)' } },
          { atMs: outStart, props: { transform: 'scaleY(1)' } },
          { atMs: outEnd, props: { transform: 'scaleY(0)' } },
        ],
      },
      // label fades with the bar
      {
        selector: sel(`.bar-col[data-i="${i}"] .bar-label`),
        easing: 'linear',
        keyframes: [
          { atMs: 0, props: { opacity: 0 } },
          { atMs: Math.max(0, labelDelay - 1), props: { opacity: 0 } },
          { atMs: labelDelay + 400, props: { opacity: 1 } },
          { atMs: outStart, props: { opacity: 1 } },
          { atMs: outEnd, props: { opacity: 0 } },
        ],
      },
      // value pops in after the bar lands
      {
        selector: sel(`.bar-col[data-i="${i}"] .bar-value`),
        easing: 'cubic-bezier(.34,1.56,.64,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'translateY(8px) scale(0.8)' } },
          {
            atMs: Math.max(0, valueDelay - 1),
            props: { opacity: 0, transform: 'translateY(8px) scale(0.8)' },
          },
          {
            atMs: valueDelay + 420,
            props: { opacity: 1, transform: 'translateY(0px) scale(1)' },
          },
          { atMs: outStart, props: { opacity: 1, transform: 'translateY(0px) scale(1)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'translateY(-4px) scale(0.9)' } },
        ],
      },
    ];
  });

  return {
    html,
    css: DATA_CHART_REVEAL_CSS,
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
      // title fade-up
      {
        selector: sel('.title'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'translateY(24px)' } },
          { atMs: Math.max(0, inStart + 120 - 1), props: { opacity: 0, transform: 'translateY(24px)' } },
          { atMs: inStart + 120 + 600, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'translateY(-12px)' } },
        ],
      },
      ...barAnims,
    ],
  };
};

interface ParsedBar {
  label: string;
  value: number;
}

/**
 * Accepts "Label: 42", "Label: 42%", "Label: 12.5M", etc. Uses the
 * last ':' as the delimiter so labels with colons still work. Value
 * is the first numeric substring after the delimiter.
 */
function parseBar(s: string): ParsedBar | null {
  const idx = s.lastIndexOf(':');
  if (idx === -1) return null;
  const label = s.slice(0, idx).trim();
  const rhs = s.slice(idx + 1).trim();
  const m = rhs.match(/-?\d+(?:\.\d+)?/);
  if (!m || label === '') return null;
  const value = Number.parseFloat(m[0]);
  if (!Number.isFinite(value)) return null;
  return { label, value };
}

function formatValue(v: number): string {
  if (Number.isInteger(v)) return String(v);
  // Trim to 2 decimals max
  return v.toFixed(2).replace(/\.?0+$/, '');
}

export const DATA_CHART_REVEAL_CSS = `
  .slide-data-chart-reveal {
    position: absolute; inset: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    opacity: 0;
    color: white;
    padding: 0 72px;
  }
  .slide-data-chart-reveal .title {
    font-size: 72px;
    font-weight: 800;
    letter-spacing: -1.5px;
    margin: 0 0 48px 0;
    opacity: 0;
    transform: translateY(24px);
    text-align: center;
  }
  .slide-data-chart-reveal .chart-area {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 32px;
    width: 100%;
    max-width: 1100px;
    height: 45vh;
  }
  .slide-data-chart-reveal .bar-col {
    flex: 1 1 0;
    min-width: 60px;
    max-width: 180px;
    display: flex; flex-direction: column; align-items: center;
    height: 100%;
  }
  .slide-data-chart-reveal .bar-value {
    font-size: 32px;
    font-weight: 700;
    margin-bottom: 10px;
    opacity: 0;
    transform: translateY(8px) scale(0.8);
    color: rgba(255,255,255,0.95);
  }
  .slide-data-chart-reveal .bar-track {
    flex: 1 1 auto;
    width: 100%;
    position: relative;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }
  .slide-data-chart-reveal .bar {
    width: 100%;
    background: linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0.72));
    border-radius: 6px 6px 0 0;
    transform: scaleY(0);
    transform-origin: bottom center;
    box-shadow: 0 8px 32px rgba(0,0,0,0.25);
  }
  .slide-data-chart-reveal .bar-label {
    font-size: 20px;
    font-weight: 600;
    margin-top: 16px;
    color: rgba(255,255,255,0.82);
    letter-spacing: 0.3px;
    text-align: center;
    opacity: 0;
    white-space: nowrap;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;
