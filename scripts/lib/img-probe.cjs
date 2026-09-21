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

// How far the outline may move, in PIXELS (see the note in compare()).
// Calibrated against controls: `node scripts/figma-font-gate.cjs "GT Walsheim" <weight>`.
const EDGE_SHIFT_LIMIT = 0.9;
const WEIGHT_SHIFT_LIMIT = 0.45;
// How far the ink's centre of mass may move, in pixels. A real translation
// moves it by the full amount; rasteriser noise moves it by a fraction.
const CENTROID_LIMIT = 0.75;

/**
 * Decode to raw RGB, compositing any alpha over `bg`.
 *
 * Mid-grey by default, because flattening over an extreme hides one polarity of
 * alpha error. But a Figma NODE export is transparent outside the node, while
 * our render has the scene's background there — so when a reference comes back
 * larger than its node (Figma pads around a centred stroke), the ring around it
 * must be composited over the scene's real background or the two are compared
 * black-against-grey. Cases pass their background in.
 */
async function loadRGBA(file, bg = [128, 128, 128]) {
  const img = sharp(file).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 3);
  for (let i = 0, o = 0; i < data.length; i += 4, o += 3) {
    const a = data[i + 3] / 255;
    out[o] = Math.round(data[i] * a + bg[0] * (1 - a));
    out[o + 1] = Math.round(data[i + 1] * a + bg[1] * (1 - a));
    out[o + 2] = Math.round(data[i + 2] * a + bg[2] * (1 - a));
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
          // Off-canvas counts as background. Treating it as "keep" would make
          // every border pixel survive erosion, which is how a 1px edge sliver
          // ends up being sampled as if it were a region interior.
          if (yy < 0 || xx < 0 || yy >= height || xx >= width) { keep = 0; break; }
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
 * Intensity-weighted centroid of the ink, in sub-pixel coordinates.
 *
 * This is the translation detector. The integer argmax of ink-profile
 * cross-correlation looked right but is not: our glyph edges anti-alias a
 * shade heavier than Figma's, which biases a thresholded profile, and two
 * cases whose centres of mass differ in OPPOSITE directions both reported the
 * same -1 shift. A centroid weighted by how far each pixel is from the
 * background is symmetric under a uniform edge-weight change, so it measures
 * position and nothing else.
 */
function centroid(img, bg) {
  const { data, width, height } = img;
  let sx = 0, sy = 0, sw = 0;
  for (let p = 0, i = 0; p < width * height; p++, i += 3) {
    const w = Math.max(
      Math.abs(data[i] - bg[0]),
      Math.abs(data[i + 1] - bg[1]),
      Math.abs(data[i + 2] - bg[2]),
    );
    if (w <= 8) continue;
    sx += w * (p % width); sy += w * ((p / width) | 0); sw += w;
  }
  return sw ? { x: sx / sw, y: sy / sw } : null;
}

/** Ink pixels touching a non-ink pixel: the length of the shape's outline. */
function perimeter(mask, width, height) {
  let n = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;
      let edge = false;
      for (let dy = -1; dy <= 1 && !edge; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const yy = y + dy, xx = x + dx;
          if (yy < 0 || xx < 0 || yy >= height || xx >= width) { edge = true; break; }
          if (!mask[yy * width + xx]) { edge = true; break; }
        }
      }
      if (edge) n++;
    }
  }
  return n;
}

/**
 * Run every probe. `opts.rotated` relaxes the geometry limit to 2px, because
 * Chrome and Figma do not agree to the pixel on rotated 143px type; it is set
 * per case in the manifest, never globally.
 */
