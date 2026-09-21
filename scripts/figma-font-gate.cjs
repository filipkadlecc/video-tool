/**
 * Step 0 of the vertical-kit port: prove "GT Walsheim LC" (what Figma renders
 * with) and "GT Walsheim" (what public/fonts holds) are the same outlines.
 *
 * If they are not, every scene built on top is wrong in a way no amount of
 * coordinate precision recovers, so this runs before any scene exists.
 *
 *   node scripts/figma-font-gate.cjs
 */
const fs = require("fs"), path = require("path");
const { bundle } = require("@remotion/bundler");
const { selectComposition, renderStill } = require("@remotion/renderer");
const { compare, writeDiff } = require("./lib/img-probe.cjs");

const ROOT = path.join(__dirname, "..");

// Controls: `node scripts/figma-font-gate.cjs <family> <weight>` renders the same
// box in a deliberately different face. If a wrong font scores no worse than
// GT Walsheim, the probes cannot tell fonts apart and the gate proves nothing.
const FAMILY = process.argv[2] || "GT Walsheim";
const WEIGHT = process.argv[3] || "500";
const REF = path.join(ROOT, "data/figma-vertical/ref/font-gate-2545-496.png");
const OUT_DIR = path.join(ROOT, "data/figma-vertical/check");
const OURS = path.join(OUT_DIR, `font-gate-${FAMILY.replace(/\s+/g, "")}-${WEIGHT}.png`);

// Figma node 2545:496 — "Frame 4" inside Title 2. Every number is lifted, not chosen.
const W = 617, H = 173;
const SCENE = `
import React from "react";
import { AbsoluteFill } from "remotion";

export const fps = 30;
export const durationInFrames = 1;

export default function Scene() {
  return (
    <AbsoluteFill style={{ backgroundColor: "transparent" }}>
      <div style={{
        width: ${W}, height: ${H}, boxSizing: "border-box",
        backgroundColor: "#f86606",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "15px 24px",
      }}>
        <div style={{
          fontFamily: "'${FAMILY}'", fontWeight: ${WEIGHT},
          fontSize: 143.145, lineHeight: 1, color: "#ffffff",
          whiteSpace: "nowrap", textAlign: "center",
        }}>Headline</div>
      </div>
    </AbsoluteFill>
  );
}
`;

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const dir = path.join(ROOT, "remotion", "scenes");
  const tag = `_fontgate_${Date.now().toString(36)}`;
  const sp = path.join(dir, `${tag}.tsx`), ep = path.join(dir, `${tag}.entry.tsx`);
  fs.writeFileSync(sp, SCENE);
  // Load the fonts exactly the way lib/render-queue.ts does at entry level —
  // FontFace + staticFile behind delayRender. The harness has to render through
  // the same font path a real export uses, or it verifies a special case.
  // (An absolute '/fonts/...' URL 404s here: bundle() serves publicDir under
  // /public/, not /. It works in the Next preview, which is why both paths exist.)
  fs.writeFileSync(ep, `
import { registerRoot, Composition, delayRender, continueRender, staticFile } from "remotion";
import React from "react";
import Scene from "./${tag}";

const handle = delayRender("Loading GT Walsheim");
Promise.all(
  [
    { weight: "400", file: "GT-Walsheim-Regular.ttf" },
    { weight: "500", file: "GT-Walsheim-Medium.ttf" },
    { weight: "700", file: "GT-Walsheim-Bold.ttf" },
    { weight: "900", file: "GT-Walsheim-Black.ttf" },
  ].map(async ({ weight, file }) => {
    const f = new FontFace("GT Walsheim", \`url(\${staticFile("fonts/" + file)})\`, {
      weight, style: "normal", display: "block",
    });
    await f.load();
    document.fonts.add(f);
  }),
).finally(() => continueRender(handle));

import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
loadInter("normal", { weights: ["400", "500", "700"] });

registerRoot(() => (<Composition id="Scene" component={Scene}
  durationInFrames={1} fps={30} width={${W}} height={${H}} />));
`);
  let serveUrl = null;
  try {
    serveUrl = await bundle({ entryPoint: ep, publicDir: path.join(ROOT, "public") });
    const composition = await selectComposition({ serveUrl, id: "Scene" });
    await renderStill({
      composition, serveUrl, output: OURS, frame: 0,
      scale: 1, imageFormat: "png",
    });
  } finally {
    try { fs.unlinkSync(sp); } catch {}
    try { fs.unlinkSync(ep); } catch {}
    // Each bundle copies public/; leaving them behind once cost 98GB.
    if (serveUrl) { try { fs.rmSync(serveUrl, { recursive: true, force: true }); } catch {} }
  }

  const result = await compare(REF, OURS);
  const diffOut = path.join(OUT_DIR, `font-gate-diff-${FAMILY.replace(/\s+/g, "")}-${WEIGHT}.png`);
  if (result._hard) await writeDiff(REF, OURS, result, diffOut);

  console.log(`\n=== FONT GATE: ${FAMILY} ${WEIGHT} vs Figma's "GT Walsheim LC" ===`);
  for (const [name, p] of Object.entries(result.probes)) {
    const { pass, ...rest } = p;
    console.log(`${pass ? "PASS" : "FAIL"}  ${name.padEnd(13)} ${JSON.stringify(rest)}`);
  }
  console.log(`\n${result.pass ? "GATE PASSED" : "GATE FAILED"} — diff written to ${diffOut}\n`);
  process.exit(result.pass ? 0 : 1);
})();
