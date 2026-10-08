export const EDITORIAL_STYLE_PROMPT = `
=== STYLE: EDITORIAL ===

Inspired by Stripe Press, The Browser Company, NYT digital essays. Considered, literary, quiet confidence. Whitespace does the work.

**MANDATORY SIGNATURES — must appear in every editorial scene. These override any composition you see in the few-shot snippets.**

1. Asymmetric 12-column grid layout — hero spans columns 2-7, supporting content in columns 8-11. Columns 1 and 12 stay empty for breathing room. (On a tall canvas, \`pick\` a single column with the same margins.)
2. Small uppercase monospace section label always visible ("01 / Section", "Chapter II", etc.) at 22-28 × u in monospace, color \`COLORS.textSubtle\`, letterSpacing 0.18em, textTransform uppercase.
3. Reveals use opacity + translateY ONLY. NO scale on reveals, NO rotation, NO blur ramp. \`LIQUID\` springs only (\`DEFAULT\` on the new set).
4. Hero is RESTRAINED — 6-9% of the short edge (65–97 × u). Authority through size restraint, not loudness.
5. Patient staggers — 8-15 frames between sibling element reveals. Never less than 8.
6. If any element acts as a featured block / pull-quote, give it a thick (3-4 × u) orange left-border with generous left padding (≥32 × u).

Composition:
- Asymmetric magazine grid. Imagine a 12-column grid; place hero text in columns 2-7, supporting elements in columns 9-11. Leave columns 1, 8, 12 empty for breathing room.
- Hero text is MEDIUM — 6-9% of the short edge. Authority through restraint.
- Use horizontal rules and small section labels ("01 / Introduction", "Chapter II") in monospace to add structure.
- Top-left aligned content is the most common starting point.
- Editorial sits at the patient end of the PACING rules: ideas get room to be read, but something still moves on every beat or two.

Motion:
- \`LIQUID\` springs (\`DEFAULT\` on the new set) for primary reveals. Smooth, never bouncy.
- Slow staggers — 8-15 frames between sibling elements. The pace is patient.
- Long graceful reveals (40-60 frames) of opacity combined with a subtle 8-12 × u translateY. No scale, no rotation on reveals.
- Gentle parallax: decorative elements drift at 0.2x the speed of the foreground while the scene plays.
- Hold phases keep a slow positional \`ambientDrift\` (1–2px over several seconds) — never static, never flashy. Opacity stays at 1 once an element has arrived.

Typography:
- Hero: sans (BRAND.fonts.marketing), weight 500. Slight tracking (0.005-0.01em).
- Body: Inter (BRAND.fonts.primary), weight 400. Line-height 1.5-1.65 for legibility.
- Mix sans HERO with sans BODY and monospace LABELS — the contrast comes from size + tracking + color hierarchy, NOT font family.
- Color hierarchy: \`COLORS.text\` for the hero, \`COLORS.textMuted\` for body, \`COLORS.textSubtle\` for labels/metadata.

Depth & color:
- Orange is still the only accent; editorial uses it sparingly — a rule, a pull-quote border, one word.
- Pull-quote treatment: a thick left border (3-4 × u) in orange, generous left padding.
- Drop caps where it fits: the first letter of a paragraph in GT Walsheim Medium, 3x the body size.
- Background: the root brand black. Imagery sparingly, with strong contrast.
`;
