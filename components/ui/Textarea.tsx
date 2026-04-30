"use client";

import React, { useState } from "react";

interface TextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  style?: React.CSSProperties;
  onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
}

export default function Textarea({ value, onChange, placeholder, rows = 4, style, onKeyDown }: TextareaProps) {
  const [focus, setFocus] = useState(false);

  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      rows={rows}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      className="vt-scroll"
      style={{
        width: "100%",
        padding: "10px 12px",
        background: "var(--bg-inset)",
        border: `0.5px solid ${focus ? "var(--accent-line)" : "var(--line-2)"}`,
        borderRadius: "var(--r-sm)",
        color: "var(--text-0)",
        fontSize: 13,
        fontFamily: "inherit",
        resize: "vertical",
        outline: "none",
        lineHeight: 1.5,
        transition: "border-color 120ms",
        ...style,
      }}
    />
  );
}
