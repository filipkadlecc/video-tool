import {
  parseTimeline,
  parseSequenceBlocks,
  type TimelineClip,
} from "./timeline-parser";

/**
 * The "editable timeline" is a structured doc that round-trips with code via
 * docFromCode / codeFromDoc. We use it for direct-manipulation drag/trim/split
 * on top of the existing parseTimeline foundation.
 *
 * Two modes:
 *   - video mode  — composition is `<Video src=...>` clips; codeFromDoc
 *                   regenerates the whole file from the doc.
 *   - scene mode  — composition is hand-written `<Sequence>` JSX (animation /
 *                   broll / svg projects). codeFromDoc patches numeric
 *                   attributes in the original source so user JSX is preserved.
 */

export interface EditableClip {
  id: string;
  kind: "video" | "scene";
  // Video mode only — undefined for scenes.
  src?: string;
  from: number; // frames into the composition
  durationInFrames: number;
  startFrom?: number; // trim start in source media (frames)
  endAt?: number; // trim end in source media (frames)
  // Video mode only — the source file's native fps (from ffprobe). Trim/split
  // convert composition-frame deltas to source-frame deltas using this, because
  // startFrom/endAt are counted in SOURCE frames while from/durationInFrames are
  // COMPOSITION frames. Undefined ⇒ assume native fps == composition fps.
  nativeFps?: number;
  // Video mode only — the source file's last frame (ffprobe nbFrames). A trim can
  // never extend endAt past this, so a clip can't read into frozen/black frames.
  maxSourceFrame?: number;
  // Scene mode only — byte offsets into `EditableDoc.originalCode` for the
  // whole `<Sequence>...</Sequence>` block and the attribute value slices.
  sourceRange?: { start: number; end: number };
  fromAttrRange?: { start: number; end: number };
  durationAttrRange?: { start: number; end: number };
}

export interface EditableDoc {
  mode: "video" | "scene";
  fps: number;
  clips: EditableClip[];
  totalDurationInFrames: number;
  // Scene mode only — the source the offsets in `clips[*].*Range` point into.
  originalCode?: string;
}

function makeId(srcOrTag: string, index: number): string {
  const safe = srcOrTag.replace(/[^a-zA-Z0-9]/g, "_").slice(-24);
  return `${safe}_${index}`;
}

/**
 * Returns null if the code doesn't contain a recognisable, editable
 * composition. Falls back to read-only for mixed video+scene compositions and
 * for compositions using TransitionSeries.Sequence / Series.Sequence (those
 * have implicit `from` derived from running totals — patching one attribute
 * can't reposition the rest).
 */
export function docFromCode(
  code: string,
  fps: number,
  nativeFpsBySrc?: Record<string, number>,
  maxSrcFrameBySrc?: Record<string, number>,
): EditableDoc | null {
  if (!code || !code.trim()) return null;
  const parsed = parseTimeline(code, fps);
  if (parsed.length === 0) return null;

  const videoClips = parsed.filter((c) => c.type === "video");
  const sceneClips = parsed.filter((c) => c.type === "scene");
  const hasAudio = parsed.some((c) => c.type === "audio");

  // Video-only composition → video mode (legacy behaviour).
  if (videoClips.length > 0 && sceneClips.length === 0 && !hasAudio) {
    // Safety guard: `codeFromVideoDoc` regenerates the file as plain back-to-back
    // `<Sequence>` blocks. If the source actually uses <TransitionSeries>, that
    // regeneration would DELETE the transitions (and their frame overlaps) on the
    // first edit. Bail to read-only so blended edits are preserved — they can
    // still be edited via chat / the code panel. (Series.Sequence from Smart Trim
    // has no transitions, so flattening it is lossless and stays editable.)
    if (/<TransitionSeries\b/.test(code)) return null;
    const clips = videoClips.map((c, i) => toEditableVideo(c, i, nativeFpsBySrc, maxSrcFrameBySrc));
    const totalDurationInFrames = Math.max(
      0,
      ...clips.map((c) => c.from + c.durationInFrames),
    );
    return { mode: "video", fps, clips, totalDurationInFrames };
  }

  // Scene-only composition → scene mode (source-patching).
  if (sceneClips.length > 0 && videoClips.length === 0 && !hasAudio) {
    const blocks = parseSequenceBlocks(code, fps);
    if (blocks.length === 0) return null;
    // Bail if any Sequence's attribute isn't a bare integer — we can't
    // round-trip arithmetic expressions like `from={INTRO + 30}` losslessly.
    if (blocks.some((b) => b.hasNonNumericFrom || b.hasNonNumericDuration)) {
      return null;
    }
    const clips: EditableClip[] = blocks.map((b, i) => ({
      id: makeId("scene", i),
      kind: "scene",
      from: b.from,
      durationInFrames: b.durationInFrames,
      sourceRange: { start: b.blockStart, end: b.blockEnd },
      fromAttrRange: { start: b.fromValueStart, end: b.fromValueEnd },
      durationAttrRange: { start: b.durationValueStart, end: b.durationValueEnd },
    }));
    const totalDurationInFrames = Math.max(
      0,
      ...clips.map((c) => c.from + c.durationInFrames),
    );
    return {
      mode: "scene",
      fps,
      clips,
      totalDurationInFrames,
      originalCode: code,
    };
  }

  return null;
}

