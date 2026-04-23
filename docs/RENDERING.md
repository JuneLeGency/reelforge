# Rendering pipeline (engine-chrome)

How `rf generate` actually gets from HTML to MP4.

## The one adapter that matters: manual-keyframes

`packages/engine-chrome/src/runtime.ts` injects a runtime into every
page (via `page.evaluateOnNewDocument`). The runtime registers
multiple seek adapters on `window.__rf.registerAdapter`:
- `manual-keyframes` — **the only one that actually does work**
- `three` — dispatches `rf-seek` CustomEvent for Three.js scenes
- `lottie` — drives registered Lottie `AnimationItem`s via `goToAndStop`
- (video / image adapters for legacy `<img data-start>` slides)

**All animations** (slide entrances, caption fades, chrome effects,
page counter) are serialized into `window.__rf.plans` by
`render-composition.ts` and read from there by manual-keyframes.

### How seek works

Each frame, engine-chrome's render loop calls:

```js
await page.evaluate(async (t) => {
  await window.__rf.seekFrame(t);
  // wait 2 rAFs so paint commits before screenshot
  await new Promise(r => rAF(() => rAF(() => r(null))));
}, timeMs);
const buffer = await page.screenshot({ type: 'png' });
```

Inside `seekFrame(t)`, `manual-keyframes.seek(ctx)`:

```js
for each plan in window.__rf.plans:
  el = document.querySelector(plan.selector)  // cached on plan._el
  find the keyframe pair [a, b] around t
  p = (t - a.atMs) / (b.atMs - a.atMs)
  for each prop in {opacity, transform, ...}:
    if both values are numbers → linear lerp
    if both are transform strings → parse functions, lerp axis-by-axis, rebuild
    else → step (p<1 ? a.value : b.value)
  el.style.setProperty(kebab(prop), result)
  // SVG elements also get el.setAttribute(prop, result) for
  // opacity, stroke, fill, stroke-dashoffset, stroke-dasharray,
  // stroke-width, fill-opacity, stroke-opacity
```

## Why not WAAPI

See [`DECISIONS.md`](./DECISIONS.md) §"Retiring WAAPI". Short version:
Chromium has a keyframe-interpolation bug where seeking a paused
WAAPI animation whose last keyframe offset < 1 scales progress
against `lastOffset`, so any seek past ~15% of duration flips
straight to the last keyframe. There's also a wall-clock drift
problem between the seek coroutine and the screenshot capture.
Manual linear interpolation on inline style sidesteps both.

## Why headless: 'shell' not headless: true

See [`DECISIONS.md`](./DECISIONS.md) §"headless: 'shell'". Short
version: the new Chromium headless mode renders paint out-of-sync
with style writes; the old headless_shell binary is reliable. Puppeteer
accepts `headless: 'shell'` to pick the old one.

## Why some SVG props need setAttribute

Chromium caches SVG presentation properties (stroke, fill,
stroke-dashoffset, etc.) at parse time and doesn't always repaint
when `el.style.xxx` changes them mid-animation. Writing to both
`el.style.setProperty` **and** `el.setAttribute` forces a repaint.
manual-keyframes does this automatically for SVG elements on:
opacity, transform, fill, stroke, fill-opacity, stroke-opacity,
stroke-width, stroke-dashoffset, stroke-dasharray.

## Why some animations need pre-sampled keyframes

Spring physics have overshoot, WAAPI's `easing: cubic-bezier` does
not. So `spring.ts` expands an animation with
`easing: 'spring-bouncy'` into ~16 linear keyframes per segment,
each sample computed from a damped-oscillator simulation. The
result is a plan manual-keyframes can lerp through, giving visible
overshoot without needing a real spring engine.

## The render loop (simplified)

```ts
// packages/engine-chrome/src/render.ts

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: 'shell',
  defaultViewport: { width, height, deviceScaleFactor: 1 },
  args: DEFAULT_CHROME_ARGS,
});
const page = await browser.newPage();
await page.evaluateOnNewDocument(RUNTIME_SCRIPT);
await page.goto(htmlUrl, { waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__rf?.ready === true);

const ff = spawnImagePipeFfmpeg({ fps, outputPath }, ffmpegBinary);
for (let frame = 0; frame < totalFrames; frame++) {
  const t = frame * frameStepMs;
  await page.evaluate(async (t) => {
    await window.__rf.seekFrame(t);
    await new Promise(r => requestAnimationFrame(
      () => requestAnimationFrame(() => r())
    ));
  }, t);
  const png = await page.screenshot({ type: 'png' });
  await ff.write(png);
}
await ff.finish();  // finalizes silent.mp4
```

Then `@reelforge/mux` muxes in the audio track.

## Debugging a render

1. **Run with `--keepWorkdir`**: `rf generate config.json --output foo.mp4 --keepWorkdir`
   Keeps the `__generate_TS/` dir with `index.html` + `silent.mp4` +
   the staged assets. Open `index.html` in a real browser and play
   the CSS/WAAPI animations directly — often the fastest way to
   verify layout & timing.

2. **Grab frames with ffmpeg**:
   ```bash
   for t in 1 3 5 7 10 15; do
     ffmpeg -y -ss $t -i foo.mp4 -frames:v 1 frame-$t.png 2>/dev/null
   done
   ```

3. **Forward Chrome console to stderr** — already enabled in
   `render.ts`. Warning and error messages surface via `[chrome warn]`
   / `[chrome error]` / `[chrome pageerror]` lines. `console.log` is
   suppressed to keep stderr clean; add temporary `console.warn()` in
   runtime.ts if you need to trace a seek.

4. **Inspect plans**:
   ```bash
   python3 -c "
   import re, json
   h = open('__generate_…/index.html').read()
   m = re.search(r'var plans = (\[.*?\]);', h, re.DOTALL)
   plans = json.loads(m.group(1))
   # now inspect plans[0].selector, plans[0].keyframes, …
   "
   ```

## Common gotchas

- **Animation selectors must be id-scoped**. `#slide-3 .title` ✓,
  `.title` ✗ (will match every slide).
- **Templates must emit a single top-level element**. If you need
  multiple children, wrap them in one `<section>`.
- **Templates must use `spec.startMs` / `spec.endMs` directly** for
  keyframe atMs — render-composition does not shift them.
- **composite children** get a high-numbered index via
  `100_000 + parentIndex*100 + childIndex`, so their selectors
  naturally don't collide.
