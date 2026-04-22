import { resolve as resolvePath } from 'node:path';
import type {
  Asset,
  Clip,
  ImageAsset,
  Track,
  VideoAsset,
  VideoProject,
} from '@reelforge/ir';
import { planDuration } from '@reelforge/ir';

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
}

export class FastPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FastPathError';
  }
}

const DEFAULT_BG = 'black';

/**
 * Build the ffmpeg input list + filter_complex graph for a fast-path render.
 * Only the *video* half is produced here; audio is left to @reelforge/mux
 * (same pipeline the Chrome engine uses).
 */
export function buildFastPathArgs(project: VideoProject, baseDir: string): FastPathArgs {
  const { width, height, fps } = project.config;
  const durationMs = planDuration(project);
  const durationSec = durationMs / 1000;

  const inputs: FastPathInput[] = [];
  const filterLines: string[] = [];
  const overlayChains: { label: string; startSec: number; endSec: number }[] = [];
  let hasVisual = false;

  const videoTracks: Track[] = project.timeline.tracks.filter((t) => t.kind === 'video');

  // Flatten all visual clips in timeline order.
  const visualClips = videoTracks
    .flatMap((t) => t.clips)
    .sort((a, b) => a.startMs - b.startMs);

  for (const clip of visualClips) {
    const asset = project.assets[clip.assetRef];
    if (!asset) throw new FastPathError(`clip "${clip.id}" references missing asset`);

    if (asset.kind === 'image') {
      const idx = inputs.length;
      const startSec = toSec(clip.startMs);
      const endSec = toSec(clip.startMs + clip.durationMs);
      const durSec = toSec(clip.durationMs);
      // `-loop 1 -t <sec>` turns a single image file into a video stream of
      // that duration. setpts shifts the stream to its timeline position so
      // overlay+enable can gate it precisely without tpad-induced black flashes.
      inputs.push({
        path: assetPath(asset, baseDir),
        preInputArgs: ['-loop', '1', '-t', durSec.toFixed(3)],
      });
      const label = `v${idx}`;
      filterLines.push(
        `[${idx}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
          `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=${DEFAULT_BG},` +
          `setsar=1,format=yuv420p,fps=${fps},` +
          `setpts=PTS-STARTPTS+${startSec.toFixed(3)}/TB[${label}]`,
      );
      overlayChains.push({ label, startSec, endSec });
      hasVisual = true;
    } else if (asset.kind === 'video') {
      const idx = inputs.length;
      const startSec = toSec(clip.startMs);
      const endSec = toSec(clip.startMs + clip.durationMs);
      const durSec = toSec(clip.durationMs);
      const sourceStart = toSec(clip.sourceStartMs ?? 0);
      inputs.push({ path: assetPath(asset, baseDir), preInputArgs: [] });
      const label = `v${idx}`;
      filterLines.push(
        `[${idx}:v]trim=start=${sourceStart.toFixed(3)}:duration=${durSec.toFixed(3)},setpts=PTS-STARTPTS,` +
          `scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
          `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=${DEFAULT_BG},` +
          `setsar=1,format=yuv420p,fps=${fps},` +
          `setpts=PTS+${startSec.toFixed(3)}/TB[${label}]`,
      );
      overlayChains.push({ label, startSec, endSec });
      hasVisual = true;
    } else if (asset.kind === 'audio') {
      // Audio-only clips are handled by the mux step; skip here.
      continue;
    }
  }

  if (!hasVisual) {
    // No visual content — synthesise a blank canvas for the full duration so the
    // final mp4 is still a valid video stream.
    const label = 'bg';
    filterLines.push(
      `color=c=${DEFAULT_BG}:s=${width}x${height}:r=${fps}:d=${durationSec.toFixed(3)}[${label}]`,
    );
    overlayChains.push({ label, startSec: 0, endSec: durationSec });
  }

  // Compose overlays on a blank base. Each overlay is gated with
  // `enable='between(t,start,end)'` so the clip only paints during its own
  // window — no tpad black flashes crossing into the next clip.
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

// Keep the unused generics happy with the IR discriminators so future edits
// that add a new kind get an exhaustive-check hint.
type _FastAssetGuard = ImageAsset | VideoAsset;
type _FastClipGuard = Clip;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _Reserve = _FastAssetGuard | _FastClipGuard;
