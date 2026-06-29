// HeroLaunch — shared helpers: fonts, code tokenizer, small math.
import { interpolate } from "remotion";
import { BRAND_FONT_FACE_CSS } from "../../theme";
import { C, MONO } from "./constants";

// Emit GT Walsheim (from theme) + the Inter SemiBold face PromptBox uses, so the
// composition is self-sufficient whether previewed in Studio or rendered via the
// CLI entry (remotion/index.tsx already loads both globally, but inlining is cheap
// insurance against a standalone render that skips it).
export const FONT_CSS =
  BRAND_FONT_FACE_CSS +
  `
@font-face {
  font-family: 'Inter';
  src: url('/assets/fonts/Inter_24pt-SemiBold.ttf') format('truetype');
  font-weight: 600;
  font-style: normal;
  font-display: block;
}
`;

// Multi-stop interpolate with clamped ends — used for the beat-5 desaturate /
// beat-6 warmth-return filter ramps.
export function ramp(frame: number, stops: number[], values: number[]): number {
  return interpolate(frame, stops, values, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

// Light heuristic code coloring (ported from CodeSnippet.tsx): orange for
// control-flow keywords, muted gray for string literals, text for the rest.
const KEYWORDS = new Set([
  "import", "from", "const", "let", "var", "await", "async", "function",
  "return", "if", "else", "for", "while", "true", "false", "null", "undefined",
  "new", "class", "extends", "this", "of", "in",
]);

export function renderCodeLine(line: string): { text: string; color: string }[] {
  const parts: { text: string; color: string }[] = [];
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === " " || ch === "\t") {
      let j = i;
      while (j < line.length && (line[j] === " " || line[j] === "\t")) j++;
      parts.push({ text: line.slice(i, j), color: C.text });
      i = j;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      let j = i + 1;
      while (j < line.length && line[j] !== quote) {
        if (line[j] === "\\" && j + 1 < line.length) j += 2;
        else j++;
      }
      j = Math.min(j + 1, line.length);
      parts.push({ text: line.slice(i, j), color: C.textMuted });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < line.length && /[A-Za-z0-9_]/.test(line[j])) j++;
      const word = line.slice(i, j);
      parts.push({ text: word, color: KEYWORDS.has(word) ? C.orange : C.text });
      i = j;
      continue;
    }
    parts.push({ text: ch, color: C.text });
    i++;
  }
  return parts;
}

export { MONO };
