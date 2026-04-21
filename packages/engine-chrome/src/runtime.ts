/**
 * Browser-side runtime injected into the composition page.
 *
 * Exposes `window.__rf` with:
 *   - registerAdapter(adapter): frontends / user code can contribute custom
 *     seekable adapters.
 *   - seekFrame(timeMs): called from Node per frame to advance every
 *     registered adapter to exactly that time.
 *   - ready: becomes `true` once the load handler has wired up the built-in
 *     GSAP / WAAPI adapters.
 *
 * Built-in adapters pause wall-clock playback and drive playhead manually:
 *   - GSAP  — `gsap.globalTimeline.pause()` + `totalTime(seconds, false)`
 *   - WAAPI — every `document.getAnimations()` paused, `currentTime=ms`
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
      for (var i = 0; i < adapters.length; i++) {
        try { adapters[i].seek(ctx); }
        catch (e) { console.warn('[reelforge] adapter "' + adapters[i].name + '" seek error', e); }
      }
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

    window.__rf.ready = true;
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    installBuiltins();
  } else {
    window.addEventListener('DOMContentLoaded', installBuiltins);
  }
})();
`;
