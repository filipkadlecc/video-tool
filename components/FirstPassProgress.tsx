"use client";

import React from "react";
import Icon from "@/components/ui/Icon";
import Button from "@/components/ui/Button";

export interface FirstPassState {
  mode: "smarttrim" | "compose";
  status: "analyzing" | "building" | "error";
  fileCount: number;
  fileIndex: number; // 1-based
  fileName: string;
  stageLabel: string;
  /** Compose only: whether editorial notes were attached (drives a visible signal). */
  notesAttached?: boolean;
  error?: string;
}

/**
 * The "we're building your first cut" panel shown in the preview area while a
 * fresh video project runs its automatic first pass (analyze → smart-trim /
 * compose). Replaces the bare "No scene loaded" dead-end.
 */
export default function FirstPassProgress({
  state,
  onDismiss,
}: {
  state: FirstPassState;
  onDismiss: () => void;
}) {
  const analyzing = state.status === "analyzing";
  const building = state.status === "building";
  const error = state.status === "error";

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "#000",
      }}
    >
      <div style={{ width: 440, maxWidth: "90%", display: "flex", flexDirection: "column", gap: 20 }}>
        {!error && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid var(--border-hairline)", borderTopColor: "var(--brand)", display: "inline-block", animation: "vt-spin 0.8s linear infinite" }} />
            <span style={{ fontSize: 15, fontWeight: 600 }}>Building your first cut…</span>
          </div>
        )}
        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Icon name="warn" size={16} style={{ color: "var(--danger)" }} />
            <span style={{ fontSize: 15, fontWeight: 600 }}>First pass hit a snag</span>
          </div>
        )}

        {/* Notes signal (compose): make a build-from-nothing cut impossible to miss. */}
        {state.mode === "compose" && !error && (
          <div
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
              borderRadius: 6, fontSize: 12,
              background: state.notesAttached ? "var(--brand-tint-bg)" : "var(--warning-tint-bg)",
              color: state.notesAttached ? "var(--brand)" : "var(--warning)",
              border: `1px solid ${state.notesAttached ? "var(--brand-tint-line)" : "var(--warning)"}`,
            }}
          >
            <Icon name={state.notesAttached ? "check" : "warn"} size={13} />
            {state.notesAttached
              ? "Using your editorial notes to drive the cut."
              : "No editorial notes attached — building a cut from the transcript only. Add notes and re-run to follow your KEEP/comments."}
          </div>
        )}

        {/* Two-step rail: Analyze → Build */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Step
            n={1}
            label="Analyze the footage"
            detail={
              analyzing
                ? `${state.fileName || "…"}${state.stageLabel ? ` · ${state.stageLabel}` : ""}${state.fileCount > 1 ? `  (clip ${state.fileIndex} of ${state.fileCount})` : ""}`
                : "Transcript, scene cuts, auto-reframe"
            }
            active={analyzing}
            done={building}
          />
          <Step
            n={2}
            label={state.mode === "smarttrim" ? "Cut the dead air" : "AI builds the edit from your notes"}
            detail={building ? state.stageLabel || "Working…" : "Silences + fillers, or an AI first cut"}
            active={building}
            done={false}
          />
        </div>

        {error ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 12, color: "var(--ink-tertiary)", lineHeight: 1.5 }}>{state.error}</div>
            <div>
              <Button variant="outline" size="sm" onClick={onDismiss}>Dismiss — edit manually</Button>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 11, color: "var(--ink-disabled)", lineHeight: 1.5 }}>
            This runs in the background — a few minutes for long / 4K clips. You can leave this tab;
            it keeps going and the edit lands once it finishes.
          </div>
        )}
      </div>
    </div>
  );
}

function Step({
  n,
  label,
  detail,
  active,
  done,
}: {
  n: number;
  label: string;
  detail: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", opacity: active || done ? 1 : 0.5 }}>
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          fontSize: 11,
          fontWeight: 600,
          background: done ? "var(--brand)" : active ? "var(--brand-tint-bg)" : "var(--surface-raised)",
          color: done ? "var(--brand-ink)" : active ? "var(--brand)" : "var(--ink-disabled)",
          border: active ? "1px solid var(--brand)" : "1px solid var(--border-hairline)",
        }}
      >
        {done ? <Icon name="check" size={12} /> : n}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
        <span className="mono" style={{ fontSize: 10, color: "var(--ink-disabled)", overflow: "hidden", textOverflow: "ellipsis" }}>
          {detail}
        </span>
      </div>
    </div>
  );
}
