import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { BRAND, BRAND_FONT_FACE_CSS } from "../../theme";
import { springIn, staggeredSpring, TIMING } from "../../motion";

export const fps = 30;
export const durationInFrames = 150;

const TITLE = "Why Apify?";
const ITEMS = [
  "5,000+ ready-made Actors",
  "Run on your hardware or ours",
  "Stealth proxies + browsers",
  "Pay-per-result pricing",
];
const ACCENT = BRAND.colors.pink;

export default function ListReveal() {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();
  const base = Math.min(width, height);

  const titleIn = springIn(frame, vfps, 0, "SNAPPY");

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
            gap: base * 0.04,
            width: "100%",
            maxWidth: width * 0.6,
          }}
        >
          <div
            style={{
              opacity: titleIn,
              transform: `translateY(${interpolate(titleIn, [0, 1], [20, 0])}px)`,
              fontFamily: BRAND.fonts.marketing,
              fontWeight: 700,
              fontSize: base * 0.075,
              color: BRAND.colors.text,
              letterSpacing: "-0.025em",
              lineHeight: 1,
              marginBottom: base * 0.02,
            }}
          >
            {TITLE}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: base * 0.025,
            }}
          >
            {ITEMS.map((item, i) => {
              // Each bullet uses ELASTIC so dots overshoot slightly — feels
              // more alive than uniformly OVERDAMPED springs.
              const itemIn = staggeredSpring(
                frame,
                vfps,
                i,
                12,
                TIMING.staggerItem,
                "ELASTIC"
              );
              const x = interpolate(itemIn, [0, 1], [-base * 0.04, 0]);
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: base * 0.02,
                    opacity: itemIn,
                    transform: `translateX(${x}px)`,
                  }}
                >
                  <div
                    style={{
                      width: base * 0.018,
                      height: base * 0.018,
                      borderRadius: "50%",
                      background: ACCENT,
                      flexShrink: 0,
                      boxShadow: `0 0 ${base * 0.018}px ${ACCENT}`,
                    }}
                  />
                  <div
                    style={{
                      fontFamily: BRAND.fonts.primary,
                      fontWeight: 500,
                      fontSize: base * 0.038,
                      color: BRAND.colors.text,
                      letterSpacing: "-0.005em",
                      lineHeight: 1.2,
                    }}
                  >
                    {item}
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
