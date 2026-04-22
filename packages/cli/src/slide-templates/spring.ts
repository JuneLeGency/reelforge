import type { SlideAnimation, SlideKeyframe } from './types';

/**
 * Spring easing support.
 *
 * WAAPI's `easing` only accepts CSS timing functions (linear, ease,
 * cubic-bezier, steps) — none of which can overshoot. To get spring
 * motion ("bounce", "overshoot") we pre-sample the spring physics into
 * N intermediate linear keyframes, then feed the denser keyframes to
 * the browser with `easing: 'linear'`. Visually indistinguishable from
 * a live spring when N is ~20.
 *
 * Usage from templates:
 *   animations: [{
 *     selector: '...',
 *     easing: 'spring-bouncy',           // or 'spring-soft', 'spring-stiff'
 *     keyframes: [...]
 *   }]
 *
 * renderTemplatedComposition detects the spring-* name and calls
 * `expandSpringAnimation(anim)` before serialising.
 *
 * Presets are tuned empirically:
 *   - spring-soft   low tension, moderate friction — a gentle settle
 *   - spring-bouncy moderate tension, low friction — visible overshoot
 *   - spring-stiff  high tension, high friction    — snappy, no overshoot
 */
export interface SpringConfig {
  /** Stiffness (N/m). Higher = snappier. */
  tension: number;
  /** Damping (Ns/m). Higher = less oscillation. */
  friction: number;
  /** Mass (kg). Kept at 1 in all presets. */
  mass?: number;
}

export const SPRING_PRESETS: Readonly<Record<string, SpringConfig>> = {
  'spring-soft': { tension: 120, friction: 18 },
  'spring-bouncy': { tension: 220, friction: 12 },
  'spring-stiff': { tension: 340, friction: 26 },
};

export function isSpringEasingName(name: string | undefined): boolean {
  return !!name && name in SPRING_PRESETS;
}

export function resolveSpringConfig(name: string): SpringConfig | null {
  return SPRING_PRESETS[name] ?? null;
}

/**
 * Integrate the damped harmonic oscillator from 0 → 1 over a unit
 * normalized domain, returning N+1 samples. Semi-implicit Euler with
 * substepping for stability at high tension.
 *
 * The returned array has length `samples + 1`; samples[0] === 0, and
 * samples may overshoot 1 before settling (that's the whole point).
 */
export function sampleSpring(
  config: SpringConfig,
  samples: number,
): number[] {
  const { tension, friction, mass = 1 } = config;
  const substeps = 8;
  const totalSteps = samples * substeps;
  const dt = 1 / totalSteps;
  const target = 1;
  let pos = 0;
  let vel = 0;
  const out: number[] = [0]; // t=0 → value 0
  for (let i = 1; i <= totalSteps; i++) {
    const displacement = pos - target;
    const springForce = -tension * displacement;
    const dampingForce = -friction * vel;
    const accel = (springForce + dampingForce) / mass;
    vel += accel * dt;
    pos += vel * dt;
    if (i % substeps === 0) out.push(pos);
  }
  return out;
}

/**
 * Parse a transform string into its component functions, keeping the
 * numeric value and unit so we can interpolate each axis independently.
 * Returns null for anything we can't cleanly parse — callers then fall
 * back to a non-interpolated behavior (e.g. skip this pair of kfs).
 *
 * Supported: single-argument CSS transform functions like
 *   translateX(10px), translateY(-4px), scale(0.95), scaleX(1),
 *   scaleY(1), rotate(12deg), rotateZ(-8deg)
 * Comma-separated multi-arg transforms (translate(10px,20px), scale(0.5,0.8))
 * are intentionally NOT supported — templates in this codebase don't use them.
 */
export interface TransformFunc {
  fn: string;
  value: number;
  unit: string;
}

export function parseTransform(s: string): TransformFunc[] | null {
  const trimmed = s.trim();
  if (trimmed === '' || trimmed === 'none') return [];
  const re = /([a-zA-Z]+)\(\s*([^)]+?)\s*\)/g;
  const out: TransformFunc[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(trimmed)) !== null) {
    const fn = match[1]!;
    const inner = match[2]!.trim();
    // Reject multi-arg (comma) for now.
    if (inner.includes(',')) return null;
    const numMatch = inner.match(/^(-?\d+(?:\.\d+)?)\s*([a-zA-Z%]*)$/);
    if (!numMatch) return null;
    out.push({
      fn,
      value: Number.parseFloat(numMatch[1]!),
      unit: numMatch[2] ?? '',
    });
  }
  // Ensure we consumed essentially the whole string (minus whitespace).
  const meaningful = trimmed.replace(/\s+/g, '');
  const outStr = out.map((f) => `${f.fn}(${f.value}${f.unit})`).join('');
  if (meaningful !== outStr.replace(/\s+/g, '')) return null;
  return out;
}

