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

const RGB_SPLIT: ChromeEffect = {
  name: 'rgb-split',
  description:
    'Chromatic-aberration-style colour channel split. Two tinted overlay bands (magenta + cyan) flash briefly in opposite offsets, blended over the scene.',
  css: `
  .rf-fx-rgb-split {
    position: absolute; inset: 0;
    pointer-events: none;
    z-index: 900;
  }
  .rf-fx-rgb-split .rgb-layer {
    position: absolute; inset: 0;
    mix-blend-mode: screen;
    opacity: 0;
  }
  .rf-fx-rgb-split .rgb-layer.mag { background: rgba(255, 0, 102, 0.55); }
  .rf-fx-rgb-split .rgb-layer.cy  { background: rgba(0, 204, 255, 0.55); }
  `,
  emit(ctx) {
    const half = ctx.durationMs / 2;
    const inStart = Math.max(0, ctx.atMs - half);
    const peak = ctx.atMs;
    const outEnd = Math.min(ctx.totalDurationMs, ctx.atMs + half);
    const id = `fx-${ctx.id}`;
    const kf = (props: Record<string, string | number>) => ({ atMs: peak, props });
    const build = (offset: number, side: 'mag' | 'cy') => [
      {
        atMs: 0,
        props: { opacity: 0, transform: `translateX(${side === 'mag' ? -offset : offset}px)` },
      },
      {
        atMs: Math.max(0, inStart - 1),
        props: { opacity: 0, transform: `translateX(${side === 'mag' ? -offset : offset}px)` },
      },
      kf({ opacity: 1, transform: `translateX(${side === 'mag' ? -offset : offset}px)` }),
      {
        atMs: outEnd,
        props: { opacity: 0, transform: `translateX(0px)` },
      },
    ];
    return {
      html: `<div id="${id}" class="rf-fx-rgb-split">
  <div class="rgb-layer mag"></div>
  <div class="rgb-layer cy"></div>
</div>`,
      animations: [
        { selector: `#${id} .rgb-layer.mag`, easing: 'cubic-bezier(.4,0,.2,1)', keyframes: build(6, 'mag') },
        { selector: `#${id} .rgb-layer.cy`, easing: 'cubic-bezier(.4,0,.2,1)', keyframes: build(6, 'cy') },
      ],
    };
  },
};

/**
 * The data URI below is an inline SVG with feTurbulence to generate
 * pseudo-noise. Browsers sample it as a seamless tile; we use it as a
 * background-image for a mix-blend overlay to produce film grain.
 */
const FILM_GRAIN_NOISE_URI =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.55'/></svg>";

const FILM_GRAIN: ChromeEffect = {
  name: 'film-grain',
  description:
    'Analog film grain noise overlay. Useful as a "dirt" layer between scenes, or to add texture to a moment.',
  css: `
  .rf-fx-film-grain {
    position: absolute; inset: 0;
    pointer-events: none;
    z-index: 900;
    background-image: url("${FILM_GRAIN_NOISE_URI}");
    background-size: 200px 200px;
    mix-blend-mode: overlay;
    opacity: 0;
  }
  `,
  emit(ctx) {
    const id = `fx-${ctx.id}`;
    return {
      html: `<div id="${id}" class="rf-fx-film-grain"></div>`,
      animations: [
        {
          selector: `#${id}`,
          easing: 'linear',
          keyframes: pulseOverlayKeyframes(ctx),
        },
      ],
    };
  },
};

const SCANLINES: ChromeEffect = {
  name: 'scanlines',
  description:
    'Horizontal scan-line overlay that fades in and out. CRT / retro feel; pairs naturally with terminal-green style.',
  css: `
  .rf-fx-scanlines {
    position: absolute; inset: 0;
    pointer-events: none;
    z-index: 900;
    background: repeating-linear-gradient(
      0deg,
      rgba(0, 0, 0, 0.32) 0px,
      rgba(0, 0, 0, 0.32) 1px,
      transparent 2px,
      transparent 4px
    );
    opacity: 0;
    mix-blend-mode: multiply;
  }
  `,
  emit(ctx) {
    const id = `fx-${ctx.id}`;
    return {
      html: `<div id="${id}" class="rf-fx-scanlines"></div>`,
      animations: [
        {
          selector: `#${id}`,
          easing: 'linear',
          keyframes: pulseOverlayKeyframes(ctx),
        },
      ],
    };
  },
};

