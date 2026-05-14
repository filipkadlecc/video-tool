export const CINEMATIC_STYLE_PROMPT = `
=== STYLE: CINEMATIC ===

Inspired by Apple product films, Anthropic launches, A24 trailers. Slow, deliberate, deep. The camera does the work; subjects barely move.

Composition:
- Compose like a film frame. Rule of thirds. Hero subject offset from center; negative space on the opposite side.
- Hero text appears low-third or upper-left/upper-right, never visually competing with the subject.
- Add a subtle letterbox feel — 8-12% empty bands at top/bottom (use top/bottom gradient masks if no actual bars).

Motion:
- Camera-like motion is THE signature: every scene has a slow continuous transform on the root content — e.g. \`transform: scale(\${1 + frame * 0.0003}) translateY(\${frame * 0.15}px)\`. Imperceptibly slow zoom-in or pan. Always present.
- GENTLE springs for entrances (mass: 1.0, damping: 30, stiffness: 80). Reveals are unhurried.
- Long entrance ramps: opacity 0 → 1 over 40-80 frames combined with a faint \`filter: blur(6px → 0)\` to feel like focus pulling.
- DRAMATIC TIMING: hold black or near-black for 15-30 frames before the first reveal. Anticipation is content.
- Crossfades between phases at 25-40 frame overlap, never hard cuts.

Typography:
- Hero: refined sans, weight 300-500. Tight tracking only on display (-0.02em). Generous tracking on small labels (+0.1em uppercase).
- Letterspacing-driven hierarchy: ALL CAPS small caps with wide tracking for labels, tight display for hero.
- Hero size: 6-10% of canvas height. Restrained.
- Color: 90% white max — pure white shouts. Soft white (rgba(255,255,255,0.9)) is more cinematic.

Depth & color:
- Deep depth-of-field: backgrounds always blurred (\`filter: blur(12-24px)\`), foreground sharp. Even on solid color backgrounds, add a faint \`backdrop-filter: blur\` over a noise/gradient layer.
- Heavy soft shadows on every floating element — long, soft, never sharp. \`box-shadow: 0 24px 64px rgba(0,0,0,0.5)\`.
- Vignette: an inset radial gradient at the root, dark corners.
- Optional grain overlay: a noise layer at 4-8% opacity with \`mix-blend-mode: overlay\` for filmic texture.
- Color palette: deeply saturated darks (forest green, deep blue, oxblood, charcoal). Avoid pure neutrals.
`;
