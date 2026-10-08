export const CINEMATIC_STYLE_PROMPT = `
=== STYLE: CINEMATIC ===

Inspired by Apple product films, Anthropic launches, A24 trailers. Slow, deliberate, deep. Depth, light and patient timing do the work; subjects barely move.

**MANDATORY SIGNATURES — must appear in every cinematic scene. These override any composition you see in the few-shot snippets.**

1. LETTERBOX BANDS — 8-12% bands at TOP AND BOTTOM of the canvas, as linear-gradient masks from \`COLORS.bg\` to transparent. (They are part of the picture, so they stay in a transparent export — skip them for a piece that will be laid over footage.)
2. DEPTH OF FIELD — decorative shapes BEHIND the content carry a STATIC \`filter: blur(12-24px)\`; the content itself stays sharp. This is a decorative layer inside the scene's foreground, never a per-scene background, and the blur never animates.
3. PARALLAX, NOT A MOVING FRAME — every element drifts slowly on its own (\`ambientDrift\`, or a slow translate), the foreground a little faster than the decorative layer behind it. The frame itself never pans or zooms unless the user asked for it (base rule 17).
4. Phases INSIDE a scene blend — 25-40 frame overlaps, never hard cuts (those are kinetic's signature). Scene to scene follows this project's transition style.
5. Soft long shadows on floating cards — \`box-shadow: 0 24px 64px rgba(0,0,0,0.5)\`. Long, soft, never sharp.
6. Hero is RESTRAINED — 6-10% of the short edge (65–108 × u). Cinematic comes from depth and timing, not size.

See the code skeleton at the bottom of this section for the exact pattern.

Composition:
- Compose like a film frame. Rule of thirds. Hero subject offset from center; negative space on the opposite side.
- Hero text appears low-third or upper-left/upper-right, never visually competing with the subject.
- Focus comes from composition, contrast and the depth-of-field layer — not from a dark vignette (it would muddy the brand black and breaks transparent exports).

Motion:
- \`GENTLE\` springs (\`HEAVY\` on the new set) for entrances. Reveals are unhurried: translate + scale over 30-60 frames. NEVER animate a \`filter: blur(Npx → 0)\` on an entrance (reveal blur is banned; the blurred layer is STATIC decoration only). Content is visible or arriving from frame 0; never hold a black or near-black canvas before the reveal.
- Cinematic sits at the slow end of the PACING rules — around 3 s per idea — and its patience comes from slow drift and held compositions AFTER the reveal, never from black anticipation or a dead hold.

Typography:
- Hero: refined sans (BRAND.fonts.marketing), weight 500. Tight tracking only on display (-0.02em). Generous tracking on small labels (+0.1em uppercase).
- Letterspacing-driven hierarchy: ALL CAPS small caps with wide tracking for labels, tight display for hero.
- Hero size: 6-10% of the short edge. Restrained.
- Color: \`COLORS.text\` — already a soft off-white; never pure white.

Depth & color:
- The palette stays brand black + one orange accent. Cinematic comes from light, depth and timing — not from colour.
- Optional grain overlay: a noise layer at 4-8% opacity with \`mix-blend-mode: overlay\` for filmic texture.

### Cinematic scene pattern — copy this skeleton

The scene is transparent foreground like every other scene (the root \`<Background />\` is painted once at the composition level).

\`\`\`tsx
const CinematicScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { u } = useLayout();
  const nearY = ambientDrift(frame, 3, 140, "cine-near-y"); // foreground drifts a little more…
  const farY = ambientDrift(frame, 1.5, 200, "cine-far-y"); // …than the decorative layer behind it

  return (
    <AbsoluteFill style={{ fontFamily: BRAND.fonts.marketing, overflow: "hidden" }}>
      {/* Depth of field — a decorative shape behind the content, STATIC blur */}
      <div style={{ position: "absolute", right: "-10%", top: "15%", width: 700 * u, height: 700 * u, borderRadius: "50%",
        background: \`radial-gradient(closest-side, \${COLORS.card}, transparent)\`, filter: \`blur(\${18 * u}px)\`,
        transform: \`translateY(\${farY}px)\` }} />

      {/* Sharp content — drifts on its own; the frame itself never moves */}
      <AbsoluteFill style={{ transform: \`translateY(\${nearY}px)\` }}>
        {/* hero text, supporting content, floating cards (opaque, soft long shadow) */}
      </AbsoluteFill>

      {/* Letterbox bands — on top of everything in the scene */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "10%", background: \`linear-gradient(180deg, \${COLORS.bg} 0%, transparent 100%)\`, zIndex: 10, pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "10%", background: \`linear-gradient(0deg, \${COLORS.bg} 0%, transparent 100%)\`, zIndex: 10, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
\`\`\`
`;
