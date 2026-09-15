"use client";

import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import Icon from "./Icon";

/**
 * Toasts.
 *
 * The rule that decides toast-vs-dialog: a DIALOG only when you must type, or
 * you cannot undo. Everything else is a toast with an Undo.
 *
 * Success auto-dismisses at 4s. FAILURE WAITS TO BE DISMISSED — an error that
 * vanishes on its own is an error you never read.
 *
 * Every failure says three things: what happened, what it cost you, what to do
 * next. `text` carries the first, `detail` the second, an action the third.
 */

export type ToastTone = "neutral" | "success" | "warning" | "danger" | "progress";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastSpec {
  tone?: ToastTone;
  text: string;
  detail?: string;
  actions?: ToastAction[];
  /** 0..1. Progress toasts are the one place green is allowed to persist. */
  progress?: number;
  /** e.g. "214 / 634 frames" — frames are what tell you it isn't stuck. */
  progressLabel?: string;
  /** ms. 0 keeps it up until dismissed. Defaults by tone. */
  duration?: number;
}

interface Toast extends ToastSpec { id: string }

interface ToastApi {
  show: (spec: ToastSpec) => string;
  success: (text: string, detail?: string, actions?: ToastAction[]) => string;
  error: (text: string, detail?: string, actions?: ToastAction[]) => string;
  warning: (text: string, detail?: string, actions?: ToastAction[]) => string;
  /** Returns an id you can `update` as the job advances. */
  progress: (text: string, progress: number, progressLabel?: string) => string;
  update: (id: string, patch: Partial<ToastSpec>) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const DEFAULT_DURATION: Record<ToastTone, number> = {
  neutral: 4000,
  success: 4000,
  warning: 0,
  danger: 0,      // failures wait
  progress: 0,
};

const TONE_ICON: Record<ToastTone, string | null> = {
  neutral: null,
  success: "check",
  warning: "warn",
  danger: "warn",
  progress: null,
};

const TONE_COLOR: Record<ToastTone, string> = {
  neutral: "var(--ink-secondary)",
  success: "var(--live)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  progress: "var(--live)",
};

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

let seq = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, number>());

  const dismiss = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    const h = timers.current.get(id);
    if (h) { window.clearTimeout(h); timers.current.delete(id); }
  }, []);

  const arm = useCallback((id: string, duration: number) => {
    const existing = timers.current.get(id);
    if (existing) window.clearTimeout(existing);
    if (duration > 0) {
      timers.current.set(id, window.setTimeout(() => dismiss(id), duration));
    } else {
      timers.current.delete(id);
    }
  }, [dismiss]);

  const show = useCallback((spec: ToastSpec) => {
    const id = `toast_${++seq}`;
    const tone = spec.tone ?? "neutral";
    setToasts((t) => [...t, { ...spec, tone, id }]);
    arm(id, spec.duration ?? DEFAULT_DURATION[tone]);
    return id;
  }, [arm]);

  const update = useCallback((id: string, patch: Partial<ToastSpec>) => {
    setToasts((t) => t.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    if (patch.duration !== undefined) arm(id, patch.duration);
  }, [arm]);

  useEffect(() => () => { timers.current.forEach((h) => window.clearTimeout(h)); }, []);

  const api = useMemo<ToastApi>(() => ({
    show,
    update,
    dismiss,
    success: (text, detail, actions) => show({ tone: "success", text, detail, actions }),
    error:   (text, detail, actions) => show({ tone: "danger",  text, detail, actions }),
    warning: (text, detail, actions) => show({ tone: "warning", text, detail, actions }),
    progress: (text, progress, progressLabel) =>
      show({ tone: "progress", text, progress, progressLabel }),
  }), [show, update, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastHost toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastHost({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (!toasts.length) return null;
  return (
    <div
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        zIndex: 9500,
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => <ToastCard key={t.id} toast={t} onDismiss={onDismiss} />)}
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const tone = toast.tone ?? "neutral";
  const glyph = TONE_ICON[tone];
  const color = TONE_COLOR[tone];

  return (
    <div
      style={{
        pointerEvents: "auto",
        minWidth: 280,
        maxWidth: 420,
        padding: "10px 12px",
        background: "var(--surface-raised)",
        border: `1px solid ${tone === "danger" ? "var(--danger-tint-line)" : "var(--border-edge)"}`,
        borderRadius: "var(--r-panel)",
        boxShadow: "var(--shadow-float)",
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        animation: "vt-fade-in var(--dur-enter) var(--ease)",
      }}
    >
      {tone === "progress" ? <Spinner /> : glyph ? (
        <Icon name={glyph} size={16} style={{ color, marginTop: 1, flexShrink: 0 }} />
      ) : null}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="t-body" style={{ color: "var(--ink-primary)" }}>{toast.text}</div>
        {toast.detail && (
          <div className="t-caption" style={{ color: "var(--ink-tertiary)", marginTop: 2 }}>
            {toast.detail}
          </div>
        )}

        {toast.progress !== undefined && (
          <div style={{ marginTop: 8 }}>
            <div style={{ height: 4, borderRadius: 2, background: "var(--surface-void)", overflow: "hidden" }}>
              <div
                style={{
                  width: `${Math.round(Math.max(0, Math.min(1, toast.progress)) * 100)}%`,
                  height: "100%",
                  background: "var(--live)",
                  transition: "width var(--dur-enter) var(--ease)",
                }}
              />
            </div>
            {toast.progressLabel && (
              <div className="t-data-s" style={{ color: "var(--live)", marginTop: 4 }}>
                {toast.progressLabel}
              </div>
            )}
          </div>
        )}

        {!!toast.actions?.length && (
          <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
            {toast.actions.map((a) => (
              <button
                key={a.label}
                onClick={() => { a.onClick(); onDismiss(toast.id); }}
                className="focus-ring"
                style={{
                  height: 24,
                  padding: "0 8px",
                  background: "transparent",
                  border: "1px solid transparent",
                  borderRadius: "var(--r-control)",
                  color: "var(--ink-secondary)",
                  fontSize: "var(--t-control-size)",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss"
        className="focus-ring"
        style={{
          width: 20, height: 20, display: "grid", placeItems: "center",
          background: "transparent", border: "none", borderRadius: "var(--r-control)",
          color: "var(--ink-disabled)", cursor: "pointer", flexShrink: 0, padding: 0,
        }}
      >
        <Icon name="close" size={12} />
      </button>
    </div>
  );
}

/** 16px ring: hairline with a `live` top border, 900ms linear. */
function Spinner() {
  return (
    <span
      style={{
        width: 16,
        height: 16,
        marginTop: 1,
        flexShrink: 0,
        borderRadius: "var(--r-pill)",
        border: "2px solid var(--border-hairline)",
        borderTopColor: "var(--live)",
        animation: "vt-spin 900ms linear infinite",
      }}
    />
  );
}
