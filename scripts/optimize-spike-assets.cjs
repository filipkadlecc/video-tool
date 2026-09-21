/**
 * Re-encode the spike captures as WebP and drop the ones that are larger than
 * they will ever be shown, then point the metadata at the new files.
 *
 * Why: the scene mounts every image at frame 0. The RENDERER blocks on them via
 * delayRender so the mp4 is always correct, but the live Player does not -- it
 * starts playing and paints white until ~20 megapixels of PNG have decoded,
 * which read as "the first 6 seconds are white".
 *
 *   node scripts/optimize-spike-assets.cjs
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const DIR = path.join(__dirname, "..", "public", "assets", "spike");

// Max camera scale each image is ever seen at (see CAM in data/spike/scene.tsx).
// Source width only has to be 1080 * that. Anything beyond is decode cost for
// pixels nobody sees.
const MAX_W = {
  "01-hero": 2160,          // held at s=1.95 in the opening
  "02-bestsellers": 2160,   // clips the bottom of the opening frame at s=1.95
  "06-nike": 2160,          // clips the bottom of the close-up at s=2.00
  "03-badges": 1440,        // only ever seen at s<=1.32
  "04-new-arrivals": 1440,
  "05-jordan--empty": 1440,
};
const ANNOUNCE_W = 2160;    // captured at 3x for a bar that is never magnified

const py = (src) => execFileSync("python3", ["-c", src], { encoding: "utf8" }).trim();

function convert(file, maxWidth) {
  const abs = path.join(DIR, file);
  const out = abs.replace(/\.png$/, ".webp");
  py(`
from PIL import Image
im = Image.open(${JSON.stringify(abs)})
w, h = im.size
mw = ${maxWidth || 0}
if mw and w > mw:
    im = im.resize((mw, round(h * mw / w)), Image.LANCZOS)
im.save(${JSON.stringify(out)}, "WEBP", quality=90, method=6)
`);
  fs.unlinkSync(abs);
  return path.relative(DIR, out);
}

let before = 0, after = 0;
const size = (f) => fs.statSync(path.join(DIR, f)).size;

const sections = JSON.parse(fs.readFileSync(path.join(DIR, "sections.json"), "utf8"));
for (const s of sections) {
  for (const key of ["file", "emptyFile"]) {
    if (!s[key] || !s[key].endsWith(".png")) continue;
    const stem = path.basename(s[key], ".png");
    before += size(s[key]);
    s[key] = convert(s[key], MAX_W[stem]);
    after += size(s[key]);
  }
}
fs.writeFileSync(path.join(DIR, "sections.json"), JSON.stringify(sections, null, 2));

const elements = JSON.parse(fs.readFileSync(path.join(DIR, "elements.json"), "utf8"));
for (const e of elements) {
  for (const c of e.cards) {
    if (!c.file || !c.file.endsWith(".png")) continue;
    before += size(c.file);
    c.file = convert(c.file, 0); // cards are shown at s=2.00 -- keep every pixel
    after += size(c.file);
  }
}
fs.writeFileSync(path.join(DIR, "elements.json"), JSON.stringify(elements, null, 2));

for (const [f, w] of [["elements/announce.png", ANNOUNCE_W], ["elements/logo.png", 0], ["elements/header.png", 0]]) {
  if (!fs.existsSync(path.join(DIR, f))) continue;
  before += size(f);
  const out = convert(f, w);
  after += size(out);
}

console.log(`${(before / 1048576).toFixed(1)} MB PNG -> ${(after / 1048576).toFixed(2)} MB WebP`);
