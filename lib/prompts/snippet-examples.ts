import fs from "fs";
import path from "path";

// Few-shot snippet sources injected into the system prompt. Read once at module
// init (server-only). The list is deliberately small — full source for IntroCard,
// StatCallout, ListReveal, PathReveal — to anchor the LLM on the style without
// blowing the token budget.

const FEW_SHOT_IDS = ["IntroCard", "StatCallout", "ListReveal", "PathReveal", "EventContour"];

let cached: string | null = null;

export function getSnippetFewShots(): string {
  if (cached !== null) return cached;

  try {
    const dir = path.join(process.cwd(), "remotion", "scenes", "branded");
    const blocks: string[] = [];
    for (const id of FEW_SHOT_IDS) {
      const file = path.join(dir, `${id}.tsx`);
      if (!fs.existsSync(file)) continue;
      const code = fs.readFileSync(file, "utf-8");
      blocks.push(`### ${id} — full source\n\n\`\`\`tsx\n${code}\n\`\`\``);
    }
    blocks.push(SVG_HERO_REVEAL_EXAMPLE);
    blocks.push(SVG_WALKTHROUGH_EXAMPLE);
    cached = blocks.join("\n\n");
  } catch {
    cached = "";
  }
  return cached;
}

// =============================================================================
// SVG few-shots — teach element-aware animation from user-attached SVGs.
// =============================================================================

const SVG_HERO_REVEAL_EXAMPLE = `### SvgHeroReveal — single attached SVG animated per-element

**When to use:** the user attached ONE SVG (logo, illustration, diagram). Inline the SVG elements as JSX inside an \`<svg>\` tag and animate top-level groups with stagger + draw-on, not as a whole-image fade.

\`\`\`tsx
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND, BRAND_FONT_FACE_CSS } from "../../theme";
import { springIn, staggerChild, drawPath, inOutEnvelope, TIMING } from "../../motion";

export const fps = 30;
export const durationInFrames = 110;

// Each top-level group from the user's SVG manifest becomes an item below.
// Pull the actual path d-attributes from the inlined raw SVG.
const GROUPS = [
  { id: "logoMark",   bbox: { x: 0,   y: 0,   w: 160, h: 160 }, kind: "fill"   },
  { id: "logoText",   bbox: { x: 180, y: 30,  w: 480, h: 100 }, kind: "fill"   },
  { id: "underline",  bbox: { x: 180, y: 140, w: 480, h: 18  }, kind: "stroke" },
];

export default function SvgHeroReveal() {
  const frame = useCurrentFrame();
  const { fps: vfps } = useVideoConfig();
  const envelope = inOutEnvelope(frame, vfps, durationInFrames);

  return (
    <>
      <style>{BRAND_FONT_FACE_CSS}</style>
      <AbsoluteFill style={{ background: BRAND.colors.bg, opacity: envelope, display: "grid", placeItems: "center" }}>
        <svg viewBox="0 0 660 200" width="60%" preserveAspectRatio="xMidYMid meet">
          {/* Filled groups stagger in with subtle scale + slide */}
          {GROUPS.filter(g => g.kind === "fill").map((g, i) => {
            const s = staggerChild(i, frame, vfps, { fromY: 16, fromScale: 0.96, perItem: TIMING.staggerItem });
            return (
              <g key={g.id} style={{ opacity: s.opacity, transform: s.transform, transformOrigin: \`\${g.bbox.x + g.bbox.w/2}px \${g.bbox.y + g.bbox.h/2}px\` }}>
                {/* paste the actual <path>/<rect>/<g> children from the SVG here */}
              </g>
            );
          })}
          {/* Stroke-only groups draw on with dasharray after the fills land */}
          {GROUPS.filter(g => g.kind === "stroke").map((g) => {
            const draw = drawPath(frame, vfps, 600, { delay: TIMING.entrance + 18, preset: "LIQUID" });
            return (
              <g key={g.id}>
                <path d="..." stroke={BRAND.colors.orange} strokeWidth={4} fill="none" {...draw} />
              </g>
            );
          })}
        </svg>
      </AbsoluteFill>
    </>
  );
}
\`\`\`

**Rules this demonstrates:**
- Inline the user's SVG elements directly as JSX inside \`<svg>\` (NEVER \`<Img>\` or \`dangerouslySetInnerHTML\` for an SVG you need to animate)
- Animate top-level groups with \`staggerChild\` — each gets a slight delay so they cascade
- Stroked outlines use \`drawPath\` (dasharray reveal) instead of opacity fade
- Use \`inOutEnvelope\` to bound the whole scene
- Always render on the Apify dark bg with the brand grammar
`;

