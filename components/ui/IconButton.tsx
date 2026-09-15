"use client";

import React, { useState } from "react";
import Icon from "./Icon";

/** 28px square by default, 24px in dense chrome. Radius 4, 15px glyph. */
interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string;
  active?: boolean;
  /** 28 = chrome default, 24 = dense (timeline, inspector rows). */
  size?: number;
  /** Renders the glyph in danger red — for destructive inline actions. */
  tone?: "default" | "danger";
}

export default function IconButton({
  icon, active, size = 28, tone = "default", disabled, style, ...rest
}: IconButtonProps) {
  const [hover, setHover] = useState(false);

  const color = disabled
    ? "var(--ink-disabled)"
    : tone === "danger"
      ? "var(--danger)"
      : active || hover
        ? "var(--ink-primary)"
        : "var(--ink-secondary)";

  return (
    <button
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      disabled={disabled}
      className="focus-ring"
      style={{
        width: size,
        height: size,
        display: "grid",
        placeItems: "center",
        background: disabled
          ? "transparent"
          : active
            ? "var(--surface-hover)"
            : hover
              ? "var(--surface-raised)"
              : "transparent",
        border: `1px solid ${active ? "var(--border-edge)" : "transparent"}`,
        color,
        borderRadius: "var(--r-control)",
        cursor: disabled ? "not-allowed" : "pointer",
        padding: 0,
        transition: "background var(--dur-state) var(--ease), color var(--dur-state) var(--ease)",
        ...style,
      }}
      {...rest}
    >
      <Icon name={icon} size={size >= 28 ? 15 : 13} />
    </button>
  );
}
