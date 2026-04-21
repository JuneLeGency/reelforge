import type { DslClip, DslLayer, DslProject } from './schema';

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;
const DEFAULT_FPS = 30;

export interface BuildDslHtmlResult {
  html: string;
  totalDurationMs: number;
}

/**
 * Compile a validated DslProject into a standalone HTML composition.
 * The output is consumed by `@reelforge/html` (or a browser) exactly like
 * any other composition.
 */
export function buildDslHtml(project: DslProject): BuildDslHtmlResult {
  const width = project.config?.width ?? DEFAULT_WIDTH;
  const height = project.config?.height ?? DEFAULT_HEIGHT;
  const fps = project.config?.fps ?? DEFAULT_FPS;
  const background = project.config?.background ?? '#000';

  const clipTimes = buildClipTimes(project.clips);
  const totalSec = clipTimes[clipTimes.length - 1]?.endSec ?? 0;
  const totalMs = Math.round(totalSec * 1000);

  const mediaTags: string[] = [];
  const titleDefs: { id: string; text: string; style: Required<NonNullable<DslLayer & { type: 'title' }>['style']> extends object ? object : object; startMs: number; durationMs: number; entrance: 'fade' | 'slide-up' | 'none'; position: 'top' | 'center' | 'bottom'; styleRaw: NonNullable<(DslLayer & { type: 'title' })['style']> | undefined }[] = [];

  project.clips.forEach((clip, ci) => {
    const t = clipTimes[ci]!;
    clip.layers.forEach((layer, li) => {
      if (layer.type === 'image') {
        const fit = layer.fit ?? 'cover';
        mediaTags.push(
          `    <img class="layer-image" src="${escapeAttr(layer.src)}" data-start="${toSec(t.startSec)}" data-duration="${toSec(t.durationSec)}" data-fit="${fit}">`,
        );
      } else if (layer.type === 'audio') {
        const vol = layer.volume ?? 1;
        mediaTags.push(
          `    <audio src="${escapeAttr(layer.src)}" data-start="${toSec(t.startSec)}" data-duration="${toSec(t.durationSec)}" data-volume="${vol}"></audio>`,
        );
      } else if (layer.type === 'title') {
        const id = `title-${ci}-${li}`;
        titleDefs.push({
          id,
          text: layer.text,
          style: {} as never,
          styleRaw: layer.style,
          startMs: Math.round(t.startSec * 1000),
          durationMs: Math.round(t.durationSec * 1000),
          entrance: (layer as { entrance?: 'fade' | 'slide-up' | 'none' }).entrance ?? 'fade',
          position: layer.style?.position ?? 'center',
        });
      }
    });
  });

  (project.audio ?? []).forEach((track) => {
    const startSec = track.start ?? 0;
    const durationSec = track.duration ?? Math.max(0, totalSec - startSec);
    if (durationSec <= 0) return;
    const vol = track.volume ?? 1;
    mediaTags.push(
      `    <audio src="${escapeAttr(track.src)}" data-start="${toSec(startSec)}" data-duration="${toSec(durationSec)}" data-volume="${vol}"></audio>`,
    );
  });

  const titleDivs = titleDefs
    .map(
      (td) =>
        `    <div class="layer-title layer-title--${td.position}" id="${td.id}">${escapeText(td.text)}</div>`,
    )
    .join('\n');

  const titleScript =
    titleDefs.length > 0 ? buildTitleScript(titleDefs, totalMs) : '';

  const titleCss = titleDefs.length > 0 ? buildTitleCss(titleDefs) : '';

  const html = `<!DOCTYPE html>
<html data-rf-width="${width}" data-rf-height="${height}" data-rf-fps="${fps}" data-rf-duration="${toSec(totalSec)}">
<head>
  <meta charset="utf-8">
  <title>${escapeText(project.meta?.title ?? 'Reelforge DSL project')}</title>
  <style>
    html, body { margin: 0; padding: 0; background: ${background}; overflow: hidden; font-family: -apple-system, system-ui, "Segoe UI", Roboto, sans-serif; }
    #stage { position: relative; width: 100vw; height: 100vh; }
    .layer-image {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      visibility: hidden;
    }
    .layer-image[data-fit="cover"] { object-fit: cover; }
    .layer-image[data-fit="contain"] { object-fit: contain; }
    .layer-image[data-fit="fill"] { object-fit: fill; }${titleCss}
  </style>
</head>
<body>
  <div id="stage">
${mediaTags.join('\n')}
${titleDivs}
  </div>${titleScript}
</body>
</html>
`;

  return { html, totalDurationMs: totalMs };
}

interface ClipTime {
  startSec: number;
  durationSec: number;
  endSec: number;
}

