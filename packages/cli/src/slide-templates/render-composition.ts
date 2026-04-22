import type { Caption, TikTokPage } from '@reelforge/captions';
import {
  listChromeEffects,
  resolveChromeEffect,
  type ChromeEffectAnimation,
} from '@reelforge/transitions';
import type { SlideAnimation, SlideSpec } from './types';
import { listTemplateNames, resolveTemplate } from './registry';
import { escapeAttr, escapeText } from './escape';
import { listVisualStyleNames, resolveVisualStyle, type VisualStyle } from '../visual-styles';

/**
 * Instance of a slide that will be rendered into the composition.
 * Built up by the caller from (SlideContent × timing).
 */
export interface BuildSlideInstance {
  /** Template name — must be a key in SLIDE_TEMPLATES. */
  template: string;
  /** Content slots; templates consume what they need. */
  title?: string | undefined;
  subtitle?: string | undefined;
  image?: string | undefined;
  bullets?: readonly string[] | undefined;
  /** Timeline window in ms. */
  startMs: number;
  endMs: number;
  /** Arbitrary extras passed to the template. */
  extras?: Record<string, string | number | undefined> | undefined;
}

export interface TransitionEvent {
  /**
   * Effect name — a key in @reelforge/transitions CHROME_EFFECTS
   * (e.g. 'flash-white', 'flash-black', 'wipe-sweep', 'radial-pulse').
   */
  name: string;
  /** Center point on the composition timeline, in ms. */
  atMs: number;
  /** Visible duration of the effect, in ms. */
  durationMs: number;
}

export interface RenderCompositionOptions {
  width: number;
  height: number;
  fps: number;
  totalDurationMs: number;
  /** Global page background. Ignored when `style` is set. */
  background?: string;
  /**
   * Named visual style (see VISUAL_STYLES). Overrides `background` and
   * contributes palette/font/extra-CSS to the whole composition.
   */
  style?: string | VisualStyle | undefined;
  slides: readonly BuildSlideInstance[];
  audioRelative?: string | undefined;
  audioDurationMs?: number | undefined;
  /** Sentence-level captions overlay (sentence per entry). */
  captions?: readonly Caption[] | undefined;
  /** TikTok-paged captions — takes priority over `captions` when present. */
  tikTokPages?: readonly TikTokPage[] | undefined;
  /**
   * Optional inter-slide transition effects. Each event plays once at
   * `atMs` (center) for `durationMs`. Unknown effect names throw with
   * a helpful message listing available effects.
   */
  transitions?: readonly TransitionEvent[] | undefined;
  title?: string | undefined;
}

/**
 * Render a full composition HTML from template-driven slides. This is the
 * alternative to `buildGenerateHtml` — used when the user's config has
 * a `template` field (or per-slide templates) instead of plain images.
 */
