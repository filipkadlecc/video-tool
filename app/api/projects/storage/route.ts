import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import type { Project } from "@/lib/types";
import type { ProjectStorageEntry } from "@/lib/format";

const PROJECTS_DIR = path.join(process.cwd(), "data", "projects");

function dirSize(dir: string): number {
  let total = 0;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    try {
      if (entry.isDirectory()) {
        total += dirSize(full);
      } else if (entry.isFile()) {
        total += fs.statSync(full).size;
      }
    } catch {}
  }
  return total;
}

export async function GET() {
  if (!fs.existsSync(PROJECTS_DIR)) {
    return NextResponse.json({ projects: [], totalBytes: 0 });
  }

  const entries = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true });
  const results: ProjectStorageEntry[] = [];
  let totalBytes = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const projectDir = path.join(PROJECTS_DIR, entry.name);
    const jsonPath = path.join(projectDir, "project.json");
    if (!fs.existsSync(jsonPath)) continue;

    let meta: Project;
    try {
      meta = JSON.parse(fs.readFileSync(jsonPath, "utf-8")) as Project;
    } catch {
      continue;
    }

    const bytes = dirSize(projectDir);
    const mediaDir = path.join(projectDir, "media");
    const mediaBytes = fs.existsSync(mediaDir) ? dirSize(mediaDir) : 0;
    const hasThumbnail = fs.existsSync(path.join(projectDir, "thumbnail.png"));

    totalBytes += bytes;
    results.push({
      id: meta.id,
      name: meta.name,
      animationType: meta.animationType,
      bytes,
      mediaBytes,
      updatedAt: meta.updatedAt,
      hasThumbnail,
    });
  }

  results.sort((a, b) => b.bytes - a.bytes);
  return NextResponse.json({ projects: results, totalBytes });
}
