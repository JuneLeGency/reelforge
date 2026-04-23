# Composite layouts

How to put multiple templates on one slide.

## When to use it

Anywhere you want **more than one widget per screen**. Dashboards,
"headline + chart + callout" slides, any slide where a single
template would feel too sparse.

## API (config.json)

```json
{
  "template": "composite",
  "layout": "main-side",
  "children": [
    {
      "area": "main",
      "template": "hero-fade-up",
      "title": "Dashboard",
      "subtitle": "一屏多 widget"
    },
    {
      "area": "side-top",
      "template": "chart-pie",
      "bullets": ["web: 52", "ios: 28", "android: 15", "other: 5"],
      "startOffsetMs": 400
    },
    {
      "area": "side-bottom",
      "template": "social-follow",
      "title": "@reelforge",
      "extras": { "platform": "github" },
      "startOffsetMs": 800
    }
  ]
}
```

Every child has:
- `template` — any of the 30 non-composite templates
- `area` — name from the layout preset (see below)
- `startOffsetMs` — ms offset from parent.startMs (default 0)
- `durationMs` — ms span (default = parent duration − offset)
- standard slots: `title`, `subtitle`, `image`, `bullets`, `extras`

## Layout presets

Defined in `composite.ts` `resolveLayout()`. Each preset specifies
`grid-template-{columns,rows,areas}`:

| Layout | Areas | Use for |
|---|---|---|
| `main-side` (default) | `main`, `side-top`, `side-bottom` | headline + 2 sidebars |
| `tri-column` | `left`, `center`, `right` | 3 equal features |
| `hero-kpi` | `main`, `kpi-tl`, `kpi-tr`, `kpi-bl`, `kpi-br` | headline + 2×2 KPIs (main is column 1 across both rows, 3fr wide) |
| `dashboard-4` | `tl`, `tr`, `bl`, `br` | 4 equal quadrants |
| `banner-grid` | `banner`, `f1`, `f2`, `f3` | top banner + 3-column feature row |
| `custom` | user-defined | pass `extras.gridTemplate` verbatim |

### `custom` example

```json
{
  "template": "composite",
  "layout": "custom",
  "extras": {
    "gridTemplate": "grid-template-columns: 1fr 2fr; grid-template-areas: 'a b';"
  },
  "children": [
    { "area": "a", "template": "hero-fade-up", "title": "A" },
    { "area": "b", "template": "chart-line", "bullets": ["…"] }
  ]
}
```

Children with an unset `area` fall back to the preset's default
`fallbackArea(i)` — usually the i-th area name — so a quick-and-dirty
composite can omit `area` and it still works.

## Time model (Remotion-style, relative)

Every child's window is computed as:

```
childStartMs = parent.startMs + (startOffsetMs ?? 0)
childEndMs   = min(
                 parent.endMs,
                 childStartMs + (durationMs ?? parent.duration - offset)
               )
```

This means **re-timing the parent slide automatically ripples to all
children**. No need to rewrite every child's start/end when the SRT
changes.

The child template itself sees `{ startMs, endMs }` set to the child
window and produces its own cross-fade / entrance relative to that
window. The parent also runs its own outer scene cross-fade over
`[parent.startMs, parent.endMs]` — so on transitions you see the
whole composite fade together, not each child crossing independently.

## Id & selector namespacing

To prevent sibling / parent selectors from colliding, each child gets
a high-numbered index:

```
childIndex = 100_000 + parentIndex * 100 + childPosition
```

So parent slide 3's three children become `slide-100300`,
`slide-100301`, `slide-100302`. The child template generates
`id="slide-{childIndex}"` and its animations use
`#slide-{childIndex} .foo` — no collision with the parent's
`#slide-3 .foo` or any other slide.

**Don't nest further**. Children cannot themselves have `children` —
it works mechanically but the selector math and time math get hairy,
and anything that needs more than one layer of grid should be its own
sequence of chained slides (using `compose` across separate videos, or
just separate config slides with transitions).

## CSS: children fill their region, not the viewport

All templates' top-level `<section class="slide">` defaults to
`position: absolute; inset: 0` (it was designed to fill the viewport).
When dropped inside a composite `<div class="rf-region">`, the
absolute positioning is anchored to the region (because the region is
`position: relative`, set by COMPOSITE_CSS).

So a `hero-fade-up` inside a composite's `side-top` region renders as
a miniature hero-fade-up filling that region, not the whole slide.
Text scales are unchanged — if you want smaller fonts in a child,
pick a different template (e.g. `data-grid` over `hero-fade-up` for a
small KPI tile).

## Examples in the codebase

`examples/showcase-demo/config.json` — the last 2 slides use
`composite`:
- `main-side` with hero + chart-pie + social-follow
- `hero-kpi` with hero + 4 staggered data-grid KPIs

## What NOT to use composite for

- **Interchangeable content**: if your slide is always "big title +
  one chart", make a dedicated template — cheaper to author than
  repeating composite config.
- **>6 children**: grid looks cluttered past 5-6 regions. Split into
  multiple slides and chain with transitions.
- **Deep nesting**: explicitly disallowed. Composite children can't
  themselves have children.
