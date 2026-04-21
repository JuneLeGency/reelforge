import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  rfCompileDsl,
  rfCompileDslInline,
  rfCompileHtml,
  rfPlanDuration,
} from '../tools';

let workdir: string;

beforeAll(async () => {
  workdir = await mkdtemp(join(tmpdir(), 'rf-mcp-'));
});
afterAll(async () => {
  await rm(workdir, { recursive: true, force: true });
});

describe('rfCompileHtml', () => {
  test('compiles a trivial HTML composition into IR', async () => {
    const htmlPath = join(workdir, 'basic.html');
    await writeFile(
      htmlPath,
      `<html data-rf-width="1280" data-rf-height="720" data-rf-fps="30">
  <body>
    <img src="./a.jpg" data-start="0" data-duration="2" data-fit="cover">
  </body>
</html>`,
    );
    const out = await rfCompileHtml({ path: htmlPath });
    expect(out.project.version).toBe('1');
    expect(out.project.config).toMatchObject({ width: 1280, height: 720, fps: 30 });
    expect(out.durationMs).toBe(2000);
    expect(Object.keys(out.project.assets)).toHaveLength(1);
  });

  test('rejects empty path', async () => {
    await expect(rfCompileHtml({ path: '' })).rejects.toThrow(/non-empty/);
  });
});

describe('rfCompileDsl + rfCompileDslInline', () => {
  test('file path works and produces IR + totalDurationMs', async () => {
    const cfgPath = join(workdir, 'dsl.json5');
    await writeFile(
      cfgPath,
      `{
        config: { width: 1280, height: 720, fps: 30 },
        clips: [
          { duration: 2, layers: [{ type: 'image', src: './a.jpg' }] },
          { duration: 3, layers: [{ type: 'image', src: './b.jpg' }] }
        ]
      }`,
    );
    const out = await rfCompileDsl({ path: cfgPath });
    expect(out.durationMs).toBe(5000);
    expect(out.project.timeline.tracks[0]!.clips).toHaveLength(2);
  });

  test('inline JSON5 compiles directly', async () => {
    const out = await rfCompileDslInline({
      json5: `{ clips: [{ duration: 1, layers: [{ type: 'image', src: 'x.jpg' }] }] }`,
      baseDir: workdir,
    });
    expect(out.durationMs).toBe(1000);
  });

  test('inline compile surfaces DSL errors as exceptions', async () => {
    await expect(
      rfCompileDslInline({ json5: `{ clips: [] }` }),
    ).rejects.toThrow(/non-empty/);
  });
});

describe('rfPlanDuration', () => {
  test('returns config.duration when present', () => {
    const result = rfPlanDuration({
      project: {
        version: '1',
        config: { width: 1, height: 1, fps: 30, duration: 4 },
        assets: {},
        timeline: { tracks: [{ id: 'v', kind: 'video', clips: [] }] },
      },
    });
    expect(result.durationMs).toBe(4000);
  });

  test('derives duration from latest clip end when config.duration is absent', () => {
    const result = rfPlanDuration({
      project: {
        version: '1',
        config: { width: 1, height: 1, fps: 30 },
        assets: {
          a: { id: 'a', kind: 'image', source: { scheme: 'file', uri: 'a.jpg' } },
        },
        timeline: {
          tracks: [
            {
              id: 'v',
              kind: 'video',
              clips: [
                { id: 'c0', assetRef: 'a', startMs: 0, durationMs: 1000 },
                { id: 'c1', assetRef: 'a', startMs: 1000, durationMs: 2000 },
              ],
            },
          ],
        },
      },
    });
    expect(result.durationMs).toBe(3000);
  });
});
