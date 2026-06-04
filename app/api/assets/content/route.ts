import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const assetPath = request.nextUrl.searchParams.get("path");

  if (!assetPath) {
    return Response.json({ error: "path parameter required" }, { status: 400 });
  }

  if (!assetPath.endsWith(".svg")) {
    return Response.json({ error: "Only SVG files supported" }, { status: 400 });
  }

  // Prevent path traversal
  const normalized = path.normalize(assetPath);
  if (normalized.includes("..")) {
    return Response.json({ error: "Invalid path" }, { status: 400 });
  }

  const fullPath = path.join(process.cwd(), "public", normalized);

  if (!fs.existsSync(fullPath)) {
    return Response.json({ error: "File not found" }, { status: 404 });
  }

  const content = fs.readFileSync(fullPath, "utf-8");
  const filename = path.basename(fullPath);

  return Response.json({ content, filename });
}
