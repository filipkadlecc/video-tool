import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { BRAND_FONT_FACE_CSS, VERTICAL_CENTRE_X, figmaPlane, figmaBaselineNudge } from "../../theme";

// ===== Editable parameters (the snippet form fills these in) =====
const STYLE: "plain" | "boxed" = "boxed";
const ACCENT: "orange" | "blue" = "orange";
const SUBHEAD = "Sub-headline";
const HEADLINE = "Headline";
const HEADLINE_LINE2 = "";
// Top of the text column in 1080x1920 design units. 0 keeps Figma's own
// placement for whichever style is selected — the designer hand-placed each.
const Y = 0;
// =================================================================

export const fps = 25;
export const durationInFrames = 100;

/** Short-form only: a 1:1 port of a fixed 1080x1920 Figma frame. */
export const orientation = "vertical";
export const designWidth = 1080;
export const designHeight = 1920;

/** What scripts/figma-diff.ts renders. Must be after SETTLE. */
export const holdFrame = 45;

// Entrances are clamped rather than left to asymptote, so "settled" is a fact
// the harness can check instead of a judgement call.
const SETTLE = 30;
const REVEAL_FRAMES = 10;
const STAGGER = 4;

// --- Figma: Text treatment, section 2545:335 -------------------------------
// Title 1 plain   content 2545:564 @ (230, 687.5)   619 x 280, column gap 48
// Title 2 boxed   content 2545:565 @ (231, 712)     617 x 266, column gap 12
// Title 3 boxed+2 content 2545:567 @ (223.5, 705)   632 x 451, column gap 12
//
// Each variant is hand-placed vertically, so the default Y is looked up rather
// than shared. Horizontally all three centre on x=539.5, i.e. the frame centre.
const FIGMA_TOP = { plain: 687.5, boxed: 712, boxedTwoLine: 705 };

const SUB_SIZE = 76.271;
const HEAD_SIZE_PLAIN = 155.723;
const HEAD_SIZE_BOXED = 143.145;
const INK = "#1f2123";
const WHITE = "#ffffff";
const ACCENTS = { orange: "#f86606", blue: "#246dff" };

const SceneBg: React.FC = () => <AbsoluteFill style={{ backgroundColor: "#000000" }} />;

/**
 * Boxes wipe open left-to-right; the type inside arrives sharp and whole.
 *
 * Deliberately not an opacity fade (this project treats those as cheap) and
 * deliberately not a blur pull — elements never resolve into focus here.
 */
function reveal(frame: number, index: number): string {
  const start = index * STAGGER;
  const p = frame >= SETTLE
    ? 1
    : interpolate(frame, [start, start + REVEAL_FRAMES], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: (t) => 1 - Math.pow(1 - t, 3),
      });
  return `inset(0 ${(1 - p) * 100}% 0 0)`;
}

export default function ShortTitle() {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const plane = figmaPlane(width, height, "center");

  const twoLine = HEADLINE_LINE2.trim().length > 0;
  const top = Y || (STYLE === "plain"
    ? FIGMA_TOP.plain
    : twoLine ? FIGMA_TOP.boxedTwoLine : FIGMA_TOP.boxed);
  const accent = ACCENTS[ACCENT];

  // Figma gives the sub-headline `text-box-trim: trim-both` with a cap-alphabetic
  // edge, so its 14px padding is measured from the CAP height, not the line box.
  // That is what makes the white box 81px tall around 76.271px type rather than
  // 104px. The headline box has no trim — its 15px sits on the line box.
  const capTrim: React.CSSProperties = {
    textBoxTrim: "trim-both",
    textBoxEdge: "cap alphabetic",
  } as React.CSSProperties;

  const headSize = STYLE === "plain" ? HEAD_SIZE_PLAIN : HEAD_SIZE_BOXED;

  const boxes: React.ReactNode[] = [];
  let i = 0;

  if (SUBHEAD) {
    boxes.push(
      STYLE === "plain" ? (
        <div key="sub" style={{
          fontFamily: "'GT Walsheim'", fontWeight: 400, fontSize: SUB_SIZE,
          lineHeight: 1, color: WHITE, textAlign: "center", width: "100%",
          clipPath: reveal(frame, i++),
          transform: `translateY(${figmaBaselineNudge(SUB_SIZE)}px)`,
        }}>{SUBHEAD}</div>
      ) : (
        <div key="sub" style={{
          backgroundColor: WHITE, padding: "14px 20px",
          display: "flex", alignItems: "center", justifyContent: "center",
          clipPath: reveal(frame, i++),
        }}>
          <div style={{
            fontFamily: "'GT Walsheim'", fontWeight: 400, fontSize: SUB_SIZE,
            lineHeight: 1, color: INK, textAlign: "center", whiteSpace: "nowrap",
            ...capTrim,
          }}>{SUBHEAD}</div>
        </div>
      ),
    );
  }

  for (const line of [HEADLINE, ...(twoLine ? [HEADLINE_LINE2] : [])]) {
    const key = `head-${i}`;
    boxes.push(
      STYLE === "plain" ? (
        <div key={key} style={{
          fontFamily: "'GT Walsheim'", fontWeight: 500, fontSize: headSize,
          lineHeight: 1, color: WHITE, textAlign: "center", width: "100%",
          clipPath: reveal(frame, i++),
          transform: `translateY(${figmaBaselineNudge(headSize)}px)`,
        }}>{line}</div>
      ) : (
        <div key={key} style={{
          backgroundColor: accent, padding: "15px 24px",
          display: "flex", alignItems: "center", justifyContent: "center",
          clipPath: reveal(frame, i++),
        }}>
          <div style={{
            fontFamily: "'GT Walsheim'", fontWeight: 500, fontSize: headSize,
            lineHeight: 1, color: WHITE, textAlign: "center", whiteSpace: "nowrap",
          }}>{line}</div>
        </div>
      ),
    );
  }

  return (
    <AbsoluteFill>
      <style>{BRAND_FONT_FACE_CSS}</style>
      <SceneBg />
      <div style={plane.outer}>
        <div style={plane.inner}>
          <div style={{
            position: "absolute", top, left: VERTICAL_CENTRE_X - designWidth / 2,
            width: designWidth,
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: STYLE === "plain" ? 48 : 12,
          }}>{boxes}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
}
