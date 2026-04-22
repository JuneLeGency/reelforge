import { resolve as resolvePath } from 'node:path';
import type {
  Asset,
  Clip,
  ImageAsset,
  Track,
  TransitionRef,
  VideoAsset,
  VideoProject,
} from '@reelforge/ir';
import { planDuration } from '@reelforge/ir';
import { resolveTransition, type ResolvedTransition } from '@reelforge/transitions';

export interface FastPathInput {
  path: string;
  /** Extra flags to place immediately before `-i <path>` (e.g. `-loop 1 -t 3`). */
  preInputArgs: string[];
}

export interface FastPathArgs {
  inputs: FastPathInput[];
  filterComplex: string;
  videoOutLabel: string;
  /** Frame width / height / fps propagated to the output encoder. */
  width: number;
  height: number;
  fps: number;
  /** Total output duration in seconds (so audio mux / final trim knows the length). */
  durationSec: number;
  /** True when at least one video-kind clip was input — keeps the -map wiring honest. */
  hasVisual: boolean;
  /** True when the visual graph is a pure xfade chain (no base+overlay). */
  xfadeChain: boolean;
}

export class FastPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FastPathError';
  }
}

const DEFAULT_BG = 'black';

interface ClipPlan {
  clip: Clip;
  asset: ImageAsset | VideoAsset;
  startSec: number;
  endSec: number;
  durSec: number;
}

/**
 * Build the ffmpeg input list + filter_complex graph for a fast-path render.
 * Only the *video* half is produced here; audio is left to @reelforge/mux
 * (same pipeline the Chrome engine uses).
 *
 * Two graph shapes:
 *
 * 1. **xfade chain** — used when every clip abuts its neighbour (no gaps)
 *    AND every pair of adjacent clips shares a resolvable transition (either
 *    on the outgoing clip's `transitionOut` or the incoming clip's
 *    `transitionIn`). Emits:
 *
 *    ```
 *    [0:v]scale…fps → [v0]
 *    [1:v]scale…fps → [v1]
 *    [v0][v1] xfade=transition=fade:duration=0.5:offset=1.5 → [x1]
 *    [x1][v2] xfade=… → [vout]
 *    ```
 *
 *    Each clip stream starts at time 0 (no setpts shift); ffmpeg's xfade
 *    handles timing via its `offset` parameter.
 *
 * 2. **overlay + enable** — the original fallback: each clip is setpts-shifted
 *    onto its timeline position and overlaid onto a black base canvas with
 *    `enable='between(t,start,end)'`. Robust for non-abutting clips or clips
 *    without transitions.
 */
export function buildFastPathArgs(project: VideoProject, baseDir: string): FastPathArgs {
  const { width, height, fps } = project.config;
  const durationMs = planDuration(project);
  const durationSec = durationMs / 1000;

  const videoTracks: Track[] = project.timeline.tracks.filter((t) => t.kind === 'video');
  const visualClips = videoTracks
    .flatMap((t) => t.clips)
    .sort((a, b) => a.startMs - b.startMs);

  const plans: ClipPlan[] = [];
  for (const clip of visualClips) {
    const asset = project.assets[clip.assetRef];
    if (!asset) throw new FastPathError(`clip "${clip.id}" references missing asset`);
    if (asset.kind === 'audio') continue;
    if (asset.kind !== 'image' && asset.kind !== 'video') {
      throw new FastPathError(
        `clip "${clip.id}" asset kind "${asset.kind}" unsupported in fast path`,
      );
    }
    plans.push({
      clip,
      asset,
      startSec: toSec(clip.startMs),
      endSec: toSec(clip.startMs + clip.durationMs),
      durSec: toSec(clip.durationMs),
    });
  }

  const transitions = collectChainTransitions(plans);
  const useXFade = transitions !== null && plans.length >= 2;

  if (useXFade) {
    return buildXFadeGraph(plans, transitions!, { width, height, fps, baseDir, durationSec });
  }

  return buildOverlayGraph(plans, { width, height, fps, baseDir, durationSec });
}

/**
 * Inspect the plan list and decide whether we can build an xfade chain.
 * Returns the resolved per-boundary transition array on success, or `null`
 * if any pair is incompatible (gap between clips, no transition, or an
 * unresolvable name).
 */
