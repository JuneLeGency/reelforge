import { describe, expect, test } from 'bun:test';
import { CHROME_PATHS, resolveChrome } from '../util/chrome';

describe('resolveChrome', () => {
  test('prefers envValue when it exists', () => {
    const path = resolveChrome({
      envValue: '/custom/chrome',
      exists: (p) => p === '/custom/chrome',
    });
    expect(path).toBe('/custom/chrome');
  });

  test('falls back to platform defaults if envValue is missing on disk', () => {
    const first = CHROME_PATHS.darwin![0]!;
    const path = resolveChrome({
      platformOverride: 'darwin',
      envValue: '/does/not/exist',
      exists: (p) => p === first,
    });
    expect(path).toBe(first);
  });

  test('checks each platform candidate in order', () => {
    const second = CHROME_PATHS.linux![1]!;
    const checked: string[] = [];
    const path = resolveChrome({
      platformOverride: 'linux',
      exists: (p) => {
        checked.push(p);
        return p === second;
      },
    });
    expect(path).toBe(second);
    expect(checked[0]).toBe(CHROME_PATHS.linux![0]!);
  });

  test('returns null when no candidate exists', () => {
    expect(
      resolveChrome({
        platformOverride: 'linux',
        exists: () => false,
      }),
    ).toBeNull();
  });

  test('unknown platform returns null', () => {
    expect(
      resolveChrome({
        platformOverride: 'sunos',
        exists: () => true,
      }),
    ).toBeNull();
  });
});
