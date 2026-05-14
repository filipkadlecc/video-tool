import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { BRAND, BRAND_FONT_FACE_CSS } from "../../theme";
import { springIn, staggeredSpring } from "../../motion";

export const fps = 30;
export const durationInFrames = 150;

const FILENAME = "main.ts";
const LINES = [
  { tokens: [["import", "kw"], [" { Actor } ", "txt"], ["from", "kw"], [" ", "txt"], ['"apify"', "str"], [";", "txt"]] },
  { tokens: [] },
  { tokens: [["await", "kw"], [" Actor.init();", "txt"]] },
  { tokens: [] },
  { tokens: [["const", "kw"], [" input = ", "txt"], ["await", "kw"], [" Actor.getInput", "fn"], ["();", "txt"]] },
  { tokens: [["console", "fn"], [".", "txt"], ["log", "fn"], ["(", "txt"], ['"Hello, "', "str"], [", input.name);", "txt"]] },
  { tokens: [] },
  { tokens: [["await", "kw"], [" Actor.exit();", "txt"]] },
];

const TOKEN_COLOR: Record<string, string> = {
  kw: BRAND.colors.pink,
  str: BRAND.colors.green,
  fn: "#7DD3FC",
  txt: BRAND.colors.text,
};

const MONO = "ui-monospace, 'SF Mono', Menlo, Monaco, Consolas, monospace";

export default function CodeSnippet() {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();
  const base = Math.min(width, height);

  // Card glides in with LIQUID (smooth, premium feel for the editor frame).
  const cardIn = springIn(frame, vfps, 0, "LIQUID");

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
            opacity: cardIn,
            transform: `translateY(${interpolate(cardIn, [0, 1], [30, 0])}px)`,
            background: "#0B0B12",
            border: `0.5px solid rgba(255,255,255,0.08)`,
            borderRadius: base * 0.012,
            boxShadow: `0 ${base * 0.018}px ${base * 0.06}px rgba(0,0,0,0.6)`,
            overflow: "hidden",
            minWidth: width * 0.5,
            maxWidth: width * 0.8,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: base * 0.008,
              padding: `${base * 0.012}px ${base * 0.02}px`,
              borderBottom: "0.5px solid rgba(255,255,255,0.06)",
            }}
          >
            {[BRAND.colors.pink, "#FFAB45", BRAND.colors.green].map((c, i) => (
              <div
                key={i}
                style={{
                  width: base * 0.012,
                  height: base * 0.012,
                  borderRadius: "50%",
                  background: c,
                  opacity: 0.85,
                }}
              />
            ))}
            <div
              style={{
                marginLeft: base * 0.012,
                fontFamily: MONO,
                fontSize: base * 0.018,
                color: BRAND.colors.textMuted,
              }}
            >
              {FILENAME}
            </div>
          </div>
          <div
            style={{
              padding: `${base * 0.025}px ${base * 0.03}px`,
              fontFamily: MONO,
              fontSize: base * 0.023,
              lineHeight: 1.6,
              color: BRAND.colors.text,
            }}
          >
            {LINES.map((line, i) => {
              // SNAPPY per-line typing cadence with a 6-frame stagger.
              const lineIn = staggeredSpring(frame, vfps, i, 8, 6, "SNAPPY");
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: base * 0.018,
                    minHeight: base * 0.036,
                    opacity: lineIn,
                    transform: `translateX(${interpolate(lineIn, [0, 1], [-12, 0])}px)`,
                  }}
                >
                  <span
                    style={{
                      color: "rgba(255,255,255,0.25)",
                      width: base * 0.025,
                      textAlign: "right",
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </span>
                  <span style={{ whiteSpace: "pre" }}>
                    {line.tokens.map(([t, k], j) => (
                      <span key={j} style={{ color: TOKEN_COLOR[k] ?? BRAND.colors.text }}>
                        {t}
                      </span>
                    ))}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </AbsoluteFill>
    </>
  );
}
