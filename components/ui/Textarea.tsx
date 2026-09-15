"use client";

import React, { useState } from "react";

interface TextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  autoFocus?: boolean;
  style?: React.CSSProperties;
  onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
}

export default function Textarea({
  value, onChange, placeholder, rows = 4, autoFocus, style, onKeyDown,
}: TextareaProps) {
  const [focus, setFocus] = useState(false);

  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      rows={rows}
      autoFocus={autoFocus}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      className="vt-scroll t-body"
      style={{
        width: "100%",
        padding: "10px 12px",
        background: "var(--surface-raised)",
        border: `1px solid ${focus ? "var(--border-edge)" : "var(--border-hairline)"}`,
        borderRadius: "var(--r-control)",
        boxShadow: focus ? "var(--focus-ring)" : undefined,
        color: "var(--ink-primary)",
        fontFamily: "inherit",
        resize: "vertical",
        outline: "none",
        transition: "border-color var(--dur-state) var(--ease), box-shadow var(--dur-state) var(--ease)",
        ...style,
      }}
    />
  );
}
