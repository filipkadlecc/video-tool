import React from "react";
import { AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND_FONT_FACE_CSS, figmaPlane } from "../../theme";
import { springIn } from "../../motion";

// ===== Editable parameters (the snippet form fills these in) =====
const TITLE_LEAD = "This is the title.";
const TITLE_REST = "Only three lines\nmaximum";
const PILL_LABEL = "Case study";
const SHAPES = false;
// A partner mark, as an uploaded image. Figma's note: partner logos must be
// monochrome white or black — never their brand colour — on this lockup.
const PARTNER_LOGO: string[] = [
];
const Y = 0;
// =================================================================

export const fps = 25;
export const durationInFrames = 125;

export const orientation = "vertical";
export const designWidth = 1080;
export const designHeight = 1920;
export const holdFrame = 60;

const SETTLE = 45;

// --- Figma: "Collab logo lockup + case study" (2704:7783) ------------------
// Lockup 2704:7825 @ (252, 593)  576.812 x 70.147, gap 36, centred row
//   Apify 246.298 x 67.479 | x-glyph 25.469 | partner 233.045 x 70.147
// Title  2704:7824 @ (218, 772)  645 x 261,  87.251  (lead Light, rest Medium)
// Pill   2704:7819 @ (399, 1104) 283 x 88.379, 0.94px orange outline
//        label 2704:7805 Regular 40.115 white
const LOCKUP = { x: 252, w: 576.812, y: 593, gap: 36, apify: { w: 246.298, h: 67.479 }, cross: 25.469, partner: { w: 233.045, h: 70.147 } };
const TITLE = { x: 218, y: 772, w: 645, size: 87.251 };
const PILL = { x: 399, y: 1104, w: 283, h: 88.379, border: 0.94, size: 40.115 };
const ORANGE = "#f86606";
const WHITE = "#ffffff";

const SceneBg: React.FC = () => <AbsoluteFill style={{ backgroundColor: "#000000" }} />;

export default function ShortCollabCard() {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();
  const plane = figmaPlane(width, height, "center");

  const at = (d: number) => (frame >= SETTLE ? 1 : springIn(frame, vfps, d, "LIQUID"));
  const lockupIn = at(0);
  const titleIn = at(8);
  const pillIn = frame >= SETTLE ? 1 : springIn(frame, vfps, 20, "SNAPPY");

  return (
    <AbsoluteFill>
      <style>{BRAND_FONT_FACE_CSS}</style>
      <SceneBg />
      <div style={plane.outer}>
        <div style={plane.inner}>
          {SHAPES && (
            <>
              <img src={staticFile("assets/short-form/geometric-shapes.svg")} alt=""
                style={{ position: "absolute", left: -201, top: 1269, width: 900, height: 990.925 }} />
              <img src={staticFile("assets/short-form/geometric-shapes.svg")} alt=""
                style={{ position: "absolute", left: 541, top: -430, width: 900, height: 990.925 }} />
            </>
          )}

          <div style={{
            position: "absolute", top: LOCKUP.y, left: LOCKUP.x, width: LOCKUP.w,
            display: "flex", alignItems: "center", justifyContent: "center", gap: LOCKUP.gap,
            transform: `scale(${0.97 + 0.03 * lockupIn})`, transformOrigin: "center",
          }}>
            <img src={staticFile("assets/short-form/apify-lockup.svg")} alt=""
              style={{ width: LOCKUP.apify.w, height: LOCKUP.apify.h }} />
            {/* The multiplication glyph between the two marks, drawn rather than
                typed so it keeps its exact weight and size at any scale. */}
            <svg width={LOCKUP.cross} height={LOCKUP.cross} viewBox="0 0 26 26" aria-hidden>
              <path d="M2 2 L24 24 M24 2 L2 24" stroke={WHITE} strokeWidth={2} strokeLinecap="round" />
            </svg>
            {PARTNER_LOGO[0] ? (
              <img src={PARTNER_LOGO[0]} alt=""
                style={{ width: LOCKUP.partner.w, height: LOCKUP.partner.h, objectFit: "contain" }} />
            ) : (
              <div style={{
                width: LOCKUP.partner.w, height: LOCKUP.partner.h,
                display: "flex", flexDirection: "column", justifyContent: "center",
                fontFamily: "'GT Walsheim'", fontWeight: 400, fontSize: 33, lineHeight: 1.06,
                color: WHITE, opacity: 0.6,
              }}>
                <div>Partner&rsquo;s logo</div>
                <div>replace</div>
              </div>
            )}
          </div>

          <div style={{
            position: "absolute", top: Y || TITLE.y, left: TITLE.x, width: TITLE.w,
            fontFamily: "'GT Walsheim'", fontWeight: 500, fontSize: TITLE.size, lineHeight: 1,
            color: WHITE, textAlign: "center", whiteSpace: "pre-line",
            clipPath: `inset(0 ${(1 - titleIn) * 100}% 0 0)`,
          }}>
            <span style={{ fontWeight: 300 }}>{TITLE_LEAD}</span>
            {"\n"}
            {TITLE_REST}
          </div>

          <div style={{
            position: "absolute", top: PILL.y, left: PILL.x,
            width: PILL.w, height: PILL.h, boxSizing: "border-box",
            outline: `${PILL.border}px solid ${ORANGE}`,
            outlineOffset: -PILL.border / 2,
            display: "flex", alignItems: "center", justifyContent: "center",
            transform: `scale(${0.94 + 0.06 * pillIn})`, transformOrigin: "center",
          }}>
            <div style={{
              fontFamily: "'GT Walsheim'", fontWeight: 400, fontSize: PILL.size,
              lineHeight: 1, color: WHITE, whiteSpace: "nowrap",
            }}>{PILL_LABEL}</div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}
