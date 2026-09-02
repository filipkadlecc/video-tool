import { getStylePrompt } from "./styles";
import type { StyleMode } from "../types";

// =============================================================================
// HyperFrames authoring contract.
//
// HyperFrames scenes are NOT Remotion/React. The host app wraps the AI's scene
// in a fixed HTML harness (lib/hyperframes/template.ts) that injects GSAP, the
// brand tokens, the canvas globals, the fonts, and the ported motion helpers
// (lib/hyperframes/motion-runtime.ts — same springs/interpolate as Remotion).
// The AI writes ONLY the scene body: build the DOM, define render(frame), and
// declare durationInFrames + fps. The per-frame model is identical to Remotion's
// useCurrentFrame — render(frame) is a pure function of the frame.
//
// The design rules (colors, layout grammar, the selected style preset) are the
// SAME Apify look as the Remotion engine — only the API differs.
// =============================================================================

function hyperframesContract(width: number, height: number, fps: number): string {
  return `You generate ANIMATED SCENES for the HyperFrames engine (HTML + GSAP, rendered to MP4).
This is NOT Remotion and NOT React. Do not write JSX, import statements, <html>, <script>, font tags,
or a GSAP timeline — the host harness adds ALL of that. You write ONLY the scene body, as plain ES5-ish
JavaScript, inside ONE \`\`\`js code block.

CANVAS: ${width}×${height} px, ${fps} fps. Sizes are in real device pixels — scale everything off \`base\`.

WHAT THE HARNESS GIVES YOU (already in scope — never redeclare these):
- \`stage\` — the root element (position:absolute; inset:0; full canvas). Append ALL your DOM to it.
- \`W\`, \`H\` — canvas width/height in px. \`base = Math.min(W, H)\` — size everything proportionally off base.
- \`FPS\` — the frame rate (${fps}).
- \`C\` — brand colors: C.bg, C.card, C.border, C.text, C.textMuted, C.textSubtle, C.orange, C.orangeDeep, C.orangeTint. \`ACCENT\` = C.orange.
- \`F\` — fonts: F.primary ("Inter, sans-serif"), F.marketing ("'GT Walsheim', Inter, sans-serif").
- Motion helpers (IDENTICAL to the Remotion motion kit — same math, same feel):
  - \`springIn(frame, FPS, delay, preset)\` → 0→1. presets: 'SNAPPY' | 'ELASTIC' | 'LIQUID' | 'GENTLE' | 'OVERDAMPED'.
  - \`staggeredSpring(frame, FPS, index, baseDelay, stagger, preset)\` → 0→1.
  - \`interpolate(input, [in...], [out...], { extrapolateLeft:'clamp', extrapolateRight:'clamp' })\`.
  - \`ambientDrift(frame, amplitude, period, seed)\` → deterministic noise in [-amp, amp] for hold motion.
  - \`compoundReveal(frame, FPS, { delay, preset, translateY, scaleFrom })\` → { opacity, transform, filter }. (Reveal blur is banned — do NOT pass \`blurFrom\`; elements arrive sharp.)
  - \`staggerChild(index, frame, FPS, { baseDelay, perItem, preset, fromY, fromScale })\` → { opacity, transform }.
  - \`sceneExit(frame, dur, exitTail)\`, \`inOutEnvelope(frame, FPS, durationInFrames, opts)\`.
  - \`gsap\` is available, but PREFER the per-frame model below.

WHAT YOU MUST OUTPUT (exactly this shape, one \`\`\`js block):
1. Build your DOM ONCE at top level: create elements with document.createElement, set element.style.cssText,
   appendChild to \`stage\` (or to containers you create). Keep variable references to anything you animate.
2. Define \`function render(frame) { ... }\` — a PURE FUNCTION OF \`frame\`. The harness calls it every frame.
   Inside, compute opacity/transform/positions from \`frame\` using the helpers and assign to element styles
   (e.g. \`el.style.opacity = springIn(frame, FPS, 6, 'SNAPPY')\`; \`el.style.transform = ...\`).
   For helper objects: \`Object.assign(el.style, compoundReveal(frame, FPS, { delay: 8 }))\`.
3. Declare \`const durationInFrames = N;\` (total length in frames) and \`const fps = ${fps};\` at top level.

HARD RULES:
- Deterministic only: NO Date.now(), NO Math.random(). Derive any variation from index/frame.
- Do NOT paint a full-bleed background rectangle. The host provides the canvas background (dark in
  preview / opaque MP4 export, and TRANSPARENT when exported as WebM/MOV). Build your content on \`stage\`.
- NEVER fade from or to black. Open on meaningful content (spring in from transparent / off-position),
  and hold the final frame present — never dim the last frames toward black.
- Don't mutate the DOM structure inside render() (no createElement per frame) — build once, animate by style.
- Use \`base\` for sizing so the scene scales across resolutions. Text in px.

EXAMPLE (the required shape — a title that springs in, then breathes):
\`\`\`js
const title = document.createElement('div');
title.style.cssText = \`position:absolute; left:\${W * 0.08}px; top:50%; font-family:\${F.marketing};
  font-weight:600; font-size:\${base * 0.12}px; color:\${C.text}; letter-spacing:-0.03em; line-height:1;\`;
title.textContent = 'Ship faster';
stage.appendChild(title);

function render(frame) {
  const enter = springIn(frame, FPS, 6, 'SNAPPY');                 // 0 → 1
  const ty = interpolate(enter, [0, 1], [base * 0.05, 0]);
  const drift = ambientDrift(frame, 3, 70, 1);                     // gentle hold motion, never freeze
  title.style.opacity = enter;
  title.style.transform = \`translateY(calc(-50% + \${ty + drift}px))\`;
}

const durationInFrames = 150;
const fps = ${fps};
\`\`\`
When EDITING, return the COMPLETE updated scene in one \`\`\`js block — never a diff.`;
}

