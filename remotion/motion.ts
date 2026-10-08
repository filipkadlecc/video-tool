// Shared motion primitives for branded snippets and LLM-generated scenes.
//
// Everything here is FRAME-based. Do NOT port the design system's
// `transitions.json` (CSS easings like "0.3s ease-in") — those are web-UI
// timings and don't translate to video. Springs > easings for motion in
// Remotion.
//
// All snippets in remotion/scenes/branded/ import from here, and the LLM is
// instructed (lib/prompts/base.ts) to import from here too. The
// DynamicScene.tsx Sucrase shim resolves "remotion/motion" + a few path
// variants to this module.

import React, { createContext, useContext } from "react";
import { spring, interpolate, useVideoConfig, type SpringConfig } from "remotion";
import { noise2D } from "@remotion/noise";

// =============================================================================
// SPRING CONFIGS — pick by mood, mix within a single scene for life.
// =============================================================================
//
// Rule of thumb:
// - SNAPPY    → reveals you want to feel punchy (titles, big numbers)
// - ELASTIC   → playful overshoot (badges, icons popping in)
// - LIQUID    → smooth, premium, no bounce (full-bleed cards, cinematic)
// - GENTLE    → ambient micro-motion, secondary labels, ease-outs
// - OVERDAMPED→ "just no bounce please" — fine for utility text, avoid for hero elements
//
// DO NOT redefine these in generated code. Import them from motion.ts.

// ── Motion style ─────────────────────────────────────────────────────────────
// A document picks "classic" (the presets above, how every project moved until
// v0.1.165) or "new" (the Opus 5.5 motion-design article's: quicker to settle,
// heavier where it should be). Flipping it re-feels a whole video without
// touching its code — the classic names resolve to their closest new match:
//   SNAPPY → UI · ELASTIC → PLAYFUL · LIQUID → DEFAULT · GENTLE → HEAVY
// The new names themselves (UI, DEFAULT, HEAVY, PLAYFUL) are always there, so
// a scene can ask for HEAVY on purpose whichever style it is in.

export type MotionStyle = "classic" | "new";

const CLASSIC_SPRINGS: Record<string, Partial<SpringConfig>> = {
  SNAPPY:     { mass: 0.5, damping: 14, stiffness: 220 },
  ELASTIC:    { mass: 0.8, damping: 10, stiffness: 180 },
  LIQUID:     { mass: 1.0, damping: 22, stiffness: 120 },
  GENTLE:     { mass: 1.0, damping: 30, stiffness: 80 },
  OVERDAMPED: { damping: 200 },
};

const NEW_NAMED: Record<string, Partial<SpringConfig>> = {
  UI:      { mass: 1, damping: 30, stiffness: 320 }, // buttons, toggles, leading edges
  DEFAULT: { mass: 1, damping: 26, stiffness: 170 }, // cards, containers, camera
  HEAVY:   { mass: 3, damping: 32, stiffness: 120 }, // big type, 3D, logo lockups
  PLAYFUL: { mass: 1, damping: 12, stiffness: 260 }, // mascots, stickers — visible overshoot
};

const TABLES: Record<MotionStyle, Record<string, Partial<SpringConfig>>> = {
  classic: { ...CLASSIC_SPRINGS, ...NEW_NAMED },
  new: {
    SNAPPY: NEW_NAMED.UI,
    ELASTIC: NEW_NAMED.PLAYFUL,
    LIQUID: NEW_NAMED.DEFAULT,
    GENTLE: NEW_NAMED.HEAVY,
    OVERDAMPED: CLASSIC_SPRINGS.OVERDAMPED,
    ...NEW_NAMED,
  },
};

/*
 * Set by the composition root on every render (EditorComposition from the
 * document, a render entry from the project) before any scene reads a spring.
 * A module variable rather than context because springs are read in plain
 * functions, not only in components.
 */
let activeStyle: MotionStyle = "classic";
export function setMotionStyle(style: MotionStyle | undefined): void {
  activeStyle = style === "new" ? "new" : "classic";
}
export function getMotionStyle(): MotionStyle {
  return activeStyle;
}

