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
export const durationInFrames = 165;

// "Works with" partner-logo strip. Headline + horizontal row of partner logos
// in muted cards. Use this to show ecosystem integrations.

const EYEBROW = "Works with";
const HEADLINE = "Your favorite tools for AI";
const LOGOS: { src: string; label: string }[] = [
  { src: "assets/logos/Claude_Logo.svg", label: "Claude" },
  { src: "assets/logos/Codex_Logo.png", label: "Codex" },
  { src: "assets/logos/Cusror_Logo.png", label: "Cursor" },
  { src: "assets/logos/Antigravity_Logo.png", label: "Antigravity" },
];

const ACCENT = BRAND.colors.orange;

export default function LogoGridStrip() {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();
  const base = Math.min(width, height);

  const envelope = inOutEnvelope(frame, vfps, durationInFrames);

  const eyebrowIn = springIn(frame, vfps, TIMING.entrance, "SNAPPY");
  const titleIn = springIn(frame, vfps, TIMING.entrance + 8, "SNAPPY");

  const eyebrowSize = base * 0.024;
  const headlineSize = base * 0.062;
  const logoH = base * 0.05;
  const labelSize = base * 0.022;

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
            padding: `${base * 0.14}px ${base * 0.06}px ${base * 0.1}px`,
            gap: base * 0.05,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: base * 0.012 }}>
            <div
              style={{
                fontFamily: BRAND.fonts.primary,
                fontWeight: 600,
                fontSize: eyebrowSize,
                color: ACCENT,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                opacity: eyebrowIn,
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
                textAlign: "center",
                maxWidth: width * 0.7,
                opacity: titleIn,
                transform: `translateY(${interpolate(titleIn, [0, 1], [16, 0])}px)`,
              }}
            >
              {HEADLINE}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${LOGOS.length}, 1fr)`,
              gap: base * 0.018,
              width: "100%",
              maxWidth: width * 0.78,
            }}
          >
            {LOGOS.map((logo, i) => {
              const cellIn = staggeredSpring(
                frame,
                vfps,
                i,
                TIMING.entrance + 16,
                TIMING.staggerItem,
                "LIQUID",
              );
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: base * 0.012,
                    padding: `${base * 0.028}px ${base * 0.018}px`,
                    background: BRAND.colors.card,
                    border: `1px solid ${BRAND.colors.border}`,
                    borderRadius: base * 0.014,
                    opacity: cellIn,
                    transform: `translateY(${interpolate(cellIn, [0, 1], [16, 0])}px)`,
                  }}
                >
                  <div
                    style={{
                      height: logoH,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Img
                      src={staticFile(logo.src)}
                      style={{
                        maxHeight: logoH,
                        maxWidth: "100%",
                        width: "auto",
                        height: "auto",
                        objectFit: "contain",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontFamily: BRAND.fonts.primary,
                      fontWeight: 500,
                      fontSize: labelSize,
                      color: BRAND.colors.textMuted,
                      letterSpacing: "0.005em",
                    }}
                  >
                    {logo.label}
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
