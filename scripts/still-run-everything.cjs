/** Render arbitrary frames of the card:  node scripts/still-run-everything.cjs 0 9 15 17 30 … */
const fs = require("fs"), path = require("path");
const { bundle } = require("@remotion/bundler");
const { selectComposition, renderStill } = require("@remotion/renderer");
const ROOT = path.join(__dirname, "..");
const { scene, durationInFrames, FPS } = require("./build-run-everything-scene.cjs");
const OUT = path.join(ROOT, "data/run-everything/check");
const frames = process.argv.slice(2).map(Number).filter((n) => !Number.isNaN(n));
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const dir = path.join(ROOT, "remotion", "scenes");
  const tag = `_still_everything_${Date.now().toString(36)}`;
  const sp = path.join(dir, `${tag}.tsx`), ep = path.join(dir, `${tag}.entry.tsx`);
  fs.writeFileSync(sp, scene);
  fs.writeFileSync(ep, `
import { registerRoot, Composition } from "remotion";
import React from "react";
import Scene from "./${tag}";
registerRoot(() => (<Composition id="Everything" component={Scene}
  durationInFrames={${durationInFrames}} fps={${FPS}} width={3840} height={2160} />));
`);
  try {
    const serveUrl = await bundle({ entryPoint: ep, publicDir: path.join(ROOT, "public/assets/run-everything") });
    const composition = await selectComposition({ serveUrl, id: "Everything" });
    for (const frame of frames) {
      await renderStill({ composition, serveUrl, output: path.join(OUT, `f${String(frame).padStart(3, "0")}.png`), frame, imageFormat: "png" });
      process.stdout.write(`\rrendered ${frame}  `);
    }
    console.log();
  } finally { try { fs.unlinkSync(sp); } catch {} try { fs.unlinkSync(ep); } catch {} }
})();
