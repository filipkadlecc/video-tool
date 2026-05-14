import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { evolvePath } from "@remotion/paths";
import { BRAND, BRAND_FONT_FACE_CSS } from "../../theme";
import { springIn, ambientDrift, TIMING } from "../../motion";

export const fps = 30;
export const durationInFrames = 150;

const TITLE = "Drawn in motion";
const SUBTITLE = "Animated SVG paths via @remotion/paths";
const ACCENT = BRAND.colors.pink;

// A signature-style underline path. evolvePath() takes a 0→1 progress and
// returns { strokeDasharray, strokeDashoffset } that "draws" the stroke.
const UNDERLINE_D = "M 20 80 C 120 40, 300 110, 480 60 S 720 30, 880 70";
const UNDERLINE_VB = "0 0 900 100";

export default function PathReveal() {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();
  const base = Math.min(width, height);

  // Title pops in first, underline draws after, subtitle eases in last.
  const titleIn = springIn(frame, vfps, 0, "SNAPPY");
  // Drive the path-draw from a LIQUID spring (slow, premium-feeling stroke).
  const drawProgress = springIn(frame, vfps, TIMING.entrance + 6, "LIQUID");
  const subIn = springIn(frame, vfps, TIMING.entrance * 4, "GENTLE");

  const titleY = interpolate(titleIn, [0, 1], [40, 0]);
  const subY = interpolate(subIn, [0, 1], [20, 0]);

  // evolvePath returns dasharray/dashoffset values that progressively reveal
  // the path stroke. Pass progress (0→1) plus the path d-string.
  const { strokeDasharray, strokeDashoffset } = evolvePath(drawProgress, UNDERLINE_D);

  const driftY = ambientDrift(frame, 2, 100, "hero");

  return (
    <>
      <style>{BRAND_FONT_FACE_CSS}</style>
      <AbsoluteFill
        style={{
          background: BRAND.colors.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: base * 0.018,
            transform: `translateY(${driftY}px)`,
          }}
        >
          <div
            style={{
              fontFamily: BRAND.fonts.marketing,
              fontWeight: 900,
              fontSize: base * 0.12,
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
              width: base * 0.6,
              height: base * 0.07,
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
              style={{
                filter: `drop-shadow(0 0 ${base * 0.012}px ${ACCENT}AA)`,
              }}
            />
          </svg>

          <div
            style={{
              fontFamily: BRAND.fonts.primary,
              fontWeight: 500,
              fontSize: base * 0.028,
              color: BRAND.colors.textMuted,
              letterSpacing: "0.02em",
              opacity: subIn,
              transform: `translateY(${subY}px)`,
            }}
          >
            {SUBTITLE}
          </div>
        </div>
      </AbsoluteFill>
    </>
  );
}
