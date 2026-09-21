import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { BRAND_FONT_FACE_CSS, figmaPlane } from "../../theme";

// ===== Editable parameters (the snippet form fills these in) =====
const TEXT = "Question or statement can be placed here in the box that’s adjustable";
const X = 0;
const Y = 0;
// =================================================================

export const fps = 25;
export const durationInFrames = 100;

export const orientation = "vertical";
export const designWidth = 1080;
export const designHeight = 1920;
export const holdFrame = 45;

const SETTLE = 30;

// Figma: Title 6, content 2546:1071 @ (230, 858.4999), 620 x 202.194.
// The box grows downward with the text; only its width is fixed.
const FIGMA = { x: 230, y: 858.4999, w: 620 };
const PAD = 31.097;
const TEXT_W = 557.806;
const SIZE = 48;
const LINE = 1.1;
const BORDER = 2;
const ORANGE = "#f86606";
const WHITE = "#ffffff";
const INK = "#1f2123";

const SceneBg: React.FC = () => <AbsoluteFill style={{ backgroundColor: "#000000" }} />;

export default function ShortStatement() {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const plane = figmaPlane(width, height, "center");

  const p = frame >= SETTLE
    ? 1
    : interpolate(frame, [0, 12], [0, 1], {
        extrapolateLeft: "clamp", extrapolateRight: "clamp",
        easing: (t) => 1 - Math.pow(1 - t, 3),
      });

  return (
    <AbsoluteFill>
      <style>{BRAND_FONT_FACE_CSS}</style>
      <SceneBg />
      <div style={plane.outer}>
        <div style={plane.inner}>
          <div style={{
            position: "absolute", left: X || FIGMA.x, top: Y || FIGMA.y,
            width: FIGMA.w, boxSizing: "border-box",
            backgroundColor: WHITE,
            // Figma centres a stroke on the node bounds; a CSS border sits
            // wholly inside them, which pushes the fill in by the full 2px and
            // shrinks the content box. An outline pulled in by half its width
            // straddles the edge exactly as Figma's does, and leaves the box
            // model alone.
            outline: `${BORDER}px solid ${ORANGE}`,
            outlineOffset: -BORDER / 2,
            padding: PAD,
            display: "flex", alignItems: "center", justifyContent: "center",
            clipPath: `inset(0 ${(1 - p) * 100}% 0 0)`,
          }}>
            <div style={{
              fontFamily: "'GT Walsheim'", fontWeight: 400, fontSize: SIZE,
              lineHeight: LINE, color: INK, textAlign: "center", width: TEXT_W,
              // Figma trims this block to cap height, which is what makes the
              // box 202px tall around three 48px lines rather than 221px.
              textBoxTrim: "trim-both", textBoxEdge: "cap alphabetic",
            } as React.CSSProperties}>{TEXT}</div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}
