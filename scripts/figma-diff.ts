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

/**
 * Nearest pixel, breaking an exact tie downward.
 *
 * Figma node origins are fractional (687.5, 326.9948), and the crop has to land
 * on the pixel the node actually occupies. Plain floor puts a node at x=326.995
 * almost a whole pixel off; plain round sends one at y=687.5 a pixel past where
 * Figma's own export starts. Nearest-with-ties-down is right for both, and
 * agrees with treating a straddling node as belonging to the lower row.
 */
const nearestPx = (v: number) => -Math.round(-v);

/**
 * The area each platform leaves clear, in 1080x1920 frame pixels, taken from
 * the Figma Union vectors in the kit's "Safe zones + formats" section and
 * shifted to where each sits in the frame.
 */
const CLEAR_REGION: Record<"tiktok" | "shorts", { x: number; y: number; w: number; h: number }[]> = {
  tiktok: [{ x: 132, y: 259, w: 838, h: 107 }, { x: 132, y: 366, w: 718, h: 914 }],
  shorts: [{ x: 61, y: 249, w: 890, h: 472 }, { x: 61, y: 721, w: 816, h: 823 }],
};

/** Keep only what falls inside the clear region; black out the rest. */
async function maskToClear(
  src: string,
  rects: { x: number; y: number; w: number; h: number }[],
  out: string,
): Promise<string> {
  const sharp = require_("sharp");
  const { width, height } = await sharp(src).metadata();
  const flat = await sharp(src).ensureAlpha().flatten({ background: "#000000" }).png().toBuffer();
  const parts = await Promise.all(
    rects.map(async (r) => {
      const w = Math.min(r.w, width! - r.x);
      const h = Math.min(r.h, height! - r.y);
      return {
        input: await sharp(flat).extract({ left: r.x, top: r.y, width: w, height: h }).png().toBuffer(),
        left: r.x,
        top: r.y,
      };
    }),
  );
  await sharp({ create: { width: width!, height: height!, channels: 3, background: "#000000" } })
    .composite(parts)
    .png().toFile(out);
  return out;
}

interface Case {
  id: string;
  scene: string;
  values: Record<string, unknown>;
  rotated?: boolean;
  /** Scene background, for compositing a node export's transparent surround. */
  bg?: string;
  /**
   * Where the export sits relative to the node. Figma grows an export
   * symmetrically for most bleed, but a DROP SHADOW extends only right and
   * down, so the export starts at the node's own top-left. Set "node" then, and
   * the whole export — shadow included — is compared.
   */
  refOrigin?: "centred" | "node";
  /**
   * Whole-frame reference: the only check that can see ABSOLUTE position.
   *
   * A per-node diff crops our render at the same coordinate the scene uses, so
   * a wrong coordinate is self-consistent and passes — which is exactly how the
   * funky titles sat 68px low while every one of their node diffs was green.
   *
   * `mask` blacks out the platform's unsafe area in BOTH images, because the
   * frame export carries Figma's translucent safe-zone overlay there and our
   * render does not. Content bleeding outside the clear region is therefore
   * clipped in both, which is fine: a real displacement still moves everything
   * inside it.
   */
  frame?: { nodeId: string; png: string; mask?: "tiktok" | "shorts" };
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
    // A case whose values cannot be applied would silently diff the scene's
    // DEFAULTS against a reference for some other variant, and report a
    // mismatch that has nothing to do with the thing under test.
    if (Object.keys(c.values).length && !schema) {
      console.error(`${c.id}: case sets ${Object.keys(c.values).join(", ")} but ${c.scene} has no entry in SNIPPET_SCHEMAS`);
      process.exit(1);
    }
    const code = schema ? renderSnippet(src, schema, c.values) : src;
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
  let serveUrl: string | null = null;
  try {
    serveUrl = await bundle({ entryPoint: ep, publicDir: path.join(ROOT, "public") });

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
      let ref = full;
      const refPath2 = (cc: Case) => path.join(REF_DIR, cc.frame!.png);
      if (c.bbox) {
        // Frames carrying the safe-zone Union overlay are diffed by content
        // node instead. Cropping OUR render to Figma's own absolute coordinates
        // is what proves position; the pixels then prove content.
        const sharp = require_("sharp");
        const refPath = path.join(REF_DIR, c.bbox.png);
        const m = await sharp(refPath).metadata();
        // A Figma export rarely matches the node box exactly. It is LARGER
        // when content bleeds (a centred stroke, a rotated box's corners) and
        // SMALLER for a text node, where Figma exports the ink rather than the
        // line boxes. Either way the two are concentric, so compare the region
        // they share — and measure the overhang against the node's FRACTIONAL
        // size, since rounding it first moves the crop by a pixel.
        if (c.refOrigin === "node") {
          // Compare the whole export, shadow included, anchored at the node.
          ref = refPath;
          ours = path.join(OUT_DIR, `${c.id}.crop.png`);
          await sharp(full)
            .extract({
              left: nearestPx(c.bbox.x), top: nearestPx(c.bbox.y),
              width: m.width!, height: m.height!,
            })
            .png().toFile(ours);
        } else {

        const overhangX = (m.width! - c.bbox.w) / 2;
        const overhangY = (m.height! - c.bbox.h) / 2;
        const cw = Math.min(m.width!, Math.round(c.bbox.w));
        const ch = Math.min(m.height!, Math.round(c.bbox.h));

        if (m.width !== cw || m.height !== ch) {
          const trimmed = path.join(OUT_DIR, `${c.id}.ref.png`);
          await sharp(refPath)
            .extract({
              left: Math.round(Math.max(0, overhangX)), top: Math.round(Math.max(0, overhangY)),
              width: cw, height: ch,
            })
            .png().toFile(trimmed);
          ref = trimmed;
        } else {
          ref = refPath;
        }
        ours = path.join(OUT_DIR, `${c.id}.crop.png`);
        await sharp(full)
          .extract({
            left: nearestPx(c.bbox.x + Math.max(0, -overhangX)),
            top: nearestPx(c.bbox.y + Math.max(0, -overhangY)),
            width: cw, height: ch,
          })
          .png().toFile(ours);
        }
      } else {
        ref = path.join(REF_DIR, c.frame!.png);
        if (c.frame!.mask) {
          const rects = CLEAR_REGION[c.frame!.mask];
          ref = await maskToClear(refPath2(c), rects, path.join(OUT_DIR, `${c.id}.ref.png`));
          ours = await maskToClear(full, rects, path.join(OUT_DIR, `${c.id}.crop.png`));
        }
      }

      const hex = c.bg ?? "#000000";
      const bgRGB = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      const result = await compare(ref, ours, { rotated: c.rotated, bg: bgRGB });
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
    // bundle() copies the whole publicDir into a temp directory, and this
    // script runs many times a day. Ninety-eight of them filled a disk once.
    if (serveUrl) { try { fs.rmSync(serveUrl, { recursive: true, force: true }); } catch { /* best effort */ } }
  }

  console.log(`\n${cases.length - failures}/${cases.length} cases match Figma.\n`);
  process.exit(failures ? 1 : 0);
})();
