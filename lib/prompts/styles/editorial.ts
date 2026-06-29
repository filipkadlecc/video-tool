export const EDITORIAL_STYLE_PROMPT = `
=== STYLE: EDITORIAL ===

Inspired by Stripe Press, The Browser Company, NYT digital essays. Considered, literary, quiet confidence. Whitespace does the work.

**MANDATORY SIGNATURES — must appear in every editorial scene. These override any composition you see in the few-shot snippets.**

1. Asymmetric 12-column grid layout — hero spans columns 2-7, supporting content in columns 8-11. Columns 1 and 12 stay empty for breathing room.
2. Small uppercase monospace section label always visible ("01 / Section", "Chapter II", etc.) in 22-28px monospace, color rgba(255,255,255,0.45), letterSpacing 0.18em, textTransform uppercase.
3. Reveals use opacity + translateY ONLY. NO scale on reveals, NO rotation, NO blur ramp. LIQUID springs only.
4. Hero is RESTRAINED — 5-9% of canvas height. Authority through size restraint, not loudness.
5. Patient staggers — 8-15 frames between sibling element reveals. Never less than 8.
6. If any element acts as a featured block / pull-quote, give it a thick (3-4px) orange left-border with generous left padding (≥32px).

Composition:
- Asymmetric magazine grid. Imagine a 12-column grid; place hero text in columns 2-7, supporting elements in columns 9-11. Leave columns 1, 8, 12 empty for breathing room.
- Hero text is MEDIUM — 5-8% of canvas height. Authority through restraint.
- Use horizontal rules and small section labels ("01 / Introduction", "Chapter II") in monospace to add structure.
- Top-left aligned content is the most common starting point.

Motion:
- LIQUID springs for primary reveals (mass: 1.0, damping: 22, stiffness: 120). Smooth, never bouncy.
- Slow staggers — 8-15 frames between sibling elements. The pace is patient.
- Long graceful fades (40-60 frame opacity transitions) combined with subtle 8-12px translateY. No scale, no rotation on reveals.
- Gentle parallax: background elements drift at 0.2x speed of foreground while the scene plays.
- Hold phases include a slow opacity drift (e.g. 0.85 → 0.95 → 0.85 over 4 seconds) — never static, but never flashy.

Typography:
- Hero: sans (BRAND.fonts.marketing), weight 600. Slight tracking (0.005-0.01em).
- Body: Inter or system sans (BRAND.fonts.primary), weight 400. Line-height 1.5-1.65 for legibility.
- Mix sans HERO with sans BODY and monospace LABELS — the contrast comes from size + tracking + color hierarchy, NOT font family.
- Color hierarchy: 100% white for hero, 65% white for body, 40% white for labels/metadata.

Depth & color:
- Single muted accent — never saturated. Think dark navy, deep aubergine, ink black.
- Pull-quote treatment: a thick left border (3-4px) in accent color, generous left padding.
- Drop caps where it fits (first letter of a paragraph in display serif, 3x the body size).
- Backgrounds: deep neutral (off-black, ink, paper white if light theme). Imagery sparingly, with strong contrast.
`;
