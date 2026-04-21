import { describe, expect, test } from 'bun:test';
import { buildCopyArgs, buildMuxArgs, type AudioInput } from '../args';

describe('buildMuxArgs', () => {
  const base: AudioInput = {
    filePath: 'a.mp3',
    startMs: 0,
    durationMs: 5000,
    sourceStartMs: 0,
    volume: 1,
  };

  test('single clip produces trim+delay+volume+amix filter graph', () => {
    const args = buildMuxArgs({
      silentVideoPath: 'silent.mp4',
      outputPath: 'out.mp4',
      audioInputs: [base],
    });
    const filterIdx = args.indexOf('-filter_complex');
    expect(filterIdx).toBeGreaterThan(-1);
    const graph = args[filterIdx + 1]!;
    expect(graph).toContain('[1:a]atrim=start=0.000:duration=5.000');
    expect(graph).toContain('adelay=0|0');
    expect(graph).toContain('volume=1.000');
    expect(graph).toContain('amix=inputs=1:normalize=0[aout]');
    expect(args).toContain('-map');
    const mapIndices = args.reduce<number[]>(
      (acc, a, i) => (a === '-map' ? [...acc, i] : acc),
      [],
    );
    expect(mapIndices).toHaveLength(2);
    expect(args[mapIndices[0]! + 1]).toBe('0:v');
    expect(args[mapIndices[1]! + 1]).toBe('[aout]');
  });

  test('multiple clips all get their own node, mixed together', () => {
    const inputs: AudioInput[] = [
      { filePath: 'n1.mp3', startMs: 0, durationMs: 3000, sourceStartMs: 0, volume: 1 },
      { filePath: 'n2.mp3', startMs: 3000, durationMs: 4000, sourceStartMs: 0, volume: 1 },
      { filePath: 'bgm.mp3', startMs: 0, durationMs: 7000, sourceStartMs: 0, volume: 0.3 },
    ];
    const args = buildMuxArgs({
      silentVideoPath: 'silent.mp4',
      outputPath: 'out.mp4',
      audioInputs: inputs,
    });
    const graph = args[args.indexOf('-filter_complex') + 1]!;
    expect(graph).toMatch(/\[a0\].*\[a1\].*\[a2\]amix=inputs=3:normalize=0/);
    expect(graph).toContain('adelay=3000|3000');
    expect(graph).toContain('volume=0.300');
    // Three -i flags for audio plus one for the video.
    const iCount = args.filter((a) => a === '-i').length;
    expect(iCount).toBe(4);
  });

  test('sourceStartMs flows into atrim start', () => {
    const args = buildMuxArgs({
      silentVideoPath: 'silent.mp4',
      outputPath: 'out.mp4',
      audioInputs: [{ ...base, sourceStartMs: 2500 }],
    });
    const graph = args[args.indexOf('-filter_complex') + 1]!;
    expect(graph).toContain('atrim=start=2.500:duration=5.000');
  });

  test('respects custom audio bitrate', () => {
    const args = buildMuxArgs({
      silentVideoPath: 'silent.mp4',
      outputPath: 'out.mp4',
      audioInputs: [base],
      audioBitrate: '320k',
    });
    const bIdx = args.indexOf('-b:a');
    expect(args[bIdx + 1]).toBe('320k');
  });

  test('final arg is output path', () => {
    const args = buildMuxArgs({
      silentVideoPath: 'silent.mp4',
      outputPath: 'final.mp4',
      audioInputs: [base],
    });
    expect(args[args.length - 1]).toBe('final.mp4');
  });
});

describe('buildCopyArgs', () => {
  test('stream-copy everything', () => {
    const args = buildCopyArgs('in.mp4', 'out.mp4');
    expect(args).toContain('-c');
    const cIdx = args.indexOf('-c');
    expect(args[cIdx + 1]).toBe('copy');
    expect(args[args.length - 1]).toBe('out.mp4');
  });
});
