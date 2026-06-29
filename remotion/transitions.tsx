// Transition toolkit.
//
// FOUNDATION (all modes): the background is painted ONCE at the composition root,
// behind the TransitionSeries, and every scene is TRANSPARENT foreground-only. So
// a "transition" only ever swaps the FOREGROUND — the world never resets. That's
// what stops scene changes reading as a slideshow (a slideshow is two whole
// frames crossfading). NEVER use canned effects (slide / wipe / clock-wipe) —
// they read as PowerPoint.
//
// The user picks one of three transition styles per project (see
// lib/prompts/transitions); the generator emits the matching presentation:
//   • cut    → hardCut()       — a clean, instant foreground cut.
//   • blend  → crossDissolve() — a quick, soft, NO-BLACK foreground blend.
//   • camera → cameraPush()    — a motivated dolly-through (not a slide).
//
// cameraDrift() is the always-on backbone: one slow camera move over the WHOLE
// composition (root frame) that wraps both the Background and the scenes.
//
// DynamicScene.tsx resolves this module so LLM-generated scenes can:
//   import { crossDissolve, hardCut, cameraPush, cameraDrift, linearTiming } from "../transitions";

import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import {
  linearTiming,
  springTiming,
  type TransitionPresentation,
  type TransitionPresentationComponentProps,
} from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";

// Default transition length in frames. A touch longer than a hard cut so the
// blend stays soft. Keep in sync with the TRANSITION constant in generated
// compositions (see lib/prompts/base.ts).
export const TRANSITION_FRAMES = 18;

// smoothstep ease — gentler than linear, no overshoot.
const ease = (t: number) => t * t * (3 - 2 * t);

// crossDissolve has no tunable props.
type CrossDissolveProps = Record<string, never>;

const CrossDissolvePresentation: React.FC<
  TransitionPresentationComponentProps<CrossDissolveProps>
