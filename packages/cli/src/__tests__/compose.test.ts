import { describe, expect, test } from 'bun:test';
import {
  ComposeConfigError,
  buildConcatList,
  parseComposeConfig,
} from '../commands/compose';

describe('parseComposeConfig', () => {
  test('accepts a minimal config with one scene', () => {
    const c = parseComposeConfig({
      scenes: [{ config: 'scene1.json' }],
    });
    expect(c.scenes).toHaveLength(1);
    expect(c.scenes[0]!.config).toBe('scene1.json');
  });

  test('propagates per-scene overrides', () => {
    const c = parseComposeConfig({
      scenes: [
        {
          config: 'scene1.json',
          audio: './a.mp3',
          timings: './a.srt',
          template: 'ken-burns-zoom',
          style: 'swiss-pulse',
        },
      ],
    });
    expect(c.scenes[0]).toMatchObject({
      config: 'scene1.json',
      audio: './a.mp3',
      timings: './a.srt',
      template: 'ken-burns-zoom',
      style: 'swiss-pulse',
    });
  });

  test('rejects non-object top level', () => {
    expect(() => parseComposeConfig(null)).toThrow(ComposeConfigError);
    expect(() => parseComposeConfig([])).toThrow(ComposeConfigError);
    expect(() => parseComposeConfig('hi')).toThrow(ComposeConfigError);
  });

  test('rejects empty or missing scenes array', () => {
    expect(() => parseComposeConfig({})).toThrow(/scenes must be a non-empty array/);
    expect(() => parseComposeConfig({ scenes: [] })).toThrow(
      /scenes must be a non-empty array/,
    );
  });

  test('rejects wrong-typed scene entry', () => {
    expect(() => parseComposeConfig({ scenes: ['not-object'] })).toThrow(
      /scenes\[0\] must be an object/,
    );
    expect(() =>
      parseComposeConfig({ scenes: [{ config: 123 }] }),
    ).toThrow(/scenes\[0\]\.config must be a non-empty string/);
    expect(() =>
      parseComposeConfig({ scenes: [{ config: '' }] }),
    ).toThrow(/non-empty string/);
  });

  test('rejects wrong-typed override fields', () => {
    expect(() =>
      parseComposeConfig({
        scenes: [{ config: 's.json', audio: 42 }],
      }),
    ).toThrow(/audio must be a string/);
    expect(() =>
      parseComposeConfig({
        scenes: [{ config: 's.json', style: { name: 'not-a-string' } }],
      }),
    ).toThrow(/style must be a string/);
  });

  test('drops empty-string overrides rather than treating them as "present"', () => {
    const c = parseComposeConfig({
      scenes: [{ config: 's.json', audio: '' }],
    });
    expect(c.scenes[0]!.audio).toBeUndefined();
  });
});

describe('buildConcatList', () => {
  test('emits one `file` line per path with LF separators', () => {
    const list = buildConcatList(['/tmp/a.mp4', '/tmp/b.mp4']);
    expect(list).toBe("file '/tmp/a.mp4'\nfile '/tmp/b.mp4'\n");
  });

  test('quote-escapes single quotes in paths', () => {
    const list = buildConcatList(["/tmp/it's.mp4"]);
    expect(list).toBe("file '/tmp/it'\\''s.mp4'\n");
  });

  test('emits an empty-but-LF-terminated body for zero paths', () => {
    expect(buildConcatList([])).toBe('\n');
  });
});
