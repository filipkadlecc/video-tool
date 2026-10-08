import fs from "fs";
import path from "path";
import type Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";

const REFERENCES_DIR = path.join(process.cwd(), "public", "assets", "apify", "references");

const MIME: Record<string, "image/png" | "image/jpeg" | "image/webp" | "image/gif"> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

// Keep every reference at or under 1568px on the long edge: Opus 5.5 rejects
// any image over 2000px in a many-image request (the render loop makes it
// one), and the API downsizes to ~1568px anyway, so nothing is lost. Enforced
// here now rather than trusted to whoever drops a file in the folder.
const MAX_LONG_EDGE = 1568;
// The house references plus a person's own ride in one request with the
// render loop's frames; a handful shows a look, a dozen just costs tokens.
const MAX_HOUSE_REFERENCES = 6;
export const MAX_USER_REFERENCES = 6;

type ImageMedia = "image/png" | "image/jpeg" | "image/webp" | "image/gif";

/** Shrink an image to MAX_LONG_EDGE if it is bigger; otherwise pass it through. */
async function fitImage(data: Buffer, mediaType: ImageMedia): Promise<{ data: Buffer; mediaType: ImageMedia }> {
  try {
    const meta = await sharp(data).metadata();
    const longEdge = Math.max(meta.width ?? 0, meta.height ?? 0);
    if (longEdge <= MAX_LONG_EDGE) return { data, mediaType };
    const resized = await sharp(data)
      .resize({ width: MAX_LONG_EDGE, height: MAX_LONG_EDGE, fit: "inside" })
      .png()
      .toBuffer();
    return { data: resized, mediaType: "image/png" };
  } catch {
    return { data, mediaType };
  }
}

let cached: Anthropic.ImageBlockParam[] | null = null;

export async function getApifyReferenceImages(): Promise<Anthropic.ImageBlockParam[]> {
  if (cached) return cached;
  if (!fs.existsSync(REFERENCES_DIR)) {
    cached = [];
    return cached;
  }
  const blocks: Anthropic.ImageBlockParam[] = [];
  for (const name of fs.readdirSync(REFERENCES_DIR).sort()) {
    if (blocks.length >= MAX_HOUSE_REFERENCES) break;
    if (name.startsWith(".")) continue;
    const ext = path.extname(name).toLowerCase();
    const mediaType = MIME[ext];
    if (!mediaType) continue;
    const fitted = await fitImage(fs.readFileSync(path.join(REFERENCES_DIR, name)), mediaType);
    blocks.push({
      type: "image",
      source: { type: "base64", media_type: fitted.mediaType, data: fitted.data.toString("base64") },
    });
  }
  cached = blocks;
  return cached;
}

const IMAGE_TYPES = new Set<string>(["image/png", "image/jpeg", "image/gif", "image/webp"]);

/**
 * A data: URI a person attached, as an image block no bigger than the limit —
 * or null if it isn't a usable image.
 */
export async function dataUriToImageBlock(dataUri: string): Promise<Anthropic.ImageBlockParam | null> {
  const m = /^data:([^;,]+);base64,(.+)$/.exec(dataUri.trim());
  if (!m) return null;
  const mediaType = m[1].toLowerCase();
  if (!IMAGE_TYPES.has(mediaType)) return null;
  const fitted = await fitImage(Buffer.from(m[2], "base64"), mediaType as ImageMedia);
  return {
    type: "image",
    source: { type: "base64", media_type: fitted.mediaType, data: fitted.data.toString("base64") },
  };
}

/** The attached data URIs as image blocks, capped and with the unusable dropped. */
export async function userReferenceBlocks(images: unknown): Promise<Anthropic.ImageBlockParam[]> {
  if (!Array.isArray(images)) return [];
  const blocks = await Promise.all(
    images.slice(0, MAX_USER_REFERENCES).filter((u): u is string => typeof u === "string").map(dataUriToImageBlock),
  );
  return blocks.filter((b): b is Anthropic.ImageBlockParam => b !== null);
}

export const USER_REFERENCE_INTRO =
  "The person attached the image(s) below as the LOOK to go for with this request — a style, a composition, a mood, or a frame from something they like. Name the style to yourself and build it in the brand: match its framing, rhythm, density and feel. Don't copy its text or logos, and the brand rules still win (brand black, one orange accent, the house fonts). If it shows a UI or a screenshot of real content, that content IS what to show.";

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

// The contact sheet goes first: the whole scene at a glance before the detail
// frames, so pacing and sameness get judged before pixels.
export function contactSheetToContentBlocks(
  sheetBase64: string | null,
): Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam> {
  if (!sheetBase64) return [];
  return [
    {
      type: "text",
      text:
        "Contact sheet — 24 frames spread evenly across the WHOLE video, left to right, top to bottom, each stamped with its time. Read it like an editor scrubbing the cut: does something new happen every 3–5 seconds, or is it one idea stretched over the runtime? Are there dead stretches where nothing changes? Do the tiles all look alike? Does the ending land?",
    },
    { type: "image", source: { type: "base64", media_type: "image/png", data: sheetBase64 } },
    { type: "text", text: "Detail frames:" },
  ];
}

export const APIFY_REFERENCE_INTRO =
  "The image(s) attached are Apify marketing design references. Treat them as STYLE references only — match the dark canvas, the bold headline with one orange-highlighted phrase, the checkmark bullet rows, and the orange pill CTAs. Ignore the small top-left wordmark and any small '+' / crosshair corner marks you see in the references — both have been removed from the design system. DO NOT copy the literal text, layout coordinates, or specific frames pixel-for-pixel. Apply the visual grammar to whatever the user has actually asked for.";
