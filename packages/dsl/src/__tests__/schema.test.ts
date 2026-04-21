import { describe, expect, test } from 'bun:test';
import { DslError, parseDsl } from '../index';

describe('parseDsl', () => {
  test('accepts a minimal config', () => {
    const project = parseDsl({
      clips: [
        { duration: 3, layers: [{ type: 'image', src: 'a.jpg' }] },
      ],
    });
    expect(project.clips).toHaveLength(1);
    expect(project.clips[0]!.duration).toBe(3);
    expect(project.clips[0]!.layers[0]).toEqual({ type: 'image', src: 'a.jpg' });
  });

  test('rejects missing clips array', () => {
    expect(() => parseDsl({})).toThrow(DslError);
  });

  test('rejects empty clips', () => {
    expect(() => parseDsl({ clips: [] })).toThrow(DslError);
  });

  test('rejects non-positive clip duration', () => {
    expect(() =>
      parseDsl({ clips: [{ duration: 0, layers: [{ type: 'image', src: 'a.jpg' }] }] }),
    ).toThrow(DslError);
  });

  test('rejects invalid layer type', () => {
    expect(() =>
      parseDsl({ clips: [{ duration: 1, layers: [{ type: 'unknown' }] }] }),
    ).toThrow(/is not supported/);
  });

  test('title layer with style and entrance', () => {
    const project = parseDsl({
      clips: [
        {
          duration: 2,
          layers: [
            {
              type: 'title',
              text: 'Hi',
              style: { color: '#fff', fontSize: 96, position: 'top' },
              entrance: 'slide-up',
            },
          ],
        },
      ],
    });
    const layer = project.clips[0]!.layers[0]! as {
      type: 'title';
      style?: { color?: string; fontSize?: number; position?: string };
      entrance?: string;
    };
    expect(layer.style?.color).toBe('#fff');
    expect(layer.style?.fontSize).toBe(96);
    expect(layer.style?.position).toBe('top');
    expect(layer.entrance).toBe('slide-up');
  });

  test('audio layer volume and top-level audio track', () => {
    const project = parseDsl({
      clips: [{ duration: 2, layers: [{ type: 'audio', src: 'a.mp3', volume: 0.5 }] }],
      audio: [{ src: 'b.mp3', volume: 0.3, start: 1, duration: 4 }],
    });
    expect(project.clips[0]!.layers[0]).toEqual({ type: 'audio', src: 'a.mp3', volume: 0.5 });
    expect(project.audio).toEqual([{ src: 'b.mp3', volume: 0.3, start: 1, duration: 4 }]);
  });

  test('config and defaults pass through', () => {
    const project = parseDsl({
      config: { width: 1080, height: 1920, fps: 30, background: '#000' },
      defaults: { transition: 'fade', duration: 4 },
      clips: [{ duration: 3, layers: [{ type: 'image', src: 'a.jpg' }] }],
    });
    expect(project.config).toEqual({ width: 1080, height: 1920, fps: 30, background: '#000' });
    expect(project.defaults).toEqual({ transition: 'fade', duration: 4 });
  });

  test('rejects unknown transition value', () => {
    expect(() =>
      parseDsl({
        clips: [
          { duration: 1, transition: 'dissolve', layers: [{ type: 'image', src: 'a.jpg' }] },
        ],
      }),
    ).toThrow(DslError);
  });

  test('rejects wrong-type fields with clear path', () => {
    try {
      parseDsl({ clips: [{ duration: '3s', layers: [{ type: 'image', src: 'a.jpg' }] }] });
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(DslError);
      expect((e as Error).message).toContain('duration');
    }
  });
});
