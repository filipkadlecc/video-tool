import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { BRAND, BRAND_FONT_FACE_CSS } from "../../theme";
import { springIn, ambientDrift, SPRINGS, TIMING, inOutEnvelope } from "../../motion";

export const fps = 30;
export const durationInFrames = 120;

// Big-number reveal — Apify "200M" Figma frame.
// Oversized animated number with the SUFFIX highlighted in an
// orange pill, muted caption below. Flat #161718 bg.

const VALUE = 200;
const PREFIX = "";
const SUFFIX = "M";
const HEADLINE = "Actor runs in a single month";
const CAPTION = "Made possible by every creator building on Apify";

const ACCENT = BRAND.colors.orange;

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

export default function StatCallout() {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();
  const base = Math.min(width, height);

  const envelope = inOutEnvelope(frame, vfps, durationInFrames);

  const numberIn = spring({ frame, fps: vfps, delay: TIMING.entrance, config: SPRINGS.LIQUID });
  const displayValue = Math.round(interpolate(numberIn, [0, 1], [0, VALUE]));

  const headlineIn = springIn(frame, vfps, TIMING.entrance + 14, "SNAPPY");
  const captionIn = springIn(frame, vfps, TIMING.entrance + 22, "GENTLE");

  const breatheY = ambientDrift(frame, 2, 90, "number");

  const numberSize = base * 0.26;
  const suffixSize = base * 0.18;
  const headlineSize = base * 0.05;
  const captionSize = base * 0.022;

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
            alignItems: "center",
            justifyContent: "center",
            gap: base * 0.02,
          }}
        >
          <div
            style={{
              fontFamily: BRAND.fonts.marketing,
              fontWeight: 600,
              fontSize: numberSize,
              color: BRAND.colors.text,
              letterSpacing: "-0.04em",
              lineHeight: 0.9,
              display: "flex",
              alignItems: "baseline",
              gap: base * 0.005,
              transform: `translateY(${breatheY}px)`,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {PREFIX && <span>{PREFIX}</span>}
            <span>{formatNumber(displayValue)}</span>
            {SUFFIX && (
              <span
                style={{
                  fontSize: suffixSize,
                  color: ACCENT,
                  background: BRAND.colors.orangeTint,
                  borderBottom: `${Math.max(3, base * 0.004)}px solid ${ACCENT}`,
                  padding: `0 ${base * 0.018}px`,
                  borderRadius: base * 0.01,
                  marginLeft: base * 0.012,
                  opacity: interpolate(numberIn, [0.7, 1], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  }),
                }}
              >
                {SUFFIX}
              </span>
            )}
          </div>

          <div
            style={{
              fontFamily: BRAND.fonts.marketing,
              fontWeight: 600,
              fontSize: headlineSize,
              color: BRAND.colors.text,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
              opacity: headlineIn,
              transform: `translateY(${interpolate(headlineIn, [0, 1], [16, 0])}px)`,
            }}
          >
            {HEADLINE}
          </div>

          <div
            style={{
              marginTop: base * 0.015,
              fontFamily: BRAND.fonts.primary,
              fontWeight: 500,
              fontSize: captionSize,
              color: BRAND.colors.textMuted,
              letterSpacing: "-0.005em",
              opacity: captionIn,
              transform: `translateY(${interpolate(captionIn, [0, 1], [10, 0])}px)`,
              maxWidth: width * 0.55,
              textAlign: "center",
            }}
          >
            {CAPTION}
          </div>
        </div>
      </AbsoluteFill>
    </>
  );
}
