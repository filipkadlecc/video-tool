// Beats 1-5 (frames 0-190) — ONE persistent window that transforms.
//   Plan (0-36)      : terminal in plan mode, "planning" shimmer in the body
//   write code (36-55): code writes on fast
//   API (55-84)      : the fetch line appends, brief orange flash
//   morph (~80-108)  : code contents vanish, the box REFORMS into the Claude window
//   chat msg (84-142): the Claude window shows the user's message (just text)
//   reply (142-175)  : "I'm sorry, I can't do that." slides up from behind the window
//   exit (175-190)   : the window swipes left as the failure stage slides in
import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { springIn, staggeredSpring } from "../../motion";
import { C, MONO, SANS, CODE_LINES, API_LINE, PROMPT_TEXT, AGENT_REPLY, SHADOW_SOFT } from "./constants";
import { renderCodeLine, ramp } from "./shared";

const PauseBars: React.FC<{ p: number; h: number }> = ({ p, h }) => {
  const w = h * 0.3;
  const bar = (delay: number) => ({
    width: w,
    height: h * interpolate(Math.max(0, p - delay), [0, 0.5], [0.5, 1], { extrapolateRight: "clamp" }),
    borderRadius: w * 0.4,
    background: C.teal,
    opacity: interpolate(Math.max(0, p - delay), [0, 0.3], [0, 1], { extrapolateRight: "clamp" }),
  });
  return (
    <div style={{ display: "flex", gap: w * 0.6, alignItems: "center" }}>
      <div style={bar(0)} />
      <div style={bar(0.12)} />
    </div>
  );
};

