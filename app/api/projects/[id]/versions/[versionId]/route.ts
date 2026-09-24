import { getProject } from "@/lib/projects";
import { readVersion } from "@/lib/versions";

/** One saved version in full: its timeline and scene code, ready to restore. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const { id, versionId } = await params;
  if (!getProject(id)) return Response.json({ error: "Project not found" }, { status: 404 });
  const version = readVersion(id, versionId);
  if (!version) return Response.json({ error: "Version not found" }, { status: 404 });
  return Response.json(version);
}
