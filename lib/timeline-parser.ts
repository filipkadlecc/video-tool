export interface TimelineClip {
  name: string;
  src: string;
  from: number;
  durationInFrames: number;
  startFrom?: number;
  endAt?: number;
  type: "video" | "audio" | "image" | "scene";
}

// Palette for clip colors
const CLIP_COLORS = [
  "oklch(0.72 0.26 340)",  // magenta
  "oklch(0.82 0.14 210)",  // cyan
  "oklch(0.82 0.16 75)",   // amber
  "oklch(0.88 0.22 124)",  // lime
  "oklch(0.72 0.20 280)",  // purple
  "oklch(0.78 0.18 160)",  // teal
];

export function getClipColor(index: number): string {
  return CLIP_COLORS[index % CLIP_COLORS.length];
}

function extractFilename(src: string): string {
  const parts = src.split("/");
  return parts[parts.length - 1] || src;
}

function resolveNumericExpr(expr: string, constants: Record<string, number>): number | null {
  // Trim
  let s = expr.trim();

  // Direct number
  if (/^\d+$/.test(s)) return parseInt(s, 10);

  // Simple math: "150 + 300", "TRANSITION + 200", etc.
  // Replace known constants
  for (const [name, value] of Object.entries(constants)) {
    s = s.replace(new RegExp(`\\b${name}\\b`, "g"), String(value));
  }

  // Try to evaluate simple arithmetic
  if (/^[\d\s+\-*/().]+$/.test(s)) {
    try {
      const result = Function(`"use strict"; return (${s})`)();
      if (typeof result === "number" && !isNaN(result)) return Math.round(result);
    } catch {
      // fallback
    }
  }

  return null;
}

/**
 * Source-mapped view of a `<Sequence from={N} durationInFrames={N}>...</Sequence>`
 * block. Used by the editable-timeline scene mode to patch numeric attributes
 * in place without regenerating the whole composition.
 *
 * Only handles plain `<Sequence>`; `TransitionSeries.Sequence` /
 * `Series.Sequence` are excluded because their `from` is implicit.
 */
export interface SequenceBlock {
  from: number;
  durationInFrames: number;
  blockStart: number;          // index of the opening "<"
  blockEnd: number;            // index just past the closing "</Sequence>"
  fromValueStart: number;      // index of the first char of the value inside from={...}
  fromValueEnd: number;        // index of the closing "}" of from={...}
  durationValueStart: number;
  durationValueEnd: number;
  hasNonNumericFrom: boolean;       // true if the attribute value isn't a bare integer
  hasNonNumericDuration: boolean;
}

function findAttrValueRange(
  source: string,
  openTagStart: number,
  openTagEnd: number,
  attrName: string,
): { start: number; end: number; raw: string } | null {
  const slice = source.slice(openTagStart, openTagEnd);
  const re = new RegExp(`\\b${attrName}\\s*=\\s*\\{`);
  const m = re.exec(slice);
  if (!m) return null;
  // Find the matching brace from the opening `{`.
  const openIdx = openTagStart + m.index + m[0].length - 1; // index of `{`
  let depth = 0;
  for (let i = openIdx; i < openTagEnd; i++) {
    const ch = source[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return { start: openIdx + 1, end: i, raw: source.slice(openIdx + 1, i) };
      }
    }
  }
  return null;
}

