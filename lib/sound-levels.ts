import fs from "fs";
import path from "path";
import { biquadHighpass, decodeMono } from "./audio-dsp";
import { getProject } from "./projects";
import type { PeakReader } from "./scene-checks";

/**
 * The file behind a sound the renderer played.
 *
 * Sources arrive as the renderer saw them: an absolute URL to this app's media
 * route for a project's own footage and music, or the bundle's static path
 * ("/static-<hash>/assets/sfx/pop-1.wav") for anything in public/. Both map
 * back to a file on this disk; anything else (a remote URL) can't be measured
 * and is skipped rather than guessed at.
 */
export function soundFileFor(src: string): string | null {
  let pathname = src;
  try {
    pathname = new URL(src, "http://local").pathname;
  } catch { /* keep the raw string */ }
  let decoded = pathname;
  try { decoded = decodeURIComponent(pathname); } catch { /* keep encoded */ }

  const media = decoded.match(/^\/api\/media\/([^/]+)\/(.+)$/);
  if (media) {
    const folder = getProject(media[1])?.mediaFolder;
    if (!folder) return null;
    const file = path.resolve(folder, media[2]);
    if (!file.startsWith(path.resolve(folder))) return null;
    return fs.existsSync(file) ? file : null;
  }
  const publicDir = path.join(process.cwd(), "public");
  const rel = decoded.replace(/^\/(?:static-[^/]+|public)\//, "/").replace(/^\/+/, "");
  const file = path.resolve(publicDir, rel);
  if (!file.startsWith(publicDir)) return null;
  return fs.existsSync(file) ? file : null;
}

const SR = 22050;

/**
 * Decode every file the sound check will read, then answer peak questions
 * about them synchronously. A file that won't decode (a clip with no audio
 * stream) reads as silence.
 */
export async function loadPeakReader(files: string[]): Promise<PeakReader> {
  const decoded = new Map<string, { full: Float32Array; high: Float32Array }>();
  for (const file of new Set(files)) {
    try {
      const full = await decodeMono(file, SR);
      decoded.set(file, { full, high: biquadHighpass(full, SR, 2000) });
    } catch {
      decoded.set(file, { full: new Float32Array(0), high: new Float32Array(0) });
    }
  }
  return (file, fromSec, toSec, highOnly) => {
    const d = decoded.get(file);
    if (!d) return -120;
    const s = highOnly ? d.high : d.full;
    const a = Math.max(0, Math.floor(fromSec * SR));
    const z = Math.min(s.length, Math.ceil(toSec * SR));
    let max = 0;
    for (let i = a; i < z; i++) {
      const v = Math.abs(s[i]);
      if (v > max) max = v;
    }
    return max > 0 ? 20 * Math.log10(max) : -120;
  };
}
