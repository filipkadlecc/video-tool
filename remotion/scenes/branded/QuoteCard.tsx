import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { BRAND, BRAND_FONT_FACE_CSS } from "../../theme";
import { springIn, TIMING, inOutEnvelope, ambientDrift } from "../../motion";

export const fps = 30;
export const durationInFrames = 165;

// Apify-style testimonial pulled from the PLGTM "From 10 emails per day…" card.
// Card with a left-aligned orange quotemark + quote body + attribution rule +
// author line.

const QUOTE = "From 10 emails per day to a database of 400 in just one week.";
const AUTHOR = "Marketing Lead";
const COMPANY = "CMS at Stoneup House";

const ACCENT = BRAND.colors.orange;

export default function QuoteCard() {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();
  const base = Math.min(width, height);

  const envelope = inOutEnvelope(frame, vfps, durationInFrames);

  const cardIn = springIn(frame, vfps, TIMING.entrance, "LIQUID");
  const markIn = springIn(frame, vfps, TIMING.entrance + 8, "ELASTIC");
  const quoteIn = springIn(frame, vfps, TIMING.entrance + 14, "LIQUID");
  const authorIn = springIn(frame, vfps, TIMING.entrance + 28, "GENTLE");

  const driftY = ambientDrift(frame, 1.5, 110, "quote");

  const markSize = base * 0.16;
  const quoteSize = base * 0.05;
  const authorSize = base * 0.024;

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
            alignItems: "center",
            justifyContent: "center",
            padding: `${base * 0.14}px ${base * 0.08}px ${base * 0.08}px`,
          }}
        >
          <div
            style={{
              background: BRAND.colors.card,
              border: `1px solid ${BRAND.colors.border}`,
              borderRadius: base * 0.02,
              padding: `${base * 0.05}px ${base * 0.055}px`,
              width: "100%",
              maxWidth: width * 0.72,
              display: "flex",
              flexDirection: "column",
              gap: base * 0.022,
              opacity: cardIn,
              transform: `translateY(${interpolate(cardIn, [0, 1], [24, 0])}px) translateY(${driftY}px)`,
            }}
          >
            <div
              style={{
                fontFamily: BRAND.fonts.marketing,
                fontWeight: 600,
                fontSize: markSize,
                color: ACCENT,
                lineHeight: 0.6,
                opacity: markIn,
                transform: `scale(${interpolate(markIn, [0, 1], [0.6, 1])})`,
                transformOrigin: "left top",
                marginBottom: -base * 0.04,
              }}
            >
              &ldquo;
            </div>
            <div
              style={{
                fontFamily: BRAND.fonts.marketing,
                fontWeight: 500,
                fontSize: quoteSize,
                color: BRAND.colors.text,
                lineHeight: 1.22,
                letterSpacing: "-0.01em",
                opacity: quoteIn,
                transform: `translateY(${interpolate(quoteIn, [0, 1], [16, 0])}px)`,
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
                transform: `translateY(${interpolate(authorIn, [0, 1], [10, 0])}px)`,
                marginTop: base * 0.018,
              }}
            >
              <div
                style={{
                  width: base * 0.03,
                  height: 2,
                  background: ACCENT,
                }}
              />
              <div
                style={{
                  fontFamily: BRAND.fonts.primary,
                  fontWeight: 600,
                  fontSize: authorSize,
                  color: BRAND.colors.text,
                  letterSpacing: "0.01em",
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
        </div>
      </AbsoluteFill>
    </>
  );
}
