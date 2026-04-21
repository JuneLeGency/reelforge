import { describe, expect, test } from 'bun:test';
import type { WordTiming } from '@reelforge/captions';
import {
  GenerateConfigError,
  assignSlides,
  buildGenerateHtml,
  parseGenerateConfig,
  sentenceCaptions,
  splitSentences,
} from '../commands/generate';

const w = (text: string, startMs: number, endMs: number): WordTiming => ({ text, startMs, endMs });

describe('parseGenerateConfig', () => {
  test('accepts a minimal config and supplies defaults', () => {
    const c = parseGenerateConfig({
      narration: 'hi',
      images: ['a.png'],
      voice: 'v',
    });
    expect(c).toMatchObject({
      narration: 'hi',
      images: ['a.png'],
      voice: 'v',
      width: 1280,
      height: 720,
      fps: 30,
    });
  });

  test('rejects missing narration', () => {
    expect(() => parseGenerateConfig({ images: ['a.png'], voice: 'v' })).toThrow(
      GenerateConfigError,
    );
  });

  test('rejects empty images array', () => {
    expect(() => parseGenerateConfig({ narration: 'x', images: [], voice: 'v' })).toThrow(
      GenerateConfigError,
    );
  });

  test('propagates optional fields', () => {
    const c = parseGenerateConfig({
      narration: 'x',
      images: ['a.png'],
      voice: 'v',
      modelId: 'eleven_turbo_v2_5',
      width: 1920,
      height: 1080,
      fps: 60,
    });
    expect(c.modelId).toBe('eleven_turbo_v2_5');
    expect(c.width).toBe(1920);
    expect(c.fps).toBe(60);
  });
});

describe('splitSentences', () => {
  test('splits on terminal punctuation and keeps word-level timing', () => {
    const words = [
      w('Hello', 0, 300),
      w('world.', 320, 700),
      w('How', 750, 900),
      w('are', 910, 1100),
      w('you?', 1120, 1400),
    ];
    const sentences = splitSentences(words);
    expect(sentences).toEqual([
      { text: 'Hello world.', startMs: 0, endMs: 700 },
      { text: 'How are you?', startMs: 750, endMs: 1400 },
    ]);
  });

  test('flushes a trailing buffer without punctuation', () => {
    const words = [w('Incomplete', 0, 500), w('sentence', 510, 1000)];
    const sentences = splitSentences(words);
    expect(sentences).toHaveLength(1);
    expect(sentences[0]!.text).toBe('Incomplete sentence');
    expect(sentences[0]!.endMs).toBe(1000);
  });

  test('supports CJK punctuation', () => {
    const words = [w('你好', 0, 300), w('世界。', 320, 600)];
    const sentences = splitSentences(words);
    expect(sentences).toHaveLength(1);
    expect(sentences[0]!.text).toBe('你好 世界。');
  });

  test('empty input → empty output', () => {
    expect(splitSentences([])).toEqual([]);
  });
});

describe('assignSlides', () => {
  const s = (startMs: number, endMs: number): { text: string; startMs: number; endMs: number } => ({
    text: 'x',
    startMs,
    endMs,
  });

  test('1:1 when counts match', () => {
    const slides = assignSlides([s(0, 1000), s(1000, 2000)], ['a', 'b']);
    expect(slides).toEqual([
      { image: 'a', startMs: 0, durationMs: 1000 },
      { image: 'b', startMs: 1000, durationMs: 1000 },
    ]);
  });

  test('more sentences than images → cycle images', () => {
    const slides = assignSlides(
      [s(0, 1000), s(1000, 2000), s(2000, 3000)],
      ['a', 'b'],
    );
    expect(slides.map((x) => x.image)).toEqual(['a', 'b', 'a']);
  });

  test('more images than sentences → only first N images used', () => {
    const slides = assignSlides([s(0, 1000), s(1000, 2000)], ['a', 'b', 'c']);
    expect(slides.map((x) => x.image)).toEqual(['a', 'b']);
  });

  test('empty inputs → empty output', () => {
    expect(assignSlides([], ['a'])).toEqual([]);
    expect(assignSlides([s(0, 1000)], [])).toEqual([]);
  });
});

describe('sentenceCaptions', () => {
  test('wraps sentences into Caption[] with timestampMs/confidence null', () => {
    const caps = sentenceCaptions([
      { text: 'Hi.', startMs: 0, endMs: 1000 },
      { text: 'You?', startMs: 1100, endMs: 2000 },
    ]);
    expect(caps).toEqual([
      { text: 'Hi.', startMs: 0, endMs: 1000, timestampMs: null, confidence: null },
      { text: 'You?', startMs: 1100, endMs: 2000, timestampMs: null, confidence: null },
    ]);
  });
});

