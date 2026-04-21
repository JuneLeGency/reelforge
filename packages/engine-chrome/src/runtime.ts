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
