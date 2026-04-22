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