export function parseSequenceBlocks(code: string, fps: number): SequenceBlock[] {
  if (!code || !code.trim()) return [];

  const constants: Record<string, number> = { fps };
  const constRegex = /(?:const|let|var)\s+(\w+)\s*=\s*(\d+)/g;
  let cm: RegExpExecArray | null;
  while ((cm = constRegex.exec(code)) !== null) {
    constants[cm[1]] = parseInt(cm[2], 10);
  }
  const fpsExport = code.match(/export\s+(?:const|let|var)\s+fps\s*=\s*(\d+)/);
  if (fpsExport) constants.fps = parseInt(fpsExport[1], 10);

  const blocks: SequenceBlock[] = [];
  // Match opening tag <Sequence ...> (NOT TransitionSeries.Sequence / Series.Sequence).
  const openRe = /<Sequence\b([^>]*)>/g;
  let om: RegExpExecArray | null;
  while ((om = openRe.exec(code)) !== null) {
    const openStart = om.index;
    const openEnd = om.index + om[0].length;
    // Find matching </Sequence>, allowing nested <Sequence> within (shouldn't
    // happen for our use case, but cheap to support).
    let depth = 1;
    const nestedRe = /<Sequence\b|<\/Sequence>/g;
    nestedRe.lastIndex = openEnd;
    let blockEnd = -1;
    let nm: RegExpExecArray | null;
    while ((nm = nestedRe.exec(code)) !== null) {
      if (nm[0] === "</Sequence>") {
        depth--;
        if (depth === 0) {
          blockEnd = nm.index + nm[0].length;
          break;
        }
      } else {
        depth++;
      }
    }
    if (blockEnd === -1) continue;

    const fromRange = findAttrValueRange(code, openStart, openEnd, "from");
    const durRange = findAttrValueRange(code, openStart, openEnd, "durationInFrames");
    if (!fromRange || !durRange) continue;

    const fromVal = resolveNumericExpr(fromRange.raw, constants);
    const durVal = resolveNumericExpr(durRange.raw, constants);
    if (fromVal === null || durVal === null) continue;

    blocks.push({
      from: fromVal,
      durationInFrames: durVal,
      blockStart: openStart,
      blockEnd,
      fromValueStart: fromRange.start,
      fromValueEnd: fromRange.end,
      durationValueStart: durRange.start,
      durationValueEnd: durRange.end,
      hasNonNumericFrom: !/^\s*\d+\s*$/.test(fromRange.raw),
      hasNonNumericDuration: !/^\s*\d+\s*$/.test(durRange.raw),
    });
  }

  blocks.sort((a, b) => a.blockStart - b.blockStart);
  return blocks;
}

