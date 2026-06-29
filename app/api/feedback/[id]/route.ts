import { deleteFeedback } from "@/lib/feedback";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = deleteFeedback(id);
  if (!deleted) {
    return Response.json({ error: "Feedback not found" }, { status: 404 });
  }
  return Response.json({ success: true });
}
