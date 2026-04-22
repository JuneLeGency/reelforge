import type { VideoProject } from '@reelforge/ir';
import { resolveTransition, TransitionResolveError } from '@reelforge/transitions';

/**
 * Return `true` when the project is simple enough for the pure-ffmpeg
 * fast path — no Chrome required.
 *
 * A project is fast-path eligible when:
 * - Every referenced asset is `image`, `video`, or `audio`.
 * - There are no caption tracks (those imply DOM rendering).
 * - Every track is `video` or `audio` (no `caption` / `overlay` tracks).
 * - No clip declares `effects` (would need a DOM or shader layer).
 * - Any `transitionIn` / `transitionOut` resolves to an `xfade` built-in
 *   (via `@reelforge/transitions`). Unknown transition names disqualify.
 */
export function canUseFastPath(project: VideoProject): boolean {
  return explainFastPath(project) === null;
}

/**
 * Human-readable reason the project was rejected by canUseFastPath.
 * Returns `null` when the project *is* fast-path eligible.
 */
export function explainFastPath(project: VideoProject): string | null {
  if (project.captions && project.captions.length > 0) {
    return 'project has caption tracks (DOM captions required)';
  }
  for (const track of project.timeline.tracks) {
    if (track.kind !== 'video' && track.kind !== 'audio') {
      return `track "${track.id}" is kind="${track.kind}" — only video/audio tracks are fast-path eligible`;
    }
    for (const clip of track.clips) {
      if (clip.effects && clip.effects.length > 0) {
        return `clip "${clip.id}" has effects[] — DOM/shader layer required`;
      }
      for (const key of ['transitionIn', 'transitionOut'] as const) {
        const t = clip[key];
        if (t === undefined) continue;
        if (typeof t === 'string') {
          return `clip "${clip.id}" has a named transition ref "${t}" — inline TransitionSpec required for fast path`;
        }
        try {
          resolveTransition(t);
        } catch (err) {
          if (err instanceof TransitionResolveError) {
            return `clip "${clip.id}" ${key}: ${err.message}`;
          }
          throw err;
        }
      }
      const asset = project.assets[clip.assetRef];
      if (!asset) return `clip "${clip.id}" references missing asset "${clip.assetRef}"`;
      if (asset.kind !== 'image' && asset.kind !== 'video' && asset.kind !== 'audio') {
        return `asset "${asset.id}" is kind="${asset.kind}" — fast path only supports image/video/audio`;
      }
    }
  }
  return null;
}
