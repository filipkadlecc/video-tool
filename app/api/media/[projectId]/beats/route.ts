import fs from "fs";
import path from "path";
import { getProject } from "@/lib/projects";
import { beatsForFile } from "@/lib/beats";

export const maxDuration = 300;

/**
 * The measured beat of one of a project's audio files (lib/beats.ts): tempo,
 * every beat and bar line, and the drop — for the timeline to draw and snap to.
 *
 * Cached beside the media as `<name>.beats.json`, the same convention as the
 * peaks, probe and transcript caches, so a track is only measured once.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const file = new URL(request.url).searchParams.get("file");
  if (!file) return Response.json({ error: "file is required" }, { status: 400 });

  const project = getProject(projectId);
  if (!project?.mediaFolder) return Response.json({ error: "No media folder" }, { status: 404 });

  const mediaPath = path.resolve(project.mediaFolder, file);
  if (!mediaPath.startsWith(path.resolve(project.mediaFolder))) {
    return Response.json({ error: "Invalid path" }, { status: 400 });
  }
  if (!fs.existsSync(mediaPath)) return Response.json({ error: "Not found" }, { status: 404 });

  try {
    return Response.json(await beatsForFile(mediaPath));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
