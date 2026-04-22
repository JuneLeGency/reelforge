import { describe, expect, test } from 'bun:test';
import type { VideoProject } from '@reelforge/ir';
import { buildFastPathArgs, buildFastPathFfmpegArgs } from '../filter';

const makeProject = (): VideoProject => ({
  version: '1',
  config: { width: 1280, height: 720, fps: 30 },
  assets: {
    a: { id: 'a', kind: 'image', source: { scheme: 'file', uri: './a.jpg' } },
    b: { id: 'b', kind: 'image', source: { scheme: 'file', uri: './b.jpg' } },
    v: {
      id: 'v',
      kind: 'video',
      source: { scheme: 'file', uri: './clip.mp4' },
    },
  },
  timeline: {
    tracks: [
      {
        id: 'main',
        kind: 'video',
        clips: [
          { id: 'c0', assetRef: 'a', startMs: 0, durationMs: 2000 },
          { id: 'c1', assetRef: 'b', startMs: 2000, durationMs: 3000 },
          {
            id: 'c2',
            assetRef: 'v',
            startMs: 5000,
            durationMs: 4000,
            sourceStartMs: 1000,
          },
        ],
      },
    ],
  },
});

describe('buildFastPathArgs', () => {
  test('produces one input + one filter chain per clip', () => {
    const args = buildFastPathArgs(makeProject(), '/base');
    expect(args.inputs).toHaveLength(3);
    expect(args.inputs[0]!.path).toBe('/base/a.jpg');
    expect(args.inputs[0]!.preInputArgs).toEqual(['-loop', '1', '-t', '2.000']);
    expect(args.inputs[1]!.path).toBe('/base/b.jpg');
    expect(args.inputs[1]!.preInputArgs).toEqual(['-loop', '1', '-t', '3.000']);
    expect(args.inputs[2]!.path).toBe('/base/clip.mp4');
    expect(args.inputs[2]!.preInputArgs).toEqual([]);
    expect(args.filterComplex).toContain('[0:v]scale=1280:720');
    expect(args.filterComplex).toContain('[1:v]scale=1280:720');
    expect(args.filterComplex).toContain('[2:v]trim=start=1.000:duration=4.000');
  });

  test('shifts each clip onto its timeline position via setpts', () => {
    const args = buildFastPathArgs(makeProject(), '/base');
    expect(args.filterComplex).toContain('setpts=PTS-STARTPTS+0.000/TB');
    expect(args.filterComplex).toContain('setpts=PTS-STARTPTS+2.000/TB');
    expect(args.filterComplex).toContain('setpts=PTS+5.000/TB');
  });

  test('stacks overlays gated by enable="between" expressions', () => {
    const args = buildFastPathArgs(makeProject(), '/base');
    expect(args.filterComplex).toContain('color=c=black:s=1280x720:r=30:d=9.000[base]');
    expect(args.filterComplex).toContain(
      "[base][v0]overlay=shortest=0:enable='between(t,0.000,2.000)'[o0]",
    );
    expect(args.filterComplex).toContain(
      "[o1][v2]overlay=shortest=0:enable='between(t,5.000,9.000)'[vout]",
    );
    expect(args.videoOutLabel).toBe('vout');
  });

  test('width/height/fps/duration propagate for the output encoder', () => {
    const args = buildFastPathArgs(makeProject(), '/base');
    expect(args.width).toBe(1280);
    expect(args.height).toBe(720);
    expect(args.fps).toBe(30);
    expect(args.durationSec).toBe(9);
    expect(args.hasVisual).toBe(true);
  });

  test('empty video timeline synthesises a blank canvas', () => {
    const p: VideoProject = {
      version: '1',
      config: { width: 640, height: 360, fps: 24, duration: 3 },
      assets: {},
      timeline: { tracks: [{ id: 'empty', kind: 'video', clips: [] }] },
    };
    const args = buildFastPathArgs(p, '/base');
    expect(args.hasVisual).toBe(false);
    expect(args.inputs).toEqual([]);
    expect(args.filterComplex).toContain('color=c=black:s=640x360:r=24:d=3.000[bg]');
  });
});

describe('buildFastPathFfmpegArgs', () => {
  test('wires inputs and graph + encoder flags', () => {
    const fast = buildFastPathArgs(makeProject(), '/base');
    const argv = buildFastPathFfmpegArgs(fast, 'out.mp4');
    const inputCount = argv.filter((a) => a === '-i').length;
    expect(inputCount).toBe(3);
    expect(argv).toContain('-filter_complex');
    expect(argv[argv.indexOf('-filter_complex') + 1]).toBe(fast.filterComplex);
    expect(argv[argv.indexOf('-map') + 1]).toBe('[vout]');
    expect(argv).toContain('-an');
    // Output -t is the *last* -t (inputs may inject their own via -loop 1 -t <d>).
    expect(argv[argv.lastIndexOf('-t') + 1]).toBe('9.000');
    expect(argv[argv.indexOf('-c:v') + 1]).toBe('libx264');
    expect(argv).toContain('-movflags');
    expect(argv).toContain('+faststart');
    expect(argv[argv.length - 1]).toBe('out.mp4');
  });
});
