"use client";

import React from "react";

/**
 * A skeleton, at the real size of what is coming.
 *
 * THE WORD "LOADING" APPEARS NOWHERE in this app — it was in six places, and
 * it tells you nothing you didn't already know from the fact that nothing is
 * there yet. A shape the size of the thing you are waiting for does tell you
 * something: how much is coming, and where it will be.
 *
 * Shimmers .35 -> .7 -> .35 over 1.4s, staggered 150ms down a list so it reads
 * as one surface breathing rather than a row of blinking bars.
 */
export default function Skeleton({
  width = "100%", height = 12, radius = "var(--r-item)", delay = 0, style,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  /** Index in a list, for the stagger. */
  delay?: number;
  style?: React.CSSProperties;
}) {
  return (
    <span
      aria-hidden
      style={{
        display: "block",
        width,
        height,
        borderRadius: radius,
        background: "var(--surface-raised)",
        animation: `vt-skeleton 1.4s var(--ease) ${delay * 150}ms infinite`,
        ...style,
      }}
    />
  );
}

/** A few lines of skeleton, for a list that is on its way. */
export function SkeletonList({ rows = 3, height = 12, gap = 8 }: {
  rows?: number; height?: number; gap?: number;
}) {
  const widths = ["78%", "54%", "66%", "44%", "72%"];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={height} width={widths[i % widths.length]} delay={i} />
      ))}
    </div>
  );
}
