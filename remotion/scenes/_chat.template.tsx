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
// Apify "Claude chat" GIF engine — content-driven. A user prompt bubble types
// in (per-character), the assistant response is typed out as a TRUE typewriter
// (character by character) whose speed follows a spike-then-decay velocity
// curve, auto-scrolling to follow the caret, then the view scrolls straight
// into an Apify wordmark end card (no fade) which settles with a spring.
//
// This file is a TEMPLATE: the CONTENT and font/logo base64 placeholders are
// filled in by scripts/build-chat-gifs.cjs to produce a self-contained scene
// per use case. Laid out in a 1222px reference space, scaled to fill.
// ============================================================================

const CONTENT = __CONTENT__;
const NO_OUTRO = CONTENT.noOutro === true; // when set, skip the Apify wordmark end card

export const fps = 25;
// 15s normally (2s bubble + 8s response + 2s scroll-in + 3s logo); ~11s with no outro
export const durationInFrames = NO_OUTRO ? 275 : 375;

// ---- palette ----
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

// ---- reference pixel space ----
const REF_W = 1222;
const PAD_L = 43;
const PAD_R = 28;
const INNER = REF_W - PAD_L - PAD_R; // 1151
const RESPONSE_TOP = 90;
const DOC_H = 2200; // fallback only — real layout is measured at runtime

// ---- fonts + logos embedded as data URIs (filled by the build script) ----
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

