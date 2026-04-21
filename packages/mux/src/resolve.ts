import { resolve as resolvePath } from 'node:path';
import type { Asset, AudioAsset, Clip, VideoProject } from '@reelforge/ir';

export interface ResolvedAudioClip {
  clip: Clip;
  asset: AudioAsset;
  filePath: string;
}

export class MuxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MuxError';
  }
}

/**
 * Collect audio-track clips whose asset is an AudioAsset and resolve the
 * on-disk (or URL) path that ffmpeg can consume.
 */
export function collectAudioClips(
  project: VideoProject,
  baseDir: string,
): ResolvedAudioClip[] {
  const results: ResolvedAudioClip[] = [];
  for (const track of project.timeline.tracks) {
    if (track.kind !== 'audio') continue;
    for (const clip of track.clips) {
      const asset = project.assets[clip.assetRef];
      if (!asset) {
        throw new MuxError(`audio clip references missing asset "${clip.assetRef}"`);
      }
      if (asset.kind !== 'audio') {
        throw new MuxError(
          `asset "${clip.assetRef}" on audio track is ${asset.kind}, expected audio`,
        );
      }
      results.push({
        clip,
        asset,
        filePath: resolveAssetPath(asset, baseDir),
      });
    }
  }
  return results;
}

export function resolveAssetPath(asset: Asset, baseDir: string): string {
  const { source } = asset;
  switch (source.scheme) {
    case 'file':
      return resolvePath(baseDir, source.uri);
    case 'url':
      return source.uri;
    default:
      throw new MuxError(
        `asset "${asset.id}" uses unsupported source scheme "${source.scheme}" for local ffmpeg; fetch to file:// first`,
      );
  }
}
