import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { getProject } from "@/lib/projects";
import {
  transcribe,
  transcribeWithCache,
  readCachedTranscript,
} from "@/lib/transcribe";

export const maxDuration = 300; // up to 5 minutes for long media

interface PostBody {
  mediaFile: string;        // relative path under project.mediaFolder
  model?: string;
  language?: string;
  force?: boolean;
}

function resolveMediaPath(projectMediaFolder: string, mediaFile: string): string | null {
  const resolved = path.resolve(projectMediaFolder, mediaFile);
  if (!resolved.startsWith(path.resolve(projectMediaFolder))) return null;
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) return null;
  return resolved;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const project = getProject(projectId);
  if (!project) return new Response("Project not found", { status: 404 });
  if (!project.mediaFolder) {
    return NextResponse.json(
      { error: "Project has no mediaFolder configured" },
      { status: 400 }
    );
  }

  const body = (await request.json()) as PostBody;
  if (!body.mediaFile) {
    return NextResponse.json({ error: "mediaFile is required" }, { status: 400 });
  }

  const mediaPath = resolveMediaPath(project.mediaFolder, body.mediaFile);
  if (!mediaPath) {
    return NextResponse.json(
      { error: `Media file not found or outside mediaFolder: ${body.mediaFile}` },
      { status: 404 }
    );
  }

  try {
    const transcript = body.force
      ? await transcribe(mediaPath, { model: body.model, language: body.language })
      : await transcribeWithCache(mediaPath, { model: body.model, language: body.language });
    return NextResponse.json({ ok: true, transcript });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Transcription failed",
      },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const project = getProject(projectId);
  if (!project) return new Response("Project not found", { status: 404 });
  if (!project.mediaFolder) {
    return NextResponse.json({ exists: false });
  }
  const mediaFile = request.nextUrl.searchParams.get("mediaFile");
  if (!mediaFile) {
    return NextResponse.json({ error: "mediaFile query param required" }, { status: 400 });
  }
  const mediaPath = resolveMediaPath(project.mediaFolder, mediaFile);
  if (!mediaPath) return NextResponse.json({ exists: false });

  const cached = await readCachedTranscript(mediaPath);
  return NextResponse.json({
    exists: cached != null,
    transcript: cached,
  });
}
