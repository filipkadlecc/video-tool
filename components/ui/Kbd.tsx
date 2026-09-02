"use client";

import React from "react";

/** A small keycap for shortcut legends. */
export default function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 18,
        height: 18,
        padding: "0 5px",
        background: "var(--bg-3)",
        border: "0.5px solid var(--line-2)",
        borderBottomWidth: 1.5,
        borderRadius: 4,
        fontSize: 10,
        color: "var(--text-1)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}
