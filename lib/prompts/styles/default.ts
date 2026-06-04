export const DEFAULT_STYLE_PROMPT = `
=== STYLE: MODERN CLEAN ===

A confident, modern aesthetic. Asymmetry over symmetry. Composition reads as intentional, never templated.

Composition:
- Anchor titles to a corner or along a vertical band — not the geometric center. Rule of thirds, not rule of "centered".
- One hero element per scene gets visual priority (big, bold, off-center). Secondary elements support it from the margins.
- Generous whitespace at the edges; never crowd the canvas.

Motion:
- Use SNAPPY or LIQUID springs for primary reveals — pick by intent, not habit. Reserve ELASTIC for moments you want to feel playful.
- Combine 2-3 transforms per reveal: opacity + translate + scale, or scale + rotate + blur. Single-axis motion reads as cheap.
- After the primary reveal, transition into a slow ambient micro-motion (1-2px translate breathing, 0.3° rotation drift, opacity ±0.02). Never freeze.

Typography:
- Hero text: 8-14% of canvas height. Tight leading (line-height: 0.95-1.05). Negative letter-spacing on display sizes (-0.02em to -0.04em).
- Mix weights aggressively in the same line — 800 against 300 reads as designed.
- One accent color, used sparingly (a pill, a number, a single word).

Depth:
- Background: a subtle radial or linear gradient, not flat color. Add a faint vignette via box-shadow inset.
- Cards/panels: rgba(255,255,255,0.04-0.08) backgrounds with a 0.5px inner stroke at rgba(255,255,255,0.08). Slight blur backdrop where it reads.
- Drop shadows on hero text — chromatic if the brand allows (e.g. \`text-shadow: 0 4px 24px rgba(accent, 0.4)\`).
`;
