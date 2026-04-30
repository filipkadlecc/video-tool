"use client";

import React, { useState } from "react";

interface InputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  mono?: boolean;
  suffix?: string;
  autoFocus?: boolean;
  style?: React.CSSProperties;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
}

export default function Input({ value, onChange, placeholder, type = "text", mono, suffix, autoFocus, style, onKeyDown }: InputProps) {
  const [focus, setFocus] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: 36,
        padding: "0 12px",
        background: "var(--bg-inset)",
        border: `0.5px solid ${focus ? "var(--accent-line)" : "var(--line-2)"}`,
        borderRadius: "var(--r-sm)",
        transition: "border-color 120ms",
        ...style,
      }}
    >
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        type={type}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          flex: 1,
          border: "none",
          outline: "none",
          background: "transparent",
          color: "var(--text-0)",
          fontSize: 13,
          fontFamily: mono ? "var(--mono)" : "inherit",
        }}
      />
      {suffix && (
        <span className="mono" style={{ fontSize: 11, color: "var(--text-2)" }}>
          {suffix}
        </span>
      )}
    </div>
  );
}
