import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execFileAsync = promisify(execFile);

/**
 * Fast, deterministic metadata for one media file via `ffprobe`. Cached next to
 * the media as `<base>.probe.json`. This is the cheap half of the "make the AI
 * see the video" analysis — it runs in ~50ms and never decodes frames.
 */
export interface MediaProbe {
  durationSeconds: number;
  /** Frames per second of the source (native). VFR files use avg_frame_rate. */
  fps: number;
  width: number;
  height: number;
  codec: string;
  hasAudio: boolean;
  /** Total video frames. Falls back to round(duration * fps) when unreported. */
  nbFrames: number;
  // Cache-invalidation fingerprint of the source file at probe time.
  sourceMtimeMs: number;
  sourceSize: number;
  generatedAt: string;
}

interface FfprobeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  avg_frame_rate?: string;
  duration?: string;
  nb_frames?: string;
  disposition?: { attached_pic?: number };
}

interface FfprobeOutput {
  streams?: FfprobeStream[];
  format?: { duration?: string };
}

function probeCachePath(mediaPath: string): string {
  const dir = path.dirname(mediaPath);
  const base = path.basename(mediaPath, path.extname(mediaPath));
  return path.join(dir, `${base}.probe.json`);
}

/** Parse an ffprobe rational like "30000/1001" → 29.97. Returns 0 if unusable. */
function parseFrameRate(rate: string | undefined): number {
  if (!rate) return 0;
  const [numStr, denStr] = rate.split("/");
  const num = Number(numStr);
  const den = denStr === undefined ? 1 : Number(denStr);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return 0;
  return num / den;
}

/**
 * Fingerprint the current source file for cache validation. Returns null if the
 * file no longer exists.
 */
async function sourceFingerprint(
  mediaPath: string
): Promise<{ mtimeMs: number; size: number } | null> {
  try {
    const stat = await fs.stat(mediaPath);
    return { mtimeMs: stat.mtimeMs, size: stat.size };
  } catch {
    return null;
  }
}

export async function probeMedia(mediaPath: string): Promise<MediaProbe> {
  const { stdout } = await execFileAsync(
    "ffprobe",
    ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", mediaPath],
    { maxBuffer: 8 * 1024 * 1024 }
  );
  const raw = JSON.parse(stdout) as FfprobeOutput;
  const streams = raw.streams ?? [];

  // The real video stream — skip embedded cover art (attached_pic).
  const video = streams.find(
    (s) => s.codec_type === "video" && s.disposition?.attached_pic !== 1
  );
  const hasAudio = streams.some((s) => s.codec_type === "audio");

  // fps: prefer avg_frame_rate (correct for VFR), fall back to r_frame_rate.
  const fps =
    parseFrameRate(video?.avg_frame_rate) || parseFrameRate(video?.r_frame_rate) || 0;

  const durationSeconds =
    Number(video?.duration) || Number(raw.format?.duration) || 0;

  const width = video?.width ?? 0;
  const height = video?.height ?? 0;
  const codec = video?.codec_name ?? (hasAudio ? "audio-only" : "unknown");

  const reportedFrames = Number(video?.nb_frames);
  const nbFrames =
    Number.isFinite(reportedFrames) && reportedFrames > 0
      ? reportedFrames
      : fps > 0
        ? Math.round(durationSeconds * fps)
        : 0;

  const fp = await sourceFingerprint(mediaPath);

  return {
    durationSeconds,
    fps,
    width,
    height,
    codec,
    hasAudio,
    nbFrames,
    sourceMtimeMs: fp?.mtimeMs ?? 0,
    sourceSize: fp?.size ?? 0,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Read the cached probe, returning null if absent OR stale (the source file's
 * mtime/size no longer match the fingerprint written at probe time).
 */
export async function readCachedProbe(mediaPath: string): Promise<MediaProbe | null> {
  let cached: MediaProbe;
  try {
    cached = JSON.parse(
      await fs.readFile(probeCachePath(mediaPath), "utf-8")
    ) as MediaProbe;
  } catch {
    return null;
  }
  const fp = await sourceFingerprint(mediaPath);
  if (!fp) return null;
  if (cached.sourceMtimeMs !== fp.mtimeMs || cached.sourceSize !== fp.size) {
    return null; // stale — source changed since probe
  }
  return cached;
}

export async function probeWithCache(mediaPath: string): Promise<MediaProbe> {
  const cached = await readCachedProbe(mediaPath);
  if (cached) return cached;
  const probe = await probeMedia(mediaPath);
  await fs
    .writeFile(probeCachePath(mediaPath), JSON.stringify(probe, null, 2), "utf-8")
    .catch(() => {});
  return probe;
}
