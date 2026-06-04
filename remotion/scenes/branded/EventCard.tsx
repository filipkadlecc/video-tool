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
import { springIn, ambientDrift, TIMING, inOutEnvelope } from "../../motion";

export const fps = 30;
export const durationInFrames = 165;

// Event announcement card — Apify x sponsor evening, hackathon, AMA, etc.
// Event date/venue eyebrow + big event title + sponsor line.
// Match the "OpenClaw agentic night" Figma frame.

const EYEBROW = "May 11 · San Francisco";
const TITLE_LEAD = "OpenClaw";
const TITLE_HIGHLIGHT = "agentic night";
const SPONSOR_LINE = "Hosted with";
const SPONSOR_LOGO = "assets/logos/Claude_Logo.svg";

const ACCENT = BRAND.colors.orange;

export default function EventCard() {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();
  const base = Math.min(width, height);

  const envelope = inOutEnvelope(frame, vfps, durationInFrames);

  const eyebrowIn = springIn(frame, vfps, TIMING.entrance, "SNAPPY");
  const titleIn = springIn(frame, vfps, TIMING.entrance + 8, "SNAPPY");
  const highlightIn = springIn(frame, vfps, TIMING.entrance + 18, "LIQUID");
  const sponsorIn = springIn(frame, vfps, TIMING.entrance + 28, "GENTLE");

  const drift = ambientDrift(frame, 2, 100, "event");

  const eyebrowSize = base * 0.026;
  const titleSize = base * 0.1;
  const sponsorLabelSize = base * 0.022;
  const sponsorLogoH = base * 0.05;

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
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            padding: `${base * 0.14}px ${base * 0.07}px ${base * 0.1}px`,
            gap: base * 0.035,
            transform: `translateY(${drift}px)`,
          }}
        >
          <div
            style={{
              fontFamily: BRAND.fonts.primary,
              fontWeight: 600,
              fontSize: eyebrowSize,
              color: BRAND.colors.textMuted,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              opacity: eyebrowIn,
              transform: `translateY(${interpolate(eyebrowIn, [0, 1], [10, 0])}px)`,
            }}
          >
            {EYEBROW}
          </div>

          <div
            style={{
              fontFamily: BRAND.fonts.marketing,
              fontWeight: 800,
              fontSize: titleSize,
              color: BRAND.colors.text,
              letterSpacing: "-0.03em",
              lineHeight: 1.02,
              textAlign: "center",
              maxWidth: width * 0.8,
              opacity: titleIn,
              transform: `translateY(${interpolate(titleIn, [0, 1], [22, 0])}px)`,
            }}
          >
            {TITLE_LEAD}
            <br />
            <span
              style={{
                background: BRAND.colors.orangeTint,
                borderBottom: `${Math.max(3, base * 0.004)}px solid ${ACCENT}`,
                padding: `0 ${base * 0.014}px`,
                borderRadius: base * 0.01,
                clipPath: `inset(0 ${interpolate(highlightIn, [0, 1], [100, 0])}% 0 0)`,
              }}
            >
              {TITLE_HIGHLIGHT}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: base * 0.018,
              padding: `${base * 0.016}px ${base * 0.028}px`,
              background: BRAND.colors.card,
              border: `1px solid ${BRAND.colors.border}`,
              borderRadius: 999,
              opacity: sponsorIn,
              transform: `translateY(${interpolate(sponsorIn, [0, 1], [14, 0])}px)`,
              marginTop: base * 0.02,
            }}
          >
            <span
              style={{
                fontFamily: BRAND.fonts.primary,
                fontWeight: 500,
                fontSize: sponsorLabelSize,
                color: BRAND.colors.textMuted,
                letterSpacing: "0.005em",
              }}
            >
              {SPONSOR_LINE}
            </span>
            <Img
              src={staticFile(SPONSOR_LOGO)}
              style={{ height: sponsorLogoH, width: "auto", objectFit: "contain" }}
            />
          </div>
        </div>
      </AbsoluteFill>
    </>
  );
}
