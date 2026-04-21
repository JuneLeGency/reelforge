import { describe, expect, test } from 'bun:test';
import {
  IR_VERSION,
  VideoProjectValidationError,
  collectAssetRefs,
  parse,
  planDuration,
  safeParse,
  type VideoProject,
} from '../index';

const minimalProject: VideoProject = {
  version: IR_VERSION,
  config: { width: 1920, height: 1080, fps: 30 },
  assets: {
    'img-hero': {
      id: 'img-hero',
      kind: 'image',
      source: { scheme: 'file', uri: './hero.jpg' },
    },
  },
  timeline: {
    tracks: [
      {
        id: 'main',
        kind: 'video',
        clips: [
          {
            id: 'c0',
            assetRef: 'img-hero',
            startMs: 0,
            durationMs: 5000,
          },
        ],
      },
    ],
  },
};

describe('parse / safeParse', () => {
  test('accepts a minimal valid project', () => {
    const parsed = parse(minimalProject);
    expect(parsed.version).toBe('1');
    expect(parsed.timeline.tracks).toHaveLength(1);
  });

  test('safeParse returns success tag for valid input', () => {
    const result = safeParse(minimalProject);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.assets['img-hero']?.kind).toBe('image');
    }
  });

  test('rejects missing required fields', () => {
    const bad = { version: '1', config: { width: 1920 } };
    expect(() => parse(bad)).toThrow(VideoProjectValidationError);
  });

  test('rejects wrong version literal', () => {
    const bad = { ...minimalProject, version: '2' };
    const result = safeParse(bad);
    expect(result.success).toBe(false);
  });

  test('rejects dangling assetRef with integrity error', () => {
    const bad: VideoProject = {
      ...minimalProject,
      timeline: {
        tracks: [
          {
            id: 'main',
            kind: 'video',
            clips: [
              {
                id: 'c0',
                assetRef: 'does-not-exist',
                startMs: 0,
                durationMs: 1000,
              },
            ],
          },
        ],
      },
    };
    const result = safeParse(bad);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toHaveLength(1);
      const issue = result.error.issues[0]! as { path: string; message: string };
      expect(issue.path).toContain('assetRef');
      expect(issue.message).toContain('does-not-exist');
    }
  });

  test('rejects dangling effect library reference', () => {
    const bad: VideoProject = {
      ...minimalProject,
      timeline: {
        tracks: [
          {
            id: 'main',
            kind: 'video',
            clips: [
              {
                id: 'c0',
                assetRef: 'img-hero',
                startMs: 0,
                durationMs: 1000,
                effects: ['unknown-effect'],
              },
            ],
          },
        ],
      },
    };
    const result = safeParse(bad);
    expect(result.success).toBe(false);
  });

  test('accepts inline effect spec without library', () => {
    const p: VideoProject = {
      ...minimalProject,
      timeline: {
        tracks: [
          {
            id: 'main',
            kind: 'video',
            clips: [
              {
                id: 'c0',
                assetRef: 'img-hero',
                startMs: 0,
                durationMs: 1000,
                effects: [{ name: 'ken-burns', params: { zoom: 1.1 } }],
              },
            ],
          },
        ],
      },
    };
    expect(() => parse(p)).not.toThrow();
  });

  test('rejects clip with durationMs <= 0', () => {
    const bad: VideoProject = {
      ...minimalProject,
      timeline: {
        tracks: [
          {
            id: 'main',
            kind: 'video',
            clips: [
              {
                id: 'c0',
                assetRef: 'img-hero',
                startMs: 0,
                durationMs: 0,
              },
            ],
          },
        ],
      },
    };
    expect(() => parse(bad)).toThrow(VideoProjectValidationError);
  });
});

describe('planDuration', () => {
  test('uses explicit config.duration when present', () => {
    expect(planDuration({ ...minimalProject, config: { ...minimalProject.config, duration: 10 } }))
      .toBe(10_000);
  });

  test('derives from latest clip end when no explicit duration', () => {
    const p: VideoProject = {
      ...minimalProject,
      timeline: {
        tracks: [
          {
            id: 't1',
            kind: 'video',
            clips: [
              { id: 'a', assetRef: 'img-hero', startMs: 0, durationMs: 3000 },
              { id: 'b', assetRef: 'img-hero', startMs: 2000, durationMs: 6000 },
            ],
          },
        ],
      },
    };
    expect(planDuration(p)).toBe(8000);
  });

  test('returns 0 for empty clip arrays (schema still allows this per-track)', () => {
    const p: VideoProject = {
      ...minimalProject,
      timeline: { tracks: [{ id: 'empty', kind: 'video', clips: [] }] },
    };
    expect(planDuration(p)).toBe(0);
  });
});

describe('collectAssetRefs', () => {
  test('collects unique asset ids across tracks', () => {
    const p: VideoProject = {
      ...minimalProject,
      assets: {
        'img-a': { id: 'img-a', kind: 'image', source: { scheme: 'file', uri: 'a.jpg' } },
        'img-b': { id: 'img-b', kind: 'image', source: { scheme: 'file', uri: 'b.jpg' } },
        aud: {
          id: 'aud',
          kind: 'audio',
          source: { scheme: 'file', uri: 'n.mp3' },
          durationMs: 10_000,
        },
      },
      timeline: {
        tracks: [
          {
            id: 'v',
            kind: 'video',
            clips: [
              { id: 'c1', assetRef: 'img-a', startMs: 0, durationMs: 1000 },
              { id: 'c2', assetRef: 'img-a', startMs: 1000, durationMs: 1000 },
              { id: 'c3', assetRef: 'img-b', startMs: 2000, durationMs: 1000 },
            ],
          },
          {
            id: 'a',
            kind: 'audio',
            clips: [{ id: 'c4', assetRef: 'aud', startMs: 0, durationMs: 3000 }],
          },
        ],
      },
    };
    const refs = collectAssetRefs(p);
    expect(refs).toEqual(new Set(['img-a', 'img-b', 'aud']));
  });
});
