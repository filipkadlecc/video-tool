import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

// ============================================================
// Claude prompt box — typewriter reveal of the prompt text.
// A faithful mock of the Claude composer: dark rounded box, the
// prompt typed out with a blinking caret, and the bottom toolbar
// (+, model label, mode dropdown, mic, orange send button).
// Background is transparent so it can sit over b-roll or a solid.
// ============================================================

// --- Editable params -----------------------------------------------------
const PROMPT_TEXT = "Based on these 2 analysis tasks, please prepare four concrete video ideas — each with a working title, format, length, and the data point that supports it.";
const MODEL_LABEL = "Opus 4.7";
const MODE_LABEL = "Extra";
// TYPING_SECONDS: time to type the full prompt. HOLD_SECONDS: pause after.
const TYPING_SECONDS = 2.4;
const HOLD_SECONDS = 1.2;
// -------------------------------------------------------------------------

export const fps = 25;
export const durationInFrames = Math.round((TYPING_SECONDS + HOLD_SECONDS) * fps);

const COLORS = {
  box: "#262624",
  text: "#ECECEC",
  icon: "#8d8d87",
  model: "#cfcfca",
  send: "#C96442",
};

// Inline @font-face so Inter renders identically in the browser preview and
// in a standalone `npx remotion render` (which doesn't load the app's CSS).
const FONT_FACE_CSS = `
@font-face {
  font-family: 'Inter';
  src: url('/assets/fonts/Inter_24pt-SemiBold.ttf') format('truetype');
  font-style: normal;
  font-display: block;
}
`;

const MicIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={COLORS.icon} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="2.5" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
    <line x1="12" y1="17.5" x2="12" y2="21" />
  </svg>
);

const SendIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="19" x2="12" y2="5.5" />
    <path d="M6 11 L12 5 L18 11" />
  </svg>
);

function typedCount(frame: number, total: number, typingFrames: number): number {
  if (frame <= 0) return 0;
  if (frame >= typingFrames) return total;
  return Math.floor((frame / typingFrames) * total);
}

const PromptBox: React.FC = () => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();

  const typingFrames = TYPING_SECONDS * fps;
  const count = typedCount(frame, PROMPT_TEXT.length, typingFrames);
  const shown = PROMPT_TEXT.slice(0, count);
  const done = count >= PROMPT_TEXT.length;
  // Caret is solid while typing, then blinks once the text is complete.
  const caretOn = done ? Math.floor(frame / 15) % 2 === 0 : true;

  const boxW = width * 0.56;
  const pad = width * 0.024;
  const radius = width * 0.018;
  const fontSize = width * 0.0145;
  const textStyle: React.CSSProperties = {
    fontFamily: "Inter, sans-serif",
    fontSize,
    lineHeight: 1.55,
    fontWeight: 400,
    color: COLORS.text,
    whiteSpace: "pre-wrap",
    letterSpacing: "-0.01em",
    margin: 0,
  };

  return (
    <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          width: boxW,
          backgroundColor: COLORS.box,
          borderRadius: radius,
          padding: pad,
          display: "flex",
          flexDirection: "column",
          gap: pad * 0.85,
          boxShadow: "0 30px 80px rgba(0,0,0,0.35)",
        }}
      >
        {/* Text area — hidden full text reserves final height; typed text overlays. */}
        <div style={{ position: "relative" }}>
          <div style={{ ...textStyle, visibility: "hidden" }}>{PROMPT_TEXT}</div>
          <div style={{ ...textStyle, position: "absolute", inset: 0 }}>
            {shown}
            <span
              style={{
                display: "inline-block",
                width: fontSize * 0.07,
                height: fontSize * 0.92,
                backgroundColor: COLORS.text,
                marginLeft: fontSize * 0.06,
                transform: `translateY(${fontSize * 0.14}px)`,
                opacity: caretOn ? 1 : 0,
              }}
            />
          </div>
        </div>

        {/* Toolbar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ color: COLORS.icon, fontSize: fontSize * 1.3, lineHeight: 1, fontFamily: "Inter, sans-serif" }}>+</div>
          <div style={{ display: "flex", alignItems: "center", gap: fontSize * 0.7 }}>
            <span style={{ color: COLORS.model, fontSize: fontSize * 0.82, fontFamily: "Inter, sans-serif" }}>{MODEL_LABEL}</span>
            <span style={{ color: COLORS.icon, fontSize: fontSize * 0.82, fontFamily: "Inter, sans-serif" }}>{MODE_LABEL} ⌄</span>
            <MicIcon size={fontSize * 1.05} />
            <div
              style={{
                width: fontSize * 1.7,
                height: fontSize * 1.7,
                borderRadius: fontSize * 0.42,
                backgroundColor: COLORS.send,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginLeft: fontSize * 0.1,
              }}
            >
              <SendIcon size={fontSize * 1.0} />
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default function PromptBoxScene() {
  return (
    <>
      <style>{FONT_FACE_CSS}</style>
      <AbsoluteFill style={{ background: "transparent" }}>
        <PromptBox />
      </AbsoluteFill>
    </>
  );
}
