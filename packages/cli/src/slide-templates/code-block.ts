import { escapeText } from './escape';
import type { SlideRenderOutput, SlideSpec, SlideTemplate } from './types';

/**
 * code-block — terminal-style code window with a macOS traffic-light
 * header, syntax-lite coloring (comments / strings / keywords), and
 * per-line typewriter-ish stagger fade-in. One bullet = one code line;
 * the template preserves indentation verbatim by using the non-trimmed
 * bullet body (spec.bullets is RO string[] so leading spaces survive).
 *
 * Slots:
 *   - title         → optional heading above the window
 *   - subtitle      → filename / caption shown in the window chrome
 *   - bullets       → code lines (one per element, preserves indent)
 *   - extras.lang   → hints coloring: 'ts' / 'js' / 'json' / 'sh' / 'py'
 *                     (default: auto — applies a broadly-useful regex set)
 */
export const codeBlock: SlideTemplate = (spec: SlideSpec): SlideRenderOutput => {
  const { index, startMs, endMs } = spec;
  const title = spec.title ?? '';
  const subtitle = spec.subtitle ?? '';
  const bullets = spec.bullets ?? [];
  const lang = String(spec.extras?.lang ?? 'auto');

  const FADE_MS = 400;
  const inStart = startMs;
  const inEnd = startMs + FADE_MS;
  const outStart = endMs - FADE_MS;
  const outEnd = endMs;

  const id = `slide-${index}`;
  const linesHtml = bullets
    .map((line, i) => `<div class="code-line" data-i="${i}">${colorize(line, lang)}</div>`)
    .join('');

  const html = `
  <section class="slide slide-code-block" id="${id}" data-slide-index="${index}">
    ${title !== '' ? `<h1 class="title">${escapeText(title)}</h1>` : ''}
    <div class="window">
      <div class="window-chrome">
        <span class="dot red"></span>
        <span class="dot yellow"></span>
        <span class="dot green"></span>
        ${subtitle !== '' ? `<span class="filename">${escapeText(subtitle)}</span>` : ''}
      </div>
      <div class="code-body">${linesHtml}</div>
    </div>
  </section>`.trim();

  const sel = (s: string) => `#${id}${s === '' ? '' : ' ' + s}`;

  const STAGGER_MS = 120;
  const LINE_ENTRANCE_MS = 320;
  const lineStart = inStart + 460;
  const lineAnims = bullets.map((_l, i) => {
    const delay = lineStart + i * STAGGER_MS;
    return {
      selector: sel(`.code-line[data-i="${i}"]`),
      easing: 'cubic-bezier(.22,.9,.32,1)',
      keyframes: [
        { atMs: 0, props: { opacity: 0, transform: 'translateX(-8px)' } },
        { atMs: Math.max(0, delay - 1), props: { opacity: 0, transform: 'translateX(-8px)' } },
        { atMs: delay + LINE_ENTRANCE_MS, props: { opacity: 1, transform: 'translateX(0px)' } },
        { atMs: outStart, props: { opacity: 1, transform: 'translateX(0px)' } },
        { atMs: outEnd, props: { opacity: 0, transform: 'translateX(0px)' } },
      ],
    };
  });

  return {
    html,
    css: CODE_BLOCK_CSS,
    animations: [
      // scene cross-fade
      {
        selector: sel(''),
        easing: 'linear',
        keyframes: [
          { atMs: 0, props: { opacity: 0 } },
          { atMs: Math.max(0, inStart - 1), props: { opacity: 0 } },
          { atMs: inEnd, props: { opacity: 1 } },
          { atMs: outStart, props: { opacity: 1 } },
          { atMs: outEnd, props: { opacity: 0 } },
        ],
      },
      // title fade-up
      {
        selector: sel('.title'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'translateY(14px)' } },
          { atMs: Math.max(0, inStart + 120 - 1), props: { opacity: 0, transform: 'translateY(14px)' } },
          { atMs: inStart + 120 + 450, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'translateY(0px)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'translateY(-8px)' } },
        ],
      },
      // window opens (scale + fade)
      {
        selector: sel('.window'),
        easing: 'cubic-bezier(.22,.9,.32,1)',
        keyframes: [
          { atMs: 0, props: { opacity: 0, transform: 'scale(0.96)' } },
          { atMs: Math.max(0, inStart + 260 - 1), props: { opacity: 0, transform: 'scale(0.96)' } },
          { atMs: inStart + 260 + 400, props: { opacity: 1, transform: 'scale(1)' } },
          { atMs: outStart, props: { opacity: 1, transform: 'scale(1)' } },
          { atMs: outEnd, props: { opacity: 0, transform: 'scale(0.98)' } },
        ],
      },
      ...lineAnims,
    ],
  };
};

