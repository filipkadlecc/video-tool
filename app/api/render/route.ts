import { enqueueRender } from "@/lib/render-queue";
import type { RenderCodec } from "@/lib/render-queue";
import { getProject } from "@/lib/projects";

export async function POST(request: Request) {
  const { sceneId, code, durationInFrames, fps, width, height, codec, projectId } = await request.json();

  if (!code) {
    return Response.json({ error: "code is required" }, { status: 400 });
  }

  const codecMap: Record<string, RenderCodec> = { h264: "h264", prores: "prores", "prores-xq": "prores-xq", uncompressed: "uncompressed", qtrle: "qtrle", "hevc-alpha": "hevc-alpha" };
  const validCodec: RenderCodec = codecMap[codec] || "h264";
  const svgContents = projectId ? getProject(projectId)?.svgContents : undefined;
  const job = enqueueRender(sceneId || "untitled", code, durationInFrames || 250, fps || 25, width || 3840, height || 2160, validCodec, svgContents);
  return Response.json(job);
}
