import path from "path";
import { probeWithCache, type MediaProbe } from "./probe";
import { readCachedTranscript, type TranscriptSegment } from "./transcribe";
import { readCachedScenes } from "./scene-detect";
import type { Project } from "./types";

/**
 * Per-file understanding fed to the AI (and surfaced in the Analyze UI). Assembled
 * from on-disk caches by buildEnrichedMediaFiles — it never spawns whisper or
 * scene-detect, so it's cheap enough to run on every chat request. Only the fast
 * ffprobe pass may run inline (via probeWithCache) when a probe cache is missing.
 */
export interface TranscriptTruncation {
  shown: number;
  total: number;
  charCap: number;
}

export interface EnrichedMediaFile {
  name: string;
  path: string;
  type: "video" | "audio" | "image" | "other";
  sizeFormatted: string;
  probe?: MediaProbe;
  transcriptSegments?: TranscriptSegment[];
  transcriptTruncated?: TranscriptTruncation;
  sceneCutsSeconds?: number[];
  /** True when a video/audio file still needs the slow analysis (transcript/scenes). */
  analysisPending?: boolean;
}

/**
 * Per-file cap on transcript text stuffed into the prompt. ~8000 chars ≈ ~2k
 * tokens. Segment-level (not word-level) keeps even a 40-min interview well under
 * this; the cap only bites on very long or dense speech.
 */
export const MAX_TRANSCRIPT_CHARS = 8000;
/** Approx overhead per rendered segment line ("[12.3-18.9] " prefix). */
const SEGMENT_PREFIX_CHARS = 14;

function narrowType(type: string): EnrichedMediaFile["type"] {
  return type === "video" || type === "audio" || type === "image" ? type : "other";
}

/**
 * Apply the char cap to a segment list. Returns the kept segments plus truncation
 * info when the cap bites. Truncation is always surfaced (never silent) so the AI
 * — and the UI — know the tail isn't shown.
 */
function capSegments(segments: TranscriptSegment[]): {
  kept: TranscriptSegment[];
  truncated?: TranscriptTruncation;
} {
  const kept: TranscriptSegment[] = [];
  let used = 0;
  for (const seg of segments) {
    const cost = seg.text.length + SEGMENT_PREFIX_CHARS;
    if (used + cost > MAX_TRANSCRIPT_CHARS && kept.length > 0) break;
    kept.push(seg);
    used += cost;
  }
  if (kept.length < segments.length) {
    return {
      kept,
      truncated: { shown: kept.length, total: segments.length, charCap: MAX_TRANSCRIPT_CHARS },
    };
  }
  return { kept };
}

async function enrichOne(
  mediaFolder: string,
  file: { name: string; path: string; type: string; sizeFormatted: string }
): Promise<EnrichedMediaFile> {
  const type = narrowType(file.type);
  const base: EnrichedMediaFile = {
    name: file.name,
    path: file.path,
    type,
    sizeFormatted: file.sizeFormatted,
  };
  if (type === "image" || type === "other") return base;

  const mediaPath = path.join(mediaFolder, file.path);

  // Fast: probe (spawns ffprobe only on a cache miss). Slow steps are cache-only.
  const [probe, transcript, scenes] = await Promise.all([
    probeWithCache(mediaPath).catch(() => undefined),
    readCachedTranscript(mediaPath),
    readCachedScenes(mediaPath),
  ]);

  const enriched: EnrichedMediaFile = { ...base, probe };

  if (transcript?.segments && transcript.segments.length > 0) {
    const { kept, truncated } = capSegments(transcript.segments);
    enriched.transcriptSegments = kept;
    enriched.transcriptTruncated = truncated;
  }
  if (scenes) enriched.sceneCutsSeconds = scenes.cutsSeconds;

  // Video needs both transcript + scenes; audio needs only a transcript.
  const needsTranscript = !transcript;
  const needsScenes = type === "video" && !scenes;
  enriched.analysisPending = needsTranscript || needsScenes;

  return enriched;
}

/**
 * Build the enriched view for every media file in a project. Safe to call on each
 * chat request — reads caches, only ffprobe may run inline.
 */
export async function buildEnrichedMediaFiles(
  project: Project,
  mediaFiles: { name: string; path: string; type: string; sizeFormatted: string }[]
): Promise<EnrichedMediaFile[]> {
  if (!project.mediaFolder) {
    return mediaFiles.map((f) => ({
      name: f.name,
      path: f.path,
      type: narrowType(f.type),
      sizeFormatted: f.sizeFormatted,
    }));
  }
  return Promise.all(mediaFiles.map((f) => enrichOne(project.mediaFolder!, f)));
}
