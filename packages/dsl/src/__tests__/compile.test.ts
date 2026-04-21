import { describe, expect, test } from 'bun:test';
import { compileDsl } from '../index';

describe('compileDsl', () => {
  test('produces a validated VideoProject via the html frontend', () => {
    const result = compileDsl(
      {
        config: { width: 1280, height: 720, fps: 30 },
        clips: [
          {
            duration: 3,
            layers: [{ type: 'image', src: './hero.jpg', fit: 'cover' }],
          },
        ],
      },
      { baseDir: '/base' },
    );
    expect(result.project.version).toBe('1');
    expect(result.project.config).toEqual({
      width: 1280,
      height: 720,
      fps: 30,
      duration: 3,
    });
    expect(Object.keys(result.project.assets)).toHaveLength(1);
    expect(result.project.timeline.tracks[0]!.clips).toHaveLength(1);
    expect(result.totalDurationMs).toBe(3000);
  });

  test('audio tracks appear on a separate audio track in the IR', () => {
    const result = compileDsl(
      {
        clips: [
          { duration: 3, layers: [{ type: 'image', src: 'a.jpg' }] },
        ],
        audio: [{ src: './music.mp3', volume: 0.5 }],
      },
      { baseDir: '/base' },
    );
    expect(result.project.timeline.tracks).toHaveLength(2);
    const audioTrack = result.project.timeline.tracks[1]!;
    expect(audioTrack.kind).toBe('audio');
    expect(audioTrack.clips[0]!.volume).toBe(0.5);
  });
});
