"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";

export interface MenuItem {
  /** A separator: 1px hairline, margin 4px 8px. */
  separator?: true;
  label?: string;
  icon?: string;
  shortcut?: string;
  destructive?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}

interface MenuProps {
  items: MenuItem[];
  /** The element that opens the menu. Clicks bubble to the wrapper. */
  children: React.ReactNode;
  align?: "left" | "right";
  minWidth?: number;
}

export default function Menu({ items, children, align = "left", minWidth = 180 }: MenuProps) {
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const hostRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!anchor) return;
    const close = () => setAnchor(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
    };
  }, [anchor]);

  // useCallback so the ref is read when the handler FIRES, not during render.
  const toggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setAnchor((cur) => {
      if (cur) return null;
      const el = hostRef.current?.firstElementChild ?? hostRef.current;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: align === "right" ? r.right : r.left, y: r.bottom + 4 };
    });
  }, [align]);

  return (
    <>
      {/* onClick sits on the wrapper rather than being cloned onto the child:
          events bubble through a display:contents box, and cloning a handler in
          means reading a ref during render. */}
      <span ref={hostRef} style={{ display: "contents" }} onClick={toggle}>
        {children}
      </span>
      {anchor && typeof document !== "undefined" && createPortal(
        <div
          role="menu"
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            left: anchor.x,
            top: anchor.y,
            transform: align === "right" ? "translateX(-100%)" : undefined,
            minWidth,
            padding: 4,
            background: "var(--surface-raised)",
            border: "1px solid var(--border-edge)",
            borderRadius: "var(--r-panel)",
            boxShadow: "var(--shadow-float)",
            zIndex: 9000,
            animation: "vt-fade-in var(--dur-enter) var(--ease)",
          }}
        >
          {items.map((it, i) =>
            it.separator ? (
              <div key={i} style={{ height: 1, background: "var(--border-hairline)", margin: "4px 8px" }} />
            ) : (
              <MenuRow key={i} item={it} onDone={() => setAnchor(null)} />
            ),
          )}
        </div>,
        document.body,
      )}
    </>
  );
}

function MenuRow({ item, onDone }: { item: MenuItem; onDone: () => void }) {
  const [hover, setHover] = useState(false);
  const color = item.disabled
    ? "var(--ink-disabled)"
    : item.destructive
      ? "var(--danger)"
      : "var(--ink-primary)";

  return (
    <button
      role="menuitem"
      disabled={item.disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => { if (!item.disabled) { item.onSelect?.(); onDone(); } }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        height: 28,
        padding: "0 8px",
        background: hover && !item.disabled ? "var(--surface-hover)" : "transparent",
        border: "none",
        borderRadius: "var(--r-item)",
        color,
        fontSize: "var(--t-control-size)",
        fontWeight: "var(--t-control-weight)" as unknown as number,
        cursor: item.disabled ? "not-allowed" : "pointer",
        textAlign: "left",
      }}
    >
      {item.icon && <Icon name={item.icon} size={14} />}
      <span style={{ flex: 1 }}>{item.label}</span>
      {item.shortcut && (
        <span className="t-data-s" style={{ color: "var(--ink-disabled)" }}>{item.shortcut}</span>
      )}
    </button>
  );
}