function collectChainTransitions(plans: readonly ClipPlan[]): ResolvedTransition[] | null {
  if (plans.length < 2) return null;
  const out: ResolvedTransition[] = [];
  for (let i = 0; i < plans.length - 1; i++) {
    const a = plans[i]!;
    const b = plans[i + 1]!;
    // Only tolerate a 1 ms rounding gap; anything larger breaks the chain.
    if (Math.abs(a.endSec - b.startSec) > 0.001) return null;
    const spec = pickTransitionSpec(a.clip.transitionOut) ?? pickTransitionSpec(b.clip.transitionIn);
    if (!spec) return null;
    try {
      const resolved = resolveTransition(spec);
      if (!resolved) return null;
      // The transition can't be longer than either clip — clamp to the
      // shorter of {a.durSec, b.durSec} so offsets don't go negative.
      const maxSec = Math.min(a.durSec, b.durSec);
      if (resolved.durationMs / 1000 > maxSec) {
        resolved.durationMs = Math.max(1, Math.round(maxSec * 1000));
      }
      out.push(resolved);
    } catch {
      return null;
    }
  }
  return out;
}

function pickTransitionSpec(
  ref: TransitionRef | undefined,
):
  | { name: string; durationMs: number; easing?: string | undefined }
  | null {
  if (!ref) return null;
  if (typeof ref === 'string') return null; // Library refs require lookup; caller fell through to overlay path.
  return ref;
}

interface GraphCtx {
  width: number;
  height: number;
  fps: number;
  baseDir: string;
  durationSec: number;
}

function buildXFadeGraph(
  plans: readonly ClipPlan[],
  transitions: readonly ResolvedTransition[],
  ctx: GraphCtx,
): FastPathArgs {
  const { width, height, fps, baseDir, durationSec } = ctx;
  const inputs: FastPathInput[] = [];
  const filterLines: string[] = [];
  const streamLabels: string[] = [];

  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i]!;
    const idx = inputs.length;
    const label = `v${idx}`;
    streamLabels.push(label);
    if (plan.asset.kind === 'image') {
      inputs.push({
        path: assetPath(plan.asset, baseDir),
        preInputArgs: ['-loop', '1', '-t', plan.durSec.toFixed(3)],
      });
      filterLines.push(
        `[${idx}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
          `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=${DEFAULT_BG},` +
          `setsar=1,format=yuv420p,fps=${fps},setpts=PTS-STARTPTS[${label}]`,
      );
    } else {
      // video
      const sourceStart = toSec(plan.clip.sourceStartMs ?? 0);
      inputs.push({ path: assetPath(plan.asset, baseDir), preInputArgs: [] });
      filterLines.push(
        `[${idx}:v]trim=start=${sourceStart.toFixed(3)}:duration=${plan.durSec.toFixed(3)},setpts=PTS-STARTPTS,` +
          `scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
          `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=${DEFAULT_BG},` +
          `setsar=1,format=yuv420p,fps=${fps}[${label}]`,
      );
    }
  }

  // Chain xfades: out_i = xfade(out_{i-1}, v_{i+1}, dur_i, offset_i)
  // offset is measured from the start of out_{i-1} — that's cumulative
  // (up to and including clip i) minus the transition's duration.
  let previous = streamLabels[0]!;
  let accumulatedSec = plans[0]!.durSec;
  for (let i = 0; i < transitions.length; i++) {
    const next = streamLabels[i + 1]!;
    const transition = transitions[i]!;
    const dur = transition.durationMs / 1000;
    const offsetSec = accumulatedSec - dur;
    const out = i === transitions.length - 1 ? 'vout' : `x${i}`;
    filterLines.push(
      `[${previous}][${next}]xfade=transition=${transition.xfade}:duration=${dur.toFixed(3)}:offset=${offsetSec.toFixed(3)}[${out}]`,
    );
    previous = out;
    accumulatedSec += plans[i + 1]!.durSec - dur;
  }

  return {
    inputs,
    filterComplex: filterLines.join(';'),
    videoOutLabel: 'vout',
    width,
    height,
    fps,
    durationSec,
    hasVisual: true,
    xfadeChain: true,
  };
}

