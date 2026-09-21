/**
 * RUN SF ending card: generate the scene.
 *
 *   node scripts/build-run-endcard-scene.cjs
 *
 * Same cue cadence and idle beat as the end lockup, applied to the full card.
 * Each layer keeps its original markup (drop shadows, strokes, clip) and is wrapped
 * in an animated <g>; only RUN is taken apart into its 246 dots.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const FPS = 25;

// Filip's timecodes, carried over from the end lockup and extended by the same
// 4-frame cadence for the two elements this card adds.
const TC = {
  run: "00:00:25:11",
  date: "00:00:25:15",
  symbol: "00:00:25:19",
  wordmark: "00:00:25:23",
  button: "00:00:26:02",
  cursor: "00:00:27:15",    // slide starts — 22 frames before the click
  idleStart: "00:00:27:08",
  idleEnd: "00:00:28:08",
  // 00:00:03:01 into the clip: the click. Slide and click are one gesture, so the
  // cursor is not on screen at all until it comes in for it.
  click: "00:00:28:12",
};
const HOLD_AFTER_IDLE = 50;

const SWEEP_FRAMES = 19, OFF_FRAMES = 1, RECOVER = 5;

const toFrames = (t) => {
  const [h, m, s, f] = t.split(":").map(Number);
  return ((h * 60 + m) * 60 + s) * FPS + f;
};
const tc = (f) => {
  const s = Math.floor(f / FPS);
  return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60, f % FPS]
    .map((n) => String(n).padStart(2, "0")).join(":");
};

const ABS = Object.fromEntries(Object.entries(TC).map(([k, v]) => [k, toFrames(v)]));
const START = ABS.run;
const CUES = Object.fromEntries(Object.entries(ABS).map(([k, v]) => [k, v - START]));
const durationInFrames = CUES.idleEnd + HOLD_AFTER_IDLE;

const geo = JSON.parse(fs.readFileSync(path.join(ROOT, "public/assets/run-endcard/endcard.json"), "utf8"));
const DATA = JSON.stringify({
  defs: geo.defs,
  date: geo.layers.date,
  symbol: geo.layers.symbol,
  wordmark: geo.layers.wordmark,
  panel: geo.layers.panel,
  run: geo.layers.run,
  button: geo.layers.button,
  cursor: geo.layers.cursor,
});

const scene = `import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, Easing } from "remotion";
import { SPRINGS } from "../motion";

export const fps = ${FPS};
export const durationInFrames = ${durationInFrames};

// ─── CUES ────────────────────────────────────────────────────────────────────
// Clip starts at ${TC.run} (absolute frame ${START}); everything below is clip-local.
// Drop the file at that timecode and every element lands on Filip's frames.
//   RUN panel + dots  ${TC.run}   frame ${CUES.run}
//   date / venue      ${TC.date}   frame ${CUES.date}
//   Apify symbol      ${TC.symbol}   frame ${CUES.symbol}
//   apify wordmark    ${TC.wordmark}   frame ${CUES.wordmark}
//   run.apify.com     ${TC.button}   frame ${CUES.button}
//   idle beat         ${TC.idleStart} -> ${TC.idleEnd}   frames ${CUES.idleStart}-${CUES.idleEnd}
//   cursor slides in  ${TC.cursor}   frame ${CUES.cursor}   (off screen before this)
//   cursor clicks     ${TC.click}   frame ${CUES.click}   = 00:00:03:01 into the clip
const CUES = {
  run: ${CUES.run}, date: ${CUES.date}, symbol: ${CUES.symbol}, wordmark: ${CUES.wordmark},
  button: ${CUES.button}, cursor: ${CUES.cursor},
  idleStart: ${CUES.idleStart}, idleEnd: ${CUES.idleEnd}, click: ${CUES.click},
};

// The card is authored at the full 4K width, 2px short of the height, so it sits
// 1:1 with a single pixel of letterbox top and bottom. No scaling.
const VB_W = ${geo.width}, VB_H = ${geo.height};
const CANVAS_W = 3840, CANVAS_H = 2160;

const IGNITE_SPREAD = 8;   // frames for the dot wavefront to cross RUN
const TRI_STAGGER = 1.5;   // frames between symbol triangles
const LETTER_STAGGER = 2;  // frames between wordmark letters

const SWEEP_FRAMES = ${SWEEP_FRAMES};
const OFF_FRAMES = ${OFF_FRAMES};
const RECOVER = ${RECOVER};

// Idle response per layer. RUN blinks (its dots sit on the orange panel, so a dark
// frame reads as the panel showing through); everything else takes the sweep as a
// brightness glint plus a physical impulse, never a dropout.
const GLINT = 0.45, POP = 0.035, LIFT = 8;
// The cursor travels in from off-frame right and comes to rest on the button; the
// click is held back to the very end so it is the last thing the card does.
const CURSOR_FROM_X = 430, CURSOR_FROM_Y = 190;
const CURSOR_SLIDE = 16;   // frames to travel in, decelerating the whole way
// Deliberately understated: a real click barely moves anything. The cursor dips a
// few pixels and the button gives under it — enough to register, not enough to
// pull the eye.
const CLICK_DIP = 3;        // how far the cursor presses down
const CLICK_CURSOR = 0.015; // how much the cursor shrinks on the press
const CLICK_BUTTON = 0.0025;// the button gives by about a pixel — felt, not seen
const PRESS_FRAMES = 1;     // a single frame held down, then it springs back

const D = ${DATA};

const RUN_BASE = [250, 247, 242];  // #FAF7F2
const RUN_HOT = [255, 255, 255];

const mix = (a: number[], b: number[], t: number) =>
  \`rgb(\${a[0] + (b[0] - a[0]) * t | 0},\${a[1] + (b[1] - a[1]) * t | 0},\${a[2] + (b[2] - a[2]) * t | 0})\`;

const REST = { off: false, hot: 0 };

// ─── IDLE FLOW ───────────────────────────────────────────────────────────────
// The sweep's SPEED follows the keyframed velocity graph: a smoothstep ramp into an
// early spike, then a long exponential decay with a small floor so the tail keeps
// creeping rather than stopping dead.
function revVel(u: number): number {
  const RAMP = 0.1;
  const s = u < RAMP ? u / RAMP : 1;
  const ramp = s * s * (3 - 2 * s);
  const decay = Math.exp(-3.6 * Math.max(0, u - RAMP));
  return ramp * (0.09 + 0.91 * decay);
}
const SPIKE_N = 240;
const SPIKE: number[] = (() => {
  const out = [0];
  let a = 0;
  for (let i = 0; i < SPIKE_N; i++) { a += revVel((i + 0.5) / SPIKE_N); out.push(a); }
  return out.map((v) => v / a);
})();
/** Fractional frame at which the crest reaches normalised x \`u\`. */
function crestFrame(u: number): number {
  let lo = 0, hi = SPIKE_N;
  while (lo < hi) { const m = (lo + hi) >> 1; if (SPIKE[m] < u) lo = m + 1; else hi = m; }
  if (lo === 0) return CUES.idleStart;
  const a = SPIKE[lo - 1], b = SPIKE[lo];
  const f = b > a ? (u - a) / (b - a) : 0;
  return CUES.idleStart + ((lo - 1 + f) / SPIKE_N) * SWEEP_FRAMES;
}
/**
 * The idle beat: an LED refresh. \`off\` is true on a single frame as the crest
 * arrives; \`hot\` decays 1 -> 0 over RECOVER frames. Outside the beat both are
 * inert, so the card is dead still before and after.
 */