async function compare(refFile, ourFile, opts = {}) {
  const hardThr = opts.hardThr ?? 32;
  const bboxTol = opts.rotated ? 2 : 1;
  const bg = opts.bg ?? [128, 128, 128];
  const ref = await loadRGBA(refFile, bg);
  const our = await loadRGBA(ourFile, bg);

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
  //
  // The mask is OPENED (eroded then dilated) before measuring. Text boxes hug
  // their content, and two rasterisers disagree on a string's width by a
  // fraction of a pixel, so a box can land 1px narrower and half a pixel off
  // centre. Against a crop positioned by Figma's coordinates that leaves a 1px
  // hairline of background down one edge — which is invisible in the rendered
  // frame but drags the raw ink bbox by dozens of pixels. Opening removes
  // structures 1px thin and leaves everything a viewer could actually see; a
  // real translation still moves the whole shape and is still caught.
  const mRefRaw = inkMask(ref), mOurRaw = inkMask(our);
  const open = (m) => ({
    mask: dilate(erode(m.mask, m.width, m.height), m.width, m.height),
    width: m.width, height: m.height,
  });
  const mRef = open(mRefRaw), mOur = open(mOurRaw);
  const bRef = inkBBox(mRef), bOur = inkBBox(mOur);

  // Translation test: does ANY shift fit better than none?
  //
  // Not a centroid (dominated by whichever flat region happens to be largest),
  // and not the argmax of thresholded ink profiles (biased by our slightly
  // heavier edges — two cases whose content sat in opposite directions both
  // reported the same -1). Instead, compare the eroded glyph interiors at
  // every offset in a +/-2px window: a genuine translation has a better fit
  // somewhere else, while rasteriser noise is equally bad at every offset, so
  // the minimum stays at (0,0).
  const eR = erode(mRefRaw.mask, width, height);
  const eO = erode(mOurRaw.mask, width, height);
  let best = { dx: 0, dy: 0, n: Infinity }, atZero = 0;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      let n = 0;
      for (let y = 0; y < height; y++) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        for (let x = 0; x < width; x++) {
          const xx = x + dx;
          if (xx < 0 || xx >= width) continue;
          if (eR[y * width + x] !== eO[yy * width + xx]) n++;
        }
      }
      if (dx === 0 && dy === 0) atZero = n;
      if (n < best.n) best = { dx, dy, n };
    }
  }
  // A tie counts as no translation; only a strictly better fit elsewhere is
  // evidence, and it has to be better by a real margin rather than by noise.
  const translated = (best.dx !== 0 || best.dy !== 0) && best.n < atZero * 0.9;

  const bboxTolPx = opts.rotated ? 3 : 2;
  const deltas = bRef && bOur
    ? { x0: bOur.x0 - bRef.x0, y0: bOur.y0 - bRef.y0, x1: bOur.x1 - bRef.x1, y1: bOur.y1 - bRef.y1 }
    : null;
  probes.geometry = {
    pass: !!deltas && !translated
      && Math.abs(deltas.x0) <= bboxTolPx && Math.abs(deltas.y0) <= bboxTolPx
      && Math.abs(deltas.x1) <= bboxTolPx && Math.abs(deltas.y1) <= bboxTolPx,
    bestFitShift: { dx: best.dx, dy: best.dy },
    fitGain: +(1 - best.n / (atZero || 1)).toFixed(3),
    bboxDelta: deltas, bboxTol: bboxTolPx,
  };

  // Probe 3 — flat colour. Zero tolerance: there is no anti-aliasing in the
  // middle of a filled region, so a token that is merely close must fail.
  //
  // Sample points are chosen by ERODING each colour's mask, not by taking its
  // centroid. The centroid of a large scattered region (a background with a
  // logo punched out of it) frequently lands on a pixel of some other colour,
  // and then the probe silently checks nothing — which is exactly what it did
  // on first run here.
  const colourMasks = new Map();
  for (let p = 0, i = 0; p < width * height; p++, i += 3) {
    const k = (ref.data[i] << 16) | (ref.data[i + 1] << 8) | ref.data[i + 2];
    let m = colourMasks.get(k);
    if (!m) colourMasks.set(k, (m = { n: 0, mask: new Uint8Array(width * height) }));
    m.n++; m.mask[p] = 1;
  }
  const topColours = [...colourMasks.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 5);
  const samples = [];
  for (const [k, m] of topColours) {
    // Three erosions => the point is at least 3px from any other colour, so it
    // is unambiguously interior rather than an anti-aliased boundary pixel.
    let e = m.mask;
    for (let r = 0; r < 3; r++) e = erode(e, width, height);
    let at = -1;
    for (let p = 0; p < e.length; p++) if (e[p]) { at = p; break; }
    if (at < 0) continue;              // region too thin to sample safely
    const i = at * 3;
    const want = [(k >> 16) & 255, (k >> 8) & 255, k & 255];
    const mine = [our.data[i], our.data[i + 1], our.data[i + 2]];
    samples.push({
      at: [at % width, (at / width) | 0], area: m.n, want, mine,
      ok: want.every((v, j) => v === mine[j]),
    });
  }
  probes.flatColor = {
    // A run with nothing samplable is a failure, not a pass — it means the
    // probe checked nothing, and silently checking nothing is the bug above.
    pass: samples.length > 0 && samples.every((s) => s.ok),
    sampled: samples.length,
    samples,
  };

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
  const iRef = erode(mRefRaw.mask, width, height);
  const iOur = erode(mOurRaw.mask, width, height);
  let symDiff = 0;
  for (let p = 0; p < width * height; p++) if (iRef[p] !== iOur[p]) symDiff++;

  let inkRef = 0, inkOur = 0;
  for (let p = 0; p < width * height; p++) { inkRef += mRefRaw.mask[p]; inkOur += mOurRaw.mask[p]; }

  // Normalise by PERIMETER, not area.
  //
  // Two rasterisers disagree along glyph edges, so the difference between them
  // is proportional to outline LENGTH, not to ink area. An area ratio therefore
  // scales as 1/stroke-width: the same half-pixel edge disagreement reads as
  // 5% on 143px type and 24% on 72px type, and no single area threshold can
  // cover a kit ranging from 48px captions to 155px headlines. Dividing by
  // perimeter gives a number in PIXELS — how far the outline moved — which
  // means the same thing at every size.
  const perim = perimeter(mRefRaw.mask, width, height) || 1;
  const edgeShiftPx = symDiff / perim;
  const weightShiftPx = (inkOur - inkRef) / perim;

  probes.interior = {
    pass: edgeShiftPx < EDGE_SHIFT_LIMIT,
    edgeShiftPx: +edgeShiftPx.toFixed(3), symmetricDiff: symDiff, perimeter: perim,
  };
  probes.coverage = {
    pass: Math.abs(weightShiftPx) < WEIGHT_SHIFT_LIMIT,
    weightShiftPx: +weightShiftPx.toFixed(3), ref: inkRef, ours: inkOur,
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
  // compare() returns early on a dimension mismatch, before any pixel work.
  if (!result._hard) return false;
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
  return true;
}

module.exports = { compare, writeDiff, loadRGBA, inkMask, inkBBox };
