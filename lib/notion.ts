import { Client } from "@notionhq/client";
import type { BlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";

const notion = new Client({ auth: process.env.NOTION_API_KEY });

export function extractPageId(url: string): string | null {
  // Handle URLs like:
  // https://www.notion.so/Page-Title-abc123def456...
  // https://www.notion.so/workspace/abc123def456...
  // https://notion.so/abc123def456...?v=...
  const match = url.match(/([a-f0-9]{32})/);
  if (match) return match[1];

  // Try with dashes: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  const uuidMatch = url.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/);
  if (uuidMatch) return uuidMatch[1].replace(/-/g, "");

  return null;
}

function extractTextFromBlock(block: BlockObjectResponse): string {
  const type = block.type;
  const data = block[type as keyof typeof block] as Record<string, unknown> | undefined;
  if (!data) return "";

  // Handle rich_text arrays
  const richText = data.rich_text as Array<{ plain_text: string }> | undefined;
  if (richText && Array.isArray(richText)) {
    return richText.map((t) => t.plain_text).join("");
  }

  // Handle title
  const title = data.title as Array<{ plain_text: string }> | undefined;
  if (title && Array.isArray(title)) {
    return title.map((t) => t.plain_text).join("");
  }

  return "";
}

export async function fetchPageContent(pageId: string): Promise<string> {
  const lines: string[] = [];

  // Get page title
  try {
    const page = await notion.pages.retrieve({ page_id: pageId });
    if ("properties" in page) {
      for (const prop of Object.values(page.properties)) {
        if (prop.type === "title" && "title" in prop) {
          const titleText = (prop.title as Array<{ plain_text: string }>)
            .map((t) => t.plain_text)
            .join("");
          if (titleText) lines.push(`# ${titleText}\n`);
          break;
        }
      }
    }
  } catch {
    // skip title
  }

  // Get blocks
  let cursor: string | undefined;
  do {
    const response = await notion.blocks.children.list({
      block_id: pageId,
      start_cursor: cursor,
      page_size: 100,
    });

    for (const block of response.results) {
      if (!("type" in block)) continue;
      const text = extractTextFromBlock(block as BlockObjectResponse);
      if (text) lines.push(text);
    }

    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);

  return lines.join("\n");
}