function toEditableVideo(
  c: TimelineClip,
  i: number,
  nativeFpsBySrc?: Record<string, number>,
  maxSrcFrameBySrc?: Record<string, number>,
): EditableClip {
  return {
    id: makeId(c.src, i),
    kind: "video",
    src: c.src,
    from: c.from,
    durationInFrames: c.durationInFrames,
    startFrom: c.startFrom,
    endAt: c.endAt,
    nativeFps: nativeFpsBySrc?.[c.src],
    maxSourceFrame: maxSrcFrameBySrc?.[c.src],
  };
}

/**
 * Convert a composition-frame delta into a source-media-frame delta for a clip.
 * `startFrom`/`endAt` are counted in the source file's native fps, while drag
 * deltas arrive in composition frames — so they must be scaled when the two fps
 * differ. Falls back to 1:1 when the native fps is unknown or equal.
 */
function compDeltaToSource(clip: EditableClip, deltaComp: number, compFps: number): number {
  const native = clip.nativeFps;
  if (!native || native === compFps || compFps <= 0) return deltaComp;
  return Math.round((deltaComp * native) / compFps);
}

/** Inverse of compDeltaToSource: source frames → composition frames. */
function sourceDeltaToComp(clip: EditableClip, deltaSource: number, compFps: number): number {
  const native = clip.nativeFps;
  if (!native || native === compFps || native <= 0) return deltaSource;
  return Math.round((deltaSource * compFps) / native);
}

/**
 * Editability with a human-readable reason. When `docFromCode` returns null we
 * classify WHY so the timeline can tell the user (e.g. "blended transitions")
 * instead of silently disabling editing. Navigation (scrub/zoom/playhead) still
 * works regardless of the reason.
 */
export function analyzeEditability(
  code: string,
  fps: number,
  nativeFpsBySrc?: Record<string, number>,
  maxSrcFrameBySrc?: Record<string, number>,
): { doc: EditableDoc | null; reason: string | null } {
  const doc = docFromCode(code, fps, nativeFpsBySrc, maxSrcFrameBySrc);
  if (doc) return { doc, reason: null };
  if (!code || !code.trim()) return { doc: null, reason: null };
  const parsed = parseTimeline(code, fps);
  if (parsed.length === 0) return { doc: null, reason: null };
  if (/<TransitionSeries\b/.test(code)) {
    return { doc: null, reason: "Blended transitions — edit via chat or the code panel" };
  }
  const hasAudio = parsed.some((c) => c.type === "audio");
  const hasVideo = parsed.some((c) => c.type === "video");
  const hasScene = parsed.some((c) => c.type === "scene");
  if (hasAudio) return { doc: null, reason: "Has an audio track — view-only for now" };
  if (hasVideo && hasScene) return { doc: null, reason: "Mixes clips and overlays — edit via chat or code" };
  return { doc: null, reason: "Uses calculated timings — edit via chat or the code panel" };
}

