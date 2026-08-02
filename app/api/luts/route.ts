import { NextResponse } from "next/server";
import { listLuts } from "@/lib/luts";

export const runtime = "nodejs";

// Available color-grade LUTs (built-in + custom uploads) for the export picker.
export async function GET() {
  return NextResponse.json({ luts: listLuts() });
}
