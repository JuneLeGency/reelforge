import { describe, expect, test } from 'bun:test';
import { buildImagePipeArgs } from '../ffmpeg';

describe('buildImagePipeArgs', () => {
  test('produces a sane default image2pipe command', () => {
    const args = buildImagePipeArgs({ fps: 30, outputPath: 'out.mp4' });
    expect(args).toContain('-f');
    expect(args).toContain('image2pipe');
    expect(args).toContain('-framerate');
    const fpsIdx = args.indexOf('-framerate');
    expect(args[fpsIdx + 1]).toBe('30');
    expect(args).toContain('-vcodec');
    expect(args).toContain('png');
    expect(args).toContain('-pix_fmt');
    expect(args).toContain('yuv420p');
    expect(args).toContain('-movflags');
    expect(args).toContain('+faststart');
    expect(args[args.length - 1]).toBe('out.mp4');
  });

  test('allows codec and preset overrides', () => {
    const args = buildImagePipeArgs({
      fps: 60,
      outputPath: 'x.mp4',
      videoCodec: 'libx265',
      preset: 'ultrafast',
    });
    const outCodecIdx = args.lastIndexOf('-vcodec');
    expect(args[outCodecIdx + 1]).toBe('libx265');
    const presetIdx = args.indexOf('-preset');
    expect(args[presetIdx + 1]).toBe('ultrafast');
  });

  test('injects extra args immediately before output path', () => {
    const args = buildImagePipeArgs({
      fps: 30,
      outputPath: 'x.mp4',
      extraArgs: ['-crf', '18'],
    });
    expect(args[args.length - 3]).toBe('-crf');
    expect(args[args.length - 2]).toBe('18');
    expect(args[args.length - 1]).toBe('x.mp4');
  });
});
