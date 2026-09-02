import fs from "fs";
import path from "path";
import type Anthropic from "@anthropic-ai/sdk";

const REFERENCES_DIR = path.join(process.cwd(), "public", "assets", "apify", "references");

const MIME: Record<string, "image/png" | "image/jpeg" | "image/webp" | "image/gif"> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

let cached: Anthropic.ImageBlockParam[] | null = null;

export function getApifyReferenceImages(): Anthropic.ImageBlockParam[] {
  if (cached) return cached;
  if (!fs.existsSync(REFERENCES_DIR)) {
    cached = [];
    return cached;
  }
  const blocks: Anthropic.ImageBlockParam[] = [];
  for (const name of fs.readdirSync(REFERENCES_DIR).sort()) {
    if (name.startsWith(".")) continue;
    const ext = path.extname(name).toLowerCase();
    const mediaType = MIME[ext];
    if (!mediaType) continue;
    const data = fs.readFileSync(path.join(REFERENCES_DIR, name)).toString("base64");
    blocks.push({
      type: "image",
      source: { type: "base64", media_type: mediaType, data },
    });
  }
  cached = blocks;
  return cached;
}

// Turn rendered still frames into labelled content blocks (a "Frame N of D:"
// caption before each image) so the model can SEE its own output and critique
// it. Reuses the exact base64 image-block shape as the Apify style references —
// the same channel the model already receives images through.
export function framesToContentBlocks(
  frames: { frame: number; pngBase64: string }[],
  durationInFrames?: number,
): Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam> {
  const blocks: Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam> = [];
  for (const f of frames) {
    blocks.push({
      type: "text",
      text: durationInFrames
        ? `Rendered frame ${f.frame} of ${durationInFrames}:`
        : `Rendered frame ${f.frame}:`,
    });
    blocks.push({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: f.pngBase64 },
    });
  }
  return blocks;
}

export const APIFY_REFERENCE_INTRO =
  "The image(s) attached are Apify marketing design references. Treat them as STYLE references only — match the dark canvas, the small top-left wordmark, the bold headline with one orange-highlighted phrase, the checkmark bullet rows, and the orange pill CTAs. Ignore any small '+' / crosshair corner marks you see in the references — those have been removed from the design system. DO NOT copy the literal text, layout coordinates, or specific frames pixel-for-pixel. Apply the visual grammar to whatever the user has actually asked for.";