export function renderTemplatedComposition(opts: RenderCompositionOptions): string {
  const {
    width,
    height,
    fps,
    totalDurationMs,
    slides,
    audioRelative,
    audioDurationMs,
    captions,
    tikTokPages,
    transitions,
  } = opts;
  const docTitle = opts.title ?? 'Reelforge generated video';

  const style: VisualStyle | null =
    typeof opts.style === 'string'
      ? resolveVisualStyle(opts.style)
      : (opts.style ?? null);
  if (typeof opts.style === 'string' && !style) {
    throw new Error(
      `Unknown visual style "${opts.style}". Available: ${listVisualStyleNames().join(', ')}`,
    );
  }

  const background = style?.background ?? opts.background ?? '#0a0a0f';
  const DEFAULT_FONT =
    '-apple-system, "PingFang SC", "Heiti SC", "Microsoft YaHei", "Segoe UI", Roboto, sans-serif';
  const fontFamilyHeading = style?.fontFamilyHeading ?? DEFAULT_FONT;
  const fontFamilyBody = style?.fontFamilyBody ?? DEFAULT_FONT;
  const styleExtraCss = style?.extraCss ?? '';

  const unknownTemplates: string[] = [];
  const parts: string[] = [];
  const animationPlans: Array<{ selector: string; animation: SlideAnimation }> = [];
  const templatesUsed = new Set<string>();
  for (let i = 0; i < slides.length; i++) {
    const s = slides[i]!;
    const template = resolveTemplate(s.template);
    if (!template) {
      unknownTemplates.push(s.template);
      continue;
    }
    templatesUsed.add(s.template);
    const spec: SlideSpec = {
      index: i,
      startMs: s.startMs,
      endMs: s.endMs,
      title: s.title,
      subtitle: s.subtitle,
      image: s.image,
      bullets: s.bullets,
      extras: {
        ...(s.extras ?? {}),
        indexLabel: s.extras?.indexLabel ?? String(i + 1).padStart(2, '0'),
        totalLabel: s.extras?.totalLabel ?? String(slides.length).padStart(2, '0'),
      },
    };
    const out = template(spec);
    parts.push(out.html);
    for (const anim of out.animations) {
      animationPlans.push({ selector: anim.selector, animation: anim });
    }
  }

  if (unknownTemplates.length > 0) {
    throw new Error(
      `Unknown slide template(s): ${[...new Set(unknownTemplates)].join(', ')}. ` +
        `Expected one of: ${listTemplateNames().join(', ')}.`,
    );
  }

  // Dedup CSS by template.
  const cssParts: string[] = [];
  for (const name of templatesUsed) {
    const template = resolveTemplate(name);
    if (!template) continue;
    // Probe CSS by calling with a dummy spec — templates return the
    // same CSS per family regardless of spec, so this is O(templates) not
    // O(slides).
    const probe = template({ index: 0, startMs: 0, endMs: 1 });
    cssParts.push(probe.css);
  }

  // Resolve transition effects: CSS deduped by string identity (so
  // effects like flash-white + flash-black, which share a CSS block,
  // only emit it once), HTML overlays one per event, and WAAPI
  // animations folded into the same plan as slide animations.
  const effectCssSet = new Set<string>();
  const effectHtmlParts: string[] = [];
  const effectAnimPlans: Array<{ selector: string; animation: ChromeEffectAnimation }> = [];
  const unknownEffects: string[] = [];
  if (transitions && transitions.length > 0) {
    for (let i = 0; i < transitions.length; i++) {
      const ev = transitions[i]!;
      const fx = resolveChromeEffect(ev.name);
      if (!fx) {
        unknownEffects.push(ev.name);
        continue;
      }
      effectCssSet.add(fx.css);
      const out = fx.emit({
        id: `t${i}`,
        atMs: ev.atMs,
        durationMs: ev.durationMs,
        totalDurationMs,
      });
      effectHtmlParts.push(out.html);
      for (const anim of out.animations) {
        effectAnimPlans.push({ selector: anim.selector, animation: anim });
      }
    }
  }
  if (unknownEffects.length > 0) {
    throw new Error(
      `Unknown Chrome effect(s): ${[...new Set(unknownEffects)].join(', ')}. ` +
        `Available: ${listChromeEffects().join(', ')}.`,
    );
  }

  // Captions overlay (mirrors buildGenerateHtml shape).
  const useTikTok = (tikTokPages?.length ?? 0) > 0;
  let overlayHtml = '';
  let overlayCss = '';
  let overlayScript = '';
  if (useTikTok) {
    overlayHtml = renderTikTokDivs(tikTokPages!);
    overlayCss = TIKTOK_CSS;
    overlayScript = renderTikTokScript(tikTokPages!, totalDurationMs);
  } else if (captions && captions.length > 0) {
    overlayHtml = captions
      .map(
        (c, i) =>
          `    <div class="caption" id="caption-${i}">${escapeText(c.text.trim())}</div>`,
      )
      .join('\n');
    overlayCss = CAPTION_CSS;
    overlayScript = renderCaptionScript(captions, totalDurationMs);
  }

  // Build the per-animation <script>. Keyframes are translated from
  // absolute ms to WAAPI offsets (0..1) inside the browser, not here —
  // simpler to serialise, and keeps the template code readable.
  const combinedPlans: Array<{
    selector: string;
    easing: string;
    keyframes: Array<{ atMs: number; props: Record<string, string | number> }>;
  }> = [];
  for (const p of animationPlans) {
    combinedPlans.push({
      selector: p.selector,
      easing: p.animation.easing ?? 'linear',
      keyframes: p.animation.keyframes.map((kf) => ({ atMs: kf.atMs, props: kf.props })),
    });
  }
  for (const p of effectAnimPlans) {
    combinedPlans.push({
      selector: p.selector,
      easing: p.animation.easing ?? 'linear',
      keyframes: p.animation.keyframes.map((kf) => ({ atMs: kf.atMs, props: kf.props })),
    });
  }
  const animsJson = JSON.stringify(combinedPlans);

  const audioTag =
    audioRelative && audioDurationMs
      ? `    <audio src="${escapeAttr(audioRelative)}" data-start="0" data-duration="${(audioDurationMs / 1000).toFixed(3)}"></audio>`
      : '';

  return `<!DOCTYPE html>
<html lang="zh-CN" data-rf-width="${width}" data-rf-height="${height}" data-rf-fps="${fps}" data-rf-duration="${(totalDurationMs / 1000).toFixed(3)}">
<head>
  <meta charset="utf-8">
  <title>${escapeText(docTitle)}</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: ${background}; font-family: ${fontFamilyBody}; overflow: hidden; }
    #stage { position: relative; width: 100vw; height: 100vh; overflow: hidden; }
    .slide { position: absolute; inset: 0; }
    .slide .title { font-family: ${fontFamilyHeading}; }
    .slide .subtitle { font-family: ${fontFamilyBody}; }
${cssParts.join('\n')}
${[...effectCssSet].join('\n')}
${overlayCss}
${styleExtraCss}
  </style>
</head>
<body>
  <div id="stage">
${parts.join('\n')}
${effectHtmlParts.join('\n')}
${overlayHtml}
${audioTag}
  </div>
  <script>
  (function () {
    var TOTAL = ${Math.max(1, Math.round(totalDurationMs))};
    var plans = ${animsJson};
    plans.forEach(function (plan) {
      var el = document.querySelector(plan.selector);
      if (!el) return;
      // Translate absolute-ms keyframes into WAAPI offset-based keyframes.
      var kfs = plan.keyframes.map(function (kf) {
        var offset = Math.max(0, Math.min(1, kf.atMs / TOTAL));
        return Object.assign({}, kf.props, { offset: offset });
      });
      // Ensure strictly monotonic offsets (WAAPI rejects equal-offset runs with different properties otherwise).
      var last = -1;
      kfs.forEach(function (kf) {
        if (kf.offset <= last) kf.offset = Math.min(1, last + 1e-6);
        last = kf.offset;
      });
      try {
        el.animate(kfs, { duration: TOTAL, fill: 'both', easing: plan.easing || 'linear' });
      } catch (e) { /* unsupported in env, fall through */ }
    });
  })();
  </script>${overlayScript}
</body>
</html>
`;
}

