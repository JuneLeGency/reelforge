/**
 * Browser-side runtime injected into the composition page.
 *
 * Exposes `window.__rf` with:
 *   - registerAdapter(adapter): frontends / user code can contribute custom
 *     seekable adapters. `seek(ctx)` may return a Promise — the engine
 *     awaits all adapters' promises before taking a screenshot.
 *   - seekFrame(timeMs): called from Node per frame; returns Promise that
 *     resolves once every adapter is done.
 *   - ready: becomes `true` once the load handler has wired up the built-in
 *     GSAP / WAAPI / video adapters.
 *
 * Built-in adapters (all pause wall-clock playback and drive playhead manually):
 *   - GSAP  — `gsap.globalTimeline.pause()` + `totalTime(seconds, false)`
 *   - WAAPI — every `document.getAnimations()` paused, `currentTime=ms`
 *   - video — every `<video data-start>`: paused + `currentTime` set per
 *             frame to `(sourceStartMs + (timeMs - startMs)) / 1000`;
 *             visibility toggled off when the clip is inactive. Seek is
 *             async — the adapter resolves on the `seeked` event (with a
 *             200 ms safety timeout, in case a no-op seek fires no event).
 *
 * Concept credit: Hyperframes' library-clock pattern. Re-implemented here.
 */
