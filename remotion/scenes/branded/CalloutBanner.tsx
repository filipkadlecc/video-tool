import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { BRAND, BRAND_FONT_FACE_CSS } from "../../theme";
import { springIn, TIMING } from "../../motion";

export const fps = 30;
export const durationInFrames = 90;

const TITLE = "What is Apify?";
const SUBTITLE = "The full-stack platform for web scraping and browser automation";
const ACCENT = BRAND.colors.pink;

export default function CalloutBanner() {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();
  const base = Math.min(width, height);

  // SNAPPY bar drop, SNAPPY title, GENTLE subtitle — mixed tempo per element.
  const barIn = springIn(frame, vfps, 0, "SNAPPY");
  const titleIn = springIn(frame, vfps, TIMING.entrance, "SNAPPY");
  const subIn = springIn(frame, vfps, TIMING.entrance * 2, "GENTLE");

  const exitStart = durationInFrames - 14;
  const exitProgress = interpolate(frame, [exitStart, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacity = Math.min(barIn, 1 - exitProgress);
  const slideY = interpolate(barIn, [0, 1], [-base * 0.05, 0]) +
    interpolate(exitProgress, [0, 1], [0, -base * 0.04]);

  return (
    <>
      <style>{BRAND_FONT_FACE_CSS}</style>
      <AbsoluteFill style={{ background: "transparent" }}>
        <div
          style={{
            position: "absolute",
            top: base * 0.08,
            left: width * 0.08,
            right: width * 0.08,
            display: "flex",
            flexDirection: "column",
            gap: base * 0.018,
            opacity,
            transform: `translateY(${slideY}px)`,
            padding: `${base * 0.025}px ${base * 0.04}px`,
            background: BRAND.colors.bg,
            borderRadius: base * 0.012,
            boxShadow: `0 ${base * 0.012}px ${base * 0.04}px rgba(0,0,0,0.5)`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: base * 0.012,
              opacity: titleIn,
              transform: `translateX(${interpolate(titleIn, [0, 1], [-12, 0])}px)`,
            }}
          >
            <div
              style={{
                width: Math.max(3, base * 0.004),
                height: base * 0.05,
                background: ACCENT,
                borderRadius: 2,
              }}
            />
            <div
              style={{
                fontFamily: BRAND.fonts.marketing,
                fontWeight: 700,
                fontSize: base * 0.055,
                color: BRAND.colors.text,
                letterSpacing: "-0.02em",
                lineHeight: 1,
              }}
            >
              {TITLE}
            </div>
          </div>
          <div
            style={{
              fontFamily: BRAND.fonts.primary,
              fontWeight: 500,
              fontSize: base * 0.026,
              color: BRAND.colors.textMuted,
              lineHeight: 1.3,
              opacity: subIn,
              transform: `translateY(${interpolate(subIn, [0, 1], [10, 0])}px)`,
              paddingLeft: base * 0.016,
            }}
          >
            {SUBTITLE}
          </div>
        </div>
      </AbsoluteFill>
    </>
  );
}
