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
 * Landscape now takes the same kit. It was the last thing still rendering in
 * Inter at 5.8% of frame height, which is why a 16:9 cut looked nothing like
 * the design while a 9:16 cut matched it.
 *
 * Everything is expressed against the kit's 1080x1920 design frame and scaled,
 * so a 4K document gets the same layout rather than the same pixels.
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

  // Landscape gets the same kit, scaled off the SHORT edge.
  //
  // The kit is drawn on a 1080x1920 frame, so its short edge is 1080 — the same
  // as a 1080p landscape frame's height. Scaling off height therefore gives a
  // landscape subtitle the same physical size as a vertical one, rather than
  // the same fraction of a much wider frame.
  //
  // What does NOT carry over is the y position. 1021 is where it sits to clear
  // TikTok's UI; a landscape frame has no such bands, so these stay anchored
  // near the bottom where a viewer expects subtitles.
  const k = size.height / 1080;
  const width = Math.round(624 * k);
  const height = Math.round(138 * k);
  return {
    type: "captions" as const,
    id: makeId("captions"),
    from,
    durationInFrames,
    layout: {
      x: Math.round((size.width - width) / 2),
      y: Math.round(size.height - height - size.height * 0.08),
      width,
      height,
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
    // Same column width as vertical, so the same words fit on a line.
    maxWordsPerPage: 5,
  };
}
