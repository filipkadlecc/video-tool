/**
 * Measured checks on a rendered composition.
 *
 * The self-review loop already LOOKS at a contact sheet and a few frames. That
 * is judgement, and it misses exactly the things a person only notices in the
 * finished file: a headline that sits two letters past the frame edge for a
 * second and a half, two labels parked on top of each other, a single frame
 * where everything blinks, a sound effect nobody can hear under the music.
 * Each of those is a measurement, not an opinion, so this measures them —
 * on every frame — and reports where.
 *
 * How the numbers are gathered (lib/render-queue.ts `probeComposition`):
 *
 *  - Text geometry comes from the page itself. The probe bundle mounts a tiny
 *    invisible component beside the scene (`probeComponentSource`) that, on
 *    each frame, walks every visible text node, measures its line boxes and
 *    what clips them, and logs one JSON line. Nothing about the scene changes.
 *  - Pixels come from a second, tiny render of every frame (≈96 px), reduced to
 *    a 32×18 grey thumbnail — enough to see a frame that differs from both of
 *    its neighbours while they agree with each other.
 *  - Sounds come from the renderer's own asset list: every <Audio> and every
 *    clip's soundtrack, with the frame it starts on, where in the file it
 *    starts, and its volume on every frame. That is what the export will mix,
 *    so it is what the sound check compares.
 *
 * Everything below the gathering is pure and tested offline
 * (scripts/test-scene-checks.ts).
 */

import path from "path";

// ── what the page reports ────────────────────────────────────────────────────

/** One text block on one frame, as logged by the probe. */
export interface ProbeBlock {
  /** Stable-ish key: the block element's DOM path from the canvas. */
  k: string;
  /** The block's text, trimmed to 60 characters. */
  t: string;
  /** Union box of its visible lines, in composition pixels: x, y, w, h. */
  b: [number, number, number, number];
  /** The VISIBLE part of its lines' ink (up to 8), same units. */
  r: [number, number, number, number][];
  /** Fraction of the text's area that is inside whatever clips it. */
  v: number;
  /** Which edges clip it: any of "l", "r", "t", "b". */
  e: string;
  /** "canvas" when the frame edge does the clipping, "box" for a container. */
  c: "canvas" | "box" | "";
  /** Effective opacity, 0..1. */
  o: number;
}

export interface ProbeFrame {
  f: number;
  w: number;
  h: number;
  blocks: ProbeBlock[];
}

export const PROBE_LOG_PREFIX = "__VT_PROBE__";

/**
 * Source for the probe component, spliced into a render entry file.
 *
 * It is a sibling of the scene, not a wrapper: wrapping would put a new box
 * between the scene and the canvas, and a scene that isn't an AbsoluteFill
 * could lay out differently in the probe than in the export. A hidden,
 * absolutely-positioned sibling changes nothing on screen and gives the probe
 * the canvas box to measure against.
 *
 * Each measured frame holds a delayRender until the measurement is logged, so
 * the frame is never considered finished before it has been measured; the
 * measurement waits for fonts and one macrotask so text set by a scene's own
 * effects is in place.
 */
