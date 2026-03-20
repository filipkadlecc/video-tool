import { enqueueRender } from "@/lib/render-queue";
import type { RenderCodec } from "@/lib/render-queue";

export async function POST(request: Request) {
  const { sceneId, code, durationInFrames, fps, width, height, codec } = await request.json();

  if (!code) {
    return Response.json({ error: "code is required" }, { status: 400 });
  }

  const validCodec: RenderCodec = codec === "prores" ? "prores" : "h264";
  const job = enqueueRender(sceneId || "untitled", code, durationInFrames || 250, fps || 25, width || 3840, height || 2160, validCodec);
  return Response.json(job);
}
