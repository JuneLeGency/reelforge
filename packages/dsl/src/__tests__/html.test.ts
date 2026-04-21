import { describe, expect, test } from 'bun:test';
import { buildDslHtml, parseDsl } from '../index';

describe('buildDslHtml', () => {
  test('emits image + title + audio tags with correct timings', () => {
    const project = parseDsl({
      config: { width: 1280, height: 720, fps: 30 },
      clips: [
        {
          duration: 3,
          layers: [
            { type: 'image', src: './a.jpg', fit: 'cover' },
            { type: 'title', text: 'Hello', style: { fontSize: 96 } },
          ],
        },
        {
          duration: 2,
          layers: [{ type: 'image', src: './b.jpg', fit: 'contain' }],
        },
      ],
      audio: [{ src: './music.mp3', volume: 0.3 }],
    });
    const { html, totalDurationMs } = buildDslHtml(project);
    expect(totalDurationMs).toBe(5000);
    expect(html).toContain('data-rf-width="1280"');
    expect(html).toContain('data-rf-fps="30"');
    expect(html).toContain('data-rf-duration="5.000"');
    expect(html).toContain('src="./a.jpg" data-start="0.000" data-duration="3.000"');
    expect(html).toContain('src="./b.jpg" data-start="3.000" data-duration="2.000"');
    expect(html).toContain('src="./music.mp3" data-start="0.000" data-duration="5.000"');
    expect(html).toContain('layer-title');
    expect(html).toContain('>Hello<');
  });

  test('clips concat sequentially in time', () => {
    const project = parseDsl({
      clips: [
        { duration: 2, layers: [{ type: 'image', src: 'a.jpg' }] },
        { duration: 3, layers: [{ type: 'image', src: 'b.jpg' }] },
        { duration: 1, layers: [{ type: 'image', src: 'c.jpg' }] },
      ],
    });
    const { html, totalDurationMs } = buildDslHtml(project);
    expect(totalDurationMs).toBe(6000);
    expect(html).toMatch(/src="a\.jpg" data-start="0\.000" data-duration="2\.000"/);
    expect(html).toMatch(/src="b\.jpg" data-start="2\.000" data-duration="3\.000"/);
    expect(html).toMatch(/src="c\.jpg" data-start="5\.000" data-duration="1\.000"/);
  });

  test('escapes text & attr in layers', () => {
    const project = parseDsl({
      clips: [
        {
          duration: 1,
          layers: [
            { type: 'image', src: 'a"b&c.jpg' },
            { type: 'title', text: '<script>alert(1)</script>' },
          ],
        },
      ],
    });
    const { html } = buildDslHtml(project);
    expect(html).toContain('src="a&quot;b&amp;c.jpg"');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  test('defaults apply when config missing', () => {
    const project = parseDsl({
      clips: [{ duration: 1, layers: [{ type: 'image', src: 'a.jpg' }] }],
    });
    const { html } = buildDslHtml(project);
    expect(html).toContain('data-rf-width="1280"');
    expect(html).toContain('data-rf-height="720"');
    expect(html).toContain('data-rf-fps="30"');
  });

  test('background color threads through to body style', () => {
    const project = parseDsl({
      config: { background: '#ff00ff' },
      clips: [{ duration: 1, layers: [{ type: 'image', src: 'a.jpg' }] }],
    });
    const { html } = buildDslHtml(project);
    expect(html).toContain('background: #ff00ff');
  });
});
