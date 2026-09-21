import { NextResponse } from "next/server";
import { loadSnippetCatalog, catalogFor } from "@/lib/snippet-catalog";
import type { Orientation } from "@/lib/types";

const ORIENTATIONS: Orientation[] = ["horizontal", "vertical", "square"];

/**
 * The snippet library, for the browser UI.
 *
 * This used to walk remotion/scenes/branded itself, which is exactly the drift
 * the note at the top of lib/snippet-catalog.ts complains about — and it would
 * have meant writing the orientation filter twice. It now asks the catalog.
 *
 * `?orientation=vertical` returns only the scenes authored for that canvas
 * shape. Scenes with no SNIPPET_META entry stay unlisted, as before: five are
 * fully built but unnamed, and naming them is a separate decision.
 */
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("orientation");
  const orientation = ORIENTATIONS.find((o) => o === raw);
  const entries = orientation ? catalogFor(orientation) : loadSnippetCatalog();
  return NextResponse.json(
    entries
      .filter((e) => e.listed)
      .map(({ id, name, subtitle, code, orientations }) => ({ id, name, subtitle, code, orientations })),
  );
}
