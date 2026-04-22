/**
 * Chrome-path transition effects.
 *
 * Unlike the ffmpeg `xfade` filter (which composites two encoded
 * streams with a GPU-side transition), Chrome-path effects are
 * overlay layers painted on top of the live DOM composition. They
 * use CSS + WAAPI only — no WebGL texture pipeline — so they
 * compose cleanly with the rest of our library-clock setup.
 *
 * Trade-off: we can't do true gl-transitions visuals (e.g. ripple,
 * displace) because those need both source frames as textures. The
 * effects here are the subset that read well as stateless overlays.
 *
 * An effect emits:
 *   - CSS that the composition injects once per referenced effect
 *   - a short-lived HTML overlay keyed to one transition event
 *   - WAAPI animations whose timeline is the full composition (the
 *     caller converts atMs → offset at render time, same as slides)
 */

export interface ChromeEffectContext {
  /** Stable id derived from the transition event index. */
  id: string;
  /** Center point of the transition on the composition timeline, in ms. */
  atMs: number;
  /** Visible duration of the effect, in ms. */
  durationMs: number;
  /** Full composition duration, in ms (for WAAPI offset math). */
  totalDurationMs: number;
}

export interface ChromeEffectAnimation {
  selector: string;
  keyframes: Array<{ atMs: number; props: Record<string, string | number> }>;
  easing?: string;
}

export interface ChromeEffectOutput {
  html: string;
  animations: ChromeEffectAnimation[];
}

export interface ChromeEffect {
  name: string;
  description: string;
  /** Injected once into the composition's <style> (caller dedupes). */
  css: string;
  emit(ctx: ChromeEffectContext): ChromeEffectOutput;
}

/**
 * Build the boilerplate "overlay pulse" keyframes. The overlay is
 * invisible before and after the transition window — only the
 * center of the window peaks at opacity 1.
 */
function pulseOverlayKeyframes(ctx: ChromeEffectContext) {
  const half = ctx.durationMs / 2;
  const inStart = Math.max(0, ctx.atMs - half);
  const peak = ctx.atMs;
  const outEnd = Math.min(ctx.totalDurationMs, ctx.atMs + half);
  return [
    { atMs: 0, props: { opacity: 0 } },
    { atMs: Math.max(0, inStart - 1), props: { opacity: 0 } },
    { atMs: peak, props: { opacity: 1 } },
    { atMs: outEnd, props: { opacity: 0 } },
  ];
}

const FLASH_WHITE: ChromeEffect = {
  name: 'flash-white',
  description:
    'Brief full-screen white flash centered on the transition moment. Good for chapter breaks / emphasis cuts.',
  css: `
  .rf-fx-flash {
    position: absolute; inset: 0;
    pointer-events: none;
    opacity: 0;
    z-index: 900;
    mix-blend-mode: screen;
  }
  .rf-fx-flash.white { background: #ffffff; }
  .rf-fx-flash.black {
    background: #000000;
    mix-blend-mode: normal;
  }
  `,
  emit(ctx) {
    const id = `fx-${ctx.id}`;
    return {
      html: `<div id="${id}" class="rf-fx-flash white"></div>`,
      animations: [
        {
          selector: `#${id}`,
          easing: 'cubic-bezier(.4,0,.2,1)',
          keyframes: pulseOverlayKeyframes(ctx),
        },
      ],
    };
  },
};

const FLASH_BLACK: ChromeEffect = {
  name: 'flash-black',
  description:
    'Brief full-screen black pulse. Reads as a "blink cut" between scenes — works well for dramatic breaks.',
  css: FLASH_WHITE.css, // shared .rf-fx-flash rules
  emit(ctx) {
    const id = `fx-${ctx.id}`;
    return {
      html: `<div id="${id}" class="rf-fx-flash black"></div>`,
      animations: [
        {
          selector: `#${id}`,
          easing: 'cubic-bezier(.4,0,.2,1)',
          keyframes: pulseOverlayKeyframes(ctx),
        },
      ],
    };
  },
};

const WIPE_SWEEP: ChromeEffect = {
  name: 'wipe-sweep',
  description:
    'Angled black panel sweeps across the screen, with the scene cut happening under the middle of the sweep.',
  css: `
  .rf-fx-wipe-sweep {
    position: absolute;
    top: -20%; left: 0;
    width: 120%; height: 140%;
    background: linear-gradient(100deg, transparent 0%, #0a0a0f 12%, #0a0a0f 88%, transparent 100%);
    pointer-events: none;
    z-index: 900;
    transform: translateX(-120%) rotate(0deg);
    will-change: transform;
  }
  `,
  emit(ctx) {
    const half = ctx.durationMs / 2;
    const inStart = Math.max(0, ctx.atMs - half);
    const center = ctx.atMs;
    const outEnd = Math.min(ctx.totalDurationMs, ctx.atMs + half);
    const id = `fx-${ctx.id}`;
    return {
      html: `<div id="${id}" class="rf-fx-wipe-sweep"></div>`,
      animations: [
        {
          selector: `#${id}`,
          easing: 'cubic-bezier(.55,0,.45,1)',
          keyframes: [
            { atMs: 0, props: { transform: 'translateX(-120%)' } },
            { atMs: Math.max(0, inStart - 1), props: { transform: 'translateX(-120%)' } },
            { atMs: center, props: { transform: 'translateX(0%)' } },
            { atMs: outEnd, props: { transform: 'translateX(120%)' } },
          ],
        },
      ],
    };
  },
};

const RADIAL_PULSE: ChromeEffect = {
  name: 'radial-pulse',
  description:
    'A bright radial gradient blooms from the center at the cut point and fades away. Subtle, reads as a "beat".',
  css: `
  .rf-fx-radial-pulse {
    position: absolute; inset: 0;
    background: radial-gradient(circle at 50% 50%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.0) 55%);
    pointer-events: none;
    z-index: 900;
    opacity: 0;
    transform: scale(0.4);
    transform-origin: center center;
    mix-blend-mode: screen;
  }
  `,
  emit(ctx) {
    const half = ctx.durationMs / 2;
    const inStart = Math.max(0, ctx.atMs - half);
    const center = ctx.atMs;
    const outEnd = Math.min(ctx.totalDurationMs, ctx.atMs + half);
    const id = `fx-${ctx.id}`;
    return {
      html: `<div id="${id}" class="rf-fx-radial-pulse"></div>`,
      animations: [
        {
          selector: `#${id}`,
          easing: 'cubic-bezier(.22,.9,.32,1)',
          keyframes: [
            { atMs: 0, props: { opacity: 0, transform: 'scale(0.4)' } },
            {
              atMs: Math.max(0, inStart - 1),
              props: { opacity: 0, transform: 'scale(0.4)' },
            },
            { atMs: center, props: { opacity: 1, transform: 'scale(1)' } },
            { atMs: outEnd, props: { opacity: 0, transform: 'scale(1.4)' } },
          ],
        },
      ],
    };
  },
};

export const CHROME_EFFECTS: Readonly<Record<string, ChromeEffect>> = {
  'flash-white': FLASH_WHITE,
  'flash-black': FLASH_BLACK,
  'wipe-sweep': WIPE_SWEEP,
  'radial-pulse': RADIAL_PULSE,
};

export function resolveChromeEffect(name: string | undefined): ChromeEffect | null {
  if (!name) return null;
  return CHROME_EFFECTS[name] ?? null;
}

export function listChromeEffects(): string[] {
  return Object.keys(CHROME_EFFECTS);
}
