"use client";

import React from "react";
import type { AnimationType } from "@/lib/types";
import { getAnimationTypeMeta } from "@/lib/animation-types";

export default function TypeBadge({ type }: { type: string }) {
  const meta = getAnimationTypeMeta(type as AnimationType);

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
        color: meta.color,
        background: meta.colorSoft,
        borderRadius: 3,
        border: `0.5px solid ${meta.color}`,
        borderColor: "color-mix(in oklab, currentColor 25%, transparent)",
      }}
    >
      {meta.badgeLabel}
    </span>
  );
}
