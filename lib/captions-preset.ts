import { makeId } from "./editor-doc";
import type { CaptionToken, CaptionsItem } from "./editor-doc";

/**
 * A captions item styled for the document's shape.
 *
 * Vertical gets the short-form treatment from the Figma kit: GT Walsheim rather
 * than Inter, a drop shadow so it survives over footage, and — the part that
 * matters — a position INSIDE the platform safe area. The old default put
 * captions 8% up from the bottom, which on a 1920-tall frame is y~1630, well
 * below TikTok's safe edge at ~1280 and squarely behind its own caption bar.
 * Figma places them at y=1021, and that is what this uses.
 *
 * Everything is expressed against the kit's 1080x1920 design frame and scaled,
 * so a 4K vertical document gets the same layout rather than the same pixels.
 */
export function captionItem(
  size: { width: number; height: number },
  from: number,
  fps: number,
  tokens: CaptionToken[],
  spanSec: number,
): CaptionsItem {
  const vertical = size.height > size.width;
  const durationInFrames = Math.max(1, Math.round(spanSec * fps));

  if (vertical) {
    const k = size.height / 1920; // the kit's design frame
    return {
      type: "captions" as const,
      id: makeId("captions"),
      from,
      durationInFrames,
      // Figma 2629:7 — 624x138 at (227, 1021) in the 1080x1920 frame.
      layout: {
        x: Math.round(227 * k),
        y: Math.round(1021 * k),
        width: Math.round(624 * k),
        height: Math.round(138 * k),
      },
      tokens,
      style: {
        fontFamily: "'GT Walsheim', Inter, sans-serif",
        fontSize: Math.round(68.751 * k),
        fontWeight: 400,
        color: "#FFFFFF",
        align: "center" as const,
        lineHeight: 1,
        textShadow: `0px ${Math.round(4 * k)}px ${Math.round(3 * k)}px rgba(0,0,0,0.25)`,
      },
      highlightColor: "#F86606",
      pageDurationMs: 1200,
      // Two lines is the brief, and 624px holds about three words a line at
      // this size.
      maxWordsPerPage: 5,
    };
  }

  const height = Math.round(size.height * 0.22);
  return {
    type: "captions" as const,
    id: makeId("captions"),
    from,
    durationInFrames,
    layout: {
      x: Math.round(size.width * 0.08),
      y: Math.round(size.height - height - size.height * 0.08),
      width: Math.round(size.width * 0.84),
      height,
    },
    tokens,
    style: {
      fontFamily: "Inter, sans-serif",
      fontSize: Math.round(size.height * 0.058),
      fontWeight: 700,
      color: "#F4F4F5",
      align: "center" as const,
    },
    highlightColor: "#F86606",
    pageDurationMs: 1200,
    maxWordsPerPage: 6,
  };
}
