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
import { springIn, ambientDrift, inOutEnvelope } from "../../motion";

export const fps = 30;
export const durationInFrames = 240;

// Corner watermark overlay — Apify symbol + URL on a card surface that sits
// on top of any underlying footage.

const URL_TEXT = "apify.com";

export default function SymbolBug() {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();
  const base = Math.min(width, height);

  const inProgress = springIn(frame, vfps, 0, "LIQUID");
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

  const breathe = 1 + ambientDrift(frame, 0.015, 80, "bug");

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
            background: BRAND.colors.card,
            border: `1px solid ${BRAND.colors.border}`,
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
              background: BRAND.colors.border,
            }}
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
      </AbsoluteFill>
    </>
  );
}
