import type { CSSProperties } from "react";

export { BRAND } from "../lib/brand";

// Inline CSS each branded snippet emits via a <style> tag so GT Walsheim
// loads correctly in both the browser preview and `npx remotion render`.
// Files live in /Users/filip/video-tool/public/fonts/.
export const BRAND_FONT_FACE_CSS = `
@font-face {
  font-family: 'GT Walsheim';
  src: url('/fonts/GT-Walsheim-Light.ttf') format('truetype');
  font-weight: 300;
  font-style: normal;
  font-display: block;
}
@font-face {
  font-family: 'GT Walsheim';
  src: url('/fonts/GT-Walsheim-Regular.ttf') format('truetype');
  font-weight: 400;
  font-style: normal;
  font-display: block;
}
@font-face {
  font-family: 'GT Walsheim';
  src: url('/fonts/GT-Walsheim-Medium.ttf') format('truetype');
  font-weight: 500;
  font-style: normal;
  font-display: block;
}
@font-face {
  font-family: 'GT Walsheim';
  src: url('/fonts/GT-Walsheim-Bold.ttf') format('truetype');
  font-weight: 700;
  font-style: normal;
  font-display: block;
}
@font-face {
  font-family: 'GT Walsheim';
  src: url('/fonts/GT-Walsheim-Black.ttf') format('truetype');
  font-weight: 900;
  font-style: normal;
  font-display: block;
}
`;

// ---------------------------------------------------------------------------
// The vertical (9:16) design plane
// ---------------------------------------------------------------------------

/**
 * The Figma frame the short-form kit is drawn in. Scenes in that kit are ported
 * 1:1, so they position everything in THESE units — 143.145px type at (231, 712)
 * — rather than scaling off Math.min(width, height) the way the older branded
 * scenes do.
 */
export const VERTICAL_DESIGN = { width: 1080, height: 1920 } as const;

export type PlaneAnchor = "top" | "bottom" | "center";

/**
 * Wrap a 1080x1920 design plane so it fills any canvas without re-laying-out.
 *
 * ONE transform on the whole plane, never multiplied into each number. Layout
 * runs first at exactly the sizes the designer typed, so glyph advances, kerning
 * and line-break decisions are computed against the real values; then the
 * finished layout is scaled as a unit, and Chrome rasterises glyphs at the
 * composited scale so they stay sharp. Multiplying every number instead would
 * round at each site, let a string that fits one line at 1080 wrap at 2160, and
 * make a 4K render something other than a 2x of the verified 1080 one — which
 * is the only claim the fidelity harness can make.
 *
 * Design WIDTH is the invariant: type has to read at a constant fraction of
 * screen width. `anchor` then decides what happens to the leftover height on a
 * canvas that is not exactly 9:16 — bottom for lower thirds and subtitles, top
 * for titles and logo lockups.
 *
 * At exactly 1080x1920 this emits NO transform at all. That is deliberate and
 * load-bearing: the diffed render then goes through zero resampling, so any
 * mismatch it reports is a real authoring error rather than a rasteriser
 * artefact. (Same reason layoutStyle() in EditorComposition omits scale(1).)
 */
export function figmaPlane(
  canvasWidth: number,
  canvasHeight: number,
  anchor: PlaneAnchor = "center",
): { outer: CSSProperties; inner: CSSProperties } {
  const { width: DW, height: DH } = VERTICAL_DESIGN;
  const scale = canvasWidth / DW;
  const slack = canvasHeight / scale - DH;
  const ty = anchor === "top" ? 0 : anchor === "bottom" ? slack : slack / 2;

  const identity = scale === 1 && ty === 0;
  return {
    outer: { position: "absolute", inset: 0, overflow: "hidden" },
    inner: {
      position: "absolute",
      left: 0,
      top: 0,
      width: DW,
      height: DH,
      ...(identity ? {} : { transformOrigin: "0 0", transform: `scale(${scale}) translate(0px, ${ty}px)` }),
    },
  };
}
