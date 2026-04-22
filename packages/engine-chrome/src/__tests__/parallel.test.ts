import { describe, expect, test } from 'bun:test';
import { planSegments } from '../parallel';

describe('planSegments', () => {
  test('evenly divides when frames % workers == 0', () => {
    const segs = planSegments(90, 3);
    expect(segs).toEqual([
      { shard: 0, frameStart: 0, frameEnd: 30 },
      { shard: 1, frameStart: 30, frameEnd: 60 },
      { shard: 2, frameStart: 60, frameEnd: 90 },
    ]);
  });

  test('earlier shards absorb the remainder one frame at a time', () => {
    const segs = planSegments(100, 3);
    // 100 / 3 = 33 base, 1 extra → shard 0 gets 34, others 33 each.
    expect(segs).toEqual([
      { shard: 0, frameStart: 0, frameEnd: 34 },
      { shard: 1, frameStart: 34, frameEnd: 67 },
      { shard: 2, frameStart: 67, frameEnd: 100 },
    ]);
    expect(segs.reduce((a, s) => a + (s.frameEnd - s.frameStart), 0)).toBe(100);
  });

  test('segments cover [0, totalFrames) without gaps or overlap', () => {
    for (const total of [1, 7, 90, 91, 361]) {
      for (const p of [1, 2, 3, 4, 8]) {
        const segs = planSegments(total, p);
        expect(segs[0]!.frameStart).toBe(0);
        expect(segs[segs.length - 1]!.frameEnd).toBe(total);
        for (let i = 1; i < segs.length; i++) {
          expect(segs[i]!.frameStart).toBe(segs[i - 1]!.frameEnd);
        }
      }
    }
  });

  test('parallelism clamped at totalFrames — no empty shards', () => {
    const segs = planSegments(3, 8);
    expect(segs).toHaveLength(3);
    for (const s of segs) expect(s.frameEnd - s.frameStart).toBe(1);
  });

  test('parallelism ≥ 1 always', () => {
    const segs = planSegments(10, 0);
    expect(segs).toHaveLength(1);
    expect(segs[0]).toEqual({ shard: 0, frameStart: 0, frameEnd: 10 });
  });
});