export function probeComponentSource(every: number): string {
  return `
import { useCurrentFrame as __vtFrame, useVideoConfig as __vtConfig, delayRender as __vtDelay, continueRender as __vtContinue } from "remotion";
const __VT_EVERY__ = ${Math.max(1, Math.round(every))};
// The measurement leaves the page as a console line. The renderer prints every
// console call made from the bundle to the server's terminal, at any level and
// with no option to stop it — one line per frame, thousands per check. A call
// from a separately-named script is treated as browser chatter and printed
// only in verbose mode, while onBrowserLog still receives it.
const __vtEmit = new Function("m", "console.debug(m);\\n//# sourceURL=vt-probe.js") as (m: string) => void;
function __vtMeasure(frame: number, marker: HTMLElement | null, W: number, H: number) {
  const root = marker && marker.parentElement;
  if (!root) return;
  const rr = root.getBoundingClientRect();
  const sx = rr.width / W || 1, sy = rr.height / H || 1;
  const box = (r: DOMRect) => [(r.left - rr.left) / sx, (r.top - rr.top) / sy, r.width / sx, r.height / sy];
  const styleOf = new Map<Element, CSSStyleDeclaration>();
  const cs = (el: Element) => { let s = styleOf.get(el); if (!s) { s = getComputedStyle(el); styleOf.set(el, s); } return s; };
  const opacityOf = new Map<Element, number>();
  const opacity = (el: Element | null): number => {
    if (!el || el === root) return 1;
    const known = opacityOf.get(el);
    if (known !== undefined) return known;
    const s = cs(el);
    const own = s.visibility === "hidden" || s.display === "none" ? 0 : parseFloat(s.opacity || "1");
    const v = own * opacity(el.parentElement);
    opacityOf.set(el, v);
    return v;
  };
  const inkAlpha = (el: Element) => {
    const s = cs(el) as CSSStyleDeclaration & { webkitTextStrokeWidth?: string; webkitBackgroundClip?: string; webkitTextFillColor?: string };
    const m = (s.webkitTextFillColor || s.color || "").match(/rgba?\\(([^)]+)\\)/);
    const a = m ? parseFloat(m[1].split(",")[3] ?? "1") : 1;
    if (a > 0.05) return a;
    if (s.backgroundClip === "text" || s.webkitBackgroundClip === "text") return 1;
    if (parseFloat(s.webkitTextStrokeWidth || "0") > 0) return 1;
    return a;
  };
  const pathOf = (el: Element) => {
    const parts: number[] = [];
    let cur: Element | null = el;
    while (cur && cur !== root) {
      const parent: Element | null = cur.parentElement;
      if (!parent) break;
      parts.push(Array.prototype.indexOf.call(parent.children, cur));
      cur = parent;
    }
    return parts.reverse().join(".");
  };
  // A line box is taller than its letters (it carries the line-height), so a
  // mask cut tight to the glyphs would read as clipping them. Each line is
  // measured as its INK: the middle of the line box, about a cap height and a
  // bit either side of centre.
  const ink = (r: DOMRect, fontPx: number) => {
    const [x, y, w, h] = box(r);
    const half = Math.min(h / 2, (0.42 * fontPx) / sy);
    return [x, y + h / 2 - half, w, 2 * half];
  };
  const blocks = new Map<Element, { text: string; rects: number[][]; o: number }>();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = node.nodeValue || "";
    if (!text.trim()) continue;
    const el = node.parentElement;
    if (!el || el === marker) continue;
    const o = opacity(el) * inkAlpha(el);
    if (o < 0.05) continue;
    let block: Element = el;
    while (block !== root && block.parentElement && cs(block).display.startsWith("inline")) block = block.parentElement;
    range.selectNodeContents(node);
    const fontPx = parseFloat(cs(el).fontSize || "16") * sy;
    const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0.5 && r.height > 0.5).map((r) => ink(r, fontPx));
    if (!rects.length) continue;
    const entry = blocks.get(block) || { text: "", rects: [], o: 0 };
    entry.text += text;
    entry.rects.push(...rects);
    entry.o = Math.max(entry.o, o);
    blocks.set(block, entry);
  }
  const out: unknown[] = [];
  for (const [block, entry] of blocks) {
    // What clips this block: the canvas, then every ancestor that hides overflow.
    let cl = 0, ct = 0, cr = W, cb = H, by = "canvas";
    for (let a: Element | null = block; a && a !== root; a = a.parentElement) {
      const s = cs(a);
      const hx = s.overflowX !== "visible", hy = s.overflowY !== "visible";
      if (!hx && !hy) continue;
      const [x, y, w, h] = box(a.getBoundingClientRect());
      if (hx && x > cl) { cl = x; by = "box"; }
      if (hx && x + w < cr) { cr = x + w; by = "box"; }
      if (hy && y > ct) { ct = y; by = "box"; }
      if (hy && y + h < cb) { cb = y + h; by = "box"; }
    }
    let area = 0, seen = 0, ux0 = Infinity, uy0 = Infinity, ux1 = -Infinity, uy1 = -Infinity;
    const lines: number[][] = [];
    for (const [x, y, w, h] of entry.rects) {
      area += w * h;
      const ix0 = Math.max(x, cl), ix1 = Math.min(x + w, cr);
      const iy0 = Math.max(y, ct), iy1 = Math.min(y + h, cb);
      const iw = Math.max(0, ix1 - ix0);
      const ih = Math.max(0, iy1 - iy0);
      seen += iw * ih;
      ux0 = Math.min(ux0, x); uy0 = Math.min(uy0, y); ux1 = Math.max(ux1, x + w); uy1 = Math.max(uy1, y + h);
      // Only the part that can be seen can overlap anything: an odometer's
      // hidden digits sit on top of other text, masked away, by design.
      if (lines.length < 8 && iw > 1 && ih > 1) lines.push([Math.round(ix0), Math.round(iy0), Math.round(iw), Math.round(ih)]);
    }
    if (area < 4 || seen < 1) continue;
    const edges = (ux0 < cl - 1 ? "l" : "") + (ux1 > cr + 1 ? "r" : "") + (uy0 < ct - 1 ? "t" : "") + (uy1 > cb + 1 ? "b" : "");
    out.push({
      k: pathOf(block),
      t: entry.text.replace(/\\s+/g, " ").trim().slice(0, 60),
      b: [Math.round(ux0), Math.round(uy0), Math.round(ux1 - ux0), Math.round(uy1 - uy0)],
      r: lines,
      v: Math.round((seen / area) * 1000) / 1000,
      e: edges,
      c: edges ? by : "",
      o: Math.round(entry.o * 100) / 100,
    });
  }
  __vtEmit("${PROBE_LOG_PREFIX}" + JSON.stringify({ f: frame, w: W, h: H, blocks: out }));
}
const LayoutProbe: React.FC = () => {
  const frame = __vtFrame();
  const { width, height } = __vtConfig();
  const ref = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    if (frame % __VT_EVERY__ !== 0) return;
    const handle = __vtDelay("vt layout probe " + frame);
    let done = false;
    const finish = () => { if (!done) { done = true; __vtContinue(handle); } };
    const run = () => { try { __vtMeasure(frame, ref.current, width, height); } catch { /* a probe must never fail a frame */ } finish(); };
    const fonts = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts;
    (fonts ? fonts.ready : Promise.resolve()).then(() => setTimeout(run, 0), () => setTimeout(run, 0));
    return finish;
  }, [frame, width, height]);
  return <div ref={ref} aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", visibility: "hidden" }} />;
};
`;
}

