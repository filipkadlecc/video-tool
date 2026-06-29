// =============================================================================
// HyperFrames composition template — the fixed harness that wraps an AI-authored
// scene into a complete, renderable HTML document. Used by BOTH the in-app
// preview (mode "preview", autoplays + loops) and the render queue (mode
// "render", leaves the timeline paused for HyperFrames to seek). Building both
// from one function guarantees "what you preview is what you export".
//
// The AI writes only the scene: it appends DOM to the global `stage` element,
// defines `render(frame)`, and declares `const durationInFrames = N` (and
// optionally `const fps = N`). The harness injects GSAP, the ported motion
// helpers (motion-runtime.ts), brand tokens, canvas globals, fonts, and the
// per-frame driver (a paused GSAP proxy tween whose onUpdate calls render()).
// =============================================================================

import { BRAND } from "@/lib/brand";
import { MOTION_RUNTIME_JS } from "./motion-runtime";

export type CompositionMode = "preview" | "render";

const GSAP_CDN = "https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js";

export interface SceneMeta {
  durationInFrames: number;
  fps: number;
}

// Pull duration/fps out of the scene source without executing it (the server
// can't eval browser DOM code, and the preview overlay needs them too).
export function parseSceneMeta(code: string): SceneMeta {
  const dm = code.match(/durationInFrames\s*[:=]\s*(\d+)/);
  const fm = code.match(/\bfps\s*[:=]\s*(\d+)/);
  const durationInFrames = dm ? parseInt(dm[1], 10) : 180;
  const fps = fm ? parseInt(fm[1], 10) : 30;
  return { durationInFrames, fps };
}

// @font-face block. Preview references the app's public paths directly; render
// references a local `fonts/` folder the queue copies the files into.
function fontFaceCss(mode: CompositionMode): string {
  const gt = mode === "preview" ? "/fonts" : "fonts";
  const inter = mode === "preview" ? "/assets/fonts/Inter_24pt-SemiBold.ttf" : "fonts/Inter-SemiBold.ttf";
  return `
    @font-face { font-family: 'GT Walsheim'; src: url('${gt}/GT-Walsheim-Regular.ttf') format('truetype'); font-weight: 400; font-display: block; }
    @font-face { font-family: 'GT Walsheim'; src: url('${gt}/GT-Walsheim-Medium.ttf')  format('truetype'); font-weight: 500; font-display: block; }
    @font-face { font-family: 'GT Walsheim'; src: url('${gt}/GT-Walsheim-Bold.ttf')    format('truetype'); font-weight: 700; font-display: block; }
    @font-face { font-family: 'GT Walsheim'; src: url('${gt}/GT-Walsheim-Black.ttf')   format('truetype'); font-weight: 900; font-display: block; }
    @font-face { font-family: 'Inter'; src: url('${inter}') format('truetype'); font-weight: 400 700; font-display: block; }`;
}

export interface BuildCompositionOpts {
  width: number;
  height: number;
  mode: CompositionMode;
  /** Override scene meta (else parsed from code). The render queue passes the
   *  actual sampling fps it will use so the data-duration matches. */
  meta?: SceneMeta;
  /** Transparent page background (for alpha exports / preview checkerboard).
   *  Default false → the dark brand bg is painted, as before. */
  transparent?: boolean;
}

export function buildCompositionHtml(code: string, opts: BuildCompositionOpts): string {
  const { width, height, mode, transparent } = opts;
  const { durationInFrames, fps } = opts.meta ?? parseSceneMeta(code);
  const durationSeconds = (durationInFrames / fps).toFixed(4);
  // When transparent, leave the page background empty so the alpha channel is
  // captured around the scene's content (the wrapped scene paints no full bg).
  const bg = transparent ? "transparent" : BRAND.colors.bg;
  const repeat = mode === "preview" ? ", repeat: -1" : "";
  const play = mode === "preview" ? "tl.play();" : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${width}, height=${height}" />
    <script src="${GSAP_CDN}"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      ${fontFaceCss(mode)}
      html, body { margin: 0; width: ${width}px; height: ${height}px; overflow: hidden; background: ${bg}; font-family: 'Inter', sans-serif; }
    </style>
    <script>
      // Surface syntax/runtime errors visibly instead of a blank frame.
      window.addEventListener('error', function (e) {
        try { document.body.innerHTML = '<pre style="color:#f87171;padding:48px;font:18px sans-serif;white-space:pre-wrap">HyperFrames error:\\n' + (e.message || '') + '\\n' + (e.filename || '') + ':' + (e.lineno || '') + '</pre>'; } catch (_) {}
      });
    </script>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${durationSeconds}" data-width="${width}" data-height="${height}">
      <div id="stage" class="clip" data-start="0" data-duration="${durationSeconds}" data-track-index="0" style="position:absolute; inset:0;"></div>
    </div>

    <script>
      // ---- injected globals (brand + canvas) ----
      var C = ${JSON.stringify(BRAND.colors)};
      var F = ${JSON.stringify(BRAND.fonts)};
      var ACCENT = C.orange;
      var W = ${width}, H = ${height}, base = Math.min(W, H), FPS = ${fps};
      var stage = document.getElementById('stage');
    </script>
    <script>${MOTION_RUNTIME_JS}</script>
    <script>
      /* ===== scene (AI-authored) ===== */
      ${code}

      /* ===== driver (auto-added by the harness) ===== */
      ;(function () {
        if (typeof render !== 'function') {
          document.body.innerHTML = '<pre style="color:#f87171;padding:48px;font:24px sans-serif;white-space:pre-wrap">HyperFrames scene error: no render(frame) function was defined.</pre>';
          return;
        }
        var DUR = (typeof durationInFrames !== 'undefined' && durationInFrames) ? durationInFrames : ${durationInFrames};
        try { render(0); } catch (e) {
          document.body.innerHTML = '<pre style="color:#f87171;padding:48px;font:20px sans-serif;white-space:pre-wrap">HyperFrames scene error:\\n' + (e && e.stack ? e.stack : e) + '</pre>';
          return;
        }
        var proxy = { f: 0 };
        var tl = gsap.timeline({ paused: true${repeat} });
        tl.to(proxy, { f: DUR, duration: DUR / FPS, ease: 'none', onUpdate: function () { render(proxy.f); } }, 0);
        window.__timelines = window.__timelines || {};
        window.__timelines['main'] = tl;
        ${play}
      })();
    </script>
  </body>
</html>`;
}
