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
import { springIn, staggeredSpring, TIMING, inOutEnvelope } from "../../motion";

export const fps = 30;
export const durationInFrames = 195;

// One-Pager 2x2 quadrant card grid.
// Headline + 4 feature cards (rank letter + title + summary) + bottom row of
// partner logos. Match the Figma "One Pager" archetype.

const HEADLINE = "One Apify, four superpowers";
const CARDS: { rank: string; title: string; body: string }[] = [
  { rank: "A", title: "Scrape any site", body: "5,000+ pre-built Actors plus a low-code SDK for the rest." },
  { rank: "B", title: "Automate browsers", body: "Headless Chrome, stealth proxies, CAPTCHA bypass — handled." },
  { rank: "C", title: "Schedule + monitor", body: "Cron triggers, alerts, retries. Your team sleeps; the bot runs." },
  { rank: "D", title: "Ship to anywhere", body: "Webhooks, S3, Snowflake, Postgres. Pipe results in seconds." },
];
const PARTNER_LOGOS = [
  "assets/logos/Claude_Logo.svg",
  "assets/logos/Codex_Logo.png",
  "assets/logos/Cusror_Logo.png",
  "assets/logos/Antigravity_Logo.png",
];

const ACCENT = BRAND.colors.orange;

export default function FourQuadrant() {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();
  const base = Math.min(width, height);

  const envelope = inOutEnvelope(frame, vfps, durationInFrames);

  const titleIn = springIn(frame, vfps, TIMING.entrance + 4, "SNAPPY");
  const partnersIn = springIn(frame, vfps, TIMING.entrance + 42, "GENTLE");

  const headlineSize = base * 0.05;
  const rankSize = base * 0.038;
  const cardTitleSize = base * 0.03;
  const cardBodySize = base * 0.02;
  const partnerH = base * 0.035;

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
            padding: `${base * 0.13}px ${base * 0.06}px ${base * 0.08}px`,
            gap: base * 0.035,
          }}
        >
          <div
            style={{
              fontFamily: BRAND.fonts.marketing,
              fontWeight: 700,
              fontSize: headlineSize,
              color: BRAND.colors.text,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
              textAlign: "center",
              maxWidth: width * 0.78,
              opacity: titleIn,
              transform: `translateY(${interpolate(titleIn, [0, 1], [18, 0])}px)`,
            }}
          >
            {HEADLINE}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: base * 0.02,
              width: "100%",
              maxWidth: width * 0.78,
            }}
          >
            {CARDS.map((card, i) => {
              const cardIn = staggeredSpring(
                frame,
                vfps,
                i,
                TIMING.entrance + 14,
                TIMING.staggerItem,
                "LIQUID",
              );
              return (
                <div
                  key={i}
                  style={{
                    background: BRAND.colors.card,
                    border: `1px solid ${BRAND.colors.border}`,
                    borderRadius: base * 0.016,
                    padding: base * 0.028,
                    display: "flex",
                    flexDirection: "column",
                    gap: base * 0.012,
                    opacity: cardIn,
                    transform: `translateY(${interpolate(cardIn, [0, 1], [20, 0])}px)`,
                  }}
                >
                  <div
                    style={{
                      width: base * 0.058,
                      height: base * 0.058,
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
                    }}
                  >
                    {card.rank}
                  </div>
                  <div
                    style={{
                      fontFamily: BRAND.fonts.primary,
                      fontWeight: 600,
                      fontSize: cardTitleSize,
                      color: BRAND.colors.text,
                      letterSpacing: "-0.005em",
                      lineHeight: 1.15,
                    }}
                  >
                    {card.title}
                  </div>
                  <div
                    style={{
                      fontFamily: BRAND.fonts.primary,
                      fontWeight: 400,
                      fontSize: cardBodySize,
                      color: BRAND.colors.textMuted,
                      lineHeight: 1.35,
                    }}
                  >
                    {card.body}
                  </div>
                </div>
              );
            })}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: base * 0.04,
              opacity: partnersIn,
              transform: `translateY(${interpolate(partnersIn, [0, 1], [12, 0])}px)`,
              marginTop: base * 0.015,
            }}
          >
            {PARTNER_LOGOS.map((src, i) => (
              <Img
                key={i}
                src={staticFile(src)}
                style={{
                  height: partnerH,
                  width: "auto",
                  opacity: 0.75,
                  objectFit: "contain",
                }}
              />
            ))}
          </div>
        </div>
      </AbsoluteFill>
    </>
  );
}
