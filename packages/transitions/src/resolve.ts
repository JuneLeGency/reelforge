import type { TransitionSpec } from '@reelforge/ir';
import { ALIAS_TO_XFADE } from './catalog';
import { isXFadeName, XFADE_TRANSITIONS, type XFadeName } from './xfade';

export interface ResolvedTransition {
  kind: 'xfade';
  /** ffmpeg xfade transition name, drop-in for `transition=<xfade>`. */
  xfade: XFadeName;
  /** Duration in milliseconds, preserved from the IR for overlap math. */
  durationMs: number;
  /** Easing hint propagated from the IR; xfade has its own implicit curve so this is advisory. */
  easing?: string | undefined;
}

export class TransitionResolveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransitionResolveError';
  }
}

/**
 * Translate an IR `TransitionSpec` into a concrete executable. Throws
 * `TransitionResolveError` on unknown names so engines can report the bad
 * value instead of emitting a filter graph ffmpeg will reject later.
 *
 * Rules:
 *   - `name === 'none'` returns null (caller skips the transition step).
 *   - Curated aliases (`fade`, `wipe-left`, …) map via ALIAS_TO_XFADE.
 *   - `xfade:<raw>` passes the raw xfade name through after validating it.
 *   - Anything else → error.
 */
export function resolveTransition(spec: TransitionSpec): ResolvedTransition | null {
  if (!spec || !spec.name || spec.name === 'none') return null;
  if (!Number.isFinite(spec.durationMs) || spec.durationMs <= 0) {
    throw new TransitionResolveError(
      `transition "${spec.name}" has non-positive durationMs`,
    );
  }

  const name = spec.name.toLowerCase();

  // Raw xfade passthrough: `xfade:fadeblack`, `xfade:wipeleft`, …
  if (name.startsWith('xfade:')) {
    const raw = name.slice('xfade:'.length);
    if (!isXFadeName(raw)) {
      throw new TransitionResolveError(
        `xfade passthrough "${raw}" is not in the built-in catalog (see XFADE_TRANSITIONS)`,
      );
    }
    return {
      kind: 'xfade',
      xfade: raw,
      durationMs: spec.durationMs,
      ...(spec.easing !== undefined ? { easing: spec.easing } : {}),
    };
  }

  // Curated alias.
  const mapped = ALIAS_TO_XFADE[name];
  if (mapped) {
    return {
      kind: 'xfade',
      xfade: mapped,
      durationMs: spec.durationMs,
      ...(spec.easing !== undefined ? { easing: spec.easing } : {}),
    };
  }

  // Last-chance: user may have typed the raw xfade name without the
  // `xfade:` prefix ("fade", "fadeblack" already handled; "wipeleft"
  // uncommonly typed without a prefix).
  if (isXFadeName(name)) {
    return {
      kind: 'xfade',
      xfade: name,
      durationMs: spec.durationMs,
      ...(spec.easing !== undefined ? { easing: spec.easing } : {}),
    };
  }

  throw new TransitionResolveError(
    `Unknown transition "${spec.name}". Try one of: ${[...Object.keys(ALIAS_TO_XFADE), ...XFADE_TRANSITIONS.map((x) => `xfade:${x}`)].slice(0, 12).join(', ')}, …`,
  );
}

/**
 * Build the `xfade` filter string for two clip streams that overlap by
 * the transition's duration.
 *
 *   inA --(xfade@offset+transitionDuration, mode=name, dur)--> out
 *
 * Offsets are in seconds (ffmpeg filter convention). Callers compose the
 * filter into `filter_complex` along with the actual stream labels.
 */
export function buildXFadeExpr(transition: ResolvedTransition, offsetSec: number): string {
  const durSec = transition.durationMs / 1000;
  return `xfade=transition=${transition.xfade}:duration=${durSec.toFixed(3)}:offset=${offsetSec.toFixed(3)}`;
}
