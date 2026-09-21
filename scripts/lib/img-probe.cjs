/**
 * Image comparison probes for the Figma fidelity harness.
 *
 * A single "percentage of differing pixels" is the wrong instrument here. Figma
 * rasterises with its own engine and we rasterise with Skia, so 143px type
 * reports 1-3% differing pixels every time — and that number cannot tell
 * "glyph edges anti-alias differently" from "the whole box sits 2px low".
 *
 * So instead: several narrow probes, each of which fails for exactly one reason.
 * Probe 2 (geometry) is the one that stops probe 4's edge tolerance from being a
 * loophole — a uniform offset moves the ink bbox and the profile correlation
 * even when every edge pixel is individually "close enough".
 */
const sharp = require("sharp");

/** Decode to raw RGBA flattened over mid-grey.
 *
 * Mid-grey, not white or black: flattening over either extreme hides one
 * polarity of alpha error — a stray transparent pixel over white looks like
 * white, which is exactly what a white background already is.
 */
async function loadRGBA(file) {
  const img = sharp(file).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 3);
  for (let i = 0, o = 0; i < data.length; i += 4, o += 3) {
    const a = data[i + 3] / 255;
    out[o] = Math.round(data[i] * a + 128 * (1 - a));
    out[o + 1] = Math.round(data[i + 1] * a + 128 * (1 - a));
    out[o + 2] = Math.round(data[i + 2] * a + 128 * (1 - a));
  }
  return { data: out, width: info.width, height: info.height };
}

/** The most common colour, which we treat as "background" for ink detection. */
function modalColor({ data, width, height }) {
  const counts = new Map();
  for (let i = 0; i < width * height * 3; i += 3) {
    const k = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let best = 0, bestN = -1;
  for (const [k, n] of counts) if (n > bestN) { bestN = n; best = k; }
  return [(best >> 16) & 255, (best >> 8) & 255, best & 255];
}

/** Binary ink mask: pixels that differ from the background by more than `thr`. */
function inkMask(img, thr = 24) {
  const bg = modalColor(img);
  const { data, width, height } = img;
  const mask = new Uint8Array(width * height);
  for (let p = 0, i = 0; p < width * height; p++, i += 3) {
    const d = Math.max(
      Math.abs(data[i] - bg[0]),
      Math.abs(data[i + 1] - bg[1]),
      Math.abs(data[i + 2] - bg[2]),
    );
    mask[p] = d > thr ? 1 : 0;
  }
  return { mask, width, height };
}

function inkBBox({ mask, width, height }) {
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

function profiles({ mask, width, height }) {
  const rows = new Float64Array(height), cols = new Float64Array(width);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x]) { rows[y]++; cols[x]++; }
    }
  }
  return { rows, cols };
}

/** Shift (in px) that best aligns two 1-D ink profiles. 0 means no translation. */
function bestShift(a, b, maxShift = 12) {
  let best = 0, bestScore = -Infinity;
  for (let s = -maxShift; s <= maxShift; s++) {
    let score = 0;
    for (let i = 0; i < a.length; i++) {
      const j = i + s;
      if (j < 0 || j >= b.length) continue;
      score += a[i] * b[j];
    }
    if (score > bestScore) { bestScore = score; best = s; }
  }
  return best;
}

/** 3x3 local max-min, used to exclude anti-aliased glyph edges from probe 4. */
function edgeMask({ data, width, height }, thr = 24) {
  const e = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let lo = 255, hi = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const yy = y + dy, xx = x + dx;
          if (yy < 0 || xx < 0 || yy >= height || xx >= width) continue;
          const i = (yy * width + xx) * 3;
          const v = (data[i] + data[i + 1] + data[i + 2]) / 3;
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
      }
      e[y * width + x] = hi - lo > thr ? 1 : 0;
    }
  }
  return e;
}

/** Largest connected component of a binary mask, as a bbox. */
function largestBlob(mask, width, height) {
  const seen = new Uint8Array(width * height);
  let best = null, bestN = 0;
  const stack = [];
  for (let p = 0; p < mask.length; p++) {
    if (!mask[p] || seen[p]) continue;
    stack.length = 0; stack.push(p); seen[p] = 1;
    let n = 0, x0 = width, y0 = height, x1 = -1, y1 = -1;
    while (stack.length) {
      const q = stack.pop();
      const x = q % width, y = (q / width) | 0;
      n++;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const yy = y + dy, xx = x + dx;
          if (yy < 0 || xx < 0 || yy >= height || xx >= width) continue;
          const r = yy * width + xx;
          if (mask[r] && !seen[r]) { seen[r] = 1; stack.push(r); }
        }
      }
    }
    if (n > bestN) { bestN = n; best = { x0, y0, x1, y1, n }; }
  }
  return best;
}

