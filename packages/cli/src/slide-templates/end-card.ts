import { escapeText } from './escape';
import type { SlideRenderOutput, SlideSpec, SlideTemplate } from './types';

/**
 * end-card — closing slide with a main CTA line and up to three
 * icon-labeled actions (e.g. like / subscribe / bell). Icons are
 * taken from spec.extras.icons as a pipe-delimited string, e.g.
 * "👍|🔔|✉️" — simple text placeholder so the template stays
 * dependency-free. Use SVG assets via extras.icons if needed.
 *
 * Slots:
 *   - title    → main CTA line ("Subscribe for more")
 *   - subtitle → secondary CTA ("New video every Tuesday")
 *   - extras.icons → "icon1|icon2|icon3" (any three strings)
 *   - extras.actions → "label1|label2|label3" (under the icons)
 */
export const endCard: SlideTemplate = (spec: SlideSpec): SlideRenderOutput => {
  const { index, startMs, endMs } = spec;
  const title = spec.title ?? '';
  const subtitle = spec.subtitle ?? '';
  const iconsStr = String(spec.extras?.icons ?? '👍|🔔|💬');
  const actionsStr = String(spec.extras?.actions ?? 'Like|Subscribe|Comment');
  const icons = iconsStr.split('|').slice(0, 3);
  const actions = actionsStr.split('|').slice(0, 3);

  const FADE_MS = 400;
  const inStart = startMs;
  const inEnd = startMs + FADE_MS;
  const outStart = endMs - FADE_MS;
  const outEnd = endMs;

  const id = `slide-${index}`;

  const actionHtml = icons
    .map((icon, i) => {
      const label = actions[i] ?? '';
      return `
      <div class="action" data-i="${i}">
        <div class="icon">${escapeText(icon)}</div>
        ${label !== '' ? `<div class="label">${escapeText(label)}</div>` : ''}
      </div>`;
    })
    .join('');

  const html = `
  <section class="slide slide-end-card" id="${id}" data-slide-index="${index}">
    ${title !== '' ? `<h1 class="cta">${escapeText(title)}</h1>` : ''}
    ${subtitle !== '' ? `<div class="sub-cta">${escapeText(subtitle)}</div>` : ''}
    <div class="actions">
      ${actionHtml}
    </div>
  </section>`.trim();

  const sel = (s: string) => `#${id}${s === '' ? '' : ' ' + s}`;

  const ACTION_STAGGER = 140;
  const actionsStart = inStart + 520;
  const actionAnims = icons.flatMap((_, i) => {
    const delay = actionsStart + i * ACTION_STAGGER;
    return [
      {
        selector: sel(`.action[data-i="${i}"]`),
        easing: 'cubic-bezier(.34,1.56,.64,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'translateY(24px) scale(0.6)' } },
          {
            atMs: Math.max(0, delay - 1),
            props: { opacity: 0, transform: 'translateY(24px) scale(0.6)' },
          },
          { atMs: delay + 500, props: { opacity: 1, transform: 'translateY(0px) scale(1)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'translateY(0px) scale(1)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'translateY(-8px) scale(0.9)' } },
        ],
      },
    ];
  });

  return {
    html,
    css: END_CARD_CSS,
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
      // CTA scale pop
      {
        selector: sel('.cta'),
        easing: 'cubic-bezier(.34,1.56,.64,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'scale(0.7)' } },
          { atMs: Math.max(0, inStart + 120 - 1), props: { opacity: 0, transform: 'scale(0.7)' } },
          { atMs: inStart + 120 + 600, props: { opacity: 1, transform: 'scale(1)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'scale(1)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'scale(0.95)' } },
        ],
      },
      // sub-CTA fade-up
      {
        selector: sel('.sub-cta'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'translateY(18px)' } },
          { atMs: Math.max(0, inStart + 320 - 1), props: { opacity: 0, transform: 'translateY(18px)' } },
          { atMs: inStart + 320 + 550, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'translateY(-8px)' } },
        ],
      },
      ...actionAnims,
    ],
  };
};

export const END_CARD_CSS = `
  .slide-end-card {
    position: absolute; inset: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    opacity: 0;
    color: white;
    padding: 0 64px;
  }
  .slide-end-card .cta {
    font-size: 88px;
    font-weight: 800;
    letter-spacing: -1.5px;
    line-height: 1.1;
    text-align: center;
    margin: 0 0 20px 0;
    text-shadow: 0 8px 32px rgba(0,0,0,0.4);
    opacity: 0;
    transform: scale(0.7);
    transform-origin: center center;
  }
  .slide-end-card .sub-cta {
    font-size: 32px;
    font-weight: 500;
    color: rgba(255,255,255,0.85);
    text-align: center;
    margin-bottom: 64px;
    opacity: 0;
    transform: translateY(18px);
  }
  .slide-end-card .actions {
    display: flex;
    gap: 56px;
    justify-content: center;
    align-items: flex-start;
  }
  .slide-end-card .action {
    display: flex; flex-direction: column; align-items: center;
    gap: 12px;
    opacity: 0;
    transform: translateY(24px) scale(0.6);
  }
  .slide-end-card .icon {
    font-size: 64px;
    width: 112px; height: 112px;
    display: flex; align-items: center; justify-content: center;
    background: rgba(255,255,255,0.08);
    border: 2px solid rgba(255,255,255,0.25);
    border-radius: 50%;
    line-height: 1;
  }
  .slide-end-card .label {
    font-size: 20px;
    font-weight: 600;
    letter-spacing: 0.5px;
    color: rgba(255,255,255,0.9);
  }
`;
