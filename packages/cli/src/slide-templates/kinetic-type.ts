import { escapeText } from './escape';
import type { SlideRenderOutput, SlideSpec, SlideTemplate } from './types';

/**
 * kinetic-type — title split per-character; each glyph fades in with a
 * subtle rotate+translateY, cascading 40 ms apart. Subtitle fades up
 * after the last character lands.
 *
 * Unicode-aware split uses Array.from(title) so astral-plane codepoints
 * (emoji, CJK surrogate pairs) are treated as single glyphs — we still
 * don't split graphemes, so multi-codepoint emoji sequences show piecewise.
 */
export const kineticType: SlideTemplate = (spec: SlideSpec): SlideRenderOutput => {
  const { index, startMs, endMs } = spec;
  const title = spec.title ?? '';
  const subtitle = spec.subtitle ?? '';

  const FADE_MS = 400;
  const inStart = startMs;
  const inEnd = startMs + FADE_MS;
  const outStart = endMs - FADE_MS;
  const outEnd = endMs;

  const id = `slide-${index}`;

  const chars = Array.from(title);
  const charSpans = chars
    .map((ch, i) => {
      // Preserve visual width of spaces; use non-breaking space entity so
      // inline-block spans don't collapse.
      const visible = ch === ' ' ? '&nbsp;' : escapeText(ch);
      return `<span class="char" data-i="${i}">${visible}</span>`;
    })
    .join('');

  const html = `
  <section class="slide slide-kinetic-type" id="${id}" data-slide-index="${index}">
    <h1 class="title" aria-label="${escapeText(title)}">${charSpans}</h1>
    ${subtitle !== '' ? `<div class="subtitle">${escapeText(subtitle)}</div>` : ''}
  </section>`.trim();

  const sel = (s: string) => `#${id}${s === '' ? '' : ' ' + s}`;

  const STAGGER_MS = 40;
  const CHAR_ENTRANCE_MS = 560;
  // Subtitle should begin after the last char lands.
  const lastCharLanding = inStart + 220 + (Math.max(1, chars.length) - 1) * STAGGER_MS + CHAR_ENTRANCE_MS;
  const subtitleStart = Math.min(outStart - 50, lastCharLanding + 80);

  const charAnims = chars.map((_, i) => {
    const delay = inStart + 220 + i * STAGGER_MS;
    // Reverse stagger for the exit so the last char leaves first.
    const exitDelay = outStart + i * 12;
    return {
      selector: sel(`.char[data-i="${i}"]`),
      easing: 'cubic-bezier(.22,.9,.32,1)',
      keyframes: [
        { atMs: 0, props: { opacity: 0, transform: 'translateY(22px) rotate(12deg)' } },
        {
          atMs: Math.max(0, delay - 1),
          props: { opacity: 0, transform: 'translateY(22px) rotate(12deg)' },
        },
        {
          atMs: delay + CHAR_ENTRANCE_MS,
          props: { opacity: 1, transform: 'translateY(0px) rotate(0deg)' },
        },
        { atMs: exitDelay, props: { opacity: 1, transform: 'translateY(0px) rotate(0deg)' } },
        {
          atMs: Math.min(outEnd, exitDelay + 300),
          props: { opacity: 0, transform: 'translateY(-8px) rotate(-6deg)' },
        },
      ],
    };
  });

  return {
    html,
    css: KINETIC_TYPE_CSS,
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
      ...charAnims,
      // subtitle fade-up after the last glyph lands
      {
        selector: sel('.subtitle'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'translateY(20px)' } },
          {
            atMs: Math.max(0, subtitleStart - 1),
            props: { opacity: 0, transform: 'translateY(20px)' },
          },
          {
            atMs: Math.min(outStart, subtitleStart + 600),
            props: { opacity: 1, transform: 'translateY(0px)' },
          },
          { atMs: outStart, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'translateY(-10px)' } },
        ],
      },
    ],
  };
};

export const KINETIC_TYPE_CSS = `
  .slide-kinetic-type {
    position: absolute; inset: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    opacity: 0;
    color: white;
    padding: 0 64px;
  }
  .slide-kinetic-type .title {
    font-size: 128px;
    font-weight: 900;
    letter-spacing: -3px;
    line-height: 1.05;
    text-align: center;
    margin: 0 0 40px 0;
    text-shadow: 0 10px 40px rgba(0,0,0,0.4);
  }
  .slide-kinetic-type .char {
    display: inline-block;
    opacity: 0;
    transform: translateY(22px) rotate(12deg);
    transform-origin: center center;
    will-change: transform, opacity;
  }
  .slide-kinetic-type .subtitle {
    font-size: 34px;
    font-weight: 500;
    color: rgba(255,255,255,0.88);
    letter-spacing: 0.5px;
    opacity: 0;
    transform: translateY(20px);
    text-align: center;
  }
`;