/** Pull probe frames out of the page's console lines. Later lines win. */
export function parseProbeLogs(lines: string[]): Map<number, ProbeFrame> {
  const frames = new Map<number, ProbeFrame>();
  for (const line of lines) {
    const at = line.indexOf(PROBE_LOG_PREFIX);
    if (at < 0) continue;
    try {
      const data = JSON.parse(line.slice(at + PROBE_LOG_PREFIX.length)) as ProbeFrame;
      if (Number.isInteger(data.f) && Array.isArray(data.blocks)) frames.set(data.f, data);
    } catch { /* a truncated line is skipped, not fatal */ }
  }
  return frames;
}

// ── the findings ─────────────────────────────────────────────────────────────

export type CheckFinding =
  | { kind: "cut-off"; frame: number; untilFrame: number; text: string; edge: string; by: "canvas" | "box" }
  | { kind: "overlap"; frame: number; untilFrame: number; text: string; other: string }
  | { kind: "flash"; frame: number; length: number }
  | { kind: "blank-frame"; frame: number; length: number }
  | { kind: "buried-sound"; frame: number; sound: string; under: string; marginDb: number };

export interface CheckReport {
  findings: CheckFinding[];
  /** What was actually measured, so "nothing found" is never claimed for a check that didn't run. */
  checked: { text: boolean; frames: boolean; sound: boolean; soundEffects: number; every: number };
  notes: string[];
}

/** Hold a measured problem this long before calling it one: shorter is motion. */
const MIN_HOLD_SEC = 0.4;

const overlapArea = (a: ProbeBlock, b: ProbeBlock) => {
  let s = 0;
  for (const [ax, ay, aw, ah] of a.r) {
    for (const [bx, by, bw, bh] of b.r) {
      const w = Math.min(ax + aw, bx + bw) - Math.max(ax, bx);
      const h = Math.min(ay + ah, by + bh) - Math.max(ay, by);
      if (w > 0 && h > 0) s += w * h;
    }
  }
  return s;
};
const textArea = (b: ProbeBlock) => b.r.reduce((s, [, , w, h]) => s + w * h, 0);
const norm = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/**
 * Cut-off and overlapping text, from the probe frames.
 *
 * The rule that keeps animation from reading as a bug: a problem only counts
 * while the text is AT REST and on screen, for at least MIN_HOLD_SEC. A
 * headline sliding in from the edge is partly off the frame for a few frames
 * by design; one that has stopped there for half a second is cut off.
 */
