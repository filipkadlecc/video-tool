"use client";

import React from "react";

/**
 * A switch.
 *
 * AN ON TOGGLE IS WHITE, NOT GREEN. A setting you leave on is not a live state
 * — green means something is happening right now. This is the single easiest
 * thing in the design to get wrong, so it is stated here rather than inferred.
 */
interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** "chrome" = 34x20 (toolbars, panels). "inspector" = 26x16 (section headers). */
  size?: "chrome" | "inspector";
  disabled?: boolean;
  label?: string;
  style?: React.CSSProperties;
}

const DIMS = {
  chrome:    { w: 34, h: 20, knob: 16 },
  inspector: { w: 26, h: 16, knob: 12 },
} as const;

export default function Toggle({
  checked, onChange, size = "chrome", disabled, label, style,
}: ToggleProps) {
  const d = DIMS[size];
  const travel = d.w - d.knob - 2;

  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className="focus-ring"
      style={{
        position: "relative",
        width: d.w,
        height: d.h,
        flexShrink: 0,
        padding: 0,
        border: "none",
        borderRadius: "var(--r-pill)",
        background: checked ? "var(--ink-primary)" : "var(--surface-active)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "background var(--dur-state) var(--ease)",
        ...style,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: checked ? travel : 2,
          width: d.knob,
          height: d.knob,
          borderRadius: "var(--r-pill)",
          background: checked ? "var(--surface-void)" : "var(--ink-tertiary)",
          transition: "left var(--dur-state) var(--ease), background var(--dur-state) var(--ease)",
        }}
      />
    </button>
  );
}
