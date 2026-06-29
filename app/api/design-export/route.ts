// =============================================================================
// /api/design-export  (isolated, experimental "Design Export" feature)
// =============================================================================
// Takes a self-contained Claude Design animation, turns it into a frame-steppable
// HyperFrames composition (lib/hyperframes/import-claude-design), and enqueues it
// on the SAME HyperFrames render queue used by the normal flow — so the existing
// /api/render/[jobId] status route and polling work unchanged. Touches nothing
// in the normal generation path.

import { buildClaudeDesignComposition } from "@/lib/hyperframes/import-claude-design";
import { enqueueHyperframesRender } from "@/lib/hyperframes-queue";
import type { HfFormat } from "@/lib/hyperframes-queue";

export const maxDuration = 300;

export async function POST(request: Request) {
  let body: {
    sourceHtml?: string;
    exportWidth?: number;
    exportHeight?: number;
    fps?: number;
    durationSeconds?: number;
    format?: string;
    sceneName?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { sourceHtml, exportWidth = 1920, exportHeight = 1080, fps, durationSeconds, format, sceneName } = body;

  if (!sourceHtml || !sourceHtml.trim()) {
    return Response.json({ error: "sourceHtml is required" }, { status: 400 });
  }

  try {
    const { html, fps: resolvedFps } = buildClaudeDesignComposition({
      sourceHtml,
      exportWidth,
      exportHeight,
      fps,
      durationSeconds,
    });

    const hfFormat: HfFormat = format === "webm" || format === "mov" ? format : "mp4";
    const job = enqueueHyperframesRender(
      sceneName || "design-export",
      "", // no authored scene code — we pass a prebuilt composition
      resolvedFps,
      exportWidth,
      exportHeight,
      hfFormat,
      html,
    );
    return Response.json(job);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to build composition";
    return Response.json({ error: message }, { status: 400 });
  }
}