const GLITCH_CRACK: ChromeEffect = {
  name: 'glitch-crack',
  description:
    'Horizontal colour-band glitch. Two thin magenta + cyan bars flash at mid-screen, with a brief scanline flicker.',
  css: `
  .rf-fx-glitch-crack {
    position: absolute; inset: 0;
    pointer-events: none;
    z-index: 900;
    opacity: 0;
  }
  .rf-fx-glitch-crack::before,
  .rf-fx-glitch-crack::after {
    content: "";
    position: absolute; left: 0; right: 0;
    height: 6%;
    mix-blend-mode: screen;
  }
  .rf-fx-glitch-crack::before {
    top: 28%;
    background: rgba(255, 0, 102, 0.85);
  }
  .rf-fx-glitch-crack::after {
    top: 60%;
    background: rgba(0, 204, 255, 0.85);
  }
  `,
  emit(ctx) {
    const half = ctx.durationMs / 2;
    const inStart = Math.max(0, ctx.atMs - half);
    const peak = ctx.atMs;
    const outEnd = Math.min(ctx.totalDurationMs, ctx.atMs + half);
    const id = `fx-${ctx.id}`;
    return {
      html: `<div id="${id}" class="rf-fx-glitch-crack"></div>`,
      animations: [
        {
          selector: `#${id}`,
          easing: 'steps(4, end)',
          keyframes: [
            { atMs: 0, props: { opacity: 0 } },
            { atMs: Math.max(0, inStart - 1), props: { opacity: 0 } },
            { atMs: peak, props: { opacity: 1 } },
            { atMs: outEnd, props: { opacity: 0 } },
          ],
        },
      ],
    };
  },
};

const SHAKE: ChromeEffect = {
  name: 'shake',
  description:
    'Short camera-shake applied to the entire stage. Reads as "impact". Uses #stage transform; side-effect: captions shake too (intended).',
  css: `
  /* No CSS needed — animation drives #stage transform directly. */
  `,
  emit(ctx) {
    // Shake doesn't use an overlay; it perturbs #stage.
    // HTML is empty; the animation selector is #stage.
    const half = ctx.durationMs / 2;
    const inStart = Math.max(0, ctx.atMs - half);
    const peak = ctx.atMs;
    const outEnd = Math.min(ctx.totalDurationMs, ctx.atMs + half);
    // Uniform sampling of 7 steps between inStart and outEnd, with
    // pseudo-random offsets that sum to ~0 so the stage comes back.
    const stops = [
      { t: 0, dx: 0, dy: 0 },
      { t: 0.15, dx: 6, dy: -3 },
      { t: 0.3, dx: -5, dy: 4 },
      { t: 0.5, dx: 4, dy: -5 },
      { t: 0.65, dx: -6, dy: 2 },
      { t: 0.85, dx: 3, dy: 3 },
      { t: 1.0, dx: 0, dy: 0 },
    ];
    const keyframes = stops.map(({ t, dx, dy }) => ({
      atMs: inStart + (outEnd - inStart) * t,
      props: { transform: `translate(${dx}px, ${dy}px)` },
    }));
    // Clamp the peak marker to actual peak time for clarity.
    if (keyframes.length > 0 && keyframes[0]) keyframes[0].atMs = Math.max(0, inStart - 1);
    // Prepend a t=0 resting frame.
    keyframes.unshift({ atMs: 0, props: { transform: 'translate(0px, 0px)' } });
    // Keep peak implicit (the middle step lands near ctx.atMs).
    void peak;
    return {
      html: '',
      animations: [
        {
          selector: '#stage',
          easing: 'linear',
          keyframes,
        },
      ],
    };
  },
};

const ZOOM_BLUR: ChromeEffect = {
  name: 'zoom-blur',
  description:
    'Impact zoom + blur applied to #stage. Short duration (200–350 ms) reads as an emphasis hit. Side-effect: blurs captions for the duration (intended).',
  css: `
  /* Animation drives #stage filter + transform directly. */
  `,
  emit(ctx) {
    const half = ctx.durationMs / 2;
    const inStart = Math.max(0, ctx.atMs - half);
    const peak = ctx.atMs;
    const outEnd = Math.min(ctx.totalDurationMs, ctx.atMs + half);
    return {
      html: '',
      animations: [
        {
          selector: '#stage',
          easing: 'cubic-bezier(.4,0,.2,1)',
          keyframes: [
            { atMs: 0, props: { filter: 'blur(0px)', transform: 'scale(1)' } },
            {
              atMs: Math.max(0, inStart - 1),
              props: { filter: 'blur(0px)', transform: 'scale(1)' },
            },
            { atMs: peak, props: { filter: 'blur(7px)', transform: 'scale(1.06)' } },
            { atMs: outEnd, props: { filter: 'blur(0px)', transform: 'scale(1)' } },
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
  'rgb-split': RGB_SPLIT,
  'film-grain': FILM_GRAIN,
  'scanlines': SCANLINES,
  'glitch-crack': GLITCH_CRACK,
  'shake': SHAKE,
  'zoom-blur': ZOOM_BLUR,
};

export function resolveChromeEffect(name: string | undefined): ChromeEffect | null {
  if (!name) return null;
  return CHROME_EFFECTS[name] ?? null;
}

export function listChromeEffects(): string[] {
  return Object.keys(CHROME_EFFECTS);
}
