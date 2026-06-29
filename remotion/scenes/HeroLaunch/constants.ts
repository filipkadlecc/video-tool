// HeroLaunch — shared constants. 4K (3840x2160) @ 25fps, 389 frames (~15.56s).
// Beat boundaries are the client's exact 25fps timecodes (seconds*25 + frames).
import { BRAND } from "../../theme";

export const FPS = 25;
export const TOTAL = 514; // action ends at 389; ~5s tail (389-514) holds the final frame

// Absolute frame map (global timeline). Beats 1-5 live in one persistent
// morphing "window" (WindowStage); beats 6-9 in FailureStage.
export const BEATS = {
  plan: { from: 0, end: 36 },     // 0:00:00 - 0:01:11
  code: { from: 36, end: 55 },    // 0:01:11 - 0:02:05  write code
  api: { from: 55, end: 84 },     // 0:02:05 - 0:03:09  API line
  chat: { from: 84, end: 142 },   // 0:03:09 - 0:05:17  claude chat message
  reply: { from: 142, end: 175 }, // 0:05:17 - 0:07:00  "can't do that"
  signup: { from: 175, end: 226 },// 0:07:00 - 0:09:01  sign up screen
  card: { from: 226, end: 304 },  // 0:09:01 - 0:12:04  credit card
  hold: { from: 304, end: 339 },  // 0:12:04 - 0:13:14  hold
  pivot: { from: 339, end: 389 }, // 0:13:14 - end      X -> checkmark
} as const;

export const C = {
  bg: BRAND.colors.bg,
  card: BRAND.colors.card,
  cardHi: "#242628",        // slightly lighter opaque surface for nested rows
  border: BRAND.colors.border,
  text: BRAND.colors.text,
  textMuted: BRAND.colors.textMuted,
  textSubtle: BRAND.colors.textSubtle,
  orange: BRAND.colors.orange,
  orangeDeep: BRAND.colors.orangeDeep,
  orangeTint: BRAND.colors.orangeTint,
  // Claude composer palette (from PromptBox.tsx)
  composerBox: "#262624",
  composerText: "#ECECEC",
  composerIcon: "#8d8d87",
  composerModel: "#cfcfca",
  composerSend: "#C96442",
  // Story accents
  teal: "#7EE0C4",          // "plan mode" + success check (the through-line)
  tealDeep: "#36B89A",
  red: "#E5484D",           // refined error red (X marks only)
  // generic third-party service accent (signup) — deliberately NOT Apify orange
  saas: "#5B6CFF",
};

export const MONO = "ui-monospace, 'SF Mono', Menlo, Monaco, Consolas, monospace";
export const SANS = BRAND.fonts.primary;       // Inter
export const DISPLAY = BRAND.fonts.marketing;  // GT Walsheim

// Beat 1 code (written "in half a second"); Beat 2 appends API_LINE below it.
export const CODE_LINES: string[] = [
  "async function run(task: string) {",
  "  const plan = await agent.plan(task);",
  "  const code = await agent.write(plan);",
  "  return code;",
  "}",
];
export const API_LINE = "const data = await fetch(apiUrl);";

export const PROMPT_TEXT = "get me the latest pricing data on this";
export const AGENT_REPLY = "I'm sorry, I can't do that.";

export const MODEL_LABEL = "Opus 4.8";
export const MODE_LABEL = "Plan";

// Obviously-fake card data.
export const CARD = {
  number: "4242  4242  4242  4242",
  name: "NOT A REAL CARD",
  expiry: "00 / 00",
  kind: "DEBIT",
};

export const SHADOW_SOFT = "0 30px 80px rgba(0,0,0,0.35)";
export const SHADOW_LIFT = "0 44px 110px rgba(0,0,0,0.42)";
export const SHADOW_CHIP = "0 8px 24px rgba(0,0,0,0.28)";
