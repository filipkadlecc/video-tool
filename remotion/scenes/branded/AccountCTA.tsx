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
import { springIn, ambientDrift, inOutEnvelope, TIMING } from "../../motion";

export const fps = 30;
export const durationInFrames = 240; // 8s hold — comfortable read; editable

// "Create a free Apify account" CTA lower-third — a corner card that composites
// on top of footage (transparent bg). Headline on top; a bottom row with the
// Apify symbol + url on the left and a filled orange "Start free →" button on
// the right. Slides in from the anchored edge, holds, slides + fades out. No
// fade-to-black: the frame never opens/closes on black, only the card moves.

// === EDIT THESE ===
const HEADLINE = "Create a free Apify account";
const URL_TEXT = "apify.com";
const CTA_LABEL = "Start free";
const ALIGN: "left" | "right" = "left";

const ACCENT = BRAND.colors.orange;

export default function AccountCTA() {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();
  const base = Math.min(width, height);

  // Whole-card envelope (fade in → hold → fade out over transparent footage).
  const opacity = inOutEnvelope(frame, vfps, durationInFrames, {
    inPreset: "LIQUID",
    exitFrames: 18,
  });

  // Card slides in from its anchored horizontal edge and up from slightly below,
  // then reverses on the way out — mirrors SymbolBug's in/out slide.
  const cardIn = springIn(frame, vfps, 0, "LIQUID");
  const dir = ALIGN === "left" ? -1 : 1;
  const outStart = durationInFrames - 18;

  const inX = interpolate(cardIn, [0, 1], [dir * base * 0.05, 0]);
  const outX = interpolate(frame, [outStart, durationInFrames], [0, dir * base * 0.05], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const inY = interpolate(cardIn, [0, 1], [base * 0.03, 0]);
  const outY = interpolate(frame, [outStart, durationInFrames], [0, base * 0.03], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cardX = inX + outX;
  const cardY = inY + outY;

  // Staggered inner reveals — restrained, no bounce on the headline.
  const headlineIn = springIn(frame, vfps, TIMING.entrance, "SNAPPY");
  const bugIn = springIn(frame, vfps, TIMING.entrance + 10, "GENTLE");
  const pillIn = springIn(frame, vfps, TIMING.entrance + 16, "LIQUID");

  // Subtle life on the button + a small nudge on the arrow (never freezes).
  const breathe = 1 + ambientDrift(frame, 0.008, 100, "cta");
  const arrowX = ambientDrift(frame, base * 0.004, 45, "arrow");

  const anchorStyle: React.CSSProperties =
    ALIGN === "left"
      ? { left: base * 0.046, bottom: base * 0.06 }
      : { right: base * 0.046, bottom: base * 0.06 };

  return (
    <>
      <style>{BRAND_FONT_FACE_CSS}</style>
      <AbsoluteFill style={{ background: "transparent", fontFamily: BRAND.fonts.primary }}>
        <div
          style={{
            position: "absolute",
            ...anchorStyle,
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            gap: base * 0.022,
            padding: `${base * 0.028}px ${base * 0.034}px`,
            background: BRAND.colors.card,
            border: `1px solid ${BRAND.colors.border}`,
            borderRadius: base * 0.012,
            boxShadow: `0 ${base * 0.006}px ${base * 0.028}px rgba(0,0,0,0.55), 0 ${base * 0.002}px ${base * 0.006}px rgba(0,0,0,0.4)`,
            opacity,
            transform: `translate(${cardX}px, ${cardY}px)`,
            transformOrigin: `${ALIGN} bottom`,
          }}
        >
          {/* Headline */}
          <div
            style={{
              fontFamily: BRAND.fonts.marketing,
              fontWeight: 600,
              fontSize: base * 0.032,
              color: BRAND.colors.text,
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
              maxWidth: base * 0.6,
              opacity: headlineIn,
              transform: `translateY(${interpolate(headlineIn, [0, 1], [base * 0.012, 0])}px)`,
            }}
          >
            {HEADLINE}
          </div>

          {/* Bottom row: brand bug (left) + filled orange CTA (right) */}
          <div
            style={{
              display: "flex",
              width: "100%",
              alignItems: "center",
              justifyContent: "space-between",
              gap: base * 0.05,
            }}
          >
            {/* Brand bug: Apify symbol + divider + url */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: base * 0.012,
                opacity: bugIn,
                transform: `translateY(${interpolate(bugIn, [0, 1], [base * 0.008, 0])}px)`,
              }}
            >
              <Img
                src={staticFile("assets/apify/Apify symbol colors.svg")}
                style={{ width: base * 0.03, height: "auto", display: "block" }}
              />
              <div
                style={{ width: 1, height: base * 0.03, background: BRAND.colors.border }}
              />
              <div
                style={{
                  fontFamily: BRAND.fonts.primary,
                  fontWeight: 600,
                  fontSize: base * 0.02,
                  color: BRAND.colors.textMuted,
                  letterSpacing: "0.02em",
                  whiteSpace: "nowrap",
                }}
              >
                {URL_TEXT}
              </div>
            </div>

            {/* Filled orange CTA pill — dark label on orange for high contrast */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: base * 0.01,
                background: ACCENT,
                borderRadius: 999,
                padding: `${base * 0.014}px ${base * 0.026}px`,
                whiteSpace: "nowrap",
                opacity: pillIn,
                transform: `translateY(${interpolate(pillIn, [0, 1], [base * 0.01, 0])}px) scale(${breathe})`,
              }}
            >
              <span
                style={{
                  fontFamily: BRAND.fonts.primary,
                  fontWeight: 600,
                  fontSize: base * 0.022,
                  color: BRAND.colors.bg,
                  letterSpacing: "-0.005em",
                }}
              >
                {CTA_LABEL}
              </span>
              <span
                style={{
                  fontSize: base * 0.022,
                  fontWeight: 600,
                  color: BRAND.colors.bg,
                  display: "inline-block",
                  transform: `translateX(${arrowX}px)`,
                }}
              >
                →
              </span>
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </>
  );
}
