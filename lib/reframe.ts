import { spawn, execFileSync } from "child_process";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";

/**
 * Auto-reframe: bake a subject-tracked crop of a source clip to a target aspect
 * (e.g. 16:9 interview → 9:16 short) via scripts/reframe.py (OpenCV YuNet +
 * hardware ffmpeg). Derived clips are written next to the source as
 * `<base>.reframed_<W>x<H>.mp4` with a `<base>.reframe.json` marker.
 *
 * Best-effort: requires a Python with cv2 + the bundled YuNet model. Callers
 * should catch/skip when unavailable.
 */

const MODEL_PATH = path.join(process.cwd(), "public", "models", "face_detection_yunet_2023mar.onnx");
const SCRIPT_PATH = path.join(process.cwd(), "scripts", "reframe.py");

let cachedPython: string | null | undefined;

/** Find a Python interpreter that can `import cv2`. Cached for the process. */
export function resolveReframePython(): string | null {
  if (cachedPython !== undefined) return cachedPython;
  const candidates: string[] = [];
  if (process.env.REFRAME_PYTHON) candidates.push(process.env.REFRAME_PYTHON);
  // Reuse whichever Python runs `whisper` (its venv has cv2 in this setup).
  try {
    const whisperBin = execFileSync("which", ["whisper"], { encoding: "utf-8" }).trim();
    if (whisperBin && fs.existsSync(whisperBin)) {
      const firstLine = fs.readFileSync(whisperBin, "utf-8").split("\n")[0];
      if (firstLine.startsWith("#!")) candidates.push(firstLine.slice(2).trim());
    }
  } catch {
    // no whisper on PATH — fall through
  }
  candidates.push("python3");
  for (const py of candidates) {
    try {
      execFileSync(py, ["-c", "import cv2"], { stdio: "ignore" });
      cachedPython = py;
      return py;
    } catch {
      // try next
    }
  }
  cachedPython = null;
  return null;
}

/** Whether auto-reframe can run at all (python+cv2 and the model are present). */
export function isReframeAvailable(): boolean {
  return resolveReframePython() != null && fs.existsSync(MODEL_PATH);
}

function reframePaths(mediaPath: string, w: number, h: number) {
  const dir = path.dirname(mediaPath);
  const base = path.basename(mediaPath, path.extname(mediaPath));
  return {
    output: path.join(dir, `${base}.reframed_${w}x${h}.mp4`),
    marker: path.join(dir, `${base}.reframe.json`),
  };
}

/** True for a derived reframe output, so media listings can skip it. */
export function isReframedFilename(name: string): boolean {
  return /\.reframed_\d+x\d+\.mp4$/i.test(name);
}

export interface ReframeOptions {
  targetW: number;
  targetH: number;
  onProgress?: (line: string) => void;
}

/** Returns the reframed clip's filename (relative to the media folder) or null. */
export async function readCachedReframe(
  mediaPath: string,
  targetW: number,
  targetH: number
): Promise<string | null> {
  const { output, marker } = reframePaths(mediaPath, targetW, targetH);
  try {
    const info = JSON.parse(await fsp.readFile(marker, "utf-8"));
    if (info.targetW !== targetW || info.targetH !== targetH) return null;
    const stat = await fsp.stat(mediaPath);
    if (info.sourceMtimeMs !== stat.mtimeMs || info.sourceSize !== stat.size) return null;
    if (!fs.existsSync(output)) return null;
    return path.basename(output);
  } catch {
    return null;
  }
}

export async function reframeMedia(mediaPath: string, opts: ReframeOptions): Promise<string> {
  const py = resolveReframePython();
  if (!py) throw new Error("No Python with OpenCV (cv2) found — cannot auto-reframe");
  if (!fs.existsSync(MODEL_PATH)) throw new Error("YuNet model missing at public/models");
  const { output, marker } = reframePaths(mediaPath, opts.targetW, opts.targetH);

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(py, [
      SCRIPT_PATH,
      "--in", mediaPath,
      "--out", output,
      "--model", MODEL_PATH,
      "--target-w", String(opts.targetW),
      "--target-h", String(opts.targetH),
    ]);
    let err = "";
    proc.stdout.on("data", (d) => opts.onProgress?.(d.toString()));
    proc.stderr.on("data", (d) => { err += d.toString(); opts.onProgress?.(d.toString()); });
    proc.on("error", reject);
    proc.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`reframe exited ${code}: ${err.slice(-800)}`))
    );
  });

  try {
    const stat = await fsp.stat(mediaPath);
    await fsp.writeFile(
      marker,
      JSON.stringify(
        {
          targetW: opts.targetW,
          targetH: opts.targetH,
          output: path.basename(output),
          sourceMtimeMs: stat.mtimeMs,
          sourceSize: stat.size,
          generatedAt: new Date().toISOString(),
        },
        null,
        2
      )
    );
  } catch {
    // marker is best-effort
  }
  return path.basename(output);
}

export async function reframeWithCache(mediaPath: string, opts: ReframeOptions): Promise<string> {
  const cached = await readCachedReframe(mediaPath, opts.targetW, opts.targetH);
  if (cached) return cached;
  return reframeMedia(mediaPath, opts);
}
