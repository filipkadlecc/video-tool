"use client";

import React from "react";

interface SegmentedOption {
  value: string | number;
  label: string;
}

interface SegmentedProps {
  value: string | number;
  onChange: (value: string | number) => void;
  options: SegmentedOption[];
}

export default function Segmented({ value, onChange, options }: SegmentedProps) {
  return (
    <div
      style={{
        display: "inline-flex",
        padding: 2,
        gap: 2,
        background: "var(--bg-inset)",
        borderRadius: "var(--r-sm)",
        border: "0.5px solid var(--line-2)",
      }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            onClick={() => onChange(o.value)}
            className="mono"
            style={{
              height: 26,
              padding: "0 10px",
              minWidth: 42,
              fontSize: 11,
              fontWeight: 500,
              color: active ? "var(--accent-ink)" : "var(--text-1)",
              background: active ? "var(--accent)" : "transparent",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              transition: "all 120ms",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
