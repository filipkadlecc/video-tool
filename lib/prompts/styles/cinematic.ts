export const CINEMATIC_STYLE_PROMPT = `
=== STYLE: CINEMATIC ===

Inspired by Apple product films, Anthropic launches, A24 trailers. Slow, deliberate, deep. Depth, light and patient timing do the work; subjects barely move.

**MANDATORY SIGNATURES — must appear in every cinematic scene. These override any composition you see in the few-shot snippets.**

1. LETTERBOX BANDS — 8-12% empty dark gradient bands at TOP AND BOTTOM of the canvas. Use linear-gradient masks (from #000 to transparent over the band height) to create the cinema feel.
2. Background is BLURRED — \`filter: blur(12-24px)\` on background elements. Foreground stays sharp. Even on a solid color background, layer a faint blur over a noise/gradient layer.
3. SLOW CONTINUOUS DRIFT on the sharp content layer: wrap the scene's sharp content in a container with \`transform: translateY(\${frame * 0.12}px)\` — a pan, NOT a zoom. NO \`scale()\` camera move unless the user explicitly asked for a zoom (base rule 17), and even then only on the content layer — the background never zooms.
4. Crossfades between phases — 25-40 frame opacity overlaps. NEVER hard cuts (those are kinetic's signature).
5. VIGNETTE via inset radial gradient at the root — dark corners, lighter center.
6. HEAVY soft shadows on every floating element — \`box-shadow: 0 24px 64px rgba(0,0,0,0.5)\`. Long, soft, never sharp.
7. Hero is RESTRAINED — 6-10% canvas height. Cinematic comes from depth and motion, not size.

See the code skeleton at the bottom of this section for the exact root-wrapping pattern.

Composition:
- Compose like a film frame. Rule of thirds. Hero subject offset from center; negative space on the opposite side.
- Hero text appears low-third or upper-left/upper-right, never visually competing with the subject.
- Add a subtle letterbox feel — 8-12% empty bands at top/bottom (use top/bottom gradient masks if no actual bars).

Motion:
- A slow continuous drift on the sharp content layer — e.g. \`transform: translateY(\${frame * 0.15}px)\`. An imperceptible pan, never a zoom-in unless the user asked for one. The background layer never moves with it.
- GENTLE springs for entrances (mass: 1.0, damping: 30, stiffness: 80). Reveals are unhurried.
- Entrance reveals use motion — translate + scale over 40-80 frames. NEVER animate a \`filter: blur(Npx → 0)\` on the entrance (reveal blur is banned; the blurred layer below is a STATIC background only). Content must be visible from frame 0; do NOT hold a black or near-black canvas before the reveal. Cinematic pacing comes from slow drift and patient holds AFTER the reveal, never from black anticipation.
- Crossfades between phases at 25-40 frame overlap, never hard cuts.

Typography:
- Hero: refined sans (BRAND.fonts.marketing), weight 600. Tight tracking only on display (-0.02em). Generous tracking on small labels (+0.1em uppercase).
- Letterspacing-driven hierarchy: ALL CAPS small caps with wide tracking for labels, tight display for hero.
- Hero size: 6-10% of canvas height. Restrained.
- Color: 90% white max — pure white shouts. Soft white (rgba(255,255,255,0.9)) is more cinematic.

Depth & color:
- Deep depth-of-field: backgrounds always blurred (\`filter: blur(12-24px)\`), foreground sharp. Even on solid color backgrounds, add a faint \`backdrop-filter: blur\` over a noise/gradient layer.
- Heavy soft shadows on every floating element — long, soft, never sharp. \`box-shadow: 0 24px 64px rgba(0,0,0,0.5)\`.
- Vignette: an inset radial gradient at the root, dark corners.
- Optional grain overlay: a noise layer at 4-8% opacity with \`mix-blend-mode: overlay\` for filmic texture.
- Color palette: deeply saturated darks (forest green, deep blue, oxblood, charcoal). Avoid pure neutrals.

### Cinematic root pattern — copy this skeleton

Every cinematic scene wraps its content like this. The letterbox bands, vignette, blurred background, and slow drift are NOT optional — they're what makes it cinematic.

\`\`\`tsx
const CinematicScene: React.FC = () => {
  const frame = useCurrentFrame();
  const cameraY = frame * 0.12;                    // very slow downward drift — a pan, NOT a zoom

  return (
    <AbsoluteFill style={{ fontFamily: "'GT Walsheim', Inter, sans-serif", overflow: "hidden" }}>
      <Background />

      {/* Blurred background layer for depth — sits behind everything sharp */}
      <AbsoluteFill style={{ filter: "blur(18px)", opacity: 0.6 }}>
        {/* large abstract gradient blob or color wash here */}
      </AbsoluteFill>

      {/* All sharp content gets the slow drift. No scale() unless the user asked for a zoom. */}
      <AbsoluteFill style={{ transform: \`translateY(\${cameraY}px)\` }}>
        {/* hero text, supporting content, floating cards — all here */}
        {/* each card uses box-shadow: 0 24px 64px rgba(0,0,0,0.5) */}
      </AbsoluteFill>

      {/* Letterbox bands — gradient masks at top and bottom, ABOVE the camera transform */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "10%", background: "linear-gradient(180deg, #000 0%, transparent 100%)", zIndex: 10, pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "10%", background: "linear-gradient(0deg, #000 0%, transparent 100%)", zIndex: 10, pointerEvents: "none" }} />

      {/* Vignette — sits above everything */}
      <AbsoluteFill style={{ background: "radial-gradient(closest-side, transparent 40%, rgba(0,0,0,0.6) 100%)", pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
\`\`\`
`;
