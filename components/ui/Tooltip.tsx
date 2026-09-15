"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Tooltip. 400ms delay, 180ms fade.
 *
 * NEVER put one on a button that already has a visible label — it replaces the
 * 52 native `title` attributes the old app used, it does not add noise on top
 * of text that is already there.
 *
 * Shortcut strings shown here MUST match the menus and the shortcuts dialog
 * exactly; they are the same strings by contract.
 */
interface TooltipProps {
  label: string;
  shortcut?: string;
  placement?: "top" | "bottom";
  children: React.ReactElement;
}

const DELAY = 400;

export default function Tooltip({ label, shortcut, placement = "bottom", children }: TooltipProps) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [shown, setShown] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const hostRef = useRef<HTMLSpanElement>(null);

  const clear = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = undefined;
  }, []);

  useEffect(() => () => clear(), [clear]);

  const open = () => {
    clear();
    timer.current = window.setTimeout(() => {
      const el = hostRef.current?.firstElementChild ?? hostRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPos({
        x: r.left + r.width / 2,
        y: placement === "bottom" ? r.bottom + 6 : r.top - 6,
      });
      setShown(true);
    }, DELAY);
  };

  const close = () => { clear(); setShown(false); setPos(null); };

  return (
    <>
      <span
        ref={hostRef}
        style={{ display: "contents" }}
        onMouseEnter={open}
        onMouseLeave={close}
        onPointerDown={close}
      >
        {children}
      </span>
      {shown && pos && typeof document !== "undefined" && createPortal(
        <div
          role="tooltip"
          style={{
            position: "fixed",
            left: pos.x,
            top: pos.y,
            transform: `translate(-50%, ${placement === "bottom" ? "0" : "-100%"})`,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 8px",
            background: "var(--surface-void)",
            border: "1px solid var(--border-edge)",
            borderRadius: "var(--r-control)",
            boxShadow: "var(--shadow-float)",
            pointerEvents: "none",
            zIndex: 9000,
            whiteSpace: "nowrap",
            animation: "vt-fade-in var(--dur-enter) var(--ease)",
          }}
        >
          <span className="t-caption" style={{ color: "var(--ink-primary)" }}>{label}</span>
          {shortcut && (
            <span className="t-data-s" style={{ color: "var(--ink-tertiary)" }}>{shortcut}</span>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
