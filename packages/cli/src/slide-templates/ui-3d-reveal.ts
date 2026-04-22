import { escapeAttr, escapeText } from './escape';
import type { SlideRenderOutput, SlideSpec, SlideTemplate } from './types';

/**
 * ui-3d-reveal — CSS 3D perspective entrance. The main "card" flips
 * from a tilted side-view (rotateY / rotateX) to head-on, while a
 * halo glow expands behind it. Optionally shows an image "screen" in
 * the card — e.g. product UI mock, app screenshot, logo plate.
 *
 * Slots:
 *   - title         → large headline above or on the card
 *   - subtitle      → smaller lead line
 *   - image         → card interior visual (fills the inner screen)
 *   - extras.angle  → initial rotateY angle, 0..75 (default 48)
 */
export const ui3dReveal: SlideTemplate = (spec: SlideSpec): SlideRenderOutput => {
  const { index, startMs, endMs } = spec;
  const title = spec.title ?? '';
  const subtitle = spec.subtitle ?? '';
  const image = spec.image ?? '';
  const angleRaw = Number(spec.extras?.angle ?? 48);
  const angle = Math.max(0, Math.min(75, Number.isFinite(angleRaw) ? angleRaw : 48));

  const FADE_MS = 400;
  const inStart = startMs;
  const inEnd = startMs + FADE_MS;
  const outStart = endMs - FADE_MS;
  const outEnd = endMs;

  const id = `slide-${index}`;
  const html = `
  <section class="slide slide-ui-3d-reveal" id="${id}" data-slide-index="${index}">
    <div class="halo"></div>
    <div class="perspective">
      <div class="card">
        <div class="screen">
          ${image !== '' ? `<img src="${escapeAttr(image)}" alt="">` : `<div class="placeholder">UI</div>`}
        </div>
        <div class="bezel"></div>
      </div>
    </div>
    <div class="copy">
      ${title !== '' ? `<h1 class="title">${escapeText(title)}</h1>` : ''}
      ${subtitle !== '' ? `<div class="subtitle">${escapeText(subtitle)}</div>` : ''}
    </div>
  </section>`.trim();

  const sel = (s: string) => `#${id}${s === '' ? '' : ' ' + s}`;

  return {
    html,
    css: UI_3D_REVEAL_CSS,
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
      // Card flips from a -48deg rotateY + slight rotateX to head-on.
      {
        selector: sel('.card'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          {
            atMs: 0,
            props: {
              opacity: 0,
              transform: `rotateX(-14deg) rotateY(-${angle}deg) translateZ(-80px)`,
            },
          },
          {
            atMs: Math.max(0, inStart + 180 - 1),
            props: {
              opacity: 0,
              transform: `rotateX(-14deg) rotateY(-${angle}deg) translateZ(-80px)`,
            },
          },
          {
            atMs: inStart + 180 + 900,
            props: {
              opacity: 1,
              transform: 'rotateX(0deg) rotateY(0deg) translateZ(0px)',
            },
          },
          { atMs: outStart, props: { opacity: 1, transform: 'rotateX(0deg) rotateY(0deg) translateZ(0px)' } },
          {
            atMs: outEnd,
            props: {
              opacity: 0,
              transform: `rotateX(6deg) rotateY(${angle / 3}deg) translateZ(-30px)`,
            },
          },
        ],
      },
      // Halo expands + brightens behind the card as it lands
      {
        selector: sel('.halo'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'scale(0.5)' } },
          { atMs: Math.max(0, inStart + 280 - 1), props: { opacity: 0, transform: 'scale(0.5)' } },
          { atMs: inStart + 280 + 900, props: { opacity: 1, transform: 'scale(1)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'scale(1)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'scale(0.8)' } },
        ],
      },
      // Title + subtitle come in after the card lands
      {
        selector: sel('.title'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'translateY(20px)' } },
          { atMs: Math.max(0, inStart + 860 - 1), props: { opacity: 0, transform: 'translateY(20px)' } },
          { atMs: inStart + 860 + 520, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'translateY(-8px)' } },
        ],
      },
      {
        selector: sel('.subtitle'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'translateY(14px)' } },
          { atMs: Math.max(0, inStart + 1060 - 1), props: { opacity: 0, transform: 'translateY(14px)' } },
          { atMs: inStart + 1060 + 460, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'translateY(-6px)' } },
        ],
      },
    ],
  };
};

export const UI_3D_REVEAL_CSS = `
  .slide-ui-3d-reveal {
    position: absolute; inset: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    opacity: 0;
    color: white;
    overflow: hidden;
    perspective: 1400px;
  }
  .slide-ui-3d-reveal .halo {
    position: absolute;
    top: 50%; left: 50%;
    width: 720px; height: 420px;
    margin: -210px 0 0 -360px;
    background: radial-gradient(ellipse at center,
      rgba(5, 217, 232, 0.35) 0%,
      rgba(255, 42, 109, 0.18) 40%,
      transparent 70%);
    filter: blur(22px);
    opacity: 0;
    transform: scale(0.5);
    z-index: 0;
    pointer-events: none;
  }
  .slide-ui-3d-reveal .perspective {
    position: relative;
    margin-bottom: 28px;
    transform-style: preserve-3d;
    z-index: 1;
  }
  .slide-ui-3d-reveal .card {
    position: relative;
    width: 640px; height: 360px;
    max-width: 72vw;
    border-radius: 14px;
    background: linear-gradient(145deg, #1a1f2e 0%, #0d1117 100%);
    border: 1px solid rgba(255,255,255,0.12);
    box-shadow:
      0 30px 80px rgba(0,0,0,0.55),
      0 0 0 1px rgba(255,255,255,0.03);
    opacity: 0;
    transform-style: preserve-3d;
    overflow: hidden;
  }
  .slide-ui-3d-reveal .screen {
    position: absolute; inset: 8px;
    border-radius: 10px;
    background: linear-gradient(160deg, #12202f, #0a0f1a);
    display: flex; align-items: center; justify-content: center;
    overflow: hidden;
  }
  .slide-ui-3d-reveal .screen img {
    width: 100%; height: 100%;
    object-fit: cover;
    display: block;
  }
  .slide-ui-3d-reveal .placeholder {
    font-size: 72px;
    font-weight: 900;
    letter-spacing: 4px;
    color: rgba(255,255,255,0.22);
    text-shadow: 0 6px 20px rgba(0,0,0,0.6);
  }
  .slide-ui-3d-reveal .bezel {
    position: absolute; inset: 0;
    border-radius: 14px;
    background: linear-gradient(135deg,
      rgba(255,255,255,0.06) 0%,
      rgba(255,255,255,0) 30%,
      rgba(255,255,255,0) 70%,
      rgba(255,255,255,0.06) 100%);
    pointer-events: none;
  }
  .slide-ui-3d-reveal .copy {
    position: relative; z-index: 2;
    text-align: center;
    max-width: 78vw;
  }
  .slide-ui-3d-reveal .title {
    font-size: 48px;
    font-weight: 800;
    letter-spacing: -1px;
    margin: 0 0 8px 0;
    line-height: 1.1;
    opacity: 0;
    transform: translateY(20px);
  }
  .slide-ui-3d-reveal .subtitle {
    font-size: 20px;
    font-weight: 500;
    color: rgba(255,255,255,0.76);
    letter-spacing: 0.3px;
    opacity: 0;
    transform: translateY(14px);
  }
`;
