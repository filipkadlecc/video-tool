import { Client } from "@notionhq/client";
import type { BlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";

const notion = new Client({ auth: process.env.NOTION_API_KEY });

// Bounds so a huge/deeply-nested page can't hang the fetch. Surfaced (not
// silent) via a truncation marker when hit.
const MAX_BLOCKS = 600;
const MAX_DEPTH = 5;

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

interface RichRun {
  plain_text?: string;
  annotations?: { color?: string };
}

/** Plain concatenation, dropping all formatting (used for comment bodies). */
function plainText(runs: RichRun[] | undefined): string {
  if (!Array.isArray(runs)) return "";
  return runs.map((r) => r.plain_text ?? "").join("");
}

/**
 * Text with color/highlight preserved. Consecutive runs of the same color are
 * merged and non-default colors are wrapped as `[[orange]]…[[/orange]]` (the
 * `_background` suffix is stripped). This is how the interview workflow marks
 * "keep this" — e.g. orange highlight over a quote.
 */
function richToText(runs: RichRun[] | undefined): string {
  if (!Array.isArray(runs)) return "";
  const colorOf = (r: RichRun) => (r.annotations?.color ?? "default").replace(/_background$/, "");
  let out = "";
  let i = 0;
  while (i < runs.length) {
    const color = colorOf(runs[i]);
    let seg = "";
    while (i < runs.length && colorOf(runs[i]) === color) {
      seg += runs[i].plain_text ?? "";
      i++;
    }
    out += color !== "default" ? `[[${color}]]${seg}[[/${color}]]` : seg;
  }
  return out;
}

function extractTextFromBlock(block: BlockObjectResponse): string {
  const type = block.type;
  const data = block[type as keyof typeof block] as Record<string, unknown> | undefined;
  if (!data) return "";
  const runs = (data.rich_text ?? data.title) as RichRun[] | undefined;
  return richToText(runs);
}

/** Retry once on Notion's 429 (rate limit) with a short backoff. */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if ((err as { status?: number })?.status === 429) {
      await new Promise((r) => setTimeout(r, 1200));
      return fn();
    }
    throw err;
  }
}

/**
 * All (unresolved) comments anchored to a page or block. Returns [] — never
 * throws — if the integration lacks the "Read comments" capability or the
 * block simply has none. Resolved comments are not retrievable via the API.
 */
async function fetchComments(blockId: string): Promise<string[]> {
  const out: string[] = [];
  let cursor: string | undefined;
  try {
    do {
      const resp = await withRetry(() =>
        notion.comments.list({ block_id: blockId, start_cursor: cursor })
      );
      for (const c of resp.results) {
        const txt = plainText((c as { rich_text?: RichRun[] }).rich_text).trim();
        if (txt) out.push(txt);
      }
      cursor = resp.has_more ? resp.next_cursor ?? undefined : undefined;
    } while (cursor);
  } catch {
    // capability off / page not shared with the integration → best effort
  }
  return out;
}

interface WalkBudget {
  count: number;
  truncated: boolean;
  sawComment: boolean;
}

async function walkBlocks(
  blockId: string,
  depth: number,
  budget: WalkBudget,
  lines: string[]
): Promise<void> {
  if (depth > MAX_DEPTH) return;
  let cursor: string | undefined;
  do {
    const resp = await withRetry(() =>
      notion.blocks.children.list({ block_id: blockId, start_cursor: cursor, page_size: 100 })
    );

    for (const block of resp.results) {
      if (budget.count >= MAX_BLOCKS) {
        if (!budget.truncated) {
          lines.push(`[… page truncated at ${MAX_BLOCKS} blocks — ask the user to point at a section …]`);
          budget.truncated = true;
        }
        return;
      }
      budget.count++;
      if (!("type" in block)) continue;
      const b = block as BlockObjectResponse;
      const indent = "  ".repeat(depth);

      const text = extractTextFromBlock(b);
      if (text) lines.push(indent + text);

      // Inline comments anchored to this block.
      const comments = await fetchComments(b.id);
      for (const cm of comments) {
        budget.sawComment = true;
        lines.push(`${indent}  ↳ [comment] ${cm}`);
      }

      if (b.has_children) {
        await walkBlocks(b.id, depth + 1, budget, lines);
      }
    }

    cursor = resp.has_more ? resp.next_cursor ?? undefined : undefined;
  } while (cursor);
}

export async function fetchPageContent(pageId: string): Promise<string> {
  const lines: string[] = [];

  // Page title.
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

  const budget: WalkBudget = { count: 0, truncated: false, sawComment: false };

  // Page-level comment threads (not anchored to a specific block).
  const pageComments = await fetchComments(pageId);
  if (pageComments.length > 0) {
    budget.sawComment = true;
    lines.push("[page comments]");
    for (const cm of pageComments) lines.push(`  ↳ [comment] ${cm}`);
    lines.push("");
  }

  // Body, recursing into nested blocks, with per-block inline comments.
  await walkBlocks(pageId, 0, budget, lines);

  // Legend — only when there's markup to explain, so plain pages stay clean.
  const body = lines.join("\n");
  const sawHighlight = /\[\[[a-z]+\]\]/.test(body);
  if (sawHighlight || budget.sawComment) {
    const legendParts = [
      "[Editorial markup from Notion:",
      sawHighlight
        ? ' text wrapped like [[orange]]…[[/orange]] is highlighted that color in Notion (highlights usually mark the passages the user wants to KEEP/use);'
        : "",
      budget.sawComment
        ? ' lines beginning "↳ [comment]" are Notion comments anchored to the text just above them and carry the user\'s instructions (e.g. "this is the short", on-screen text).'
        : "",
      " Treat highlights + comments as editorial direction.]",
    ];
    return legendParts.filter(Boolean).join("") + "\n\n" + body;
  }

  return body;
}
