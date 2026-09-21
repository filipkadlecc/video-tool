/**
 * Regenerate the data block in data/spike/scene.tsx from the capture metadata.
 * Run after the capture scripts so the cut tracks a fresh capture:
 *   node scripts/capture-spike.cjs && node scripts/capture-spike-extras.cjs \
 *     && node scripts/capture-spike-parts.cjs && node scripts/optimize-spike-assets.cjs \
 *     && node scripts/key-spike-badges.cjs && node scripts/parse-spike-products.cjs \
 *     && node scripts/build-spike-scene.cjs
 */
const fs = require("fs");
const path = require("path");

const ASSETS = path.join(__dirname, "..", "public", "assets", "spike");
const SCENE = path.join(__dirname, "..", "data", "spike", "scene.tsx");

const STACK = [1, 2, 3, 4, 5, 6];   // sections the page shots travel over
const STORE_INDEX = 10;             // "Visit us in person"

const read = (f) => JSON.parse(fs.readFileSync(path.join(ASSETS, f), "utf8"));
const sections = Object.fromEntries(read("sections.json").map((s) => [s.index, s]));
const page = read("page.json");
const products = read("products.json");
const parts = read("parts.json");

// These get re-encoded to WebP, so resolve the real extension rather than
// hardcoding one -- a stale ".png" here 404s silently, which renders as nothing.
const resolveEl = (stem) => {
  for (const ext of [".webp", ".png"]) {
    if (fs.existsSync(path.join(ASSETS, "elements", stem + ext))) return `assets/spike/elements/${stem}${ext}`;
  }
  throw new Error(`no elements/${stem}.{webp,png}`);
};

const L = [];
L.push(`const PAGE = { width: ${page.viewportWidth}, totalHeight: ${page.totalHeight} };`);
L.push("");
L.push("const SECTIONS: Band[] = [");
for (const i of STACK) {
  const s = sections[i];
  L.push(`  { slug: "${s.slug}", y: ${s.y}, h: ${s.height}, src: "assets/spike/${s.file}" },`);
}
L.push("];");
L.push("");
const store = sections[STORE_INDEX];
L.push(`const STORE = { src: "assets/spike/${store.file}", w: ${store.width}, h: ${store.height} };`);
L.push(`const ANNOUNCE = { y: 0, h: 42, src: "${resolveEl("announce")}" };`);
L.push(`const LOGO = { x: 475, y: 54, w: 130, h: 43, src: "${resolveEl("logo")}" };`);
L.push("");
L.push("const BADGES: Pic[] = [");
for (const b of parts.badges) {
  const src = resolveEl(path.basename(b.file, path.extname(b.file)));
  L.push(`  { src: "${src}", w: ${b.w}, h: ${b.h} },`);
}
L.push("];");
if (parts.mascot) L.push(`const MASCOT: Pic = { src: "assets/spike/${parts.mascot}", w: 450, h: 819 };`);
L.push("");
L.push("const P: Record<string, Prod> = {");
for (const p of products) {
  const f = `assets/spike/${p.file}`;
  const name = JSON.stringify(p.name);
  const price = JSON.stringify(p.price || "");
  const disc = p.discount ? JSON.stringify(p.discount) : "null";
  L.push(`  "${p.id}": { src: ${JSON.stringify(f)}, w: ${p.w}, h: ${p.h}, name: ${name}, price: ${price}, disc: ${disc}, isNew: ${!!p.isNew} },`);
}
L.push("};");

const START = "// --- generated:data-start ---";
const END = "// --- generated:data-end ---";
const src = fs.readFileSync(SCENE, "utf8");
const a = src.indexOf(START), b = src.indexOf(END);
if (a === -1 || b === -1) throw new Error("data markers not found in " + SCENE);
fs.writeFileSync(SCENE, src.slice(0, a + START.length) + "\n" + L.join("\n") + "\n" + src.slice(b));
console.log(`data block: ${STACK.length} bands, ${parts.badges.length} badges, ${products.length} products`);
