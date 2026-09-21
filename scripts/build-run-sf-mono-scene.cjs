/**
 * RUN SF promo — GT Walsheim Thin version of the word-synced scene(s).
 *
 *   node scripts/build-run-sf-mono-scene.cjs        # write data/run-sf/scene-mono.tsx
 *
 * Same words and same frame-accurate word onsets as the original Figma-outline
 * version (scripts/build-run-sf-scene.cjs); the type, the colour and the exit are
 * what changed. Text is set live in GT Walsheim Thin (sentence case), embedded
 * as a base64 woff2 subset so the same face applies in the app preview and in a CLI
 * render, and each sentence leaves by disintegrating into ash — a Thanos-snap
 * dissolve that sweeps across the block, driven by the glyphs' own pixels.
 *
 * Set as subtitles: one sentence per line, centred on the frame and sitting on one
 * baseline near the bottom of it, inside the 10% title-safe area. One type size for
 * the whole piece. GT Walsheim is proportional, so every glyph is positioned from the
 * font's own advance widths (data/run-sf/gt-walsheim-thin-metrics.json, read straight
 * out of the TTF) rather than a monospace grid — which also means the browser never
 * kerns, since each character is drawn as its own element.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const FPS = 25;
const HOLD_AFTER_LAST_WORD = 10; // frames the finished sentence stays up
const DUST_FRAMES = 30;          // frames the line takes to disintegrate
const TAIL = 10;                 // frames after the final exit (master only)

// ─── Type ────────────────────────────────────────────────────────────────────
const METRICS = JSON.parse(fs.readFileSync(path.join(ROOT, "data/run-sf/gt-walsheim-thin-metrics.json"), "utf8"));
const UPEM = METRICS.upem, CAP_U = METRICS.capHeight; // GT Walsheim Thin
const CAP_PX = 106.36;          // px cap height — unchanged from the version this replaces
const COLUMN = 3200;            // px — the widest the type may run, as in the outline version
const LINE_RATIO = 1.5;         // row step / cap height (only bites if a line ever wraps)
const BOTTOM = 260;             // px from the bottom of the frame to the baseline
const FILL = "#FAF7F2";
const QUOTE_FILL = "#F86606";   // the sentences are spoken, so they sit in orange quotes
const RISE_RATIO = 22 / 360;    // entrance rise, as a fraction of cap height

const FONT_B64 = fs.readFileSync(path.join(ROOT, "public/fonts/GT-Walsheim-Thin.woff2")).toString("base64");

// ─── Source data ─────────────────────────────────────────────────────────────
const timing = JSON.parse(fs.readFileSync(path.join(ROOT, "data/run-sf/word-timings.json"), "utf8"));
const words = timing.words;
const nBlocks = Math.max(...words.map((w) => w.block)) + 1;

/** The source copy is set in caps; the piece reads in sentence case. "AI" stays "AI". */
const KEEP_UPPER = new Set(["AI"]);
const sentenceCase = (texts) =>
  texts.map((t, i) => {
    if (KEEP_UPPER.has(t)) return t;
    const lower = t.toLowerCase();
    return i === 0 ? lower[0].toUpperCase() + lower.slice(1) : lower;
  });

/** One entry per sentence: word onset frames, the rows they are set in, exit frame. */
const CUES = [];
for (let b = 0; b < nBlocks; b++) {
  const ws = words.filter((w) => w.block === b).sort((a, x) => a.wordInBlock - x.wordInBlock);
  const cased = sentenceCase(ws.map((w) => w.text));
  const rows = [cased.slice()]; // one subtitle line per sentence
  // The quotes ride along with the first and last word, so they arrive and blow away
  // on the same beat as the words they belong to.
  rows[0][0] = '"' + rows[0][0];
  const lastRow = rows[rows.length - 1];
  lastRow[lastRow.length - 1] += '"';
  CUES.push({
    src: b,
    frames: ws.map((w) => w.frame),
    texts: cased,
    rows,
    exitStart: Math.round(Math.max(...ws.map((w) => w.end)) * FPS) + HOLD_AFTER_LAST_WORD,
  });
}

