import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { BRAND, BRAND_FONT_FACE_CSS } from "../../theme";
import { springIn, drawPath, TIMING, inOutEnvelope } from "../../motion";

export const fps = 30;
export const durationInFrames = 200;

// Line-chart data-viz card (the "Top 8 proxies" / "content gap analysis"
// thumbnails): eyebrow + headline over a card with animated axes, a data line
// that draws on, and orange node dots that pop after the line lands.

const EYEBROW = "Benchmark";
const HEADLINE_LEAD = "How to run a";
const HEADLINE_HIGHLIGHT = "content gap analysis";
const DATA = [22, 30, 26, 44, 38, 58, 50, 72, 88]; // y values, any scale

const ACCENT = BRAND.colors.orange;

export default function ChartReveal() {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();
  const base = Math.min(width, height);

  const envelope = inOutEnvelope(frame, vfps, durationInFrames);
  const eyebrowIn = springIn(frame, vfps, TIMING.entrance, "SNAPPY");
  const titleIn = springIn(frame, vfps, TIMING.entrance + 8, "SNAPPY");
  const cardIn = springIn(frame, vfps, TIMING.entrance + 16, "LIQUID");

  // Chart geometry in a 0..100 x 0..60 viewBox (padding inside the card svg).
  const PAD = 8;
  const vbW = 100;
  const vbH = 60;
  const maxV = Math.max(...DATA);
  const minV = Math.min(...DATA);
  const pts = DATA.map((v, i) => {
    const x = PAD + (i / (DATA.length - 1)) * (vbW - PAD * 2);
    const y = vbH - PAD - ((v - minV) / (maxV - minV || 1)) * (vbH - PAD * 2);
    return { x, y };
  });
  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  // Rough polyline length for the stroke draw-on.
  let lineLen = 0;
  for (let i = 1; i < pts.length; i++) {
    lineLen += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  const lineDraw = drawPath(frame, vfps, lineLen, { delay: TIMING.entrance + 26, preset: "LIQUID" });
  const lineProgress = springIn(frame, vfps, TIMING.entrance + 26, "LIQUID");

  const eyebrowSize = base * 0.024;
  const headSize = base * 0.05;

  return (
    <>
      <style>{BRAND_FONT_FACE_CSS}</style>
      <AbsoluteFill
        style={{
          background: BRAND.colors.bg,
          opacity: envelope,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: `${base * 0.12}px ${base * 0.09}px`,
          gap: base * 0.03,
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
            }}
          >
            {EYEBROW}
          </div>
          <div
            style={{
              fontFamily: BRAND.fonts.marketing,
              fontWeight: 600,
              fontSize: headSize,
              color: BRAND.colors.text,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              maxWidth: width * 0.7,
              opacity: titleIn,
              transform: `translateY(${interpolate(titleIn, [0, 1], [16, 0])}px)`,
            }}
          >
            {HEADLINE_LEAD}{" "}
            <span style={{ background: BRAND.colors.orangeTint, borderBottom: `2px solid ${ACCENT}`, padding: "0 8px", borderRadius: 6 }}>
              {HEADLINE_HIGHLIGHT}
            </span>
          </div>
        </div>

        {/* Chart card */}
        <div
          style={{
            background: BRAND.colors.card,
            border: `1px solid ${BRAND.colors.border}`,
            borderRadius: base * 0.018,
            padding: base * 0.03,
            opacity: cardIn,
            transform: `translateY(${interpolate(cardIn, [0, 1], [24, 0])}px)`,
          }}
        >
          <svg viewBox={`0 0 ${vbW} ${vbH}`} width="100%" height={base * 0.34} style={{ display: "block" }}>
            {/* Axes */}
            <line x1={PAD} y1={vbH - PAD} x2={vbW - PAD} y2={vbH - PAD} stroke={BRAND.colors.border} strokeWidth={0.4} />
            <line x1={PAD} y1={PAD} x2={PAD} y2={vbH - PAD} stroke={BRAND.colors.border} strokeWidth={0.4} />

            {/* Faint gridlines */}
            {[0.25, 0.5, 0.75].map((g) => (
              <line
                key={g}
                x1={PAD}
                y1={PAD + g * (vbH - PAD * 2)}
                x2={vbW - PAD}
                y2={PAD + g * (vbH - PAD * 2)}
                stroke={BRAND.colors.border}
                strokeOpacity={0.4}
                strokeWidth={0.25}
              />
            ))}

            {/* Data line */}
            <path d={linePath} fill="none" stroke={ACCENT} strokeWidth={0.9} strokeLinecap="round" strokeLinejoin="round" {...lineDraw} />

            {/* Node dots — appear as the line passes each one */}
            {pts.map((p, i) => {
              const reveal = lineProgress * (DATA.length - 1) - i;
              const dotOpacity = interpolate(reveal, [0, 0.5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              return <circle key={i} cx={p.x} cy={p.y} r={1.1} fill={ACCENT} opacity={dotOpacity} />;
            })}
          </svg>
        </div>
      </AbsoluteFill>
    </>
  );
}
