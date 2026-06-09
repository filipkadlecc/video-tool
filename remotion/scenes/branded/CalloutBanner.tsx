import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { BRAND, BRAND_FONT_FACE_CSS } from "../../theme";
import { springIn, TIMING, inOutEnvelope } from "../../motion";

export const fps = 30;
export const durationInFrames = 100;

// Headline-strip overlay — drops in from the top with one highlighted phrase.
// Designed to sit ON TOP of b-roll: background is the bg card surface so it
// reads cleanly over any underlying footage.

const LEAD = "Build something";
const HIGHLIGHT = "people actually use.";
const SUBHEAD = "Ship in minutes — without owning the infra.";

const ACCENT = BRAND.colors.orange;

export default function CalloutBanner() {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();
  const base = Math.min(width, height);

  const envelope = inOutEnvelope(frame, vfps, durationInFrames);

  const cardIn = springIn(frame, vfps, 0, "SNAPPY");
  const titleIn = springIn(frame, vfps, TIMING.entrance + 6, "SNAPPY");
  const highlightIn = springIn(frame, vfps, TIMING.entrance + 14, "LIQUID");
  const subIn = springIn(frame, vfps, TIMING.entrance + 20, "GENTLE");

  const slideY = interpolate(cardIn, [0, 1], [-base * 0.06, 0]);

  const headlineSize = base * 0.055;
  const subSize = base * 0.025;

  return (
    <>
      <style>{BRAND_FONT_FACE_CSS}</style>
      <AbsoluteFill style={{ background: "transparent", opacity: envelope }}>
        <div
          style={{
            position: "absolute",
            top: base * 0.06,
            left: width * 0.06,
            right: width * 0.06,
            display: "flex",
            flexDirection: "column",
            gap: base * 0.02,
            padding: `${base * 0.03}px ${base * 0.04}px`,
            background: BRAND.colors.card,
            border: `1px solid ${BRAND.colors.border}`,
            borderRadius: base * 0.016,
            opacity: cardIn,
            transform: `translateY(${slideY}px)`,
          }}
        >
          <div
            style={{
              fontFamily: BRAND.fonts.marketing,
              fontWeight: 600,
              fontSize: headlineSize,
              color: BRAND.colors.text,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
              opacity: titleIn,
              transform: `translateX(${interpolate(titleIn, [0, 1], [-12, 0])}px)`,
            }}
          >
            {LEAD}{" "}
            <span
              style={{
                background: BRAND.colors.orangeTint,
                borderBottom: `${Math.max(2, base * 0.003)}px solid ${ACCENT}`,
                padding: `0 ${base * 0.01}px`,
                borderRadius: base * 0.006,
                clipPath: `inset(0 ${interpolate(highlightIn, [0, 1], [100, 0])}% 0 0)`,
              }}
            >
              {HIGHLIGHT}
            </span>
          </div>

          <div
            style={{
              fontFamily: BRAND.fonts.primary,
              fontWeight: 500,
              fontSize: subSize,
              color: BRAND.colors.textMuted,
              lineHeight: 1.3,
              opacity: subIn,
              transform: `translateY(${interpolate(subIn, [0, 1], [8, 0])}px)`,
            }}
          >
            {SUBHEAD}
          </div>
        </div>
      </AbsoluteFill>
    </>
  );
}
