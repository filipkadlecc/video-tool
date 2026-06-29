import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { BRAND, BRAND_FONT_FACE_CSS } from "../../theme";
import { springIn, ambientDrift, TIMING, inOutEnvelope } from "../../motion";

export const fps = 30;
export const durationInFrames = 120;

// Apify PLGTM-style hero card.
// Headline with ONE orange-highlighted phrase + muted subhead.

const HEADLINE_LEAD = "Real-time web data for";
const HEADLINE_HIGHLIGHT = "social media monitoring";
const HEADLINE_TAIL = "and lead generation.";
const SUBHEAD = "Your one-line subhead — keep it under 80 characters.";

const ACCENT = BRAND.colors.orange;

export default function IntroCard() {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();
  const base = Math.min(width, height);

  const envelope = inOutEnvelope(frame, vfps, durationInFrames);

  // Headline lands first (SNAPPY), highlight pill draws its border after,
  // subhead eases in last.
  const titleIn = springIn(frame, vfps, TIMING.entrance, "SNAPPY");
  const highlightIn = springIn(frame, vfps, TIMING.entrance + 10, "LIQUID");
  const subIn = springIn(frame, vfps, TIMING.entrance + 18, "GENTLE");

  // Subtle drift on the headline during the hold so the frame doesn't freeze.
  const driftY = ambientDrift(frame, 2, 110, "headline");

  const headlineSize = base * 0.075;
  const subSize = base * 0.028;

  return (
    <>
      <style>{BRAND_FONT_FACE_CSS}</style>
      <AbsoluteFill
        style={{
          background: BRAND.colors.bg,
          opacity: envelope,
        }}
      >
        {/* Headline column — centered narrow column. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "flex-start",
            padding: `0 ${base * 0.08}px`,
            transform: `translateY(${driftY}px)`,
          }}
        >
          <div
            style={{
              fontFamily: BRAND.fonts.marketing,
              fontWeight: 600,
              fontSize: headlineSize,
              color: BRAND.colors.text,
              letterSpacing: "-0.025em",
              lineHeight: 1.08,
              maxWidth: width * 0.72,
              opacity: titleIn,
              transform: `translateY(${interpolate(titleIn, [0, 1], [24, 0])}px)`,
            }}
          >
            {HEADLINE_LEAD}{" "}
            <span
              style={{
                background: BRAND.colors.orangeTint,
                borderBottom: `${Math.max(2, base * 0.003)}px solid ${ACCENT}`,
                padding: `0 ${base * 0.012}px`,
                borderRadius: base * 0.008,
                // Mask-reveal the highlight pill left-to-right after the headline lands.
                clipPath: `inset(0 ${interpolate(highlightIn, [0, 1], [100, 0])}% 0 0)`,
              }}
            >
              {HEADLINE_HIGHLIGHT}
            </span>{" "}
            {HEADLINE_TAIL}
          </div>

          <div
            style={{
              marginTop: base * 0.035,
              fontFamily: BRAND.fonts.primary,
              fontWeight: 500,
              fontSize: subSize,
              color: BRAND.colors.textMuted,
              letterSpacing: "-0.005em",
              lineHeight: 1.35,
              maxWidth: width * 0.55,
              opacity: subIn,
              transform: `translateY(${interpolate(subIn, [0, 1], [14, 0])}px)`,
            }}
          >
            {SUBHEAD}
          </div>
        </div>
      </AbsoluteFill>
    </>
  );
}
