"use client";

import React, { useState } from "react";
import Icon from "./Icon";

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string;
  active?: boolean;
  size?: number;
}

export default function IconButton({ icon, active, size = 28, style, ...rest }: IconButtonProps) {
  const [hover, setHover] = useState(false);

  return (
    <button
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="focus-ring"
      style={{
        width: size,
        height: size,
        display: "grid",
        placeItems: "center",
        background: active ? "var(--bg-4)" : hover ? "var(--bg-3)" : "transparent",
        border: "0.5px solid transparent",
        borderColor: active ? "var(--line-2)" : "transparent",
        color: active ? "var(--text-0)" : "var(--text-1)",
        borderRadius: "var(--r-sm)",
        cursor: "pointer",
        transition: "background 120ms",
        ...style,
      }}
      {...rest}
    >
      <Icon name={icon} size={Math.round(size * 0.55)} />
    </button>
  );
}
