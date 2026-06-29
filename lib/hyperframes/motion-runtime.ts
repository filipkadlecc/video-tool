// =============================================================================
// HyperFrames motion runtime — the Remotion motion vocabulary, ported to plain
// JS and injected verbatim into every HyperFrames composition (preview + render).
//
// This is the JS-string twin of remotion/motion.ts. The spring math is the
// closed-form solution of Remotion's `spring()` and was verified numerically
// identical (max abs diff 2.2e-16 across every preset / delay / fractional
// frame) — see the throwaway check in the engine-port experiment.
//
// Everything here is declared with `function` / `var` so the bindings live on
// the global object and stay visible to the (separately-tagged) scene + driver
// scripts. The template injects `C`, `F`, `W`, `H`, `base`, `FPS` ahead of this.
//
// Do NOT import anything here — it must run as a bare <script> in the iframe /
// headless browser with no bundler.
// =============================================================================

export const MOTION_RUNTIME_JS = String.raw`
// --- SPRING CONFIGS (mirror remotion/motion.ts SPRINGS) ---------------------
var SPRINGS = {
  SNAPPY:     { mass: 0.5, damping: 14, stiffness: 220 },
  ELASTIC:    { mass: 0.8, damping: 10, stiffness: 180 },
  LIQUID:     { mass: 1.0, damping: 22, stiffness: 120 },
  GENTLE:     { mass: 1.0, damping: 30, stiffness: 80 },
  OVERDAMPED: { damping: 200 },
};

// --- TIMING (frame counts, mirror remotion/motion.ts TIMING) ----------------
var TIMING = {
  entrance: 8, staggerLetter: 2, staggerItem: 12, staggerLong: 18, holdBeat: 30, exitTail: 14,
};

// --- spring(): closed-form damped oscillator from rest, == Remotion ----------
function _rawSpring(t, cfg) {
  var m = cfg.mass == null ? 1 : cfg.mass;
  var c = cfg.damping == null ? 10 : cfg.damping;
  var k = cfg.stiffness == null ? 100 : cfg.stiffness;
  var x0 = 1, v0 = 0, to = 1;
  var zeta = c / (2 * Math.sqrt(k * m));
  var omega0 = Math.sqrt(k / m);
  if (zeta < 1) {
    var omega1 = omega0 * Math.sqrt(1 - zeta * zeta);
    var env = Math.exp(-zeta * omega0 * t);
    return to - env * (((v0 + zeta * omega0 * x0) / omega1) * Math.sin(omega1 * t) + x0 * Math.cos(omega1 * t));
  }
  var env2 = Math.exp(-omega0 * t);
  return to - env2 * (x0 + (v0 + omega0 * x0) * t);
}

// springIn(frame, fps, delay?, preset?) — identical signature to motion.ts.
function springIn(frame, fps, delay, preset) {
  if (delay == null) delay = 0;
  var cfg = SPRINGS[preset || 'SNAPPY'] || SPRINGS.SNAPPY;
  var f = Math.max(0, frame - delay);   // matches Remotion's Math.max(0, frame-delay)
  return _rawSpring(f / fps, cfg);
}

function staggeredSpring(frame, fps, index, baseDelay, stagger, preset) {
  if (baseDelay == null) baseDelay = TIMING.entrance;
  if (stagger == null) stagger = TIMING.staggerItem;
  return springIn(frame, fps, baseDelay + index * stagger, preset || 'SNAPPY');
}

// --- interpolate(): linear, Remotion semantics (clamp/extend) ----------------
function interpolate(input, inR, outR, opts) {
  opts = opts || {};
  var eL = opts.extrapolateLeft || 'extend';
  var eR = opts.extrapolateRight || 'extend';
  var i;
  if (input <= inR[0]) { if (eL === 'clamp') return outR[0]; i = 0; }
  else if (input >= inR[inR.length - 1]) { if (eR === 'clamp') return outR[outR.length - 1]; i = inR.length - 2; }
  else { i = 0; while (i < inR.length - 2 && input > inR[i + 1]) i++; }
  var p = (input - inR[i]) / (inR[i + 1] - inR[i]);
  return outR[i] + p * (outR[i + 1] - outR[i]);
}

// --- ambientDrift(): deterministic smooth value-noise in [-amp, amp] ---------
function _hash(n) { var s = Math.sin(n) * 43758.5453123; return s - Math.floor(s); }
function _vnoise(x) { var i = Math.floor(x), f = x - i; var u = f * f * (3 - 2 * f); return (_hash(i) * (1 - u) + _hash(i + 1) * u) * 2 - 1; }
function ambientDrift(frame, amplitude, period, seed) {
  if (amplitude == null) amplitude = 4;
  if (period == null) period = 60;
  if (seed == null) seed = 0;
  var s = typeof seed === 'string' ? seed.length * 13.7 : seed;
  return _vnoise(frame / period + s * 1.7) * amplitude;
}

// --- compound entrance: opacity + translateY + scale + blur off one spring ---
function compoundReveal(frame, fps, opts) {
  opts = opts || {};
  var delay = opts.delay == null ? 0 : opts.delay;
  var preset = opts.preset || 'SNAPPY';
  var ty0 = opts.translateY == null ? 30 : opts.translateY;
  var sc0 = opts.scaleFrom == null ? 0.94 : opts.scaleFrom;
  var bl0 = opts.blurFrom == null ? 6 : opts.blurFrom;
  var p = springIn(frame, fps, delay, preset);
  return {
    opacity: p,
    transform: 'translateY(' + interpolate(p, [0, 1], [ty0, 0]) + 'px) scale(' + interpolate(p, [0, 1], [sc0, 1]) + ')',
    filter: 'blur(' + interpolate(p, [0, 1], [bl0, 0]) + 'px)',
  };
}

// --- staggered child entry ---------------------------------------------------
function staggerChild(index, frame, fps, opts) {
  opts = opts || {};
  var baseDelay = opts.baseDelay == null ? TIMING.entrance : opts.baseDelay;
  var perItem = opts.perItem == null ? TIMING.staggerItem : opts.perItem;
  var preset = opts.preset || 'SNAPPY';
  var fromY = opts.fromY == null ? 14 : opts.fromY;
  var fromScale = opts.fromScale == null ? 0.98 : opts.fromScale;
  var p = staggeredSpring(frame, fps, index, baseDelay, perItem, preset);
  return { opacity: p, transform: 'translateY(' + interpolate(p, [0, 1], [fromY, 0]) + 'px) scale(' + interpolate(p, [0, 1], [fromScale, 1]) + ')' };
}

// --- scene exit (recede via transform only — opacity stays 1, never to black) -
function sceneExit(frame, dur, exitTail) {
  if (dur == null) dur = Infinity;
  if (exitTail == null) exitTail = TIMING.exitTail;
  if (!isFinite(dur)) return { opacity: 1, transform: 'none' };
  var tail = Math.min(exitTail, Math.round(dur * 0.3));
  var raw = interpolate(frame, [dur - tail, dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  var e = raw * raw * (3 - 2 * raw);
  return { opacity: 1, transform: 'translateY(' + (e * -3) + '%) scale(' + (1 - e * 0.05) + ')' };
}

// --- symmetric in/out envelope for a whole scene -----------------------------
function inOutEnvelope(frame, fps, durationInFrames, opts) {
  opts = opts || {};
  var inDelay = opts.inDelay == null ? 0 : opts.inDelay;
  var inPreset = opts.inPreset || 'SNAPPY';
  var exitFrames = opts.exitFrames == null ? TIMING.exitTail : opts.exitFrames;
  var inProg = springIn(frame, fps, inDelay, inPreset);
  var outProg = interpolate(frame, [durationInFrames - exitFrames, durationInFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return Math.min(inProg, outProg);
}
`;
