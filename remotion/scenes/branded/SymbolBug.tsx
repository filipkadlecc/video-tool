import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Img,
  staticFile,
} from "remotion";
import { Circle } from "@remotion/shapes";
import { BRAND, BRAND_FONT_FACE_CSS } from "../../theme";
import { springIn, ambientDrift, inOutEnvelope } from "../../motion";

export const fps = 30;
export const durationInFrames = 240;

const URL_TEXT = "apify.com";
const ACCENT = BRAND.colors.pink;

export default function SymbolBug() {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();
  const base = Math.min(width, height);

  // Slide in from the right with LIQUID — corner bug should feel subtle.
  const inProgress = springIn(frame, vfps, 0, "LIQUID");

  // Symmetric envelope: ramp in, hold, ramp out at the tail.
  const opacity = inOutEnvelope(frame, vfps, durationInFrames, {
    inPreset: "LIQUID",
    exitFrames: 18,
  });

  const x =
    interpolate(inProgress, [0, 1], [base * 0.04, 0]) +
    interpolate(frame, [durationInFrames - 18, durationInFrames], [0, base * 0.04], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

  // Noise-driven breathing replaces Math.sin — feels alive, not metronomic.
  const breathe = 1 + ambientDrift(frame, 0.025, 70, "bug");

  const dotSize = base * 0.01;

  return (
    <>
      <style>{BRAND_FONT_FACE_CSS}</style>
      <AbsoluteFill style={{ background: "transparent" }}>
        <div
          style={{
            position: "absolute",
            right: base * 0.04,
            bottom: base * 0.04,
            display: "flex",
            alignItems: "center",
            gap: base * 0.014,
            padding: `${base * 0.014}px ${base * 0.02}px`,
            background: "rgba(18, 9, 26, 0.78)",
            backdropFilter: "blur(12px)",
            border: `0.5px solid rgba(255,255,255,0.10)`,
            borderRadius: base * 0.01,
            opacity,
            transform: `translateX(${x}px) scale(${breathe})`,
            transformOrigin: "right bottom",
          }}
        >
          <Img
            src={staticFile("assets/apify/Apify symbol colors.svg")}
            style={{ width: base * 0.04, height: "auto" }}
          />
          <div
            style={{
              width: 1,
              height: base * 0.04,
              background: "rgba(255,255,255,0.12)",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: base * 0.008 }}>
            {/*
              @remotion/shapes <Circle/> — same visual as a CSS round div but
              renders as inline SVG, so it stays crisp at every resolution
              and animates without subpixel jitter.
            */}
            <Circle
              radius={dotSize / 2}
              fill={ACCENT}
              style={{ filter: `drop-shadow(0 0 ${base * 0.012}px ${ACCENT})` }}
            />
            <div
              style={{
                fontFamily: BRAND.fonts.primary,
                fontWeight: 600,
                fontSize: base * 0.022,
                color: BRAND.colors.text,
                letterSpacing: "0.02em",
              }}
            >
              {URL_TEXT}
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </>
  );
}
