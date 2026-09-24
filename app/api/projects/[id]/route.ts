import { getProject, updateProject, deleteProject } from "@/lib/projects";
import { recordVersion } from "@/lib/versions";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }
  return Response.json(project);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // The version note rides along with a save but is not part of the project.
  const { versionLabel, versionCheckpoint, ...body } = await request.json();
  const before = getProject(id);
  const updated = updateProject(id, body);
  if (!updated || !before) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }
  if ("doc" in body || "code" in body) {
    try {
      recordVersion(
        id,
        { doc: before.doc, code: before.code },
        { doc: updated.doc, code: updated.code },
        { label: typeof versionLabel === "string" ? versionLabel : undefined, checkpoint: versionCheckpoint === true },
      );
    } catch (e) {
      // History is a safety net. Failing to write it must never fail the save
      // it was protecting.
      console.error("[versions] could not record:", e);
    }
  }
  return Response.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = deleteProject(id);
  if (!deleted) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }
  return Response.json({ success: true });
}