export const WindowStage: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const base = Math.min(width, height);

  // ---------- box geometry + transforms ----------
  const inP = springIn(frame, fps, 0, "SNAPPY");
  const inScale = interpolate(inP, [0, 1], [0.9, 1]);
  const inBlur = interpolate(inP, [0, 1], [10, 0]);
  const inY = interpolate(inP, [0, 1], [base * 0.05, 0]);

  // morph: contents fade (80-88) -> box reforms snappily (86+) -> chat fades in
  const termOpacity = ramp(frame, [80, 88], [1, 0]);
  const sizeProg = springIn(frame, fps, 86, "SNAPPY");
  const chatOpacity = ramp(frame, [98, 110], [0, 1]);
  const morphDip = 1 - 0.04 * ramp(frame, [86, 93, 102], [0, 1, 0]);

  const termW = width * 0.56, termH = height * 0.45;
  const chatW = width * 0.46, chatH = height * 0.3;
  // Morph target = the sign-up window footprint (kept in sync with FailureStage).
  const signW = width * 0.34, signH = height * 0.4;
  const chatGeoW = interpolate(sizeProg, [0, 1], [termW, chatW]);
  const chatGeoH = interpolate(sizeProg, [0, 1], [termH, chatH]);

  // exit (175+): the box REFORMS into the sign-up window in place (no swipe),
  // then fades out as FailureStage's sign-up reforms over the same footprint.
  const morphOut = springIn(frame, fps, 175, "SNAPPY");
  const exitFade = ramp(frame, [187, 200], [1, 0]);
  const boxW = interpolate(morphOut, [0, 1], [chatGeoW, signW]);
  const boxH = interpolate(morphOut, [0, 1], [chatGeoH, signH]);

  const opacity = inP * exitFade;
  const ty = inY;
  const scale = inScale * morphDip;
  // chat text clears as the reshape begins
  const chatLayerOpacity = chatOpacity * ramp(frame, [175, 183], [1, 0]);

  // ---------- code body ----------
  const codeFont = base * 0.0182;
  const lineH = codeFont * 1.74;
  const caretOn = Math.floor(frame / 12) % 2 === 0;
  const shimmerOpacity = ramp(frame, [6, 16], [0, 1]) * ramp(frame, [30, 38], [1, 0]);
  const planP = springIn(frame, fps, 23, "ELASTIC"); // "plan mode on" pops in at 0:00:00:23

  const renderLine = (line: string, idx: number, baseDelay: number, flash = false) => {
    const t = staggeredSpring(frame, fps, idx, baseDelay, 1.2, "SNAPPY");
    const wipe = interpolate(t, [0, 1], [100, 0]);
    const flashAmt = flash ? ramp(frame, [baseDelay, baseDelay + 5, baseDelay + 18], [0, 1, 0]) : 0;
    return (
      <div key={`${baseDelay}-${idx}`} style={{
        display: "flex", gap: codeFont * 1.1, minHeight: lineH, alignItems: "baseline",
        opacity: t, clipPath: `inset(0 ${wipe}% 0 0)`,
        transform: `translateY(${interpolate(t, [0, 1], [base * 0.004, 0])}px)`,
      }}>
        <span style={{ color: C.textSubtle, width: codeFont * 1.4, textAlign: "right", flexShrink: 0, opacity: 0.6 }}>{idx + 1}</span>
        <span style={{ whiteSpace: "pre", textShadow: flashAmt > 0.01 ? `0 0 ${base * 0.016 * flashAmt}px rgba(248,102,6,${0.85 * flashAmt})` : "none" }}>
          {renderCodeLine(line).map((part, j) => (<span key={j} style={{ color: part.color }}>{part.text}</span>))}
        </span>
      </div>
    );
  };

  // ---------- chat ----------  (snappy, with a slide for energy)
  const userIn = springIn(frame, fps, 100, "SNAPPY");
  const userX = interpolate(userIn, [0, 1], [base * 0.06, 0]);
  const replyP = springIn(frame, fps, 142, "SNAPPY");
  const replyY = interpolate(replyP, [0, 1], [chatH * 0.95, 0]);
  const replyOpacity = ramp(frame, [142, 150], [0, 1]);
  const textFont = base * 0.0152;

  return (
    <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{
        position: "relative",
        width: boxW, height: boxH,
        opacity,
        transform: `translateY(${ty}px) scale(${scale})`,
        filter: inBlur > 0.05 ? `blur(${inBlur}px)` : "none",
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: base * 0.018,
        overflow: "hidden",
        boxShadow: SHADOW_SOFT,
      }}>
        {/* ============ TERMINAL LAYER ============ */}
        <div style={{
          position: "absolute", inset: 0, opacity: termOpacity,
          display: termOpacity < 0.01 ? "none" : "flex", flexDirection: "column",
          fontFamily: MONO,
          filter: termOpacity < 0.99 ? `blur(${(1 - termOpacity) * 6}px)` : "none",
        }}>
          {/* chrome */}
          <div style={{ display: "flex", alignItems: "center", gap: base * 0.009, padding: `${base * 0.013}px ${base * 0.02}px`, borderBottom: `1px solid ${C.border}` }}>
            {[0.9, 0.6, 0.35].map((o, i) => (<div key={i} style={{ width: base * 0.0095, height: base * 0.0095, borderRadius: "50%", background: C.orange, opacity: o }} />))}
            <div style={{ marginLeft: base * 0.012, fontSize: base * 0.015, color: C.textMuted }}>agent.ts</div>
          </div>
          {/* body: shimmer (Plan) -> code */}
          <div style={{ position: "relative", flex: 1, padding: `${base * 0.022}px ${base * 0.028}px`, fontSize: codeFont, lineHeight: 1.74, color: C.text }}>
            {/* planning shimmer */}
            <div style={{ position: "absolute", top: base * 0.024, left: base * 0.028, right: base * 0.028, opacity: shimmerOpacity }}>
              {[0.7, 0.45, 0.6].map((w, i) => (
                <div key={i} style={{
                  height: codeFont * 0.85, width: `${w * 100}%`, marginBottom: lineH - codeFont * 0.85,
                  borderRadius: codeFont * 0.4, background: C.border,
                  opacity: 0.5 + 0.4 * (0.5 + 0.5 * Math.sin((frame + i * 7) / 6)),
                }} />
              ))}
            </div>
            {/* code */}
            <div>
              {CODE_LINES.map((l, i) => renderLine(l, i, 36, false))}
              <div style={{ minHeight: lineH * 0.5 }} />
              {renderLine(API_LINE, CODE_LINES.length + 1, 58, true)}
            </div>
          </div>
          {/* input + plan mode */}
          <div style={{ padding: `${base * 0.006}px ${base * 0.028}px ${base * 0.02}px` }}>
            <div style={{ display: "flex", alignItems: "center", gap: base * 0.01, border: `1px solid ${C.border}`, borderRadius: base * 0.008, padding: `${base * 0.011}px ${base * 0.016}px`, opacity: Math.min(1, inP * 1.2) }}>
              <span style={{ color: C.teal, fontSize: codeFont, opacity: 0.9 }}>&gt;</span>
              <span style={{ width: codeFont * 0.52, height: codeFont * 1.05, background: C.text, opacity: caretOn ? 0.85 : 0, borderRadius: 2 }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: base * 0.009, marginTop: base * 0.011, paddingLeft: base * 0.002 }}>
              <div style={{ display: "flex", alignItems: "center", gap: base * 0.007, padding: `${base * 0.005}px ${base * 0.0095}px`, borderRadius: base * 0.05, background: "rgba(126,224,196,0.12)", boxShadow: `0 0 ${base * 0.014}px rgba(126,224,196,0.42)`, opacity: planP, transform: `scale(${interpolate(planP, [0, 1], [0.7, 1])})`, transformOrigin: "left center" }}>
                <PauseBars p={planP} h={codeFont * 0.92} />
                <span style={{ color: C.teal, fontSize: codeFont * 0.9, fontFamily: MONO }}>plan mode on</span>
              </div>
            </div>
          </div>
        </div>

        {/* ============ CHAT LAYER ============ */}
        <div style={{ position: "absolute", inset: 0, opacity: chatLayerOpacity, display: chatLayerOpacity < 0.01 ? "none" : "block" }}>
          {/* user message (sent, right) */}
          <div style={{
            position: "absolute", top: base * 0.03, right: base * 0.026, maxWidth: "72%",
            opacity: userIn, transform: `translate(${userX}px, ${interpolate(userIn, [0, 1], [base * 0.012, 0])}px)`,
            background: "#2c2e30", borderRadius: base * 0.014, padding: `${base * 0.016}px ${base * 0.02}px`,
            fontFamily: SANS, fontSize: textFont, fontWeight: 500, color: C.text, lineHeight: 1.45,
          }}>
            {PROMPT_TEXT}
          </div>
          {/* agent reply — slides up from behind the window's bottom edge */}
          <div style={{
            position: "absolute", bottom: base * 0.03, left: base * 0.026, maxWidth: "72%",
            opacity: replyOpacity, transform: `translateY(${replyY}px)`,
            background: C.cardHi, border: `1px solid ${C.border}`, borderRadius: base * 0.014,
            padding: `${base * 0.016}px ${base * 0.02}px`,
            fontFamily: SANS, fontSize: textFont, fontWeight: 500, color: C.textMuted, lineHeight: 1.45,
          }}>
            {AGENT_REPLY}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
