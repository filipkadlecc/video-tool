import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { evolvePath } from "@remotion/paths";
import { BRAND, BRAND_FONT_FACE_CSS } from "../../theme";
import { springIn, ambientDrift, TIMING, inOutEnvelope } from "../../motion";

export const fps = 30;
export const durationInFrames = 150;

// Headline with a hand-drawn ORANGE underline using @remotion/paths.
// Big headline, animated SVG underline, muted subhead.

const TITLE = "Drawn in motion";
const SUBTITLE = "Programmable video, built on web tech";
const ACCENT = BRAND.colors.orange;

// Signature-style underline path. evolvePath() takes a 0→1 progress and returns
// { strokeDasharray, strokeDashoffset } that progressively reveals the stroke.
const UNDERLINE_D = "M 20 80 C 120 40, 300 110, 480 60 S 720 30, 880 70";
const UNDERLINE_VB = "0 0 900 100";

export default function PathReveal() {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();
  const base = Math.min(width, height);

  const envelope = inOutEnvelope(frame, vfps, durationInFrames);

  const titleIn = springIn(frame, vfps, TIMING.entrance, "SNAPPY");
  const drawProgress = springIn(frame, vfps, TIMING.entrance + 12, "LIQUID");
  const subIn = springIn(frame, vfps, TIMING.entrance + 28, "GENTLE");

  const titleY = interpolate(titleIn, [0, 1], [32, 0]);
  const subY = interpolate(subIn, [0, 1], [16, 0]);
  const driftY = ambientDrift(frame, 2, 100, "hero");

  const { strokeDasharray, strokeDashoffset } = evolvePath(drawProgress, UNDERLINE_D);

  const titleSize = base * 0.11;
  const subSize = base * 0.026;

  return (
    <>
      <style>{BRAND_FONT_FACE_CSS}</style>
      <AbsoluteFill
        style={{
          background: BRAND.colors.bg,
          opacity: envelope,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "flex-start",
            padding: `0 ${base * 0.09}px`,
            gap: base * 0.018,
            transform: `translateY(${driftY}px)`,
          }}
        >
          <div
            style={{
              fontFamily: BRAND.fonts.marketing,
              fontWeight: 600,
              fontSize: titleSize,
              color: BRAND.colors.text,
              letterSpacing: "-0.03em",
              lineHeight: 1,
              opacity: titleIn,
              transform: `translateY(${titleY}px)`,
            }}
          >
            {TITLE}
          </div>

          <svg
            viewBox={UNDERLINE_VB}
            style={{
              width: base * 0.55,
              height: base * 0.065,
              overflow: "visible",
            }}
          >
            <path
              d={UNDERLINE_D}
              stroke={ACCENT}
              strokeWidth={Math.max(4, base * 0.006)}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
            />
          </svg>

          <div
            style={{
              fontFamily: BRAND.fonts.primary,
              fontWeight: 500,
              fontSize: subSize,
              color: BRAND.colors.textMuted,
              letterSpacing: "-0.005em",
              opacity: subIn,
              transform: `translateY(${subY}px)`,
              marginTop: base * 0.015,
            }}
          >
            {SUBTITLE}
          </div>
        </div>
      </AbsoluteFill>
    </>
  );
}
