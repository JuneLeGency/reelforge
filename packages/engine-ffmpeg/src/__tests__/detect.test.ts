import { describe, expect, test } from 'bun:test';
import type { VideoProject } from '@reelforge/ir';
import { canUseFastPath, explainFastPath } from '../detect';

const baseProject = (): VideoProject => ({
  version: '1',
  config: { width: 1280, height: 720, fps: 30 },
  assets: {
    a: { id: 'a', kind: 'image', source: { scheme: 'file', uri: 'a.jpg' } },
  },
  timeline: {
    tracks: [
      {
        id: 'main',
        kind: 'video',
        clips: [{ id: 'c0', assetRef: 'a', startMs: 0, durationMs: 2000 }],
      },
    ],
  },
});

describe('canUseFastPath', () => {
  test('accepts a trivial image project', () => {
    expect(canUseFastPath(baseProject())).toBe(true);
  });

  test('rejects when caption tracks exist', () => {
    const p = baseProject();
    p.captions = [{ id: 'c', language: 'en', captions: [] }];
    expect(canUseFastPath(p)).toBe(false);
    expect(explainFastPath(p)).toMatch(/caption tracks/);
  });

  test('rejects overlay track kind', () => {
    const p = baseProject();
    p.timeline.tracks.push({ id: 'ov', kind: 'overlay', clips: [] });
    expect(canUseFastPath(p)).toBe(false);
    expect(explainFastPath(p)).toMatch(/kind="overlay"/);
  });

  test('rejects clips with effects', () => {
    const p = baseProject();
    p.timeline.tracks[0]!.clips[0]!.effects = [{ name: 'ken-burns' }];
    expect(canUseFastPath(p)).toBe(false);
    expect(explainFastPath(p)).toMatch(/effects/);
  });

  test('rejects clips with transitions', () => {
    const p = baseProject();
    p.timeline.tracks[0]!.clips[0]!.transitionIn = {
      name: 'fade',
      durationMs: 500,
    };
    expect(canUseFastPath(p)).toBe(false);
    expect(explainFastPath(p)).toMatch(/transition/);
  });

  test('rejects non-media assets', () => {
    const p = baseProject();
    p.assets['t'] = {
      id: 't',
      kind: 'text',
      source: { scheme: 'file', uri: 'inline' },
      text: 'hello',
    };
    p.timeline.tracks[0]!.clips.push({
      id: 'c1',
      assetRef: 't',
      startMs: 2000,
      durationMs: 1000,
    });
    expect(canUseFastPath(p)).toBe(false);
    expect(explainFastPath(p)).toMatch(/kind="text"/);
  });

  test('accepts mixed image + audio', () => {
    const p = baseProject();
    p.assets['n'] = {
      id: 'n',
      kind: 'audio',
      source: { scheme: 'file', uri: 'n.mp3' },
      durationMs: 5000,
    };
    p.timeline.tracks.push({
      id: 'aud',
      kind: 'audio',
      clips: [{ id: 'c1', assetRef: 'n', startMs: 0, durationMs: 5000 }],
    });
    expect(canUseFastPath(p)).toBe(true);
    expect(explainFastPath(p)).toBeNull();
  });

  test('explainFastPath returns null for eligible projects', () => {
    expect(explainFastPath(baseProject())).toBeNull();
  });
});
