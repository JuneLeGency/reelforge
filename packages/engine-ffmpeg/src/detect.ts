import type { VideoProject } from '@reelforge/ir';

/**
 * Return `true` when the project is simple enough for the pure-ffmpeg
 * fast path — no Chrome required.
 *
 * A project is fast-path eligible when:
 * - Every referenced asset is `image`, `video`, or `audio`.
 * - There are no caption tracks (those imply DOM rendering).
 * - Every track is `video` or `audio` (no `caption` / `overlay` tracks).
 * - No clip declares `effects` (would need a DOM or shader layer).
 * - No clip declares `transitionIn` / `transitionOut` (xfade support lands later).
 */
export function canUseFastPath(project: VideoProject): boolean {
  if (project.captions && project.captions.length > 0) return false;

  for (const track of project.timeline.tracks) {
    if (track.kind !== 'video' && track.kind !== 'audio') return false;
    for (const clip of track.clips) {
      if (clip.effects && clip.effects.length > 0) return false;
      if (clip.transitionIn !== undefined) return false;
      if (clip.transitionOut !== undefined) return false;
      const asset = project.assets[clip.assetRef];
      if (!asset) return false;
      if (asset.kind !== 'image' && asset.kind !== 'video' && asset.kind !== 'audio') {
        return false;
      }
    }
  }
  return true;
}

/**
 * Human-readable reason the project was rejected by canUseFastPath.
 * Returns `null` when the project *is* fast-path eligible.
 */
export function explainFastPath(project: VideoProject): string | null {
  if (canUseFastPath(project)) return null;

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
      if (clip.transitionIn !== undefined || clip.transitionOut !== undefined) {
        return `clip "${clip.id}" has a transition — xfade support not yet wired`;
      }
      const asset = project.assets[clip.assetRef];
      if (!asset) return `clip "${clip.id}" references missing asset "${clip.assetRef}"`;
      if (asset.kind !== 'image' && asset.kind !== 'video' && asset.kind !== 'audio') {
        return `asset "${asset.id}" is kind="${asset.kind}" — fast path only supports image/video/audio`;
      }
    }
  }
  return 'unknown';
}
