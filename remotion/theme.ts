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

/**
 * The horizontal axis the kit's centred content actually sits on.
 *
 * Not 540. Every centred frame in the Figma page lands on 539.5 —
 * 230 + 619/2, 231 + 617/2 and 223.5 + 632/2 all agree — so centring on the
 * true middle of a 1080px canvas puts everything half a pixel right of the
 * design. Half a pixel is invisible; it is also the difference between a
 * verified port and an approximate one.
 */
export const VERTICAL_CENTRE_X = 539.5;

/**
 * GT Walsheim's baseline as a fraction of font size inside a `line-height: 1`
 * box: ascent (0.9em) plus half-leading, which is negative because the font's
 * content box is 1.145em (hhea ascent 900, descent -245, upem 1000).
 */
const GT_BASELINE = 0.9 + (1 - 1.145) / 2; // 0.8275

/**
 * Whole-pixel correction to put a plain (unboxed) run of GT Walsheim where
 * Figma puts it.
 *
 * Chrome snaps a text baseline to a whole device pixel; Figma does not. The
 * residual is therefore never more than 1px, and which way it falls depends
 * only on where `size * GT_BASELINE` sits relative to a pixel boundary.
 * Measured against the kit's own Figma exports:
 *
 *   72     -> ideal 59.58, rounds to 60 (+0.42)  needs 1px
 *   106.982-> ideal 88.53, rounds to 89 (+0.47)  needs 1px
 *   143.145-> ideal 118.45, rounds to 118 (-0.45) needs 0
 *   155.723-> ideal 128.86, rounds to 129 (+0.14) needs 0
 *
 * Only for text positioned by the top of its line box. Text centred inside a
 * padded box is placed by flex and needs no correction — and gets none.
 * scripts/figma-diff.ts is what keeps this honest: if it is ever wrong for a
 * new size, the diff says so.
 */
export function figmaBaselineNudge(fontSizePx: number): number {
  const ideal = fontSizePx * GT_BASELINE;
  return Math.round(ideal) - ideal > 0.35 ? 1 : 0;
}

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