/**
 * Emit code from the doc. Video mode regenerates the whole file; scene mode
 * patches the original source so user-authored JSX inside each Sequence is
 * preserved byte-for-byte.
 */
export function codeFromDoc(doc: EditableDoc): string {
  if (doc.mode === "scene") return codeFromSceneDoc(doc);
  return codeFromVideoDoc(doc);
}

function codeFromVideoDoc(doc: EditableDoc): string {
  const sorted = [...doc.clips].sort((a, b) => a.from - b.from);
  const sequences = sorted
    .map((c) => {
      const startFromAttr = c.startFrom != null ? ` startFrom={${c.startFrom}}` : "";
      const endAtAttr = c.endAt != null ? ` endAt={${c.endAt}}` : "";
      return `      <Sequence from={${c.from}} durationInFrames={${c.durationInFrames}}>
        <Video src=${JSON.stringify(c.src)}${startFromAttr}${endAtAttr} />
      </Sequence>`;
    })
    .join("\n");

  const totalFrames = Math.max(
    1,
    ...sorted.map((c) => c.from + c.durationInFrames),
  );

  return `import React from "react";
import { AbsoluteFill, Sequence, Video } from "remotion";

export const fps = ${doc.fps};
export const durationInFrames = ${totalFrames};

// Composed via the editable timeline. Each <Sequence> is independently
// positioned — drag clips on the timeline to reposition, drag edges to trim.

const Composition: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
${sequences}
  </AbsoluteFill>
);

export default Composition;
`;
}

function codeFromSceneDoc(doc: EditableDoc): string {
  if (!doc.originalCode) throw new Error("scene doc missing originalCode");
  // Collect every numeric replacement, sort by offset descending, splice them
  // in so the offsets stay valid as we go.
  type Edit = { start: number; end: number; replacement: string };
  const edits: Edit[] = [];
  for (const c of doc.clips) {
    if (!c.fromAttrRange || !c.durationAttrRange) continue;
    edits.push({
      start: c.fromAttrRange.start,
      end: c.fromAttrRange.end,
      replacement: String(c.from),
    });
    edits.push({
      start: c.durationAttrRange.start,
      end: c.durationAttrRange.end,
      replacement: String(c.durationInFrames),
    });
  }
  edits.sort((a, b) => b.start - a.start);

  let out = doc.originalCode;
  for (const e of edits) {
    out = out.slice(0, e.start) + e.replacement + out.slice(e.end);
  }

  // Also update the top-level `export const durationInFrames = N` if present,
  // so the player extends to fit the new composition length.
  const total = Math.max(
    1,
    ...doc.clips.map((c) => c.from + c.durationInFrames),
  );
  out = out.replace(
    /(export\s+(?:const|let|var)\s+durationInFrames\s*=\s*)\d+/,
    `$1${total}`,
  );
  return out;
}

export function moveClip(doc: EditableDoc, clipId: string, deltaFrames: number): EditableDoc {
  const clips = doc.clips.map((c) =>
    c.id === clipId ? { ...c, from: Math.max(0, c.from + deltaFrames) } : c,
  );
  const totalDurationInFrames = Math.max(
    0,
    ...clips.map((c) => c.from + c.durationInFrames),
  );
  return { ...doc, clips, totalDurationInFrames };
}

/**
 * Drag right edge: shrink/grow the clip from its tail. Keeps `from` fixed.
 * For video clips with a tail-trim (`endAt`), shift it by the same delta so
 * the source-media trim stays consistent. Scene clips have no `endAt`.
 */
