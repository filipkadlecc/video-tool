import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { BRAND, BRAND_FONT_FACE_CSS } from "../../theme";
import { springIn, TIMING, inOutEnvelope } from "../../motion";

export const fps = 30;
export const durationInFrames = 180;

// Before/After comparison — two stacked cards labeled "Before" (muted) and
// "After" (orange). Each card shows a mini list of placeholder rows so it
// reads as a data view, like the "Scrape and verify emails" Figma frame.

const HEADLINE_LEAD = "Scrape and verify";
const HEADLINE_HIGHLIGHT = "in one run";
const BEFORE_LABEL = "Before";
const BEFORE_ROWS: string[] = [
  "raw@email.io",
  "support@no-mx.example",
  "ceo@startup.io",
  "info@unknown.dev",
];
const AFTER_LABEL = "After";
const AFTER_ROWS: string[] = [
  "✓ raw@email.io · MX ok",
  "✗ support@no-mx.example · invalid",
  "✓ ceo@startup.io · MX ok",
  "✓ info@unknown.dev · catch-all",
];

const ACCENT = BRAND.colors.orange;

interface ComparisonCardProps {
  state: "before" | "after";
  label: string;
  rows: string[];
  progress: number;
  base: number;
}

function ComparisonCard({ state, label, rows, progress, base }: ComparisonCardProps) {
  const isAfter = state === "after";
  const labelColor = isAfter ? ACCENT : BRAND.colors.textSubtle;
  const labelBg = isAfter ? BRAND.colors.orangeTint : "transparent";
  const labelBorder = isAfter ? `1px solid ${ACCENT}` : `1px solid ${BRAND.colors.border}`;

  return (
    <div
      style={{
        background: BRAND.colors.card,
        border: `1px solid ${BRAND.colors.border}`,
        borderRadius: base * 0.016,
        padding: base * 0.028,
        display: "flex",
        flexDirection: "column",
        gap: base * 0.018,
        opacity: progress,
        transform: `translateX(${interpolate(progress, [0, 1], [isAfter ? -16 : 16, 0])}px)`,
      }}
    >
      <div
        style={{
          alignSelf: "flex-start",
          fontFamily: BRAND.fonts.primary,
          fontWeight: 600,
          fontSize: base * 0.022,
          color: labelColor,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          background: labelBg,
          border: labelBorder,
          padding: `${base * 0.004}px ${base * 0.014}px`,
          borderRadius: base * 0.006,
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: base * 0.008 }}>
        {rows.map((row, i) => (
          <div
            key={i}
            style={{
              fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
              fontSize: base * 0.022,
              color: isAfter ? BRAND.colors.text : BRAND.colors.textMuted,
              lineHeight: 1.4,
              letterSpacing: "-0.005em",
            }}
          >
            {row}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BeforeAfter() {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();
  const base = Math.min(width, height);

  const envelope = inOutEnvelope(frame, vfps, durationInFrames);

  const titleIn = springIn(frame, vfps, TIMING.entrance, "SNAPPY");
  const highlightIn = springIn(frame, vfps, TIMING.entrance + 10, "LIQUID");
  const beforeIn = springIn(frame, vfps, TIMING.entrance + 18, "LIQUID");
  const afterIn = springIn(frame, vfps, TIMING.entrance + 30, "LIQUID");

  const headlineSize = base * 0.058;

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
            padding: `${base * 0.14}px ${base * 0.07}px ${base * 0.08}px`,
            gap: base * 0.04,
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
              opacity: titleIn,
              transform: `translateY(${interpolate(titleIn, [0, 1], [18, 0])}px)`,
              maxWidth: width * 0.7,
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
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: base * 0.022 }}>
            <ComparisonCard
              state="before"
              label={BEFORE_LABEL}
              rows={BEFORE_ROWS}
              progress={beforeIn}
              base={base}
            />
            <ComparisonCard
              state="after"
              label={AFTER_LABEL}
              rows={AFTER_ROWS}
              progress={afterIn}
              base={base}
            />
          </div>
        </div>
      </AbsoluteFill>
    </>
  );
}
