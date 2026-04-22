import { escapeText } from './escape';
import type { SlideRenderOutput, SlideSpec, SlideTemplate } from './types';

/**
 * audio-waveform — animated spectrum bar visualizer + title +
 * optional subtitle. N vertical bars oscillate vertically with
 * phase offsets; over the full slide the "waveform" appears to
 * pulse like a music visualizer.
 *
 * True audio-reactive output is deferred to R6. This template
 * generates a deterministic pseudo-spectrum via precomputed
 * keyframes — no runtime audio analysis, but the visual reads
 * identically at the timescale we're showing.
 *
 * Slots:
 *   - title         → large heading
 *   - subtitle      → track / channel / caption
 *   - extras.bars   → bar count (default 40, clamp 8..64)
 *   - extras.accent → accent colour for the bars (default cyan/magenta gradient)
 */
export const audioWaveform: SlideTemplate = (spec: SlideSpec): SlideRenderOutput => {
  const { index, startMs, endMs } = spec;
  const title = spec.title ?? '';
  const subtitle = spec.subtitle ?? '';
  const barCountRaw = Number(spec.extras?.bars ?? 40);
  const barCount = Math.max(
    8,
    Math.min(64, Number.isFinite(barCountRaw) ? Math.round(barCountRaw) : 40),
  );

  const FADE_MS = 400;
  const inStart = startMs;
  const inEnd = startMs + FADE_MS;
  const outStart = endMs - FADE_MS;
  const outEnd = endMs;

  const id = `slide-${index}`;

  const barsHtml = Array.from(
    { length: barCount },
    (_v, i) => `<div class="bar" data-i="${i}"></div>`,
  ).join('');

  const html = `
  <section class="slide slide-audio-waveform" id="${id}" data-slide-index="${index}">
    ${title !== '' ? `<h1 class="title">${escapeText(title)}</h1>` : ''}
    ${subtitle !== '' ? `<div class="subtitle">${escapeText(subtitle)}</div>` : ''}
    <div class="spectrum" data-bars="${barCount}">${barsHtml}</div>
  </section>`.trim();

  const sel = (s: string) => `#${id}${s === '' ? '' : ' ' + s}`;

  // Seed-less deterministic "pseudo-spectrum": each bar gets a sine-
  // based scaleY curve, layered with a slower envelope. Bar i's phase
  // offset is i / barCount * 2π, so neighbours are close but visibly
  // distinct — reads like a real spectrum analyzer.
  //
  // Sampled at STEP_MS intervals across [startMs, endMs]; manual-
  // keyframes adapter linearly interpolates between samples.
  const STEP_MS = 100;
  const duration = endMs - startMs;
  const sampleCount = Math.max(2, Math.ceil(duration / STEP_MS));
  const barAnims = Array.from({ length: barCount }, (_v, i) => {
    const phase = (i / barCount) * Math.PI * 2;
    const freq = 1.6 + ((i * 0.13) % 1.8); // ~1.6-3.4 Hz per-bar
    const envFreq = 0.25; // 0.25 Hz overall pulse
    const kfs: { atMs: number; props: Record<string, string | number> }[] = [];
    for (let s = 0; s <= sampleCount; s++) {
      const t = startMs + (duration * s) / sampleCount;
      const secs = (t - startMs) / 1000;
      const hi = (Math.sin(secs * freq + phase) + 1) / 2; // 0..1
      const env = 0.55 + 0.4 * ((Math.sin(secs * envFreq) + 1) / 2); // 0.55..0.95
      const scaleY = 0.15 + hi * env * 0.95; // 0.15..~1.0
      kfs.push({ atMs: t, props: { transform: `scaleY(${scaleY.toFixed(3)})` } });
    }
    // Fade the bar itself in/out with the slide.
    kfs[0]!.props.opacity = 0;
    kfs.unshift({ atMs: 0, props: { opacity: 0, transform: 'scaleY(0.15)' } });
    // Force the entrance fade at inEnd.
    for (let k = 1; k < kfs.length; k++) {
      const at = kfs[k]!.atMs;
      kfs[k]!.props.opacity = at < inEnd ? Math.min(1, (at - inStart) / FADE_MS).toFixed(2) : '1';
      if (at >= outStart) {
        kfs[k]!.props.opacity = Math.max(0, 1 - (at - outStart) / FADE_MS).toFixed(2);
      }
    }
    return {
      selector: sel(`.bar[data-i="${i}"]`),
      easing: 'linear',
      keyframes: kfs,
    };
  });

  return {
    html,
    css: AUDIO_WAVEFORM_CSS,
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
          { atMs: inStart + 200 + 440, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'translateY(-4px)' } },
        ],
      },
      ...barAnims,
    ],
  };
};

export const AUDIO_WAVEFORM_CSS = `
  .slide-audio-waveform {
    position: absolute; inset: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    opacity: 0;
    color: white;
    padding: 40px 64px;
    gap: 10px;
    box-sizing: border-box;
  }
  .slide-audio-waveform .title {
    font-size: 48px;
    font-weight: 800;
    letter-spacing: -1px;
    margin: 0;
    text-align: center;
    opacity: 0;
    transform: translateY(14px);
  }
  .slide-audio-waveform .subtitle {
    font-size: 18px;
    color: rgba(255,255,255,0.65);
    margin-bottom: 28px;
    opacity: 0;
    transform: translateY(10px);
    letter-spacing: 0.5px;
  }
  .slide-audio-waveform .spectrum {
    display: flex; align-items: flex-end; justify-content: center;
    gap: 6px;
    width: 100%;
    max-width: 960px;
    height: 260px;
  }
  .slide-audio-waveform .bar {
    flex: 1 1 0;
    min-width: 4px;
    max-width: 18px;
    height: 100%;
    background: linear-gradient(180deg, #ff2a6d 0%, #05d9e8 100%);
    border-radius: 3px 3px 0 0;
    box-shadow: 0 0 10px rgba(5, 217, 232, 0.35);
    transform-origin: bottom center;
    transform: scaleY(0.15);
    opacity: 0;
    will-change: transform, opacity;
  }
`;
