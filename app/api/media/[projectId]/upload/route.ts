import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { getProject } from "@/lib/projects";

export const runtime = "nodejs";
export const maxDuration = 1800; // up to 30 min for very large files

const VIDEO_EXTS = new Set([".mp4", ".mov", ".webm", ".mkv", ".avi", ".m4v"]);
const AUDIO_EXTS = new Set([".mp3", ".wav", ".m4a", ".aac"]);
const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

function isAllowed(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return VIDEO_EXTS.has(ext) || AUDIO_EXTS.has(ext) || IMAGE_EXTS.has(ext);
}

function safeBasename(name: string): string {
  return path.basename(name).replace(/^\.+/, "");
}

// One file per request, streamed straight to disk. Filename comes via ?name=
// query param; the request body is the raw file bytes. This avoids buffering
// huge videos into memory and lets the client track upload progress via XHR.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const project = getProject(projectId);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (!project.mediaFolder) {
    return NextResponse.json(
      { error: "Project has no media folder (not a video project)" },
      { status: 400 }
    );
  }

  const rawName = request.nextUrl.searchParams.get("name");
  if (!rawName) {
    return NextResponse.json({ error: "name query param required" }, { status: 400 });
  }
  const filename = safeBasename(rawName);
  if (!filename) {
    return NextResponse.json({ error: "invalid filename" }, { status: 400 });
  }
  if (!isAllowed(filename)) {
    return NextResponse.json({ error: "unsupported extension" }, { status: 400 });
  }

  if (!fs.existsSync(project.mediaFolder)) {
    fs.mkdirSync(project.mediaFolder, { recursive: true });
  }
  if (!request.body) {
    return NextResponse.json({ error: "missing body" }, { status: 400 });
  }

  const target = path.join(project.mediaFolder, filename);
  const writeStream = fs.createWriteStream(target);
  try {
    // Web ReadableStream → Node Readable → fs write stream, with backpressure.
    await pipeline(Readable.fromWeb(request.body as never), writeStream);
  } catch (err) {
    writeStream.destroy();
    try {
      fs.unlinkSync(target);
    } catch {}
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }

  const stat = fs.statSync(target);
  return NextResponse.json({ ok: true, name: filename, size: stat.size });
}
