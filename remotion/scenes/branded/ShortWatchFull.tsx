import React from "react";
import { AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND_FONT_FACE_CSS, figmaPlane } from "../../theme";
import { springIn } from "../../motion";

// ===== Editable parameters (the snippet form fills these in) =====
const LEAD = "Watch the full video ";
const BODY = "on our channel \nfor more context";
const CTA_LABEL = "youtube.com/apify";
const SHAPES = true;
const Y = 0;
// =================================================================

export const fps = 25;
export const durationInFrames = 125;

export const orientation = "vertical";
export const designWidth = 1080;
export const designHeight = 1920;
export const holdFrame = 60;

const SETTLE = 45;

// --- Figma: Final CTA / "Watch the full video outro" (2765:3122) -----------
// Text    2765:3149 @ (231, 821)  619 x 204   Light 68.106, lead in Medium
// Button  2765:3153 @ (277, 1136) 526 x 126.886
// Shapes  one high left bleeding off frame, one low right
const TEXT = { x: 231, y: 821, w: 619, size: 68.106 };
const BUTTON = { x: 277, y: 1136, w: 526, h: 126.886 };
// This instance of the CTA button scales padding, border and shadow by 1.1535
// but its type by 1.3306, so the numbers are lifted rather than derived.
const BTN = {
  fontSize: 68.98, padX: 66.442, padY: 44.295, border: 2.768, shadow: 8.305, radius: 4,
  bg: "#020202", stroke: "#bfc1c5", ink: "#f4f4f5",
};
const ORANGE = "#f86606";
const WHITE = "#ffffff";

const SceneBg: React.FC = () => <AbsoluteFill style={{ backgroundColor: "#000000" }} />;

export default function ShortWatchFull() {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();
  const plane = figmaPlane(width, height, "center");

  const textIn = frame >= SETTLE ? 1 : springIn(frame, vfps, 0, "LIQUID");
  const btnIn = frame >= SETTLE ? 1 : springIn(frame, vfps, 14, "SNAPPY");

  return (
    <AbsoluteFill>
      <style>{BRAND_FONT_FACE_CSS}</style>
      <SceneBg />
      <div style={plane.outer}>
        <div style={plane.inner}>
          {SHAPES && (
            <>
              <img src={staticFile("assets/short-form/geometric-shapes.svg")} alt=""
                style={{ position: "absolute", left: -473, top: -94, width: 1071.655, height: 989.743 }} />
              <img src={staticFile("assets/short-form/geometric-shapes.svg")} alt=""
                style={{ position: "absolute", left: 510, top: 1111, width: 900, height: 990.925 }} />
            </>
          )}

          <div style={{
            position: "absolute", top: Y || TEXT.y, left: TEXT.x, width: TEXT.w,
            fontFamily: "'GT Walsheim'", fontWeight: 300, fontSize: TEXT.size, lineHeight: 1,
            color: WHITE, textAlign: "center", whiteSpace: "pre-line",
            clipPath: `inset(0 ${(1 - textIn) * 100}% 0 0)`,
          }}>
            <span style={{ fontWeight: 500 }}>{LEAD}</span>
            {BODY}
          </div>

          <div style={{
            position: "absolute", top: BUTTON.y, left: BUTTON.x,
            width: BUTTON.w, height: BUTTON.h, boxSizing: "border-box",
            backgroundColor: BTN.bg, borderRadius: BTN.radius,
            outline: `${BTN.border}px solid ${BTN.stroke}`,
            outlineOffset: -BTN.border / 2,
            filter: `drop-shadow(${BTN.shadow}px ${BTN.shadow}px 0px ${ORANGE})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: `${BTN.padY}px ${BTN.padX}px`,
            transform: `scale(${0.94 + 0.06 * btnIn})`, transformOrigin: "center",
          }}>
            <div style={{
              fontFamily: "'GT Walsheim'", fontWeight: 400, fontSize: BTN.fontSize,
              lineHeight: 1.15, color: BTN.ink, whiteSpace: "nowrap",
            }}>{CTA_LABEL}</div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}