export const SPRINGS: Record<string, Partial<SpringConfig>> = new Proxy({} as Record<string, Partial<SpringConfig>>, {
  get: (_t, key) => (typeof key === "string" ? TABLES[activeStyle][key] : undefined),
  has: (_t, key) => typeof key === "string" && key in TABLES[activeStyle],
  ownKeys: () => Reflect.ownKeys(TABLES[activeStyle]),
  getOwnPropertyDescriptor: (_t, key) =>
    typeof key === "string" && key in TABLES[activeStyle]
      ? { value: TABLES[activeStyle][key], enumerable: true, configurable: true, writable: false }
      : undefined,
});

// =============================================================================
// TIMING — frame counts that feel right across the snippet library.
// =============================================================================

export const TIMING = {
  entrance: 8,        // first-element delay after a sequence boundary
  staggerLetter: 2,   // per-letter delay for word-by-word reveals
  staggerItem: 12,    // per-bullet/card delay for list reveals
  staggerLong: 18,    // for big chunky reveals (cards, panels)
  holdBeat: 30,       // minimum hold before the next beat starts
  exitTail: 14,       // library snippets' end fade (inOutEnvelope default) — generated videos pass exitFrames: 0
};

// =============================================================================
// HELPERS
// =============================================================================

/**
 * `spring()` with a SPRINGS preset by name and a delay. Returns a 0→1 progress
 * value. Replaces every `spring({ frame, fps, delay, config: { damping: 200 } })`
 * boilerplate in the codebase.
 */
export function springIn(
  frame: number,
  fps: number,
  delay: number = 0,
  preset: keyof typeof SPRINGS = "SNAPPY"
): number {
  return spring({ frame, fps, delay, config: SPRINGS[preset] });
}

/**
 * Staggered spring for list items. Index 0 starts at `baseDelay`, each subsequent
 * item delayed by `stagger`. Returns 0→1 progress.
 */
export function staggeredSpring(
  frame: number,
  fps: number,
  index: number,
  baseDelay: number = TIMING.entrance,
  stagger: number = TIMING.staggerItem,
  preset: keyof typeof SPRINGS = "SNAPPY"
): number {
  return spring({
    frame,
    fps,
    delay: baseDelay + index * stagger,
    config: SPRINGS[preset],
  });
}

/**
 * A value that changes target several times — a cursor moving A→B→C, a bar
 * growing twice, a counter stepping up — as ONE continuous motion.
 *
 * Restarting a spring at each change makes the value jump back and snap.
 * Instead, every change adds its own spring, starting at its own frame, that
 * carries the difference to the new target. Mid-flight changes blend: the next
 * move starts while the last is still settling, the way a real object would.
 *
 *   const x = track(frame, fps, 200, [{ at: 30, to: 900 }, { at: 75, to: 540 }]);
 *
 * `at` is the frame the change starts. Pure function of the frame, so every
 * render is identical.
 */
export function track(
  frame: number,
  fps: number,
  from: number,
  steps: { at: number; to: number; preset?: keyof typeof SPRINGS }[],
  preset: keyof typeof SPRINGS = "LIQUID"
): number {
  let value = from;
  let target = from;
  for (const step of steps) {
    const p = spring({ frame, fps, delay: step.at, config: SPRINGS[step.preset ?? preset] });
    value += (step.to - target) * p;
    target = step.to;
  }
  return value;
}

/**
 * @deprecated The recede-before-transition (scale-down + drift) reads as the cheap
 * "shrink and fade" exit. The transition system now owns scene handoffs: a
 * persistent root background plus hardCut() / crossDissolve() / cameraPush() (see
 * remotion/transitions.tsx and lib/prompts/transitions). Kept ONLY so older saved
 * compositions that still call sceneExit keep rendering — do NOT use it in new code.
 *
 * Scene EXIT — the counterpart to springIn. Without it, scenes only animate
 * IN, then hold and get hard-cut away, which reads as a jump cut.
 *
 * Returns { opacity, transform } to spread onto a wrapping container around a
 * scene's content. In the last `exitTail` frames the content RECEDES via
 * TRANSFORM ONLY — a gentle scale-down and upward drift. Opacity is held at 1
 * the whole time: the scene stays fully lit underneath while the next scene's
 * slide/wipe transition physically covers it, so there is NO luminance dip to
 * black between scenes (the old opacity→0 ramp was exactly that dip).
 *
 * `dur` = the frame at which the exit completes. For a TransitionSeries
 * sequence, pass the scene's CONTENT duration so the recede finishes just as
 * the transition begins. Pass `Infinity` (the default) to disable — do this for
 * the FINAL scene of a composition, whose last frame must stay present (see the
 * no-fade-to-black rule).
 */
