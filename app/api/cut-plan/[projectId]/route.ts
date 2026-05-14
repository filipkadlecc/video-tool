import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/projects";
import { planCuts, generateRemotionCode, DEFAULT_THRESHOLDS, type CutPlanThresholds } from "@/lib/cut-plan";
import type { Transcript } from "@/lib/transcribe";

interface PostBody {
  transcript: Transcript;
  thresholds?: Partial<CutPlanThresholds>;
  /** If provided, also return generated Remotion code using mediaSrc + fps. */
  generate?: { mediaSrc: string; fps: number };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const project = getProject(projectId);
  if (!project) return new Response("Project not found", { status: 404 });

  const body = (await request.json()) as PostBody;
  if (!body.transcript || !Array.isArray(body.transcript.words)) {
    return NextResponse.json({ error: "transcript with words[] is required" }, { status: 400 });
  }

  const thresholds: CutPlanThresholds = { ...DEFAULT_THRESHOLDS, ...(body.thresholds ?? {}) };
  const plan = planCuts(body.transcript, thresholds);

  const code = body.generate
    ? generateRemotionCode(plan, body.generate)
    : undefined;

  return NextResponse.json({ ok: true, plan, code });
}
