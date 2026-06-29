import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { BRAND, BRAND_FONT_FACE_CSS } from "../../theme";
import { springIn, ambientDrift, TIMING, inOutEnvelope } from "../../motion";
import { ContourField, RegistrationFrame } from "../../decor";

export const fps = 30;
export const durationInFrames = 180;

// Event / intro card over a topographic CONTOUR background with a registration
// crop-mark FRAME. Shows how to layer the ../../decor primitives behind a
// headline: ContourField is a faint background layer; RegistrationFrame is a
// thin overlay; the headline stays the hero. Orange-only, no fade-to-black.

const EYEBROW = "July 2, 2026 · European Startup Embassy, SF";
const HEADLINE_LEAD = "AI Engineer World's Fair";
const HEADLINE_HIGHLIGHT = "Rooftop Afterparty";
const SUBHEAD = "Drinks, demos, and the people building the agentic web.";

const ACCENT = BRAND.colors.orange;

export default function EventContour() {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();
  const base = Math.min(width, height);

  const envelope = inOutEnvelope(frame, vfps, durationInFrames);
  const eyebrowIn = springIn(frame, vfps, TIMING.entrance, "SNAPPY");
  const titleIn = springIn(frame, vfps, TIMING.entrance + 8, "SNAPPY");
  const highlightIn = springIn(frame, vfps, TIMING.entrance + 16, "LIQUID");
  const subIn = springIn(frame, vfps, TIMING.entrance + 24, "GENTLE");
  const driftY = ambientDrift(frame, 2, 120, "event-head");

  const eyebrowSize = base * 0.024;
  const headSize = base * 0.072;
  const subSize = base * 0.028;

  return (
    <>
      <style>{BRAND_FONT_FACE_CSS}</style>
      <AbsoluteFill style={{ background: BRAND.colors.bg, opacity: envelope }}>
        {/* Faint topographic contour, anchored low and behind the content. */}
        <ContourField position="bottom" lines={4} opacity={0.5} />

        {/* Content column. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: `${base * 0.14}px ${base * 0.1}px`,
            gap: base * 0.03,
            transform: `translateY(${driftY}px)`,
          }}
        >
          <div
            style={{
              fontFamily: BRAND.fonts.primary,
              fontWeight: 500,
              fontSize: eyebrowSize,
              color: BRAND.colors.textMuted,
              letterSpacing: "0.04em",
              opacity: eyebrowIn,
              transform: `translateY(${interpolate(eyebrowIn, [0, 1], [12, 0])}px)`,
            }}
          >
            {EYEBROW}
          </div>

          <div
            style={{
              fontFamily: BRAND.fonts.marketing,
              fontWeight: 600,
              fontSize: headSize,
              color: BRAND.colors.text,
              lineHeight: 1.04,
              letterSpacing: "-0.025em",
              maxWidth: width * 0.78,
            }}
          >
            <div style={{ opacity: titleIn, transform: `translateY(${interpolate(titleIn, [0, 1], [18, 0])}px)` }}>
              {HEADLINE_LEAD}
            </div>
            <div style={{ opacity: highlightIn, marginTop: base * 0.006 }}>
              <span
                style={{
                  background: BRAND.colors.orangeTint,
                  borderBottom: `2px solid ${ACCENT}`,
                  padding: "0 10px",
                  borderRadius: 6,
                }}
              >
                {HEADLINE_HIGHLIGHT}
              </span>
            </div>
          </div>

          <div
            style={{
              fontFamily: BRAND.fonts.primary,
              fontSize: subSize,
              color: BRAND.colors.textMuted,
              lineHeight: 1.4,
              maxWidth: width * 0.55,
              opacity: subIn,
              transform: `translateY(${interpolate(subIn, [0, 1], [10, 0])}px)`,
            }}
          >
            {SUBHEAD}
          </div>
        </div>

        {/* Thin registration crop-mark frame on top. */}
        <RegistrationFrame inset={6} opacity={0.8} />
      </AbsoluteFill>
    </>
  );
}