export function analyzeLayout(frames: Map<number, ProbeFrame>, fps: number): CheckFinding[] {
  const ordered = [...frames.values()].sort((a, b) => a.f - b.f);
  if (ordered.length < 2) return [];
  const step = Math.max(1, ordered[1].f - ordered[0].f);
  const minFrames = Math.max(2, Math.ceil((MIN_HOLD_SEC * fps) / step));
  const W = ordered[0].w || 1920;
  const tol = Math.max(1.5, 0.002 * W) * step;

  const prevBox = new Map<string, ProbeBlock["b"]>();
  const atRest = (frame: ProbeFrame, b: ProbeBlock) => {
    const prev = prevBox.get(b.k);
    if (!prev) return false;
    return Math.abs(prev[0] - b.b[0]) <= tol && Math.abs(prev[1] - b.b[1]) <= tol &&
      Math.abs(prev[2] - b.b[2]) <= tol && Math.abs(prev[3] - b.b[3]) <= tol;
  };

  type Run = { start: number; last: number; count: number; finding: CheckFinding };
  const open = new Map<string, Run>();
  const done: CheckFinding[] = [];
  const reported = new Set<string>();
  const close = (key: string) => {
    const run = open.get(key);
    open.delete(key);
    if (!run || run.count < minFrames || reported.has(key)) return;
    reported.add(key);
    done.push({ ...run.finding, frame: run.start, untilFrame: run.last } as CheckFinding);
  };
  const extend = (key: string, f: number, make: () => CheckFinding) => {
    const run = open.get(key);
    if (run && f - run.last <= step) { run.last = f; run.count++; return; }
    if (run) close(key);
    open.set(key, { start: f, last: f, count: 1, finding: make() });
  };

  for (const frame of ordered) {
    const live = new Set<string>();
    const resting = frame.blocks.filter((b) => b.o >= 0.5 && atRest(frame, b));
    const H = frame.h || 1080;
    for (const b of resting) {
      // Type far bigger than the frame is a designed bleed, not a mistake.
      const giant = b.b[2] > 1.5 * W || b.b[3] > 1.5 * H;
      if (!giant && b.v > 0.02 && b.v < 0.97 && b.e) {
        const key = `cut:${b.k}`;
        live.add(key);
        extend(key, frame.f, () => ({ kind: "cut-off", frame: frame.f, untilFrame: frame.f, text: b.t, edge: b.e, by: b.c === "box" ? "box" : "canvas" }));
      }
    }
    const solid = resting.filter((b) => b.o >= 0.6);
    for (let i = 0; i < solid.length; i++) {
      for (let j = i + 1; j < solid.length; j++) {
        const a = solid[i], b = solid[j];
        // Nested blocks and duplicated text (a glow or shadow layer drawn as a
        // second copy) overlap on purpose.
        if (a.k.startsWith(`${b.k}.`) || b.k.startsWith(`${a.k}.`)) continue;
        if (a.b[0] >= b.b[0] + b.b[2] || b.b[0] >= a.b[0] + a.b[2] || a.b[1] >= b.b[1] + b.b[3] || b.b[1] >= a.b[1] + a.b[3]) continue;
        if (norm(a.t) === norm(b.t)) continue;
        const shared = overlapArea(a, b);
        if (shared < 0.2 * Math.min(textArea(a), textArea(b))) continue;
        const key = `ovl:${a.k < b.k ? `${a.k}|${b.k}` : `${b.k}|${a.k}`}`;
        live.add(key);
        extend(key, frame.f, () => ({ kind: "overlap", frame: frame.f, untilFrame: frame.f, text: a.t, other: b.t }));
      }
    }
    for (const key of [...open.keys()]) if (!live.has(key)) close(key);
    prevBox.clear();
    for (const b of frame.blocks) prevBox.set(b.k, b.b);
  }
  for (const key of [...open.keys()]) close(key);
  return done.sort((a, b) => a.frame - b.frame);
}

// ── flashes and blank frames, from tiny grey thumbnails ──────────────────────

export const SIG_W = 32;
export const SIG_H = 18;
const CELLS_X = 4;
const CELLS_Y = 3;

