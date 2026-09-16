"use client";

import React from "react";

/**
 * Segmented control — for EITHER/OR values. (Underline tabs are for places;
 * see Tabs.) Container is `surface-void` with a hairline; the active segment is
 * `surface-hover`, NOT brand. Orange is reserved for the one primary action.
 */
interface SegmentedOption {
  value: string | number;
  label: string;
  /** Optional shortcut shown beside the label, e.g. the Cut/Direct switcher. */
  shortcut?: string;
  disabled?: boolean;
}

interface SegmentedProps {
  value: string | number;
  onChange: (value: string | number) => void;
  options: SegmentedOption[];
  /** 26 is the toolbar switcher; 24 the dense filter row. */
  height?: number;
  /** Fill the width, splitting it evenly — for a control that owns its row. */
  stretch?: boolean;
  style?: React.CSSProperties;
}

export default function Segmented({ value, onChange, options, height = 26, stretch, style }: SegmentedProps) {
  return (
    <div
      style={{
        display: stretch ? "flex" : "inline-flex",
        padding: 2,
        gap: 2,
        background: "var(--surface-void)",
        borderRadius: "var(--r-control)",
        border: "1px solid var(--border-hairline)",
        ...style,
      }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            onClick={() => !o.disabled && onChange(o.value)}
            disabled={o.disabled}
            className="focus-ring"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              height,
              flex: stretch ? 1 : undefined,
              minWidth: 0,
              padding: "0 10px",
              fontSize: "var(--t-control-size)",
              fontWeight: "var(--t-control-weight)" as unknown as number,
              lineHeight: 1,
              color: o.disabled
                ? "var(--ink-disabled)"
                : active ? "var(--ink-primary)" : "var(--ink-secondary)",
              background: active ? "var(--surface-hover)" : "transparent",
              border: "none",
              borderRadius: "var(--r-item)",
              cursor: o.disabled ? "not-allowed" : "pointer",
              transition: "background var(--dur-state) var(--ease), color var(--dur-state) var(--ease)",
            }}
          >
            {o.label}
            {o.shortcut && (
              <span
                className="t-data-s"
                style={{ color: active ? "var(--ink-tertiary)" : "var(--ink-disabled)" }}
              >
                {o.shortcut}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
