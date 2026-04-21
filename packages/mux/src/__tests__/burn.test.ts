import { describe, expect, test } from 'bun:test';
import { buildBurnArgs, DEFAULT_SUBTITLE_STYLE, escapeFilterPath } from '../burn';

describe('escapeFilterPath', () => {
  test('escapes colons (Windows drive letters / protocol paths)', () => {
    expect(escapeFilterPath('C:\\subs\\out.srt')).toContain('C\\\\:');
  });

  test('escapes single quotes', () => {
    expect(escapeFilterPath("/tmp/o'brien.srt")).toContain("o\\\\\\'brien");
  });

  test('simple paths pass through with no changes', () => {
    expect(escapeFilterPath('/tmp/out.srt')).toBe('/tmp/out.srt');
  });
});

describe('buildBurnArgs', () => {
  test('produces a standard subtitles-filter command', () => {
    const args = buildBurnArgs({
      videoPath: 'in.mp4',
      subtitlesPath: 'subs.srt',
      outputPath: 'out.mp4',
    });
    expect(args[0]).toBe('-y');
    expect(args).toContain('-i');
    const iIdx = args.indexOf('-i');
    expect(args[iIdx + 1]).toBe('in.mp4');
    expect(args).toContain('-vf');
    const vfIdx = args.indexOf('-vf');
    expect(args[vfIdx + 1]).toContain("subtitles='subs.srt'");
    expect(args[vfIdx + 1]).toContain('force_style=');
    expect(args).toContain('-c:a');
    const caIdx = args.indexOf('-c:a');
    expect(args[caIdx + 1]).toBe('copy');
    expect(args).toContain('+faststart');
    expect(args[args.length - 1]).toBe('out.mp4');
  });

  test('injects style override when given', () => {
    const args = buildBurnArgs({
      videoPath: 'in.mp4',
      subtitlesPath: 'subs.srt',
      outputPath: 'out.mp4',
      style: 'FontSize=40,Alignment=8',
    });
    const vf = args[args.indexOf('-vf') + 1]!;
    expect(vf).toContain("force_style='FontSize=40,Alignment=8'");
  });

  test('default style puts captions near the bottom with a dark background', () => {
    expect(DEFAULT_SUBTITLE_STYLE).toContain('Alignment=2');
    expect(DEFAULT_SUBTITLE_STYLE).toContain('MarginV=');
    expect(DEFAULT_SUBTITLE_STYLE).toContain('BorderStyle=1');
  });

  test('honors custom preset and crf', () => {
    const args = buildBurnArgs({
      videoPath: 'in.mp4',
      subtitlesPath: 'subs.srt',
      outputPath: 'out.mp4',
      preset: 'ultrafast',
      crf: 28,
    });
    const presetIdx = args.indexOf('-preset');
    expect(args[presetIdx + 1]).toBe('ultrafast');
    const crfIdx = args.indexOf('-crf');
    expect(args[crfIdx + 1]).toBe('28');
  });

  test('paths with single quotes get escaped in the filter expression', () => {
    const args = buildBurnArgs({
      videoPath: 'in.mp4',
      subtitlesPath: "/tmp/o'brien.srt",
      outputPath: 'out.mp4',
    });
    const vf = args[args.indexOf('-vf') + 1]!;
    expect(vf).toMatch(/o\\\\\\'brien/);
  });
});
