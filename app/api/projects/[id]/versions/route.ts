import { getProject } from "@/lib/projects";
import { listVersions } from "@/lib/versions";

/** Every saved version of a project, newest first — metadata only. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!getProject(id)) return Response.json({ error: "Project not found" }, { status: 404 });
  return Response.json({ versions: listVersions(id) });
}
