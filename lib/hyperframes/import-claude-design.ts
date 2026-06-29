// =============================================================================
// Claude Design → HyperFrames composition bridge  (isolated, additive)
// =============================================================================
// Turns a self-contained Claude Design *animation* (a React + Babel storyboard
// that renders as a pure function of a single `time` value) into a composition
// the existing HyperFrames render CLI can frame-step into an MP4/WebM/MOV.
//
// We DON'T rewrite the animation. We keep its scene, engine helpers, design
// tokens and geometry byte-for-byte. We only:
//   1. swap its on-screen player (`<Stage>` — scrubber + autoplay + scale-to-fit
//      chrome we don't want in a video) for a controlled `<ExportStage>` whose
//      `time` is driven externally,
//   2. add a paused GSAP timeline at window.__timelines['main'] (the exact seek
//      contract the HyperFrames CLI captures) whose every step sets the scene's
//      time via ReactDOM.flushSync (so the DOM is committed before each shot),
//   3. disable CSS transitions/animations so each seeked frame is exact (CSS
//      time can't be frame-stepped; the meaningful motion is all time-math).
//
// Claude Design's storyboards share one inlined "timeline engine" (a `Stage`
// component + `TimelineContext`/`useTime`), so this transform is generic across
// them. Canvas/duration/fps are best-effort parsed and can be overridden by the
// caller (the UI pre-fills + lets the user correct them).
// =============================================================================

// Pinned to match what Claude Design ships in its standalone storyboards, plus
// the gsap version the rest of HyperFrames already uses.
const CDN = {
  react: "https://unpkg.com/react@18/umd/react.production.min.js",
  reactDom: "https://unpkg.com/react-dom@18/umd/react-dom.production.min.js",
  babel: "https://unpkg.com/@babel/standalone@7.23.6/babel.min.js",
  gsap: "https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js",
  // display=block (not swap) so we never capture a fallback-font frame.
  fonts:
    "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=block",
};

export interface ClaudeDesignMeta {
  width: number;
  height: number;
  durationSeconds: number;
  fps: number;
}

// Best-effort pull of the native canvas / duration / fps from the source. These
// are scene constants in Claude Design storyboards; the UI lets the user fix
// them if a particular file is shaped differently.
export function parseClaudeDesignMeta(sourceHtml: string): ClaudeDesignMeta {
  const num = (re: RegExp, fallback: number): number => {
    const m = sourceHtml.match(re);
    const v = m ? parseFloat(m[1]) : NaN;
    return isFinite(v) && v > 0 ? v : fallback;
  };

  // `const W = 3840, H = 2160, DUR = 15.72;`  (then looser fallbacks)
  const width = num(/\bconst\s+W\s*=\s*(\d+)/, num(/\bwidth=\{(\d+)\}/, 3840));
  const height = num(/\bH\s*=\s*(\d+)/, num(/\bheight=\{(\d+)\}/, 2160));
  const durationSeconds = num(
    /\bDUR\s*=\s*([\d.]+)/,
    num(/\bduration=\{([\d.]+)\}/, 15),
  );
  // The playback bar / timecode formatter uses the project fps (`const fps = 25`).
  const fps = num(/\bconst\s+fps\s*=\s*(\d+)/, 25);

  return { width, height, durationSeconds, fps };
}

// The controlled player. Same prop shape Claude Design calls <Stage> with, but
// it renders the scene at native size scaled to fill the export frame, with no
// scrubber and no autoplay — `time` comes from the harness. Plain
// React.createElement (no JSX / no template literals) so it drops straight into
// the Babel script alongside the original `TimelineContext`.
const EXPORT_STAGE_DEF = `
/* ===== controlled export player (added by the HyperFrames bridge) ===== */
function ExportStage(props){
  var width = props.width, height = props.height, duration = props.duration, background = props.background, children = props.children;
  var _s = useState(0); var time = _s[0], setTime = _s[1];
  useEffect(function(){
    window.__hfSetTime = function(t){ setTime(t); };
    window.__hfDuration = duration;
    window.__hfReady = true;
  }, [duration]);
  var ctx = useMemo(function(){ return { time: time, duration: duration }; }, [time, duration]);
  var exportW = window.__EXPORT_W || width;
  var scale = exportW / width;
  return React.createElement('div', { style: { position: 'absolute', inset: 0, background: background } },
    React.createElement('div', { style: { position: 'absolute', left: '50%', top: '50%', width: width, height: height, background: background, overflow: 'hidden', transformOrigin: 'center', transform: 'translate(-50%,-50%) scale(' + scale + ')' } },
      React.createElement(TimelineContext.Provider, { value: ctx }, children)
    )
  );
}
`;

