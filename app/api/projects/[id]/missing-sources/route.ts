import fs from "fs";
import path from "path";
import { getProject } from "@/lib/projects";
import type { EditorDoc } from "@/lib/editor-doc";

/**
 * Which of this project's sources are not on disk.
 *
 * The editor used to answer this from the document alone: a clip pointing at an
 * `assetId` with no matching row in `doc.assets`. That catches a corrupt
 * document and misses the thing that actually happens — the asset row is fine
 * and the FILE has been moved, renamed, or deleted from the folder underneath
 * it. Those clips render black, and until now the first sign of it was the
 * finished export.
 *
 * Only the server can answer this, because only the server can stat the disk.
 */

interface MissingSource {
  assetId: string;
  name: string;
  /** Where it was last seen, for the "last seen in …" line. */
  lastSeen: string;
  /** The clips that use it, so the dialog can say which track and when. */
  clips: { itemId: string; track: string; atFrame: number }[];
}

/** "/api/media/<projectId>/a/b.mp4" -> "a/b.mp4", or null for anything else. */
function mediaRelPath(src: string, projectId: string): string | null {
  const prefix = `/api/media/${projectId}/`;
  if (!src.startsWith(prefix)) return null;
  try {
    return decodeURIComponent(src.slice(prefix.length).split("?")[0]);
  } catch {
    return null;
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

  const doc = project.doc as EditorDoc | undefined;
  if (!doc) return Response.json({ missing: [], folder: project.mediaFolder ?? null });

  const missing: MissingSource[] = [];

  for (const asset of doc.assets) {
    const rel = mediaRelPath(asset.src, id);
    // A `staticFile()` asset ships with the app; only project media can go
    // missing, and guessing about the rest would produce false alarms.
    if (!rel || !project.mediaFolder) continue;

    const full = path.join(project.mediaFolder, rel);
    // Also refuse to look outside the media folder, however the path was built.
    const inside = path.resolve(full).startsWith(path.resolve(project.mediaFolder));
    if (inside && fs.existsSync(full)) continue;

    const clips: MissingSource["clips"] = [];
    for (const track of doc.tracks) {
      for (const item of track.items) {
        if ((item as { assetId?: string }).assetId === asset.id) {
          clips.push({ itemId: item.id, track: track.name, atFrame: item.from });
        }
      }
    }
    // An asset nothing uses is not a problem worth interrupting an export for.
    if (clips.length === 0) continue;

    missing.push({
      assetId: asset.id,
      name: asset.name ?? path.basename(rel),
      lastSeen: path.join(project.mediaFolder, path.dirname(rel)),
      clips,
    });
  }

  return Response.json({ missing, folder: project.mediaFolder ?? null });
}
