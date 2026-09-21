/**
 * RUN SF ending card: split the Figma SVG into animatable layers.
 *
 * Unlike the lockup, this card carries drop-shadow filters, a stroked button and a
 * clipped cursor, so each layer keeps its ORIGINAL markup verbatim and gets wrapped
 * in an animated <g>. Only RUN is taken apart, into its 246 dot-matrix dots.
 *
 * Output: public/assets/run-endcard/endcard.json
 */
const fs = require("fs");
const path = require("path");

const SRC = "/Users/filip/Downloads/Ending card.svg";
const OUT = path.join(__dirname, "..", "public", "assets", "run-endcard", "endcard.json");

const EXPECT = { dots: 246, symbol: 3, wordmark: 5 };

/** Absolute-path bbox for the command subset Figma emits. */
function bboxOf(d) {
  const toks = d.match(/[MLHVCSQZmlhvcsqz]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
  let x = 0, y = 0, cmd = null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const hit = () => {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  };
  const n = (i) => parseFloat(toks[i]);
  for (let i = 0; i < toks.length; i++) {
    if (/[A-Za-z]/.test(toks[i])) { cmd = toks[i]; continue; }
    i--;
    switch (cmd) {
      case "M": case "L": x = n(++i); y = n(++i); hit(); break;
      case "H": x = n(++i); hit(); break;
      case "V": y = n(++i); hit(); break;
      case "C": n(++i); n(++i); n(++i); n(++i); x = n(++i); y = n(++i); hit(); break;
      case "S": case "Q": n(++i); n(++i); x = n(++i); y = n(++i); hit(); break;
      default: i++; break;
    }
    if (cmd === "M") cmd = "L";
  }
  return [minX, minY, maxX, maxY].map((v) => +v.toFixed(3));
}

const subpaths = (d) => d.split(/(?=M)/).map((s) => s.trim())
  .filter((s) => s.length > 1).map((s) => (/[Zz]$/.test(s) ? s : s + "Z"));

const svg = fs.readFileSync(SRC, "utf8");
const head = svg.match(/<svg[^>]*>/)[0];
const width = parseFloat(head.match(/width="([\d.]+)"/)[1]);
const height = parseFloat(head.match(/height="([\d.]+)"/)[1]);
const defs = (svg.match(/<defs>[\s\S]*<\/defs>/) || [""])[0];

/** Split the SVG body into its top-level children, keeping raw markup. */
function topLevelChildren(src) {
  const body = src.slice(src.indexOf(head) + head.length, src.lastIndexOf("</svg>"));
  const out = [];
  let depth = 0, start = -1;
  const re = /<(\/?)([a-zA-Z]+)\b[^>]*?(\/?)>/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    const [tag, closing, name, selfClose] = m;
    if (name === "defs") { if (!closing) { depth++; } else { depth--; } continue; }
    if (depth === 0 && start === -1) start = m.index;
    if (!closing && !selfClose) depth++;
    else if (closing) depth--;
    if (depth === 0) { out.push(body.slice(start, m.index + tag.length).trim()); start = -1; }
  }
  return out.filter((s) => s && !s.startsWith("<defs"));
}

const children = topLevelChildren(svg);

/** Bounding box across every path/rect inside a markup fragment. */
function fragBbox(frag) {
  let bb = [Infinity, Infinity, -Infinity, -Infinity];
  const grow = (b) => {
    bb = [Math.min(bb[0], b[0]), Math.min(bb[1], b[1]), Math.max(bb[2], b[2]), Math.max(bb[3], b[3])];
  };
  for (const m of frag.matchAll(/<path\b[^>]*?d="([^"]*)"/g)) grow(bboxOf(m[1]));
  for (const m of frag.matchAll(/<rect\b([^>]*)>/g)) {
    const a = m[1];
    const g = (k) => parseFloat((a.match(new RegExp(`${k}="([-\\d.]+)"`)) || [, "0"])[1]);
    grow([g("x"), g("y"), g("x") + g("width"), g("y") + g("height")]);
  }
  return bb.map((v) => +v.toFixed(3));
}

const layers = {};
const failures = [];

// child 0 — date/venue text (inside a drop-shadow group)
layers.date = { markup: children[0], bbox: fragBbox(children[0]) };

