export const EDITORIAL_STYLE_PROMPT = `
=== STYLE: EDITORIAL ===

Inspired by Stripe Press, The Browser Company, NYT digital essays. Considered, literary, quiet confidence. Whitespace does the work.

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
- Hero: a serif (Georgia, "Times New Roman", or a display serif). Mid weight 500-600. Slight tracking (0.005-0.01em).
- Body: Inter or system sans, weight 400. Line-height 1.5-1.65 for legibility.
- Mix serif HERO with sans BODY and monospace LABELS — the three-way contrast is the signature.
- Color hierarchy: 100% white for hero, 65% white for body, 40% white for labels/metadata.

Depth & color:
- Single muted accent — never saturated. Think dark navy, deep aubergine, ink black.
- Pull-quote treatment: a thick left border (3-4px) in accent color, generous left padding.
- Drop caps where it fits (first letter of a paragraph in display serif, 3x the body size).
- Backgrounds: deep neutral (off-black, ink, paper white if light theme). Imagery sparingly, with strong contrast.
`;
