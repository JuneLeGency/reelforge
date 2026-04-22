import { escapeText } from './escape';
import type { SlideRenderOutput, SlideSpec, SlideTemplate } from './types';

/**
 * social-follow — platform-branded "follow / subscribe" card. Drops
 * over any slide (as an overlay-style card) or stands alone. The
 * platform's signature colour + glyph + CTA copy auto-configure from
 * extras.platform; everything else is overridable.
 *
 * Slots:
 *   - title             → account display name ("@reelforge")
 *   - subtitle          → context line ("程序化视频生成框架 · 开源")
 *   - extras.platform   → 'youtube' | 'instagram' | 'tiktok' | 'x' |
 *                         'reddit' | 'github' (default 'github')
 *   - extras.cta        → primary button label (default per-platform)
 *   - extras.counter    → small stat below the CTA ("12.4K followers")
 */
export const socialFollow: SlideTemplate = (spec: SlideSpec): SlideRenderOutput => {
  const { index, startMs, endMs } = spec;
  const title = spec.title ?? '';
  const subtitle = spec.subtitle ?? '';
  const platform = String(spec.extras?.platform ?? 'github').toLowerCase();
  const brand = BRAND_DEFAULTS[platform] ?? BRAND_DEFAULTS.github!;
  const cta = String(spec.extras?.cta ?? brand.cta);
  const counter = String(spec.extras?.counter ?? '');

  const FADE_MS = 400;
  const inStart = startMs;
  const inEnd = startMs + FADE_MS;
  const outStart = endMs - FADE_MS;
  const outEnd = endMs;

  const id = `slide-${index}`;
  const html = `
  <section class="slide slide-social-follow platform-${platform}" id="${id}" data-slide-index="${index}"
           style="--brand: ${brand.color}; --brand-ink: ${brand.ink};">
    <div class="brand-bg"></div>
    <article class="card">
      <div class="glyph" aria-hidden="true">${brand.glyph}</div>
      <div class="platform-name">${escapeText(brand.name)}</div>
      ${title !== '' ? `<h1 class="handle">${escapeText(title)}</h1>` : ''}
      ${subtitle !== '' ? `<div class="bio">${escapeText(subtitle)}</div>` : ''}
      <button class="cta" type="button">${escapeText(cta)}</button>
      ${counter !== '' ? `<div class="counter">${escapeText(counter)}</div>` : ''}
    </article>
  </section>`.trim();

  const sel = (s: string) => `#${id}${s === '' ? '' : ' ' + s}`;

  return {
    html,
    css: SOCIAL_FOLLOW_CSS,
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
      // Card pops in with a subtle bounce
      {
        selector: sel('.card'),
        easing: 'cubic-bezier(.34,1.56,.64,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'scale(0.82) translateY(20px)' } },
          {
            atMs: Math.max(0, inStart + 120 - 1),
            props: { opacity: 0, transform: 'scale(0.82) translateY(20px)' },
          },
          {
            atMs: inStart + 120 + 550,
            props: { opacity: 1, transform: 'scale(1) translateY(0px)' },
          },
          { atMs: outStart, props: { opacity: 1, transform: 'scale(1) translateY(0px)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'scale(0.95) translateY(-4px)' } },
        ],
      },
      // CTA button breathes (pulse) over the slide's hold
      {
        selector: sel('.cta'),
        easing: 'cubic-bezier(.45,.05,.55,.95)',
        keyframes: [
          { atMs: 0, props: { transform: 'scale(1)' } },
          { atMs: inStart + 900, props: { transform: 'scale(1)' } },
          { atMs: inStart + 1400, props: { transform: 'scale(1.06)' } },
          { atMs: inStart + 1900, props: { transform: 'scale(1)' } },
          { atMs: inStart + 2400, props: { transform: 'scale(1.06)' } },
          { atMs: Math.max(inStart + 2401, outStart), props: { transform: 'scale(1)' } },
          { atMs: outEnd, props: { transform: 'scale(1)' } },
        ],
      },
    ],
  };
};

interface Brand {
  name: string;
  color: string;
  ink: string; // text colour on top of brand
  glyph: string; // inline SVG; small icon
  cta: string;
}