// One type size for the whole piece, set by cap height so the subtitles read at the
// same size as the version this replaces whatever the face's proportions are.
const CAP = CAP_PX;
const FONT_PX = CAP * (UPEM / CAP_U);
const emWidth = (text) => [...text].reduce((w, ch) => w + (METRICS.advances[ch] || 0), 0) / UPEM;
const widestLine = Math.max(...CUES.flatMap((c) => c.rows.map((r) => emWidth(r.join(" ")))));
if (widestLine * FONT_PX > COLUMN) throw new Error(`longest line is ${Math.round(widestLine * FONT_PX)}px — wider than the ${COLUMN}px column`);
const LINE_STEP = CAP * LINE_RATIO;
const RISE = CAP * RISE_RATIO;
const CELL = Math.max(2, Math.round(CAP / 26)); // flake size, scaled to the type
const DRIFT = CAP * 1.73;                       // px a flake travels in its lifetime
const r2 = (n) => Math.round(n * 100) / 100;
const ADV_PX = Object.fromEntries(
  Object.entries(METRICS.advances).map(([ch, u]) => [ch, r2((u / UPEM) * FONT_PX)])
);

const tc = (f) => {
  const s = Math.floor(f / FPS);
  return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60, f % FPS]
    .map((n) => String(n).padStart(2, "0")).join(":");
};

/**
 * Build the scene source.
 *   onlyBlock  null = all five sentences; N = just sentence N, rebased to frame 0
 *   withAudio  bake the voice-over in (master only — the line exports are silent)
 */
