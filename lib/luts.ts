import fs from "fs";
import path from "path";

// Built-in .cube LUTs live in public/luts/*.cube; user-uploaded ones in
// public/luts/custom/*.cube. LUTs are applied as a color grade at export time
// via ffmpeg's lut3d filter (see lib/render-queue.ts).
export const LUTS_DIR = path.join(process.cwd(), "public", "luts");
export const CUSTOM_DIR = path.join(LUTS_DIR, "custom");

export interface LutInfo {
  /** Path relative to public/luts, e.g. "warm.cube" or "custom/my-look.cube". Used as the picker value. */
  id: string;
  name: string;
  builtIn: boolean;
}

export function isCubeFilename(name: string): boolean {
  return path.extname(name).toLowerCase() === ".cube";
}

function prettify(base: string): string {
  return base
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Pull the human title out of a .cube's `TITLE "..."` header without reading the
// whole file (custom LUTs can be several MB) — only the first bytes are needed.
function readTitle(file: string): string | null {
  try {
    const fd = fs.openSync(file, "r");
    const buf = Buffer.alloc(256);
    const n = fs.readSync(fd, buf, 0, 256, 0);
    fs.closeSync(fd);
    const m = buf.toString("utf8", 0, n).match(/TITLE\s+"([^"]+)"/i);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function readDirCubes(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => isCubeFilename(f) && fs.statSync(path.join(dir, f)).isFile())
      .sort();
  } catch {
    return [];
  }
}

/** All available LUTs: built-in first, then custom uploads. Never exposes filesystem paths. */
export function listLuts(): LutInfo[] {
  const builtIn: LutInfo[] = readDirCubes(LUTS_DIR).map((f) => {
    const full = path.join(LUTS_DIR, f);
    return { id: f, name: readTitle(full) || prettify(path.basename(f, ".cube")), builtIn: true };
  });
  const custom: LutInfo[] = readDirCubes(CUSTOM_DIR).map((f) => {
    const full = path.join(CUSTOM_DIR, f);
    return { id: `custom/${f}`, name: readTitle(full) || prettify(path.basename(f, ".cube")), builtIn: false };
  });
  return [...builtIn, ...custom];
}

/**
 * Resolve a picker id (a path relative to public/luts) to an absolute .cube path,
 * or null when no LUT is selected / the id is invalid. Guards against traversal —
 * never trust a client-supplied path.
 */
export function resolveLutPath(id?: string | null): string | null {
  if (!id || id === "none") return null;
  const rel = id.replace(/^\/+/, "");
  if (rel.includes("..") || path.isAbsolute(rel) || !isCubeFilename(rel)) return null;
  const resolved = path.resolve(LUTS_DIR, rel);
  if (!resolved.startsWith(path.resolve(LUTS_DIR) + path.sep)) return null;
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) return null;
  return resolved;
}
