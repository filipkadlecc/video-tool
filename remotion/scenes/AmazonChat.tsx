import React, { useRef, useState, useEffect, useLayoutEffect } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
  delayRender,
  continueRender,
} from "remotion";

// ============================================================================
// "Track my competitor's prices on Amazon" — a Claude chat response recreated
// 1:1 from two reference screenshots (stitched top-to-bottom) on Apify's dark
// palette, then animated:
//   • 0–2s  the user bubble appears and types the prompt (one letter at a time)
//   • 2–10s the whole response is typed out — a TRUE typewriter (character by
//           character) whose speed follows a spike-then-decay velocity curve
//           (fast burst, long ease-out), auto-scrolling to follow the caret
//   • 10–12s the view keeps scrolling straight into an Apify wordmark end card
//           (no fade — one continuous motion), which settles with a spring.
//
// The document is laid out in the reference's native 1222px pixel space (so
// fonts, weights, spacing, table widths and wrapping match) and scaled to fill
// the frame width.
// ============================================================================

export const fps = 25;
export const durationInFrames = 375; // 15s = 2s bubble + 8s response + 2s scroll-in + 3s logo hold

// ---- palette (sampled from the reference) ----
const C = {
  bg: "#161718",
  fg: "#F4F4F5",
  muted: "#B9BABE",
  link: "#7B9DF9",
  border: "#3E3F43",
  borderRGB: "62,63,67",
  pill: "#1F2123",
  bubble: "#242528",
};

// ---- reference pixel space (matches the screenshots: 1222px wide) ----
const REF_W = 1222;
const PAD_L = 43;
const PAD_R = 28;
const INNER = REF_W - PAD_L - PAD_R; // 1151

// Height of the bubble area above the assistant response (raw px).
const RESPONSE_TOP = 90;
// Full rendered response-document height (raw px) — measured from a still.
const DOC_H = 2620;

// ---- fonts + logos embedded as data URIs (byte-identical metrics everywhere;
// filled in by scripts/inject-amazon-fonts.js) ----
const INTER_B64 = "__INTER_B64__";
const MONO_B64 = "__MONO_B64__";
const LOGO_B64 = "__LOGO_B64__"; // colored Apify symbol (avatar)
const WORDMARK_B64 = "__WORDMARK_B64__"; // colored symbol + white "Apify" wordmark

const F_BODY = "'AmzInter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
const F_MONO = "'AmzMono',ui-monospace,'Roboto Mono',monospace";

const FONT_CSS = `
@font-face{font-family:'AmzInter';src:url(data:font/woff2;base64,${INTER_B64}) format('woff2');font-weight:100 900;font-style:normal;font-display:block;}
@font-face{font-family:'AmzMono';src:url(data:font/woff2;base64,${MONO_B64}) format('woff2');font-weight:100 700;font-style:normal;font-display:block;}
`;

