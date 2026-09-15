"use client";

import React, { useState } from "react";

/**
 * A field. 32px is the form default; 24px is the dense inspector row.
 * Fields are `surface-raised` — raised is for things you type into.
 */
interface InputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  mono?: boolean;
  /** Trailing text — a unit, an extension, a shortcut hint. */
  suffix?: string;
  /** Leading glyph slot, e.g. a search icon. */
  prefix?: React.ReactNode;
  height?: number;
  autoFocus?: boolean;
  disabled?: boolean;
  /** Select the whole value on mount — the Rename dialog wants this. */
  selectOnFocus?: boolean;
  style?: React.CSSProperties;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
}

export default function Input({
  value, onChange, placeholder, type = "text", mono, suffix, prefix,
  height = 32, autoFocus, disabled, selectOnFocus, style, onKeyDown,
}: InputProps) {
  const [focus, setFocus] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        height,
        padding: `0 ${height >= 32 ? 12 : 8}px`,
        background: "var(--surface-raised)",
        border: `1px solid ${focus ? "var(--border-edge)" : "var(--border-hairline)"}`,
        borderRadius: "var(--r-control)",
        boxShadow: focus ? "var(--focus-ring)" : undefined,
        transition: "border-color var(--dur-state) var(--ease), box-shadow var(--dur-state) var(--ease)",
        opacity: disabled ? 0.6 : 1,
        ...style,
      }}
    >
      {prefix}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        type={type}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        onFocus={(e) => { setFocus(true); if (selectOnFocus) e.currentTarget.select(); }}
        onBlur={() => setFocus(false)}
        style={{
          flex: 1,
          minWidth: 0,
          border: "none",
          outline: "none",
          background: "transparent",
          color: "var(--ink-primary)",
          fontSize: mono ? "var(--t-data-m-size)" : "var(--t-body-size)",
          fontFamily: mono ? "var(--font-mono)" : "inherit",
          fontVariantNumeric: mono ? "tabular-nums" : undefined,
        }}
      />
      {suffix && (
        <span className="t-data-s" style={{ color: "var(--ink-tertiary)", flexShrink: 0 }}>
          {suffix}
        </span>
      )}
    </div>
  );
}
