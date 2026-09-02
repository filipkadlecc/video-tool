/**
 * Runtime-extracted timeline model (DISPLAY-ONLY).
 *
 * Static parsing can't see clips whose positions are computed at runtime
 * (arithmetic durations, `.map`-generated `<Sequence>`s, TransitionSeries
 * overlap). Instead we RUN the composition once (in the browser) with Remotion's
 * own studio-registration turned on for a hidden subtree, so every `<Sequence>`
 * / `<Series.Sequence>` / `<TransitionSeries.Sequence>` reports its RESOLVED
 * position via `registerSequence`. This module turns those raw registrations
 * (plus media-leaf captures) into a clean clip list for the timeline to show and
 * scrub. It carries no source byte-ranges — editing stays on the static models.
 */

export interface SeqRegistration {
  id: string;
  /** Frame offset relative to the PARENT sequence (Remotion's `from`). */
  from: number;
  /** Resolved duration in composition frames (`actualDurationInFrames`). */
  duration: number;
  parent: string | null;
  displayName?: string;
}

export interface MediaCapture {
  enclosingId: string | null; // the Sequence id this media renders inside
  kind: "video" | "audio" | "image";
  src?: string;
  startFrom?: number;
  endAt?: number;
}

export interface ResolvedClip {
  id: string;
  from: number; // ABSOLUTE composition frame
  durationInFrames: number;
  depth: number;
  parentId: string | null;
  kind: "video" | "audio" | "image" | "scene";
  label: string;
  src?: string;
  startFrom?: number;
  endAt?: number;
}

export interface ResolvedTimeline {
  clips: ResolvedClip[];
}

function basename(src: string): string {
  const q = src.split("?")[0];
  const parts = q.split("/");
  return parts[parts.length - 1] || src;
}

/**
 * Turn raw sequence registrations + media captures into a display clip list.
 * - Absolute `from` = own `from` + parent chain (Remotion registers `from`
 *   relative to the parent; TransitionSeries bakes the overlap into the child's
 *   `from`, so the parent chain yields overlap-correct absolute positions).
 * - "Clips" = sequences that either directly contain media OR are leaves (no
 *   child sequences). Pure containers (e.g. a TransitionSeries wrapper) are
 *   skipped so we show the real clips, not scaffolding.
 */
export function buildResolvedTimeline(
  regs: SeqRegistration[],
  media: MediaCapture[],
): ResolvedTimeline {
  if (regs.length === 0) return { clips: [] };

  const byId = new Map<string, SeqRegistration>();
  for (const r of regs) byId.set(r.id, r);

  const absCache = new Map<string, number>();
  const depthCache = new Map<string, number>();
  const seen = new Set<string>();
  function absFrom(id: string): number {
    if (absCache.has(id)) return absCache.get(id)!;
    if (seen.has(id)) return 0; // cycle guard
    seen.add(id);
    const r = byId.get(id);
    if (!r) return 0;
    const v = r.from + (r.parent ? absFrom(r.parent) : 0);
    absCache.set(id, v);
    return v;
  }
  function depth(id: string): number {
    if (depthCache.has(id)) return depthCache.get(id)!;
    const r = byId.get(id);
    const d = r && r.parent ? depth(r.parent) + 1 : 0;
    depthCache.set(id, d);
    return d;
  }

  // First media capture per enclosing sequence.
  const mediaByEnclosing = new Map<string, MediaCapture>();
  for (const m of media) {
    if (m.enclosingId && !mediaByEnclosing.has(m.enclosingId)) mediaByEnclosing.set(m.enclosingId, m);
  }

  const hasChildSeq = new Set<string>();
  for (const r of regs) if (r.parent) hasChildSeq.add(r.parent);

  const clips: ResolvedClip[] = [];
  for (const r of regs) {
    const m = mediaByEnclosing.get(r.id);
    const isLeaf = !hasChildSeq.has(r.id);
    if (!m && !isLeaf) continue; // pure container/scaffold — skip
    const kind: ResolvedClip["kind"] = m ? m.kind : "scene";
    const label = r.displayName || (m?.src ? basename(m.src) : kind.charAt(0).toUpperCase() + kind.slice(1));
    clips.push({
      id: r.id,
      from: absFrom(r.id),
      durationInFrames: r.duration,
      depth: depth(r.id),
      parentId: r.parent,
      kind,
      label,
      src: m?.src,
      startFrom: m?.startFrom,
      endAt: m?.endAt,
    });
  }

  clips.sort((a, b) => a.from - b.from || a.depth - b.depth);
  return { clips };
}
