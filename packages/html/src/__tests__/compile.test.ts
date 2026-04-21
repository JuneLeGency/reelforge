import { describe, expect, test } from 'bun:test';
import { compileHtml, HtmlCompileError } from '../index';

describe('compileHtml — config', () => {
  test('extracts width/height/fps from <html data-rf-*>', () => {
    const { project } = compileHtml(
      `<html data-rf-width="1280" data-rf-height="720" data-rf-fps="60"><body></body></html>`,
      { baseDir: '.' },
    );
    expect(project.config).toEqual({ width: 1280, height: 720, fps: 60 });
  });

  test('falls back to 1920x1080@30 defaults', () => {
    const { project } = compileHtml('<html><body></body></html>', { baseDir: '.' });
    expect(project.config).toEqual({ width: 1920, height: 1080, fps: 30 });
  });
});

describe('compileHtml — image clips', () => {
  test('emits ImageAsset + Clip for <img>', () => {
    const html = `<html><body>
      <img src="./hero.jpg" data-start="0" data-duration="5" data-fit="cover">
    </body></html>`;
    const { project } = compileHtml(html, { baseDir: '.' });
    const assets = Object.values(project.assets);
    expect(assets).toHaveLength(1);
    expect(assets[0]).toMatchObject({
      kind: 'image',
      source: { scheme: 'file', uri: './hero.jpg' },
    });
    expect(project.timeline.tracks).toHaveLength(1);
    const mainTrack = project.timeline.tracks[0]!;
    expect(mainTrack.kind).toBe('video');
    expect(mainTrack.clips[0]).toMatchObject({
      startMs: 0,
      durationMs: 5000,
      fit: 'cover',
    });
  });

  test('deduplicates assets referenced multiple times', () => {
    const html = `<html><body>
      <img src="./a.jpg" data-start="0" data-duration="2">
      <img src="./a.jpg" data-start="3" data-duration="2">
    </body></html>`;
    const { project } = compileHtml(html, { baseDir: '.' });
    expect(Object.keys(project.assets)).toHaveLength(1);
    expect(project.timeline.tracks[0]!.clips).toHaveLength(2);
  });

  test('derives url scheme for absolute https sources', () => {
    const html = `<html><body>
      <img src="https://cdn.example.com/p.png" data-start="0" data-duration="1">
    </body></html>`;
    const { project } = compileHtml(html, { baseDir: '.' });
    const asset = Object.values(project.assets)[0]!;
    expect(asset.source).toEqual({
      scheme: 'url',
      uri: 'https://cdn.example.com/p.png',
    });
  });
});

describe('compileHtml — video and audio', () => {
  test('<video data-has-audio> flag flows into VideoAsset', () => {
    const html = `<html><body>
      <video src="./p.mp4" data-start="0" data-duration="8" data-has-audio="true" data-source-start="2"></video>
    </body></html>`;
    const { project } = compileHtml(html, { baseDir: '.' });
    const asset = Object.values(project.assets)[0]!;
    expect(asset).toMatchObject({ kind: 'video', hasAudio: true });
    const clip = project.timeline.tracks[0]!.clips[0]!;
    expect(clip.sourceStartMs).toBe(2000);
  });

  test('<audio> goes into its own audio track', () => {
    const html = `<html><body>
      <img src="./x.jpg" data-start="0" data-duration="5">
      <audio src="./n.mp3" data-start="0" data-duration="5" data-volume="0.8"></audio>
    </body></html>`;
    const { project } = compileHtml(html, { baseDir: '.' });
    expect(project.timeline.tracks).toHaveLength(2);
    expect(project.timeline.tracks[1]!.kind).toBe('audio');
    expect(project.timeline.tracks[1]!.clips[0]!.volume).toBe(0.8);
  });

  test('AudioAsset durationMs mirrors data-duration when no probe is available', () => {
    const html = `<html><body>
      <audio src="./n.mp3" data-start="0" data-duration="12.5"></audio>
    </body></html>`;
    const { project } = compileHtml(html, { baseDir: '.' });
    const audioAsset = Object.values(project.assets)[0]! as { kind: 'audio'; durationMs: number };
    expect(audioAsset.durationMs).toBe(12500);
  });
});

describe('compileHtml — effects and custom id', () => {
  test('parses comma-separated data-effect into effects[]', () => {
    const html = `<html><body>
      <img src="./h.jpg" data-start="0" data-duration="3" data-effect="ken-burns, fade-in">
    </body></html>`;
    const { project } = compileHtml(html, { baseDir: '.' });
    const clip = project.timeline.tracks[0]!.clips[0]!;
    expect(clip.effects).toEqual([{ name: 'ken-burns' }, { name: 'fade-in' }]);
  });

  test('uses data-id when present', () => {
    const html = `<html><body>
      <img src="./h.jpg" data-id="hero-shot" data-start="0" data-duration="3">
    </body></html>`;
    const { project } = compileHtml(html, { baseDir: '.' });
    expect(project.timeline.tracks[0]!.clips[0]!.id).toBe('hero-shot');
  });
});

describe('compileHtml — errors and skips', () => {
  test('skips elements with data-start but no data-duration', () => {
    const html = `<html><body>
      <img src="./h.jpg" data-start="0">
    </body></html>`;
    const { project } = compileHtml(html, { baseDir: '.' });
    expect(project.timeline.tracks[0]!.clips).toHaveLength(0);
  });

  test('throws when media element has no src', () => {
    const html = `<html><body><img data-start="0" data-duration="1"></body></html>`;
    expect(() => compileHtml(html, { baseDir: '.' })).toThrow(HtmlCompileError);
  });

  test('throws on non-positive data-duration', () => {
    const html = `<html><body>
      <img src="./h.jpg" data-start="0" data-duration="0">
    </body></html>`;
    expect(() => compileHtml(html, { baseDir: '.' })).toThrow(HtmlCompileError);
  });

  test('ignores non-media timed elements (MVP media-only rule)', () => {
    const html = `<html><body>
      <div class="title" data-start="1" data-duration="3">Hello</div>
    </body></html>`;
    const { project } = compileHtml(html, { baseDir: '.' });
    expect(project.timeline.tracks[0]!.clips).toHaveLength(0);
    expect(Object.keys(project.assets)).toHaveLength(0);
  });
});
