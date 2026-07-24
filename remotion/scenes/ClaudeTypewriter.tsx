import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
  delayRender,
  continueRender,
} from "remotion";

// ============================================================================
// Claude chat response — recreated 1:1 (Inter Regular / Bold, code pills, blue
// link, bullet dots) and revealed as a fast typewriter. The layout is fixed at
// the reference's native 2036px width (so wrapping, weights, spacing and pills
// match the source pixel-for-pixel) and the whole block is scaled to fill 4K.
// Text "writes" in over 1.5s, then holds.
// ============================================================================

export const fps = 25;
export const durationInFrames = 100; // 1.5s typing + hold (4s total)

const TYPE_SECONDS = 1.5;

// ---- source pixel space (matches the reference image exactly) ----
const REF_W = 2036; // reference width the layout was calibrated against
const PAD_X = 60; // left/right padding -> content width 1916 (identical wrap)

// ---- colours sampled from the reference ----
const C = {
  bg: "#161718",
  fg: "#F4F4F5",
  link: "#7B9DF9",
  pillBg: "31, 33, 35", // rgb, alpha applied on reveal
  pillBorder: "62, 63, 67",
};

// Uniquely-named faces from the exact files the recreation was calibrated
// against — so the body font is true Inter Regular/Bold (not the app preview's
// "Inter" alias, which is SemiBold 24pt) in BOTH the browser preview and render.
const FONT_BODY = "'CTWInter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const FONT_MONO = "'CTWMono', ui-monospace, 'Roboto Mono', monospace";

// @font-face injected as CSS (covers the browser preview / Player).
const FONT_FACE_CSS = `
@font-face {
  font-family: 'CTWInter';
  src: url('/fonts/Inter-Variable.woff2') format('woff2');
  font-weight: 100 900; font-style: normal; font-display: block;
}
@font-face {
  font-family: 'CTWMono';
  src: url('/fonts/RobotoMono-Variable.woff2') format('woff2');
  font-weight: 100 700; font-style: normal; font-display: block;
}
`;