export function trimClipRight(doc: EditableDoc, clipId: string, deltaFrames: number): EditableDoc {
  const clips = doc.clips.map((c) => {
    if (c.id !== clipId) return c;
    let newDuration = Math.max(1, c.durationInFrames + deltaFrames);
    // Clamp growth so the clip can't read past the source's last frame (which
    // would render a frozen/black tail). Works whether or not endAt is present:
    // the current source-out point is endAt, else startFrom + (duration in source frames).
    if (c.maxSourceFrame != null) {
      const currentSourceEnd =
        c.endAt != null ? c.endAt : (c.startFrom ?? 0) + compDeltaToSource(c, c.durationInFrames, doc.fps);
      const maxGrowthSource = Math.max(0, c.maxSourceFrame - currentSourceEnd);
      const maxDuration = c.durationInFrames + sourceDeltaToComp(c, maxGrowthSource, doc.fps);
      if (newDuration > maxDuration) newDuration = Math.max(1, maxDuration);
    }
    const actualDelta = newDuration - c.durationInFrames;
    return {
      ...c,
      durationInFrames: newDuration,
      endAt: c.endAt != null ? c.endAt + compDeltaToSource(c, actualDelta, doc.fps) : c.endAt,
    };
  });
  const totalDurationInFrames = Math.max(
    0,
    ...clips.map((c) => c.from + c.durationInFrames),
  );
  return { ...doc, clips, totalDurationInFrames };
}

/**
 * Drag left edge: shift the clip's start point. For video clips this also
 * eats into the source media's head via `startFrom` so the same frame plays
 * after the drag. For scene clips `startFrom` is undefined; the scene JSX is
 * a self-contained timeline that renders from frame 0 of its Sequence — so
 * "trim left" simply changes when the scene starts.
 */
export function trimClipLeft(doc: EditableDoc, clipId: string, deltaFrames: number): EditableDoc {
  const clips = doc.clips.map((c) => {
    if (c.id !== clipId) return c;
    const startFromBase = c.startFrom ?? 0;
    // For scenes we can grow leftward as long as `from` doesn't go negative;
    // there's no source-media constraint. For video the leftward growth is also
    // bounded by how much un-trimmed source HEAD exists (startFromBase, in source
    // frames — convert to composition frames so the two limits share a unit).
    const native = c.nativeFps && c.nativeFps > 0 ? c.nativeFps : doc.fps;
    const startFromBaseComp = Math.floor((startFromBase * doc.fps) / native);
    const maxLeftGrowth = c.kind === "scene" ? c.from : Math.min(c.from, startFromBaseComp);
    const minDelta = -maxLeftGrowth;
    const maxDelta = c.durationInFrames - 1;
    const clamped = Math.max(minDelta, Math.min(maxDelta, deltaFrames));
    return {
      ...c,
      from: c.from + clamped,
      durationInFrames: c.durationInFrames - clamped,
      startFrom: c.startFrom != null ? startFromBase + compDeltaToSource(c, clamped, doc.fps) : c.startFrom,
    };
  });
  const totalDurationInFrames = Math.max(
    0,
    ...clips.map((c) => c.from + c.durationInFrames),
  );
  return { ...doc, clips, totalDurationInFrames };
}

/**
 * Split a clip at `atFrame` (absolute composition frame). For scene clips,
 * duplicates the Sequence text block so the user's JSX is preserved on both
 * halves; the doc is re-derived from the rewritten code so attribute offsets
 * stay accurate for subsequent edits.
 */
