import React from "react";
import { AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { BRAND_FONT_FACE_CSS, figmaPlane } from "../../theme";
import { springIn } from "../../motion";

// ===== Editable parameters (the snippet form fills these in) =====
// Leave LEAD empty for the plain call to action; fill it for the claim, where
// the first clause is Light and the rest Medium.
const LEAD = "";
const HEADLINE = "Try Apify\nfor free";
const CTA_LABEL = "apify.com";
const SHAPES = false;
const SIZE = 155.723;
const Y = 0;
// =================================================================

export const fps = 25;
export const durationInFrames = 125;

export const orientation = "vertical";
export const designWidth = 1080;
export const designHeight = 1920;
export const holdFrame = 60;

const SETTLE = 45;

// --- Figma: Final CTA, section 2546:829 ------------------------------------
// Logo      2704:3065 @ (380, 330.5)   319.294 x 87.847
// Headline  2704:3047 @ (231, 671.5)   619 x 312     Medium 155.723
// Claim     2704:7690 @ (231, 747.5)   619 x 261     Light + Medium 87.251
// Button    2704:3085 @ (348, 1094.5)  384 x 110.4
const LOGO = { x: 380, y: 330.5, w: 319.294, h: 87.847 };
// Left/width are Figma's own, not derived from a centre axis: this section
// centres its text on 540.5 and its buttons on 540, where the text-treatment
// section uses 539.5. Positioning by the node's own box sidesteps all of it.
const HEAD = { x: 231, w: 619, top: { cta: 671.5, claim: 747.5 } };
const BUTTON = { x: 348, y: 1094.5, w: 384, h: 110.4 };
// The button's own numbers. Not derived from a scale factor: the "Watch the
// full video" instance scales padding, border and shadow by 1.1535 but its type
// by 1.3306, so there is no single factor to derive them from.
// The label size is MEASURED, not read off Figma.
// get_design_context reports 51.84 for this label, but that is a number from
// inside the component, not the size it renders at — at 51.84 the text
// overflows the button. Swept against the frame export, the edge error
// bottoms out at 43. The two buttons' measured sizes (43 and 50) sit in the
// same ratio as their heights, which is what a shared component at two scales
// should look like.
const BTN = {
  fontSize: 43, padX: 57.6, padY: 38.4, border: 2.4, shadow: 7.2, radius: 4,
  bg: "#020202", stroke: "#bfc1c5", ink: "#f4f4f5",
};
const ORANGE = "#f86606";
const WHITE = "#ffffff";

const SceneBg: React.FC = () => <AbsoluteFill style={{ backgroundColor: "#000000" }} />;

export default function ShortEndCard() {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();
  const plane = figmaPlane(width, height, "center");

  const isClaim = LEAD.trim().length > 0;
  const top = Y || (isClaim ? HEAD.top.claim : HEAD.top.cta);

  const at = (delay: number) => (frame >= SETTLE ? 1 : springIn(frame, vfps, delay, "LIQUID"));
  const logoIn = at(0);
  const headIn = at(8);
  const btnIn = frame >= SETTLE ? 1 : springIn(frame, vfps, 20, "SNAPPY");

  return (
    <AbsoluteFill>
      <style>{BRAND_FONT_FACE_CSS}</style>
      <SceneBg />
      <div style={plane.outer}>
        <div style={plane.inner}>
          {SHAPES && (
            <>
              {/* Figma instances 2704:3745 and 2704:3751 — one low left, one
                  high right, both bleeding off the frame. */}
              <img src={staticFile("assets/short-form/geometric-shapes.svg")} alt=""
                style={{ position: "absolute", left: -201, top: 1268.5, width: 900, height: 990.925 }} />
              <img src={staticFile("assets/short-form/geometric-shapes.svg")} alt=""
                style={{ position: "absolute", left: 541, top: -430.5, width: 900, height: 990.925 }} />
            </>
          )}

          <img
            src={staticFile("assets/short-form/apify-lockup.svg")}
            alt=""
            style={{
              position: "absolute", left: LOGO.x, top: LOGO.y, width: LOGO.w, height: LOGO.h,
              transform: `scale(${0.96 + 0.04 * logoIn})`, transformOrigin: "center",
            }}
          />

          <div style={{
            position: "absolute", top, left: HEAD.x, width: HEAD.w,
            fontFamily: "'GT Walsheim'", fontWeight: 500, fontSize: SIZE, lineHeight: 1,
            color: WHITE, textAlign: "center",
            // The call to action is nowrap with explicit lines in Figma; the
            // claim flows inside its 619px box. Using pre-line for both wrapped
            // "Try Apify" onto two lines and pushed "for free" out of frame.
            whiteSpace: isClaim ? "pre-line" : "pre",
            clipPath: `inset(0 ${(1 - headIn) * 100}% 0 0)`,
          }}>
            {isClaim && <span style={{ fontWeight: 300 }}>{LEAD}</span>}
            {HEADLINE}
          </div>

          <div style={{
            position: "absolute", top: BUTTON.y, left: BUTTON.x,
            width: BUTTON.w, height: BUTTON.h, boxSizing: "border-box",
            backgroundColor: BTN.bg, borderRadius: BTN.radius,
            // Figma strokes sit centred on the bounds; a CSS border sits inside
            // them. An outline pulled in by half its width matches, and leaves
            // the box model (and so the button's 384x110.4) alone.
            outline: `${BTN.border}px solid ${BTN.stroke}`,
            outlineOffset: -BTN.border / 2,
            // A filter drop-shadow follows the rounded rect; box-shadow would
            // square the corners of the offset block.
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
