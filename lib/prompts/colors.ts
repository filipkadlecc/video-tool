export const COLOR_SYSTEM_PROMPT = `=== APIFY COLOR SYSTEM (HARD RULES) ===

This project ships Apify-branded marketing video. The palette is dark + orange, period.

ALWAYS import from \`@/lib/brand\` — never hardcode hex strings:

\`\`\`tsx
import { BRAND } from "@/lib/brand";

BRAND.colors.bg          // #161718  — page/canvas background
BRAND.colors.card        // #1d1e1f  — slightly lifted card surface
BRAND.colors.border      // #3d3f43  — 1px hairlines on cards
BRAND.colors.text        // #f4f4f5  — primary text on dark
BRAND.colors.textMuted   // #bfc1c5  — secondary text, subheads
BRAND.colors.textSubtle  // #8c93a8  — captions, metadata
BRAND.colors.orange      // #F86606  — THE accent: highlights, CTAs, checkmarks
BRAND.colors.orangeDeep  // #FF4800  — pressed/active orange, gradient end
BRAND.colors.orangeTint  // rgba(248,102,6,0.16) — SEMI-TRANSPARENT; only over an opaque surface
\`\`\`

NOTE: \`orangeTint\` is 16% alpha — it goes see-through when the animation is overlaid on
video. Only use it as a fill layered ON TOP of an opaque surface. For a highlight pill or
chip that sits directly on the backdrop, use an OPAQUE recipe instead: \`card\` fill + a 1–2px
\`orange\` border (+ \`orange\` text), not an \`orangeTint\` fill.

USAGE RULES
- Background: ALWAYS \`BRAND.colors.bg\` (#161718). Never pure black, never anything else.
- Text on dark: \`BRAND.colors.text\` for headlines/body, \`textMuted\` for subheads, \`textSubtle\` for captions.
- Orange is for emphasis — use it sparingly and on purpose:
  - One highlighted phrase per headline (wrap in an inline pill with an OPAQUE \`card\` bg + 1px \`orange\` bottom border, ~8px h-padding, 6px radius — \`orangeTint\` only if the pill sits over an opaque surface)
  - Checkmark/bullet glyphs
  - CTA button outline (1.5px \`orange\` border, transparent fill, \`orange\` text)
  - Thin accent rules / divider lines
  - Decorative line-art (contour rings, registration crop marks, isometric wireframe, dotted halftone) — \`orange\` strokes/dots at LOW opacity. Texture, not the subject.
- Cards: \`card\` surface + 1px \`border\` hairline + 14px radius.

FORBIDDEN
- Pure black (#000) or pure white (#FFF) — use \`bg\` and \`text\` tokens.
- BRAND.colors.green / blue / pink / magenta / bgSoft — these exist for legacy snippets only and MUST NOT appear in new scenes.
- Any purple, teal, red, yellow, gradient that introduces hues outside dark-gray + orange.
- Multiple competing accents in one frame. Orange is the only accent.
- Hardcoded hex strings — import from BRAND.
`;