/** Mean absolute difference per cell between two thumbnails, 0..255. */
function cellDiffs(a: Uint8Array, b: Uint8Array): number[] {
  const out = new Array(CELLS_X * CELLS_Y).fill(0);
  const cw = SIG_W / CELLS_X, ch = SIG_H / CELLS_Y;
  for (let y = 0; y < SIG_H; y++) {
    for (let x = 0; x < SIG_W; x++) {
      const i = y * SIG_W + x;
      out[Math.floor(y / ch) * CELLS_X + Math.floor(x / cw)] += Math.abs(a[i] - b[i]);
    }
  }
  return out.map((v) => v / (cw * ch));
}

function spread(a: Uint8Array): number {
  let mean = 0;
  for (const v of a) mean += v;
  mean /= a.length;
  let s = 0;
  for (const v of a) s += (v - mean) * (v - mean);
  return Math.sqrt(s / a.length);
}

/**
 * Frames that blink: one or two frames that differ from the frame before AND
 * the frame after, while those two agree with each other. Also a near-uniform
 * frame (black, white, any flat colour) between two frames with content — the
 * one-frame gap left between two clips that don't quite touch, or a scene that
 * renders nothing for a frame.
 *
 * Judged per region of the frame, so a small element popping for one frame is
 * caught too, not only a full-screen flash.
 */
export function analyzeFlashes(sigs: (Uint8Array | null)[]): CheckFinding[] {
  const out: CheckFinding[] = [];
  const BIG = 24;
  let t = 1;
  while (t < sigs.length - 1) {
    let found: CheckFinding | null = null;
    // A near-uniform frame between two with content is a gap, whether or not
    // the shots either side match — check it before calling it a flash.
    {
      const s = sigs[t], before = sigs[t - 1], after = sigs[t + 1];
      if (s && before && after && spread(s) < 2 && spread(before) > 8 && spread(after) > 8) {
        found = { kind: "blank-frame", frame: t, length: 1 };
      }
    }
    for (const len of found ? [] : [1, 2]) {
      const before = sigs[t - 1];
      const after = sigs[t + len];
      const inside = sigs.slice(t, t + len);
      if (!before || !after || inside.length < len || inside.some((s) => !s)) continue;
      const across = cellDiffs(before, after);
      const into = inside.map((s) => cellDiffs(before, s!));
      const outOf = inside.map((s) => cellDiffs(s!, after));
      const flashCell = across.some((d0, c) =>
        inside.every((_, i) => {
          const jump = Math.min(into[i][c], outOf[i][c]);
          return jump >= BIG && d0 <= 0.35 * jump;
        }),
      );
      if (flashCell) { found = { kind: "flash", frame: t, length: len }; break; }
    }
    if (found) {
      out.push(found);
      t += found.kind === "flash" || found.kind === "blank-frame" ? found.length + 1 : 1;
    } else {
      t++;
    }
  }
  return out;
}

// ── sound ────────────────────────────────────────────────────────────────────

/** One sound as the renderer placed it. */
export interface PlacedSound {
  id: string;
  src: string;
  type: "audio" | "video";
  /** Composition frame it starts on. */
  startFrame: number;
  durationFrames: number;
  /** Media frame (at composition fps) where playback starts in the file. */
  trimLeftFrames: number;
  playbackRate: number;
  /** Volume on each frame it plays, 0..1. */
  volumes: number[];
}

interface RawAsset {
  type: string;
  src: string;
  id: string;
  frame: number;
  volume: number;
  mediaFrame: number;
  playbackRate: number;
}

/**
 * Fold the renderer's per-frame asset lists into one entry per sound.
 *
 * Mirrors Remotion's own calculateAssetPositions (which isn't exported): an
 * asset's id is stable while it plays, and an asset that repeats an earlier
 * frame's src is sent as "same-as-<id>-<frame>" to keep the payload small.
 */
