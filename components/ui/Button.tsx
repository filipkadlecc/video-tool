"use client";

import React, { useState } from "react";
import Icon from "./Icon";

type Variant = "default" | "primary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: string;
  full?: boolean;
}

const SIZES: Record<Size, { h: number; px: number; fs: number; gap: number }> = {
  sm: { h: 26, px: 10, fs: 12, gap: 6 },
  md: { h: 32, px: 14, fs: 13, gap: 7 },
  lg: { h: 40, px: 18, fs: 14, gap: 8 },
};

const VARIANTS: Record<Variant, { bg: string; color: string; border: string; hover: string }> = {
  default: { bg: "var(--bg-3)", color: "var(--text-0)", border: "0.5px solid var(--line-2)", hover: "var(--bg-4)" },
  primary: { bg: "var(--accent)", color: "var(--accent-ink)", border: "none", hover: "oklch(0.92 0.22 124)" },
  ghost: { bg: "transparent", color: "var(--text-1)", border: "0.5px solid transparent", hover: "var(--bg-3)" },
  danger: { bg: "var(--red)", color: "#fff", border: "none", hover: "oklch(0.72 0.22 25)" },
  outline: { bg: "transparent", color: "var(--text-0)", border: "0.5px solid var(--line-3)", hover: "var(--bg-3)" },
};

export default function Button({
  variant = "default",
  size = "md",
  icon,
  full,
  children,
  disabled,
  style = {},
  ...rest
}: ButtonProps) {
  const [hover, setHover] = useState(false);
  const s = SIZES[size];
  const v = VARIANTS[variant];

  return (
    <button
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      disabled={disabled}
      className="focus-ring"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: s.gap,
        height: s.h,
        padding: `0 ${s.px}px`,
        fontSize: s.fs,
        fontWeight: 500,
        letterSpacing: -0.1,
        color: v.color,
        background: hover && !disabled ? v.hover : v.bg,
        border: v.border,
        borderRadius: "var(--r-sm)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "background 120ms, transform 80ms",
        width: full ? "100%" : undefined,
        whiteSpace: "nowrap",
        ...style,
      }}
      {...rest}
    >
      {icon && <Icon name={icon} size={s.fs + 1} />}
      {children}
    </button>
  );
}
