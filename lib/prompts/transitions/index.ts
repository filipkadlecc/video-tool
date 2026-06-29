import type { TransitionStyle } from "../../types";

export interface TransitionModeMeta {
  id: TransitionStyle;
  label: string;
  description: string;
}

// Mirrors STYLE_MODES (lib/prompts/styles/index.ts) — used by the New Project
// modal to render the picker.
export const TRANSITION_MODES: TransitionModeMeta[] = [
  {
    id: "cut",
    label: "Cut",
    description: "Clean, instant scene changes. Confident, edited feel.",
  },
  {
    id: "blend",
    label: "Blend",
    description: "Quick, soft cross-blend of the content. Smooth and calm.",
  },
  {
    id: "camera",
    label: "Camera",
    description: "A camera dolly/push between scenes. Cinematic, dynamic.",
  },
];

// Shared rules that apply to every mode. The Main Composition section of the base
// prompt already wires the persistent background + camera wrapper; this restates
// the non-negotiables so they win on recency.
const SHARED = `## Transitions — how scenes hand off

The background is painted ONCE at the composition root, inside the \`cameraDrift\` wrapper, and every scene is TRANSPARENT foreground-only (see "Main Composition"). A transition therefore only ever swaps the FOREGROUND — the world never resets. That is what keeps scene changes from looking like a slideshow.

Non-negotiable for every transition:
- NEVER render \`<Background />\` inside a scene. NEVER give a scene's outer \`<AbsoluteFill>\` a \`backgroundColor\`.
- NEVER use \`sceneExit\` or any recede-before-transition (no scale-down + drift-away). That "shrink then fade" is the cheap move we are eliminating.
- NEVER use \`slide\` / \`wipe\` / \`clock-wipe\` / \`flip\` / \`iris\` — they read as PowerPoint.
- The \`timing={linearTiming({ durationInFrames: TRANSITION })}\` attribute is REQUIRED and must stay literal on every \`<TransitionSeries.Transition>\` (the timeline editor reads the overlap from it).
- Keep the \`cameraDrift(useCurrentFrame(), durationInFrames)\` wrapper around the whole composition — it is the always-on backbone for all modes.`;

const TRANSITION_PROMPTS: Record<TransitionStyle, string> = {
  cut: `${SHARED}

### This project's transition style: CUT

The foreground CUTS cleanly to the next scene — no blend, no scale, no recede.

- Use \`presentation={hardCut()}\` on EVERY \`<TransitionSeries.Transition>\`.
- Set \`const TRANSITION = Math.max(1, Math.round(fps / 25));\` — a 1-frame overlap: enough for the timeline parser, invisible to the eye.
- Sell continuity through (a) the persistent background that holds across the cut and (b) CONFIDENT entrances: each scene's hero is already in motion on its first frame (a SNAPPY/LIQUID spring arriving via translate/scale — never opacity-from-0 on a blank frame).
- Vary entrance directions scene to scene so consecutive cuts don't feel identical, but never add an exit animation.`,

  blend: `${SHARED}

### This project's transition style: BLEND

A quick, soft, content-only blend — the next scene resolves in over the current one while the shared background stays put.

- Use \`presentation={crossDissolve()}\` on EVERY \`<TransitionSeries.Transition>\`.
- Set \`const TRANSITION = Math.round(10 * fps / 25);\` — short and quick (not a long, lingering dissolve).
- Because scenes are transparent over the shared background, only the FOREGROUND blends — do not fade whole frames, and do not recede underneath the blend.`,

  camera: `${SHARED}

### This project's transition style: CAMERA

A motivated camera move between scenes — a dolly/push "through the lens", NEVER a lateral slide.

- Use \`presentation={cameraPush()}\` on EVERY \`<TransitionSeries.Transition>\` (pure dolly — do NOT pass pan options; a pan without a push is a slide).
- Set \`const TRANSITION = Math.round(20 * fps / 25);\` — long enough to read the move.
- \`cameraDrift\` remains the slow backbone over the whole piece; \`cameraPush\` is the punctuation at each seam. The exiting scene pushes forward and softens while the next arrives from depth into focus — one continuous push.`,
};

export function getTransitionPrompt(mode: TransitionStyle | undefined): string {
  return TRANSITION_PROMPTS[mode ?? "cut"];
}