// child 1 — the Apify logo group: three brand triangles + five wordmark paths.
// They share one drop-shadow filter but need separate cues, so emit two copies of
// the group, each holding its own subset. The filter region is userSpaceOnUse and
// covers the whole logo, so both still cast the identical shadow.
{
  const g = children[1];
  const open = g.match(/^<g[^>]*>/)[0];
  const paths = [...g.matchAll(/<path\b[^>]*?\/?>/g)].map((m) => m[0]);
  const isBrand = (p) => /#246DFF|#20A34E|#F86606/.test(p);
  const tri = paths.filter(isBrand);
  const word = paths.filter((p) => !isBrand(p));
  if (tri.length !== EXPECT.symbol) failures.push(`symbol has ${tri.length} paths, expected ${EXPECT.symbol}`);
  if (word.length !== EXPECT.wordmark) failures.push(`wordmark has ${word.length} paths, expected ${EXPECT.wordmark}`);
  // one filtered group per triangle, ordered green -> blue -> orange, so they can
  // arrive and glint individually
  const order = ["#20A34E", "#246DFF", "#F86606"];
  layers.symbol = order.map((f) => {
    const pth = tri.find((t) => t.includes(f));
    if (!pth) failures.push(`symbol missing ${f}`);
    return { markup: `${open}${pth}</g>`, bbox: fragBbox(pth || ""), fill: f };
  });

  // the wordmark's five paths make four letters — the "i" is a stem plus a dot at
  // the same x, so merge fragments whose x-ranges overlap
  const sorted = word.map((m) => ({ markup: m, bbox: fragBbox(m) }))
    .sort((a, b) => a.bbox[0] - b.bbox[0]);
  const letters = [];
  for (const w of sorted) {
    const prev = letters[letters.length - 1];
    if (prev && w.bbox[0] < prev.bbox[2]) {
      prev.markup += w.markup;
      prev.bbox = [Math.min(prev.bbox[0], w.bbox[0]), Math.min(prev.bbox[1], w.bbox[1]),
                   Math.max(prev.bbox[2], w.bbox[2]), Math.max(prev.bbox[3], w.bbox[3])];
    } else letters.push({ markup: w.markup, bbox: [...w.bbox] });
  }
  layers.wordmark = letters.map((l) => ({ markup: `${open}${l.markup}</g>`, bbox: l.bbox }));
}

// child 2 — the orange panel behind RUN
layers.panel = { markup: children[2], bbox: fragBbox(children[2]) };

// children 3..n — the RUN dot-matrix, up to the button rect
const runFrags = [];
let i = 3;
for (; i < children.length; i++) {
  if (/^<rect/.test(children[i])) break;      // the button rect ends the run
  runFrags.push(children[i]);
}
{
  const dots = [];
  let fill = null;
  for (const frag of runFrags) {
    const d = frag.match(/d="([^"]*)"/)[1];
    fill = fill || (frag.match(/fill="([^"]*)"/) || [])[1];
    for (const sd of subpaths(d)) dots.push({ d: sd, bbox: bboxOf(sd) });
  }
  dots.sort((a, b) => a.bbox[0] - b.bbox[0] || a.bbox[1] - b.bbox[1]);
  if (dots.length !== EXPECT.dots) failures.push(`RUN has ${dots.length} dots, expected ${EXPECT.dots}`);
  const box = dots.reduce((a, d) => [
    Math.min(a[0], d.bbox[0]), Math.min(a[1], d.bbox[1]),
    Math.max(a[2], d.bbox[2]), Math.max(a[3], d.bbox[3])], [Infinity, Infinity, -Infinity, -Infinity]);
  layers.run = { fill, dots, box: box.map((v) => +v.toFixed(3)) };
}

// the button is its rect plus the label path that follows it
{
  const frag = children[i] + children[i + 1];
  layers.button = { markup: frag, bbox: fragBbox(frag) };
  i += 2;
}

// whatever is left is the cursor (a clipped, shadowed group)
{
  const frag = children.slice(i).join("");
  layers.cursor = { markup: frag, bbox: fragBbox(frag) };
}

for (const [k, v] of Object.entries(layers)) {
  if (Array.isArray(v)) {
    console.log(`${k.padEnd(9)} ${v.length} parts at x ${v.map((e) => e.bbox[0].toFixed(0)).join(", ")}`);
  } else {
    const bb = v.bbox || v.box;
    const extra = k === "run" ? `${v.dots.length} dots, fill ${v.fill}` : `${v.markup.length} chars`;
    console.log(`${k.padEnd(9)} bbox=(${bb.map((n) => n.toFixed(0).padStart(5)).join(",")})  ${extra}`);
  }
}

if (failures.length) {
  console.error(`\n${failures.length} assertion failure(s):`);
  failures.forEach((f) => console.error(`  - ${f}`));
  process.exit(1);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({
  generatedAt: new Date().toISOString(), source: SRC, width, height, defs, layers,
}));
console.log(`\nOK -> ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);
