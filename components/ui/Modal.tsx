"use client";

import React, { useEffect } from "react";
import IconButton from "./IconButton";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
  title?: string;
  stepLabel?: string;
}

export default function Modal({ open, onClose, children, width = 520, title, stepLabel }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(5,5,8,0.72)",
        backdropFilter: "blur(6px)",
        display: "grid",
        placeItems: "center",
        animation: "vt-fade-in 160ms ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width,
          maxHeight: "88%",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-2)",
          border: "0.5px solid var(--line-2)",
          borderRadius: "var(--r-lg)",
          boxShadow: "var(--sh-float)",
          overflow: "hidden",
        }}
      >
        {(title || stepLabel) && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "16px 20px",
              borderBottom: "0.5px solid var(--line-1)",
            }}
          >
            <div>
              {stepLabel && (
                <div className="mono cap" style={{ color: "var(--text-2)", marginBottom: 4 }}>
                  {stepLabel}
                </div>
              )}
              {title && (
                <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: -0.2 }}>{title}</div>
              )}
            </div>
            <div style={{ flex: 1 }} />
            <IconButton icon="close" onClick={onClose} />
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
