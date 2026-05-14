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
export const durationInFrames = 150;

const QUOTE = "We replaced six brittle scrapers with one Apify Actor and cut our data costs in half.";
const AUTHOR = "Engineering Lead";
const COMPANY = "Acme Corp";
const ACCENT = BRAND.colors.pink;

export default function QuoteCard() {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();
  const base = Math.min(width, height);

  // ELASTIC quotemark pops in; LIQUID quote body eases smoothly; GENTLE
  // attribution tucks in last.
  const markIn = springIn(frame, vfps, 0, "ELASTIC");
  const quoteIn = springIn(frame, vfps, 6, "LIQUID");
  const authorIn = springIn(frame, vfps, TIMING.staggerLong, "GENTLE");

  return (
    <>
      <style>{BRAND_FONT_FACE_CSS}</style>
      <AbsoluteFill
        style={{
          background: BRAND.colors.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: width * 0.08,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: base * 0.025,
            maxWidth: width * 0.7,
          }}
        >
          <div
            style={{
              fontFamily: BRAND.fonts.marketing,
              fontWeight: 900,
              fontSize: base * 0.18,
              color: ACCENT,
              lineHeight: 0.7,
              opacity: markIn,
              transform: `scale(${interpolate(markIn, [0, 1], [0.5, 1])})`,
              transformOrigin: "left top",
            }}
          >
            &ldquo;
          </div>
          <div
            style={{
              fontFamily: BRAND.fonts.marketing,
              fontWeight: 500,
              fontSize: base * 0.058,
              color: BRAND.colors.text,
              lineHeight: 1.15,
              letterSpacing: "-0.01em",
              opacity: quoteIn,
              transform: `translateY(${interpolate(quoteIn, [0, 1], [20, 0])}px)`,
            }}
          >
            {QUOTE}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: base * 0.015,
              opacity: authorIn,
              transform: `translateY(${interpolate(authorIn, [0, 1], [12, 0])}px)`,
              marginTop: base * 0.02,
            }}
          >
            <div
              style={{
                width: base * 0.025,
                height: 2,
                background: ACCENT,
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
              {AUTHOR}
              {COMPANY && (
                <span style={{ color: BRAND.colors.textMuted, fontWeight: 400 }}>
                  {" · "}
                  {COMPANY}
                </span>
              )}
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </>
  );
}
