"use client";

import React, { useEffect } from "react";
import IconButton from "./IconButton";

/**
 * The dialog shell. ONE shell for all ten dialogs.
 *
 * Radius 10, `surface-chrome`, `border-edge`, the single shadow, a 32px body,
 * and a footer on `surface-void` whose actions are right-aligned at 40px.
 *
 * The rule for whether you should be using this at all: a DIALOG only when you
 * must type, or you cannot undo. Everything else is a toast with an Undo.
 */

/** The spec's ladder. Pick by content, not by eye. */
export type DialogWidth = 380 | 440 | 520 | 560 | 620 | 700;

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: DialogWidth | number;
  title?: string;
  /** A Body line under the title — the consequence, not a restatement. */
  subtitle?: React.ReactNode;
  stepLabel?: string;
  /** Right-aligned footer actions. Lay them out yourself for `space-between`. */
  footer?: React.ReactNode;
  /** A failure outlines the whole dialog in danger. */
  tone?: "default" | "danger";
  /** Hide the header's close button (a wizard carries its own). */
  hideClose?: boolean;
  /**
   * Apply the spec's 32px body padding. Opt-in, because the 15 pre-M5 dialogs
   * all pad themselves — each one drops its own padding and sets this when its
   * stage rebuilds it.
   */
  padded?: boolean;
  /**
   * When false, backdrop clicks and Escape do NOT close (the X still calls
   * onClose) — for anything mid-operation, like a render in progress.
   */
  dismissible?: boolean;
}

export default function Modal({
  open, onClose, children, width = 520, title, subtitle, stepLabel,
  footer, tone = "default", hideClose, padded, dismissible = true,
}: ModalProps) {
  useEffect(() => {
    if (!open || !dismissible) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose, dismissible]);

  if (!open) return null;

  return (
    <div
      onClick={dismissible ? onClose : undefined}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(10,10,11,0.6)",
        display: "grid",
        placeItems: "center",
        animation: `vt-fade-in var(--dur-enter) var(--ease)`,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          width,
          maxWidth: "calc(100vw - 48px)",
          maxHeight: "88%",
          display: "flex",
          flexDirection: "column",
          background: "var(--surface-chrome)",
          border: `1px solid ${tone === "danger" ? "var(--danger-tint-line)" : "var(--border-edge)"}`,
          borderRadius: "var(--r-dialog)",
          boxShadow: "var(--shadow-float)",
          overflow: "hidden",
        }}
      >
        {(title || stepLabel) && (
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 16,
            padding: padded ? "24px 32px 0" : "16px 20px",
            borderBottom: padded ? undefined : "1px solid var(--border-hairline)",
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {stepLabel && (
                <div className="t-section" style={{ color: "var(--ink-tertiary)", marginBottom: 8 }}>
                  {stepLabel}
                </div>
              )}
              {title && (
                <div className="t-title" style={{ color: "var(--ink-primary)" }}>{title}</div>
              )}
              {subtitle && (
                <div className="t-body" style={{ color: "var(--ink-secondary)", marginTop: 8 }}>
                  {subtitle}
                </div>
              )}
            </div>
            {/* `title` is the accessible name for an icon-only button — without
                it this ✕ was unnamed to a screen reader (and untestable). */}
            {!hideClose && <IconButton icon="close" title="Close" onClick={onClose} />}
          </div>
        )}

        <div className="vt-scroll" style={{ padding: padded ? 32 : undefined, overflowY: "auto", flex: "0 1 auto" }}>
          {children}
        </div>

        {footer && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "20px 32px",
              background: "var(--surface-void)",
              borderTop: "1px solid var(--border-hairline)",
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
