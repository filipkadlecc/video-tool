import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import { getProject } from "@/lib/projects";

const PROJECTS_DIR = path.join(process.cwd(), "data", "projects");

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const project = getProject(projectId);
  if (!project) return new Response("Project not found", { status: 404 });

  const outPath = path.join(PROJECTS_DIR, projectId, "out.mp4");
  if (!fs.existsSync(outPath)) {
    return new Response("No render yet", { status: 404 });
  }

  const stat = fs.statSync(outPath);
  const rangeHeader = request.headers.get("range");

  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : stat.size - 1;
      const chunkSize = end - start + 1;
      const stream = fs.createReadStream(outPath, { start, end });
      return new Response(stream as unknown as ReadableStream, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunkSize),
          "Content-Type": "video/mp4",
        },
      });
    }
  }

  const stream = fs.createReadStream(outPath);
  return new Response(stream as unknown as ReadableStream, {
    headers: {
      "Content-Length": String(stat.size),
      "Content-Type": "video/mp4",
      "Accept-Ranges": "bytes",
    },
  });
}
