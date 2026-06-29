import { updateCollection, deleteCollection } from "@/lib/collections";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const updated = updateCollection(id, { name: body?.name });
  if (!updated) {
    return Response.json({ error: "Collection not found" }, { status: 404 });
  }
  return Response.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = deleteCollection(id);
  if (!deleted) {
    return Response.json({ error: "Collection not found" }, { status: 404 });
  }
  return Response.json({ success: true });
}