export function parseTimeline(code: string, fps: number): TimelineClip[] {
  if (!code || !code.trim()) return [];

  const clips: TimelineClip[] = [];

  // Extract constants (const FOO = 123)
  const constants: Record<string, number> = { fps };
  const constRegex = /(?:const|let|var)\s+(\w+)\s*=\s*(\d+)/g;
  let constMatch;
  while ((constMatch = constRegex.exec(code)) !== null) {
    constants[constMatch[1]] = parseInt(constMatch[2], 10);
  }

  // Also try to get fps and durationInFrames from exports
  const fpsExport = code.match(/export\s+(?:const|let|var)\s+fps\s*=\s*(\d+)/);
  if (fpsExport) constants.fps = parseInt(fpsExport[1], 10);

  // Pattern 1: <Sequence from={X} durationInFrames={Y}> containing video/audio/img
  const sequenceRegex = /<Sequence[^>]*?\bfrom=\{([^}]+)\}[^>]*?\bdurationInFrames=\{([^}]+)\}[^>]*?>([\s\S]*?)<\/Sequence>/g;
  const sequenceRegex2 = /<Sequence[^>]*?\bdurationInFrames=\{([^}]+)\}[^>]*?\bfrom=\{([^}]+)\}[^>]*?>([\s\S]*?)<\/Sequence>/g;

  function parseSequenceContent(from: number, duration: number, content: string) {
    // Look for video sources
    const videoRegex = /<(?:OffthreadVideo|Video)\s[^>]*?src=(?:\{["`']([^"'`]+)["`']\}|"([^"]+)")[^>]*?\/?>/g;
    let vMatch;
    while ((vMatch = videoRegex.exec(content)) !== null) {
      const src = vMatch[1] || vMatch[2];
      const startFromMatch = content.match(/startFrom=\{(\d+)\}/);
      const endAtMatch = content.match(/endAt=\{(\d+)\}/);

      clips.push({
        name: extractFilename(src),
        src,
        from,
        durationInFrames: duration,
        startFrom: startFromMatch ? parseInt(startFromMatch[1], 10) : undefined,
        endAt: endAtMatch ? parseInt(endAtMatch[1], 10) : undefined,
        type: "video",
      });
    }

    // Look for audio sources
    const audioRegex = /<Audio\s[^>]*?src=(?:\{["`']([^"'`]+)["`']\}|"([^"]+)")[^>]*?\/?>/g;
    let aMatch;
    while ((aMatch = audioRegex.exec(content)) !== null) {
      const src = aMatch[1] || aMatch[2];
      clips.push({
        name: extractFilename(src),
        src,
        from,
        durationInFrames: duration,
        type: "audio",
      });
    }

    // If no media found, it's a scene/overlay
    if (!clips.find((c) => c.from === from && (c.type === "video" || c.type === "audio"))) {
      // Check for any meaningful content
      const hasContent = /<(?:div|h1|h2|p|span|AbsoluteFill|Img)\b/.test(content);
      if (hasContent) {
        // Try to extract a scene name from component usage or text content
        const componentMatch = content.match(/<(\w+Scene|\w+Overlay|\w+Title)\b/);
        const name = componentMatch ? componentMatch[1] : "Scene";
        clips.push({
          name,
          src: "",
          from,
          durationInFrames: duration,
          type: "scene",
        });
      }
    }
  }

  let sMatch;
  while ((sMatch = sequenceRegex.exec(code)) !== null) {
    const from = resolveNumericExpr(sMatch[1], constants);
    const duration = resolveNumericExpr(sMatch[2], constants);
    if (from !== null && duration !== null) {
      parseSequenceContent(from, duration, sMatch[3]);
    }
  }

  // Also match durationInFrames before from
  while ((sMatch = sequenceRegex2.exec(code)) !== null) {
    const duration = resolveNumericExpr(sMatch[1], constants);
    const from = resolveNumericExpr(sMatch[2], constants);
    if (from !== null && duration !== null) {
      parseSequenceContent(from, duration, sMatch[3]);
    }
  }

  // Pattern 2: <TransitionSeries.Sequence durationInFrames={Y}> — no `from`, sequential
  const tsRegex = /<TransitionSeries\.Sequence\s[^>]*?durationInFrames=\{([^}]+)\}[^>]*?>([\s\S]*?)<\/TransitionSeries\.Sequence>/g;
  const transitionRegex = /<TransitionSeries\.Transition[^>]*?durationInFrames=\{([^}]+)\}[^>]*?\/?>/g;

  // Only use TransitionSeries parsing if no regular Sequences were found
  if (clips.length === 0) {
    const transitionDurations: number[] = [];
    let tMatch;
    while ((tMatch = transitionRegex.exec(code)) !== null) {
      const d = resolveNumericExpr(tMatch[1], constants);
      if (d !== null) transitionDurations.push(d);
    }

    let runningFrame = 0;
    let transIdx = 0;
    while ((sMatch = tsRegex.exec(code)) !== null) {
      const duration = resolveNumericExpr(sMatch[1], constants);
      if (duration === null) continue;

      parseSequenceContent(runningFrame, duration, sMatch[2]);

      // Account for transition overlap
      const overlapDuration = transitionDurations[transIdx] || 0;
      runningFrame += duration - overlapDuration;
      transIdx++;
    }
  }

  // Pattern 3: <Series.Sequence durationInFrames={Y}> — no `from`, sequential, no transitions.
  // Used by Smart Trim output. Same as TransitionSeries but without overlap logic.
  if (clips.length === 0) {
    const seriesSeqRegex = /<Series\.Sequence\s[^>]*?durationInFrames=\{([^}]+)\}[^>]*?>([\s\S]*?)<\/Series\.Sequence>/g;
    let runningFrame = 0;
    while ((sMatch = seriesSeqRegex.exec(code)) !== null) {
      const duration = resolveNumericExpr(sMatch[1], constants);
      if (duration === null) continue;
      parseSequenceContent(runningFrame, duration, sMatch[2]);
      runningFrame += duration;
    }
  }

  // Sort by start frame
  clips.sort((a, b) => a.from - b.from);

  return clips;
}
