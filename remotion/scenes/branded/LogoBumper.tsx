import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Img,
  staticFile,
} from "remotion";
import { BRAND, BRAND_FONT_FACE_CSS } from "../../theme";
import { springIn } from "../../motion";

export const fps = 30;
export const durationInFrames = 60;

// Apify symbol reveal — short opener/closer.
// Flat #161718 bg, orange expanding ring, no drop-shadow tint (we already get
// the brand color from the symbol itself).

const ACCENT = BRAND.colors.orange;

export default function LogoBumper() {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();
  const base = Math.min(width, height);

  const inProgress = springIn(frame, vfps, 0, "SNAPPY");

  const holdEnd = durationInFrames - 12;
  const outProgress = interpolate(frame, [holdEnd, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const scaleIn = interpolate(inProgress, [0, 1], [0.55, 1]);
  const scaleOut = interpolate(outProgress, [0, 1], [1, 1.12]);
  const scale = scaleIn * scaleOut;
  const opacity = Math.min(inProgress, 1 - outProgress);

  const ringRadius = interpolate(inProgress, [0, 1], [0, base * 0.2]);
  const ringOpacity = interpolate(inProgress, [0, 1], [0.7, 0]);

  return (
    <>
      <style>{BRAND_FONT_FACE_CSS}</style>
      <AbsoluteFill
        style={{
          background: BRAND.colors.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: ringRadius * 2,
            height: ringRadius * 2,
            borderRadius: "50%",
            border: `${Math.max(2, base * 0.0025)}px solid ${ACCENT}`,
            opacity: ringOpacity,
          }}
        />
        <div
          style={{
            opacity,
            transform: `scale(${scale})`,
          }}
        >
          <Img
            src={staticFile("assets/apify/Apify symbol colors.svg")}
            style={{ width: base * 0.22, height: "auto" }}
          />
        </div>
      </AbsoluteFill>
    </>
  );
}
