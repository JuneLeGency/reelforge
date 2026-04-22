/**
 * A visual style is a reusable "design system in a box":
 *   - a page background (gradient / solid / image)
 *   - a global palette that templates can pull colours from
 *   - font family + weight recommendations
 *
 * Styles are global (apply to the whole composition) — they do NOT
 * override per-slide template choreography. Think of a style as the CSS
 * theme and a template as the component.
 */
export interface VisualStyle {
  /** Stable name (CLI / config reference). */
  name: string;
  /** One-line pitch (shown by `reelforge ... --list-styles`). */
  description: string;
  /** Full-page background for the composition body. */
  background: string;
  /** 3-7 hex colours; templates can reference by index. */
  palette: readonly string[];
  /** Primary ink colour for headlines / body. */
  color: string;
  /** Secondary ink — subtitles, captions, meta text. */
  colorMuted: string;
  /** Font stack for headings. */
  fontFamilyHeading: string;
  /** Font stack for body / captions. */
  fontFamilyBody: string;
  /** Extra CSS, appended after the baseline composition CSS. */
  extraCss?: string;
}