/** Remove ink pixels that touch a non-ink pixel — leaves glyph interiors only. */
function erode(mask, width, height) {
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (!mask[p]) continue;
      let keep = 1;
      for (let dy = -1; dy <= 1 && keep; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const yy = y + dy, xx = x + dx;
          if (yy < 0 || xx < 0 || yy >= height || xx >= width) continue;
          if (!mask[yy * width + xx]) { keep = 0; break; }
        }
      }
      out[p] = keep;
    }
  }
  return out;
}

function dilate(mask, width, height) {
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const yy = y + dy, xx = x + dx;
          if (yy < 0 || xx < 0 || yy >= height || xx >= width) continue;
          out[yy * width + xx] = 1;
        }
      }
    }
  }
  return out;
}

/**
 * Run every probe. `opts.rotated` relaxes the geometry limit to 2px, because
 * Chrome and Figma do not agree to the pixel on rotated 143px type; it is set
 * per case in the manifest, never globally.
 */
async function compare(refFile, ourFile, opts = {}) {
  const hardThr = opts.hardThr ?? 32;
  const bboxTol = opts.rotated ? 2 : 1;
  const ref = await loadRGBA(refFile);
  const our = await loadRGBA(ourFile);

  const probes = {};

  // Probe 1 — dimensions.
  probes.dimensions = {
    pass: ref.width === our.width && ref.height === our.height,
    ref: `${ref.width}x${ref.height}`,
    ours: `${our.width}x${our.height}`,
  };
  if (!probes.dimensions.pass) return { pass: false, probes };

  const { width, height } = ref;

  // Probe 2 — geometry. Translation shows up here and nowhere else.
  const mRef = inkMask(ref), mOur = inkMask(our);
  const bRef = inkBBox(mRef), bOur = inkBBox(mOur);
  const pRef = profiles(mRef), pOur = profiles(mOur);
  const rowShift = bestShift(pRef.rows, pOur.rows);
  const colShift = bestShift(pRef.cols, pOur.cols);
  const deltas = bRef && bOur
    ? { x0: bOur.x0 - bRef.x0, y0: bOur.y0 - bRef.y0, x1: bOur.x1 - bRef.x1, y1: bOur.y1 - bRef.y1 }
    : null;
  probes.geometry = {
    pass: !!deltas
      && Math.abs(deltas.x0) <= bboxTol && Math.abs(deltas.y0) <= bboxTol
      && Math.abs(deltas.x1) <= bboxTol && Math.abs(deltas.y1) <= bboxTol
      && rowShift === 0 && colShift === 0,
    bboxDelta: deltas, rowShift, colShift, tol: bboxTol,
  };

  // Probe 3 — flat colour. No anti-aliasing in the middle of a filled box, so
  // no tolerance is warranted: a wrong token must fail.
  const counts = new Map();
  for (let i = 0; i < width * height * 3; i += 3) {
    const k = (ref.data[i] << 16) | (ref.data[i + 1] << 8) | ref.data[i + 2];
    let e = counts.get(k);
    if (!e) counts.set(k, (e = { n: 0, sx: 0, sy: 0 }));
    const p = i / 3;
    e.n++; e.sx += p % width; e.sy += (p / width) | 0;
  }
  const top = [...counts.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 5);
  const samples = top.map(([k, e]) => {
    const x = Math.round(e.sx / e.n), y = Math.round(e.sy / e.n);
    const i = (y * width + x) * 3;
    const want = [(k >> 16) & 255, (k >> 8) & 255, k & 255];
    const got = [ref.data[i], ref.data[i + 1], ref.data[i + 2]];
    const mine = [our.data[i], our.data[i + 1], our.data[i + 2]];
    // Only meaningful where the reference centroid actually lands on that colour.
    const onColour = want.every((v, j) => v === got[j]);
    return { x, y, want, mine, onColour, ok: !onColour || want.every((v, j) => v === mine[j]) };
  });
  probes.flatColor = { pass: samples.every((s) => s.ok), samples };

  // Probes 4 and 5 — glyph shape.
  //
  // The naive "count differing pixels" approach is useless for text across two
  // rasterisers: white-on-orange at 143px puts a ~250-value delta on every
  // anti-aliased edge pixel, so an identical font reports ~1.7% mismatch. What
  // actually distinguishes "same font, different rasteriser" from "different
  // font" is the INTERIOR: rasterisers disagree in a 1px band at the edge, but
  // a different typeface has different stem widths and different advances, so
  // its interiors do not coincide.
  //
  // Probe 4 erodes both masks by 1px and compares what is left; probe 5 checks
  // total ink so a uniformly bolder cut cannot hide inside the edge band.
  const iRef = erode(mRef.mask, width, height);
  const iOur = erode(mOur.mask, width, height);
  let inter = 0, union = 0;
  for (let p = 0; p < width * height; p++) {
    if (iRef[p] || iOur[p]) union++;
    if (iRef[p] !== iOur[p]) inter++;
  }
  // Thresholds are set from measured control data, not guessed. Rendering the
  // same Figma box (node 2545:496, "Headline" at 143.145px) in four faces gave:
  //
  //   GT Walsheim 500 (correct)  interior  4.9%   coverage  +4.4%   geometry PASS
  //   GT Walsheim 400            interior 24.8%   coverage -12.2%   geometry FAIL
  //   GT Walsheim 700            interior 61.8%   coverage +37.4%   geometry FAIL
  //   Inter 500                  interior 57.9%   coverage +12.8%   geometry FAIL
  //
  // 10% / 8% sits ~2x above the correct font and ~2.5x below the NEAREST wrong
  // one (the adjacent weight of the same family). Tightening further would make
  // the harness fail on rasteriser noise; loosening would let a weight slip.
  probes.interior = {
    pass: union === 0 || inter / union < 0.10,
    symmetricDiff: union ? inter / union : 0,
  };

  let inkRef = 0, inkOur = 0;
  for (let p = 0; p < width * height; p++) { inkRef += mRef.mask[p]; inkOur += mOur.mask[p]; }
  probes.coverage = {
    pass: inkRef === 0 || Math.abs(inkOur - inkRef) / inkRef < 0.08,
    ref: inkRef, ours: inkOur,
    delta: inkRef ? (inkOur - inkRef) / inkRef : 0,
  };

  // Probe 6 — hard mismatch, now strictly about NON-edge regions: flat fills,
  // missing elements, wrong colours. Edges are probes 2/4/5' business, so they
  // are excluded outright rather than forgiven up to an arbitrary delta.
  const eRef = dilate(edgeMask(ref), width, height);
  const eOur = dilate(edgeMask(our), width, height);
  const hard = new Uint8Array(width * height);
  let hardN = 0, compared = 0;
  for (let p = 0, i = 0; p < width * height; p++, i += 3) {
    if (eRef[p] || eOur[p]) continue;
    compared++;
    const d = Math.max(
      Math.abs(ref.data[i] - our.data[i]),
      Math.abs(ref.data[i + 1] - our.data[i + 1]),
      Math.abs(ref.data[i + 2] - our.data[i + 2]),
    );
    if (d <= hardThr) continue;
    hard[p] = 1; hardN++;
  }
  const blob = hardN ? largestBlob(hard, width, height) : null;
  const frac = compared ? hardN / compared : 0;
  probes.hardMismatch = {
    pass: frac < 0.0005 && (!blob || (blob.x1 - blob.x0 <= 6 && blob.y1 - blob.y0 <= 6)),
    fraction: frac, count: hardN, comparedPx: compared,
    largestBlob: blob && { w: blob.x1 - blob.x0 + 1, h: blob.y1 - blob.y0 + 1, at: [blob.x0, blob.y0] },
  };

  return {
    pass: Object.values(probes).every((p) => p.pass),
    probes,
    _hard: { hard, width, height },
  };
}

/** Write ref | ours | failures-in-red, so a red run is legible rather than numeric. */
async function writeDiff(refFile, ourFile, result, out) {
  const { hard, width, height } = result._hard;
  const overlay = Buffer.alloc(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    overlay[p * 4] = 255; overlay[p * 4 + 3] = hard[p] ? 220 : 0;
  }
  const hot = await sharp(await sharp(ourFile).ensureAlpha().flatten({ background: "#808080" }).toBuffer())
    .composite([{ input: overlay, raw: { width, height, channels: 4 } }])
    .png().toBuffer();
  const panel = (buf) => sharp(buf).ensureAlpha().flatten({ background: "#808080" }).png().toBuffer();
  const [a, b] = await Promise.all([panel(refFile), panel(ourFile)]);
  await sharp({ create: { width: width * 3 + 24, height, channels: 3, background: "#202020" } })
    .composite([
      { input: a, left: 0, top: 0 },
      { input: b, left: width + 12, top: 0 },
      { input: hot, left: width * 2 + 24, top: 0 },
    ])
    .png().toFile(out);
}

module.exports = { compare, writeDiff, loadRGBA, inkMask, inkBBox };
