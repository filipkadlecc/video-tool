// Apify AI — Launch. Built from the Figma storyboard (xQ9JOuaA6hYkbW6T3rOhfy),
// synced to the voiceover mix. 4K / 25fps / 34s. Faithful rebuild of the real
// design: exact copy, brand colours and fonts; motion per the designer notes.
import React from "react";
import {
  AbsoluteFill,
  Sequence,
  Audio,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { springIn, ambientDrift } from "../motion";

export const fps = 25;
export const durationInFrames = 850;

// ---- Brand palette (pulled from the Figma variables) ----------------------
const C = {
  bg: "#161718",
  text: "#f4f4f5",
  muted: "#9ea2a8",
  subtle: "#bfc1c5",
  border: "#3d3f43",
  panel: "#1f2123",
  orange: "#f86606",
  orangeDim: "#e2560e",
  blue: "#246dff",
  green: "#20a34e",
};
const FONT = "'GT Walsheim', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'GT Walsheim', ui-monospace, 'SF Mono', Menlo, monospace";

// Load GT Walsheim in the browser preview too (the renderer loads it separately).
const FONT_CSS = `
@font-face{font-family:'GT Walsheim';src:url('/fonts/GT-Walsheim-Regular.ttf') format('truetype');font-weight:400;font-display:block;}
@font-face{font-family:'GT Walsheim';src:url('/fonts/GT-Walsheim-Medium.ttf') format('truetype');font-weight:500;font-display:block;}
@font-face{font-family:'GT Walsheim';src:url('/fonts/GT-Walsheim-Bold.ttf') format('truetype');font-weight:700;font-display:block;}
@font-face{font-family:'GT Walsheim';src:url('/fonts/GT-Walsheim-Black.ttf') format('truetype');font-weight:900;font-display:block;}
`;

// ---- helpers ---------------------------------------------------------------
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));

function grpFade(
  f: number,
  inStart: number,
  inEnd: number,
  outStart = Infinity,
  outEnd = Infinity
): number {
  const fin = interpolate(f, [inStart, inEnd], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fout = isFinite(outStart)
    ? interpolate(f, [outStart, outEnd], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 1;
  return Math.min(fin, fout);
}

// Per-character reveal (spring in). order: "center" | "ltr".
const CharReveal: React.FC<{
  text: string;
  start?: number;
  stagger?: number;
  order?: "center" | "ltr";
  style?: React.CSSProperties;
}> = ({ text, start = 0, stagger = 1.4, order = "center", style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const chars = Array.from(text);
  const n = chars.length;
  const center = (n - 1) / 2;
  return (
    <span style={{ display: "inline-block", ...style }}>
      {chars.map((ch, i) => {
        const dist = order === "center" ? Math.abs(i - center) : i;
        const p = springIn(frame, fps, start + dist * stagger, "SNAPPY");
        const y = interpolate(p, [0, 1], [30, 0]);
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              whiteSpace: "pre",
              opacity: p,
              transform: `translateY(${y}px)`,
            }}
          >
            {ch === " " ? " " : ch}
          </span>
        );
      })}
    </span>
  );
};