// Re-use the same caption scripts that buildGenerateHtml already ships.
// Kept private here so this file is self-contained.

const CAPTION_CSS = `
  .caption {
    position: absolute;
    left: 50%; bottom: 8vh;
    transform: translateX(-50%);
    max-width: 80vw;
    text-align: center;
    font-size: 36px; font-weight: 600;
    line-height: 1.3;
    color: #fff;
    background: rgba(0, 0, 0, 0.55);
    padding: 14px 28px;
    border-radius: 12px;
    opacity: 0;
    pointer-events: none;
    white-space: pre-wrap;
    z-index: 1000;
  }
`;

const TIKTOK_CSS = `
  .tt-page {
    position: absolute;
    left: 50%; bottom: 8vh;
    transform: translateX(-50%);
    max-width: 80vw;
    text-align: center;
    font-size: 44px; font-weight: 800;
    line-height: 1.25;
    color: rgba(255, 255, 255, 0.75);
    text-shadow: 0 3px 16px rgba(0,0,0,0.6);
    letter-spacing: -0.5px;
    opacity: 0;
    pointer-events: none;
    white-space: pre-wrap;
    z-index: 1000;
  }
  .tt-token {
    display: inline-block;
    color: rgba(255, 255, 255, 0.75);
  }
`;

function renderCaptionScript(captions: readonly Caption[], totalMs: number): string {
  const entries = captions
    .map(
      (c, i) =>
        `    {id:'caption-${i}',startMs:${Math.round(c.startMs)},endMs:${Math.round(c.endMs)}}`,
    )
    .join(',\n');
  const total = Math.max(1, Math.round(totalMs));
  const edge = 16;
  return `
  <script>
    (function () {
      var caps = [
${entries}
      ];
      var total = ${total};
      caps.forEach(function (c) {
        var el = document.getElementById(c.id);
        if (!el) return;
        var pre = Math.max(0, (c.startMs - ${edge}) / total);
        var on = c.startMs / total;
        var off = Math.min(1, (c.endMs) / total);
        var postOff = Math.min(1, (c.endMs + ${edge}) / total);
        el.animate([
          { opacity: 0, offset: 0 },
          { opacity: 0, offset: pre },
          { opacity: 1, offset: on },
          { opacity: 1, offset: off },
          { opacity: 0, offset: postOff },
          { opacity: 0, offset: 1 }
        ], { duration: total, fill: 'both', easing: 'linear' });
      });
    })();
  </script>`;
}