if (typeof document !== "undefined") {
  const w = window as unknown as { __amz_fonts?: boolean };
  if (!w.__amz_fonts) {
    w.__amz_fonts = true;
    try {
      const handle = delayRender("Loading chat fonts");
      const faces = [
        new FontFace("AmzInter", `url(data:font/woff2;base64,${INTER_B64})`, { weight: "100 900", style: "normal", display: "block" as FontDisplay }),
        new FontFace("AmzMono", `url(data:font/woff2;base64,${MONO_B64})`, { weight: "100 700", style: "normal", display: "block" as FontDisplay }),
      ];
      Promise.all(faces.map((f) => f.load().then((ff) => (document.fonts as FontFaceSet).add(ff))))
        .catch(() => undefined)
        .finally(() => continueRender(handle));
    } catch {
      // outside a render context — CSS @font-face still applies
    }
  }
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ---- spike-then-decay reveal easing (fast burst, long ease-out) ----
function revVel(u: number): number {
  const RAMP = 0.1;
  const s = u < RAMP ? u / RAMP : 1;
  const ramp = s * s * (3 - 2 * s);
  const decay = Math.exp(-3.6 * Math.max(0, u - RAMP));
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

// ---- content ----
type Run = { t: string; b?: boolean; l?: boolean; c?: boolean; i?: boolean };
type Block =
  | { type: "p"; runs: Run[] }
  | { type: "bq"; runs: Run[] }
  | { type: "h1"; runs: Run[] }
  | { type: "h2"; runs: Run[] }
  | { type: "ul"; items: Run[][] }
  | { type: "ol"; items: Run[][] }
  | { type: "table"; cols?: number[]; nowrap?: number[]; header: Run[][]; rows: Run[][][] };
type ChatContent = { bubble: string; blocks: Block[] };

const BLOCKS: Block[] = CONTENT.blocks;

// ---- per-block character counts ----
const runsLen = (runs: Run[]) => runs.reduce((a, r) => a + [...r.t].length, 0);
function blockChars(b: Block): number {
  switch (b.type) {
    case "p":
    case "bq":
    case "h1":
    case "h2":
      return runsLen(b.runs);
    case "ul":
    case "ol":
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
const pillStyle: React.CSSProperties = { fontFamily: F_MONO, fontSize: 18, padding: "1px 8px 3px", borderRadius: 7, whiteSpace: "nowrap", lineHeight: 1 };
const pStyle: React.CSSProperties = { margin: "0 0 26px 0", fontSize: 21, lineHeight: "30px", fontFamily: F_BODY, color: C.fg };
const bqStyle: React.CSSProperties = { margin: "0 0 26px 62px", borderLeft: `3px solid ${C.border}`, padding: "1px 0 1px 26px", fontSize: 21, lineHeight: "30px", fontFamily: F_BODY, color: C.muted };
const h1Style: React.CSSProperties = { margin: "18px 0 14px 0", fontSize: 36, fontWeight: 700, lineHeight: 1.25, fontFamily: F_BODY, color: C.fg };
const h2Style: React.CSSProperties = { margin: "26px 0 12px 0", fontSize: 28, fontWeight: 700, lineHeight: 1.25, fontFamily: F_BODY, color: C.fg };
const cellBase: React.CSSProperties = { padding: "20px 22px", textAlign: "left", fontSize: 21, lineHeight: "29px", fontFamily: F_BODY, color: C.fg };

// ---- typewriter renderer ----
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
        <code key={`${key}-${ri}`} style={{ ...pillStyle, border: `1px solid rgba(${C.borderRGB},${a})`, background: `rgba(31,33,35,${a})` }}>
          {chars}
        </code>
      );
    }
    const st: React.CSSProperties = {};
    if (r.b) st.fontWeight = 700;
    if (r.l) st.color = C.link;
    if (r.i) st.fontStyle = "italic";
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
                style={{ position: "relative", paddingLeft: 34, fontSize: 21, lineHeight: "30px", fontFamily: F_BODY, color: C.fg, marginBottom: ii === b.items.length - 1 ? 0 : 10 }}
              >
                <span style={{ position: "absolute", left: 13, top: 12, width: 7, height: 7, borderRadius: "50%", background: C.fg, opacity: ba }} />
                {revealRuns(item, ctr, charsShown, `b${bi}-li${ii}`)}
              </li>
            );
          })}
        </ul>
      );
    case "ol":
      return (
        <ol key={bi} style={{ margin: "0 0 26px 0", padding: 0, listStyle: "none" }} {...dataBlk}>
          {b.items.map((item, ii) => {
            const start = ctr.i;
            const na = clamp01((charsShown - start) * 1.4);
            return (
              <li
                key={ii}
                style={{ position: "relative", paddingLeft: 48, fontSize: 21, lineHeight: "30px", fontFamily: F_BODY, color: C.fg, marginBottom: ii === b.items.length - 1 ? 0 : 14 }}
              >
                <span style={{ position: "absolute", left: 8, top: 0, opacity: na, fontVariantNumeric: "tabular-nums" }}>{ii + 1}.</span>
                {revealRuns(item, ctr, charsShown, `b${bi}-ol${ii}`)}
              </li>
            );
          })}
        </ol>
      );
    case "table": {
      const fixed = Array.isArray(b.cols) && b.cols.length > 0;
      const nowrap = b.nowrap || [];
      const aH = clamp01((charsShown - BLOCK_START[bi]) / 10);
      const headerCells = b.header.map((h, ci) => (
        <th key={ci} style={{ ...cellBase, border: `1px solid rgba(${C.borderRGB},${aH})`, verticalAlign: "top", fontWeight: 700, ...(nowrap.includes(ci) ? { whiteSpace: "nowrap" } : null) }}>
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
              <td key={ci} style={{ ...cellBase, border: `1px solid rgba(${C.borderRGB},${aR})`, verticalAlign: "middle", ...(nowrap.includes(ci) ? { whiteSpace: "nowrap" } : null) }}>
                {nodes}
              </td>
            ))}
          </tr>
        );
      });
      return (
        <table key={bi} style={{ borderCollapse: "collapse", width: INNER, tableLayout: fixed ? "fixed" : "auto", margin: "0 0 8px 0" }} {...dataBlk}>
          {fixed ? (
            <colgroup>
              {b.cols!.map((w, ci) => (
                <col key={ci} style={{ width: w }} />
              ))}
            </colgroup>
          ) : null}
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

// ---- user bubble ----
const BUBBLE_TEXT = CONTENT.bubble;
const BUBBLE_CHARS = [...BUBBLE_TEXT];

const Bubble: React.FC<{ shown: number; enter?: number }> = ({ shown, enter = 1 }) => {
  const chars = BUBBLE_CHARS.length * shown;
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", width: INNER }}>
      <div
        style={{ display: "inline-flex", alignItems: "center", gap: 16, maxWidth: INNER, background: C.bubble, borderRadius: 22, padding: "13px 24px 13px 16px", opacity: enter, transform: `translateY(${(1 - enter) * 14}px)` }}
      >
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#fff", flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
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

// ---- Apify wordmark end card ----
const ENDCARD_LOGO_W = 470;
const EndCard: React.FC<{ scale: number; height: number }> = ({ scale, height }) => (
  <div data-endcard="1" style={{ height, display: "flex", alignItems: "center", justifyContent: "center", width: REF_W }}>
    <img src={`data:image/svg+xml;base64,${WORDMARK_B64}`} alt="Apify" style={{ width: ENDCARD_LOGO_W, height: (ENDCARD_LOGO_W * 141) / 512, transform: `scale(${scale})` }} />
  </div>
);

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

const F_TYPE_A = 50;
const F_TYPE_B = 235;
const F_OUT_A = 250;
const F_OUT_B = 300;

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
      ENDCARD_TOP = ec ? ec.offsetTop : root.scrollHeight;
      force((x) => x + 1);
    }
  }, []);
  useEffect(() => {
    if (handle !== -1) continueRender(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bubbleIn = interpolate(frame, [0, 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const bubbleType = interpolate(frame, [12, 46], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const typeT = interpolate(frame, [F_TYPE_A, F_TYPE_B], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const charsShown = TOTAL_CHARS * easeSpike(typeT) + 0.001;

  const endcardTop = ENDCARD_TOP ?? DOC_H;
  // Keep the typing caret a fixed distance from the bottom so the content fills
  // the whole frame as it scrolls (matters most on the tall 1:1 square).
  const target = Math.max(viewRaw - 240, viewRaw * 0.5);
  const respMax = Math.max(0, endcardTop - viewRaw);
  const typeScroll = Math.min(Math.max(frontierY(charsShown) - target, 0), respMax);
  const outroT = interpolate(frame, [F_OUT_A, F_OUT_B], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const scrollRaw = frame <= F_OUT_A || NO_OUTRO ? typeScroll : lerp(typeScroll, endcardTop, outroT);

  const logoScale = interpolate(spring({ frame: frame - 264, fps, config: { damping: 18, stiffness: 110, mass: 0.9 } }), [0, 1], [0.82, 1]);

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
          {!NO_OUTRO && <EndCard scale={logoScale} height={viewRaw} />}
        </div>
      </div>
    </AbsoluteFill>
  );
};

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
