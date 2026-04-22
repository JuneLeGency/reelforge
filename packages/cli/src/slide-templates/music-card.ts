import { escapeText } from './escape';
import type { SlideRenderOutput, SlideSpec, SlideTemplate } from './types';

/**
 * music-card — "now playing" style music widget. Album art placeholder
 * (SVG gradient + note glyph) on the left, track metadata + a progress
 * bar on the right. The progress bar fills 0 → 100 % over the slide's
 * duration for a "track is playing" feel.
 *
 * Slots:
 *   - title             → track name
 *   - subtitle          → artist (or artist – album)
 *   - extras.album      → small line under the artist ("From the album …")
 *   - extras.duration   → track duration label, e.g. "3:42"
 *   - extras.accent     → accent colour (default Spotify green, #1db954)
 *   - extras.platform   → small chip top-right ("SPOTIFY", "APPLE MUSIC")
 */
export const musicCard: SlideTemplate = (spec: SlideSpec): SlideRenderOutput => {
  const { index, startMs, endMs } = spec;
  const title = spec.title ?? '';
  const subtitle = spec.subtitle ?? '';
  const album = String(spec.extras?.album ?? '');
  const duration = String(spec.extras?.duration ?? '');
  const accent = String(spec.extras?.accent ?? '#1db954');
  const platform = String(spec.extras?.platform ?? '');

  const FADE_MS = 400;
  const inStart = startMs;
  const inEnd = startMs + FADE_MS;
  const outStart = endMs - FADE_MS;
  const outEnd = endMs;

  const id = `slide-${index}`;
  const html = `
  <section class="slide slide-music-card" id="${id}" data-slide-index="${index}" style="--accent: ${accent};">
    <article class="card">
      ${platform !== '' ? `<div class="chip">${escapeText(platform)}</div>` : ''}
      <div class="art" aria-hidden="true">
        <svg viewBox="0 0 100 100" width="100%" height="100%">
          <defs>
            <linearGradient id="mc-grad-${index}" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="${accent}" stop-opacity="0.95"/>
              <stop offset="100%" stop-color="#05d9e8" stop-opacity="0.72"/>
            </linearGradient>
          </defs>
          <rect width="100" height="100" fill="url(#mc-grad-${index})" rx="10"/>
          <g transform="translate(50 54)" fill="rgba(255,255,255,0.92)">
            <circle r="6"/>
            <rect x="5" y="-32" width="5" height="28" rx="2"/>
            <rect x="5" y="-32" width="20" height="5" rx="2"/>
            <circle cx="22" cy="-4" r="5"/>
          </g>
        </svg>
      </div>
      <div class="meta">
        <div class="eyebrow">NOW PLAYING</div>
        ${title !== '' ? `<h1 class="track">${escapeText(title)}</h1>` : ''}
        ${subtitle !== '' ? `<div class="artist">${escapeText(subtitle)}</div>` : ''}
        ${album !== '' ? `<div class="album">${escapeText(album)}</div>` : ''}
        <div class="progress-row">
          <div class="progress">
            <div class="progress-fill"></div>
            <div class="progress-thumb"></div>
          </div>
          ${duration !== '' ? `<div class="duration">${escapeText(duration)}</div>` : ''}
        </div>
        <div class="controls">
          <span class="ctrl">⏮</span>
          <span class="ctrl big">⏸︎</span>
          <span class="ctrl">⏭</span>
        </div>
      </div>
    </article>
  </section>`.trim();

  const sel = (s: string) => `#${id}${s === '' ? '' : ' ' + s}`;

  return {
    html,
    css: MUSIC_CARD_CSS,
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
      // Card pops + slides up
      {
        selector: sel('.card'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'translateY(24px) scale(0.95)' } },
          {
            atMs: Math.max(0, inStart + 120 - 1),
            props: { opacity: 0, transform: 'translateY(24px) scale(0.95)' },
          },
          {
            atMs: inStart + 120 + 600,
            props: { opacity: 1, transform: 'translateY(0px) scale(1)' },
          },
          { atMs: outStart, props: { opacity: 1, transform: 'translateY(0px) scale(1)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'translateY(-8px) scale(0.98)' } },
        ],
      },
      // Album art pulses gently in sync with the "playback"
      {
        selector: sel('.art'),
        easing: 'cubic-bezier(.45,.05,.55,.95)',
        keyframes: [
          { atMs: 0, props: { transform: 'scale(1)' } },
          { atMs: inStart + 1000, props: { transform: 'scale(1)' } },
          { atMs: inStart + 1800, props: { transform: 'scale(1.03)' } },
          { atMs: inStart + 2600, props: { transform: 'scale(1)' } },
          { atMs: inStart + 3400, props: { transform: 'scale(1.03)' } },
          { atMs: Math.max(inStart + 3401, outStart), props: { transform: 'scale(1)' } },
          { atMs: outEnd, props: { transform: 'scale(1)' } },
        ],
      },
      // Progress bar fills across the track duration
      {
        selector: sel('.progress-fill'),
        easing: 'linear',
        keyframes: [
          { atMs: 0, props: { transform: 'scaleX(0)' } },
          { atMs: Math.max(0, inStart + 700 - 1), props: { transform: 'scaleX(0)' } },
          { atMs: outStart, props: { transform: 'scaleX(1)' } },
          { atMs: outEnd, props: { transform: 'scaleX(1)' } },
        ],
      },
      // Thumb tracks the fill
      {
        selector: sel('.progress-thumb'),
        easing: 'linear',
        keyframes: [
          { atMs: 0, props: { left: '0%' } },
          { atMs: Math.max(0, inStart + 700 - 1), props: { left: '0%' } },
          { atMs: outStart, props: { left: '100%' } },
          { atMs: outEnd, props: { left: '100%' } },
        ],
      },
    ],
  };
};