export function sceneExit(
  frame: number,
  dur: number = Infinity,
  exitTail: number = TIMING.exitTail
): { opacity: number; transform: string } {
  if (!isFinite(dur)) return { opacity: 1, transform: "none" };
  const tail = Math.min(exitTail, Math.round(dur * 0.3));
  const raw = interpolate(frame, [dur - tail, dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const e = raw * raw * (3 - 2 * raw); // smoothstep ease
  return {
    opacity: 1, // stay fully lit — the transition owns the visual handoff, no fade to black
    transform: `translateY(${e * -3}%) scale(${1 - e * 0.05})`,
  };
}

/**
 * Organic ambient drift driven by perlin noise. Returns a value in
 * [-amplitude, +amplitude]. Use during HOLD phases on every visible element so
 * nothing freezes. Pass a unique `seed` per element so multiple elements drift
 * out of phase.
 *
 * Replaces the older `Math.sin(frame/25) * amplitude` hack — sin produces
 * obviously-periodic motion; noise feels alive.
 */
export function ambientDrift(
  frame: number,
  amplitude: number = 4,
  period: number = 60,
  seed: string | number = 0
): number {
  return noise2D(seed, frame / period, 0) * amplitude;
}

/**
 * A compound entrance reveal — opacity + translateY + scale, all driven off a
 * single spring. Returns a `{ opacity, transform, filter }` style object ready
 * to spread into `style={{ ... }}`.
 *
 * NOTE: reveal blur is BANNED — elements must arrive SHARP. `blurFrom` defaults
 * to 0 and `filter` is "none" unless a caller explicitly opts in. Do not
 * reintroduce an animated blur-in on entrances.
 */
export function compoundReveal(
  frame: number,
  fps: number,
  opts: {
    delay?: number;
    preset?: keyof typeof SPRINGS;
    translateY?: number;  // px to slide from (positive = slide up into place)
    scaleFrom?: number;   // starting scale
    blurFrom?: number;    // deprecated — reveal blur is banned; leave 0
  } = {}
): { opacity: number; transform: string; filter: string } {
  const {
    delay = 0,
    preset = "SNAPPY",
    translateY = 30,
    scaleFrom = 0.94,
    blurFrom = 0,
  } = opts;

  const progress = springIn(frame, fps, delay, preset);
  const ty = interpolate(progress, [0, 1], [translateY, 0]);
  const sc = interpolate(progress, [0, 1], [scaleFrom, 1]);
  const bl = interpolate(progress, [0, 1], [blurFrom, 0]);

  return {
    opacity: progress,
    transform: `translateY(${ty}px) scale(${sc})`,
    filter: bl > 0 ? `blur(${bl}px)` : "none",
  };
}

/**
 * Symmetric in/out envelope for a single Sequence. Returns a `[0, 1]` value
 * that ramps in from `frame=0` (spring `inPreset`), holds at 1, and ramps out
 * over the last `exitFrames` frames. Multiply this by your opacity / use to
 * fade entire scenes cleanly.
 *
 * The fade-out is for library snippets dropped standalone onto a timeline.
 * Inside a generated video pass `{ exitFrames: 0 }`: scenes hold to their
 * boundary and the transition does the handoff (no fade from/to black).
 */
export function inOutEnvelope(
  frame: number,
  fps: number,
  durationInFrames: number,
  opts: { inDelay?: number; inPreset?: keyof typeof SPRINGS; exitFrames?: number } = {}
): number {
  const { inDelay = 0, inPreset = "SNAPPY", exitFrames = TIMING.exitTail } = opts;
  const inProg = springIn(frame, fps, inDelay, inPreset);
  const exitStart = durationInFrames - exitFrames;
  const outProg = interpolate(frame, [exitStart, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return Math.min(inProg, outProg);
}

// =============================================================================
// SVG-AWARE PRIMITIVES
// =============================================================================
// These help the AI animate ONLY the deltas between SVG frames instead of
// crossfading whole rasters. Use them with `clipPath: clipRevealInset(...)` on
// the new-frame layer to expose just the added region.

export interface Inset { top: number; right: number; bottom: number; left: number }
export interface BBox { x: number; y: number; w: number; h: number }

/**
 * Animated CSS `clip-path: inset(...)` string. All values are PERCENTAGES of
 * the containing box. Caller passes a 0→1 `progress` (typically from
 * `springIn`); the inset interpolates from `from` (collapsed/hidden) to `to`
 * (fully revealed).
 *
 *   <div style={{ clipPath: clipRevealInset(progress, hidden, full) }}>
 *
 * Common pattern: hide a band by setting `bottom` = `100 - top` (zero height
 * at the top edge), then reveal by lowering `bottom` to the final value.
 */
export function clipRevealInset(progress: number, from: Inset, to: Inset): string {
  const lerp = (a: number, b: number) => a + (b - a) * progress;
  return `inset(${lerp(from.top, to.top)}% ${lerp(from.right, to.right)}% ${lerp(from.bottom, to.bottom)}% ${lerp(from.left, to.left)}%)`;
}

/**
 * Convenience: a band reveal driven by a bbox in viewBox coordinates. Pass the
 * bbox of the element that's "new" in this frame plus the SVG's viewBox; get
 * back an animated clip-path that slides the band open from one axis.
 *
 *   axis="y" → band starts collapsed at the TOP of the bbox, expands downward
 *   axis="x" → band starts collapsed at the LEFT of the bbox, expands rightward
 */
export function slideRevealBand(
  progress: number,
  axis: "x" | "y",
  bbox: BBox,
  viewBox: { x: number; y: number; w: number; h: number }
): string {
  const top    = ((bbox.y - viewBox.y) / viewBox.h) * 100;
  const bottom = ((viewBox.y + viewBox.h - (bbox.y + bbox.h)) / viewBox.h) * 100;
  const left   = ((bbox.x - viewBox.x) / viewBox.w) * 100;
  const right  = ((viewBox.x + viewBox.w - (bbox.x + bbox.w)) / viewBox.w) * 100;
  if (axis === "y") {
    const from: Inset = { top, right, bottom: 100 - top, left };       // zero height
    const to:   Inset = { top, right, bottom, left };
    return clipRevealInset(progress, from, to);
  }
  const from: Inset = { top, right: 100 - left, bottom, left };
  const to:   Inset = { top, right, bottom, left };
  return clipRevealInset(progress, from, to);
}

/**
 * Stroke draw-on. Returns `strokeDasharray` / `strokeDashoffset` / `opacity`
 * values for a `<path>` so its stroke draws on from one end. Spring-driven.
 *
 *   const draw = drawPath(frame, fps, 1200, { delay: 10 });
 *   <path d="..." stroke="..." fill="none" {...draw} />
 *
 * If you don't know the path length, use a generous estimate (1000-2000).
 */
export function drawPath(
  frame: number,
  fps: number,
  pathLength: number,
  opts: { delay?: number; preset?: keyof typeof SPRINGS } = {}
): { strokeDasharray: number; strokeDashoffset: number; opacity: number } {
  const { delay = TIMING.entrance, preset = "LIQUID" } = opts;
  const progress = springIn(frame, fps, delay, preset);
  return {
    strokeDasharray: pathLength,
    strokeDashoffset: interpolate(progress, [0, 1], [pathLength, 0]),
    opacity: Math.min(1, progress * 3), // fade in the stroke faster than it draws
  };
}

/**
 * Staggered entry for the i-th child in a group of n. Returns
 * `{ opacity, transform }` ready to spread into a style. Each child enters
 * `perItem` frames after the previous one. Use for revealing the items of a
 * list, the rows of a table, or the children of a panel.
 *
 *   {items.map((it, i) => (
 *     <div key={i} style={staggerChild(i, frame, fps, { fromY: 18 })}>{...}</div>
 *   ))}
 */
export function staggerChild(
  index: number,
  frame: number,
  fps: number,
  opts: {
    baseDelay?: number;
    perItem?: number;
    preset?: keyof typeof SPRINGS;
    fromY?: number;
    fromScale?: number;
  } = {}
): { opacity: number; transform: string } {
  const {
    baseDelay = TIMING.entrance,
    perItem = TIMING.staggerItem,
    preset = "SNAPPY",
    fromY = 14,
    fromScale = 0.98,
  } = opts;
  const progress = staggeredSpring(frame, fps, index, baseDelay, perItem, preset);
  const ty = interpolate(progress, [0, 1], [fromY, 0]);
  const sc = interpolate(progress, [0, 1], [fromScale, 1]);
  return {
    opacity: progress,
    transform: `translateY(${ty}px) scale(${sc})`,
  };
}

// =============================================================================
// <SvgFrame> — render an uploaded SVG verbatim, by index.
// =============================================================================
// The AI uses this to reference the user's source SVG without having to paste
// 30-100KB of XML into its generated code. The component reads the project's
// `svgContents` array from React context (set by DynamicScene). Animate by
// passing `style` props (opacity, transform, clipPath) — the visual content
// stays pixel-faithful to the user's asset.
//
//   import { SvgFrame, springIn, slideRevealBand } from "remotion/motion";
//   <SvgFrame index={0} />
//   <SvgFrame index={1} style={{ clipPath: slideRevealBand(t, "y", bbox, vb) }} />

export interface SvgFrameSlot {
  filename: string;
  content: string;
}

const SvgFramesContext = createContext<SvgFrameSlot[]>([]);

export const SvgFramesProvider: React.FC<{
  value: SvgFrameSlot[];
  children: React.ReactNode;
}> = ({ value, children }) =>
  React.createElement(SvgFramesContext.Provider, { value }, children);

export function useSvgFrames(): SvgFrameSlot[] {
  return useContext(SvgFramesContext);
}

export interface SvgFrameProps {
  index: number;
  style?: React.CSSProperties;
  className?: string;
}

export const SvgFrame: React.FC<SvgFrameProps> = ({ index, style, className }) => {
  const frames = useSvgFrames();
  const svg = frames[index];
  if (!svg) return null;
  return React.createElement("div", {
    className,
    style: {
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      ...style,
    },
    dangerouslySetInnerHTML: { __html: svg.content },
  });
};

// =============================================================================
// LAYOUT — one scene, every shape
// =============================================================================

export type LayoutOrientation = "horizontal" | "vertical" | "square";

/**
 * Lay a scene out against the canvas it is actually rendering at, so the same
 * code exports 16:9, 9:16 and 1:1 without being rewritten.
 *
 * - `u` is the size unit: 1 at a 1080px short edge. Write `fontSize: 96 * u`,
 *   never `fontSize: 96`, and a 4K render is a true 2× and a vertical cut keeps
 *   its type readable.
 * - `safe` is the margin nothing important should cross. Vertical leaves room
 *   for the TikTok / Shorts UI on the right and bottom.
 * - `pick` is for the few things that genuinely differ per shape — a row that
 *   becomes a column, a headline that breaks onto two lines.
 */
export function useLayout() {
  const { width, height } = useVideoConfig();
  const orientation: LayoutOrientation =
    width > height * 1.1 ? "horizontal" : height > width * 1.1 ? "vertical" : "square";
  const u = Math.min(width, height) / 1080;
  const safe =
    orientation === "vertical"
      ? { top: height * 0.08, right: width * 0.12, bottom: height * 0.2, left: width * 0.06 }
      : orientation === "square"
        ? { top: height * 0.07, right: width * 0.07, bottom: height * 0.07, left: width * 0.07 }
        : { top: height * 0.07, right: width * 0.06, bottom: height * 0.07, left: width * 0.06 };
  const pick = <T,>(options: { horizontal: T; vertical?: T; square?: T }): T =>
    options[orientation] ?? options.horizontal;
  return { width, height, orientation, u, safe, pick, cx: width / 2, cy: height / 2 };
}