const SVG_WALKTHROUGH_EXAMPLE = `### SvgWalkthrough — multi-SVG UI flow, FIDELITY-PRESERVING

**When to use:** the user attached 2+ SVGs that share a viewBox (the request includes a \`[SEQUENCE DIFF]\` block). Treat them as frames of a UI flow.

**KEY:** Use \`<SvgFrame index={N} />\` to render the user's actual SVG verbatim. Do NOT rebuild the UI as React components — the asset already has the right logos, fonts, colors, and layout, and your job is just to animate it. Layer SvgFrames on top of each other; clip-reveal only the regions that change.

\`\`\`tsx
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";
import { SvgFrame, springIn, slideRevealBand } from "../../motion";

export const fps = 25;
export const durationInFrames = 220;

const VB = { x: 0, y: 0, w: 1198, h: 766 };

// Bboxes come straight from the [SEQUENCE DIFF] JSON in the prompt.
const DROPDOWN_BBOX = { x: 343, y: 440, w: 511, h: 146 }; // added in 0→1
const NOTION_ROW    = { x: 365, y: 487, w: 470, h: 42 };  // added in 1→2
const BUTTON_BBOX   = { x: 766, y: 579, w: 89, h: 32 };   // changedFill in 3→4

const CURSOR_KEYS = [
  { f: 0,   x: 120, y: 720 },
  { f: 28,  x: 700, y: 403 },
  { f: 65,  x: 600, y: 510 },
  { f: 110, x: 600, y: 510 },
  { f: 155, x: 810, y: 595 },
  { f: 220, x: 810, y: 595 },
];
const CLICKS = [{ f: 32, x: 700, y: 403 }, { f: 110, x: 600, y: 510 }, { f: 175, x: 810, y: 595 }];

function cursorPos(frame: number) {
  for (let i = 0; i < CURSOR_KEYS.length - 1; i++) {
    const a = CURSOR_KEYS[i], b = CURSOR_KEYS[i + 1];
    if (frame >= a.f && frame <= b.f) {
      return {
        x: interpolate(frame, [a.f, b.f], [a.x, b.x], { easing: Easing.inOut(Easing.cubic) }),
        y: interpolate(frame, [a.f, b.f], [a.y, b.y], { easing: Easing.inOut(Easing.cubic) }),
      };
    }
  }
  return CURSOR_KEYS[CURSOR_KEYS.length - 1];
}

export default function SvgWalkthrough() {
  const frame = useCurrentFrame();
  const { fps: vfps } = useVideoConfig();

  const dropdownT = springIn(frame, vfps, 34, "LIQUID");
  const rowT      = springIn(frame, vfps, 76, "SNAPPY");
  const formT     = springIn(frame, vfps, 116, "LIQUID");
  const btnT      = springIn(frame, vfps, 162, "SNAPPY");
  const successT  = springIn(frame, vfps, 184, "LIQUID");

  const cur = cursorPos(frame);

  return (
    <AbsoluteFill style={{ background: "#161718" }}>
      {/* BASE: frame 1 (the empty modal) — stays visible until the form refresh */}
      <SvgFrame index={0} style={{ opacity: 1 - formT }} />

      {/* 0→1 added (dropdown): slide-reveal frame 2 inside the dropdown band only */}
      <SvgFrame index={1} style={{
        clipPath: slideRevealBand(dropdownT, "y", DROPDOWN_BBOX, VB),
        opacity: dropdownT * (1 - formT),
      }} />

      {/* 1→2 added (Notion row hover): clip-reveal frame 3 inside the row band only */}
      <SvgFrame index={2} style={{
        clipPath: slideRevealBand(rowT, "y", NOTION_ROW, VB),
        opacity: rowT * (1 - formT),
      }} />

      {/* 2→3 layout swap (form repopulates with OAuth + scopes): SvgFrame 4 fades in with scale */}
      <SvgFrame index={3} style={{
        opacity: formT * (1 - successT),
        transform: \`scale(\${0.94 + 0.06 * formT})\`,
        transformOrigin: "60% 50%",
      }} />

      {/* 3→4 changedFill (button hover): clip-reveal frame 5 over the button rect only */}
      <SvgFrame index={4} style={{
        clipPath: slideRevealBand(btnT, "y", BUTTON_BBOX, VB),
        opacity: btnT * (1 - successT),
      }} />

      {/* 4→5 layout swap (success modal): SvgFrame 6 fades in with scale */}
      <SvgFrame index={5} style={{
        opacity: successT,
        transform: \`scale(\${0.92 + 0.08 * successT})\`,
        transformOrigin: "60% 50%",
      }} />

      {/* Cursor + click ripples — inline JSX, on top */}
      <svg viewBox="0 0 1198 766" preserveAspectRatio="xMidYMid meet"
           style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
        {CLICKS.map((c, i) => {
          const dt = frame - c.f;
          if (dt < -2 || dt > 14) return null;
          const t = (dt + 2) / 16;
          const r = interpolate(t, [0, 1], [2, 48], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const op = interpolate(t, [0, 0.18, 1], [0, 0.55, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return <circle key={i} cx={c.x} cy={c.y} r={r} fill="none" stroke="white" strokeWidth={2.5} opacity={op} />;
        })}
        <g transform={\`translate(\${cur.x}, \${cur.y})\`} style={{ filter: "drop-shadow(0 1.5px 2.5px rgba(0,0,0,0.65))" }}>
          <path d="M0 0 L0 26 L7 19 L11 28 L15 26 L11 17 L20 17 Z"
                fill="white" stroke="#111" strokeWidth={1.2} strokeLinejoin="round" />
        </g>
      </svg>
    </AbsoluteFill>
  );
}
\`\`\`

**What this demonstrates:**
- **Every visual on screen is the user's asset**, rendered via \`<SvgFrame index={N} />\`. Zero rebuilt React components for icons, modals, or text.
- For small changes (added panel, added row, changed fill): clip-reveal the NEXT frame inside the changed bbox. Outside that bbox, the previous frame's content shows through underneath — since the modal shell is identical there, the new element appears with zero flicker.
- For large layout swaps (form refresh, success modal): scale + fade the next frame in. Never opacity-only.
- The ONLY hand-written JSX is the cursor + click ripples — these aren't in the asset.
`;

