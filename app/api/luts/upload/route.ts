import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { CUSTOM_DIR, isCubeFilename } from "@/lib/luts";

export const runtime = "nodejs";

function safeBasename(name: string): string {
  return path.basename(name).replace(/^\.+/, "");
}

// Upload a custom .cube LUT. Filename via ?name=; body is the raw .cube bytes.
// Streamed straight to public/luts/custom/ (mirrors the media upload route).
export async function POST(request: NextRequest) {
  const rawName = request.nextUrl.searchParams.get("name");
  if (!rawName) {
    return NextResponse.json({ error: "name query param required" }, { status: 400 });
  }
  const filename = safeBasename(rawName);
  if (!filename || !isCubeFilename(filename)) {
    return NextResponse.json({ error: "expected a .cube file" }, { status: 400 });
  }
  if (!request.body) {
    return NextResponse.json({ error: "missing body" }, { status: 400 });
  }

  fs.mkdirSync(CUSTOM_DIR, { recursive: true });
  const target = path.join(CUSTOM_DIR, filename);
  const writeStream = fs.createWriteStream(target);
  try {
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

  // id matches what listLuts() emits for custom LUTs, so the client can select it immediately.
  return NextResponse.json({ ok: true, id: `custom/${filename}`, name: filename });
}
