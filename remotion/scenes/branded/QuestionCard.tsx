import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { BRAND, BRAND_FONT_FACE_CSS } from "../../theme";
import { springIn, TIMING, inOutEnvelope } from "../../motion";

export const fps = 25;
export const durationInFrames = 100;

// Interview question-card overlay — sits on top of interview footage to give
// context for an answer whose question was asked off-camera. Same grammar as
// CalloutBanner: card surface drops in from the top, one orange-highlighted
// phrase wipes L→R. Transparent background; render with alpha (ProRes 4444)
// and place on a track above the graded footage.
//
// Props (via --props): { eyebrow?, lead, highlight }
//   lead      — first part of the question, plain text color
//   highlight — final phrase, gets the orangeTint + underline wipe

export interface QuestionCardProps {
  eyebrow?: string;
  lead?: string;
  highlight?: string;
}

const ACCENT = BRAND.colors.orange;

export default function QuestionCard({
  eyebrow = "THE QUESTION",
  lead = "What's one AI trend",
  highlight = "you hope disappears?",
}: QuestionCardProps) {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height, durationInFrames: dur } = useVideoConfig();
  const base = Math.min(width, height);

  const envelope = inOutEnvelope(frame, vfps, dur);

  const cardIn = springIn(frame, vfps, 0, "SNAPPY");
  const eyebrowIn = springIn(frame, vfps, TIMING.entrance + 2, "GENTLE");
  const titleIn = springIn(frame, vfps, TIMING.entrance + 6, "SNAPPY");
  const highlightIn = springIn(frame, vfps, TIMING.entrance + 16, "LIQUID");

  const slideY = interpolate(cardIn, [0, 1], [-base * 0.06, 0]);

  const questionSize = base * 0.05;
  const eyebrowSize = base * 0.018;

  return (
    <>
      <style>{BRAND_FONT_FACE_CSS}</style>
      <AbsoluteFill style={{ background: "transparent", opacity: envelope }}>
        <div
          style={{
            position: "absolute",
            top: base * 0.06,
            left: width * 0.06,
            right: width * 0.06,
            display: "flex",
            flexDirection: "column",
            gap: base * 0.016,
            padding: `${base * 0.032}px ${base * 0.04}px`,
            background: BRAND.colors.card,
            border: `1px solid ${BRAND.colors.border}`,
            borderRadius: base * 0.016,
            opacity: cardIn,
            transform: `translateY(${slideY}px)`,
          }}
        >
          <div
            style={{
              fontFamily: BRAND.fonts.marketing,
              fontWeight: 400,
              fontSize: eyebrowSize,
              color: BRAND.colors.textSubtle,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              opacity: eyebrowIn,
              transform: `translateY(${interpolate(eyebrowIn, [0, 1], [6, 0])}px)`,
            }}
          >
            {eyebrow}
          </div>

          <div
            style={{
              fontFamily: BRAND.fonts.marketing,
              fontWeight: 600,
              fontSize: questionSize,
              color: BRAND.colors.text,
              letterSpacing: "-0.02em",
              lineHeight: 1.12,
              opacity: titleIn,
              transform: `translateX(${interpolate(titleIn, [0, 1], [-12, 0])}px)`,
            }}
          >
            {lead}{" "}
            <span
              style={{
                // inline-block + nowrap: a wrapped inline gets fragmented and
                // Blink clips fragments outside the first line box — keep the
                // highlight a single box so the clipPath wipe stays correct.
                display: "inline-block",
                whiteSpace: "nowrap",
                background: BRAND.colors.orangeTint,
                borderBottom: `${Math.max(2, base * 0.003)}px solid ${ACCENT}`,
                padding: `0 ${base * 0.01}px`,
                borderRadius: base * 0.006,
                clipPath: `inset(0 ${interpolate(highlightIn, [0, 1], [100, 0])}% 0 0)`,
              }}
            >
              {highlight}
            </span>
          </div>
        </div>
      </AbsoluteFill>
    </>
  );
}
