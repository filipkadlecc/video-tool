export const APIFY_LAYOUT_PROMPT = `=== APIFY LAYOUT GRAMMAR ===

Match the visual language of Apify's PLGTM / Rising Stars / One Pager marketing frames. Frames are dark, portrait-ish, with one bold idea per screen and generous breathing room.

HEADER BAR
- **DO NOT add an Apify logo or wordmark in the top-left (or anywhere else) on any frame.** The previous design system included a small top-left wordmark — it has been removed. Leave that space empty.
- No watermark, no symbol, no "apify" text anywhere on the canvas unless the scene's content is specifically about the Apify brand (e.g. a logo-reveal bumper).

HEADLINE
- 1–2 lines max. GT Walsheim (or Inter as fallback) — \`fontFamily: BRAND.fonts.marketing\`.
- Size: ~88–120px on a 1080-wide portrait canvas. Scale proportionally for other sizes (≈ canvas height / 10).
- Color: \`BRAND.colors.text\` (#f4f4f5), weight 600, line-height 1.05.
- Exactly ONE phrase highlighted: wrap that phrase in a \`<span>\` with:
  \`background: BRAND.colors.orangeTint\`
  \`borderBottom: \`2px solid \${BRAND.colors.orange}\`\` (or full 1.5px border)
  \`padding: "0 10px"\`, \`borderRadius: 6\`
  Color stays \`BRAND.colors.text\` — do NOT recolor the highlighted text orange.

SUBHEAD / BODY
- 32–48px (≈ canvas height / 28), \`BRAND.colors.textMuted\` (#bfc1c5).
- Max ~28 characters per line. Wrap aggressively, never let body text run the full canvas width.

BULLET / CHECKLIST PATTERN
- Row layout: orange checkmark (✓ glyph or SVG) at left, label + optional muted descriptor on the right.
- Checkmark color: \`BRAND.colors.orange\`. Label: \`text\`. Descriptor (one line below or after en-dash): \`textMuted\`.
- ~24–32px vertical gap between rows.

CARD PATTERN
- \`background: BRAND.colors.card\`
- \`border: \`1px solid \${BRAND.colors.border}\`\`
- \`borderRadius: 14\`, \`padding: 32\`
- Cards group related rows (a list of Actors, a list of features). Use 1–3 cards per frame max.

CTA PATTERN
- Outlined pill: transparent fill, \`1.5px solid BRAND.colors.orange\`, \`borderRadius: 999\`, padding "14px 28px".
- Label color: \`BRAND.colors.orange\`, weight 600.
- Often paired with a QR code (right) and a short promo line ("Code: XYZ", "Get $100 prepaid usage") in \`textMuted\` above or below.

DECORATIVE MOTIFS — import from "../decor" (alongside "../motion")
The host project ships orange-only, low-opacity line-art primitives. Reach for these instead of inventing decoration; use 1–2 per frame and never let them fight the headline.
- \`<ContourField position="bottom" />\` — faint topographic contour rings that draw on. A BACKGROUND layer behind the content (opacity ~0.5). Good behind intros, event cards, end cards.
- \`<RegistrationFrame />\` — thin corner "+" crop marks + a dashed margin rectangle, laid OVER the scene. The blueprint/editorial signature. Opt-in; at most one per frame.
- \`<IsoWireframe shape="cube" filled style={{ right: 80, bottom: 80 }} />\` — isometric wireframe geometry (\`shape\`: "cube" | "slab" | "tetra") with an optional dotted-halftone face. Decorative CORNER hero art.
- \`<DottedField />\` — low-opacity orange dot-grid halftone; defaults to a band at the bottom of the frame. Texture only.
- \`<TagPill label="Engineering" />\` — small outlined orange category pill (opaque card fill + 1px orange border + orange label). Stagger a row of them for tags / departments.
DISCIPLINE
- Orange only, low opacity. Decoration is texture, not the subject — the headline is always the hero.
- A faint \`ContourField\` may sit full-bleed in the background, but solid/foreground decoration (IsoWireframe, dotted bands) stays under ~30% of the frame.
- These import from "../decor". Keep that import when you adapt a snippet that uses them — do NOT reimplement them inline.

COMPOSITION
- Default to portrait 9:16 unless the canvas dimensions say otherwise.
- Center a narrow column (~60–70% of canvas width). Don't stretch text across the full width.
- 8pt vertical rhythm. Large gaps (48–96px) between sections — let it breathe.
- One idea per frame. If the brief has 4 bullets, that's one frame, not four.

MOTION
- Restrained. Fade in + 12px vertical drift, 0.4–0.6s easeOutCubic (use \`springIn\` with \`"GENTLE"\` preset).
- One element at a time, ~80–120ms stagger.
- No bouncing, no rotation, no scale-from-zero. The Apify feel is confident and still.
- Highlight pill: draw its border-bottom from left to right over 0.4s after the headline lands.
- Decorative primitives self-animate — \`ContourField\` rings draw on, \`RegistrationFrame\` marks pop then drift ≤2px, \`IsoWireframe\` edges draw on. Just place them; don't re-animate them.

ANTI-PATTERNS (do not do)
- Multiple accent colors — orange only.
- Centered text across a wide column.
- Gradient backgrounds (the canvas is flat #161718).
- Drop shadows (the look is flat, not material).
- Logos floating in the middle of the frame.
- Bouncy springs on big headlines.
`;
