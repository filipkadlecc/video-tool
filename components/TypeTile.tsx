"use client";

import React, { useState } from "react";
import type { AnimationType } from "@/lib/types";
import { getAnimationTypeMeta } from "@/lib/animation-types";
import Icon from "@/components/ui/Icon";

interface TypeTileProps {
  type: AnimationType;
  active?: boolean;
  size?: "sm" | "lg";
  count?: number;
  onClick: () => void;
}

export default function TypeTile({ type, active = false, size = "sm", count, onClick }: TypeTileProps) {
  const meta = getAnimationTypeMeta(type);
  const [hover, setHover] = useState(false);
  const isLarge = size === "lg";

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flex: 1,
        padding: isLarge ? 22 : 14,
        minHeight: isLarge ? 180 : undefined,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: isLarge ? 14 : 10,
        background: active ? "var(--accent-soft)" : hover ? "var(--bg-3)" : "var(--bg-inset)",
        border: `0.5px solid ${active ? "var(--accent)" : hover ? meta.color : "var(--line-2)"}`,
        borderRadius: "var(--r-md)",
        cursor: "pointer",
        textAlign: "left",
        color: "var(--text-0)",
        transition: "all 120ms",
      }}
    >
      <div
        style={{
          width: isLarge ? 44 : 32,
          height: isLarge ? 44 : 32,
          borderRadius: isLarge ? 10 : 6,
          background: `color-mix(in oklab, ${meta.color} 15%, transparent)`,
          border: `0.5px solid color-mix(in oklab, ${meta.color} 40%, transparent)`,
          color: meta.color,
          display: "grid",
          placeItems: "center",
        }}
      >
        <Icon name={meta.icon} size={isLarge ? 22 : 16} />
      </div>
      <div style={{ width: "100%" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 8,
            marginBottom: isLarge ? 4 : 2,
          }}
        >
          <span style={{ fontSize: isLarge ? 16 : 13, fontWeight: 600 }}>{meta.label}</span>
          {typeof count === "number" && (
            <span
              className="mono nums"
              style={{
                fontSize: isLarge ? 11 : 10,
                color: "var(--text-2)",
                background: "var(--bg-3)",
                padding: "2px 6px",
                borderRadius: 3,
              }}
            >
              {count}
            </span>
          )}
        </div>
        <div style={{ fontSize: isLarge ? 12 : 11, color: "var(--text-2)", lineHeight: 1.4 }}>
          {meta.subtitle}
        </div>
      </div>
    </button>
  );
}
