import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { BRAND, BRAND_FONT_FACE_CSS } from "../../theme";
import { springIn, staggerChild, TIMING, inOutEnvelope } from "../../motion";

export const fps = 30;
export const durationInFrames = 180;

// Faithful Apify Store "Actor card" (the Rising-Stars board card): rounded
// icon tile + title + monospace author/actor handle + description, with an
// author chip footer. Card lifts in (LIQUID); inner rows stagger.

const ACTOR_TITLE = "Dentist & Doctor Lead Scraper";
const ACTOR_HANDLE = "samstorm/dentist-lead-scraper";
const ACTOR_DESC =
  "Scrape dentist, doctor & clinic contacts from Google Maps with verified emails, phones & socials.";
const AUTHOR_NAME = "Sam Kleespies";
const AUTHOR_INITIAL = "S";
// Icon tile glyph — an emoji or a 1–2 char monogram.
const ICON_GLYPH = "🦷";

const ACCENT = BRAND.colors.orange;
const MONO = "ui-monospace, 'SF Mono', Menlo, monospace";

export default function ActorStoreCard() {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();
  const base = Math.min(width, height);

  const envelope = inOutEnvelope(frame, vfps, durationInFrames);
  const cardIn = springIn(frame, vfps, TIMING.entrance, "LIQUID");

  const titleSize = base * 0.034;
  const handleSize = base * 0.02;
  const descSize = base * 0.024;
  const authorSize = base * 0.024;

  return (
    <>
      <style>{BRAND_FONT_FACE_CSS}</style>
      <AbsoluteFill
        style={{
          background: BRAND.colors.bg,
          opacity: envelope,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: base * 0.1,
        }}
      >
        <div
          style={{
            width: width * 0.74,
            maxWidth: base * 1.05,
            background: BRAND.colors.card,
            border: `1px solid ${BRAND.colors.border}`,
            borderRadius: base * 0.022,
            overflow: "hidden",
            opacity: cardIn,
            transform: `translateY(${interpolate(cardIn, [0, 1], [28, 0])}px) scale(${interpolate(
              cardIn,
              [0, 1],
              [0.97, 1],
            )})`,
          }}
        >
          {/* Body */}
          <div style={{ padding: base * 0.034, display: "flex", flexDirection: "column", gap: base * 0.022 }}>
            <div style={{ display: "flex", gap: base * 0.028, alignItems: "flex-start", ...staggerChild(0, frame, vfps, { baseDelay: TIMING.entrance + 6 }) }}>
              {/* Icon tile */}
              <div
                style={{
                  width: base * 0.085,
                  height: base * 0.085,
                  borderRadius: base * 0.018,
                  background: BRAND.colors.orangeTint,
                  border: `1px solid ${ACCENT}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: base * 0.044,
                  flexShrink: 0,
                }}
              >
                {ICON_GLYPH}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: base * 0.008, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: BRAND.fonts.marketing,
                    fontWeight: 600,
                    fontSize: titleSize,
                    color: BRAND.colors.text,
                    letterSpacing: "-0.01em",
                    lineHeight: 1.12,
                  }}
                >
                  {ACTOR_TITLE}
                </div>
                <div
                  style={{
                    fontFamily: MONO,
                    fontSize: handleSize,
                    color: BRAND.colors.textSubtle,
                    letterSpacing: "0.01em",
                  }}
                >
                  {ACTOR_HANDLE}
                </div>
              </div>
            </div>

            <div
              style={{
                fontFamily: BRAND.fonts.primary,
                fontSize: descSize,
                color: BRAND.colors.textMuted,
                lineHeight: 1.4,
                ...staggerChild(1, frame, vfps, { baseDelay: TIMING.entrance + 6 }),
              }}
            >
              {ACTOR_DESC}
            </div>
          </div>

          {/* Author footer */}
          <div
            style={{
              borderTop: `1px solid ${BRAND.colors.border}`,
              padding: `${base * 0.022}px ${base * 0.034}px`,
              display: "flex",
              alignItems: "center",
              gap: base * 0.018,
              ...staggerChild(2, frame, vfps, { baseDelay: TIMING.entrance + 6 }),
            }}
          >
            <div
              style={{
                width: base * 0.04,
                height: base * 0.04,
                borderRadius: "50%",
                background: BRAND.colors.orangeTint,
                border: `1px solid ${ACCENT}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: BRAND.fonts.marketing,
                fontWeight: 600,
                fontSize: base * 0.02,
                color: ACCENT,
                flexShrink: 0,
              }}
            >
              {AUTHOR_INITIAL}
            </div>
            <div
              style={{
                fontFamily: BRAND.fonts.primary,
                fontWeight: 500,
                fontSize: authorSize,
                color: BRAND.colors.text,
              }}
            >
              {AUTHOR_NAME}
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </>
  );
}
