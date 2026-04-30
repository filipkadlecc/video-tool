"use client";

import React from "react";

const BADGE_MAP: Record<string, { label: string; c: string; bg: string }> = {
  broll: { label: "B-ROLL", c: "var(--magenta)", bg: "var(--magenta-soft)" },
  animation: { label: "ANIMATION", c: "var(--cyan)", bg: "var(--cyan-soft)" },
  svg: { label: "SVG", c: "var(--amber)", bg: "var(--amber-soft)" },
  video: { label: "VIDEO", c: "var(--accent)", bg: "var(--accent-soft)" },
};

export default function TypeBadge({ type }: { type: string }) {
  const { label, c, bg } = BADGE_MAP[type] ?? BADGE_MAP.animation;

  return (
    <span
      className="mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 20,
        padding: "0 7px",
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: 0.08,
        textTransform: "uppercase",
        color: c,
        background: bg,
        borderRadius: 3,
        border: `0.5px solid ${c}`,
        borderColor: "color-mix(in oklab, currentColor 25%, transparent)",
      }}
    >
      {label}
    </span>
  );
}