export function splitClip(
  doc: EditableDoc,
  clipId: string,
  atFrame: number,
): EditableDoc {
  const clip = doc.clips.find((c) => c.id === clipId);
  if (!clip) return doc;
  const localFrame = atFrame - clip.from;
  if (localFrame <= 0 || localFrame >= clip.durationInFrames) return doc;

  if (doc.mode === "scene") {
    if (!doc.originalCode || !clip.sourceRange) return doc;
    const original = doc.originalCode;
    // First, patch the current clip's attributes to the head half's values
    // and emit a code-from-doc-style edit set for ALL clips. Then splice in a
    // duplicate of the (newly patched) Sequence block for the tail half.
    const headDuration = localFrame;
    const tailFrom = clip.from + localFrame;
    const tailDuration = clip.durationInFrames - localFrame;

    // Apply attribute patches for all clips (head half for the split one).
    type Edit = { start: number; end: number; replacement: string };
    const edits: Edit[] = [];
    for (const c of doc.clips) {
      if (!c.fromAttrRange || !c.durationAttrRange) continue;
      const isSplit = c.id === clipId;
      edits.push({
        start: c.fromAttrRange.start,
        end: c.fromAttrRange.end,
        replacement: String(c.from),
      });
      edits.push({
        start: c.durationAttrRange.start,
        end: c.durationAttrRange.end,
        replacement: isSplit ? String(headDuration) : String(c.durationInFrames),
      });
    }
    edits.sort((a, b) => b.start - a.start);
    let patched = original;
    for (const e of edits) {
      patched = patched.slice(0, e.start) + e.replacement + patched.slice(e.end);
    }

    // Re-locate the split clip's block in the patched source by re-parsing.
    const reparsed = parseSequenceBlocks(patched, doc.fps);
    const splitIdx = doc.clips
      .filter((c) => c.kind === "scene")
      .findIndex((c) => c.id === clipId);
    const splitBlock = reparsed[splitIdx];
    if (!splitBlock) return doc;
    const headText = patched.slice(splitBlock.blockStart, splitBlock.blockEnd);

    // Build the tail Sequence text by rewriting just the attribute values in
    // the head block (offsets relative to `headText`).
    const relFromStart = splitBlock.fromValueStart - splitBlock.blockStart;
    const relFromEnd = splitBlock.fromValueEnd - splitBlock.blockStart;
    const relDurStart = splitBlock.durationValueStart - splitBlock.blockStart;
    const relDurEnd = splitBlock.durationValueEnd - splitBlock.blockStart;
    // Apply right-to-left to keep relative offsets valid.
    const relEdits = [
      { start: relFromStart, end: relFromEnd, replacement: String(tailFrom) },
      { start: relDurStart, end: relDurEnd, replacement: String(tailDuration) },
    ].sort((a, b) => b.start - a.start);
    let tailText = headText;
    for (const e of relEdits) {
      tailText = tailText.slice(0, e.start) + e.replacement + tailText.slice(e.end);
    }

    // Insert the tail block immediately after the head block. Reuse the
    // indentation that preceded the head block so the duplicate lines up.
    const insertAt = splitBlock.blockEnd;
    const newline = patched.includes("\r\n") ? "\r\n" : "\n";
    const lineStart = patched.lastIndexOf("\n", splitBlock.blockStart - 1) + 1;
    const indent = patched.slice(lineStart, splitBlock.blockStart);
    const nextCode =
      patched.slice(0, insertAt) + newline + indent + tailText + patched.slice(insertAt);

    // Also bump the top-level `durationInFrames` export if present.
    const total = Math.max(
      1,
      ...doc.clips.map((c) =>
        c.id === clipId ? Math.max(clip.from + headDuration, tailFrom + tailDuration) : c.from + c.durationInFrames,
      ),
    );
    const withTotal = nextCode.replace(
      /(export\s+(?:const|let|var)\s+durationInFrames\s*=\s*)\d+/,
      `$1${total}`,
    );

    const rebuilt = docFromCode(withTotal, doc.fps);
    return rebuilt ?? doc;
  }

  // Video mode: duplicate the clip with adjusted from / duration /
  // startFrom / endAt.
  const headDuration = localFrame;
  const tailFrom = clip.from + localFrame;
  const tailDuration = clip.durationInFrames - localFrame;
  const tailStartFrom =
    clip.startFrom != null ? clip.startFrom + compDeltaToSource(clip, localFrame, doc.fps) : undefined;
  const newClips: EditableClip[] = [];
  for (const c of doc.clips) {
    if (c.id !== clipId) {
      newClips.push(c);
      continue;
    }
    newClips.push({ ...c, durationInFrames: headDuration });
    newClips.push({
      ...c,
      id: `${c.id}_split`,
      from: tailFrom,
      durationInFrames: tailDuration,
      startFrom: tailStartFrom,
      endAt: c.endAt,
    });
  }
  const totalDurationInFrames = Math.max(
    0,
    ...newClips.map((c) => c.from + c.durationInFrames),
  );
  return { ...doc, clips: newClips, totalDurationInFrames };
}

/**
 * Ripple delete: remove a clip and slide everything after it left to close the
 * gap (Final Cut / Premiere ripple-delete). No black gap is left behind.
 */