function refresh(frame: number, u: number): { off: boolean; hot: number } {
  if (frame < CUES.idleStart || frame > CUES.idleEnd) return REST;
  const t = frame - crestFrame(u);
  if (t < 0) return REST;
  if (t < OFF_FRAMES) return { off: true, hot: 0 };
  const r = Math.min(1, (t - OFF_FRAMES) / RECOVER);
  const d = 1 - r;
  return { off: false, hot: d * d };
}

const cx = (b: number[]) => (b[0] + b[2]) / 2;
const cy = (b: number[]) => (b[1] + b[3]) / 2;
/** Scale + offset about an element's own centre, in SVG user units. */
const about = (b: number[], s: number, dy = 0, rot = 0) =>
  \`translate(\${cx(b)} \${cy(b) + dy}) rotate(\${rot}) scale(\${s}) translate(\${-cx(b)} \${-cy(b)})\`;

/** Raw Figma markup, wrapped so the transform sits OUTSIDE its drop-shadow filter. */
const Frag: React.FC<{ markup: string; transform: string; hot?: number }> = ({ markup, transform, hot = 0 }) => (
  <g
    transform={transform}
    style={hot > 0.004 ? { filter: \`brightness(\${1 + GLINT * hot})\` } : undefined}
    dangerouslySetInnerHTML={{ __html: markup }}
  />
);

export default function RunEndCard() {
  const frame = useCurrentFrame();
  const { fps: vfps } = useVideoConfig();

  const arrive = (t: number, preset: "SNAPPY" | "LIQUID") =>
    spring({ frame: t, fps: vfps, config: SPRINGS[preset] });

  // RUN panel + its dots move as one block, so the dots stay locked to the panel
  // while it settles.
  const runT = frame - CUES.run;
  const runP = arrive(runT, "SNAPPY");
  const panelBox = D.panel.bbox;

  const dateT = frame - CUES.date;
  const dateP = arrive(dateT, "LIQUID");
  const dateFx = refresh(frame, cx(D.date.bbox) / VB_W);

  const btnT = frame - CUES.button;
  const btnP = arrive(btnT, "SNAPPY");
  const btnFx = refresh(frame, cx(D.button.bbox) / VB_W);

  const btnHot = btnFx.off ? 1 : btnFx.hot;

  const curT = frame - CUES.cursor;
  const curFx = refresh(frame, cx(D.cursor.bbox) / VB_W);
  const curHot = curFx.off ? 1 : curFx.hot;
  // Slides in from off-frame right, decelerating onto the button. No scale — a
  // pointer that grows into place reads as a graphic, not a cursor.
  const slide = interpolate(curT, [0, CURSOR_SLIDE], [1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic),
  });
  // The click: press, hold a couple of frames, then spring back. The idle sweep no
  // longer nudges the cursor, so this is the only time it moves after it lands.
  const clickT = frame - CUES.click;
  const press = clickT < 0 ? 0
    : clickT < PRESS_FRAMES ? 1
    : Math.max(0, 1 - spring({ frame: clickT - PRESS_FRAMES, fps: vfps, config: SPRINGS.SNAPPY }));

  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 0, top: (CANVAS_H - VB_H) / 2, width: VB_W, height: VB_H }}>
        {/* fill="none" is inherited from the source SVG's root: the cursor outline
            has no fill of its own and would otherwise default to solid black,
            painting over the dark arrow beneath it. */}
        <svg width={VB_W} height={VB_H} viewBox={\`0 0 \${VB_W} \${VB_H}\`} fill="none" style={{ overflow: "visible" }}>
          <g dangerouslySetInnerHTML={{ __html: D.defs }} />

          {/* date / venue */}
          {dateT >= 0 ? (
            <Frag
              markup={D.date.markup}
              hot={dateFx.off ? 1 : dateFx.hot}
              transform={about(D.date.bbox, (0.94 + 0.06 * dateP) * (1 + POP * (dateFx.off ? 1 : dateFx.hot)),
                (1 - dateP) * 26 - LIFT * (dateFx.off ? 1 : dateFx.hot))}
            />
          ) : null}

          {/* Apify symbol — green, blue, then the orange base */}
          {D.symbol.map((tri: any, i: number) => {
            const t = frame - CUES.symbol - i * TRI_STAGGER;
            if (t < 0) return null;
            const p = arrive(t, "SNAPPY");
            const fx = refresh(frame, cx(tri.bbox) / VB_W);
            const hot = fx.off ? 1 : fx.hot;
            return (
              <Frag
                key={tri.fill}
                markup={tri.markup}
                hot={hot}
                transform={about(tri.bbox, (0.88 + 0.12 * p) * (1 + POP * 2 * hot), -LIFT * hot, 2 * (1 - p))}
              />
            );
          })}

          {/* "apify" — letters rise in reading order */}
          {D.wordmark.map((letter: any, i: number) => {
            const t = frame - CUES.wordmark - i * LETTER_STAGGER;
            if (t < 0) return null;
            const p = arrive(t, "LIQUID");
            const fx = refresh(frame, cx(letter.bbox) / VB_W);
            const hot = fx.off ? 1 : fx.hot;
            return (
              <Frag
                key={i}
                markup={letter.markup}
                hot={hot}
                transform={about(letter.bbox, (0.94 + 0.06 * p) * (1 + POP * hot), (1 - p) * 26 - LIFT * hot)}
              />
            );
          })}

          {/* RUN — the orange panel and its 246 dots, as one block */}
          {runT >= 0 ? (
            <g transform={about(panelBox, 0.94 + 0.06 * runP, (1 - runP) * 18)}>
              <g dangerouslySetInnerHTML={{ __html: D.panel.markup }} />
              {D.run.dots.map((dot: any, i: number) => {
                const u = (dot.bbox[0] - D.run.box[0]) / (D.run.box[2] - D.run.box[0]);
                const t = runT - u * IGNITE_SPREAD;
                if (t < 0) return null;
                const p = arrive(t, "SNAPPY");
                const fx = refresh(frame, dot.bbox[0] / VB_W);
                if (fx.off) return null;   // dark frame — the orange panel shows through
                return (
                  <path
                    key={i}
                    d={dot.d}
                    fill={fx.hot > 0.004 ? mix(RUN_BASE, RUN_HOT, fx.hot) : D.run.fill}
                    transform={about(dot.bbox, (0.62 + 0.38 * p) * (1 + 0.2 * fx.hot))}
                  />
                );
              })}
            </g>
          ) : null}

          {/* run.apify.com button */}
          {btnT >= 0 ? (
            <Frag
              markup={D.button.markup}
              hot={btnHot}
              transform={about(D.button.bbox,
                (0.94 + 0.06 * btnP) * (1 + POP * btnHot) * (1 - CLICK_BUTTON * press),
                (1 - btnP) * 18 - LIFT * btnHot)}
            />
          ) : null}

          {/* cursor — slides in onto the button, then clicks it as the final beat */}
          {curT >= 0 ? (
            <Frag
              markup={D.cursor.markup}
              hot={curHot}
              transform={\`translate(\${CURSOR_FROM_X * slide} \${CURSOR_FROM_Y * slide}) \${about(D.cursor.bbox, 1 - CLICK_CURSOR * press, CLICK_DIP * press)}\`}
            />
          ) : null}
        </svg>
      </div>
    </AbsoluteFill>
  );
}
`;

const outDir = path.join(ROOT, "data/run-endcard");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "scene.tsx"), scene);

if (require.main === module) {
  console.log(`clip starts ${TC.run} (abs frame ${START})`);
  for (const [k, v] of Object.entries(CUES)) {
    console.log(`  ${k.padEnd(10)} clip frame ${String(v).padStart(3)}   ${tc(ABS[k])}`);
  }
  console.log(`duration ${durationInFrames} frames (${(durationInFrames / FPS).toFixed(2)}s) — ends ${tc(START + durationInFrames)}`);
  console.log(`\nwrote ${path.join(outDir, "scene.tsx")} (${(scene.length / 1024).toFixed(1)} KB)`);
}

module.exports = { scene, durationInFrames, CUES, ABS, START, TC, FPS, tc };