export const MUSIC_CARD_CSS = `
  .slide-music-card {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    opacity: 0;
    color: white;
    padding: 32px;
    box-sizing: border-box;
  }
  .slide-music-card .card {
    position: relative;
    display: flex;
    gap: 28px;
    width: 800px;
    max-width: 92vw;
    padding: 28px;
    border-radius: 20px;
    background: linear-gradient(145deg, rgba(28,28,42,0.96), rgba(8,8,14,0.96));
    border: 1px solid rgba(255,255,255,0.08);
    box-shadow: 0 24px 64px rgba(0,0,0,0.55);
    opacity: 0;
    transform: translateY(24px) scale(0.95);
  }
  .slide-music-card .chip {
    position: absolute;
    top: 18px; right: 20px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 3px;
    color: var(--accent);
    padding: 4px 10px;
    border: 1.5px solid color-mix(in srgb, var(--accent) 50%, transparent);
    border-radius: 3px;
    text-transform: uppercase;
  }
  .slide-music-card .art {
    width: 220px; height: 220px;
    flex: 0 0 auto;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 16px 36px rgba(0,0,0,0.45);
  }
  .slide-music-card .meta {
    flex: 1 1 auto;
    display: flex; flex-direction: column;
    justify-content: center;
    gap: 2px;
    min-width: 0;
  }
  .slide-music-card .eyebrow {
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 5px;
    color: var(--accent);
    margin-bottom: 8px;
  }
  .slide-music-card .track {
    font-size: 36px;
    font-weight: 800;
    letter-spacing: -0.8px;
    line-height: 1.1;
    margin: 0 0 6px 0;
    color: rgba(255,255,255,0.98);
  }
  .slide-music-card .artist {
    font-size: 19px;
    font-weight: 600;
    color: rgba(255,255,255,0.78);
  }
  .slide-music-card .album {
    font-size: 14px;
    color: rgba(255,255,255,0.5);
    margin-top: 2px;
  }
  .slide-music-card .progress-row {
    display: flex; align-items: center;
    gap: 14px;
    margin-top: 20px;
  }
  .slide-music-card .progress {
    flex: 1 1 auto;
    position: relative;
    height: 4px;
    background: rgba(255,255,255,0.12);
    border-radius: 2px;
    overflow: visible;
  }
  .slide-music-card .progress-fill {
    position: absolute; left: 0; top: 0; bottom: 0;
    width: 100%;
    background: var(--accent);
    border-radius: 2px;
    transform-origin: left center;
    transform: scaleX(0);
  }
  .slide-music-card .progress-thumb {
    position: absolute;
    top: 50%;
    left: 0%;
    width: 12px; height: 12px;
    margin-left: -6px;
    margin-top: -6px;
    border-radius: 50%;
    background: #ffffff;
    box-shadow: 0 3px 10px rgba(0,0,0,0.5);
  }
  .slide-music-card .duration {
    font-family: ui-monospace, "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace;
    font-size: 13px;
    color: rgba(255,255,255,0.58);
  }
  .slide-music-card .controls {
    display: flex; gap: 22px;
    margin-top: 16px;
    color: rgba(255,255,255,0.82);
    font-size: 22px;
  }
  .slide-music-card .ctrl.big {
    font-size: 32px;
    color: rgba(255,255,255,0.96);
  }
`;