export function rippleDeleteClip(doc: EditableDoc, clipId: string): EditableDoc {
  const deleted = doc.clips.find((c) => c.id === clipId);
  if (!deleted) return doc;
  const shift = deleted.durationInFrames;

  if (doc.mode === "video") {
    const clips = doc.clips
      .filter((c) => c.id !== clipId)
      .map((c) => (c.from >= deleted.from ? { ...c, from: Math.max(0, c.from - shift) } : c));
    const totalDurationInFrames = Math.max(0, ...clips.map((c) => c.from + c.durationInFrames), 0);
    return { ...doc, clips, totalDurationInFrames };
  }

  // Scene mode — splice the deleted block out of the source, then re-patch the
  // shifted `from` (and durations) of every surviving clip, and re-derive so
  // byte offsets stay valid.
  if (!doc.originalCode || !deleted.sourceRange) return doc;
  const remaining = doc.clips
    .filter((c) => c.id !== clipId)
    .map((c) => (c.from >= deleted.from ? { ...c, from: Math.max(0, c.from - shift) } : c));

  type Edit = { start: number; end: number; replacement: string };
  const edits: Edit[] = [];
  // Delete the whole block, expanding to swallow its own line so no blank line
  // is left behind.
  const src = doc.originalCode;
  let delStart = deleted.sourceRange.start;
  let delEnd = deleted.sourceRange.end;
  const lineStart = src.lastIndexOf("\n", delStart - 1) + 1;
  if (/^\s*$/.test(src.slice(lineStart, delStart))) delStart = lineStart;
  while (delEnd < src.length && (src[delEnd] === " " || src[delEnd] === "\t")) delEnd++;
  if (src[delEnd] === "\r") delEnd++;
  if (src[delEnd] === "\n") delEnd++;
  edits.push({ start: delStart, end: delEnd, replacement: "" });
  // Re-patch survivors' attribute values.
  for (const c of remaining) {
    if (!c.fromAttrRange || !c.durationAttrRange) continue;
    edits.push({ start: c.fromAttrRange.start, end: c.fromAttrRange.end, replacement: String(c.from) });
    edits.push({ start: c.durationAttrRange.start, end: c.durationAttrRange.end, replacement: String(c.durationInFrames) });
  }
  edits.sort((a, b) => b.start - a.start);
  let out = src;
  for (const e of edits) out = out.slice(0, e.start) + e.replacement + out.slice(e.end);
  const total = Math.max(1, ...remaining.map((c) => c.from + c.durationInFrames), 1);
  out = out.replace(/(export\s+(?:const|let|var)\s+durationInFrames\s*=\s*)\d+/, `$1${total}`);
  return docFromCode(out, doc.fps) ?? doc;
}

/**
 * Ripple-delete several clips at once (multi-select). Each surviving clip slides
 * left by the total duration of removed clips that were before it — the same
 * gap-closing semantics as single ripple, applied atomically.
 */
export function rippleDeleteClips(doc: EditableDoc, ids: string[]): EditableDoc {
  const idSet = new Set(ids);
  const removed = doc.clips.filter((c) => idSet.has(c.id));
  if (removed.length === 0) return doc;
  const shiftFor = (from: number) => removed.filter((r) => r.from < from).reduce((s, r) => s + r.durationInFrames, 0);

  if (doc.mode === "video") {
    const clips = doc.clips
      .filter((c) => !idSet.has(c.id))
      .map((c) => ({ ...c, from: Math.max(0, c.from - shiftFor(c.from)) }));
    const totalDurationInFrames = Math.max(0, ...clips.map((c) => c.from + c.durationInFrames), 0);
    return { ...doc, clips, totalDurationInFrames };
  }

  if (!doc.originalCode) return doc;
  const src = doc.originalCode;
  const kept = doc.clips
    .filter((c) => !idSet.has(c.id))
    .map((c) => ({ ...c, from: Math.max(0, c.from - shiftFor(c.from)) }));

  type Edit = { start: number; end: number; replacement: string };
  const edits: Edit[] = [];
  for (const r of removed) {
    if (!r.sourceRange) continue;
    let delStart = r.sourceRange.start;
    let delEnd = r.sourceRange.end;
    const lineStart = src.lastIndexOf("\n", delStart - 1) + 1;
    if (/^\s*$/.test(src.slice(lineStart, delStart))) delStart = lineStart;
    while (delEnd < src.length && (src[delEnd] === " " || src[delEnd] === "\t")) delEnd++;
    if (src[delEnd] === "\r") delEnd++;
    if (src[delEnd] === "\n") delEnd++;
    edits.push({ start: delStart, end: delEnd, replacement: "" });
  }
  for (const c of kept) {
    if (!c.fromAttrRange || !c.durationAttrRange) continue;
    edits.push({ start: c.fromAttrRange.start, end: c.fromAttrRange.end, replacement: String(c.from) });
    edits.push({ start: c.durationAttrRange.start, end: c.durationAttrRange.end, replacement: String(c.durationInFrames) });
  }
  edits.sort((a, b) => b.start - a.start);
  let out = src;
  for (const e of edits) out = out.slice(0, e.start) + e.replacement + out.slice(e.end);
  const total = Math.max(1, ...kept.map((c) => c.from + c.durationInFrames), 1);
  out = out.replace(/(export\s+(?:const|let|var)\s+durationInFrames\s*=\s*)\d+/, `$1${total}`);
  return docFromCode(out, doc.fps) ?? doc;
}

