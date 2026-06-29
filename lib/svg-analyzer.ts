import crypto from "crypto";
import type { SvgFile } from "./types";

export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SvgElement {
  tag: "path" | "rect" | "circle" | "text" | "image" | "ellipse" | "line";
  bbox: BBox;
  fill?: string;
  stroke?: string;
  textContent?: string;
  rx?: number;
  hash: string;
}

export interface SvgManifest {
  filename: string;
  viewBox: ViewBox;
  elementCount: number;
  texts: { content: string; bbox: BBox }[];
  buttons: BBox[];
  panels: BBox[];
  hashes: string[];
}

export interface SequenceDiffPair {
  from: number;
  to: number;
  added: SvgElement[];
  removed: SvgElement[];
  changedFills: { bbox: BBox; from: string; to: string; tag: string }[];
}

export interface SvgSequenceDiff {
  framePairs: SequenceDiffPair[];
}

function sha8(input: string): string {
  return crypto.createHash("sha1").update(input).digest("hex").slice(0, 8);
}

// Figma re-generates IDs on every export, so `url(#pattern0_xxx)` differs across
// files even when the visual is identical. Strip the id so the hash matches.
function normalizeFill(v: string | undefined): string | undefined {
  if (!v) return v;
  return v.replace(/url\(#[^)]+\)/g, "url(#)").toLowerCase();
}

// Round all numbers in a path d-attribute to 1 decimal so trivial floating-point
// jitter between exports doesn't break the diff.
function normalizeD(d: string): string {
  return d.replace(/-?\d+\.\d+/g, (m) => (Math.round(parseFloat(m) * 10) / 10).toString());
}

function parseViewBox(svg: string): ViewBox {
  const m = svg.match(/viewBox="([\d.\-\s]+)"/);
  if (m) {
    const parts = m[1].trim().split(/\s+/).map(Number);
    if (parts.length === 4) return { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
  }
  // Fall back to width/height
  const wm = svg.match(/<svg[^>]*\swidth="(\d+(?:\.\d+)?)"/);
  const hm = svg.match(/<svg[^>]*\sheight="(\d+(?:\.\d+)?)"/);
  return { x: 0, y: 0, w: wm ? +wm[1] : 1198, h: hm ? +hm[1] : 766 };
}

function attr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? m[1] : undefined;
}

function num(v: string | undefined, fallback = 0): number {
  if (v == null) return fallback;
  const n = parseFloat(v);
  return isFinite(n) ? n : fallback;
}

// Compute a coarse bbox from a path d-attribute by extracting all coordinate pairs.
function pathBBox(d: string): BBox {
  const tokens = d.match(/-?\d+\.?\d*(?:[eE][-+]?\d+)?/g) ?? [];
  if (tokens.length < 2) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  // Treat consecutive numbers as alternating x/y. This over-approximates for
  // commands that take non-coordinate args (e.g. arc rx/ry), but for bbox
  // sufficiency it's fine on Figma exports.
  for (let i = 0; i + 1 < tokens.length; i += 2) {
    const x = parseFloat(tokens[i]);
    const y = parseFloat(tokens[i + 1]);
    if (isFinite(x) && isFinite(y)) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (!isFinite(minX)) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function extractText(svg: string, openIdx: number, closeIdx: number): string {
  const inner = svg.slice(openIdx, closeIdx);
  return inner.replace(/<[^>]+>/g, "").trim();
}

export function parseSvg(svgXml: string, filename: string): { manifest: SvgManifest; elements: SvgElement[] } {
  const viewBox = parseViewBox(svgXml);
  const elements: SvgElement[] = [];

  // Walk all leaf elements. We're not trying to preserve hierarchy — just enumerate
  // visual primitives so we can compare them between frames.
  const leafRegex = /<(path|rect|circle|ellipse|line|image|text)\b([^>]*?)(\/?)>/g;
  let match: RegExpExecArray | null;
  while ((match = leafRegex.exec(svgXml)) !== null) {
    const tagName = match[1] as SvgElement["tag"];
    const tagAttrs = match[2];
    const selfClose = match[3] === "/";

    const fillRaw = attr(`<${tagName} ${tagAttrs} `, "fill");
    const strokeRaw = attr(`<${tagName} ${tagAttrs} `, "stroke");
    const fill = fillRaw && fillRaw !== "none" ? normalizeFill(fillRaw) : undefined;
    const stroke = strokeRaw && strokeRaw !== "none" ? normalizeFill(strokeRaw) : undefined;

    let bbox: BBox = { x: 0, y: 0, w: 0, h: 0 };
    let textContent: string | undefined;
    let rx: number | undefined;
    let hashInput = tagName;

    if (tagName === "path") {
      const d = attr(`<path ${tagAttrs} `, "d") ?? "";
      bbox = pathBBox(d);
      hashInput += "|" + normalizeD(d).slice(0, 200);
    } else if (tagName === "rect") {
      bbox = {
        x: num(attr(`<rect ${tagAttrs} `, "x")),
        y: num(attr(`<rect ${tagAttrs} `, "y")),
        w: num(attr(`<rect ${tagAttrs} `, "width")),
        h: num(attr(`<rect ${tagAttrs} `, "height")),
      };
      rx = num(attr(`<rect ${tagAttrs} `, "rx"), 0);
      const r = (n: number) => Math.round(n * 10) / 10;
      hashInput += `|${r(bbox.x)},${r(bbox.y)},${r(bbox.w)},${r(bbox.h)},${rx}`;
    } else if (tagName === "circle") {
      const cx = num(attr(`<circle ${tagAttrs} `, "cx"));
      const cy = num(attr(`<circle ${tagAttrs} `, "cy"));
      const r = num(attr(`<circle ${tagAttrs} `, "r"));
      bbox = { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r };
      hashInput += `|${cx},${cy},${r}`;
    } else if (tagName === "ellipse") {
      const cx = num(attr(`<ellipse ${tagAttrs} `, "cx"));
      const cy = num(attr(`<ellipse ${tagAttrs} `, "cy"));
      const rx2 = num(attr(`<ellipse ${tagAttrs} `, "rx"));
      const ry = num(attr(`<ellipse ${tagAttrs} `, "ry"));
      bbox = { x: cx - rx2, y: cy - ry, w: 2 * rx2, h: 2 * ry };
      hashInput += `|${cx},${cy},${rx2},${ry}`;
    } else if (tagName === "line") {
      const x1 = num(attr(`<line ${tagAttrs} `, "x1"));
      const y1 = num(attr(`<line ${tagAttrs} `, "y1"));
      const x2 = num(attr(`<line ${tagAttrs} `, "x2"));
      const y2 = num(attr(`<line ${tagAttrs} `, "y2"));
      bbox = { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
      hashInput += `|${x1},${y1},${x2},${y2}`;
    } else if (tagName === "image") {
      bbox = {
        x: num(attr(`<image ${tagAttrs} `, "x")),
        y: num(attr(`<image ${tagAttrs} `, "y")),
        w: num(attr(`<image ${tagAttrs} `, "width")),
        h: num(attr(`<image ${tagAttrs} `, "height")),
      };
      hashInput += `|${bbox.x},${bbox.y},${bbox.w},${bbox.h}`;
    } else if (tagName === "text") {
      bbox = {
        x: num(attr(`<text ${tagAttrs} `, "x")),
        y: num(attr(`<text ${tagAttrs} `, "y")),
        w: 0,
        h: 0,
      };
      if (!selfClose) {
        // Capture inner text up to closing tag
        const close = svgXml.indexOf("</text>", leafRegex.lastIndex);
        if (close > 0) {
          textContent = extractText(svgXml, leafRegex.lastIndex, close);
        }
      }
      hashInput += `|text:${textContent ?? ""}`;
    }

    // Skip degenerate / off-canvas placeholders
    if (tagName !== "text" && bbox.w === 0 && bbox.h === 0) continue;
    // Skip rects that look like full-canvas backgrounds (they swamp the diff)
    if (
      tagName === "rect" &&
      bbox.x <= viewBox.x + 1 &&
      bbox.y <= viewBox.y + 1 &&
      bbox.w >= viewBox.w - 2 &&
      bbox.h >= viewBox.h - 2
    ) {
      continue;
    }

    hashInput += `|${fill ?? ""}|${stroke ?? ""}`;

    elements.push({
      tag: tagName,
      bbox,
      fill,
      stroke,
      textContent,
      rx,
      hash: sha8(hashInput),
    });
  }

  // Build manifest summaries
  const texts = elements
    .filter((e) => e.tag === "text" && e.textContent)
    .map((e) => ({ content: e.textContent!, bbox: e.bbox }));

  const buttons = elements
    .filter(
      (e) =>
        e.tag === "rect" &&
        e.fill &&
        e.rx != null &&
        e.rx >= 4 &&
        e.bbox.w >= 50 &&
        e.bbox.w <= 220 &&
        e.bbox.h >= 24 &&
        e.bbox.h <= 64
    )
    .map((e) => e.bbox);

  const panels = elements
    .filter(
      (e) =>
        (e.tag === "rect" || e.tag === "path") &&
        e.bbox.w >= 300 &&
        e.bbox.h >= 100 &&
        e.bbox.w < viewBox.w * 0.95
    )
    .map((e) => e.bbox);

  const manifest: SvgManifest = {
    filename,
    viewBox,
    elementCount: elements.length,
    texts,
    buttons,
    panels,
    hashes: elements.map((e) => e.hash),
  };

  return { manifest, elements };
}

function bboxesNear(a: BBox, b: BBox, tol = 2): boolean {
  return (
    Math.abs(a.x - b.x) <= tol &&
    Math.abs(a.y - b.y) <= tol &&
    Math.abs(a.w - b.w) <= tol &&
    Math.abs(a.h - b.h) <= tol
  );
}

export function diffFrames(prev: SvgElement[], next: SvgElement[]): SequenceDiffPair {
  const prevByHash = new Map<string, SvgElement>();
  for (const e of prev) prevByHash.set(e.hash, e);
  const nextByHash = new Map<string, SvgElement>();
  for (const e of next) nextByHash.set(e.hash, e);

  const added: SvgElement[] = [];
  const removed: SvgElement[] = [];
  const changedFills: SequenceDiffPair["changedFills"] = [];

  // Items in next that aren't in prev are candidate "added"; check if a same-bbox
  // item exists in prev with a different fill — that's a fill change, not an add.
  for (const e of next) {
    if (prevByHash.has(e.hash)) continue;
    const sibling = prev.find(
      (p) => p.tag === e.tag && bboxesNear(p.bbox, e.bbox) && p.fill !== e.fill
    );
    if (sibling && sibling.fill && e.fill) {
      // Skip pattern-only changes (image placeholders aren't actionable color shifts)
      if (sibling.fill === "url(#)" || e.fill === "url(#)") continue;
      changedFills.push({ bbox: e.bbox, from: sibling.fill, to: e.fill, tag: e.tag });
    } else {
      added.push(e);
    }
  }
  for (const e of prev) {
    if (nextByHash.has(e.hash)) continue;
    // If it appeared as a fill-change source, skip
    const matched = changedFills.find((c) => bboxesNear(c.bbox, e.bbox));
    if (matched) continue;
    removed.push(e);
  }

  return { from: 0, to: 0, added, removed, changedFills };
}

export function analyzeSvgs(
  svgs: SvgFile[]
): { manifests: SvgManifest[]; sequenceDiff?: SvgSequenceDiff } {
  if (!svgs.length) return { manifests: [] };
  const parsed = svgs.map((s) => parseSvg(s.content, s.filename));
  const manifests = parsed.map((p) => p.manifest);

  // A sequence requires 2+ SVGs with matching viewBoxes
  if (svgs.length < 2) return { manifests };
  const v0 = manifests[0].viewBox;
  const sameViewBox = manifests.every(
    (m) =>
      Math.abs(m.viewBox.w - v0.w) <= 1 &&
      Math.abs(m.viewBox.h - v0.h) <= 1 &&
      Math.abs(m.viewBox.x - v0.x) <= 1 &&
      Math.abs(m.viewBox.y - v0.y) <= 1
  );
  if (!sameViewBox) return { manifests };

  const framePairs: SequenceDiffPair[] = [];
  for (let i = 0; i + 1 < parsed.length; i++) {
    const pair = diffFrames(parsed[i].elements, parsed[i + 1].elements);
    framePairs.push({ ...pair, from: i, to: i + 1 });
  }
  return { manifests, sequenceDiff: { framePairs } };
}

// Compact manifest for prompt injection: drop the noisy `hashes` array, round bboxes.
export function manifestForPrompt(m: SvgManifest) {
  const round = (b: BBox) => ({
    x: Math.round(b.x),
    y: Math.round(b.y),
    w: Math.round(b.w),
    h: Math.round(b.h),
  });
  return {
    filename: m.filename,
    viewBox: m.viewBox,
    elementCount: m.elementCount,
    texts: m.texts.slice(0, 40).map((t) => ({ content: t.content, bbox: round(t.bbox) })),
    buttons: m.buttons.slice(0, 12).map(round),
    panels: m.panels.slice(0, 12).map(round),
  };
}

export function diffForPrompt(d: SvgSequenceDiff) {
  const round = (b: BBox) => ({
    x: Math.round(b.x),
    y: Math.round(b.y),
    w: Math.round(b.w),
    h: Math.round(b.h),
  });
  return {
    framePairs: d.framePairs.map((p) => ({
      from: p.from,
      to: p.to,
      added: p.added.slice(0, 30).map((e) => ({
        tag: e.tag,
        bbox: round(e.bbox),
        fill: e.fill,
        stroke: e.stroke,
        textContent: e.textContent?.slice(0, 60),
      })),
      removed: p.removed.slice(0, 30).map((e) => ({
        tag: e.tag,
        bbox: round(e.bbox),
        fill: e.fill,
        stroke: e.stroke,
        textContent: e.textContent?.slice(0, 60),
      })),
      changedFills: p.changedFills.slice(0, 20).map((c) => ({
        bbox: round(c.bbox),
        from: c.from,
        to: c.to,
        tag: c.tag,
      })),
    })),
  };
}
