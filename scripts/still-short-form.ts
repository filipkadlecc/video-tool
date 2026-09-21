/**
 * Render one short-form scene to a PNG, for eyeballing or for comparing a whole
 * frame against a Figma export.
 *
 *   npx tsx scripts/still-short-form.ts ShortFunkyTitle '{"ACCENT":"blue"}' 60 /tmp/out.png
 */
import fs from "fs"; import path from "path";
import { createRequire } from "module";
import { bundle } from "@remotion/bundler";
import { selectComposition, renderStill } from "@remotion/renderer";
import { SNIPPET_SCHEMAS } from "../lib/snippet-schemas";
import { renderSnippet } from "../lib/snippet-template";
const require_ = createRequire(import.meta.url);
const ROOT = path.join(import.meta.dirname, "..");
const [sceneId, valuesJson, frameStr, out] = process.argv.slice(2);
const BRANDED = path.join(ROOT, "remotion/scenes/branded");
const src = fs.readFileSync(path.join(BRANDED, `${sceneId}.tsx`), "utf-8");
const code = renderSnippet(src, SNIPPET_SCHEMAS[sceneId], JSON.parse(valuesJson));
const tag = `_still_${Date.now().toString(36)}`;
fs.writeFileSync(path.join(BRANDED, `${tag}.tsx`), code);
fs.writeFileSync(path.join(BRANDED, `${tag}.entry.tsx`, ), `
import { registerRoot, Composition, delayRender, continueRender, staticFile } from "remotion";
import React from "react";
import Scene from "./${tag}";
const h = delayRender("f");
Promise.all([["300","Light"],["400","Regular"],["500","Medium"],["700","Bold"],["900","Black"]].map(async ([w,f]) => {
  const face = new FontFace("GT Walsheim", \`url(\${staticFile("fonts/GT-Walsheim-" + f + ".ttf")})\`, { weight: w, style: "normal", display: "block" });
  await face.load(); document.fonts.add(face);
})).finally(() => continueRender(h));
registerRoot(() => (<Composition id="S" component={Scene} durationInFrames={200} fps={25} width={1080} height={1920} />));
`);
async function main() {
  let serveUrl: string | null = null;
  try {
    serveUrl = await bundle({ entryPoint: path.join(BRANDED, `${tag}.entry.tsx`), publicDir: path.join(ROOT, "public") });
    const composition = await selectComposition({ serveUrl, id: "S" });
    await renderStill({ composition, serveUrl, output: out, frame: Number(frameStr), scale: 1, imageFormat: "png" });
    console.log("wrote", out);
  } finally {
    for (const f of [`${tag}.tsx`, `${tag}.entry.tsx`]) { try { fs.unlinkSync(path.join(BRANDED, f)); } catch {} }
    if (serveUrl) { try { fs.rmSync(serveUrl, { recursive: true, force: true }); } catch {} }
  }
}
void main();