export function placeSounds(perFrame: { frame: number; audioAndVideoAssets: RawAsset[] }[]): PlacedSound[] {
  const all = perFrame.flatMap((f) => f.audioAndVideoAssets);
  const srcOf = (a: RawAsset) => {
    const m = a.src.match(/same-as-(.*)-([0-9.]+)$/);
    if (!m) return a.src;
    return all.find((x) => x.id === m[1] && String(x.frame) === m[2])?.src ?? a.src;
  };
  // The run each id is currently in. A gap in frames means a new placement of
  // the same element (a loop, a remount), so it starts a new entry.
  const active = new Map<string, { sound: PlacedSound; lastFrame: number }>();
  const out: PlacedSound[] = [];
  for (const { frame, audioAndVideoAssets } of [...perFrame].sort((a, b) => a.frame - b.frame)) {
    for (const a of audioAndVideoAssets) {
      if (a.type !== "audio" && a.type !== "video") continue;
      const run = active.get(a.id);
      if (run && run.lastFrame === frame - 1) {
        run.lastFrame = frame;
        run.sound.durationFrames++;
        run.sound.volumes.push(a.volume);
        continue;
      }
      const sound: PlacedSound = {
        id: run ? `${a.id}@${frame}` : a.id, src: srcOf(a), type: a.type,
        startFrame: frame, durationFrames: 1, trimLeftFrames: a.mediaFrame,
        playbackRate: a.playbackRate || 1, volumes: [a.volume],
      };
      out.push(sound);
      active.set(a.id, { sound, lastFrame: frame });
    }
  }
  return out.sort((a, b) => a.startFrame - b.startFrame);
}

