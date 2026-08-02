import { extractPageId, fetchPageContent } from "@/lib/notion";

// Fetching inline comments means one API call per block, so a large page can
// take a while. Give it headroom beyond the default.
export const maxDuration = 180;

export async function POST(request: Request) {
  const { url } = await request.json();

  if (!url || typeof url !== "string") {
    return Response.json({ error: "url is required" }, { status: 400 });
  }

  if (!process.env.NOTION_API_KEY) {
    return Response.json({ error: "NOTION_API_KEY not configured" }, { status: 500 });
  }

  const pageId = extractPageId(url);
  if (!pageId) {
    return Response.json({ error: "Could not extract page ID from URL" }, { status: 400 });
  }

  try {
    const content = await fetchPageContent(pageId);
    return Response.json({ content });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch Notion page";
    return Response.json({ error: message }, { status: 500 });
  }
}
