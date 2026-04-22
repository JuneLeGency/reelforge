import { describe, expect, test } from 'bun:test';
import { buildWavConvertArgs } from '../convert';
import { buildWhisperArgs } from '../whisper-args';

describe('buildWavConvertArgs', () => {
  test('emits 16kHz mono pcm_s16le conversion', () => {
    const args = buildWavConvertArgs('in.mp3', 'out.wav');
    expect(args).toContain('-ar');
    expect(args[args.indexOf('-ar') + 1]).toBe('16000');
    expect(args).toContain('-ac');
    expect(args[args.indexOf('-ac') + 1]).toBe('1');
    expect(args[args.indexOf('-c:a') + 1]).toBe('pcm_s16le');
    expect(args[args.length - 1]).toBe('out.wav');
  });
});

describe('buildWhisperArgs', () => {
  test('builds a minimal invocation with JSON output + per-word granularity', () => {
    const args = buildWhisperArgs({
      modelPath: 'ggml-base.en.bin',
      wavPath: 'audio.wav',
      outputPrefix: 'out',
    });
    expect(args).toEqual([
      '-m',
      'ggml-base.en.bin',
      '-f',
      'audio.wav',
      '-oj',
      '-of',
      'out',
      '-ml',
      '1',
    ]);
  });

  test('adds -l <lang> when a non-empty language hint is provided', () => {
    const args = buildWhisperArgs({
      modelPath: 'm',
      wavPath: 'a.wav',
      outputPrefix: 'out',
      language: 'en',
    });
    expect(args.slice(-2)).toEqual(['-l', 'en']);
  });

  test('empty language is treated as auto-detect (no -l flag)', () => {
    const args = buildWhisperArgs({
      modelPath: 'm',
      wavPath: 'a.wav',
      outputPrefix: 'out',
      language: '',
    });
    expect(args.includes('-l')).toBe(false);
  });

  test('appends extraArgs verbatim', () => {
    const args = buildWhisperArgs({
      modelPath: 'm',
      wavPath: 'a.wav',
      outputPrefix: 'out',
      extraArgs: ['-t', '8', '--beam-size', '5'],
    });
    expect(args).toContain('-t');
    expect(args).toContain('8');
    expect(args.slice(-4)).toEqual(['-t', '8', '--beam-size', '5']);
  });
});