/** Whether a placed sound is one of the library's effects (public/assets/sfx). */
export function isSoundEffect(src: string): boolean {
  return /\/assets\/sfx\/[^/?#]+$/.test(src.split(/[?#]/)[0]);
}

export function soundName(src: string): string {
  try {
    return decodeURIComponent(path.basename(src.split(/[?#]/)[0]));
  } catch {
    return path.basename(src);
  }
}

/** Peak level, in dB, of `samples` between two times — linear volume applied. */
export type PeakReader = (file: string, fromSec: number, toSec: number, highOnly: boolean) => number;

/**
 * Sound effects buried under the music, voice or footage playing with them.
 *
 * Transient against transient: the effect's own peak (in the window where it
 * hits) against the peak of everything else over the same window. More than
 * 12 dB under is the point where a click or a whoosh stops being heard over a
 * bed — the figure the launch-film kits measured the hard way. It is checked
 * twice, broadband and above 2 kHz, and only reported when BOTH say buried:
 * a crisp click can sit well under a bass-heavy track in level and still cut
 * through it in the top end.
 */
export function analyzeSounds(
  sounds: PlacedSound[],
  fps: number,
  fileOf: (src: string) => string | null,
  peak: PeakReader,
  opts: { buriedDb?: number } = {},
): { findings: CheckFinding[]; effects: number } {
  const buried = opts.buriedDb ?? -12;
  const effects = sounds.filter((s) => isSoundEffect(s.src));
  const beds = sounds.filter((s) => !isSoundEffect(s.src));
  const findings: CheckFinding[] = [];
  const db = (lin: number) => (lin > 0 ? 20 * Math.log10(lin) : -120);

  const mediaSec = (s: PlacedSound, compFrame: number) =>
    (s.trimLeftFrames + (compFrame - s.startFrame) * s.playbackRate) / fps;
  const volumeAt = (s: PlacedSound, compFrame: number) =>
    s.volumes[Math.max(0, Math.min(s.volumes.length - 1, Math.round(compFrame - s.startFrame)))] ?? 0;

  for (const fx of effects) {
    const fxFile = fileOf(fx.src);
    if (!fxFile) continue;
    // The hit window: the first 0.6 s of the effect (or all of it, if shorter).
    const lenFrames = Math.min(fx.durationFrames, Math.round(0.6 * fps));
    const from = fx.startFrame;
    const to = fx.startFrame + Math.max(1, lenFrames);
    const vol = Math.max(...fx.volumes.slice(0, Math.max(1, lenFrames)));
    if (vol <= 0) continue;
    const fxFull = peak(fxFile, mediaSec(fx, from), mediaSec(fx, to), false) + db(vol);
    const fxHigh = peak(fxFile, mediaSec(fx, from), mediaSec(fx, to), true) + db(vol);
    // Nothing in this stretch of the file: an effect remounted after its hit
    // (its tail playing on), not a sound anyone is meant to hear.
    if (fxFull - db(vol) < -50) continue;

    let bedFull = 0, bedHigh = 0;
    let loudest = { name: "", level: -Infinity };
    for (const bed of beds) {
      const a = Math.max(from, bed.startFrame);
      const z = Math.min(to, bed.startFrame + bed.durationFrames);
      if (z <= a) continue;
      const bedFile = fileOf(bed.src);
      if (!bedFile) continue;
      const bv = Math.max(...Array.from({ length: z - a }, (_, i) => volumeAt(bed, a + i)));
      if (bv <= 0) continue;
      const full = peak(bedFile, mediaSec(bed, a), mediaSec(bed, z), false) + db(bv);
      const high = peak(bedFile, mediaSec(bed, a), mediaSec(bed, z), true) + db(bv);
      bedFull += Math.pow(10, full / 10);
      bedHigh += Math.pow(10, high / 10);
      if (full > loudest.level) loudest = { name: soundName(bed.src), level: full };
    }
    if (bedFull <= 0) continue;
    const marginFull = fxFull - 10 * Math.log10(bedFull);
    const marginHigh = bedHigh > 0 ? fxHigh - 10 * Math.log10(bedHigh) : Infinity;
    // An effect with no top end of its own (a sub boom) is judged broadband only.
    const hasTop = fxHigh > fxFull - 30;
    if (marginFull < buried && (!hasTop || marginHigh < buried)) {
      findings.push({
        kind: "buried-sound",
        frame: fx.startFrame,
        sound: soundName(fx.src),
        under: loudest.name,
        marginDb: Math.round(Math.max(marginFull, hasTop ? marginHigh : -Infinity) * 10) / 10,
      });
    }
  }
  return { findings, effects: effects.length };
}

// ── words ────────────────────────────────────────────────────────────────────

export function timeLabel(frame: number, fps: number): string {
  const secs = frame / fps;
  const m = Math.floor(secs / 60);
  return `${m}:${(secs - m * 60).toFixed(1).padStart(4, "0")}`;
}

const EDGE_WORDS: Record<string, string> = { l: "left", r: "right", t: "top", b: "bottom" };

/** One finding as a sentence, for the dialog and the model alike. */
export function describeFinding(f: CheckFinding, fps: number): string {
  const at = timeLabel(f.frame, fps);
  switch (f.kind) {
    case "cut-off": {
      const edges = f.edge.split("").map((e) => EDGE_WORDS[e]).filter(Boolean).join(" and ");
      const where = f.by === "canvas" ? `the ${edges} edge of the frame` : `its box (${edges} side)`;
      return `${at}–${timeLabel(f.untilFrame, fps)} · "${f.text}" is cut off by ${where}`;
    }
    case "overlap":
      return `${at}–${timeLabel(f.untilFrame, fps)} · "${f.text}" overlaps "${f.other}"`;
    case "flash":
      return `${at} · ${f.length === 1 ? "one frame" : `${f.length} frames`} flash and jump back`;
    case "blank-frame":
      return `${at} · a single blank frame — nothing on screen for one frame`;
    case "buried-sound":
      return `${at} · ${f.sound} is ${Math.abs(f.marginDb).toFixed(0)} dB under ${f.under || "the soundtrack"} — nobody will hear it`;
  }
}

/** The report as a block of text for the model's tool result. */
export function reportForModel(report: CheckReport, fps: number): string {
  const ran: string[] = [];
  if (report.checked.text) ran.push("text clipping and overlap");
  if (report.checked.frames) ran.push("one-frame flashes and blank frames");
  if (report.checked.sound) ran.push("whether every sound effect can be heard");
  if (!ran.length) return "";
  const head = `MEASURED CHECKS — measured on ${report.checked.every === 1 ? "every frame" : `every ${report.checked.every}th frame`}, not judged by eye (${ran.join("; ")}):`;
  if (!report.findings.length) return `${head}\n- Nothing found.${report.notes.length ? `\n${report.notes.map((n) => `- ${n}`).join("\n")}` : ""}`;
  const lines = report.findings.slice(0, 12).map((f) => `- ${describeFinding(f, fps)}`);
  if (report.findings.length > 12) lines.push(`- …and ${report.findings.length - 12} more of the same kinds.`);
  return `${head}\n${lines.join("\n")}${report.notes.length ? `\n${report.notes.map((n) => `- ${n}`).join("\n")}` : ""}\nFix every one of these unless it is clearly deliberate (a full-bleed type crop, a designed glitch). Text that is cut off or overlapping caps readability below 8.`;
}
