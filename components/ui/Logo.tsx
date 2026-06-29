"use client";

import React from "react";

export default function Logo({ size = 22, onClick }: { size?: number; onClick?: () => void }) {
  const inner = (
    <>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 6,
          background: "var(--accent)",
          display: "grid",
          placeItems: "center",
          boxShadow: "0 0 0 0.5px rgba(0,0,0,0.3), 0 4px 12px oklch(0.88 0.22 124 / 0.3)",
        }}
      >
        <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 16 16" fill="var(--accent-ink)">
          <path d="M9 2L3 9h4l-1 5 6-7H8z" />
        </svg>
      </div>
      <span
        className="mono"
        style={{ fontSize: 13, letterSpacing: -0.2, fontWeight: 600, color: "var(--text-0)" }}
      >
        video<span style={{ color: "var(--text-2)" }}>/</span>tool
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="focus-ring"
        title="Home"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 9,
          padding: 0,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          opacity: 1,
          transition: "opacity 120ms",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.75")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
      >
        {inner}
      </button>
    );
  }

  return <div style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>{inner}</div>;
}