export const RUNTIME_SCRIPT = String.raw`
(function () {
  var adapters = [];
  window.__rf = {
    ready: false,
    registerAdapter: function (a) { adapters.push(a); },
    adapters: adapters,
    seekFrame: function (timeMs) {
      var ctx = { timeMs: timeMs, timeSec: timeMs / 1000 };
      var promises = [];
      for (var i = 0; i < adapters.length; i++) {
        try { promises.push(Promise.resolve(adapters[i].seek(ctx))); }
        catch (e) {
          console.warn('[reelforge] adapter "' + adapters[i].name + '" seek error', e);
          promises.push(Promise.resolve());
        }
      }
      return Promise.all(promises);
    },
  };

  function installBuiltins() {
    if (typeof window !== 'undefined' && window.gsap && window.gsap.globalTimeline) {
      var gsap = window.gsap;
      gsap.globalTimeline.pause();
      window.__rf.registerAdapter({
        name: 'gsap',
        seek: function (ctx) {
          gsap.globalTimeline.totalTime(ctx.timeSec, false);
        },
      });
    }

    // Manual keyframe seek — bypasses WAAPI because Chromium headless
    // has a seek+pause interpolation bug when the last keyframe offset
    // is < 1. We read window.__rf.plans (set by render-composition) and
    // apply linear interpolation per property directly to element.style.
    // This also eliminates the compositor-commit problem that forced
    // Animation.commitStyles() on the previous path.
    window.__rf.registerAdapter({
      name: 'manual-keyframes',
      seek: function (ctx) {
        var plans = window.__rf.plans;
        if (!plans || !plans.length) return;
        var t = ctx.timeMs;
        for (var i = 0; i < plans.length; i++) {
          var plan = plans[i];
          var el = plan._el;
          if (!el) {
            el = document.querySelector(plan.selector);
            if (!el) { plan._el = null; continue; }
            plan._el = el;
          }
          applyPlanAtTime(el, plan.keyframes, t);
        }
      },
    });

    function applyPlanAtTime(el, kfs, t) {
      if (!kfs || kfs.length === 0) return;
      // Find the keyframe bracket [a, b] such that a.atMs <= t < b.atMs.
      // If t is before first keyframe, hold first; after last, hold last.
      var a, b;
      if (t <= kfs[0].atMs) { a = kfs[0]; b = kfs[0]; }
      else if (t >= kfs[kfs.length - 1].atMs) { a = kfs[kfs.length - 1]; b = kfs[kfs.length - 1]; }
      else {
        for (var i = 0; i < kfs.length - 1; i++) {
          if (kfs[i].atMs <= t && t < kfs[i + 1].atMs) { a = kfs[i]; b = kfs[i + 1]; break; }
        }
      }
      if (!a || !b) return;
      var span = b.atMs - a.atMs;
      var p = span > 0 ? (t - a.atMs) / span : 0;
      blendPropsInto(el, a.props, b.props, p);
    }

    function blendPropsInto(el, fromProps, toProps, p) {
      var keys = {};
      for (var k in fromProps) keys[k] = 1;
      for (var k in toProps) keys[k] = 1;
      for (var k in keys) {
        var av = fromProps[k];
        var bv = toProps[k];
        if (av === undefined) av = bv;
        if (bv === undefined) bv = av;
        var out;
        if (typeof av === 'number' && typeof bv === 'number') {
          out = av + (bv - av) * p;
        } else if (typeof av === 'string' && typeof bv === 'string') {
          out = blendStrings(k, av, bv, p);
        } else {
          out = p < 1 ? av : bv;
        }
        // Convert camelCase to kebab-case for CSS (transform already ok).
        var cssProp = k.replace(/[A-Z]/g, function (m) { return '-' + m.toLowerCase(); });
        try { el.style.setProperty(cssProp, String(out)); } catch (e) { /* noop */ }
      }
    }

    // Blend two string property values. For transform we parse each
    // function (translateY(40px), rotate(12deg), scale(0.5), etc.) and
    // linearly interpolate matching axes. If structures don't align we
    // step to the nearest endpoint.
    function blendStrings(propName, a, b, p) {
      if (a === b) return a;
      if (propName === 'transform') {
        var fa = parseTransformList(a);
        var fb = parseTransformList(b);
        if (fa && fb && fa.length === fb.length) {
          var same = true;
          for (var i = 0; i < fa.length; i++) {
            if (fa[i].fn !== fb[i].fn) { same = false; break; }
          }
          if (same) {
            var parts = [];
            for (var i = 0; i < fa.length; i++) {
              var aa = fa[i], bb = fb[i];
              if (aa.values.length !== bb.values.length) { parts.push(p < 0.5 ? renderFn(aa) : renderFn(bb)); continue; }
              var blended = [];
              for (var v = 0; v < aa.values.length; v++) {
                var va = aa.values[v], vb = bb.values[v];
                if (va.unit === vb.unit) {
                  blended.push({ num: va.num + (vb.num - va.num) * p, unit: va.unit });
                } else {
                  blended.push(p < 0.5 ? va : vb);
                }
              }
              parts.push(renderFn({ fn: aa.fn, values: blended }));
            }
            return parts.join(' ');
          }
        }
      }
      return p < 1 ? a : b;
    }

    function parseTransformList(s) {
      if (!s || s === 'none') return [];
      var re = /([a-zA-Z]+)\(([^)]+)\)/g;
      var out = [];
      var m;
      while ((m = re.exec(s)) !== null) {
        var fn = m[1];
        var args = m[2].split(',').map(function (x) { return x.trim(); });
        var values = [];
        for (var i = 0; i < args.length; i++) {
          var nm = args[i].match(/^(-?\d+(?:\.\d+)?)\s*([a-zA-Z%]*)$/);
          if (!nm) return null;
          values.push({ num: parseFloat(nm[1]), unit: nm[2] || '' });
        }
        out.push({ fn: fn, values: values });
      }
      return out;
    }

    function renderFn(f) {
      var parts = [];
      for (var i = 0; i < f.values.length; i++) {
        var v = f.values[i];
        var n = v.num;
        var s = (Math.abs(n - Math.round(n)) < 1e-9) ? String(Math.round(n)) : n.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
        parts.push(s + v.unit);
      }
      return f.fn + '(' + parts.join(', ') + ')';
    }

    // Three.js adapter — compositions dispatch "rf-seek" on window with
    // detail = ctx.timeSec / ctx.timeMs, and update their three Clock or
    // per-mesh transforms from that handler. We also expose a mutable
    // window.__rf.threeTime for scenes that poll. No assumption about the
    // three.js instance — the composition owns it.
    if (typeof window !== 'undefined' && typeof window.CustomEvent === 'function') {
      window.__rf.registerAdapter({
        name: 'three',
        seek: function (ctx) {
          window.__rf.threeTime = ctx.timeMs;
          try {
            window.dispatchEvent(new CustomEvent('rf-seek', {
              detail: { timeMs: ctx.timeMs, timeSec: ctx.timeSec }
            }));
          } catch (e) { /* noop */ }
        },
      });
    }

    // Lottie adapter — the composition registers each Lottie instance by
    // pushing it onto window.__rf.lottie. Each entry is either a lottie-web
    // AnimationItem (has goToAndStop + totalFrames + frameRate) or a plain
    // { anim, startMs, durationMs } object for time-scoped playback.
    if (typeof window !== 'undefined') {
      window.__rf.lottie = window.__rf.lottie || [];
      window.__rf.registerAdapter({
        name: 'lottie',
        seek: function (ctx) {
          var instances = window.__rf.lottie;
          for (var i = 0; i < instances.length; i++) {
            try {
              var entry = instances[i];
              var anim = entry && entry.anim ? entry.anim : entry;
              if (!anim || typeof anim.goToAndStop !== 'function') continue;
              var frameRate = anim.frameRate || 30;
              var totalFrames = anim.totalFrames || 0;
              var startMs = entry && typeof entry.startMs === 'number' ? entry.startMs : 0;
              var localMs = ctx.timeMs - startMs;
              if (localMs < 0) localMs = 0;
              var frame = (localMs / 1000) * frameRate;
              if (totalFrames > 0 && frame > totalFrames - 1) frame = totalFrames - 1;
              anim.goToAndStop(frame, true);
            } catch (e) { /* noop */ }
          }
        },
      });
    }

    if (typeof document !== 'undefined') {
      var timedImages = Array.prototype.slice.call(
        document.querySelectorAll('img[data-start][data-duration]')
      );
      if (timedImages.length > 0) {
        // Compute total timeline length for WAAPI animation math.
        // Prefer <html data-rf-duration>; fall back to the latest clip end.
        var totalMs = 0;
        try {
          var docEl = document.documentElement;
          if (docEl && typeof docEl.getAttribute === 'function') {
            var htmlDur = parseFloat(docEl.getAttribute('data-rf-duration') || '');
            if (!isNaN(htmlDur) && htmlDur > 0) totalMs = htmlDur * 1000;
          }
        } catch (e) { /* noop */ }
        if (totalMs === 0) {
          for (var i0 = 0; i0 < timedImages.length; i0++) {
            var si0 = parseFloat(timedImages[i0].getAttribute('data-start'));
            var di0 = parseFloat(timedImages[i0].getAttribute('data-duration'));
            if (!isNaN(si0) && !isNaN(di0)) totalMs = Math.max(totalMs, (si0 + di0) * 1000);
          }
        }

        // Split images into two populations:
        //   - fadeImages: have data-rf-transition-in-ms / data-rf-transition-out-ms →
        //     render via a WAAPI opacity animation (WAAPI adapter seeks it per frame)
        //   - simpleImages: visibility toggle only (cheaper, no WAAPI overhead)
        var fadeImages = [];
        var simpleImages = [];
        for (var i2 = 0; i2 < timedImages.length; i2++) {
          var img2 = timedImages[i2];
          var inMs = parseFloat(img2.getAttribute('data-rf-transition-in-ms') || '');
          var outMs = parseFloat(img2.getAttribute('data-rf-transition-out-ms') || '');
          if ((!isNaN(inMs) && inMs > 0) || (!isNaN(outMs) && outMs > 0)) {
            fadeImages.push({ el: img2, inMs: isNaN(inMs) ? 0 : inMs, outMs: isNaN(outMs) ? 0 : outMs });
          } else {
            simpleImages.push(img2);
          }
        }

        // Install WAAPI animations for fade images. The WAAPI adapter
        // (registered earlier) will seek currentTime on every frame.
        if (fadeImages.length > 0 && totalMs > 0) {
          for (var i3 = 0; i3 < fadeImages.length; i3++) {
            var entry = fadeImages[i3];
            var elF = entry.el;
            var startMsF = parseFloat(elF.getAttribute('data-start')) * 1000;
            var durF = parseFloat(elF.getAttribute('data-duration')) * 1000;
            var endMsF = startMsF + durF;
            var fadeIn = entry.inMs;
            var fadeOut = entry.outMs;
            // Overlap windows: image becomes visible fadeIn ms BEFORE its
            // own start, and stays (transparent) fadeOut ms AFTER its end,
            // so the neighbour can fade in/out against it.
            var t0 = Math.max(0, startMsF - fadeIn) / totalMs;
            var t1 = startMsF / totalMs;
            var t2 = endMsF / totalMs;
            var t3 = Math.min(totalMs, endMsF + fadeOut) / totalMs;
            try {
              elF.style.visibility = 'visible';
              elF.animate([
                { opacity: 0, offset: 0 },
                { opacity: 0, offset: t0 },
                { opacity: 1, offset: t1 },
                { opacity: 1, offset: t2 },
                { opacity: 0, offset: t3 },
                { opacity: 0, offset: 1 }
              ], { duration: totalMs, fill: 'both', easing: 'linear' });
            } catch (e) { /* noop — WAAPI unsupported, fall back */ }
          }
        }

        // Register the simple-image adapter only when there's work for it.
        if (simpleImages.length > 0) {
          window.__rf.registerAdapter({
            name: 'image',
            seek: function (ctx) {
              for (var k = 0; k < simpleImages.length; k++) {
                var si = simpleImages[k];
                var s2 = parseFloat(si.getAttribute('data-start')) * 1000;
                var d2 = parseFloat(si.getAttribute('data-duration')) * 1000;
                var a2 = ctx.timeMs >= s2 && ctx.timeMs < s2 + d2;
                si.style.visibility = a2 ? 'visible' : 'hidden';
              }
            },
          });
        }
      }

      var videos = Array.prototype.slice.call(
        document.querySelectorAll('video[data-start]')
      );
      if (videos.length > 0) {
        videos.forEach(function (v) {
          try { v.pause(); } catch (e) { /* noop */ }
        });
        window.__rf.registerAdapter({
          name: 'video',
          seek: function (ctx) {
            return Promise.all(videos.map(function (v) {
              var startMs = parseFloat(v.getAttribute('data-start')) * 1000;
              var duration = parseFloat(v.getAttribute('data-duration')) * 1000;
              var sourceStartMs = parseFloat(v.getAttribute('data-source-start') || '0') * 1000;
              var active = ctx.timeMs >= startMs && ctx.timeMs < startMs + duration;

              if (!active) {
                v.style.visibility = 'hidden';
                return Promise.resolve();
              }

              v.style.visibility = 'visible';
              var targetSec = (sourceStartMs + (ctx.timeMs - startMs)) / 1000;
              if (Math.abs(v.currentTime - targetSec) < 1 / 1000) {
                return Promise.resolve();
              }
              return new Promise(function (resolve) {
                var done = false;
                var onSeeked = function () {
                  if (done) return;
                  done = true;
                  v.removeEventListener('seeked', onSeeked);
                  resolve();
                };
                v.addEventListener('seeked', onSeeked);
                try { v.currentTime = targetSec; }
                catch (e) { onSeeked(); return; }
                setTimeout(onSeeked, 200);
              });
            }));
          },
        });
      }
    }

    window.__rf.ready = true;
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    installBuiltins();
  } else {
    window.addEventListener('DOMContentLoaded', installBuiltins);
  }
})();
`;
