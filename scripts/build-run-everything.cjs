/**
 * "EVERYTHING RUNS ON APIFY": recover word/letter geometry from the Figma SVG.
 *
 *   node scripts/build-run-everything.cjs ["/path/to/EVERYTHING RUNS ON APIFY.svg"]
 *
 * Writes public/assets/run-everything/everything.json in the same shape the
 * "GET READY TO RUN" card uses (scripts/build-run-ready.cjs), so the scene builder
 * is the same machinery: { width, height, fill, words: [{ text, bbox, glyphs }] }.
 *
 * The export is one flat list of halftone paths with no grouping, so the letters are
 * recovered from the layout: paths split into lines by vertical overlap, fragments of
 * the same letter merged by horizontal overlap, and words split at the wide gaps.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = process.argv[2] || "/Users/filip/Downloads/EVERYTHING RUNS ON APIFY.svg";
const OUT = path.join(ROOT, "public/assets/run-everything/everything.json");

// What the artwork is supposed to say, top line first. The letter counts are the
// check: if the split disagrees with these the layout guesses were wrong and the
// script stops rather than shipping a scrambled card.
const EXPECTED = [["EVERYTHING", "RUNS"], ["ON", "APIFY"]];

/** bbox of an axis-aligned bar path (M/L/H/V/Z only — every mark in this face is a bar). */
function bbox(d) {
  const toks = d.match(/[MLHVZmlhvz]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
  let x = 0, y = 0, cmd = null, i = 0;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const hit = () => {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  };
  while (i < toks.length) {
    if (/^[MLHVZmlhvz]$/.test(toks[i])) { cmd = toks[i++]; if (/[Zz]/.test(cmd)) continue; }
    if (cmd === "M" || cmd === "L") { x = +toks[i]; y = +toks[i + 1]; i += 2; hit(); }
    else if (cmd === "H") { x = +toks[i++]; hit(); }
    else if (cmd === "V") { y = +toks[i++]; hit(); }
    else throw new Error(`unsupported path command "${cmd}" — this builder only reads bars`);
  }
  return [minX, minY, maxX, maxY];
}

const union = (a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
const r3 = (n) => +n.toFixed(3);

const src = fs.readFileSync(SRC, "utf8");
const head = src.match(/<svg[^>]*>/);
if (!head) throw new Error(`${SRC} has no <svg> tag`);
const vb = head[0].match(/viewBox="([\d.\s-]+)"/);
if (!vb) throw new Error("the <svg> tag has no viewBox — cannot place the artwork");
const [vx, vy, width, height] = vb[1].trim().split(/\s+/).map(Number);
if (vx !== 0 || vy !== 0) throw new Error(`viewBox is offset (${vx} ${vy}); the scene assumes it starts at 0 0`);

const raw = [...src.matchAll(/<path\b([^>]*?)\/>/g)].map((m) => {
  const attrs = m[1];
  const d = attrs.match(/\bd="([^"]+)"/);
  if (!d) throw new Error("a <path> has no d attribute");
  if (!/Z\s*$/i.test(d[1])) throw new Error("a subpath is left open; merging letters relies on every path being closed");
  return { d: d[1], fill: (attrs.match(/\bfill="([^"]+)"/) || [])[1], bbox: bbox(d[1]) };
});
if (!raw.length) throw new Error("no <path> elements found");

const fills = [...new Set(raw.map((p) => p.fill))];
if (fills.length !== 1) throw new Error(`expected one fill colour, found ${fills.join(", ")}`);
const fill = fills[0];

// ── lines ────────────────────────────────────────────────────────────────────
// Two marks belong to the same line when their vertical spans overlap at all: the
// halftone caps of one line clear the next by a wide margin, so this needs no tuning.
const lines = [];
for (const p of raw.slice().sort((a, b) => a.bbox[1] - b.bbox[1])) {
  const line = lines.find((l) => p.bbox[1] <= l.bbox[3] && p.bbox[3] >= l.bbox[1]);
  if (line) { line.parts.push(p); line.bbox = union(line.bbox, p.bbox); }
  else lines.push({ parts: [p], bbox: p.bbox.slice() });
}
lines.sort((a, b) => a.bbox[1] - b.bbox[1]);

// ── letters ──────────────────────────────────────────────────────────────────
// Figma emits some letters as several paths (the stray bars in the R of RUNS). Any
// two paths on a line whose horizontal spans touch are the same letter: real letters
// are set with clear air between them.
const glyphsPerLine = lines.map((line) => {
  const out = [];
  for (const p of line.parts.slice().sort((a, b) => a.bbox[0] - b.bbox[0])) {
    const g = out.find((q) => p.bbox[0] <= q.bbox[2] && p.bbox[2] >= q.bbox[0]);
    if (g) { g.d += p.d; g.bbox = union(g.bbox, p.bbox); }
    else out.push({ d: p.d, bbox: p.bbox.slice() });
  }
  return out;
});

// ── words ────────────────────────────────────────────────────────────────────
// Letter gaps on this face sit around 30u and word gaps around 150u, so the split
// falls at any gap more than twice the line's median letter gap.
const words = [];
glyphsPerLine.forEach((glyphs, li) => {
  const gaps = glyphs.slice(1).map((g, i) => g.bbox[0] - glyphs[i].bbox[2]);
  const sorted = gaps.slice().sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const threshold = median * 2;

  const groups = [[glyphs[0]]];
  glyphs.slice(1).forEach((g, i) => {
    if (gaps[i] > threshold) groups.push([g]);
    else groups[groups.length - 1].push(g);
  });

  const expected = EXPECTED[li];
  if (!expected) throw new Error(`the artwork has ${glyphsPerLine.length} lines, more than the ${EXPECTED.length} expected`);
  if (groups.length !== expected.length) {
    throw new Error(`line ${li + 1}: split into ${groups.length} words (${groups.map((g) => g.length).join("+")} letters), expected ${expected.join(" ")}`);
  }
  groups.forEach((g, wi) => {
    if (g.length !== expected[wi].length) {
      throw new Error(`line ${li + 1} word ${wi + 1}: found ${g.length} letters, "${expected[wi]}" has ${expected[wi].length}`);
    }
    words.push({
      text: expected[wi],
      bbox: g.reduce((acc, q) => union(acc, q.bbox), g[0].bbox).map(r3),
      glyphs: g.map((q) => ({ d: q.d, bbox: q.bbox.map(r3) })),
    });
  });
});
if (glyphsPerLine.length !== EXPECTED.length) {
  throw new Error(`the artwork has ${glyphsPerLine.length} lines, expected ${EXPECTED.length}`);
}

const geo = { generatedAt: new Date().toISOString(), source: SRC, width, height, fill, words };
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(geo));

console.log(`${path.basename(SRC)} — ${width}x${height}, fill ${fill}`);
lines.forEach((l, i) => console.log(`  line ${i + 1}: caps ${r3(l.bbox[3] - l.bbox[1])}u, x ${r3(l.bbox[0])}..${r3(l.bbox[2])}`));
words.forEach((w) => console.log(`  ${w.text.padEnd(11)} ${w.glyphs.length} letters   x ${w.bbox[0]}..${w.bbox[2]}   y ${w.bbox[1]}..${w.bbox[3]}`));
console.log(`\nwrote ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(1)} KB)`);
