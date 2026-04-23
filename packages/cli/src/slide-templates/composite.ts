import { resolveTemplate } from './registry';
import type {
  CompositeChild,
  SlideAnimation,
  SlideRenderOutput,
  SlideSpec,
  SlideTemplate,
} from './types';

/**
 * composite — a 1-layer nested layout template. Takes children[],
 * places each child in a CSS grid area, and renders each child's
 * template into that area. Every visual template in the registry can
 * be used as a child, so you can compose e.g.:
 *
 *   children: [
 *     { template: 'hero-fade-up', area: 'main', title: 'Dashboard' },
 *     { template: 'chart-pie',    area: 'side-top',    bullets: [...] },
 *     { template: 'social-follow', area: 'side-bottom', extras: {...} },
 *   ]
 *
 * Selector isolation:
 *   Each child renders into a wrapper with id `#slide-{parentIdx}-child-{n}`.
 *   The child template generates its HTML using its own index-based id
 *   (we pass `spec.index = parentIdx * 1000 + n`), so its animation
 *   selectors like `#slide-{childIndex} .title` don't collide with the
 *   parent or its siblings.
 *
 * Time:
 *   Children live inside [parent.startMs, parent.endMs]. Each child's
 *   actual animation window is
 *     [parent.startMs + startOffsetMs,
 *      parent.startMs + startOffsetMs + (durationMs ?? parentDuration - startOffsetMs)]
 *   So `startOffsetMs` is a *relative* offset inside the parent.
 *
 * Only one level of nesting is allowed — children cannot themselves
 * have `children`. Anything deeper should be a new slide.
 */
export const composite: SlideTemplate = (spec: SlideSpec): SlideRenderOutput => {
  const { index, startMs, endMs } = spec;
  const children = spec.children ?? [];
  const layout = String(spec.layout ?? 'main-side');
  const customGrid = String(spec.extras?.gridTemplate ?? '');

  const FADE_MS = 400;
  const inStart = startMs;
  const inEnd = startMs + FADE_MS;
  const outStart = endMs - FADE_MS;
  const outEnd = endMs;
  const parentDuration = endMs - startMs;

  const id = `slide-${index}`;

  // Resolve grid config. Returns { areaList, style } where areaList
  // is the set of area names the layout exposes (used to validate /
  // warn when a child picks an unknown area).
  const gridConfig = resolveLayout(layout, customGrid);

  // Render each child: pick template, construct per-child spec, grab
  // html + animations + css.
  const childRenders: Array<{
    child: CompositeChild;
    childIndex: number;
    output: SlideRenderOutput;
  }> = [];
  const childCssByTemplate = new Map<string, string>();

  for (let i = 0; i < children.length; i++) {
    const child = children[i]!;
    const childTemplate = resolveTemplate(child.template);
    if (!childTemplate) {
      // Skip silently — render-composition's outer resolveTemplate
      // check should have caught unknown templates already.
      continue;
    }
    // Child index in a high slot so it never clashes with sibling
    // slide indices or sibling children. 100_000 base leaves room for
    // up to 100 sibling children per parent and up to ~900 parent slides.
    const childIndex = 100_000 + index * 100 + i;

    const childStart = startMs + (child.startOffsetMs ?? 0);
    const childEnd =
      startMs +
      (child.startOffsetMs ?? 0) +
      (child.durationMs ?? parentDuration - (child.startOffsetMs ?? 0));

    const childSpec: SlideSpec = {
      index: childIndex,
      startMs: childStart,
      endMs: Math.min(childEnd, endMs),
      ...(child.title !== undefined ? { title: child.title } : {}),
      ...(child.subtitle !== undefined ? { subtitle: child.subtitle } : {}),
      ...(child.image !== undefined ? { image: child.image } : {}),
      ...(child.bullets !== undefined ? { bullets: child.bullets } : {}),
      ...(child.extras !== undefined ? { extras: child.extras } : {}),
    };

    const output = childTemplate(childSpec);
    childRenders.push({ child, childIndex, output });
    // Dedupe CSS by template name — same template used twice reuses CSS.
    if (!childCssByTemplate.has(child.template)) {
      childCssByTemplate.set(child.template, output.css);
    }
  }

  const regionsHtml = childRenders
    .map(({ child, output }, i) => {
      const area = child.area ?? gridConfig.fallbackArea(i) ?? '';
      const areaStyle = area !== '' ? ` style="grid-area: ${area};"` : '';
      return `    <div class="rf-region"${areaStyle}>
      ${output.html}
    </div>`;
    })
    .join('\n');

  const html = `
  <section class="slide slide-composite slide-composite--${layout}" id="${id}" data-slide-index="${index}">
    <div class="rf-grid" style="${gridConfig.gridCss}">
${regionsHtml}
    </div>
  </section>`.trim();

  // Flatten child animations — each child's selector is already
  // namespaced by its unique id (`#slide-{childIndex}`), so we don't
  // need to rewrite selectors.
  const childAnims: SlideAnimation[] = childRenders.flatMap(
    (r) => r.output.animations,
  );

  const sel = (s: string) => `#${id}${s === '' ? '' : ' ' + s}`;

  return {
    html,
    css: COMPOSITE_CSS + '\n' + [...childCssByTemplate.values()].join('\n'),
    animations: [
      // Outer slide cross-fade (only one on the parent — children run
      // their own scene fades inside their area).
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
      ...childAnims,
    ],
  };
};