// Console typing (substring) + blinking caret.
const Typed: React.FC<{
  text: string;
  start: number;
  charDur?: number;
  caret?: boolean;
  caretColor?: string;
  style?: React.CSSProperties;
}> = ({ text, start, charDur = 1.35, caret = true, caretColor = C.orange, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const shown = Math.max(0, Math.floor((frame - start) / charDur));
  const visible = text.slice(0, shown);
  const done = shown >= text.length;
  const blink = Math.floor(frame / Math.round(fps * 0.5)) % 2 === 0;
  const showCaret = caret && (frame >= start) && (!done || blink);
  return (
    <span style={style}>
      {visible}
      {showCaret && (
        <span style={{ color: caretColor, fontWeight: 400, marginLeft: 2 }}>|</span>
      )}
    </span>
  );
};

// Decode / scramble that resolves to the target text.
const GLYPHS = "APIFYXKZ01#@%&*<>/";
const Decode: React.FC<{ text: string; start: number; dur: number; style?: React.CSSProperties }> = ({
  text,
  start,
  dur,
  style,
}) => {
  const frame = useCurrentFrame();
  const chars = Array.from(text);
  const per = dur / (chars.length + 1);
  return (
    <span style={style}>
      {chars.map((ch, i) => {
        const lock = start + (i + 1) * per;
        if (frame >= lock || ch === " ") return <span key={i}>{ch}</span>;
        if (frame < start) return <span key={i} style={{ opacity: 0 }}>{ch}</span>;
        const g = GLYPHS[(Math.floor(frame * 1.6) + i * 7) % GLYPHS.length];
        return <span key={i} style={{ color: C.orange }}>{g}</span>;
      })}
    </span>
  );
};

// small icons ---------------------------------------------------------------
const IconSearch: React.FC<{ size?: number; color?: string }> = ({ size = 40, color = C.muted }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
    <circle cx="11" cy="11" r="7" />
    <line x1="16.5" y1="16.5" x2="21" y2="21" strokeLinecap="round" />
  </svg>
);
const IconArrowRight: React.FC<{ size?: number; color?: string }> = ({ size = 40, color = "#161718" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="12" x2="19" y2="12" />
    <polyline points="13,6 19,12 13,18" />
  </svg>
);
const IconArrowLeft: React.FC<{ size?: number; color?: string }> = ({ size = 40, color = C.text }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <line x1="20" y1="12" x2="5" y2="12" />
    <polyline points="11,6 5,12 11,18" />
  </svg>
);
const IconTrash: React.FC<{ size?: number; color?: string }> = ({ size = 30, color = C.muted }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4,7 20,7" />
    <path d="M6 7l1 13h10l1-13" />
    <path d="M9 7V4h6v3" />
  </svg>
);
const CheckBadge: React.FC<{ size?: number }> = ({ size = 42 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ verticalAlign: "middle" }}>
    <rect x="2" y="2" width="20" height="20" rx="5" fill={C.green} />
    <polyline points="7,12.5 10.5,16 17,8.5" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ApifySymbol: React.FC<{ size: number; style?: React.CSSProperties }> = ({ size, style }) => (
  <Img src={staticFile("assets/apify/Apify symbol colors.svg")} style={{ width: size, height: size, ...style }} />
);

const LAYOUT = { colW: 2600, colLeft: 620 };

// ===========================================================================
// BEAT 1 — cold open. "Getting data off the web..." → caret → "which tool..."
// ===========================================================================
const Beat1: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const line1Op = grpFade(f, 0, 1, 66, 78);
  const caretShow = interpolate(f, [70, 74, 92, 98], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const caretBlink = Math.floor(f / Math.round(fps * 0.3)) % 2 === 0 ? 1 : 0.15;
  const line2Op = grpFade(f, 80, 84, dur - 8, dur);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", textAlign: "center" }}>
      {/* line 1 */}
      <div style={{ position: "absolute", opacity: line1Op, maxWidth: 2900, padding: "0 120px" }}>
        <CharReveal
          text="Getting data off the web used to start with a question:"
          start={2}
          stagger={0.9}
          order="ltr"
          style={{ fontFamily: FONT, fontWeight: 400, fontSize: 96, color: C.text, lineHeight: 1.15, letterSpacing: -1 }}
        />
      </div>
      {/* caret between lines */}
      <div style={{ position: "absolute", opacity: caretShow }}>
        <div style={{ width: 8, height: 150, background: C.orange, opacity: caretBlink, borderRadius: 2 }} />
      </div>
      {/* line 2 */}
      <div style={{ position: "absolute", opacity: line2Op, maxWidth: 3200, padding: "0 120px" }}>
        <div style={{ fontFamily: FONT, fontSize: 176, lineHeight: 1.1, letterSpacing: -3, color: C.text }}>
          <CharReveal text="which " start={82} stagger={1.3} order="ltr" style={{ fontWeight: 500 }} />
          <CharReveal text="tool" start={90} stagger={1.3} order="ltr" style={{ fontWeight: 700 }} />
          <CharReveal text=" do I even use?" start={95} stagger={1.3} order="ltr" style={{ fontWeight: 500 }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ===========================================================================
// BEAT 2 — "just ask for what you need." → console, prompt types in.
// ===========================================================================
const Beat2: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 2a: the line, with "need." punch. Visible ~0-74.
  const aOp = grpFade(f, 0, 2, 68, 78);
  const needP = springIn(f, fps, 40, "ELASTIC");
  const needScale = interpolate(needP, [0, 1], [0.6, 1]);

  // 2b: console. Appears ~76.
  const boxP = springIn(f, fps, 78, "LIQUID");
  const boxOp = grpFade(f, 78, 90, dur - 8, dur);
  const boxY = interpolate(boxP, [0, 1], [40, 0]);
  // send-button click near the end of typing
  const clickP = springIn(f, fps, 196, "ELASTIC");
  const btnScale = 1 - interpolate(f, [190, 196], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) * 0.12 + clickP * 0.12;

  const showConsole = f > 74;

  return (
    <AbsoluteFill>
      {/* 2a */}
      {!showConsole && (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", textAlign: "center", opacity: aOp }}>
          <div style={{ maxWidth: 2900, padding: "0 140px" }}>
            <div style={{ fontFamily: FONT, fontWeight: 400, fontSize: 104, color: C.text, lineHeight: 1.18, letterSpacing: -1 }}>
              <CharReveal text="With Apify AI, you can just ask for what you" start={2} stagger={0.9} order="ltr" />
            </div>
            <div style={{ marginTop: 30, transform: `scale(${needScale})`, opacity: clamp(needP * 1.4) }}>
              <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 200, color: C.text, letterSpacing: -4 }}>need.</span>
            </div>
          </div>
        </AbsoluteFill>
      )}

      {/* 2b console */}
      {showConsole && (
        <AbsoluteFill style={{ opacity: boxOp }}>
          {/* go back */}
          <div style={{ position: "absolute", top: 150, left: 150, display: "flex", alignItems: "center", gap: 22 }}>
            <IconArrowLeft size={44} />
            <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 52, color: C.text }}>Go back</span>
          </div>
          {/* search box */}
          <div
            style={{
              position: "absolute",
              left: LAYOUT.colLeft,
              top: 900,
              width: LAYOUT.colW,
              transform: `translateY(${boxY}px)`,
              background: "rgba(255,255,255,0.02)",
              border: `2px solid ${C.border}`,
              borderRadius: 40,
              padding: "60px 64px 48px",
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 34 }}>
              <IconSearch size={52} />
              <div style={{ flex: 1, fontFamily: FONT, fontWeight: 400, fontSize: 64, color: C.text, letterSpacing: -0.5 }}>
                <Typed
                  text="I run a web design studio and I want to pitch real estate agencies in Miami"
                  start={92}
                  charDur={1.35}
                  caretColor={C.orange}
                />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 52 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <IconTrash size={40} />
                <span style={{ fontFamily: FONT, fontSize: 44, color: C.muted }}>Clear chat</span>
              </div>
              <div
                style={{
                  width: 108,
                  height: 108,
                  borderRadius: "50%",
                  background: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transform: `scale(${btnScale})`,
                }}
              >
                <IconArrowRight size={54} />
              </div>
            </div>
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

// ===========================================================================
// Chat scaffold shared by Beats 3 & 4
// ===========================================================================
const UserBubble: React.FC<{ text: string; op: number; y: number }> = ({ text, op, y }) => (
  <div style={{ display: "flex", justifyContent: "flex-end", opacity: op, transform: `translateY(${y}px)` }}>
    <div
      style={{
        display: "flex",
        gap: 26,
        alignItems: "flex-start",
        background: C.panel,
        border: `1px solid ${C.border}`,
        borderRadius: 34,
        padding: "34px 44px",
        maxWidth: 1700,
      }}
    >
      <ApifySymbol size={54} style={{ flex: "none", marginTop: 4 }} />
      <span style={{ fontFamily: FONT, fontSize: 56, color: C.text, lineHeight: 1.3 }}>{text}</span>
    </div>
  </div>
);

// ===========================================================================
// BEAT 3 — Apify AI recommends the Actor + run plan.
// ===========================================================================
const Beat3: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rowFade = (start: number) => {
    const p = springIn(f, fps, start, "SNAPPY");
    return { opacity: p, transform: `translateY(${interpolate(p, [0, 1], [24, 0])}px)` };
  };
  const outOp = grpFade(f, 0, 1, dur - 8, dur);
  const uP = springIn(f, fps, 0, "LIQUID");

  return (
    <AbsoluteFill style={{ opacity: outOp }}>
      <div style={{ position: "absolute", left: LAYOUT.colLeft, top: 360, width: LAYOUT.colW }}>
        <UserBubble
          text="I run a web design studio and I want to pitch real estate agencies in Miami"
          op={uP}
          y={interpolate(uP, [0, 1], [20, 0])}
        />
        <div style={{ marginTop: 70, fontFamily: FONT, color: C.text }}>
          <div style={{ fontSize: 58, lineHeight: 1.4, ...rowFade(8) }}>
            Google Maps Scraper is the perfect tool here — the most popular, with 490K+ users and 4.77★.
          </div>
          <div style={{ ...rowFade(22), marginTop: 40 }}>
            <span
              style={{
                display: "inline-block",
                fontFamily: MONO,
                fontSize: 46,
                color: C.subtle,
                background: C.panel,
                border: `1px solid ${C.border}`,
                borderRadius: 16,
                padding: "16px 30px",
              }}
            >
              compass/crawler-google-places
            </span>
          </div>
          <div style={{ fontSize: 56, marginTop: 44, ...rowFade(32) }}>Here&rsquo;s what I&rsquo;ll run:</div>
          <div style={{ fontSize: 54, color: C.subtle, marginTop: 24, paddingLeft: 40, lineHeight: 1.7 }}>
            <div style={rowFade(40)}>•&nbsp;&nbsp;Search term:&nbsp; &ldquo;real estate agency Miami&rdquo;</div>
            <div style={rowFade(48)}>•&nbsp;&nbsp;Location:&nbsp; Miami, FL</div>
            <div style={rowFade(56)}>•&nbsp;&nbsp;Limit:&nbsp; 20 places&nbsp; (~$0.06)</div>
          </div>
          <div style={{ fontSize: 54, marginTop: 44, lineHeight: 1.4, ...rowFade(66) }}>
            This will give you a solid list of leads to start your outreach. Shall I go ahead and run it?
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ===========================================================================
// BEAT 4 — "Yes, run it" → running → results table.
// ===========================================================================
const ROWS = [
  ["Coastal Realty Group", "(305) 555-0142", "coastalrealty.com"],
  ["Miami Luxe Estates", "(305) 555-0188", "miamiluxe.com"],
  ["Bayfront Properties", "(305) 555-0219", "bayfrontmiami.com"],
  ["Sunset Realty Co.", "(305) 555-0173", "sunsetrealtymia.com"],
  ["Palm & Pine Homes", "(305) 555-0264", "palmpinehomes.com"],
];

const Beat4: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const outOp = grpFade(f, 0, 1, dur - 8, dur);

  // user bubble "Yes, run it"
  const uP = springIn(f, fps, 0, "ELASTIC");

  // running card visible ~16-104, then hands off to results
  const runOp = grpFade(f, 16, 24, 98, 106);
  const scan = interpolate(f % 60, [0, 60], [0, 1]);

  // results appear ~100
  const resHead = springIn(f, fps, 100, "SNAPPY");
  const cardP = springIn(f, fps, 106, "LIQUID");
  const footP = springIn(f, fps, 156, "SNAPPY");

  return (
    <AbsoluteFill style={{ opacity: outOp }}>
      <div style={{ position: "absolute", left: LAYOUT.colLeft, top: 300, width: LAYOUT.colW }}>
        <UserBubble text="Yes, run it" op={uP} y={interpolate(uP, [0, 1], [18, 0])} />

        {/* running */}
        {f < 108 && (
          <div style={{ marginTop: 70, opacity: runOp }}>
            <div style={{ display: "flex", alignItems: "center", gap: 26, fontFamily: FONT, fontSize: 54, color: C.text }}>
              <ApifySymbol size={52} />
              <span>Running&nbsp;</span>
              <span style={{ fontFamily: MONO, fontSize: 46, color: C.subtle, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "12px 26px" }}>
                compass/crawler-google-places
              </span>
            </div>
            <div style={{ marginTop: 40, width: "100%", height: 16, background: C.panel, borderRadius: 8, overflow: "hidden" }}>
              <div style={{ position: "relative", width: "40%", height: "100%", background: C.orange, borderRadius: 8, left: `${scan * 150 - 40}%` }} />
            </div>
            <div style={{ marginTop: 30, fontFamily: FONT, fontSize: 42, color: C.muted }}>
              Setting up your run — nothing to configure.
            </div>
          </div>
        )}

        {/* results */}
        {f >= 96 && (
          <div style={{ marginTop: 70 }}>
            <div style={{ fontFamily: FONT, fontSize: 58, color: C.text, display: "flex", alignItems: "center", gap: 18, opacity: resHead, transform: `translateY(${interpolate(resHead, [0, 1], [20, 0])}px)` }}>
              Done <CheckBadge size={48} /> 20 Miami real-estate agencies — with phones &amp; websites:
            </div>
            <div
              style={{
                marginTop: 44,
                background: "rgba(255,255,255,0.02)",
                border: `1px solid ${C.border}`,
                borderRadius: 28,
                padding: "40px 56px",
                opacity: cardP,
                transform: `translateY(${interpolate(cardP, [0, 1], [30, 0])}px) scale(${interpolate(cardP, [0, 1], [0.985, 1])})`,
              }}
            >
              {/* header */}
              <div style={{ display: "flex", fontFamily: FONT, fontSize: 38, color: C.muted, paddingBottom: 28, borderBottom: `1.5px solid ${C.border}` }}>
                <div style={{ flex: "0 0 44%" }}>Agency</div>
                <div style={{ flex: "0 0 28%" }}>Phone</div>
                <div style={{ flex: 1 }}>Website</div>
              </div>
              {ROWS.map((r, i) => {
                const p = springIn(f, fps, 116 + i * 8, "SNAPPY");
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      fontFamily: FONT,
                      fontSize: 50,
                      color: C.text,
                      padding: "30px 0",
                      borderBottom: i < ROWS.length - 1 ? `1px solid ${C.border}` : "none",
                      opacity: p,
                      transform: `translateY(${interpolate(p, [0, 1], [18, 0])}px)`,
                    }}
                  >
                    <div style={{ flex: "0 0 44%" }}>{r[0]}</div>
                    <div style={{ flex: "0 0 28%", color: C.subtle }}>{r[1]}</div>
                    <div style={{ flex: 1, color: C.blue }}>{r[2]}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 40, fontFamily: FONT, fontWeight: 700, fontSize: 46, color: C.orange, opacity: footP }}>
              ↗ View full dataset — 20 results · CSV, JSON, Excel
            </div>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

// ===========================================================================
// BEAT 5 — "Just ask" + apify AI lockup, "AI" decodes in.
// ===========================================================================
const Beat5: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const justP = springIn(f, fps, 4, "LIQUID");
  const symP = springIn(f, fps, 24, "ELASTIC");
  const wordP = springIn(f, fps, 34, "LIQUID");
  const drift = ambientDrift(f, 4, 90, "logo");

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ transform: `translateY(${drift}px)`, textAlign: "center" }}>
        <div
          style={{
            fontFamily: FONT,
            fontWeight: 400,
            fontSize: 64,
            color: C.muted,
            letterSpacing: 1,
            opacity: justP,
            transform: `translateY(${interpolate(justP, [0, 1], [16, 0])}px)`,
            marginBottom: 96,
          }}
        >
          Just ask
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 56 }}>
          <ApifySymbol
            size={280}
            style={{ opacity: symP, transform: `scale(${interpolate(symP, [0, 1], [0.7, 1])})` }}
          />
          <div
            style={{
              overflow: "hidden",
              opacity: clamp(wordP * 1.5),
              clipPath: `inset(0 ${interpolate(wordP, [0, 1], [100, 0])}% 0 0)`,
            }}
          >
            <span style={{ fontFamily: FONT, fontWeight: 400, fontSize: 300, color: C.text, letterSpacing: -6, lineHeight: 1 }}>
              apify
            </span>
          </div>
          <span style={{ fontFamily: FONT, fontWeight: 400, fontSize: 300, color: C.text, letterSpacing: -4, lineHeight: 1 }}>
            <Decode text="AI" start={48} dur={30} />
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ===========================================================================
// ROOT
// ===========================================================================
export default function ApifyAILaunch() {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, fontFamily: FONT }}>
      <style>{FONT_CSS}</style>
      <Audio src={staticFile("assets/apify-ai-launch/voice.wav")} />

      <Sequence from={0} durationInFrames={148}>
        <Beat1 dur={148} />
      </Sequence>
      <Sequence from={140} durationInFrames={216}>
        <Beat2 dur={216} />
      </Sequence>
      <Sequence from={348} durationInFrames={108}>
        <Beat3 dur={108} />
      </Sequence>
      <Sequence from={449} durationInFrames={187}>
        <Beat4 dur={187} />
      </Sequence>
      <Sequence from={620} durationInFrames={230}>
        <Beat5 dur={230} />
      </Sequence>
    </AbsoluteFill>
  );
}
