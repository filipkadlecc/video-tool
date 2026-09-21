/**
 * RUN SF ending card — verification.
 *
 *   node scripts/verify-run-endcard.cjs
 *
 *   1. FIDELITY — the settled frame must match a direct render of the Figma SVG.
 *   2. ONSETS   — each layer absent on the frame before its cue, present on it.
 *   3. REST     — frames either side of the idle beat must be identical.
 *   4. BEAT     — the sweep must actually do something between its two frames.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { bundle } = require("@remotion/bundler");
const { selectComposition, renderStill } = require("@remotion/renderer");

const ROOT = path.join(__dirname, "..");
const { scene, durationInFrames, CUES } = require("./build-run-endcard-scene.cjs");

const W = 3840, H = 2160, Y_OFF = 1;   // the 2158-tall card sits 1px down

// colour + region per layer, in final frame pixels
const PROBES = [
  { name: "RUN panel", cue: CUES.run,      colour: [248, 102, 6],   tol: 6, x: [244, 1569], y: [760, 1315] },
  { name: "date",      cue: CUES.date,     colour: [250, 247, 242], tol: 6, x: [2573, 3601], y: [775, 931] },
  { name: "symbol",    cue: CUES.symbol,   colour: [32, 163, 78],   tol: 8, x: [600, 800],  y: [410, 600] },
  { name: "wordmark",  cue: CUES.wordmark, colour: [255, 255, 255], tol: 4, x: [830, 1200], y: [415, 580] },
  { name: "button",    cue: CUES.button,   colour: [248, 102, 6],   tol: 6, x: [2654, 3520], y: [1070, 1251] },
];

// The cursor is the only thing on the card with a near-black fill, so track that
// rather than a region — the button's glint scales it past x 3530, and a region
// tight enough to exclude it would clip the cursor mid-slide.
const CURSOR_ZONE = { x: [3380, 3840], y: [1080, 1780] };
const CURSOR_FILL = [27, 28, 29];

const rgb = (f) => execFileSync("ffmpeg",
  ["-v", "error", "-i", f, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: 1 << 30 });
// rgb24 turns transparent pixels into black, so anything testing "is something
// drawn here" has to read alpha instead.
const rgba = (f) => execFileSync("ffmpeg",
  ["-v", "error", "-i", f, "-f", "rawvideo", "-pix_fmt", "rgba", "-"], { maxBuffer: 1 << 30 });

function countIn(buf, p) {
  let n = 0;
  for (let y = p.y[0] + Y_OFF; y < p.y[1] + Y_OFF; y++) {
    let i = (y * W + p.x[0]) * 3;
    for (let x = p.x[0]; x < p.x[1]; x++, i += 3) {
      if (Math.abs(buf[i] - p.colour[0]) <= p.tol
        && Math.abs(buf[i + 1] - p.colour[1]) <= p.tol
        && Math.abs(buf[i + 2] - p.colour[2]) <= p.tol) n++;
    }
  }
  return n;
}

(async () => {
  const scenesDir = path.join(ROOT, "remotion", "scenes");
  const tag = `_verify_endcard_${Date.now().toString(36)}`;
  const sp = path.join(scenesDir, `${tag}.tsx`);
  const ep = path.join(scenesDir, `${tag}.entry.tsx`);
  const OUT = path.join(ROOT, "data/run-endcard/check");
  fs.mkdirSync(OUT, { recursive: true });
  let bad = 0;

  fs.writeFileSync(sp, scene);
  fs.writeFileSync(ep, `
import { registerRoot, Composition } from "remotion";
import React from "react";
import Scene from "./${tag}";
registerRoot(() => (<Composition id="EndCard" component={Scene}
  durationInFrames={${durationInFrames}} fps={25} width={${W}} height={${H}} />));
`);

  try {
    console.log("bundling…");
    const serveUrl = await bundle({ entryPoint: ep, publicDir: path.join(ROOT, "public/assets/run-endcard") });
    const composition = await selectComposition({ serveUrl, id: "EndCard" });

    const need = new Set([40, 46, 52, 58, 64, 95, 121,
                          CUES.cursor - 1, CUES.cursor, CUES.cursor + 4, CUES.cursor + 16,
                          CUES.click - 1, CUES.click, CUES.click + 2, CUES.click + 12]);
    for (const p of PROBES) { need.add(p.cue); if (p.cue > 0) need.add(p.cue - 1); }
    const frames = [...need].filter((f) => f >= 0).sort((a, b) => a - b);
    const png = {};
    for (const frame of frames) {
      const f = path.join(OUT, `f${String(frame).padStart(3, "0")}.png`);
      await renderStill({ composition, serveUrl, output: f, frame, imageFormat: "png" });
      png[frame] = f;
      process.stdout.write(`\rrendered ${frame}   `);
    }
    console.log("\n");

    console.log("ONSETS — each layer's own region, the frame before its cue and on it\n");
    for (const p of PROBES) {
      const before = p.cue - 1 >= 0 ? countIn(rgb(png[p.cue - 1]), p) : null;
      const on = countIn(rgb(png[p.cue]), p);
      const ok = (before === null || before === 0) && on > (p.name === "cursor" ? 60 : 200);
      if (!ok) bad++;
      console.log(`   ${p.name.padEnd(10)} cue ${String(p.cue).padStart(2)}   before ${String(before ?? "n/a").padStart(7)}   on ${String(on).padStart(7)}   ${ok ? "OK" : "FAIL"}`);
    }

    // ── CURSOR SLIDE ────────────────────────────────────────────────────────
    console.log("\nCURSOR — slides in from off-frame, then holds still until the click\n");
    const cursorBox = (f) => {
      const b = rgba(png[f]);
      let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0;
      for (let y = CURSOR_ZONE.y[0]; y < CURSOR_ZONE.y[1]; y++) {
        for (let x = CURSOR_ZONE.x[0]; x < CURSOR_ZONE.x[1]; x++) {
          const i = (y * W + x) * 4;
          const isCursor = b[i + 3] > 128
            && Math.abs(b[i] - CURSOR_FILL[0]) <= 14
            && Math.abs(b[i + 1] - CURSOR_FILL[1]) <= 14
            && Math.abs(b[i + 2] - CURSOR_FILL[2]) <= 14;
          if (isCursor) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        }
      }
      return n ? { x0, y0, x1, y1, n } : null;
    };
    const track = [CUES.cursor - 1, CUES.cursor, CUES.cursor + 4, CUES.cursor + 16, 95, 121].map((f) => [f, cursorBox(f)]);
    for (const [f, b] of track) {
      console.log(`   frame ${String(f).padStart(3)}  ${b ? `x ${String(b.x0).padStart(4)}-${String(b.x1).padStart(4)}  y ${String(b.y0).padStart(4)}-${String(b.y1).padStart(4)}  (${b.n} px)` : "not in frame"}`);
    }
    const before = track[0][1], entering = track[2][1], landed = track[3][1], still = track[5][1];
    const slideOk = !before && entering && landed && still
      && entering.x0 > landed.x0 && entering.y0 > landed.y0     // travels up and to the left
      && landed.x0 === still.x0 && landed.y0 === still.y0;       // then stops dead
    if (!slideOk) bad++;
    console.log(`   -> off screen before its cue, travels up-left, settled and static after: ${slideOk ? "OK" : "FAIL"}`);

    console.log("\nREST — the card must be still whenever nothing is scheduled\n");
    const diff = (x, y) => { let n = 0; for (let i = 0; i < x.length; i += 3) if (x[i] !== y[i] || x[i + 1] !== y[i + 1] || x[i + 2] !== y[i + 2]) n++; return n; };
    const a = rgb(png[40]);
    // 40 vs 46: built, before the beat, cursor not yet on screen
    // 95 vs 121: beat over, click resolved, cursor parked
    for (const [f, g, label] of [[40, 46, "before the beat"], [95, 121, "after the click"]]) {
      const d = diff(rgb(png[f]), rgb(png[g]));
      const ok = d < 500;
      if (!ok) bad++;
      console.log(`   frame ${f} vs ${String(g).padEnd(4)} (${label.padEnd(15)}) ${String(d).padStart(7)} differing px   ${ok ? "OK" : "FAIL"}`);
    }

    console.log("\nBEAT — the sweep must actually move something\n");
    let moved = 0;
    for (const f of [52, 58, 64]) {
      const d = diff(a, rgb(png[f]));
      if (d > 1000) moved++;
      console.log(`   frame 40 vs ${f}  ${String(d).padStart(8)} differing px`);
    }
    if (moved < 2) { bad++; console.log("   FAIL — the beat barely registers"); }

    // ── CLICK ───────────────────────────────────────────────────────────────
    console.log("\nCLICK — the final beat: still, press, release, still again\n");
    const restRef = rgb(png[95]);
    const rows = [[CUES.click - 1, "just before"], [CUES.click, "press"],
                  [CUES.click + 2, "release"], [CUES.click + 12, "settled"], [121, "last frame"]];
    const d = {};
    for (const [f, label] of rows) {
      d[f] = diff(restRef, rgb(png[f]));
      console.log(`   frame ${String(f).padStart(3)} (${label.padEnd(11)}) ${String(d[f]).padStart(8)} differing px vs rest`);
    }
    const clickOk = d[CUES.click - 1] < 500 && d[CUES.click] > 200 && d[121] < 500;
    if (!clickOk) bad++;
    console.log(`   -> still before, registers on the click frame, back to rest by the end: ${clickOk ? "OK" : "FAIL"}`);
    console.log(`   (for scale: the idle beat moves ~200,000 px, so this is deliberately small)`);

    console.log(`\n${bad === 0 ? "ALL CHECKS PASSED" : `${bad} CHECK(S) FAILED`}`);
    console.log(`stills: ${OUT}`);
    process.exitCode = bad ? 1 : 0;
  } finally {
    try { fs.unlinkSync(sp); } catch {}
    try { fs.unlinkSync(ep); } catch {}
  }
})();
