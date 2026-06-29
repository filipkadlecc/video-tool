import fs from "fs";
import path from "path";

export interface SfxEntry {
  file: string;
  category: string;
  useWhen: string;
}

const SFX_DIR = path.join(process.cwd(), "public", "assets", "sfx");
const MANIFEST = path.join(SFX_DIR, "sfx.json");

/**
 * Available sound effects — only entries whose audio file actually exists on
 * disk, so placeholder rows in sfx.json are never advertised to the AI. The
 * feature lights up automatically as real .mp3s are dropped in.
 */
export function listSfx(): SfxEntry[] {
  if (!fs.existsSync(MANIFEST)) return [];
  let entries: SfxEntry[];
  try {
    entries = JSON.parse(fs.readFileSync(MANIFEST, "utf-8")) as SfxEntry[];
  } catch {
    return [];
  }
  return entries.filter((e) => e?.file && fs.existsSync(path.join(SFX_DIR, e.file)));
}