describe('buildGenerateHtml', () => {
  test('emits html with data-rf-* config and correct clip times', () => {
    const html = buildGenerateHtml({
      width: 1280,
      height: 720,
      fps: 30,
      slides: [
        { image: 'asset_0.png', startMs: 0, durationMs: 2000 },
        { image: 'asset_1.png', startMs: 2000, durationMs: 3000 },
      ],
      audioRelative: 'narration.mp3',
      audioDurationMs: 5000,
    });
    expect(html).toContain('data-rf-width="1280"');
    expect(html).toContain('data-rf-height="720"');
    expect(html).toContain('data-rf-fps="30"');
    expect(html).toContain('src="asset_0.png" data-start="0.000" data-duration="2.000"');
    expect(html).toContain('src="asset_1.png" data-start="2.000" data-duration="3.000"');
    expect(html).toContain('src="narration.mp3" data-start="0" data-duration="5.000"');
  });

  test('escapes HTML-unsafe characters in paths', () => {
    const html = buildGenerateHtml({
      width: 1280,
      height: 720,
      fps: 30,
      slides: [{ image: 'a "b".png', startMs: 0, durationMs: 1000 }],
      audioRelative: 'n<o>.mp3',
      audioDurationMs: 1000,
    });
    expect(html).toContain('src="a &quot;b&quot;.png"');
    expect(html).toContain('src="n&lt;o&gt;.mp3"');
  });

  test('initial visibility: hidden on images (adapter unhides per frame)', () => {
    const html = buildGenerateHtml({
      width: 1280,
      height: 720,
      fps: 30,
      slides: [{ image: 'x.png', startMs: 0, durationMs: 1000 }],
      audioRelative: 'n.mp3',
      audioDurationMs: 1000,
    });
    expect(html).toContain('visibility: hidden');
  });

  test('no caption script when captions are omitted', () => {
    const html = buildGenerateHtml({
      width: 1280,
      height: 720,
      fps: 30,
      slides: [{ image: 'x.png', startMs: 0, durationMs: 1000 }],
      audioRelative: 'n.mp3',
      audioDurationMs: 1000,
    });
    expect(html).not.toContain('class="caption"');
    expect(html).not.toContain('<script>');
  });

  test('captions become absolutely-positioned WAAPI-animated divs', () => {
    const html = buildGenerateHtml({
      width: 1280,
      height: 720,
      fps: 30,
      slides: [{ image: 'x.png', startMs: 0, durationMs: 5000 }],
      audioRelative: 'n.mp3',
      audioDurationMs: 5000,
      captions: [
        {
          text: 'Hello world',
          startMs: 200,
          endMs: 1500,
          timestampMs: null,
          confidence: null,
        },
        {
          text: 'Second cue',
          startMs: 1500,
          endMs: 3000,
          timestampMs: null,
          confidence: null,
        },
      ],
    });
    expect(html).toContain('id="caption-0"');
    expect(html).toContain('>Hello world<');
    expect(html).toContain('id="caption-1"');
    expect(html).toContain('>Second cue<');
    expect(html).toContain('.caption {');
    expect(html).toContain('position: absolute');
    expect(html).toContain('opacity: 0');
    expect(html).toContain('<script>');
    expect(html).toContain("startMs:200");
    expect(html).toContain("endMs:1500");
    expect(html).toContain('.animate([');
  });

  test('caption text is escaped', () => {
    const html = buildGenerateHtml({
      width: 1280,
      height: 720,
      fps: 30,
      slides: [{ image: 'x.png', startMs: 0, durationMs: 1000 }],
      audioRelative: 'n.mp3',
      audioDurationMs: 1000,
      captions: [
        {
          text: '<script>alert(1)</script>',
          startMs: 0,
          endMs: 1000,
          timestampMs: null,
          confidence: null,
        },
      ],
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  test('custom captionStyle overrides defaults', () => {
    const html = buildGenerateHtml({
      width: 1280,
      height: 720,
      fps: 30,
      slides: [{ image: 'x.png', startMs: 0, durationMs: 1000 }],
      audioRelative: 'n.mp3',
      audioDurationMs: 1000,
      captions: [
        {
          text: 'hi',
          startMs: 0,
          endMs: 1000,
          timestampMs: null,
          confidence: null,
        },
      ],
      captionStyle: {
        fontSize: 48,
        color: 'yellow',
        marginBottomPct: 20,
      },
    });
    expect(html).toContain('font-size: 48px');
    expect(html).toContain('color: yellow');
    expect(html).toContain('bottom: 20vh');
  });
});