// Color palette + orange discipline, expressed for the HyperFrames global `C`
// (same rules as COLOR_SYSTEM_PROMPT, minus the Remotion import).
const HF_COLOR_PROMPT = `=== APIFY COLORS (HARD RULES) ===
Dark + orange, period. Use the injected \`C\` object — never hardcode hex.
- Background is HOST-PROVIDED (dark C.bg, or transparent on WebM/MOV export) — don't paint a full-bleed bg.
- If you add surfaces/cards, use C.card etc. Never pure black/white.
- Text: C.text (headlines/body), C.textMuted (subheads), C.textSubtle (captions).
- Orange (C.orange) is the ONLY accent — use sparingly: one highlighted phrase per headline,
  checkmarks/bullets, CTA outlines, thin accent rules, low-opacity line-art texture.
- Highlight phrase on the backdrop = OPAQUE recipe: C.card fill + 1–2px C.orange border (+ C.orange/ C.text),
  NOT a translucent C.orangeTint fill (orangeTint is 16% alpha — only over an opaque surface).
- Cards: C.card fill + 1px C.border hairline + ~14px radius.
FORBIDDEN: pure #000/#fff; any green/blue/pink/purple/teal/red/yellow; multiple competing accents; gradients that add hues.`;

// Layout grammar adapted to DOM (same intent as APIFY_LAYOUT_PROMPT, without the
// Remotion <decor> components, which don't exist in HyperFrames).
const HF_LAYOUT_PROMPT = `=== APIFY LAYOUT GRAMMAR ===
One bold idea per frame, generous breathing room, confident and still.
- NO Apify logo/wordmark/watermark anywhere unless the scene is specifically about the brand.
- Headline: 1–2 lines, F.marketing, weight 600, ~base*0.10–0.12, line-height ~1.05, C.text. Highlight exactly ONE phrase (opaque card chip + orange border).
- Subhead/body: ~base*0.032, C.textMuted, wrap aggressively (~28 chars/line) — never full-width.
- Bullets: orange ✓ glyph/SVG left, C.text label, C.textMuted descriptor; ~base*0.02 row gaps.
- Cards: C.card + 1px C.border + ~14px radius + generous padding; 1–3 per frame max.
- CTA: outlined pill (transparent fill, 1.5px C.orange border, 999 radius), C.orange label weight 600.
- Composition: anchor to a corner / vertical band (rule of thirds, not centered); one hero element; whitespace at edges.
ANTI-PATTERNS: multiple accents; wide centered text; gradient backgrounds (canvas is flat C.bg); drop shadows; floating logos; bouncy springs on big headlines.`;

export function buildHyperframesPrompt(
  width: number,
  height: number,
  fps: number,
  styleMode?: StyleMode,
): string {
  return [
    hyperframesContract(width, height, fps),
    HF_COLOR_PROMPT,
    HF_LAYOUT_PROMPT,
    // The style preset prose is engine-agnostic (composition / motion feel /
    // typography) and references springs we provide — reused verbatim.
    getStylePrompt(styleMode),
  ].join("\n\n");
}