function makeScene({ onlyBlock = null, withAudio = true } = {}) {
  const cues = onlyBlock === null ? CUES : [CUES[onlyBlock]];
  const offset = onlyBlock === null ? 0 : Math.min(...cues[0].frames);
  const lastExit = Math.max(...cues.map((c) => c.exitStart)) + DUST_FRAMES - offset;
  const durationInFrames = onlyBlock === null ? lastExit + TAIL : lastExit + 2;

  const literal = cues
    .map((c) => `  // ${c.texts.join(" ")}\n  { rows: ${JSON.stringify(c.rows)}, words: [${c.frames.map((f) => f - offset).join(", ")}], exitStart: ${c.exitStart - offset} },`)
    .join("\n");

  const source = `import React, { useLayoutEffect, useRef } from "react";
import {
  AbsoluteFill,${withAudio ? " Audio," : ""} staticFile, useCurrentFrame, useVideoConfig,
  spring, delayRender, continueRender,
} from "remotion";
import { SPRINGS } from "../motion";

export const fps = ${FPS};
export const durationInFrames = ${durationInFrames};

// ─── WORD SYNC ───────────────────────────────────────────────────────────────
// \`words[i]\` is the exact frame word i appears on. Derived by wav2vec2 CTC forced
// alignment of the voice-over against the known transcript, then pulled back to the
// true acoustic onset (CTC fires at the evidence peak, which is 0-77ms late depending
// on the first phoneme), then floored to the frame grid — so a word can land up to
// 39ms early and never late. Validated against 5 directly-measured sentence onsets
// to within 5ms. Nudge any number here to retime a single word.
// \`rows\` holds the line breaks; the words in it are in the same order as \`words\`.
const BLOCKS: { rows: string[][]; words: number[]; exitStart: number }[] = [
${literal}
];

// ─── TYPE ────────────────────────────────────────────────────────────────────
// GT Walsheim Thin, subset to the glyphs this piece uses and embedded as base64 so
// the same face applies in the app preview and in a CLI render (a staticFile
// @font-face silently falls back to a system face inside an eval'd scene). Declared
// at normal weight because the file *is* the thin cut — asking for weight 100 would
// invite the browser to synthesise one.
const WALSHEIM = "data:font/woff2;base64,${FONT_B64}";
const FONT_FACE_CSS = \`
@font-face { font-family:'RunSfWalsheim'; src:url('\${WALSHEIM}') format('woff2'); font-weight:normal; font-style:normal; font-display:block; }
\`;

if (typeof document !== "undefined") {
  const w = window as unknown as { __runsf_walsheim?: boolean };
  if (!w.__runsf_walsheim) {
    w.__runsf_walsheim = true;
    try {
      const handle = delayRender("Loading GT Walsheim Thin");
      new FontFace("RunSfWalsheim", \`url("\${WALSHEIM}")\`, {
        style: "normal", weight: "normal", display: "block" as FontDisplay,
      })
        .load()
        .then((ff) => (document.fonts as FontFaceSet).add(ff))
        .catch(() => undefined)
        .finally(() => continueRender(handle));
    } catch {
      // outside a render context — the CSS @font-face above still applies
    }
  }
}

// One type size for the whole piece, so every subtitle reads at the same size.
// ADV holds each character's advance width in px, taken from the font's own metrics —
// GT Walsheim is proportional, so there is no grid to fall back on.
const FONT_PX = ${r2(FONT_PX)};
const CAP = ${r2(CAP)};        // cap height, ${CAP_U}/${UPEM} em
const ADV: Record<string, number> = ${JSON.stringify(ADV_PX)};
const advance = (ch: string) => ADV[ch] ?? FONT_PX * 0.5;
const measure = (text: string) => [...text].reduce((w, ch) => w + advance(ch), 0);
const LINE_STEP = ${r2(LINE_STEP)};  // Figma row step, ${LINE_RATIO.toFixed(4)} x cap height
const BOTTOM = ${BOTTOM};         // px from the bottom of the frame to the baseline
const RISE = ${r2(RISE)};       // entrance rise
const FILL = "${FILL}";
const QUOTE = '"';
const QUOTE_FILL = "${QUOTE_FILL}";
const CSS_FONT = \`\${FONT_PX}px 'RunSfWalsheim', sans-serif\`;
const INTRA_WORD_STAGGER = 2;   // total frames of ripple across a word, max
const MAX_GLYPH_DELAY = 0.6;    // frames — keeps short words from rippling too slowly

// ─── DUST ────────────────────────────────────────────────────────────────────
// The snap. Each sentence is sampled into a grid of ash flakes off its own glyph
// pixels; a wave crosses the block left-to-right and slightly upward, and every
// flake it reaches lifts off, drifts up and away, shrinks and fades. What the wave
// has not reached yet is still the crisp, untouched text — the letters erode rather
// than fade, so nothing ever dips to a ghost of itself.
const DUST_FRAMES = ${DUST_FRAMES};
const CELL = ${CELL};                 // px per flake, scaled to the type size
const SWEEP = 0.48;             // fraction of DUST_FRAMES the wave takes to cross
const JITTER = 0.12;            // per-flake randomness in when it lifts off
const LIFE = 0.26;              // fraction of DUST_FRAMES a flake takes to vanish
const DRIFT = ${r2(DRIFT)};           // px a flake travels in its lifetime
const ERASE_PAD = 1;            // px the erase overshoots its cell, covering the seam
                                // between two cells; the grid is whole-pixel aligned and
                                // sampled from a full-size render, so one pixel is enough

/** Every character of a block, on the monospace grid, with the word it belongs to. */
type Glyph = { ch: string; x: number; baseline: number; word: number; fill: string };
type Layout = { width: number; height: number; glyphs: Glyph[] };

function layout(rows: string[][]): Layout {
  const lineWidths = rows.map((r) => measure(r.join(" ")));
  const width = Math.max(...lineWidths);
  const height = (rows.length - 1) * LINE_STEP + CAP;
  const glyphs: Glyph[] = [];
  let word = 0;
  rows.forEach((row, ri) => {
    const baseline = ri * LINE_STEP + CAP;
    let x = (width - lineWidths[ri]) / 2; // rows centred on each other
    row.forEach((w) => {
      for (const ch of w) {
        glyphs.push({ ch, x, baseline, word, fill: ch === QUOTE ? QUOTE_FILL : FILL });
        x += advance(ch);
      }
      x += advance(" ");
      word++;
    });
  });
  return { width, height, glyphs };
}

/**
 * One character. It is fully opaque the instant its word lands — the pop is carried
 * by scale + rise, never by a fade, so the arrival reads exactly on the beat. Once
 * settled the word is completely still: no ambient drift, no idle motion.
 */
const Char: React.FC<{ g: Glyph; index: number; count: number; start: number; frame: number; vfps: number }> = ({
  g, index, count, start, frame, vfps,
}) => {
  const step = count > 1 ? Math.min(MAX_GLYPH_DELAY, INTRA_WORD_STAGGER / (count - 1)) : 0;
  const t = frame - start - index * step;
  if (t < 0) return null;
  const p = spring({ frame: t, fps: vfps, config: SPRINGS.SNAPPY });
  const cx = g.x + advance(g.ch) / 2;
  const cy = g.baseline - CAP / 2;
  const s = 0.86 + 0.14 * p;
  const dy = (1 - p) * RISE;
  return (
    <g transform={\`translate(\${cx} \${cy + dy}) scale(\${s}) translate(\${-cx} \${-cy})\`}>
      <text x={g.x} y={g.baseline} fill={g.fill} style={{ fontFamily: "'RunSfWalsheim', sans-serif", fontSize: FONT_PX }}>
        {g.ch}
      </text>
    </g>
  );
};

/** The sentence assembling itself, word by word, on the voice-over. */
const Assembling: React.FC<{ rows: string[][]; words: number[]; frame: number; vfps: number; vwidth: number; vheight: number }> = ({
  rows, words, frame, vfps, vwidth, vheight,
}) => {
  const { width, height, glyphs } = layout(rows);
  const perWord = rows.flat().map((w) => w.length);
  let seen = -1, lastWord = -1;
  return (
    <div style={{ position: "absolute", left: (vwidth - width) / 2, top: vheight - BOTTOM - height, width, height }}>
      <svg width={width} height={height} viewBox={\`0 0 \${width} \${height}\`} style={{ overflow: "visible" }}>
        {glyphs.map((g, i) => {
          if (g.word !== lastWord) { lastWord = g.word; seen = 0; } else { seen++; }
          return <Char key={i} g={g} index={seen} count={perWord[g.word]} start={words[g.word]} frame={frame} vfps={vfps} />;
        })}
      </svg>
    </div>
  );
};

// ─── The ash field ───────────────────────────────────────────────────────────
// Sampled once per sentence from the glyphs themselves: the text is drawn to an
// offscreen canvas at 1/CELL scale, and every pixel with ink becomes one flake.
// All randomness is hashed from the flake's grid position, never Math.random, so
// every worker in a distributed render draws the identical storm.
type Field = { x: Float32Array; y: Float32Array; a: Float32Array; r1: Float32Array; r2: Float32Array; r3: Float32Array; r4: Float32Array; quote: Uint8Array; n: number };

const hash = (x: number, y: number, k: number) => {
  let h = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263) ^ Math.imul(k + 1, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const FIELDS = new Map<string, Field>();

function ashField(key: string, lay: Layout): Field {
  const cached = FIELDS.get(key);
  if (cached) return cached;

  // Whole cells of padding, so the flake grid lands on whole pixels: a fractional
  // grid makes every erase rect anti-alias at its edges and leaves a faint lattice
  // of un-erased text behind — most visibly a hairline along each baseline.
  const padTop = Math.ceil((FONT_PX * 0.12) / CELL) * CELL;    // room for ascenders above the cap line
  const padBottom = Math.ceil((FONT_PX * 0.35) / CELL) * CELL; // and descenders below the last baseline
  const gw = Math.ceil(lay.width / CELL);
  const gh = Math.ceil((lay.height + padTop + padBottom) / CELL);
  const bw = gw * CELL, bh = gh * CELL;

  // Sample from a full-size render of the text, not a shrunken one: the flake grid
  // has to agree with the crisp text pixel for pixel, and Chrome rasterises small
  // text on its own rounded baseline. Drawing big and reducing by hand (a cell counts
  // if it holds any ink at all) keeps the two in lockstep. Sampled once per colour,
  // so the quotes blow away as orange ash and the words as off-white.
  const big = document.createElement("canvas");
  big.width = bw;
  big.height = bh;
  const bc = big.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;

  const xs: number[] = [], ys: number[] = [], as: number[] = [], qs: number[] = [];
  for (const pass of [0, 1]) {
    const glyphs = lay.glyphs.filter((g) => (g.ch === QUOTE ? 1 : 0) === pass);
    if (glyphs.length === 0) continue;
    bc.clearRect(0, 0, bw, bh);
    bc.fillStyle = "#ffffff";
    bc.font = CSS_FONT;
    bc.textBaseline = "alphabetic";
    for (const g of glyphs) bc.fillText(g.ch, g.x, g.baseline + padTop);

    const src = bc.getImageData(0, 0, bw, bh).data;
    for (let gy = 0; gy < gh; gy++) {
      for (let gx = 0; gx < gw; gx++) {
        let max = 0, sum = 0;
        for (let y = 0; y < CELL; y++) {
          const row = (gy * CELL + y) * bw + gx * CELL;
          for (let x = 0; x < CELL; x++) {
            const a = src[(row + x) * 4 + 3];
            if (a > max) max = a;
            sum += a;
          }
        }
        if (max === 0) continue; // any ink at all becomes a flake, however faint
        xs.push(gx * CELL);
        ys.push(gy * CELL - padTop);
        as.push(Math.min(1, (sum / (CELL * CELL * 255)) * 1.25));
        qs.push(pass);
      }
    }
  }

  const n = xs.length;
  const field: Field = {
    x: Float32Array.from(xs), y: Float32Array.from(ys), a: Float32Array.from(as),
    r1: new Float32Array(n), r2: new Float32Array(n), r3: new Float32Array(n), r4: new Float32Array(n),
    quote: Uint8Array.from(qs), n,
  };
  for (let i = 0; i < n; i++) {
    const gx = Math.round(xs[i] / CELL), gy = Math.round((ys[i] + padTop) / CELL);
    field.r1[i] = hash(gx, gy, 1);
    field.r2[i] = hash(gx, gy, 2);
    field.r3[i] = hash(gx, gy, 3);
    field.r4[i] = hash(gx, gy, 4);
  }
  FIELDS.set(key, field);
  return field;
}

/** One frame of the snap: the intact remainder, eroded, plus everything in flight. */
function drawDust(ctx: CanvasRenderingContext2D, lay: Layout, field: Field, ox: number, oy: number, t: number, W: number, H: number) {
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.font = CSS_FONT;
  ctx.textBaseline = "alphabetic";
  for (const g of lay.glyphs) {
    ctx.fillStyle = g.fill;
    ctx.fillText(g.ch, ox + g.x, oy + g.baseline);
  }

  const sweepSpan = DUST_FRAMES * SWEEP;
  const lift = new Float32Array(field.n); // 0 = still solid, >0 = progress in flight

  // Which flakes the wave has taken, and how long ago.
  for (let i = 0; i < field.n; i++) {
    const nx = field.x[i] / lay.width;
    const ny = 1 - field.y[i] / lay.height;
    const delay = sweepSpan * (nx * 0.78 + ny * 0.22) + DUST_FRAMES * JITTER * field.r1[i];
    const life = DUST_FRAMES * LIFE * (0.7 + 0.6 * field.r2[i]);
    const p = (t - delay) / life;
    lift[i] = p > 0 ? Math.min(1, p) : 0;
  }

  // Erase what has lifted off, so the letters visibly erode from the wavefront.
  ctx.globalCompositeOperation = "destination-out";
  for (let i = 0; i < field.n; i++) {
    if (lift[i] <= 0) continue;
    ctx.fillRect(ox + field.x[i] - ERASE_PAD, oy + field.y[i] - ERASE_PAD, CELL + ERASE_PAD * 2, CELL + ERASE_PAD * 2);
  }

  // Then the ash itself, drifting up and away — words first, then quotes, so the
  // canvas only changes colour once.
  ctx.globalCompositeOperation = "source-over";
  for (const pass of [0, 1]) {
  ctx.fillStyle = pass === 0 ? FILL : QUOTE_FILL;
  for (let i = 0; i < field.n; i++) {
    const p = lift[i];
    if (p <= 0 || p >= 1 || field.quote[i] !== pass) continue;
    const ease = Math.pow(p, 1.3);
    const spread = (field.r3[i] - 0.5) * 1.25;
    const dist = DRIFT * ease * (0.45 + 0.95 * field.r2[i]);
    const dx = Math.sin(spread) * dist * 0.55 + DRIFT * 0.5 * ease + Math.sin(p * 7 + field.r1[i] * 6.28) * 14 * p;
    const dy = -Math.cos(spread) * dist * 0.85 - DRIFT * 0.18 * ease;
    // Flakes, not pixels: each one keeps its own proportions and shrinks as it goes.
    const shrink = 1 - 0.5 * p;
    const w = CELL * (0.5 + 1.5 * field.r4[i]) * shrink;
    const h = CELL * (0.5 + 1.5 * field.r3[i]) * shrink;
    ctx.globalAlpha = field.a[i] * Math.pow(1 - p, 1.4);
    ctx.fillRect(ox + field.x[i] + dx, oy + field.y[i] + dy, w, h);
  }
  }
  ctx.restore();
}

const Dust: React.FC<{ rows: string[][]; t: number }> = ({ rows, t }) => {
  const { width: W, height: H } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement | null>(null);
  const key = rows.map((r) => r.join(" ")).join("|");

  useLayoutEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const lay = layout(rows);
    const field = ashField(key, lay);
    drawDust(ctx, lay, field, Math.round((W - lay.width) / 2), Math.round(H - BOTTOM - lay.height), t, W, H);
  });

  return <canvas ref={ref} width={W} height={H} style={{ position: "absolute", left: 0, top: 0, width: W, height: H }} />;
};

const TextBlock: React.FC<{ cue: { rows: string[][]; words: number[]; exitStart: number } }> = ({ cue }) => {
  const frame = useCurrentFrame();
  const { fps: vfps, width: vwidth, height: vheight } = useVideoConfig();

  const first = Math.min(...cue.words);
  if (frame < first || frame > cue.exitStart + DUST_FRAMES) return null;

  return frame < cue.exitStart
    ? <Assembling rows={cue.rows} words={cue.words} frame={frame} vfps={vfps} vwidth={vwidth} vheight={vheight} />
    : <Dust rows={cue.rows} t={frame - cue.exitStart} />;
};

// No Background component: the piece is transparent by design, for compositing.
export default function RunSfWordSyncMono() {
  return (
    <AbsoluteFill>
      <style>{FONT_FACE_CSS}</style>
${withAudio ? '      <Audio src={staticFile("assets/run-sf/voice.wav")} />\n' : ""}      {BLOCKS.map((cue, i) => (
        <TextBlock key={i} cue={cue} />
      ))}
    </AbsoluteFill>
  );
}
`;
  return { source, durationInFrames, offset, cues };
}

