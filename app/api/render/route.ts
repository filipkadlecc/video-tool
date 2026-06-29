import { enqueueRender } from "@/lib/render-queue";
import type { RenderCodec } from "@/lib/render-queue";
import { enqueueHyperframesRender } from "@/lib/hyperframes-queue";
import type { HfFormat } from "@/lib/hyperframes-queue";
import { getProject } from "@/lib/projects";
import type { Engine } from "@/lib/types";

export async function POST(request: Request) {
  const { sceneId, code, durationInFrames, fps, width, height, codec, projectId, engine, format } = await request.json();

  if (!code) {
    return Response.json({ error: "code is required" }, { status: 400 });
  }

  // HyperFrames engine: HTML/GSAP scene rendered by its own CLI. Output format
  // is mp4 (opaque) by default, or webm/mov (transparent / alpha) on request.
  if ((engine as Engine) === "hyperframes") {
    const hfFormat: HfFormat = format === "webm" || format === "mov" ? format : "mp4";
    const job = enqueueHyperframesRender(sceneId || "untitled", code, fps || 30, width || 1920, height || 1080, hfFormat);
    return Response.json(job);
  }

  const codecMap: Record<string, RenderCodec> = { h264: "h264", prores: "prores", "prores-xq": "prores-xq", uncompressed: "uncompressed", qtrle: "qtrle" };
  const validCodec: RenderCodec = codecMap[codec] || "h264";
  const svgContents = projectId ? getProject(projectId)?.svgContents : undefined;
  const job = enqueueRender(sceneId || "untitled", code, durationInFrames || 250, fps || 25, width || 3840, height || 2160, validCodec, svgContents);
  return Response.json(job);
}
