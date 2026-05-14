import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const RENDERS_DIR = path.join(process.cwd(), "public", "renders");

function statRenders() {
  if (!fs.existsSync(RENDERS_DIR)) {
    return { count: 0, totalBytes: 0, oldestMs: null as number | null };
  }
  let count = 0;
  let totalBytes = 0;
  let oldestMs: number | null = null;
  for (const f of fs.readdirSync(RENDERS_DIR)) {
    const full = path.join(RENDERS_DIR, f);
    try {
      const s = fs.statSync(full);
      if (!s.isFile()) continue;
      count++;
      totalBytes += s.size;
      if (oldestMs === null || s.mtimeMs < oldestMs) oldestMs = s.mtimeMs;
    } catch {}
  }
  return { count, totalBytes, oldestMs };
}

export async function GET() {
  return NextResponse.json(statRenders());
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    all?: boolean;
    olderThanDays?: number;
  };
  const olderThanDays = body.olderThanDays ?? 7;
  const all = body.all === true;

  if (!fs.existsSync(RENDERS_DIR)) {
    return NextResponse.json({ deleted: 0, freedBytes: 0 });
  }

  const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
  let deleted = 0;
  let freedBytes = 0;
  for (const f of fs.readdirSync(RENDERS_DIR)) {
    const full = path.join(RENDERS_DIR, f);
    try {
      const s = fs.statSync(full);
      if (!s.isFile()) continue;
      if (all || s.mtimeMs < cutoff) {
        freedBytes += s.size;
        fs.unlinkSync(full);
        deleted++;
      }
    } catch {}
  }
  return NextResponse.json({ deleted, freedBytes });
}
