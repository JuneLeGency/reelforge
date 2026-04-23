/**
 * Slide template contract.
 *
 * Each template turns one declarative slide spec into:
 *   - a DOM fragment that lives in the timeline for [startMs, endMs]
 *   - a set of WAAPI animations keyed to the timeline's TOTAL duration
 *     so that engine-chrome's WAAPI adapter (which seeks currentTime per
 *     frame) plays them correctly at any scrub position
 *
 * The template is pure: given the same spec + timing + totalMs, it
 * returns the same HTML + animation JSON.
 */

export interface SlideSpec {
  /** Explicit slide index (used for stable DOM ids). Caller-assigned. */
  index: number;
  /** Timeline position in milliseconds. */
  startMs: number;
  endMs: number;
  /** Primary content. Templates pick what they render from these. */
  title?: string | undefined;
  subtitle?: string | undefined;
  image?: string | undefined;
  bullets?: readonly string[] | undefined;
  /** Free-form slots — templates may consume or ignore. */
  extras?: Readonly<Record<string, string | number | undefined>> | undefined;
  /**
   * Nested children for the `composite` template. One level deep only —
   * a child cannot itself have `children` (keeps selector / timing math
   * tractable). See CompositeChild for the per-child shape.
   */
  children?: readonly CompositeChild[] | undefined;
  /**
   * Grid layout preset for the `composite` template:
   *   'main-side'   — 2fr main + 1fr side (side split top/bottom)
   *   'tri-column'  — 3 equal columns (left / center / right)
   *   'hero-kpi'    — 60% main + 40% 2×2 kpi grid
   *   'dashboard-4' — 2×2 quadrants (top-left / top-right / bottom-left / bottom-right)
   *   'banner-grid' — top banner + 3 columns below (tri-feature)
   *   'custom'      — use extras.gridTemplate verbatim
   */
  layout?: string | undefined;
}

/**
 * One child in a composite layout. A child reuses any registered
 * template (hero-fade-up / chart-pie / social-follow / …) rendered into
 * one region of the parent slide's grid. Time is relative to the
 * parent's [startMs, endMs] window.
 */
export interface CompositeChild {
  /** Template name from SLIDE_TEMPLATES. */
  template: string;
  /**
   * Grid area name (must match the layout's template-areas) — see
   * SlideSpec.layout for the presets' area names. For 'custom', the
   * area value is whatever the author writes into extras.gridTemplate.
   */
  area?: string | undefined;
  /** ms offset from parent.startMs. Default 0. */
  startOffsetMs?: number | undefined;
  /** ms span. Default = parent duration minus startOffset. */
  durationMs?: number | undefined;
  /** Same slots a template consumes. */
  title?: string | undefined;
  subtitle?: string | undefined;
  image?: string | undefined;
  bullets?: readonly string[] | undefined;
  extras?: Readonly<Record<string, string | number | undefined>> | undefined;
}

/**
 * Every template emits a self-contained DOM subtree (a single outer
 * element) plus zero or more animation descriptors. The caller is
 * responsible for:
 *   - wrapping every animation's offset against the composition's
 *     TOTAL duration (templates work in absolute ms — the runtime does
 *     the division);
 *   - inserting `html` into the stage in source order.
 */
export interface SlideRenderOutput {
  /** Exactly one top-level DOM element. */
  html: string;
  /** One entry per element.animate() call. */
  animations: SlideAnimation[];
  /** CSS the template relies on. Caller can dedupe per template family. */
  css: string;
}

export interface SlideAnimation {
  /** CSS selector scoped to the slide's root (e.g. ".title", ".accent"). */
  selector: string;
  /** Keyframes in absolute ms (not ratio). */
  keyframes: SlideKeyframe[];
  /** Easing applied to the animation as a whole. */
  easing?: string;
}

export interface SlideKeyframe {
  /** Timeline-absolute ms where this keyframe applies. */
  atMs: number;
  /** CSS properties. Numeric values are honoured as-is. */
  props: Record<string, string | number>;
}

export type SlideTemplate = (spec: SlideSpec) => SlideRenderOutput;