// Load both faces behind delayRender so the RENDERER waits for them before
// capturing frame 0 (CSS @font-face alone falls back to serif on early frames).
// Wrapped defensively so it is a no-op if called outside a render context.
if (typeof document !== "undefined") {
  const w = window as unknown as { __ctw_fonts?: boolean };
  if (!w.__ctw_fonts) {
    w.__ctw_fonts = true;
    try {
      const handle = delayRender("Loading CTW fonts (Inter + Roboto Mono)");
      const faces = [
        new FontFace("CTWInter", `url(${staticFile("fonts/Inter-Variable.woff2")})`, {
          style: "normal",
          weight: "100 900",
          display: "block" as FontDisplay,
        }),
        new FontFace("CTWMono", `url(${staticFile("fonts/RobotoMono-Variable.woff2")})`, {
          style: "normal",
          weight: "100 700",
          display: "block" as FontDisplay,
        }),
      ];
      Promise.all(
        faces.map((f) => f.load().then((ff) => (document.fonts as FontFaceSet).add(ff)))
      )
        .catch(() => undefined)
        .finally(() => continueRender(handle));
    } catch {
      // outside a render context — the CSS @font-face above still applies
    }
  }
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

// ---- content model -----------------------------------------------------------
// kind: n = normal, b = bold, l = link, c = code pill
type Run = { k: "n" | "b" | "l" | "c"; t: string };
type Block =
  | { type: "p"; mb: number; runs: Run[] }
  | { type: "ul"; mb: number; items: Run[][] };

const BLOCKS: Block[] = [
  {
    type: "p",
    mb: 40,
    runs: [
      {
        k: "n",
        t: "I can help you find real estate agencies in Miami to pitch your web design services! To do this, I'll search for a Google Maps or business directory scraper that can pull up real estate agencies in Miami.",
      },
    ],
  },
  { type: "p", mb: 80, runs: [{ k: "n", t: "Let me find the right Actor for this." }] },
  {
    type: "p",
    mb: 40,
    runs: [
      { k: "n", t: "The " },
      { k: "b", t: "Google Maps Business Leads Scraper" },
      { k: "n", t: " by " },
      { k: "c", t: "lurkapi" },
      {
        k: "n",
        t: " stands out as the best fit for your use case — it scrapes business listings and enriches them with ",
      },
      { k: "b", t: "emails, phone numbers, and social profiles" },
      {
        k: "n",
        t: ", which is exactly what you need for outreach. It has a 4.64/5 rating and 1,320 users.",
      },
    ],
  },
  { type: "p", mb: 40, runs: [{ k: "n", t: "Here's what I'd like to run for you:" }] },
  {
    type: "ul",
    mb: 40,
    items: [
      [{ k: "b", t: "Actor:" }, { k: "n", t: " " }, { k: "l", t: "Google Maps Business Leads Scraper" }],
      [{ k: "b", t: "Search term:" }, { k: "n", t: " " }, { k: "c", t: "real estate agency" }],
      [{ k: "b", t: "Location:" }, { k: "n", t: " " }, { k: "c", t: "Miami, FL" }],
      [{ k: "b", t: "Max results:" }, { k: "n", t: " 10 agencies (a good starting sample)" }],
      [{ k: "b", t: "With email & phone enrichment" }, { k: "n", t: " enabled" }],
    ],
  },
  {
    type: "p",
    mb: 0,
    runs: [
      {
        k: "n",
        t: "This will give you a list of real estate agencies in Miami with their contact details so you can start pitching. Shall I go ahead and run it?",
      },
    ],
  },
];

const totalChars = BLOCKS.reduce((acc, b) => {
  const runs = b.type === "p" ? b.runs : b.items.flat();
  return acc + runs.reduce((a, r) => a + [...r.t].length, 0);
}, 0);

// ---- styling per run kind ----
function runStyle(k: Run["k"]): React.CSSProperties {
  switch (k) {
    case "b":
      return { fontWeight: 700 };
    case "l":
      return { color: C.link };
    default:
      return {};
  }
}

const Scene: React.FC = () => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();

  const typeFrames = TYPE_SECONDS * fps;
  const progress = clamp01(frame / typeFrames);
  const shown = totalChars * progress; // float leading edge

  // mutable char counter across the render pass (deterministic)
  const state = { gi: 0 };

  const renderRun = (r: Run, key: string): React.ReactNode => {
    const chars: React.ReactNode[] = [];
    const localFirst = state.gi;
    [...r.t].forEach((ch, i) => {
      const gi = state.gi;
      chars.push(
        <span key={`${key}-${i}`} style={{ opacity: clamp01(shown - gi), ...runStyle(r.k) }}>
          {ch}
        </span>
      );
      state.gi += 1;
    });

    if (r.k === "c") {
      const pillOpacity = clamp01(shown - localFirst);
      return (
        <span
          key={key}
          style={{
            fontFamily: FONT_MONO,
            fontSize: 31,
            lineHeight: 1,
            whiteSpace: "nowrap",
            padding: "2px 9px",
            borderRadius: 13,
            border: "1px solid",
            borderColor: `rgba(${C.pillBorder}, ${pillOpacity})`,
            background: `rgba(${C.pillBg}, ${pillOpacity})`,
          }}
        >
          {chars}
        </span>
      );
    }
    return (
      <span key={key} style={{ fontFamily: FONT_BODY }}>
        {chars}
      </span>
    );
  };

  const blocks: React.ReactNode[] = [];
  BLOCKS.forEach((b, bi) => {
    if (b.type === "p") {
      blocks.push(
        <p
          key={`b-${bi}`}
          style={{ margin: `0 0 ${b.mb}px 0`, fontSize: 35, lineHeight: "50px", fontFamily: FONT_BODY }}
        >
          {b.runs.map((r, ri) => renderRun(r, `b-${bi}-r-${ri}`))}
        </p>
      );
    } else {
      blocks.push(
        <ul key={`b-${bi}`} style={{ listStyle: "none", margin: `0 0 ${b.mb}px 0`, padding: "0 0 0 90px" }}>
          {b.items.map((item, ii) => {
            const bulletGi = state.gi; // first char of this item
            const bulletOpacity = clamp01(shown - bulletGi);
            return (
              <li
                key={`li-${ii}`}
                style={{
                  position: "relative",
                  fontSize: 35,
                  lineHeight: "50px",
                  fontFamily: FONT_BODY,
                  marginBottom: ii === b.items.length - 1 ? 0 : 10,
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    left: -35,
                    top: 19.5,
                    width: 11,
                    height: 11,
                    borderRadius: "50%",
                    background: C.fg,
                    opacity: bulletOpacity,
                  }}
                />
                {item.map((r, ri) => renderRun(r, `b-${bi}-li-${ii}-r-${ri}`))}
              </li>
            );
          })}
        </ul>
      );
    }
  });

  const scale = width / REF_W;

  return (
    <AbsoluteFill
      style={{
        background: "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <style>{FONT_FACE_CSS}</style>
      <div
        style={{
          width: REF_W,
          padding: `0 ${PAD_X}px`,
          boxSizing: "border-box",
          transform: `scale(${scale})`,
          transformOrigin: "center center",
          color: C.fg,
          fontFamily: FONT_BODY,
          fontWeight: 400,
          WebkitFontSmoothing: "antialiased",
          textRendering: "optimizeLegibility",
        }}
      >
        {blocks}
      </div>
    </AbsoluteFill>
  );
};

export default Scene;
