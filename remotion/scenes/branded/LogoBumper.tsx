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

const ACCENT = BRAND.colors.pink;

export default function LogoBumper() {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();
  const base = Math.min(width, height);

  // SNAPPY for that classic logo-bumper "thump".
  const inProgress = springIn(frame, vfps, 0, "SNAPPY");

  const holdEnd = durationInFrames - 12;
  const outProgress = interpolate(frame, [holdEnd, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const scaleIn = interpolate(inProgress, [0, 1], [0.5, 1]);
  const scaleOut = interpolate(outProgress, [0, 1], [1, 1.15]);
  const scale = scaleIn * scaleOut;
  const opacity = Math.min(inProgress, 1 - outProgress);

  const ringRadius = interpolate(inProgress, [0, 1], [0, base * 0.18]);
  const ringOpacity = interpolate(inProgress, [0, 1], [0.6, 0]);

  return (
    <>
      <style>{BRAND_FONT_FACE_CSS}</style>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 50%, ${BRAND.colors.bgSoft} 0%, ${BRAND.colors.bg} 75%)`,
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
            border: `${Math.max(2, base * 0.002)}px solid ${ACCENT}`,
            opacity: ringOpacity,
          }}
        />
        <div
          style={{
            opacity,
            transform: `scale(${scale})`,
            filter: `drop-shadow(0 0 ${base * 0.04}px ${ACCENT}66)`,
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