function buildOverlayGraph(plans: readonly ClipPlan[], ctx: GraphCtx): FastPathArgs {
  const { width, height, fps, baseDir, durationSec } = ctx;
  const inputs: FastPathInput[] = [];
  const filterLines: string[] = [];
  const overlayChains: { label: string; startSec: number; endSec: number }[] = [];
  let hasVisual = false;

  for (const plan of plans) {
    const idx = inputs.length;
    const label = `v${idx}`;
    if (plan.asset.kind === 'image') {
      inputs.push({
        path: assetPath(plan.asset, baseDir),
        preInputArgs: ['-loop', '1', '-t', plan.durSec.toFixed(3)],
      });
      filterLines.push(
        `[${idx}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
          `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=${DEFAULT_BG},` +
          `setsar=1,format=yuv420p,fps=${fps},` +
          `setpts=PTS-STARTPTS+${plan.startSec.toFixed(3)}/TB[${label}]`,
      );
    } else {
      const sourceStart = toSec(plan.clip.sourceStartMs ?? 0);
      inputs.push({ path: assetPath(plan.asset, baseDir), preInputArgs: [] });
      filterLines.push(
        `[${idx}:v]trim=start=${sourceStart.toFixed(3)}:duration=${plan.durSec.toFixed(3)},setpts=PTS-STARTPTS,` +
          `scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
          `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=${DEFAULT_BG},` +
          `setsar=1,format=yuv420p,fps=${fps},` +
          `setpts=PTS+${plan.startSec.toFixed(3)}/TB[${label}]`,
      );
    }
    overlayChains.push({ label, startSec: plan.startSec, endSec: plan.endSec });
    hasVisual = true;
  }

  if (!hasVisual) {
    const label = 'bg';
    filterLines.push(
      `color=c=${DEFAULT_BG}:s=${width}x${height}:r=${fps}:d=${durationSec.toFixed(3)}[${label}]`,
    );
    overlayChains.push({ label, startSec: 0, endSec: durationSec });
  }

  const baseLabel = 'base';
  filterLines.push(
    `color=c=${DEFAULT_BG}:s=${width}x${height}:r=${fps}:d=${durationSec.toFixed(3)}[${baseLabel}]`,
  );
  let currentLabel = baseLabel;
  for (let i = 0; i < overlayChains.length; i++) {
    const { label, startSec, endSec } = overlayChains[i]!;
    const out = i === overlayChains.length - 1 ? 'vout' : `o${i}`;
    const enable = `between(t,${startSec.toFixed(3)},${endSec.toFixed(3)})`;
    filterLines.push(
      `[${currentLabel}][${label}]overlay=shortest=0:enable='${enable}'[${out}]`,
    );
    currentLabel = out;
  }
  const videoOutLabel = overlayChains.length === 0 ? baseLabel : 'vout';

  return {
    inputs,
    filterComplex: filterLines.join(';'),
    videoOutLabel,
    width,
    height,
    fps,
    durationSec,
    hasVisual,
    xfadeChain: false,
  };
}

/**
 * Full ffmpeg argv for a silent fast-path render.
 */
export function buildFastPathFfmpegArgs(
  args: FastPathArgs,
  outputPath: string,
): string[] {
  const argv: string[] = [
    '-y',
    '-hide_banner',
    '-loglevel',
    'warning',
  ];
  for (const input of args.inputs) {
    for (const arg of input.preInputArgs) argv.push(arg);
    argv.push('-i', input.path);
  }
  argv.push('-filter_complex', args.filterComplex);
  argv.push('-map', `[${args.videoOutLabel}]`);
  argv.push('-an');
  argv.push('-t', args.durationSec.toFixed(3));
  argv.push('-pix_fmt', 'yuv420p');
  argv.push('-c:v', 'libx264');
  argv.push('-preset', 'veryfast');
  argv.push('-movflags', '+faststart');
  argv.push(outputPath);
  return argv;
}

function assetPath(asset: Asset, baseDir: string): string {
  const { source } = asset;
  if (source.scheme === 'file') return resolvePath(baseDir, source.uri);
  if (source.scheme === 'url') return source.uri;
  throw new FastPathError(
    `asset "${asset.id}" uses unsupported source scheme "${source.scheme}" in fast path`,
  );
}

function toSec(ms: number): number {
  return ms / 1000;
}