/**
 * Reorder a clip into a new position, laid out gaplessly in visual (by-`from`)
 * order. Matches how NLE reordering works — dropping a clip re-packs the row.
 */
export function reorderClip(doc: EditableDoc, clipId: string, targetIndex: number): EditableDoc {
  const sorted = [...doc.clips].sort((a, b) => a.from - b.from);
  const fromIdx = sorted.findIndex((c) => c.id === clipId);
  if (fromIdx === -1) return doc;
  const [moved] = sorted.splice(fromIdx, 1);
  const clamped = Math.max(0, Math.min(sorted.length, targetIndex));
  sorted.splice(clamped, 0, moved);
  // Re-pack `from` as a running total in the new order.
  let run = 0;
  const relaid = sorted.map((c) => {
    const nc = { ...c, from: run };
    run += c.durationInFrames;
    return nc;
  });
  const totalDurationInFrames = Math.max(0, ...relaid.map((c) => c.from + c.durationInFrames), 0);
  // Pure: only `from` values change (source blocks stay put), so codeFromDoc can
  // emit correctly for both video and scene mode without re-deriving.
  return { ...doc, clips: relaid, totalDurationInFrames };
}

/**
 * Re-pack all clips gaplessly in visual (by-`from`) order, preserving order.
 * Keeps the timeline magnetic after an in-place trim so no black gap opens up
 * (a trimmed clip's neighbours slide to close the space — ripple trim).
 */
export function repack(doc: EditableDoc): EditableDoc {
  const sorted = [...doc.clips].sort((a, b) => a.from - b.from);
  let run = 0;
  const relaid = sorted.map((c) => {
    const nc = { ...c, from: run };
    run += c.durationInFrames;
    return nc;
  });
  const totalDurationInFrames = Math.max(0, ...relaid.map((c) => c.from + c.durationInFrames), 0);
  return { ...doc, clips: relaid, totalDurationInFrames };
}

/**
 * Snap candidates for dragging/trimming: every OTHER clip's edges, the ends of
 * the timeline, and (optionally) the playhead. Callers snap the manipulated edge
 * to the nearest of these within a pixel-derived threshold.
 */
export function getSnapTargets(
  doc: EditableDoc,
  opts: { excludeClipId?: string; playhead?: number } = {},
): number[] {
  const t = new Set<number>([0, doc.totalDurationInFrames]);
  for (const c of doc.clips) {
    if (c.id === opts.excludeClipId) continue;
    t.add(c.from);
    t.add(c.from + c.durationInFrames);
  }
  if (opts.playhead != null) t.add(Math.round(opts.playhead));
  return [...t].sort((a, b) => a - b);
}

export function snapFrame(
  frame: number,
  targets: number[],
  threshold: number,
): { frame: number; snapped: number | null } {
  let best: number | null = null;
  let bestDist = threshold + 1;
  for (const tg of targets) {
    const d = Math.abs(tg - frame);
    if (d <= threshold && d < bestDist) {
      best = tg;
      bestDist = d;
    }
  }
  return best != null ? { frame: best, snapped: best } : { frame, snapped: null };
}
