import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import os from "os";

export async function GET(req: NextRequest) {
  const reqPath = req.nextUrl.searchParams.get("path") || os.homedir();
  const showHidden = req.nextUrl.searchParams.get("hidden") === "1";

  try {
    const stat = await fs.stat(reqPath);
    if (!stat.isDirectory()) {
      return NextResponse.json({ error: "Not a directory" }, { status: 400 });
    }

    const raw = await fs.readdir(reqPath, { withFileTypes: true });
    const dirs = raw
      .filter((e) => e.isDirectory() && (showHidden || !e.name.startsWith(".")))
      .map((e) => ({ name: e.name }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

    const mediaCount = raw.filter((e) => {
      if (!e.isFile()) return false;
      const ext = path.extname(e.name).toLowerCase();
      return [".mp4", ".mov", ".webm", ".mkv", ".m4v", ".avi", ".mp3", ".wav", ".m4a", ".aac", ".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext);
    }).length;

    const parent = path.dirname(reqPath);

    return NextResponse.json({
      path: reqPath,
      parent: parent === reqPath ? null : parent,
      home: os.homedir(),
      entries: dirs,
      mediaCount,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