// Colours are the widely-recognizable public brand tokens; glyphs are
// simplified single-colour silhouettes (currentColor = brand.ink) so
// they render cleanly at any size without loading external assets.
const BRAND_DEFAULTS: Readonly<Record<string, Brand>> = {
  youtube: {
    name: 'YouTube',
    color: '#ff0033',
    ink: '#ffffff',
    glyph:
      '<svg viewBox="0 0 24 24" width="44" height="44" fill="currentColor"><path d="M23 6.2c-.3-1.1-1.1-2-2.2-2.3C18.8 3.4 12 3.4 12 3.4s-6.8 0-8.8.5C2.1 4.2 1.3 5.1 1 6.2.5 8.2.5 12 .5 12s0 3.8.5 5.8c.3 1.1 1.1 2 2.2 2.3 2 .5 8.8.5 8.8.5s6.8 0 8.8-.5c1.1-.3 1.9-1.2 2.2-2.3.5-2 .5-5.8.5-5.8s0-3.8-.5-5.8zM9.8 15.6V8.4L15.8 12l-6 3.6z"/></svg>',
    cta: 'Subscribe',
  },
  instagram: {
    name: 'Instagram',
    color: '#e1306c',
    ink: '#ffffff',
    glyph:
      '<svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor"/></svg>',
    cta: 'Follow',
  },
  tiktok: {
    name: 'TikTok',
    color: '#000000',
    ink: '#ffffff',
    glyph:
      '<svg viewBox="0 0 24 24" width="44" height="44" fill="currentColor"><path d="M16 3c.4 2.2 1.6 3.9 4 4v3.2c-1.6 0-3.2-.4-4.5-1.2v5.8c0 4-3.2 6.2-6.2 6.2-3.3 0-6.3-2.4-6.3-6.2 0-3.5 3-6.2 6.4-6.2v3.3c-1.7 0-3.1 1.3-3.1 3 0 1.6 1.3 3 3 3s3-1.3 3-3V3h3.7z"/></svg>',
    cta: 'Follow',
  },
  x: {
    name: 'X',
    color: '#000000',
    ink: '#ffffff',
    glyph:
      '<svg viewBox="0 0 24 24" width="44" height="44" fill="currentColor"><path d="M18.9 2H22l-7.2 8.3L23 22h-6.7l-5.2-6.8L5 22H2l7.6-8.8L1.4 2h6.9l4.7 6.2L18.9 2zm-1.2 18.1h1.8L6.5 3.8H4.6l13.1 16.3z"/></svg>',
    cta: 'Follow',
  },
  reddit: {
    name: 'Reddit',
    color: '#ff4500',
    ink: '#ffffff',
    glyph:
      '<svg viewBox="0 0 24 24" width="44" height="44" fill="currentColor"><circle cx="12" cy="14" r="9"/><circle cx="8.8" cy="13.8" r="1.3" fill="#fff"/><circle cx="15.2" cy="13.8" r="1.3" fill="#fff"/><path d="M8 17c1 1 2.5 1.6 4 1.6s3-.6 4-1.6" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/><circle cx="18" cy="7" r="1.6"/></svg>',
    cta: 'Join community',
  },
  github: {
    name: 'GitHub',
    color: '#24292f',
    ink: '#ffffff',
    glyph:
      '<svg viewBox="0 0 24 24" width="44" height="44" fill="currentColor"><path d="M12 .5C5.7.5.6 5.6.6 12c0 5 3.3 9.3 7.9 10.8.6.1.8-.2.8-.6v-2.2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.2-1.7-1.2-1.7-1-.7.1-.7.1-.7 1.1.1 1.7 1.2 1.7 1.2 1 1.7 2.6 1.2 3.2.9.1-.7.4-1.2.7-1.5-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11 11 0 016 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.1 0 4.5-2.7 5.5-5.3 5.8.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.8C23.4 5.6 18.3.5 12 .5z"/></svg>',
    cta: 'Star on GitHub',
  },
};

export const SOCIAL_FOLLOW_CSS = `
  .slide-social-follow {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    opacity: 0;
    color: white;
    overflow: hidden;
  }
  .slide-social-follow .brand-bg {
    position: absolute; inset: 0;
    background: radial-gradient(circle at 30% 20%,
      color-mix(in srgb, var(--brand) 42%, transparent) 0%,
      transparent 55%),
      radial-gradient(circle at 80% 80%,
      color-mix(in srgb, var(--brand) 28%, transparent) 0%,
      transparent 60%);
    pointer-events: none;
  }
  .slide-social-follow .card {
    position: relative;
    width: 480px;
    max-width: 78vw;
    padding: 42px 40px 32px 40px;
    border-radius: 24px;
    background: rgba(15, 15, 20, 0.82);
    border: 1px solid rgba(255,255,255,0.08);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    text-align: center;
    box-shadow: 0 24px 64px rgba(0,0,0,0.45);
    opacity: 0;
    transform: scale(0.82) translateY(20px);
  }
  .slide-social-follow .glyph {
    display: inline-flex;
    color: var(--brand);
    margin-bottom: 6px;
  }
  .slide-social-follow .platform-name {
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.6);
    margin-bottom: 14px;
  }
  .slide-social-follow .handle {
    font-size: 40px;
    font-weight: 800;
    letter-spacing: -0.8px;
    margin: 0 0 8px 0;
    line-height: 1.1;
  }
  .slide-social-follow .bio {
    font-size: 17px;
    font-weight: 500;
    color: rgba(255,255,255,0.76);
    line-height: 1.4;
    margin-bottom: 22px;
  }
  .slide-social-follow .cta {
    appearance: none;
    background: var(--brand);
    color: var(--brand-ink);
    font-size: 18px;
    font-weight: 800;
    letter-spacing: 0.4px;
    padding: 12px 28px;
    border-radius: 999px;
    border: 0;
    cursor: pointer;
    box-shadow: 0 10px 28px color-mix(in srgb, var(--brand) 40%, transparent);
  }
  .slide-social-follow .counter {
    margin-top: 14px;
    font-size: 14px;
    font-weight: 600;
    color: rgba(255,255,255,0.56);
    letter-spacing: 0.5px;
  }
`;