// Load faces behind delayRender so the renderer waits for them before frame 0.
if (typeof document !== "undefined") {
  const w = window as unknown as { __amz_fonts?: boolean };
  if (!w.__amz_fonts) {
    w.__amz_fonts = true;
    try {
      const handle = delayRender("Loading Amazon chat fonts");
      const faces = [
        new FontFace("AmzInter", `url(data:font/woff2;base64,${INTER_B64})`, {
          weight: "100 900",
          style: "normal",
          display: "block" as FontDisplay,
        }),
        new FontFace("AmzMono", `url(data:font/woff2;base64,${MONO_B64})`, {
          weight: "100 700",
          style: "normal",
          display: "block" as FontDisplay,
        }),
      ];
      Promise.all(
        faces.map((f) => f.load().then((ff) => (document.fonts as FontFaceSet).add(ff)))
      )
        .catch(() => undefined)
        .finally(() => continueRender(handle));
    } catch {
      // outside a render context — the CSS @font-face still applies
    }
  }
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ---------------------------------------------------------------------------
// Reveal easing — a spike-then-decay velocity curve (fast burst, long ease-out)
// matching the reference graph. We define the velocity profile and integrate it
// so progress(t) is the position curve whose speed looks like the graph.
// ---------------------------------------------------------------------------
function revVel(u: number): number {
  const RAMP = 0.1;
  const s = u < RAMP ? u / RAMP : 1;
  const ramp = s * s * (3 - 2 * s); // smoothstep in to the peak
  const decay = Math.exp(-3.6 * Math.max(0, u - RAMP)); // long exponential tail
  return ramp * (0.09 + 0.91 * decay);
}
const SPIKE_N = 240;
const SPIKE_FULL = (() => {
  let a = 0;
  for (let i = 0; i < SPIKE_N; i++) a += revVel((i + 0.5) / SPIKE_N);
  return a;
})();
function easeSpike(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const m = Math.round(t * SPIKE_N);
  let a = 0;
  for (let i = 0; i < m; i++) a += revVel((i + 0.5) / SPIKE_N);
  return a / SPIKE_FULL;
}

// ---------------------------------------------------------------------------
// content model
// ---------------------------------------------------------------------------
type Run = { t: string; b?: boolean; l?: boolean; c?: boolean };
const t = (s: string): Run[] => [{ t: s }];

type Block =
  | { type: "p"; runs: Run[] }
  | { type: "bq"; runs: Run[] }
  | { type: "h1"; runs: Run[] }
  | { type: "h2"; runs: Run[] }
  | { type: "ul"; items: Run[][] }
  | { type: "table"; cols: number[]; header: Run[][]; rows: Run[][][] };

const TABLE1_COLS = [346, 124, 125, 134, 111, 128, 183];
const TABLE2_COLS = [294, 110, 120, 220, 108, 124, 175];
const HEADER: Run[][] = [
  t("Product"),
  t("Price"),
  t("Original"),
  t("Discount"),
  t("Rating"),
  t("Reviews"),
  t("Monthly Sales"),
];

const BLOCKS: Block[] = [
  { type: "p", runs: t("Let me first find the best Actor for Amazon price tracking!") },
  {
    type: "p",
    runs: [
      { t: "I’ll use the " },
      { t: "Amazon Product Scraper - Prices, ASIN, BSR & Reviews", b: true },
      { t: " by " },
      { t: "harvestlab", c: true },
      {
        t: " — it has the most comprehensive data (prices, ratings, reviews, BSR, availability, sellers, images) and supports competitor monitoring. I’ll search for 10 random popular product categories and get 20 products total (2 per keyword).",
      },
    ],
  },
  {
    type: "bq",
    runs: [
      { t: "⚠️ " },
      { t: "Heads up:", b: true },
      {
        t: " With 10 search terms × 2 products each = ~20 results. This is a small, affordable run. Let’s go!",
      },
    ],
  },
  {
    type: "p",
    runs: [
      { t: "That Actor failed. Let me try the next best option — " },
      { t: "Amazon Product Scraper — Price, Rating, Seller & ASIN Data", b: true },
      { t: " by " },
      { t: "jaybird", c: true },
      { t: ", which has a 98.6% success rate!" },
    ],
  },
  {
    type: "p",
    runs: [
      { t: "This Actor requires direct Amazon product URLs. Let me use the " },
      { t: "thirdwatch", b: true },
      { t: " Actor instead, which supports keyword searches and has a 100% success rate!" },
    ],
  },
  { type: "p", runs: t('The country value needs to be "us" (not "US"). Let me fix that:') },
  { type: "p", runs: t("Got 16 results! Let me fetch the full dataset now.") },
  {
    type: "p",
    runs: t("Here’s a summary of the competitor price tracking data scraped from Amazon! 🛒"),
  },
  { type: "h1", runs: t("📊 Amazon Competitor Price Tracker Results") },
  { type: "h2", runs: t("🎧 Wireless Earbuds (Top Picks)") },
  {
    type: "table",
    cols: TABLE1_COLS,
    header: HEADER,
    rows: [
      [t("Budget BT 5.4 Earbuds (Generic)"), t("$9.99"), t("$13.99"), t("29%"), t("⭐ 4.4"), t("1.1K"), t("500+")],
      [t("TOZO A1"), t("$13.99"), t("$19.99"), t("30%"), t("⭐ 4.3"), t("115.8K"), t("10K+")],
      [t("Soundcore by Anker P20i"), t("$19.99"), t("$39.99"), [{ t: "50%", b: true }], t("⭐ 4.4"), t("111.4K"), t("10K+")],
      [t("Samsung Galaxy Buds Core"), t("$42.72"), t("$49.95"), t("14%"), t("⭐ 4.4"), t("1.3K"), t("9K+")],
      [t("Apple AirPods 4"), t("$99.00"), t("$129.00"), t("23%"), t("⭐ 4.6"), t("32.2K"), t("10K+")],
      [t("Apple AirPods 4 (ANC)"), t("$144.99"), t("$179.00"), t("19%"), t("⭐ 4.6"), t("22.5K"), t("10K+")],
      [t("Apple AirPods Pro 3"), t("$199.99"), t("$249.00"), t("20%"), t("⭐ 4.5"), t("12.1K"), t("10K+")],
      [t("JBL Vibe Beam 2"), t("N/A"), t("N/A"), t("—"), t("⭐ 4.2"), t("6.1K"), t("10K+")],
    ],
  },
  {
    type: "bq",
    runs: t(
      '⚠️ Note: Several budget earbuds showed suspicious discounts (84–90% off inflated "original" prices) — common Amazon pricing tactics to watch out for!'
    ),
  },
  { type: "h2", runs: t("💻 Laptop Stands (Top Picks)") },
  {
    type: "table",
    cols: TABLE2_COLS,
    header: HEADER,
    rows: [
      [t("Nulaxy Ergonomic Stand"), t("$15.99"), t("$19.99"), [{ t: "20%", b: true }, { t: " 🏆 Overall Pick" }], t("⭐ 4.8"), t("16.6K"), t("2K+")],
      [t("Lamicall Adjustable Stand"), t("$32.99"), t("$35.99"), t("8%"), t("⭐ 4.7"), t("10.3K"), t("6K+")],
      [t("LOXP 360° Rotating Stand"), t("$27.99"), t("$31.99"), t("12%"), t("⭐ 4.6"), t("2.2K"), t("6K+")],
      [t("JOYEKY 360° Rotating Stand"), t("$35.98"), t("—"), t("—"), t("⭐ 4.7"), t("2.8K"), t("1K+")],
    ],
  },
  { type: "h2", runs: t("🔑 Key Insights") },
  {
    type: "ul",
    items: [
      [{ t: "Most competitive category:", b: true }, { t: " Wireless earbuds — massive price range from $9.99 to $199.99" }],
      [{ t: "Best value earbuds:", b: true }, { t: " Soundcore by Anker P20i at $19.99 (50% off, 111K reviews)" }],
      [{ t: "Best-seller badge winner:", b: true }, { t: " Apple AirPods 4 & TOZO A1 (both dominate in their segments)" }],
      [{ t: "Laptop stands:", b: true }, { t: " Very stable pricing with low discounts (8–20%)" }],
    ],
  },
  {
    type: "p",
    runs: [
      { t: "📔 " },
      { t: "Full dataset:", b: true },
      { t: " " },
      { t: "View on Apify Console", l: true },
      { t: " 🔗 " },
      { t: "Actor run details:", b: true },
      { t: " " },
      { t: "View run", l: true },
    ],
  },
];

// ---- per-block character counts (for the typewriter + caret-following scroll) ----
const runsLen = (runs: Run[]) => runs.reduce((a, r) => a + [...r.t].length, 0);
function blockChars(b: Block): number {
  switch (b.type) {
    case "p":
    case "bq":
    case "h1":
    case "h2":
      return runsLen(b.runs);
    case "ul":
      return b.items.reduce((a, it) => a + runsLen(it), 0);
    case "table": {
      let n = b.header.reduce((a, c) => a + runsLen(c), 0);
      for (const row of b.rows) for (const cell of row) n += runsLen(cell);
      return n;
    }
  }
}
const BLOCK_CHARS = BLOCKS.map(blockChars);
const BLOCK_START: number[] = (() => {
  const out: number[] = [];
  let acc = 0;
  for (const c of BLOCK_CHARS) {
    out.push(acc);
    acc += c;
  }
  return out;
})();
const TOTAL_CHARS = BLOCK_CHARS.reduce((a, c) => a + c, 0);

// ---- styling ----
const pillStyle: React.CSSProperties = {
  fontFamily: F_MONO,
  fontSize: 18,
  padding: "1px 8px 3px",
  borderRadius: 7,
  whiteSpace: "nowrap",
  lineHeight: 1,
};
const pStyle: React.CSSProperties = { margin: "0 0 26px 0", fontSize: 21, lineHeight: "30px", fontFamily: F_BODY, color: C.fg };
const bqStyle: React.CSSProperties = {
  margin: "0 0 26px 62px",
  borderLeft: `3px solid ${C.border}`,
  padding: "1px 0 1px 26px",
  fontSize: 21,
  lineHeight: "30px",
  fontFamily: F_BODY,
  color: C.muted,
};
const h1Style: React.CSSProperties = { margin: "18px 0 14px 0", fontSize: 36, fontWeight: 700, lineHeight: 1.25, fontFamily: F_BODY, color: C.fg };
const h2Style: React.CSSProperties = { margin: "26px 0 12px 0", fontSize: 28, fontWeight: 700, lineHeight: 1.25, fontFamily: F_BODY, color: C.fg };
const cellBase: React.CSSProperties = { padding: "25px 26px", textAlign: "left", fontSize: 21, lineHeight: "29px", fontFamily: F_BODY, color: C.fg };

// ---------------------------------------------------------------------------
// typewriter renderer — walks the document in reading order with a shared
// character counter, revealing each glyph as `charsShown` passes its index.
// ---------------------------------------------------------------------------
type Ctr = { i: number };

function revealRuns(runs: Run[], ctr: Ctr, charsShown: number, key: string): React.ReactNode[] {
  return runs.map((r, ri) => {
    const first = ctr.i;
    const chars = [...r.t].map((ch, ci) => {
      const gi = ctr.i++;
      return (
        <span key={ci} style={{ opacity: clamp01((charsShown - gi) * 1.4) }}>
          {ch}
        </span>
      );
    });
    if (r.c) {
      const a = clamp01(charsShown - first);
      return (
        <code
          key={`${key}-${ri}`}
          style={{ ...pillStyle, border: `1px solid rgba(${C.borderRGB},${a})`, background: `rgba(31,33,35,${a})` }}
        >
          {chars}
        </code>
      );
    }
    const st: React.CSSProperties = {};
    if (r.b) st.fontWeight = 700;
    if (r.l) st.color = C.link;
    return (
      <span key={`${key}-${ri}`} style={st}>
        {chars}
      </span>
    );
  });
}

function renderBlock(b: Block, bi: number, ctr: Ctr, charsShown: number): React.ReactNode {
  const dataBlk = { "data-blk": String(bi) } as Record<string, string>;
  switch (b.type) {
    case "p":
      return (
        <p key={bi} style={pStyle} {...dataBlk}>
          {revealRuns(b.runs, ctr, charsShown, `b${bi}`)}
        </p>
      );
    case "bq": {
      const a = clamp01((charsShown - BLOCK_START[bi]) / 10);
      return (
        <div key={bi} style={{ ...bqStyle, borderLeft: `3px solid rgba(${C.borderRGB},${a})` }} {...dataBlk}>
          {revealRuns(b.runs, ctr, charsShown, `b${bi}`)}
        </div>
      );
    }
    case "h1":
      return (
        <div key={bi} style={h1Style} {...dataBlk}>
          {revealRuns(b.runs, ctr, charsShown, `b${bi}`)}
        </div>
      );
    case "h2":
      return (
        <div key={bi} style={h2Style} {...dataBlk}>
          {revealRuns(b.runs, ctr, charsShown, `b${bi}`)}
        </div>
      );
    case "ul":
      return (
        <ul key={bi} style={{ margin: "0 0 26px 0", padding: 0, listStyle: "none" }} {...dataBlk}>
          {b.items.map((item, ii) => {
            const start = ctr.i;
            const ba = clamp01((charsShown - start) * 1.4);
            return (
              <li
                key={ii}
                style={{
                  position: "relative",
                  paddingLeft: 34,
                  fontSize: 21,
                  lineHeight: "30px",
                  fontFamily: F_BODY,
                  color: C.fg,
                  marginBottom: ii === b.items.length - 1 ? 0 : 10,
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    left: 13,
                    top: 12,
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: C.fg,
                    opacity: ba,
                  }}
                />
                {revealRuns(item, ctr, charsShown, `b${bi}-li${ii}`)}
              </li>
            );
          })}
        </ul>
      );
    case "table": {
      // grid lines draw in row-by-row as each row is typed
      const aH = clamp01((charsShown - BLOCK_START[bi]) / 10);
      const headerCells = b.header.map((h, ci) => (
        <th key={ci} style={{ ...cellBase, border: `1px solid rgba(${C.borderRGB},${aH})`, verticalAlign: "top", fontWeight: 700 }}>
          {revealRuns(h, ctr, charsShown, `b${bi}-h${ci}`)}
        </th>
      ));
      const bodyRows = b.rows.map((row, ri) => {
        const rowStart = ctr.i;
        const cellNodes = row.map((cell, ci) => ({ ci, nodes: revealRuns(cell, ctr, charsShown, `b${bi}-r${ri}c${ci}`) }));
        const aR = clamp01((charsShown - rowStart) / 8);
        return (
          <tr key={ri}>
            {cellNodes.map(({ ci, nodes }) => (
              <td
                key={ci}
                style={{ ...cellBase, border: `1px solid rgba(${C.borderRGB},${aR})`, verticalAlign: "middle", ...(ci === 4 ? { whiteSpace: "nowrap" } : null) }}
              >
                {nodes}
              </td>
            ))}
          </tr>
        );
      });
      return (
        <table
          key={bi}
          style={{ borderCollapse: "collapse", width: INNER, tableLayout: "fixed", margin: "0 0 8px 0" }}
          {...dataBlk}
        >
          <colgroup>
            {b.cols.map((w, ci) => (
              <col key={ci} style={{ width: w }} />
            ))}
          </colgroup>
          <thead>
            <tr>{headerCells}</tr>
          </thead>
          <tbody>{bodyRows}</tbody>
        </table>
      );
    }
  }
}

function renderResponse(charsShown: number): React.ReactNode[] {
  const ctr: Ctr = { i: 0 };
  return BLOCKS.map((b, bi) => renderBlock(b, bi, ctr, charsShown));
}

// ---- user bubble (top-right); `shown` = char-typing fraction, `enter` = entrance ----
const BUBBLE_TEXT = "Track my competitor’s prices on Amazon.";
const BUBBLE_CHARS = [...BUBBLE_TEXT];

const Bubble: React.FC<{ shown: number; enter?: number }> = ({ shown, enter = 1 }) => {
  const chars = BUBBLE_CHARS.length * shown;
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", width: INNER }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 16,
          maxWidth: INNER,
          background: C.bubble,
          borderRadius: 22,
          padding: "13px 24px 13px 16px",
          opacity: enter,
          transform: `translateY(${(1 - enter) * 14}px)`,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "#fff",
            flex: "0 0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          <img src={`data:image/svg+xml;base64,${LOGO_B64}`} alt="Apify" style={{ width: 28, height: 28, display: "block" }} />
        </div>
        <span style={{ fontFamily: F_BODY, fontSize: 22, lineHeight: "30px", color: C.fg, whiteSpace: "nowrap" }}>
          {BUBBLE_CHARS.map((ch, i) => (
            <span key={i} style={{ opacity: clamp01((chars - i) * 1.3) }}>
              {ch}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
};

// ---- Apify wordmark end card (colored symbol + white "Apify") ----
const ENDCARD_LOGO_W = 470; // raw px
const EndCard: React.FC<{ scale: number; height: number }> = ({ scale, height }) => (
  <div
    data-endcard="1"
    style={{ height, display: "flex", alignItems: "center", justifyContent: "center", width: REF_W }}
  >
    <img
      src={`data:image/svg+xml;base64,${WORDMARK_B64}`}
      alt="Apify"
      style={{ width: ENDCARD_LOGO_W, height: (ENDCARD_LOGO_W * 141) / 512, transform: `scale(${scale})` }}
    />
  </div>
);

// module-level layout cache (measured once, reused across frames / render workers)
let BLOCK_LAYOUT: { top: number; height: number }[] | null = null;
let ENDCARD_TOP: number | null = null;

function frontierY(charsShown: number): number {
  if (!BLOCK_LAYOUT) return RESPONSE_TOP + (charsShown / TOTAL_CHARS) * (DOC_H - RESPONSE_TOP);
  for (let i = 0; i < BLOCKS.length; i++) {
    const cs = BLOCK_START[i];
    const ce = cs + BLOCK_CHARS[i];
    if (charsShown < ce || i === BLOCKS.length - 1) {
      const b = BLOCK_LAYOUT[i] || { top: 0, height: 0 };
      const frac = BLOCK_CHARS[i] > 0 ? clamp01((charsShown - cs) / BLOCK_CHARS[i]) : 1;
      return b.top + frac * b.height;
    }
  }
  return DOC_H;
}

// timeline
const F_TYPE_A = 50;
const F_TYPE_B = 235; // typewriter runs 50→235, then holds to 250
const F_OUT_A = 250;
const F_OUT_B = 300; // scroll into the end card

const Scene: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const S = width / REF_W;
  const viewRaw = height / S;

  const docRef = useRef<HTMLDivElement>(null);
  const [handle] = useState(() => (BLOCK_LAYOUT ? -1 : delayRender("measure chat layout")));
  const [, force] = useState(0);

  useLayoutEffect(() => {
    if (!BLOCK_LAYOUT && docRef.current) {
      const root = docRef.current;
      const els = Array.from(root.querySelectorAll("[data-blk]")) as HTMLElement[];
      BLOCK_LAYOUT = els.map((el) => ({ top: el.offsetTop, height: el.offsetHeight }));
      const ec = root.querySelector("[data-endcard]") as HTMLElement | null;
      ENDCARD_TOP = ec ? ec.offsetTop : DOC_H;
      force((x) => x + 1);
    }
  }, []);
  useEffect(() => {
    if (handle !== -1) continueRender(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // phase 1 — bubble
  const bubbleIn = interpolate(frame, [0, 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const bubbleType = interpolate(frame, [12, 46], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // phase 2 — typewriter (spike-decay curve)
  const typeT = interpolate(frame, [F_TYPE_A, F_TYPE_B], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const charsShown = TOTAL_CHARS * easeSpike(typeT) + 0.001;

  // scroll that follows the caret; then continues into the end card (no fade)
  const endcardTop = ENDCARD_TOP ?? DOC_H;
  // Keep the typing caret a fixed distance from the bottom so the content fills
  // the whole frame as it scrolls (matters most on the tall 1:1 square).
  const target = Math.max(viewRaw - 240, viewRaw * 0.5);
  const respMax = Math.max(0, endcardTop - viewRaw);
  const typeScroll = Math.min(Math.max(frontierY(charsShown) - target, 0), respMax);
  const outroT = interpolate(frame, [F_OUT_A, F_OUT_B], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const scrollRaw = frame <= F_OUT_A ? typeScroll : lerp(typeScroll, endcardTop, outroT);

  // end-card logo settle (scale only — no fade)
  const logoScale = interpolate(
    spring({ frame: frame - 264, fps, config: { damping: 18, stiffness: 110, mass: 0.9 } }),
    [0, 1],
    [0.82, 1]
  );

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <style>{FONT_CSS}</style>
      <div style={{ position: "absolute", top: 0, left: 0, transformOrigin: "top left", transform: `scale(${S})` }}>
        <div ref={docRef} style={{ position: "relative", width: REF_W, transform: `translateY(${-scrollRaw}px)` }}>
          <div style={{ padding: `20px ${PAD_R}px 0 ${PAD_L}px`, boxSizing: "border-box", width: REF_W }}>
            <Bubble shown={bubbleType} enter={bubbleIn} />
          </div>
          <div style={{ padding: `40px ${PAD_R}px 60px ${PAD_L}px`, boxSizing: "border-box", width: REF_W }}>
            {renderResponse(charsShown)}
          </div>
          <EndCard scale={logoScale} height={viewRaw} />

        </div>
      </div>
    </AbsoluteFill>
  );
};

// Full document, fully revealed, for pixel calibration against the screenshots.
export const CalibrationDoc: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: C.bg }}>
    <style>{FONT_CSS}</style>
    <div style={{ width: REF_W }}>
      <div style={{ padding: `20px ${PAD_R}px 0 ${PAD_L}px`, boxSizing: "border-box", width: REF_W }}>
        <Bubble shown={1} />
      </div>
      <div style={{ padding: `40px ${PAD_R}px 60px ${PAD_L}px`, boxSizing: "border-box", width: REF_W }}>
        {renderResponse(TOTAL_CHARS + 50)}
      </div>
    </div>
  </AbsoluteFill>
);

export default Scene;
