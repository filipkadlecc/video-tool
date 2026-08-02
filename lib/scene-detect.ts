import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";

/**
 * Visual shot-boundary detection via ffmpeg's `scene` metric. This is the "real
 * cuts" a user expects when they upload footage — distinct from the speech
 * silence/filler trimming in lib/cut-plan.ts. Cached next to the media as
 * `<base>.scenes.json`.
 *
 * It decodes the whole file (downscaled), so it's the slow half of analysis and
 * must run in a background step, never inside a chat request.
 */
export interface SceneCuts {
  /** The `scene` score threshold used (0..1). */
  threshold: number;
  method: "select-scene";
  /** Cut points in seconds into the source, sorted ascending, 0 excluded. */
  cutsSeconds: number[];
  // Cache-invalidation fingerprint of the source file at detection time.
  sourceMtimeMs: number;
  sourceSize: number;
  generatedAt: string;
}

export interface DetectScenesOptions {
  /** `scene` score above which a frame counts as a cut. Default 0.4. */
  threshold?: number;
  /** Width to downscale to before scoring (huge speedup). Default 320. */
  downscaleWidth?: number;
  /** Source duration in seconds — enables percent progress from ffmpeg's time=. */
  durationSeconds?: number;
  onProgress?: (fraction: number) => void;
}

const DEFAULT_THRESHOLD = 0.4;
const DEFAULT_DOWNSCALE_WIDTH = 320;

function scenesCachePath(mediaPath: string): string {
  const dir = path.dirname(mediaPath);
  const base = path.basename(mediaPath, path.extname(mediaPath));
  return path.join(dir, `${base}.scenes.json`);
}

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

/** Parse ffmpeg's `time=HH:MM:SS.xx` progress token to seconds. */
function parseFfmpegTime(chunk: string): number | null {
  const m = /time=(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(chunk);
  if (!m) return null;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

export async function detectScenes(
  mediaPath: string,
  opts: DetectScenesOptions = {}
): Promise<SceneCuts> {
  const threshold = opts.threshold ?? DEFAULT_THRESHOLD;
  const downscaleWidth = opts.downscaleWidth ?? DEFAULT_DOWNSCALE_WIDTH;

  const filter = `scale=${downscaleWidth}:-2,select='gt(scene,${threshold})',metadata=print:file=-`;
  const args = [
    "-hide_banner",
    "-i", mediaPath,
    "-map", "0:v:0",
    "-vf", filter,
    "-an",
    "-f", "null",
    "-",
  ];

  const cutsSeconds = await new Promise<number[]>((resolve, reject) => {
    const proc = spawn("ffmpeg", args);
    const cuts = new Set<number>();
    let stdoutBuf = "";
    let stderrTail = "";

    proc.stdout.on("data", (chunk) => {
      stdoutBuf += chunk.toString();
      // metadata=print writes `... pts_time:<seconds>` on each selected frame.
      let m: RegExpExecArray | null;
      const re = /pts_time:([\d.]+)/g;
      while ((m = re.exec(stdoutBuf)) !== null) {
        const t = Math.round(Number(m[1]) * 1000) / 1000;
        if (Number.isFinite(t) && t > 0) cuts.add(t);
      }
      // Keep only a trailing fragment so a number split across chunks re-matches.
      const lastNl = stdoutBuf.lastIndexOf("\n");
      if (lastNl >= 0) stdoutBuf = stdoutBuf.slice(lastNl + 1);
    });

    proc.stderr.on("data", (chunk) => {
      const s = chunk.toString();
      stderrTail = (stderrTail + s).slice(-2000);
      if (opts.onProgress && opts.durationSeconds && opts.durationSeconds > 0) {
        const t = parseFfmpegTime(s);
        if (t != null) opts.onProgress(Math.min(1, t / opts.durationSeconds));
      }
    });

    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg scene-detect exited ${code}: ${stderrTail}`));
      } else {
        resolve([...cuts].sort((a, b) => a - b));
      }
    });
  });

  const fp = await sourceFingerprint(mediaPath);

  return {
    threshold,
    method: "select-scene",
    cutsSeconds,
    sourceMtimeMs: fp?.mtimeMs ?? 0,
    sourceSize: fp?.size ?? 0,
    generatedAt: new Date().toISOString(),
  };
}

export async function readCachedScenes(mediaPath: string): Promise<SceneCuts | null> {
  let cached: SceneCuts;
  try {
    cached = JSON.parse(
      await fs.readFile(scenesCachePath(mediaPath), "utf-8")
    ) as SceneCuts;
  } catch {
    return null;
  }
  const fp = await sourceFingerprint(mediaPath);
  if (!fp) return null;
  if (cached.sourceMtimeMs !== fp.mtimeMs || cached.sourceSize !== fp.size) {
    return null; // stale
  }
  return cached;
}

export async function detectScenesWithCache(
  mediaPath: string,
  opts: DetectScenesOptions = {}
): Promise<SceneCuts> {
  const cached = await readCachedScenes(mediaPath);
  if (cached) return cached;
  const scenes = await detectScenes(mediaPath, opts);
  await fs
    .writeFile(scenesCachePath(mediaPath), JSON.stringify(scenes, null, 2), "utf-8")
    .catch(() => {});
  return scenes;
}
