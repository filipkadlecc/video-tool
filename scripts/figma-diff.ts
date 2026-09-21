/**
 * Fidelity harness for the short-form (9:16) kit.
 *
 * The kit is a 1:1 port of Figma frames, and "1:1" is only a claim until
 * something checks it. This renders each scene's settled frame at exactly
 * 1080x1920 and compares it against a committed Figma export.
 *
 *   npm run test:figma                 # every case; exit 1 on any failure
 *   npm run test:figma -- ShortTitle   # one scene
 *
 * Two deliberate choices:
 *
 * - The scene source goes through renderSnippet() rather than being used raw,
 *   so the harness exercises the product's own substitution path. A regex in
 *   lib/snippet-template.ts that stops matching a const turns the diff red.
 * - The render is at scale 1 with no plane transform (figmaPlane emits none at
 *   1080x1920), so there is zero resampling and any mismatch is an authoring
 *   error rather than a rasteriser artefact.
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { bundle } from "@remotion/bundler";
import { selectComposition, renderStill } from "@remotion/renderer";
import { SNIPPET_SCHEMAS } from "../lib/snippet-schemas";
import { renderSnippet } from "../lib/snippet-template";
import { sceneMeta } from "../lib/scene-eval";

const require_ = createRequire(import.meta.url);
const { compare, writeDiff } = require_("./lib/img-probe.cjs");

const ROOT = path.join(import.meta.dirname, "..");
const REF_DIR = path.join(ROOT, "data/figma-vertical/ref");
const OUT_DIR = path.join(ROOT, "data/figma-vertical/check");
const BRANDED = path.join(ROOT, "remotion/scenes/branded");
const DESIGN = { width: 1080, height: 1920 };

interface Case {
  id: string;
  scene: string;
  values: Record<string, unknown>;
  rotated?: boolean;
  /** Whole-frame reference: verifies content AND placement in one. */
  frame?: { nodeId: string; png: string };
  /** Content-node reference, for frames that carry the safe-zone Union overlay. */
  bbox?: { nodeId: string; png: string; x: number; y: number; w: number; h: number };
}

const manifest = JSON.parse(fs.readFileSync(path.join(REF_DIR, "manifest.json"), "utf-8"));
const filter = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const cases: Case[] = manifest.cases.filter(
  (c: Case) => !filter.length || filter.includes(c.id) || filter.includes(c.scene),
);
if (!cases.length) {
  console.error(`no cases match ${filter.join(", ")}`);
  process.exit(1);
}

/** The render entry, which loads fonts the way lib/render-queue.ts does. */
function entrySource(tags: { tag: string; hold: number; fps: number }[]) {
  return `
import { registerRoot, Composition, delayRender, continueRender, staticFile } from "remotion";
import React from "react";
${tags.map((t, i) => `import Scene${i} from "./${t.tag}";`).join("\n")}

// Identical to the font block lib/render-queue.ts injects, so the harness
// verifies the path a real export takes. An absolute '/fonts/...' URL 404s
// under bundle(), which serves publicDir at /public/ rather than at /.
const handle = delayRender("Loading GT Walsheim");
Promise.all(
  [
    { weight: "300", file: "GT-Walsheim-Light.ttf" },
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

registerRoot(() => (
  <>
    ${tags.map((t, i) => `<Composition id="c${i}" component={Scene${i}}
      durationInFrames={${Math.max(t.hold + 4, 1)}} fps={${t.fps}}
      width={${DESIGN.width}} height={${DESIGN.height}} />`).join("\n    ")}
  </>
));
`;
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  // Temp copies live in branded/ rather than scenes/ so that the scenes'
  // own `../../theme` imports resolve at the same depth they were written for.
  const scenesDir = BRANDED;
  const stamp = Date.now().toString(36);
  const written: string[] = [];
  const prepared: { c: Case; tag: string; hold: number; fps: number }[] = [];

  for (const [i, c] of cases.entries()) {
    const src = fs.readFileSync(path.join(BRANDED, `${c.scene}.tsx`), "utf-8");
    const schema = SNIPPET_SCHEMAS[c.scene];
    const code = schema && Object.keys(c.values).length
      ? renderSnippet(src, schema, c.values)
      : src;
    const meta = sceneMeta(code);
    if (meta.holdFrame === undefined) {
      console.error(`${c.id}: scene exports no holdFrame — the harness has no settled frame to diff`);
      process.exit(1);
    }
    const tag = `_figma_${stamp}_${i}`;
    const p = path.join(scenesDir, `${tag}.tsx`);
    fs.writeFileSync(p, code);
    written.push(p);
    prepared.push({ c, tag, hold: meta.holdFrame, fps: meta.fps });
  }

  const ep = path.join(scenesDir, `_figma_${stamp}.entry.tsx`);
  fs.writeFileSync(ep, entrySource(prepared));
  written.push(ep);

  let failures = 0;
  try {
    const serveUrl = await bundle({ entryPoint: ep, publicDir: path.join(ROOT, "public") });

    for (const [i, { c, hold }] of prepared.entries()) {
      const composition = await selectComposition({ serveUrl, id: `c${i}` });
      const full = path.join(OUT_DIR, `${c.id}.png`);
      const settle = path.join(OUT_DIR, `${c.id}.settle.png`);
      await renderStill({ composition, serveUrl, output: full, frame: hold, scale: 1, imageFormat: "png" });
      await renderStill({ composition, serveUrl, output: settle, frame: hold + 3, scale: 1, imageFormat: "png" });

      // Probe: settled. Springs asymptote, so rather than legislate "it has
      // landed", prove it — an unsettled entrance, a stray ambient drift, or an
      // exit that has already begun all show up here.
      const settled = fs.readFileSync(full).equals(fs.readFileSync(settle));

      let ours = full;
      let ref: string;
      if (c.bbox) {
        // Frames carrying the safe-zone Union overlay are diffed by content
        // node instead. Cropping OUR render to Figma's own absolute coordinates
        // is what proves position; the pixels then prove content.
        const sharp = require_("sharp");
        const refPath = path.join(REF_DIR, c.bbox.png);
        const m = await sharp(refPath).metadata();
        ours = path.join(OUT_DIR, `${c.id}.crop.png`);
        await sharp(full)
          .extract({
            left: Math.round(c.bbox.x), top: Math.round(c.bbox.y),
            width: m.width!, height: m.height!,
          })
          .png().toFile(ours);
        ref = refPath;
      } else {
        ref = path.join(REF_DIR, c.frame!.png);
      }

      const result = await compare(ref, ours, { rotated: c.rotated });
      result.probes.settled = { pass: settled, holdFrame: hold, comparedWith: hold + 3 };
      const pass = result.pass && settled;
      if (!pass) {
        failures++;
        await writeDiff(ref, ours, result, path.join(OUT_DIR, `${c.id}.diff.png`));
      }

      console.log(`\n${pass ? "PASS" : "FAIL"}  ${c.id}`);
      for (const [name, p] of Object.entries(result.probes) as [string, { pass: boolean }][]) {
        const { pass: ok, ...rest } = p;
        console.log(`  ${ok ? "ok  " : "FAIL"}  ${name.padEnd(13)} ${JSON.stringify(rest).slice(0, 160)}`);
      }
      if (!pass) console.log(`  diff -> data/figma-vertical/check/${c.id}.diff.png`);
    }
  } finally {
    for (const f of written) { try { fs.unlinkSync(f); } catch { /* best effort */ } }
  }

  console.log(`\n${cases.length - failures}/${cases.length} cases match Figma.\n`);
  process.exit(failures ? 1 : 0);
})();
