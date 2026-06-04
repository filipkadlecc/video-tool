import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import { getProject } from "@/lib/projects";

const MIME_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".avi": "video/x-msvideo",
  ".m4v": "video/mp4",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; file: string[] }> }
) {
  const { projectId, file } = await params;
  const project = getProject(projectId);
  if (!project?.mediaFolder) {
    return new Response("Project has no media folder", { status: 404 });
  }

  // Resolve the file path within the media folder
  const relativePath = file.join("/");

  // Prevent path traversal
  const resolved = path.resolve(project.mediaFolder, relativePath);
  if (!resolved.startsWith(path.resolve(project.mediaFolder))) {
    return new Response("Invalid path", { status: 403 });
  }

  if (!fs.existsSync(resolved)) {
    return new Response("File not found", { status: 404 });
  }

  const stat = fs.statSync(resolved);
  if (!stat.isFile()) {
    return new Response("Not a file", { status: 400 });
  }

  const ext = path.extname(resolved).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  // Support range requests for video seeking
  const rangeHeader = request.headers.get("range");

  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : stat.size - 1;
      const chunkSize = end - start + 1;

      const stream = fs.createReadStream(resolved, { start, end });
      const readable = new ReadableStream({
        start(controller) {
          stream.on("data", (chunk) => controller.enqueue(typeof chunk === "string" ? Buffer.from(chunk) : chunk));
          stream.on("end", () => controller.close());
          stream.on("error", (err) => controller.error(err));
        },
        cancel() {
          stream.destroy();
        },
      });

      return new Response(readable, {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
          "Content-Length": String(chunkSize),
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }
  }

  // Full file response
  const stream = fs.createReadStream(resolved);
  const readable = new ReadableStream({
    start(controller) {
      stream.on("data", (chunk) => controller.enqueue(typeof chunk === "string" ? Buffer.from(chunk) : chunk));
      stream.on("end", () => controller.close());
      stream.on("error", (err) => controller.error(err));
    },
    cancel() {
      stream.destroy();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(stat.size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