function renderTikTokDivs(pages: readonly TikTokPage[]): string {
  const lines: string[] = [];
  for (let p = 0; p < pages.length; p++) {
    const page = pages[p]!;
    lines.push(`    <div class="tt-page" id="tt-page-${p}">`);
    for (let t = 0; t < page.tokens.length; t++) {
      const tok = page.tokens[t]!;
      lines.push(
        `      <span class="tt-token" id="tt-token-${p}-${t}">${escapeText(tok.text)}</span>`,
      );
    }
    lines.push(`    </div>`);
  }
  return lines.join('\n');
}

function renderTikTokScript(pages: readonly TikTokPage[], totalMs: number): string {
  const total = Math.max(1, Math.round(totalMs));
  const edge = 16;
  const pageEntries: string[] = [];
  const tokenEntries: string[] = [];
  for (let p = 0; p < pages.length; p++) {
    const page = pages[p]!;
    pageEntries.push(
      `    {i:${p},s:${Math.round(page.startMs)},e:${Math.round(page.startMs + page.durationMs)}}`,
    );
    for (let t = 0; t < page.tokens.length; t++) {
      const tok = page.tokens[t]!;
      tokenEntries.push(
        `    {p:${p},t:${t},s:${Math.round(tok.fromMs)},e:${Math.round(tok.toMs)}}`,
      );
    }
  }
  return `
  <script>
    (function () {
      var total = ${total};
      var edge = ${edge};
      var baseColor = 'rgba(255,255,255,0.75)';
      var hiColor = '#ffe666';
      var pastColor = 'rgba(255,255,255,0.95)';
      var pages = [
${pageEntries.join(',\n')}
      ];
      var tokens = [
${tokenEntries.join(',\n')}
      ];
      pages.forEach(function (pg) {
        var el = document.getElementById('tt-page-' + pg.i);
        if (!el) return;
        var pre = Math.max(0, (pg.s - edge) / total);
        var on = pg.s / total;
        var off = Math.min(1, pg.e / total);
        var postOff = Math.min(1, (pg.e + edge) / total);
        el.animate([
          { opacity: 0, offset: 0 },
          { opacity: 0, offset: pre },
          { opacity: 1, offset: on },
          { opacity: 1, offset: off },
          { opacity: 0, offset: postOff },
          { opacity: 0, offset: 1 }
        ], { duration: total, fill: 'both', easing: 'linear' });
      });
      tokens.forEach(function (tk) {
        var el = document.getElementById('tt-token-' + tk.p + '-' + tk.t);
        if (!el) return;
        var preOn = Math.max(0, (tk.s - 1) / total);
        var on = tk.s / total;
        var off = tk.e / total;
        var postOff = Math.min(1, (tk.e + 1) / total);
        el.animate([
          { color: baseColor, offset: 0 },
          { color: baseColor, offset: preOn },
          { color: hiColor, offset: on },
          { color: hiColor, offset: off },
          { color: pastColor, offset: postOff },
          { color: pastColor, offset: 1 }
        ], { duration: total, fill: 'both', easing: 'linear' });
      });
    })();
  </script>`;
}
