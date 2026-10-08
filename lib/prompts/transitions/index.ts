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

The background is painted ONCE at the composition root, outside any camera transform, and every scene is TRANSPARENT foreground-only (see "Main Composition"). A transition therefore only ever swaps the FOREGROUND — the world never resets. That is what keeps scene changes from looking like a slideshow.

Non-negotiable for every transition:
- NEVER render \`<Background />\` inside a scene. NEVER give a scene's outer \`<AbsoluteFill>\` a \`backgroundColor\`.
- NEVER use \`sceneExit\` or any recede-before-transition (no scale-down + drift-away). That "shrink then fade" is the cheap move we are eliminating.
- NEVER use \`slide\` / \`wipe\` / \`clock-wipe\` / \`flip\` / \`iris\` — they read as PowerPoint.
- The \`timing={linearTiming({ durationInFrames: TRANSITION })}\` attribute is REQUIRED and must stay literal on every \`<TransitionSeries.Transition>\` (the timeline editor reads the overlap from it).
- NO \`cameraDrift\` zoom unless the user explicitly asks for one (base rule 17). If they do, it goes on the content layer only — the background never zooms.

### Handoffs — every scene should come out of the one before

The transition style below decides HOW the foreground swaps. What makes a video feel designed is WHAT carries across the swap — the viewer should think "of course the next shot came from that". Plan a handoff for every scene change in the shot list, and build it:
- **Match cut** — the outgoing scene's last composition and the incoming scene's first share an element at the same position and size: the same card, number, word, icon or shape. Put the shared geometry in one \`const\` both scenes read, so it lines up to the pixel. On the swap, everything around it changes while it stays put — then it moves on.
- **Shape becomes container** — a pill, card, dot or line in scene A is exactly where scene B's content opens from: B's first frame has that same rectangle, then it grows into B's layout.
- **Carry** — something that must keep MOVING across the boundary (a card becoming the next screen, a cursor, a counter, a running label or player bar) lives in the root \`CarryLayer\` (see "Main Composition") on the root frame, so the boundary cannot reset it.
- **Plain swap** — nothing shared. Allowed, but deliberate and rare (at most one boundary in three), ideally a rhythmic cut on a downbeat.
A handoff is not an exit animation: the outgoing scene still holds fully present to its boundary, and nothing shrinks or fades away.`;

const TRANSITION_PROMPTS: Record<TransitionStyle, string> = {
  cut: `${SHARED}

### This project's transition style: CUT

The foreground CUTS cleanly to the next scene — no blend, no scale, no recede.

- Use \`presentation={hardCut()}\` on EVERY \`<TransitionSeries.Transition>\`.
- Set \`const TRANSITION = Math.max(1, Math.round(fps / 25));\` — a 1-frame overlap: enough for the timeline parser, invisible to the eye.
- Sell continuity through (a) the persistent background that holds across the cut and (b) CONFIDENT entrances: each scene's hero is already in motion on its first frame (a SNAPPY/LIQUID spring arriving via translate/scale — never opacity-from-0 on a blank frame).
- Vary entrance directions scene to scene so consecutive cuts don't feel identical, but never add an exit animation.
- A cut is where match cuts shine: the shared element holds still across the cut while everything around it changes.`,

  blend: `${SHARED}

### This project's transition style: BLEND

A quick, soft, content-only blend — the next scene resolves in over the current one while the shared background stays put.

- Use \`presentation={crossDissolve()}\` on EVERY \`<TransitionSeries.Transition>\`.
- Set \`const TRANSITION = Math.round(10 * fps / 25);\` — short and quick (not a long, lingering dissolve).
- Because scenes are transparent over the shared background, only the FOREGROUND blends — do not fade whole frames, and do not recede underneath the blend.
- Keep a matched element IDENTICAL in both scenes (same position, size and colour) so only everything around it blends. Never put the incoming headline where the outgoing headline was — two lines of copy would show through each other during the blend.`,

  camera: `${SHARED}

### This project's transition style: CAMERA

A motivated camera move between scenes — a dolly/push "through the lens", NEVER a lateral slide.

- Use \`presentation={cameraPush()}\` on EVERY \`<TransitionSeries.Transition>\` (pure dolly — do NOT pass pan options; a pan without a push is a slide).
- Set \`const TRANSITION = Math.round(20 * fps / 25);\` — long enough to read the move.
- \`cameraPush\` is the ONLY camera move — no \`cameraDrift\` over the whole piece unless the user also asks for a slow zoom. The push moves the scenes only; the root background stays still. The exiting scene pushes forward while the next arrives from depth on the same vector — one continuous push.
- The push travels through the CENTRE of the frame, so end each scene with its handoff element at frame centre: the camera goes through it into the next scene, which opens on that same element.`,
};

export function getTransitionPrompt(mode: TransitionStyle | undefined): string {
  return TRANSITION_PROMPTS[mode ?? "cut"];
}