interface GridConfig {
  gridCss: string;
  fallbackArea: (i: number) => string | null;
}

function resolveLayout(layout: string, customGrid: string): GridConfig {
  switch (layout) {
    case 'main-side':
      return {
        gridCss:
          "grid-template-columns: 2fr 1fr; grid-template-rows: 1fr 1fr; grid-template-areas: 'main side-top' 'main side-bottom';",
        fallbackArea: (i) => ['main', 'side-top', 'side-bottom'][i] ?? null,
      };
    case 'tri-column':
      return {
        gridCss:
          "grid-template-columns: 1fr 1fr 1fr; grid-template-rows: 1fr; grid-template-areas: 'left center right';",
        fallbackArea: (i) => ['left', 'center', 'right'][i] ?? null,
      };
    case 'hero-kpi':
      return {
        // 3 columns so the 2×2 KPI grid actually fits on the right.
        // Main claims column 1 across both rows; kpi-tl / kpi-tr on top
        // row, kpi-bl / kpi-br on bottom row.
        gridCss:
          "grid-template-columns: 3fr 1fr 1fr; grid-template-rows: 1fr 1fr; grid-template-areas: 'main kpi-tl kpi-tr' 'main kpi-bl kpi-br';",
        fallbackArea: (i) =>
          ['main', 'kpi-tl', 'kpi-tr', 'kpi-bl', 'kpi-br'][i] ?? null,
      };
    case 'dashboard-4':
      return {
        gridCss:
          "grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; grid-template-areas: 'tl tr' 'bl br';",
        fallbackArea: (i) => ['tl', 'tr', 'bl', 'br'][i] ?? null,
      };
    case 'banner-grid':
      return {
        gridCss:
          "grid-template-columns: 1fr 1fr 1fr; grid-template-rows: 1fr 2fr; grid-template-areas: 'banner banner banner' 'f1 f2 f3';",
        fallbackArea: (i) => ['banner', 'f1', 'f2', 'f3'][i] ?? null,
      };
    case 'custom':
      return {
        gridCss: customGrid,
        fallbackArea: () => null,
      };
    default:
      // Unknown layout — fall back to main-side.
      return {
        gridCss:
          "grid-template-columns: 2fr 1fr; grid-template-rows: 1fr 1fr; grid-template-areas: 'main side-top' 'main side-bottom';",
        fallbackArea: (i) => ['main', 'side-top', 'side-bottom'][i] ?? null,
      };
  }
}

export const LAYOUT_NAMES: readonly string[] = [
  'main-side',
  'tri-column',
  'hero-kpi',
  'dashboard-4',
  'banner-grid',
  'custom',
];

export const COMPOSITE_CSS = `
  .slide-composite {
    position: absolute; inset: 0;
    opacity: 0;
    padding: 24px;
    box-sizing: border-box;
  }
  .slide-composite .rf-grid {
    width: 100%; height: 100%;
    display: grid;
    gap: 14px;
  }
  .slide-composite .rf-region {
    position: relative;
    overflow: hidden;
    border-radius: 14px;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.06);
  }
  /* Child slides inside a region fill the region, not the viewport. */
  .slide-composite .rf-region > .slide {
    position: absolute; inset: 0;
  }
`;
