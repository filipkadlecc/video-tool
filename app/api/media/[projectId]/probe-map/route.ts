import fs from "fs";
import path from "path";
import { getProject } from "@/lib/projects";
import { isReframedFilename } from "@/lib/reframe";
import { readCachedProbe } from "@/lib/probe";

/**
 * Cache-only batch of native fps / frame counts for every media file in a
 * project, keyed by the URL path the composition references
 * (`/api/media/<projectId>/<relPath>`). The timeline uses this to (a) convert
 * composition-frame trim deltas into source-frame deltas (startFrom/endAt) —
 * only correct when the source's native fps is known — and (b) clamp trims to
 * the source's real length (`nbFrames`) so a clip can't be extended past its
 * footage into frozen/black frames.
 *
 * Never spawns ffprobe — returns whatever `<base>.probe.json` sidecars exist
 * (written during analysis). Missing entries fall back to composition fps on
 * the client, matching legacy behavior.
 */

const MEDIA_EXTS = new Set([
  ".mp4", ".mov", ".webm", ".mkv", ".avi", ".m4v",
  ".mp3", ".wav", ".m4a", ".aac",
]);

function walk(dir: string, baseDir: string, out: string[]) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, baseDir, out);
    } else if (entry.isFile() && MEDIA_EXTS.has(path.extname(entry.name).toLowerCase())) {
      out.push(path.relative(baseDir, full));
    }
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const project = getProject(projectId);
  if (!project?.mediaFolder || !fs.existsSync(project.mediaFolder)) {
    return Response.json({ fps: {} });
  }

  const folder = project.mediaFolder;
  const rels: string[] = [];
  walk(folder, folder, rels);

  const fpsByRel: Record<string, number> = {};
  const nbFramesByRel: Record<string, number> = {};
  // base filename (no extension) → source fps / frame count, so reframed
  // derivatives can borrow their source's values (reframe preserves both).
  const fpsByBase: Record<string, number> = {};
  const nbFramesByBase: Record<string, number> = {};

  await Promise.all(
    rels.map(async (rel) => {
      const probe = await readCachedProbe(path.join(folder, rel));
      if (!probe || !probe.fps) return;
      fpsByRel[rel] = probe.fps;
      if (probe.nbFrames) nbFramesByRel[rel] = probe.nbFrames;
      if (!isReframedFilename(path.basename(rel))) {
        const base = path.basename(rel, path.extname(rel));
        fpsByBase[base] = probe.fps;
        if (probe.nbFrames) nbFramesByBase[base] = probe.nbFrames;
      }
    }),
  );

  for (const rel of rels) {
    const name = path.basename(rel);
    if (!isReframedFilename(name)) continue;
    const base = name.replace(/\.reframed_\d+x\d+\.mp4$/i, "");
    if (!fpsByRel[rel] && fpsByBase[base]) fpsByRel[rel] = fpsByBase[base];
    if (!nbFramesByRel[rel] && nbFramesByBase[base]) nbFramesByRel[rel] = nbFramesByBase[base];
  }

  return Response.json({ fps: fpsByRel, nbFrames: nbFramesByRel });
}