if (require.main === module) {
  const { source, durationInFrames } = makeScene({});
  const outPath = path.join(ROOT, "data/run-sf/scene-mono.tsx");
  fs.writeFileSync(outPath, source);
  console.log(`type: ${METRICS.font} ${r2(FONT_PX)}px (cap ${r2(CAP)}px, longest line ${Math.round(widestLine * FONT_PX)}px of the ${COLUMN}px column), fill ${FILL}`);
  console.log(`master: ${durationInFrames} frames (${(durationInFrames / FPS).toFixed(2)}s), dust ${DUST_FRAMES} frames`);
  CUES.forEach((c, i) => {
    const start = Math.min(...c.frames);
    const gap = i < CUES.length - 1 ? Math.min(...CUES[i + 1].frames) - (c.exitStart + DUST_FRAMES) : Infinity;
    console.log(`  line ${i + 1}: frames ${start}-${c.exitStart + DUST_FRAMES} (starts ${tc(start)}, ${gap === Infinity ? "last" : gap + " frames before the next line"})  ${c.rows.map((r) => r.join(" ")).join(" / ")}`);
  });
  console.log(`\nwrote ${outPath}`);
}

module.exports = { makeScene, CUES, FPS, DUST_FRAMES, EXIT_FRAMES: DUST_FRAMES, tc,
  get scene() { return makeScene({}).source; },
  get durationInFrames() { return makeScene({}).durationInFrames; } };