// The frame driver: registers the paused GSAP timeline the CLI seeks. Each step
// sets the scene time through flushSync so the committed DOM matches the frame
// before the screenshot. Gated on the React mount AND fonts being ready.
function buildDriver(fps: number, durationSeconds: number): string {
  return `
;(function(){
  var FPS = ${fps};
  var DUR_S = ${durationSeconds};
  var DUR_F = Math.round(DUR_S * FPS);
  function render(frame){
    var t = frame / FPS;
    if (window.__hfSetTime && window.ReactDOM && ReactDOM.flushSync){
      ReactDOM.flushSync(function(){ window.__hfSetTime(t); });
    } else if (window.__hfSetTime){
      window.__hfSetTime(t);
    }
  }
  window.__hfRender = render;
  function ready(){ return window.__hfReady && typeof gsap !== 'undefined'; }
  function build(){
    if (!ready()){ return setTimeout(build, 20); }
    var go = function(){
      render(0);
      var proxy = { f: 0 };
      var tl = gsap.timeline({ paused: true });
      tl.to(proxy, { f: DUR_F, duration: DUR_S, ease: 'none', onUpdate: function(){ render(proxy.f); } }, 0);
      window.__timelines = window.__timelines || {};
      window.__timelines['main'] = tl;
    };
    if (document.fonts && document.fonts.ready){ document.fonts.ready.then(go); } else { go(); }
  }
  build();
})();
`;
}

export interface BuildCompositionInput {
  sourceHtml: string;
  exportWidth: number;
  exportHeight: number;
  /** Output/scene fps. Capture conform is handled downstream by the queue. */
  fps?: number;
  /** Override the parsed duration (seconds). */
  durationSeconds?: number;
}

export interface BuildCompositionResult {
  html: string;
  durationSeconds: number;
  fps: number;
  /** Native canvas parsed from the source (for reference / UI). */
  native: { width: number; height: number };
}

// Extract the `<script type="text/babel">` body — the entire animation. We drop
// everything else in the source doc (bundler thumbnail templates, the original
// player chrome markup, etc.); the scene is fully self-contained in this script.
function extractBabelScript(sourceHtml: string): string | null {
  const m = sourceHtml.match(
    /<script[^>]*type=["']text\/babel["'][^>]*>([\s\S]*?)<\/script>/i,
  );
  return m ? m[1] : null;
}

export function buildClaudeDesignComposition(
  input: BuildCompositionInput,
): BuildCompositionResult {
  const parsed = parseClaudeDesignMeta(input.sourceHtml);
  const fps = input.fps && input.fps > 0 ? input.fps : parsed.fps;
  const durationSeconds =
    input.durationSeconds && input.durationSeconds > 0
      ? input.durationSeconds
      : parsed.durationSeconds;

  const babel = extractBabelScript(input.sourceHtml);
  if (!babel) {
    throw new Error(
      "Could not find a Claude Design animation in this file (no <script type=\"text/babel\"> block). Make sure you exported the standalone source HTML.",
    );
  }

  // Swap the player: every <Stage ...> usage → <ExportStage ...>. The original
  // `function Stage(...)` definition is left in place (now dead code, harmless);
  // ExportStage is appended and hoists, reusing the same TimelineContext.
  const scene =
    babel
      .replace(/<Stage(\s|>|\/)/g, "<ExportStage$1")
      .replace(/<\/Stage>/g, "</ExportStage>") + "\n" + EXPORT_STAGE_DEF;

  const { exportWidth, exportHeight } = input;
  const durationAttr = durationSeconds.toFixed(4);

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=${exportWidth}, height=${exportHeight}" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${CDN.fonts}" rel="stylesheet">
<script src="${CDN.react}"></script>
<script src="${CDN.reactDom}"></script>
<script src="${CDN.babel}"></script>
<script src="${CDN.gsap}"></script>
<style>
  html, body { margin: 0; padding: 0; width: ${exportWidth}px; height: ${exportHeight}px; overflow: hidden; background: #0a0a0a; }
  #root { position: fixed; inset: 0; }
  /* Frame-stepped capture can't advance CSS time, so freeze CSS motion — the
     scene's meaningful motion is all time-math and unaffected. */
  *, *::before, *::after { transition: none !important; animation: none !important; scroll-behavior: auto !important; }
</style>
<script>
  window.__EXPORT_W = ${exportWidth};
  window.__EXPORT_H = ${exportHeight};
  window.addEventListener('error', function (e) {
    try { document.body.innerHTML = '<pre style="color:#f87171;padding:48px;font:18px sans-serif;white-space:pre-wrap">Composition error:\\n' + (e.message || '') + '\\n' + (e.filename || '') + ':' + (e.lineno || '') + '</pre>'; } catch (_) {}
  });
</script>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${durationAttr}" data-width="${exportWidth}" data-height="${exportHeight}"></div>
<script type="text/babel" data-presets="react">
${scene}
</script>
<script>${buildDriver(fps, durationSeconds)}</script>
</body>
</html>`;

  return {
    html,
    durationSeconds,
    fps,
    native: { width: parsed.width, height: parsed.height },
  };
}
