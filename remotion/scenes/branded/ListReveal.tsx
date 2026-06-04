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
export const durationInFrames = 180;

// Checkmark feature list inside an Apify card.
// Highlighted-phrase headline + 4 staggered orange-check rows with optional
// descriptors. Card surface = #1d1e1f w/ #3d3f43 border.

const HEADLINE_LEAD = "Why teams pick";
const HEADLINE_HIGHLIGHT = "Apify";
const HEADLINE_TAIL = "";
const ITEMS: { label: string; descriptor?: string }[] = [
  { label: "Lead generation", descriptor: "B2B prospect lists from public web sources" },
  { label: "Competitive intelligence", descriptor: "Pricing, ads, and feature tracking" },
  { label: "AI search monitoring", descriptor: "Track how your brand appears in LLM answers" },
  { label: "Social media monitoring", descriptor: "Mentions, sentiment, and trend signals" },
];

const ACCENT = BRAND.colors.orange;

function CheckIcon({ size, progress }: { size: number; progress: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ flexShrink: 0, opacity: progress }}
    >
      <path
        d="M5 12.5 L10 17.5 L19 7"
        stroke={ACCENT}
        strokeWidth={2.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        strokeDasharray={28}
        strokeDashoffset={interpolate(progress, [0, 1], [28, 0])}
      />
    </svg>
  );
}

export default function ListReveal() {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();
  const base = Math.min(width, height);

  const envelope = inOutEnvelope(frame, vfps, durationInFrames);

  const titleIn = springIn(frame, vfps, TIMING.entrance, "SNAPPY");
  const highlightIn = springIn(frame, vfps, TIMING.entrance + 10, "LIQUID");
  const cardIn = springIn(frame, vfps, TIMING.entrance + 6, "LIQUID");

  const headlineSize = base * 0.065;
  const itemSize = base * 0.032;
  const descSize = base * 0.02;

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
            padding: `${base * 0.14}px ${base * 0.08}px ${base * 0.08}px`,
            gap: base * 0.045,
          }}
        >
          <div
            style={{
              fontFamily: BRAND.fonts.marketing,
              fontWeight: 700,
              fontSize: headlineSize,
              color: BRAND.colors.text,
              letterSpacing: "-0.025em",
              lineHeight: 1.1,
              textAlign: "center",
              maxWidth: width * 0.7,
              opacity: titleIn,
              transform: `translateY(${interpolate(titleIn, [0, 1], [20, 0])}px)`,
            }}
          >
            {HEADLINE_LEAD}{" "}
            <span
              style={{
                background: BRAND.colors.orangeTint,
                borderBottom: `${Math.max(2, base * 0.003)}px solid ${ACCENT}`,
                padding: `0 ${base * 0.012}px`,
                borderRadius: base * 0.008,
                clipPath: `inset(0 ${interpolate(highlightIn, [0, 1], [100, 0])}% 0 0)`,
              }}
            >
              {HEADLINE_HIGHLIGHT}
            </span>
            {HEADLINE_TAIL}
          </div>

          <div
            style={{
              background: BRAND.colors.card,
              border: `1px solid ${BRAND.colors.border}`,
              borderRadius: base * 0.018,
              padding: base * 0.035,
              width: "100%",
              maxWidth: width * 0.7,
              display: "flex",
              flexDirection: "column",
              gap: base * 0.022,
              opacity: cardIn,
              transform: `translateY(${interpolate(cardIn, [0, 1], [24, 0])}px)`,
            }}
          >
            {ITEMS.map((item, i) => {
              const itemIn = staggeredSpring(
                frame,
                vfps,
                i,
                TIMING.entrance + 18,
                TIMING.staggerItem,
                "GENTLE",
              );
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: base * 0.018,
                    opacity: itemIn,
                    transform: `translateX(${interpolate(itemIn, [0, 1], [-base * 0.02, 0])}px)`,
                  }}
                >
                  <div style={{ marginTop: base * 0.004 }}>
                    <CheckIcon size={base * 0.028} progress={itemIn} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: base * 0.004 }}>
                    <div
                      style={{
                        fontFamily: BRAND.fonts.primary,
                        fontWeight: 600,
                        fontSize: itemSize,
                        color: BRAND.colors.text,
                        letterSpacing: "-0.005em",
                        lineHeight: 1.2,
                      }}
                    >
                      {item.label}
                    </div>
                    {item.descriptor && (
                      <div
                        style={{
                          fontFamily: BRAND.fonts.primary,
                          fontWeight: 400,
                          fontSize: descSize,
                          color: BRAND.colors.textMuted,
                          lineHeight: 1.3,
                        }}
                      >
                        {item.descriptor}
                      </div>
                    )}
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
