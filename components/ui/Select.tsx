"use client";

import React from "react";
import Icon from "./Icon";

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** 24 = inspector row, 32 = form. */
  height?: number;
  disabled?: boolean;
  style?: React.CSSProperties;
}

/** A native select underneath, so keyboard and platform behaviour come free. */
export default function Select({
  value, onChange, options, height = 32, disabled, style,
}: SelectProps) {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        height,
        background: "var(--surface-raised)",
        border: "1px solid var(--border-hairline)",
        borderRadius: "var(--r-control)",
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="focus-ring"
        style={{
          appearance: "none",
          WebkitAppearance: "none",
          width: "100%",
          height: "100%",
          padding: `0 ${height >= 32 ? 28 : 22}px 0 ${height >= 32 ? 12 : 8}px`,
          background: "transparent",
          border: "none",
          outline: "none",
          color: "var(--ink-primary)",
          fontSize: "var(--t-control-size)",
          fontFamily: "inherit",
          cursor: disabled ? "not-allowed" : "pointer",
          borderRadius: "var(--r-control)",
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <Icon
        name="chevronDown"
        size={12}
        style={{
          position: "absolute",
          right: height >= 32 ? 10 : 6,
          color: "var(--ink-tertiary)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
