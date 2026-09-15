"use client";

import React from "react";

/**
 * Underline tabs — for PLACES (panel tabs). The other kind is Segmented, for
 * either/or values. Two kinds, and only two.
 */
interface TabOption {
  value: string;
  label: string;
  /** Inert and `ink-disabled` — e.g. Audio on a text clip. */
  disabled?: boolean;
}

interface TabsProps {
  value: string;
  onChange: (value: string) => void;
  options: TabOption[];
  height?: number;
  style?: React.CSSProperties;
}

export default function Tabs({ value, onChange, options, height = 32, style }: TabsProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        height,
        gap: 16,
        borderBottom: "1px solid var(--border-hairline)",
        ...style,
      }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => !o.disabled && onChange(o.value)}
            disabled={o.disabled}
            className="focus-ring"
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              fontSize: "var(--t-control-size)",
              fontWeight: "var(--t-control-weight)" as unknown as number,
              color: o.disabled
                ? "var(--ink-disabled)"
                : active ? "var(--ink-primary)" : "var(--ink-tertiary)",
              cursor: o.disabled ? "default" : "pointer",
              // The underline sits ON the container's bottom hairline.
              boxShadow: active ? "inset 0 -1px 0 0 var(--ink-primary)" : undefined,
              transition: "color var(--dur-state) var(--ease)",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
