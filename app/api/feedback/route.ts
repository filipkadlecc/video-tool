import { saveFeedback, listFeedback } from "@/lib/feedback";

export async function GET() {
  return Response.json(listFeedback());
}

export async function POST(request: Request) {
  const body = await request.json();
  const { message, screenshot, projectId, url } = body as {
    message?: string;
    screenshot?: string;
    projectId?: string;
    url?: string;
  };

  if (!message || !message.trim()) {
    return Response.json({ error: "message is required" }, { status: 400 });
  }

  const entry = saveFeedback({ message: message.trim(), screenshot, projectId, url });
  return Response.json({ success: true, id: entry.id });
}
