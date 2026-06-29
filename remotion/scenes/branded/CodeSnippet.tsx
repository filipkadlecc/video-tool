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
export const durationInFrames = 165;

// Editor-style code card — monochrome (orange keywords + textMuted strings).
// No rainbow syntax: the brand is orange-only.

const FILENAME = "main.ts";
const LINES: string[] = [
  "import { Actor } from \"apify\";",
  "",
  "await Actor.init();",
  "",
  "const input = await Actor.getInput();",
  " console.log(\"Hello, \", input.name);",
  "",
  "await Actor.exit();",
];

const MONO = "ui-monospace, 'SF Mono', Menlo, Monaco, Consolas, monospace";

// Light heuristic syntax color so the monochrome card still reads as code.
// Orange for control-flow keywords, muted gray for string literals, text for
// everything else. No tokenizer — just per-character span splitting at render.
const KEYWORDS = new Set([
  "import", "from", "const", "let", "var", "await", "async", "function",
  "return", "if", "else", "for", "while", "true", "false", "null", "undefined",
  "new", "class", "extends", "this",
]);

function renderCodeLine(line: string) {
  const parts: { text: string; color: string }[] = [];
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    // Whitespace — emit as-is.
    if (ch === " " || ch === "\t") {
      let j = i;
      while (j < line.length && (line[j] === " " || line[j] === "\t")) j++;
      parts.push({ text: line.slice(i, j), color: BRAND.colors.text });
      i = j;
      continue;
    }
    // String literal — match until closing quote.
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      let j = i + 1;
      while (j < line.length && line[j] !== quote) {
        if (line[j] === "\\\\" && j + 1 < line.length) j += 2;
        else j++;
      }
      j = Math.min(j + 1, line.length);
      parts.push({ text: line.slice(i, j), color: BRAND.colors.textMuted });
      i = j;
      continue;
    }
    // Word — letters / digits / underscore.
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < line.length && /[A-Za-z0-9_]/.test(line[j])) j++;
      const word = line.slice(i, j);
      parts.push({
        text: word,
        color: KEYWORDS.has(word) ? BRAND.colors.orange : BRAND.colors.text,
      });
      i = j;
      continue;
    }
    // Punctuation / single character.
    parts.push({ text: ch, color: BRAND.colors.text });
    i++;
  }
  return parts;
}
const ACCENT = BRAND.colors.orange;

export default function CodeSnippet() {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();
  const base = Math.min(width, height);

  const envelope = inOutEnvelope(frame, vfps, durationInFrames);

  const cardIn = springIn(frame, vfps, TIMING.entrance, "LIQUID");

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
            alignItems: "center",
            justifyContent: "center",
            padding: `${base * 0.14}px ${base * 0.08}px ${base * 0.08}px`,
          }}
        >
          <div
            style={{
              opacity: cardIn,
              transform: `translateY(${interpolate(cardIn, [0, 1], [24, 0])}px)`,
              background: BRAND.colors.card,
              border: `1px solid ${BRAND.colors.border}`,
              borderRadius: base * 0.016,
              overflow: "hidden",
              width: "100%",
              maxWidth: width * 0.78,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: base * 0.01,
                padding: `${base * 0.014}px ${base * 0.022}px`,
                borderBottom: `1px solid ${BRAND.colors.border}`,
              }}
            >
              {/* Three orange-dim "+" dots — branded swap for the rainbow traffic lights. */}
              {[0.9, 0.6, 0.35].map((opacity, i) => (
                <div
                  key={i}
                  style={{
                    width: base * 0.011,
                    height: base * 0.011,
                    borderRadius: "50%",
                    background: ACCENT,
                    opacity,
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
                fontSize: base * 0.022,
                lineHeight: 1.65,
                color: BRAND.colors.text,
              }}
            >
              {LINES.map((line, i) => {
                const lineIn = staggeredSpring(
                  frame,
                  vfps,
                  i,
                  TIMING.entrance + 10,
                  6,
                  "GENTLE",
                );
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: base * 0.018,
                      minHeight: base * 0.036,
                      opacity: lineIn,
                      transform: `translateX(${interpolate(lineIn, [0, 1], [-10, 0])}px)`,
                    }}
                  >
                    <span
                      style={{
                        color: BRAND.colors.textSubtle,
                        width: base * 0.025,
                        textAlign: "right",
                        flexShrink: 0,
                        opacity: 0.7,
                      }}
                    >
                      {i + 1}
                    </span>
                    <span style={{ whiteSpace: "pre" }}>
                      {renderCodeLine(line).map((part, j) => (
                        <span key={j} style={{ color: part.color }}>
                          {part.text}
                        </span>
                      ))}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </>
  );
}
