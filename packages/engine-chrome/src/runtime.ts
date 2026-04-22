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

    if (typeof document !== 'undefined' && typeof document.getAnimations === 'function') {
      window.__rf.registerAdapter({
        name: 'waapi',
        seek: function (ctx) {
          var anims = document.getAnimations();
          for (var i = 0; i < anims.length; i++) {
            try {
              anims[i].pause();
              anims[i].currentTime = ctx.timeMs;
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
