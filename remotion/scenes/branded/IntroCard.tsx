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
import { springIn, ambientDrift, TIMING } from "../../motion";

export const fps = 30;
export const durationInFrames = 90;

const TITLE = "Apify";
const SUBTITLE = "Build, deploy, and scale web scrapers";
const ACCENT = BRAND.colors.pink;

export default function IntroCard() {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();

  // ELASTIC for the logo gives a subtle overshoot pop; SNAPPY for the title
  // makes the headline land hard; GENTLE for the subtitle so it eases in last.
  const logoIn = springIn(frame, vfps, 0, "ELASTIC");
  const titleIn = springIn(frame, vfps, TIMING.entrance, "SNAPPY");
  const subIn = springIn(frame, vfps, TIMING.entrance * 2, "GENTLE");

  const logoScale = interpolate(logoIn, [0, 1], [0.6, 1]);
  const titleY = interpolate(titleIn, [0, 1], [40, 0]);
  const subY = interpolate(subIn, [0, 1], [20, 0]);

  // Ambient drift on the logo during the hold — keeps the frame alive.
  const driftX = ambientDrift(frame, 3, 70, "logo-x");
  const driftY = ambientDrift(frame, 2, 90, "logo-y");

  const exit = interpolate(frame, [durationInFrames - 12, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const base = Math.min(width, height);

  return (
    <>
      <style>{BRAND_FONT_FACE_CSS}</style>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 45%, ${BRAND.colors.bgSoft} 0%, ${BRAND.colors.bg} 70%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: base * 0.04,
          opacity: exit,
        }}
      >
        <div
          style={{
            transform: `translate(${driftX}px, ${driftY}px) scale(${logoScale})`,
            opacity: logoIn,
            filter: `drop-shadow(0 0 ${base * 0.04}px ${ACCENT}55)`,
          }}
        >
          <Img
            src={staticFile(BRAND.logoSrc)}
            style={{ width: base * 0.18, height: "auto" }}
          />
        </div>
        <div
          style={{
            fontFamily: BRAND.fonts.marketing,
            fontWeight: 700,
            fontSize: base * 0.11,
            color: BRAND.colors.text,
            letterSpacing: "-0.02em",
            transform: `translateY(${titleY}px)`,
            opacity: titleIn,
            lineHeight: 1,
          }}
        >
          {TITLE}
        </div>
        <div
          style={{
            fontFamily: BRAND.fonts.primary,
            fontWeight: 500,
            fontSize: base * 0.025,
            color: BRAND.colors.textMuted,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            transform: `translateY(${subY}px)`,
            opacity: subIn,
          }}
        >
          {SUBTITLE}
        </div>
        <div
          style={{
            width: base * 0.06,
            height: 3,
            background: ACCENT,
            borderRadius: 2,
            opacity: subIn,
            marginTop: base * 0.02,
          }}
        />
      </AbsoluteFill>
    </>
  );
}
