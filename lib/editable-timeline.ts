import { parseTimeline, type TimelineClip } from "./timeline-parser";

/**
 * The "editable timeline" is a structured doc that round-trips with code via
 * docFromCode / codeFromDoc. We use it for direct-manipulation drag/trim/split
 * on top of the existing parseTimeline foundation.
 *
 * Lossiness: docFromCode only captures video clips that the regex parser
 * recognises. Anything else (custom components, text overlays, transitions,
 * audio clips) is dropped on round-trip. We surface this as `compatible: false`
 * so the UI can fall back to read-only mode for compositions that wouldn't
 * survive a serialise.
 */

export interface EditableClip {
  id: string;
  src: string;
  from: number; // frames into the composition
  durationInFrames: number;
  startFrom?: number; // trim start in source media (frames)
  endAt?: number; // trim end in source media (frames)
}

export interface EditableDoc {
  fps: number;
  clips: EditableClip[];
  totalDurationInFrames: number;
}

function makeId(src: string, index: number): string {
  // Stable enough for a session; we regenerate on each parse so collisions
  // across edits are not a concern.
  const safe = src.replace(/[^a-zA-Z0-9]/g, "_").slice(-24);
  return `${safe}_${index}`;
}

/**
 * Returns null if the code doesn't contain a recognisable, editable set of
 * video clips. Audio/scene/overlay-only compositions are rejected so we don't
 * silently strip content on round-trip.
 */
export function docFromCode(code: string, fps: number): EditableDoc | null {
  if (!code || !code.trim()) return null;
  const parsed = parseTimeline(code, fps);
  const videoClips = parsed.filter((c) => c.type === "video");
  if (videoClips.length === 0) return null;

  // We only consider it "editable" if the parsed video clips are the only
  // notable content. If there are scene clips alongside, the round-trip would
  // drop them — back off to read-only.
  const hasNonVideo = parsed.some((c) => c.type === "scene" || c.type === "audio");
  if (hasNonVideo) return null;

  const clips = videoClips.map((c, i) => toEditable(c, i));
  const totalDurationInFrames = Math.max(
    0,
    ...clips.map((c) => c.from + c.durationInFrames)
  );
  return { fps, clips, totalDurationInFrames };
}

function toEditable(c: TimelineClip, i: number): EditableClip {
  return {
    id: makeId(c.src, i),
    src: c.src,
    from: c.from,
    durationInFrames: c.durationInFrames,
    startFrom: c.startFrom,
    endAt: c.endAt,
  };
}

/**
 * Emit a fresh Remotion composition from the doc. We always use absolute
 * `<Sequence from durationInFrames>` blocks so positions are independent —
 * this is the canonical form for drag-to-reposition. SmartTrim's `Series`
 * output is converted to this form on first edit.
 */
export function codeFromDoc(doc: EditableDoc): string {
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
    ...sorted.map((c) => c.from + c.durationInFrames)
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

export function moveClip(doc: EditableDoc, clipId: string, deltaFrames: number): EditableDoc {
  const clips = doc.clips.map((c) =>
    c.id === clipId ? { ...c, from: Math.max(0, c.from + deltaFrames) } : c
  );
  const totalDurationInFrames = Math.max(
    0,
    ...clips.map((c) => c.from + c.durationInFrames)
  );
  return { ...doc, clips, totalDurationInFrames };
}
