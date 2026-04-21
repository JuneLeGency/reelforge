import { describe, expect, test } from 'bun:test';
import {
  HOT_RELOAD_SNIPPET,
  injectHotReload,
  mimeFor,
  resolveServePath,
} from '../commands/preview';

describe('injectHotReload', () => {
  test('inserts the snippet just before </body>', () => {
    const out = injectHotReload('<html><body><h1>Hi</h1></body></html>');
    expect(out).toBe(
      `<html><body><h1>Hi</h1>${HOT_RELOAD_SNIPPET}\n</body></html>`,
    );
  });

  test('falls back to appending when there is no </body>', () => {
    const out = injectHotReload('<!-- just a fragment -->', '<script>x</script>');
    expect(out).toBe('<!-- just a fragment --><script>x</script>');
  });

  test('is idempotent in the sense that snippet is inserted exactly once per call', () => {
    const once = injectHotReload('<body></body>', '<s>1</s>');
    expect(once.match(/<s>1<\/s>/g)).toHaveLength(1);
  });
});

describe('resolveServePath', () => {
  test('"/" maps to the HTML file and requests reload injection', () => {
    const r = resolveServePath('/', '/base', '/base/index.html');
    expect(r).toEqual({ path: '/base/index.html', injectReload: true });
  });

  test('"/index.html" also maps to the HTML file', () => {
    const r = resolveServePath('/index.html', '/base', '/base/index.html');
    expect(r).toEqual({ path: '/base/index.html', injectReload: true });
  });

  test('sibling resources resolve relative to baseDir', () => {
    const r = resolveServePath('/assets/hero.png', '/base', '/base/index.html');
    expect(r).toEqual({ path: '/base/assets/hero.png', injectReload: false });
  });

  test('path traversal to outside baseDir is rejected', () => {
    expect(resolveServePath('/../secret.txt', '/base', '/base/index.html')).toBeNull();
    expect(
      resolveServePath('/foo/../../secret.txt', '/base', '/base/index.html'),
    ).toBeNull();
  });

  test('URL-encoded path traversal is caught', () => {
    expect(
      resolveServePath('/%2e%2e/secret.txt', '/base', '/base/index.html'),
    ).toBeNull();
  });

  test('direct request for the HTML file also injects reload', () => {
    const r = resolveServePath('/video.html', '/base', '/base/video.html');
    expect(r).toEqual({ path: '/base/video.html', injectReload: true });
  });
});

describe('mimeFor', () => {
  test('common types', () => {
    expect(mimeFor('a.png')).toBe('image/png');
    expect(mimeFor('x.svg')).toBe('image/svg+xml');
    expect(mimeFor('sound.mp3')).toBe('audio/mpeg');
    expect(mimeFor('clip.webm')).toBe('video/webm');
    expect(mimeFor('data.json')).toBe('application/json');
  });

  test('unknown extension falls back to octet-stream', () => {
    expect(mimeFor('file.xyz')).toBe('application/octet-stream');
  });

  test('case-insensitive', () => {
    expect(mimeFor('A.PNG')).toBe('image/png');
  });
});