// One-liner inventory of every branded snippet. The LLM uses this to decide
// which pattern to adapt when the full source isn't embedded as a few-shot.
// Every snippet shares the Apify grammar: flat #161718 bg, orange-only accent,
// highlighted-phrase headline. No top-left wordmark — that has been removed.
export const SNIPPET_INVENTORY = `
- **IntroCard** — PLGTM hero. Headline with ONE orange-highlighted phrase + muted subhead. SNAPPY title, LIQUID highlight pill reveal.
- **StatCallout** — Big number (e.g. "200M"). Animated count-up with orange-pill suffix + muted caption. LIQUID number, SNAPPY headline.
- **ListReveal** — Checkmark feature list inside a card. Highlighted-phrase headline + staggered orange-check rows with descriptors.
- **PathReveal** — Headline + hand-drawn ORANGE underline via \`evolvePath()\`. SNAPPY title + LIQUID stroke draw + muted subhead.
- **EndCard** — Outlined orange pill CTA + QR placeholder + promo code line. SNAPPY headline + breathing CTA.
- **CalloutBanner** — Card-strip overlay (sits on b-roll). Highlighted-phrase headline + muted subhead. SNAPPY drop-in.
- **QuoteCard** — Testimonial inside a card: orange quotemark + quote body + orange attribution rule + author/company.
- **LowerThird** — Name-tag chyron. Top-of-file NAME / TITLE / ALIGN constants for one speaker (default). Flip DUAL = true and fill PARTNER_NAME / PARTNER_TITLE to render two cards side-by-side.
- **LogoBumper** — Apify symbol reveal with expanding orange ring. Flat bg, SNAPPY in/out.
- **SymbolBug** — Corner overlay: card chip with Apify symbol + url. Noise-driven breathing.
- **CodeSnippet** — Editor-style card with MONOCHROME orange syntax: keywords = orange, strings = textMuted, rest = text. No rainbow.
- **RisingStarsList** — Numbered Actor rows with orange rank badges + orange triangular wedge in the bottom-right corner. Eyebrow + headline + rows.
- **LogoGridStrip** — "Works with" partner-logo strip. Headline + horizontal logo cards with muted labels.
- **FourQuadrant** — One-Pager 2×2 feature-card grid + bottom row of partner logos. Each card: rank letter + title + body.
- **BeforeAfter** — Stacked Before/After comparison cards (muted vs orange-labeled). Mini monospace data rows inside each.
- **EventCard** — Event announcement: date/venue eyebrow + big two-line title (highlight phrase on line 2) + "Hosted with [sponsor]" pill.
- **EventContour** — Event/intro headline over a faint topographic \`ContourField\` background + a \`RegistrationFrame\` crop-mark overlay (both from "../decor"). The reference for the decorative line-art motifs.
- **ActorStoreCard** — Faithful Apify Store card: rounded icon tile + title + monospace \`author/actor-handle\` + description + author chip with avatar. LIQUID card lift, staggered rows.
- **HiringCard** — "Hiring in {month}" recruitment card: highlighted-phrase headline + a row of \`TagPill\`s + staggered role rows (each with a department pill) + \`IsoWireframe\` corner art + outlined "apply here" CTA.
- **ChartReveal** — Line-chart data-viz card: eyebrow + headline + a card with animated axes, a data line that draws on (\`drawPath\`), and orange node dots that pop as the line passes.

Decorative line-art for the scenes above lives in "../decor" (import alongside "../motion"): \`ContourField\`, \`RegistrationFrame\`, \`IsoWireframe\`, \`DottedField\`, \`TagPill\`. Orange-only, low opacity — see the DECORATIVE MOTIFS section of the layout grammar.
`.trim();
