"use client";

import React from "react";

/**
 * TikTok / YouTube Shorts safe-zone guides for the preview.
 *
 * Every asset in the short-form kit is positioned against these, so without a
 * way to see them the placements are unverifiable by eye — and the platforms
 * put their own UI (caption bar, right-hand action rail, profile chrome) over
 * the parts that are dimmed here.
 *
 * Rendered as a DOM layer OUTSIDE the Remotion <Player>, exactly like the
 * rule-of-thirds grid it sits beside, which is what guarantees it can never
 * appear in an export.
 *
 * The paths are Figma's own Union vectors from the kit's "Safe zones + formats"
 * section (2544:312 TikTok, 2544:332 Shorts), used verbatim rather than
 * re-derived — they are the spec. Each is offset to where it sits in the
 * 1080x1920 frame. Fill is even-odd: the outer rectangle is the whole frame and
 * the inner shape is the hole you may safely use.
 */
export type SafeZone = "off" | "tiktok" | "shorts";

const PATHS: Record<Exclude<SafeZone, "off">, { d: string; dx: number; dy: number }> = {
  // 2544:312 — viewBox 1081x1919, placed at (-1, 1)
  tiktok: {
    d: "M1081 1919H1V1396H0V0H1081V1919ZM133 1279H851V365H971V258H133V1279Z",
    dx: -1,
    dy: 1,
  },
  // 2544:332 — viewBox 1080x1928, placed at (0, 0.2549)
  shorts: {
    d: "M1080 1928H0V0H1080V1928ZM61 249V1544H877V721H951V249H61Z",
    dx: 0,
    dy: 0.2548828125,
  },
};

export default function SafeZoneOverlay({ zone }: { zone: SafeZone }) {
  if (zone === "off") return null;
  const { d, dx, dy } = PATHS[zone];
  return (
    <svg
      aria-hidden
      viewBox="0 0 1080 1920"
      preserveAspectRatio="none"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 2 }}
    >
      <g transform={`translate(${dx} ${dy})`}>
        {/* The unsafe area, dimmed. Light enough to work over both a black
            scene and bright footage without hiding either. */}
        <path d={d} fillRule="evenodd" fill="rgba(0,0,0,0.45)" />
        {/* And its edge, so the boundary is readable rather than inferred. */}
        <path d={d} fillRule="evenodd" fill="none" stroke="rgba(248,102,6,0.55)" strokeWidth={2} />
      </g>
    </svg>
  );
}
