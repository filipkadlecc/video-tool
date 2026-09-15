"use client";

import React, { useState } from "react";
import Icon from "./Icon";

/**
 * M5 button. Four variants, four heights, and no others.
 *
 * The one rule that matters beyond the values: ONE filled brand button per
 * screen. Orange marks the single action a screen or dialog exists for. Two at
 * once and it marks nothing.
 *
 * Destructive is OUTLINED danger, not a solid red slab — and where it competes
 * with a safe default it belongs at the opposite end of the footer so it can't
 * be hit on momentum. That placement is the caller's job.
 */

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "dense" | "chrome" | "form" | "dialog";

/** Pre-M5 names, still in ~49 call sites. Removed at the end of Stage 1. */
type LegacyVariant = "default" | "outline";
type LegacySize = "sm" | "md" | "lg";

const VARIANT_ALIAS: Record<LegacyVariant, Variant> = {
  default: "secondary",
  outline: "secondary",
};
const SIZE_ALIAS: Record<LegacySize, Size> = {
  sm: "chrome",
  md: "form",
  lg: "dialog",
};

/** Height, horizontal padding, gap. Padding follows the whole rule:
 *  small controls 8, medium 12, large 16. */
const SIZES: Record<Size, { h: number; px: number; gap: number }> = {
  dense:  { h: 24, px: 8,  gap: 4 },
  chrome: { h: 28, px: 12, gap: 6 },
  form:   { h: 32, px: 12, gap: 6 },
  dialog: { h: 40, px: 16, gap: 8 },
};

interface VariantStyle {
  bg: string;
  color: string;
  border: string;
  hoverBg: string;
  hoverColor?: string;
  pressBg?: string;
}

const VARIANTS: Record<Variant, VariantStyle> = {
  primary: {
    bg: "var(--brand)",
    color: "var(--brand-ink)",
    border: "1px solid transparent",
    hoverBg: "var(--brand-hover)",
    pressBg: "var(--brand-press)",
  },
  secondary: {
    bg: "var(--surface-raised)",
    color: "var(--ink-primary)",
    border: "1px solid var(--border-edge)",
    hoverBg: "var(--surface-hover)",
    pressBg: "var(--surface-active)",
  },
  ghost: {
    bg: "transparent",
    color: "var(--ink-secondary)",
    border: "1px solid transparent",
    hoverBg: "var(--surface-raised)",
    hoverColor: "var(--ink-primary)",
    pressBg: "var(--surface-hover)",
  },
  danger: {
    bg: "var(--danger-tint-bg)",
    color: "var(--danger)",
    border: "1px solid var(--danger-tint-line)",
    hoverBg: "var(--danger-tint-hover)",
    pressBg: "var(--danger-tint-hover)",
  },
};

const DISABLED: VariantStyle = {
  bg: "var(--surface-raised)",
  color: "var(--ink-disabled)",
  border: "1px solid var(--border-hairline)",
  hoverBg: "var(--surface-raised)",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant | LegacyVariant;
  size?: Size | LegacySize;
  icon?: string;
  /** Icon after the label rather than before — for "Next ·" style actions. */
  iconRight?: string;
  full?: boolean;
}

export default function Button({
  variant = "secondary",
  size = "form",
  icon,
  iconRight,
  full,
  children,
  disabled,
  style = {},
  ...rest
}: ButtonProps) {
  const [hover, setHover] = useState(false);
  const [press, setPress] = useState(false);

  const v: Variant = variant in VARIANT_ALIAS ? VARIANT_ALIAS[variant as LegacyVariant] : (variant as Variant);
  const sz: Size = size in SIZE_ALIAS ? SIZE_ALIAS[size as LegacySize] : (size as Size);

  const s = SIZES[sz] ?? SIZES.form;
  const look = disabled ? DISABLED : (VARIANTS[v] ?? VARIANTS.secondary);

  const bg = disabled
    ? look.bg
    : press
      ? (look.pressBg ?? look.hoverBg)
      : hover
        ? look.hoverBg
        : look.bg;

  return (
    <button
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPress(false); }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      disabled={disabled}
      className="focus-ring"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: s.gap,
        height: s.h,
        padding: `0 ${s.px}px`,
        // Control step: Inter 500 13px / 1.
        fontSize: "var(--t-control-size)",
        fontWeight: "var(--t-control-weight)" as unknown as number,
        lineHeight: 1,
        color: hover && !disabled && look.hoverColor ? look.hoverColor : look.color,
        background: bg,
        border: look.border,
        borderRadius: "var(--r-control)",
        cursor: disabled ? "not-allowed" : "pointer",
        // Nothing scales. Nothing bounces.
        transition: "background var(--dur-state) var(--ease), color var(--dur-state) var(--ease)",
        width: full ? "100%" : undefined,
        whiteSpace: "nowrap",
        ...style,
      }}
      {...rest}
    >
      {icon && <Icon name={icon} size={15} />}
      {children}
      {iconRight && <Icon name={iconRight} size={15} />}
    </button>
  );
}
