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
export const durationInFrames = 120;

const CTA = "Try it free";
const URL = "apify.com";
const ACCENT = BRAND.colors.pink;

export default function EndCard() {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();
  const base = Math.min(width, height);

  const logoIn = springIn(frame, vfps, 0, "ELASTIC");
  const ctaIn = springIn(frame, vfps, TIMING.entrance, "SNAPPY");
  const urlIn = springIn(frame, vfps, TIMING.entrance * 2, "GENTLE");

  // Noise-driven breathing — feels organic, not mechanical.
  const breathe = 1 + ambientDrift(frame, 0.02, 90, "end-cta");

  return (
    <>
      <style>{BRAND_FONT_FACE_CSS}</style>
      <AbsoluteFill
        style={{
          background: `linear-gradient(160deg, ${BRAND.colors.bg} 0%, ${BRAND.colors.bgSoft} 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: base * 0.05,
        }}
      >
        <div
          style={{
            opacity: logoIn,
            transform: `scale(${interpolate(logoIn, [0, 1], [0.7, 1])})`,
          }}
        >
          <Img
            src={staticFile(BRAND.logoSrc)}
            style={{ width: base * 0.14, height: "auto" }}
          />
        </div>
        <div
          style={{
            fontFamily: BRAND.fonts.marketing,
            fontWeight: 700,
            fontSize: base * 0.13,
            color: BRAND.colors.text,
            letterSpacing: "-0.025em",
            lineHeight: 1,
            opacity: ctaIn,
            transform: `translateY(${interpolate(ctaIn, [0, 1], [30, 0])}px) scale(${breathe})`,
            textAlign: "center",
          }}
        >
          {CTA}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: base * 0.015,
            opacity: urlIn,
            transform: `translateY(${interpolate(urlIn, [0, 1], [20, 0])}px)`,
          }}
        >
          <div
            style={{
              width: base * 0.012,
              height: base * 0.012,
              borderRadius: "50%",
              background: ACCENT,
              boxShadow: `0 0 ${base * 0.02}px ${ACCENT}`,
            }}
          />
          <div
            style={{
              fontFamily: BRAND.fonts.primary,
              fontWeight: 600,
              fontSize: base * 0.032,
              color: BRAND.colors.text,
              letterSpacing: "0.02em",
            }}
          >
            {URL}
          </div>
        </div>
      </AbsoluteFill>
    </>
  );
}
