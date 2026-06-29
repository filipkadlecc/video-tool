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
export function docFromCode(code: string, fps: number): EditableDoc | null {
  if (!code || !code.trim()) return null;
  const parsed = parseTimeline(code, fps);
  if (parsed.length === 0) return null;

  const videoClips = parsed.filter((c) => c.type === "video");
  const sceneClips = parsed.filter((c) => c.type === "scene");
  const hasAudio = parsed.some((c) => c.type === "audio");

  // Video-only composition → video mode (legacy behaviour).
  if (videoClips.length > 0 && sceneClips.length === 0 && !hasAudio) {
    const clips = videoClips.map((c, i) => toEditableVideo(c, i));
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

function toEditableVideo(c: TimelineClip, i: number): EditableClip {
  return {
    id: makeId(c.src, i),
    kind: "video",
    src: c.src,
    from: c.from,
    durationInFrames: c.durationInFrames,
    startFrom: c.startFrom,
    endAt: c.endAt,
  };
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
    const newDuration = Math.max(1, c.durationInFrames + deltaFrames);
    const actualDelta = newDuration - c.durationInFrames;
    return {
      ...c,
      durationInFrames: newDuration,
      endAt: c.endAt != null ? c.endAt + actualDelta : c.endAt,
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
    // there's no source-media constraint.
    const maxLeftGrowth = c.kind === "scene" ? c.from : Math.min(c.from, startFromBase);
    const minDelta = -maxLeftGrowth;
    const maxDelta = c.durationInFrames - 1;
    const clamped = Math.max(minDelta, Math.min(maxDelta, deltaFrames));
    return {
      ...c,
      from: c.from + clamped,
      durationInFrames: c.durationInFrames - clamped,
      startFrom: c.startFrom != null ? startFromBase + clamped : c.startFrom,
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
    clip.startFrom != null ? clip.startFrom + localFrame : undefined;
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