export function serializeTransform(funcs: readonly TransformFunc[]): string {
  return funcs.map((f) => `${f.fn}(${formatNum(f.value)}${f.unit})`).join(' ');
}

function formatNum(n: number): string {
  if (Number.isInteger(n)) return String(n);
  // 3 decimal places keeps sub-pixel smoothness without bloating JSON.
  return n.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

/**
 * Linearly interpolate two scalar values at t ∈ [0..1].
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Given two transform function lists (from / to), blend them by
 * position using spring-shaped progress `p` (which overshoots 0..1).
 * Only works when from / to have identical fn sequences.
 */
function blendTransforms(
  from: readonly TransformFunc[],
  to: readonly TransformFunc[],
  p: number,
): TransformFunc[] | null {
  if (from.length !== to.length) return null;
  const out: TransformFunc[] = [];
  for (let i = 0; i < from.length; i++) {
    const a = from[i]!;
    const b = to[i]!;
    if (a.fn !== b.fn) return null;
    const unit = a.unit || b.unit;
    out.push({ fn: a.fn, unit, value: lerp(a.value, b.value, p) });
  }
  return out;
}

/**
 * Expand a spring animation into dense linear keyframes. Between each
 * pair of source keyframes we insert `samplesPerSegment` interpolated
 * keyframes with spring-shaped progress.
 *
 * If any segment's props can't be cleanly interpolated (e.g. mixed
 * transform function signatures across from/to), we keep the segment
 * as-is (linear from kf[i] to kf[i+1]) rather than error out —
 * preserving backward-compatible behavior.
 */
export function expandSpringAnimation(
  anim: SlideAnimation,
  samplesPerSegment = 16,
): SlideAnimation {
  if (!anim.easing || !isSpringEasingName(anim.easing)) return anim;
  const cfg = resolveSpringConfig(anim.easing)!;
  const progress = sampleSpring(cfg, samplesPerSegment);
  // progress has length samplesPerSegment + 1, values 0..(~1, may overshoot)

  const src = anim.keyframes;
  if (src.length < 2) return { ...anim, easing: 'linear' };

  const out: SlideKeyframe[] = [src[0]!];
  for (let i = 0; i < src.length - 1; i++) {
    const from = src[i]!;
    const to = src[i + 1]!;
    const segment = sampleSegment(from, to, progress);
    if (segment === null) {
      // Non-interpolatable segment: fall back to linear (just push `to`).
      out.push(to);
      continue;
    }
    for (let s = 1; s <= samplesPerSegment; s++) {
      out.push(segment[s]!);
    }
  }

  return {
    selector: anim.selector,
    keyframes: out,
    easing: 'linear',
  };
}

/**
 * Sample between two keyframes using the spring-shaped progress curve.
 * Each output slot s corresponds to time lerp(from.atMs, to.atMs, s/N)
 * with prop values blended by progress[s].
 */
function sampleSegment(
  from: SlideKeyframe,
  to: SlideKeyframe,
  progress: readonly number[],
): SlideKeyframe[] | null {
  const N = progress.length - 1;
  const out: SlideKeyframe[] = [];
  for (let s = 0; s <= N; s++) {
    const timeT = s / N;
    const atMs = lerp(from.atMs, to.atMs, timeT);
    const p = progress[s]!;
    const blended = blendProps(from.props, to.props, p);
    if (blended === null) return null;
    out.push({ atMs, props: blended });
  }
  return out;
}

function blendProps(
  fromProps: Record<string, string | number>,
  toProps: Record<string, string | number>,
  p: number,
): Record<string, string | number> | null {
  const keys = new Set([...Object.keys(fromProps), ...Object.keys(toProps)]);
  const out: Record<string, string | number> = {};
  for (const k of keys) {
    const a = fromProps[k];
    const b = toProps[k];
    // Missing on one side: use whichever exists (no interpolation).
    if (a === undefined) {
      if (b === undefined) continue;
      out[k] = b;
      continue;
    }
    if (b === undefined) {
      out[k] = a;
      continue;
    }
    // Numeric
    if (typeof a === 'number' && typeof b === 'number') {
      out[k] = lerp(a, b, p);
      continue;
    }
    // Transform: parse both sides.
    if (k === 'transform' && typeof a === 'string' && typeof b === 'string') {
      const fa = parseTransform(a);
      const fb = parseTransform(b);
      if (!fa || !fb) return null;
      const blended = blendTransforms(fa, fb, p);
      if (!blended) return null;
      out[k] = serializeTransform(blended);
      continue;
    }
    // Same string → pass through.
    if (a === b) {
      out[k] = a;
      continue;
    }
    // Can't interpolate string → number mix or mismatched strings.
    return null;
  }
  return out;
}

export function listSpringPresetNames(): string[] {
  return Object.keys(SPRING_PRESETS);
}
