/**
 * Export the whole RUN SF subtitle piece as ONE transparent 4K clip.
 *
 *   node scripts/export-run-sf-mono-master.cjs ["/path/to/output/dir"]
 *
 * ProRes 4444 + yuva444p10le — the same alpha path the app's export dialog uses
 * (lib/render-queue.ts), spawned through the Remotion CLI so remotion.config.ts and
 * the company licence key apply. Silent: the voice-over is already in the Premiere
 * timeline, and the clip starts at 00:00:00:00, so it drops straight onto the head of
 * the sequence and every word lands on the frame it is spoken.
 *
 * The per-line files (scripts/export-run-sf-mono-lines.cjs) are the alternative when
 * the lines need to be placed or retimed individually.
 */
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = path.join(__dirname, "..");
const { makeScene, CUES, FPS, DUST_FRAMES, tc } = require("./build-run-sf-mono-scene.cjs");
const OUT_DIR = process.argv[2] || "/Volumes/T7 Shield/Run_SF_Promo/Graphics/Texts/Animated";
const OUT_NAME = "RUN-SF_SUBTITLES_TC00-00-00-00.mov";
const WIDTH = 3840, HEIGHT = 2160;

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: ROOT, env: process.env });
    let last = "";
    const onData = (b) => {
      const m = b.toString().match(/(\d+)%|Rendered\s+(\d+)\/(\d+)/g);
      if (m) last = m[m.length - 1];
      process.stdout.write(`\r    ${last.padEnd(24)}`);
    };
    p.stdout.on("data", onData);
    p.stderr.on("data", onData);
    p.on("close", (code) => { process.stdout.write("\r"); code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`)); });
  });
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const scenesDir = path.join(ROOT, "remotion", "scenes");
  const tag = `_runsfmaster_${Date.now().toString(36)}`;
  const { source, durationInFrames } = makeScene({ withAudio: false });
  const scenePath = path.join(scenesDir, `${tag}.tsx`);
  const entryPath = path.join(scenesDir, `${tag}.entry.tsx`);
  const out = path.join(OUT_DIR, OUT_NAME);

  fs.writeFileSync(scenePath, source);
  fs.writeFileSync(entryPath, `
import { registerRoot, Composition } from "remotion";
import React from "react";
import Scene from "./${tag}";
registerRoot(() => (
  <Composition id="Master" component={Scene} durationInFrames={${durationInFrames}} fps={${FPS}} width={${WIDTH}} height={${HEIGHT}} />
));
`);

  try {
    console.log(`Master: ${durationInFrames} frames (${(durationInFrames / FPS).toFixed(2)}s), place at 00:00:00:00`);
    CUES.forEach((c, i) => {
      console.log(`  line ${i + 1}: in ${tc(Math.min(...c.frames))}, gone by ${tc(c.exitStart + DUST_FRAMES)}  ${c.rows.map((r) => r.join(" ")).join(" / ")}`);
    });
    await run("npx", [
      "remotion", "render", entryPath, "Master", out,
      "--codec", "prores", "--prores-profile", "4444",
      "--image-format", "png", "--pixel-format", "yuva444p10le",
      "--log", "error",
    ]);
    const mb = (fs.statSync(out).size / 1024 / 1024).toFixed(1);
    console.log(`\n-> ${out}  (${mb} MB)`);
    fs.writeFileSync(path.join(ROOT, "data/run-sf/export-master.json"), JSON.stringify({
      file: out, durationInFrames, fps: FPS, width: WIDTH, height: HEIGHT, timecode: "00:00:00:00",
      lines: CUES.map((c) => ({ text: c.rows.map((r) => r.join(" ")).join(" "), in: tc(Math.min(...c.frames)), out: tc(c.exitStart + DUST_FRAMES) })),
    }, null, 2));
  } finally {
    for (const f of [scenePath, entryPath]) { try { fs.unlinkSync(f); } catch {} }
  }
})();