> = ({ children, presentationProgress, presentationDirection }) => {
  const p = ease(presentationProgress);

  if (presentationDirection === "exiting") {
    // Stay FULLY lit underneath the whole time — this is what guarantees there
    // is never a luminance gap (no black). A whisper of scale keeps it alive.
    return (
      <AbsoluteFill style={{ opacity: 1, transform: `scale(${1 + p * 0.006})` }}>
        {children}
      </AbsoluteFill>
    );
  }

  // Entering scene resolves IN on top: fade up + micro deblur + barely-there
  // settle, so it "comes into focus" rather than flatly fading.
  return (
    <AbsoluteFill
      style={{
        opacity: p,
        transform: `scale(${1.012 - 0.012 * p})`,
        filter: `blur(${(1 - p) * 1.5}px)`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/**
 * A soft, no-black blend between two scenes. The entering scene resolves in on
 * top while the exiting scene stays fully lit underneath, so total coverage
 * never drops — there is no fade to black and no hard cut. Use it as the glue at
 * every scene boundary; keep the duration short (≈TRANSITION) so it's felt, not
 * seen. Pair it with cameraDrift() + momentum exits for true seamless flow.
 *
 *   <TransitionSeries.Transition
 *     presentation={crossDissolve()}
 *     timing={linearTiming({ durationInFrames: TRANSITION })}
 *   />
 */
export function crossDissolve(): TransitionPresentation<CrossDissolveProps> {
  return { component: CrossDissolvePresentation, props: {} };
}

// hardCut has no tunable props.
type HardCutProps = Record<string, never>;

const HardCutPresentation: React.FC<
  TransitionPresentationComponentProps<HardCutProps>
> = ({ children, presentationProgress, presentationDirection }) => {
  // Instant swap at the midpoint — no opacity/scale/blur ramp. The exiting scene
  // holds until halfway, then the entering scene takes over. Both are foreground
  // only (the background is persistent), so the 1-frame overlap never shows a gap.
  const visible =
    presentationDirection === "exiting"
      ? presentationProgress < 0.5
      : presentationProgress >= 0.5;
  return <AbsoluteFill style={{ opacity: visible ? 1 : 0 }}>{children}</AbsoluteFill>;
};

/**
 * A clean, instant cut between scenes — the foreground snaps to the next scene
 * with no blend, scale, or recede. Stays inside TransitionSeries (so the timeline
 * stays parseable); pair it with a 1-frame timing so it reads as a true cut:
 *
 *   const TRANSITION = Math.max(1, Math.round(fps / 25));
 *   <TransitionSeries.Transition
 *     presentation={hardCut()}
 *     timing={linearTiming({ durationInFrames: TRANSITION })}
 *   />
 *
 * Continuity comes from the persistent background + confident scene entrances —
 * NOT from the transition itself.
 */
export function hardCut(): TransitionPresentation<HardCutProps> {
  return { component: HardCutPresentation, props: {} };
}

export interface CameraDriftOptions {
  /** Total zoom over the whole piece. 0.05 = ends 5% pushed in. Default 0.05. */
  zoom?: number;
  /** Horizontal pan as a fraction of width across the whole piece. Default 0. */
  panX?: number;
  /** Vertical pan as a fraction of height across the whole piece. Default -0.012. */
  panY?: number;
}

/**
 * ONE slow, monotonic camera move spanning the ENTIRE composition. Drive it with
 * the ROOT frame (`useCurrentFrame()` at the composition top level, NOT a scene-
 * local frame) so it never resets between scenes — that unbroken motion is what
 * makes separate scenes read as a single continuous shot.
 *
 *   const { width, height, durationInFrames } = useVideoConfig();
 *   const camera = cameraDrift(useCurrentFrame(), durationInFrames);
 *   <AbsoluteFill style={{ transform: camera.transform, transformOrigin: "50% 50%" }}>
 *     <TransitionSeries> ... </TransitionSeries>
 *   </AbsoluteFill>
 *
 * Keep it subtle (the defaults are): felt, not obvious. A scale slightly above 1
 * also hides the sub-pixel edges of the pan so no background seam shows.
 */
export function cameraDrift(
  rootFrame: number,
  totalFrames: number,
  opts: CameraDriftOptions = {}
): { transform: string } {
  const { zoom = 0.05, panX = 0, panY = -0.012 } = opts;
  const span = Math.max(1, totalFrames);
  const t = ease(interpolate(rootFrame, [0, span], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  }));
  const scale = 1 + zoom * t;
  const tx = panX * 100 * t; // % of element box
  const ty = panY * 100 * t;
  return { transform: `scale(${scale}) translate(${tx}%, ${ty}%)` };
}

export type CameraPushOptions = {
  /** How far the dolly travels through the lens. 0.18 = ±18% scale. Default 0.16. */
  depth?: number;
};

const CameraPushPresentation: React.FC<
  TransitionPresentationComponentProps<CameraPushOptions>
> = ({ children, presentationProgress, presentationDirection, passedProps }) => {
  const depth = passedProps?.depth ?? 0.16;
  const p = ease(presentationProgress);

  if (presentationDirection === "exiting") {
    // The exiting scene continues toward / through the lens: scales UP past 1 and
    // softens, as if the camera dollies into it. Stays lit (barely fades).
    return (
      <AbsoluteFill
        style={{
          opacity: 1 - p * 0.15,
          transform: `scale(${1 + depth * p})`,
          filter: `blur(${p * 4}px)`,
          transformOrigin: "50% 50%",
        }}
      >
        {children}
      </AbsoluteFill>
    );
  }

  // The entering scene arrives FROM depth (larger than 1) and settles into focus
  // on the SAME vector, so the eye reads one continuous push — not two layers.
  return (
    <AbsoluteFill
      style={{
        opacity: p,
        transform: `scale(${1 + depth * (1 - p)})`,
        filter: `blur(${(1 - p) * 4}px)`,
        transformOrigin: "50% 50%",
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/**
 * A motivated camera move between scenes — a dolly "through the lens", NOT a
 * lateral slide. The exiting scene pushes forward (scales up + softens) while the
 * next arrives from depth and settles into focus on the same vector, so it reads
 * as one continuous camera push. Pure dolly by design — there is intentionally no
 * pan option (a pan without a push is the slide-panel look we avoid).
 *
 *   <TransitionSeries.Transition
 *     presentation={cameraPush()}
 *     timing={linearTiming({ durationInFrames: TRANSITION })}
 *   />
 */
export function cameraPush(
  opts: CameraPushOptions = {}
): TransitionPresentation<CameraPushOptions> {
  return { component: CameraPushPresentation, props: opts };
}

// `fade` is kept ONLY as a rare, deliberate mood/topic-reset escape hatch — it
// is NOT the default. `linearTiming`/`springTiming` are re-exported for the
// explicit timing attribute on each <TransitionSeries.Transition>.
export { fade, linearTiming, springTiming };