function buildClipTimes(clips: readonly DslClip[]): ClipTime[] {
  const out: ClipTime[] = [];
  let cursor = 0;
  for (const clip of clips) {
    const startSec = cursor;
    const endSec = startSec + clip.duration;
    out.push({ startSec, durationSec: clip.duration, endSec });
    cursor = endSec;
  }
  return out;
}

interface TitleDef {
  id: string;
  text: string;
  startMs: number;
  durationMs: number;
  entrance: 'fade' | 'slide-up' | 'none';
  position: 'top' | 'center' | 'bottom';
  styleRaw: { color?: string; background?: string; fontSize?: number; fontFamily?: string; fontWeight?: number | string; padding?: string; borderRadius?: string } | undefined;
}

function buildTitleCss(defs: readonly TitleDef[]): string {
  const base = `
    .layer-title {
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      max-width: 80vw;
      text-align: center;
      font-size: 96px;
      font-weight: 800;
      line-height: 1.15;
      letter-spacing: -1px;
      color: #fff;
      text-shadow: 0 6px 32px rgba(0,0,0,0.45);
      opacity: 0;
      pointer-events: none;
    }
    .layer-title--top { top: 12vh; }
    .layer-title--center { top: 50%; transform: translate(-50%, -50%); }
    .layer-title--bottom { bottom: 12vh; }`;

  const perTitle = defs
    .map((td) => {
      const s = td.styleRaw;
      if (!s) return '';
      const rules: string[] = [];
      if (s.color !== undefined) rules.push(`color: ${s.color};`);
      if (s.background !== undefined) rules.push(`background: ${s.background};`);
      if (s.fontSize !== undefined) rules.push(`font-size: ${s.fontSize}px;`);
      if (s.fontFamily !== undefined) rules.push(`font-family: ${s.fontFamily};`);
      if (s.fontWeight !== undefined) rules.push(`font-weight: ${s.fontWeight};`);
      if (s.padding !== undefined) rules.push(`padding: ${s.padding};`);
      if (s.borderRadius !== undefined) rules.push(`border-radius: ${s.borderRadius};`);
      if (rules.length === 0) return '';
      return `    #${td.id} { ${rules.join(' ')} }`;
    })
    .filter((s) => s !== '')
    .join('\n');

  return base + (perTitle ? '\n' + perTitle : '');
}

function buildTitleScript(defs: readonly TitleDef[], totalMs: number): string {
  const total = Math.max(1, totalMs);
  const entries = defs
    .map(
      (td) =>
        `    {id:${JSON.stringify(td.id)},s:${td.startMs},e:${td.startMs + td.durationMs},en:${JSON.stringify(td.entrance)},pos:${JSON.stringify(td.position)}}`,
    )
    .join(',\n');
  return `
  <script>
    (function () {
      var total = ${total};
      var edge = 16;
      var items = [
${entries}
      ];
      items.forEach(function (it) {
        var el = document.getElementById(it.id);
        if (!el) return;
        var pre = Math.max(0, (it.s - edge) / total);
        var on = it.s / total;
        var off = Math.min(1, it.e / total);
        var postOff = Math.min(1, (it.e + edge) / total);
        // Positional transforms — center uses translate(-50%,-50%); others translateX(-50%).
        var baseT = it.pos === 'center' ? 'translate(-50%, -50%)' : 'translateX(-50%)';
        var slideFromT = it.pos === 'center'
          ? 'translate(-50%, calc(-50% + 24px))'
          : 'translate(-50%, 24px)';
        var fromT = it.en === 'slide-up' ? slideFromT : baseT;
        var toT = baseT;
        el.animate([
          { opacity: 0, transform: fromT, offset: 0 },
          { opacity: 0, transform: fromT, offset: pre },
          { opacity: 1, transform: toT,   offset: on },
          { opacity: 1, transform: toT,   offset: off },
          { opacity: 0, transform: toT,   offset: postOff },
          { opacity: 0, transform: toT,   offset: 1 }
        ], { duration: total, fill: 'both', easing: 'cubic-bezier(.2,.7,0,1)' });
      });
    })();
  </script>`;
}

function toSec(n: number): string {
  return n.toFixed(3);
}

function escapeAttr(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    if (c === '&') return '&amp;';
    if (c === '<') return '&lt;';
    if (c === '>') return '&gt;';
    if (c === '"') return '&quot;';
    return '&#39;';
  });
}

function escapeText(s: string): string {
  return s.replace(/[&<>]/g, (c) => {
    if (c === '&') return '&amp;';
    if (c === '<') return '&lt;';
    return '&gt;';
  });
}
