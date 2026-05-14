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

import { spring, interpolate, type SpringConfig } from "remotion";
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

export const SPRINGS: Record<string, Partial<SpringConfig>> = {
  SNAPPY:     { mass: 0.5, damping: 14, stiffness: 220 },
  ELASTIC:    { mass: 0.8, damping: 10, stiffness: 180 },
  LIQUID:     { mass: 1.0, damping: 22, stiffness: 120 },
  GENTLE:     { mass: 1.0, damping: 30, stiffness: 80 },
  OVERDAMPED: { damping: 200 },
};

// =============================================================================
// TIMING — frame counts that feel right across the snippet library.
// =============================================================================

export const TIMING = {
  entrance: 8,        // first-element delay after a sequence boundary
  staggerLetter: 2,   // per-letter delay for word-by-word reveals
  staggerItem: 12,    // per-bullet/card delay for list reveals
  staggerLong: 18,    // for big chunky reveals (cards, panels)
  holdBeat: 30,       // minimum hold before the next beat starts
  exitTail: 14,       // frames reserved at the end for a fade-out
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
 * A compound entrance reveal — opacity + translateY + scale + blur, all driven
 * off a single spring. Returns a `{ opacity, transform, filter }` style object
 * ready to spread into `style={{ ... }}`.
 *
 * This is the "always combine 3+ axes" rule from the prompt, packaged as a
 * helper so the LLM can't forget half of them.
 */
export function compoundReveal(
  frame: number,
  fps: number,
  opts: {
    delay?: number;
    preset?: keyof typeof SPRINGS;
    translateY?: number;  // px to slide from (positive = slide up into place)
    scaleFrom?: number;   // starting scale
    blurFrom?: number;    // starting blur in px
  } = {}
): { opacity: number; transform: string; filter: string } {
  const {
    delay = 0,
    preset = "SNAPPY",
    translateY = 30,
    scaleFrom = 0.94,
    blurFrom = 6,
  } = opts;

  const progress = springIn(frame, fps, delay, preset);
  const ty = interpolate(progress, [0, 1], [translateY, 0]);
  const sc = interpolate(progress, [0, 1], [scaleFrom, 1]);
  const bl = interpolate(progress, [0, 1], [blurFrom, 0]);

  return {
    opacity: progress,
    transform: `translateY(${ty}px) scale(${sc})`,
    filter: `blur(${bl}px)`,
  };
}

/**
 * Symmetric in/out envelope for a single Sequence. Returns a `[0, 1]` value
 * that ramps in from `frame=0` (spring `inPreset`), holds at 1, and ramps out
 * over the last `exitFrames` frames. Multiply this by your opacity / use to
 * fade entire scenes cleanly.
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
