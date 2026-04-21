import { describe, expect, test } from 'bun:test';
import { scaffoldHello, ScaffoldError } from '../commands/init';

function fakeFs() {
  const files = new Map<string, string>();
  const dirs = new Set<string>();
  return {
    files,
    dirs,
    mkdir: async (p: string) => {
      dirs.add(p);
    },
    writeFile: async (p: string, c: string) => {
      files.set(p, c);
    },
    exists: (p: string) => dirs.has(p) || files.has(p),
  };
}

describe('scaffoldHello', () => {
  test('writes index.html and README.md and returns their paths', async () => {
    const fs = fakeFs();
    const result = await scaffoldHello({
      targetDir: '/tmp/demo',
      name: 'demo',
      force: false,
      mkdir: fs.mkdir,
      writeFile: fs.writeFile,
      exists: fs.exists,
    });
    expect(result.targetDir).toBe('/tmp/demo');
    expect(result.files).toEqual(['/tmp/demo/index.html', '/tmp/demo/README.md']);
    expect(fs.files.get('/tmp/demo/index.html')).toContain('data-rf-width');
    expect(fs.files.get('/tmp/demo/README.md')).toContain('# demo');
  });

  test('title-cases the project name into the HTML title tag', async () => {
    const fs = fakeFs();
    await scaffoldHello({
      targetDir: '/tmp/my-awesome-video',
      name: 'my-awesome-video',
      force: false,
      mkdir: fs.mkdir,
      writeFile: fs.writeFile,
      exists: fs.exists,
    });
    const html = fs.files.get('/tmp/my-awesome-video/index.html')!;
    expect(html).toContain('<title>My Awesome Video</title>');
    expect(html).toContain('<h1>My Awesome Video</h1>');
  });

  test('refuses to overwrite without --force', async () => {
    const fs = fakeFs();
    fs.dirs.add('/tmp/exists');
    await expect(
      scaffoldHello({
        targetDir: '/tmp/exists',
        name: 'exists',
        force: false,
        mkdir: fs.mkdir,
        writeFile: fs.writeFile,
        exists: fs.exists,
      }),
    ).rejects.toBeInstanceOf(ScaffoldError);
  });

  test('--force overwrites an existing directory', async () => {
    const fs = fakeFs();
    fs.dirs.add('/tmp/exists');
    fs.files.set('/tmp/exists/index.html', 'OLD CONTENTS');
    await scaffoldHello({
      targetDir: '/tmp/exists',
      name: 'exists',
      force: true,
      mkdir: fs.mkdir,
      writeFile: fs.writeFile,
      exists: fs.exists,
    });
    expect(fs.files.get('/tmp/exists/index.html')).toContain('data-rf-width');
  });
});
