"use client";

import React, { useCallback, useRef } from "react";

/**
 * Scalar slider. 3px track, filled portion `ink-secondary`, 11px round knob.
 *
 * Drags report `transient: true` so a whole drag collapses into one undo
 * entry — the same contract ScrubNumber uses.
 */
interface SliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number, opts?: { transient?: boolean }) => void;
  disabled?: boolean;
  style?: React.CSSProperties;
}

export default function Slider({
  value, min = 0, max = 100, step = 1, onChange, disabled, style,
}: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const valueFromEvent = useCallback((clientX: number) => {
    const el = trackRef.current;
    if (!el) return value;
    const r = el.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    const raw = min + t * (max - min);
    return Math.round(raw / step) * step;
  }, [min, max, step, value]);

  const onDown = (e: React.PointerEvent) => {
    if (disabled) return;
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    onChange(valueFromEvent(e.clientX), { transient: true });
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    onChange(valueFromEvent(e.clientX), { transient: true });
  };
  const onUp = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    // The committing call — this is the one that lands in history.
    onChange(valueFromEvent(e.clientX));
  };

  const pct = max === min ? 0 : Math.max(0, Math.min(1, (value - min) / (max - min)));

  return (
    <div
      ref={trackRef}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      style={{
        position: "relative",
        flex: 1,
        height: 16,
        display: "flex",
        alignItems: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        touchAction: "none",
        ...style,
      }}
    >
      <div style={{ position: "absolute", inset: "auto 0", height: 3, borderRadius: 2, background: "var(--border-hairline)" }} />
      <div style={{ position: "absolute", left: 0, width: `${pct * 100}%`, height: 3, borderRadius: 2, background: "var(--ink-secondary)" }} />
      <div
        style={{
          position: "absolute",
          left: `calc(${pct * 100}% - 5.5px)`,
          width: 11,
          height: 11,
          borderRadius: "var(--r-pill)",
          background: "var(--ink-primary)",
        }}
      />
    </div>
  );
}
