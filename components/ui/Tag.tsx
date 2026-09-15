"use client";

import React from "react";

/**
 * A pill. STATE ONLY — a pill is never an action. If it does something, it is
 * a button.
 */
export type TagTone = "neutral" | "live" | "warning" | "danger" | "data" | "brand";

interface TagProps {
  tone?: TagTone;
  children: React.ReactNode;
  /** The `live` tone carries a 5px dot; other tones never do. */
  dot?: boolean;
  style?: React.CSSProperties;
}

const TONES: Record<TagTone, { bg: string; color: string; border?: string }> = {
  neutral: { bg: "var(--surface-raised)", color: "var(--ink-secondary)" },
  live:    { bg: "var(--live-wash)",      color: "var(--live)" },
  warning: { bg: "var(--warning-tint-bg)", color: "var(--warning)", border: "var(--warning-tint-line)" },
  danger:  { bg: "var(--danger-tint-bg)",  color: "var(--danger)",  border: "var(--danger-tint-line)" },
  data:    { bg: "var(--surface-raised)",  color: "var(--ink-tertiary)" },
  brand:   { bg: "var(--brand-tint-bg)",   color: "var(--brand)",   border: "var(--brand-tint-line)" },
};

export default function Tag({ tone = "neutral", children, dot, style }: TagProps) {
  const t = TONES[tone];
  const isData = tone === "data";
  const showDot = dot ?? tone === "live";

  return (
    <span
      className={isData ? "t-data-s" : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 22,
        padding: "0 8px",
        borderRadius: "var(--r-pill)",
        background: t.bg,
        color: t.color,
        border: t.border ? `1px solid ${t.border}` : undefined,
        fontSize: isData ? undefined : "var(--t-caption-size)",
        fontWeight: isData ? undefined : 500,
        lineHeight: 1,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {showDot && (
        <span style={{ width: 5, height: 5, borderRadius: "var(--r-pill)", background: "currentColor", flexShrink: 0 }} />
      )}
      {children}
    </span>
  );
}