/**
 * Minimal "pick the obvious tokens" highlighter — not a real parser,
 * just enough to make common code samples read with a pulse of colour.
 * We escape first, then wrap token classes, so user input can't escape
 * out of the <div> via angle brackets.
 */
function colorize(line: string, _lang: string): string {
  // Preserve leading whitespace as &nbsp; for visual indent.
  const leading = line.match(/^[ \t]*/)?.[0] ?? '';
  const rest = line.slice(leading.length);
  const indent = leading.replace(/ /g, '&nbsp;').replace(/\t/g, '&nbsp;&nbsp;');
  const escaped = escapeText(rest);

  // Comment wins everything — if the line starts with // or # or --,
  // everything after is a comment.
  const commentMatch = escaped.match(/^\s*(\/\/|#|--)/);
  if (commentMatch) {
    return `${indent}<span class="tok-comment">${escaped}</span>`;
  }

  // Strings — double- or single-quoted spans, including "..." in JSON keys.
  let out = escaped.replace(
    /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g,
    '<span class="tok-string">$1</span>',
  );
  // Numbers (avoid matching inside already-wrapped string spans; rough but OK).
  out = out.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="tok-number">$1</span>');
  // Common keywords across JS/TS/JSON-schema-ish. We deliberately
  // exclude words that collide with HTML attribute names already
  // injected by the earlier string/number replacements (e.g. "class",
  // "type", "interface") — otherwise this pass corrupts the tags
  // we just wrote. Rare loss of highlight on those specific words is
  // much better than broken markup.
  out = out.replace(
    /\b(const|let|var|function|if|else|return|import|from|export|default|async|await|new|for|while|try|catch|throw|null|true|false)\b/g,
    '<span class="tok-keyword">$1</span>',
  );
  // `rf generate` style — highlight shell commands at line start.
  out = out.replace(/^(\$\s*)?([a-z][\w-]*)/, (_m, p1, p2) => {
    if (p1) return `<span class="tok-prompt">${p1}</span><span class="tok-command">${p2}</span>`;
    return _m;
  });
  return indent + out;
}

export const CODE_BLOCK_CSS = `
  .slide-code-block {
    position: absolute; inset: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    opacity: 0;
    color: white;
    padding: 40px 64px;
    gap: 20px;
    box-sizing: border-box;
  }
  .slide-code-block .title {
    font-size: 36px;
    font-weight: 800;
    letter-spacing: -0.5px;
    margin: 0;
    text-align: center;
    opacity: 0;
    transform: translateY(14px);
  }
  .slide-code-block .window {
    width: 100%;
    max-width: 880px;
    background: #0d1117;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 10px;
    box-shadow: 0 18px 48px rgba(0,0,0,0.5);
    overflow: hidden;
    opacity: 0;
    transform: scale(0.96);
  }
  .slide-code-block .window-chrome {
    background: #161b22;
    padding: 10px 14px;
    display: flex; align-items: center; gap: 8px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .slide-code-block .dot {
    width: 12px; height: 12px;
    border-radius: 50%;
    display: inline-block;
  }
  .slide-code-block .dot.red    { background: #ff5f57; }
  .slide-code-block .dot.yellow { background: #ffbd2e; }
  .slide-code-block .dot.green  { background: #28ca42; }
  .slide-code-block .filename {
    flex: 1 1 auto;
    text-align: center;
    font-size: 13px;
    font-weight: 500;
    color: rgba(255,255,255,0.52);
    letter-spacing: 0.4px;
    margin-right: 44px; /* balance the 3 dots on the left */
  }
  .slide-code-block .code-body {
    padding: 18px 22px 20px 22px;
    font-family: ui-monospace, "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace;
    font-size: 18px;
    line-height: 1.6;
    color: #e6edf3;
    min-height: 320px;
  }
  .slide-code-block .code-line {
    white-space: pre-wrap;
    word-break: break-word;
    opacity: 0;
    transform: translateX(-8px);
  }
  .slide-code-block .tok-comment { color: #7ee787; font-style: italic; }
  .slide-code-block .tok-string  { color: #a5d6ff; }
  .slide-code-block .tok-number  { color: #ffa657; }
  .slide-code-block .tok-keyword { color: #ff7b72; font-weight: 600; }
  .slide-code-block .tok-prompt  { color: #8b949e; }
  .slide-code-block .tok-command { color: #d2a8ff; font-weight: 600; }
`;
