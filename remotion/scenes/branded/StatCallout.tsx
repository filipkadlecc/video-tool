import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { BRAND, BRAND_FONT_FACE_CSS } from "../../theme";
import { springIn, ambientDrift, SPRINGS } from "../../motion";

export const fps = 30;
export const durationInFrames = 90;

const VALUE = 1_200_000;
const LABEL = "actor runs / month";
const PREFIX = "";
const SUFFIX = "+";
const ACCENT = BRAND.colors.pink;

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

export default function StatCallout() {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();
  const base = Math.min(width, height);

  // Count-up uses LIQUID — slow, smooth, premium pacing.
  const countProgress = spring({
    frame,
    fps: vfps,
    delay: 4,
    config: SPRINGS.LIQUID,
  });
  const displayValue = Math.round(interpolate(countProgress, [0, 1], [0, VALUE]));

  const labelIn = springIn(frame, vfps, 18, "GENTLE");
  const accentIn = springIn(frame, vfps, 0, "SNAPPY");

  // Subtle breathing on the big number during hold.
  const breatheY = ambientDrift(frame, 3, 80, "stat");

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
          gap: base * 0.025,
        }}
      >
        <div
          style={{
            width: interpolate(accentIn, [0, 1], [0, base * 0.08]),
            height: 4,
            background: ACCENT,
            borderRadius: 2,
            marginBottom: base * 0.015,
          }}
        />
        <div
          style={{
            fontFamily: BRAND.fonts.marketing,
            fontWeight: 900,
            fontSize: base * 0.22,
            color: BRAND.colors.text,
            letterSpacing: "-0.04em",
            lineHeight: 0.9,
            display: "flex",
            alignItems: "baseline",
            gap: base * 0.005,
            transform: `translateY(${breatheY}px)`,
          }}
        >
          {PREFIX && (
            <span style={{ fontSize: base * 0.12, color: ACCENT }}>{PREFIX}</span>
          )}
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {formatNumber(displayValue)}
          </span>
          {SUFFIX && (
            <span style={{ fontSize: base * 0.12, color: ACCENT }}>{SUFFIX}</span>
          )}
        </div>
        <div
          style={{
            fontFamily: BRAND.fonts.primary,
            fontWeight: 500,
            fontSize: base * 0.028,
            color: BRAND.colors.textMuted,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            opacity: labelIn,
            transform: `translateY(${interpolate(labelIn, [0, 1], [12, 0])}px)`,
          }}
        >
          {LABEL}
        </div>
      </AbsoluteFill>
    </>
  );
}
