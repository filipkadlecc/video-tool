/**
 * Render finished project scenes into talk clips.
 *
 *   node talk/render-clips.cjs <outDir> <publicDir> "<project name>" ["<project name>" ...]
 *
 * Follows the same path as scripts/export-*.cjs: drop the project's stored scene
 * into remotion/scenes/, register a Composition around it, and spawn the Remotion
 * CLI so remotion.config.ts and the company licence key apply. Scenes are authored
 * for a 3840x2160 canvas with absolute pixel values, so we keep the composition at
 * 4K and use --scale to get a 1080p file instead of resizing the canvas (which
 * would reframe the layout).
 */
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = path.join(__dirname, "..");
const [outDir, publicDir, ...names] = process.argv.slice(2);
if (!outDir || !publicDir || !names.length) {
  console.error('usage: node talk/render-clips.cjs <outDir> <publicDir> "<project name>" ...');
  process.exit(1);
}

function findProject(name) {
  const dir = path.join(ROOT, "data/projects");
  for (const id of fs.readdirSync(dir)) {
    const p = path.join(dir, id, "project.json");
    if (!fs.existsSync(p)) continue;
    let j;
    try { j = JSON.parse(fs.readFileSync(p, "utf8")); } catch { continue; }
    if ((j.name || "").trim() === name) return j;
  }
  return null;
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: ROOT, env: process.env });
    const onData = (b) => {
      const m = b.toString().match(/(\d+)%|Rendered\s+\d+\/\d+/g);
      if (m) process.stdout.write(`\r    ${m[m.length - 1].padEnd(24)}`);
    };
    p.stdout.on("data", onData);
    p.stderr.on("data", onData);
    p.on("close", (c) => { process.stdout.write("\r"); c === 0 ? resolve() : reject(new Error(`${cmd} exited ${c}`)); });
  });
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  for (const name of names) {
    const proj = findProject(name);
    if (!proj) { console.error(`!! not found: ${name}`); continue; }
    const code = proj.code || "";
    const dur = parseInt((code.match(/export\s+const\s+durationInFrames\s*=\s*(\d+)/) || [])[1] || "250", 10);
    const fps = parseInt((code.match(/export\s+const\s+fps\s*=\s*(\d+)/) || [])[1] || String(proj.settings?.fps || 25), 10);

    const tag = `_talk_${slug(name)}_${Date.now().toString(36)}`;
    const sp = path.join(ROOT, "remotion", "scenes", `${tag}.tsx`);
    const ep = path.join(ROOT, "remotion", "scenes", `${tag}.entry.tsx`);
    const out = path.join(outDir, `${slug(name)}.mp4`);

    // The app resolves "@/..." through tsconfig paths; the Remotion CLI bundler
    // does not, so rewrite those imports relative to remotion/scenes/.
    fs.writeFileSync(sp, code.replace(/(["'])@\/(?=[a-z])/g, "$1../../"));
    fs.writeFileSync(ep, `
import { registerRoot, Composition } from "remotion";
import React from "react";
import Scene from "./${tag}";
registerRoot(() => (<Composition id="Talk" component={Scene}
  durationInFrames={${dur}} fps={${fps}} width={3840} height={2160} />));
`);
    try {
      console.log(`${name} — ${dur} frames (${(dur / fps).toFixed(1)}s)`);
      await run("npx", [
        "remotion", "render", ep, "Talk", out,
        "--codec", "h264", "--image-format", "jpeg", "--crf", "20",
        "--scale", "0.5", "--public-dir", publicDir, "--log", "error",
      ]);
      console.log(`    -> ${path.basename(out)} (${(fs.statSync(out).size / 1048576).toFixed(1)} MB)`);
    } catch (e) {
      console.error(`    !! ${e.message}`);
    } finally {
      try { fs.unlinkSync(sp); } catch {}
      try { fs.unlinkSync(ep); } catch {}
    }
  }
})();
