import { describe, expect, test } from 'bun:test';
import type { VideoProject } from '@reelforge/ir';
import { collectAudioClips, MuxError, resolveAssetPath } from '../resolve';

const makeProject = (): VideoProject => ({
  version: '1',
  config: { width: 1920, height: 1080, fps: 30 },
  assets: {
    narr: {
      id: 'narr',
      kind: 'audio',
      source: { scheme: 'file', uri: 'narr.mp3' },
      durationMs: 5000,
    },
    hero: {
      id: 'hero',
      kind: 'image',
      source: { scheme: 'file', uri: 'hero.jpg' },
    },
  },
  timeline: {
    tracks: [
      {
        id: 'v',
        kind: 'video',
        clips: [{ id: 'c0', assetRef: 'hero', startMs: 0, durationMs: 5000 }],
      },
      {
        id: 'a',
        kind: 'audio',
        clips: [
          { id: 'c1', assetRef: 'narr', startMs: 0, durationMs: 5000, volume: 0.9 },
        ],
      },
    ],
  },
});

describe('collectAudioClips', () => {
  test('returns only audio-track clips with resolved paths', () => {
    const project = makeProject();
    const resolved = collectAudioClips(project, '/base');
    expect(resolved).toHaveLength(1);
    expect(resolved[0]!.clip.id).toBe('c1');
    expect(resolved[0]!.filePath).toBe('/base/narr.mp3');
  });

  test('throws when asset on audio track is not audio kind', () => {
    const project = makeProject();
    // Point the audio clip at the image asset.
    project.timeline.tracks[1]!.clips[0]!.assetRef = 'hero';
    expect(() => collectAudioClips(project, '/base')).toThrow(MuxError);
  });

  test('throws on dangling assetRef', () => {
    const project = makeProject();
    project.timeline.tracks[1]!.clips[0]!.assetRef = 'nope';
    expect(() => collectAudioClips(project, '/base')).toThrow(MuxError);
  });

  test('empty audio track yields no clips', () => {
    const project = makeProject();
    project.timeline.tracks[1]!.clips = [];
    expect(collectAudioClips(project, '/base')).toEqual([]);
  });
});

describe('resolveAssetPath', () => {
  test('file scheme joins against baseDir', () => {
    expect(
      resolveAssetPath(
        { id: 'a', kind: 'image', source: { scheme: 'file', uri: 'sub/a.jpg' } },
        '/root',
      ),
    ).toBe('/root/sub/a.jpg');
  });

  test('url scheme passes through verbatim', () => {
    expect(
      resolveAssetPath(
        {
          id: 'a',
          kind: 'image',
          source: { scheme: 'url', uri: 'https://example.com/x.jpg' },
        },
        '/root',
      ),
    ).toBe('https://example.com/x.jpg');
  });

  test('unsupported schemes throw MuxError', () => {
    expect(() =>
      resolveAssetPath(
        { id: 'a', kind: 'image', source: { scheme: 's3', uri: 's3://bkt/k' } },
        '/root',
      ),
    ).toThrow(MuxError);
  });
});
