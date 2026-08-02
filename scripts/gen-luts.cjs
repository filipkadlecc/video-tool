// Generator for the built-in starter LUT pack in public/luts/.
// Run: node scripts/gen-luts.cjs
// Produces standard .cube 3D LUT files (Rec.709/sRGB domain). These are simple,
// technically-correct looks — the real power of the feature is custom .cube upload.
const fs = require("fs");
const path = require("path");

const OUT = process.argv[2] || path.join(__dirname, "..", "public", "luts");
const SIZE = 17; // 17^3 = 4913 entries. These looks are linear/smooth, so trilinear
                 // interpolation at 17 is visually identical to 33 — keeps files ~130KB.

const clamp = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
// Linear contrast pivoted at mid-grey.
const contrast = (x, k) => clamp((x - 0.5) * k + 0.5);

const LOOKS = {
  warm: {
    title: "Warm",
    fn: (r, g, b) => [clamp(r * 1.05 + 0.015), clamp(g * 1.0 + 0.004), clamp(b * 0.93)],
  },
  cool: {
    title: "Cool",
    fn: (r, g, b) => [clamp(r * 0.93), clamp(g * 1.0 + 0.004), clamp(b * 1.05 + 0.015)],
  },
  "teal-orange": {
    title: "Teal / Orange",
    fn: (r, g, b) => {
      const t = (luma(r, g, b) - 0.5) * 2; // -1 shadows .. +1 highlights
      const a = 0.11;
      return [clamp(r + a * t), clamp(g + a * t * 0.15), clamp(b - a * t)];
    },
  },
  "high-contrast": {
    title: "High Contrast",
    fn: (r, g, b) => [contrast(r, 1.3), contrast(g, 1.3), contrast(b, 1.3)],
  },
  "black-white": {
    title: "Black & White",
    fn: (r, g, b) => {
      const y = contrast(luma(r, g, b), 1.12);
      return [y, y, y];
    },
  },
};

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(path.join(OUT, "custom"), { recursive: true });

for (const [id, { title, fn }] of Object.entries(LOOKS)) {
  const lines = [`TITLE "${title}"`, `LUT_3D_SIZE ${SIZE}`, ""];
  // .cube ordering: red index varies fastest, then green, then blue.
  for (let bi = 0; bi < SIZE; bi++) {
    for (let gi = 0; gi < SIZE; gi++) {
      for (let ri = 0; ri < SIZE; ri++) {
        const [or, og, ob] = fn(ri / (SIZE - 1), gi / (SIZE - 1), bi / (SIZE - 1));
        lines.push(`${or.toFixed(6)} ${og.toFixed(6)} ${ob.toFixed(6)}`);
      }
    }
  }
  const file = path.join(OUT, `${id}.cube`);
  fs.writeFileSync(file, lines.join("\n") + "\n");
  const kb = (fs.statSync(file).size / 1024).toFixed(0);
  console.log(`wrote ${file} (${kb} KB)`);
}
console.log("done");
