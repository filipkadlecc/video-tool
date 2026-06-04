import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { BRAND, BRAND_FONT_FACE_CSS } from "../../theme";
import { springIn, staggeredSpring, TIMING, inOutEnvelope } from "../../motion";

export const fps = 30;
export const durationInFrames = 210;

// Rising-Stars Actor leaderboard — numbered rows with an Actor name + author,
// orange-tinted rank badges, orange triangular wedge in the bottom-right corner.
// Header has the "Rising Stars" eyebrow + headline.

const EYEBROW = "Rising Stars";
const HEADLINE = "New Actors worth your attention";
const ROWS: { name: string; author: string }[] = [
  { name: "1688.com Products Scraper", author: "by devcake" },
  { name: "Insta Comment Bot", author: "by lumora" },
  { name: "LinkedIn Leads Finder", author: "by apify-labs" },
  { name: "Threads Mention Tracker", author: "by petr.b" },
];

const ACCENT = BRAND.colors.orange;

export default function RisingStarsList() {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();
  const base = Math.min(width, height);

  const envelope = inOutEnvelope(frame, vfps, durationInFrames);

  const eyebrowIn = springIn(frame, vfps, TIMING.entrance, "SNAPPY");
  const titleIn = springIn(frame, vfps, TIMING.entrance + 8, "SNAPPY");
  const wedgeIn = springIn(frame, vfps, TIMING.entrance + 16, "LIQUID");

  const eyebrowSize = base * 0.026;
  const headlineSize = base * 0.058;
  const rankSize = base * 0.04;
  const nameSize = base * 0.032;
  const authorSize = base * 0.021;

  return (
    <>
      <style>{BRAND_FONT_FACE_CSS}</style>
      <AbsoluteFill
        style={{
          background: BRAND.colors.bg,
          opacity: envelope,
        }}
      >
        {/* Orange triangular wedge in the bottom-right corner. */}
        <svg
          style={{
            position: "absolute",
            right: 0,
            bottom: 0,
            width: base * 0.45,
            height: base * 0.45,
            opacity: wedgeIn * 0.85,
          }}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <polygon points="100,0 100,100 0,100" fill={ACCENT} opacity={0.18} />
          <polygon points="100,40 100,100 40,100" fill={ACCENT} opacity={0.28} />
        </svg>

        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: `${base * 0.14}px ${base * 0.07}px ${base * 0.1}px`,
            gap: base * 0.04,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: base * 0.012 }}>
            <div
              style={{
                fontFamily: BRAND.fonts.primary,
                fontWeight: 600,
                fontSize: eyebrowSize,
                color: ACCENT,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                opacity: eyebrowIn,
                transform: `translateX(${interpolate(eyebrowIn, [0, 1], [-10, 0])}px)`,
              }}
            >
              {EYEBROW}
            </div>
            <div
              style={{
                fontFamily: BRAND.fonts.marketing,
                fontWeight: 700,
                fontSize: headlineSize,
                color: BRAND.colors.text,
                letterSpacing: "-0.02em",
                lineHeight: 1.05,
                maxWidth: width * 0.7,
                opacity: titleIn,
                transform: `translateY(${interpolate(titleIn, [0, 1], [18, 0])}px)`,
              }}
            >
              {HEADLINE}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: base * 0.018,
              marginTop: base * 0.02,
            }}
          >
            {ROWS.map((row, i) => {
              const rowIn = staggeredSpring(
                frame,
                vfps,
                i,
                TIMING.entrance + 22,
                TIMING.staggerItem,
                "LIQUID",
              );
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: base * 0.022,
                    padding: `${base * 0.022}px ${base * 0.028}px`,
                    background: BRAND.colors.card,
                    border: `1px solid ${BRAND.colors.border}`,
                    borderRadius: base * 0.014,
                    opacity: rowIn,
                    transform: `translateY(${interpolate(rowIn, [0, 1], [16, 0])}px)`,
                  }}
                >
                  <div
                    style={{
                      width: base * 0.06,
                      height: base * 0.06,
                      borderRadius: base * 0.012,
                      background: BRAND.colors.orangeTint,
                      border: `1px solid ${ACCENT}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: BRAND.fonts.marketing,
                      fontWeight: 700,
                      fontSize: rankSize,
                      color: ACCENT,
                      flexShrink: 0,
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: base * 0.003 }}>
                    <div
                      style={{
                        fontFamily: BRAND.fonts.primary,
                        fontWeight: 600,
                        fontSize: nameSize,
                        color: BRAND.colors.text,
                        letterSpacing: "-0.005em",
                        lineHeight: 1.15,
                      }}
                    >
                      {row.name}
                    </div>
                    <div
                      style={{
                        fontFamily: BRAND.fonts.primary,
                        fontWeight: 400,
                        fontSize: authorSize,
                        color: BRAND.colors.textMuted,
                        letterSpacing: "0.005em",
                      }}
                    >
                      {row.author}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </AbsoluteFill>
    </>
  );
}
