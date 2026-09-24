"use client";

import React, { useCallback, useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { relativeTime } from "@/lib/format";
import type { EditorDoc } from "@/lib/editor-doc";

interface VersionMeta {
  id: string;
  createdAt: string;
  updatedAt: string;
  label: string;
  summary: string[];
  checkpoint: boolean;
}

interface Props {
  projectId: string;
  /** Bumped after every save, so a version that just landed shows up. */
  refreshKey: number;
  onRestore: (version: { doc?: EditorDoc; code?: string; createdAt: string }) => void;
}

const clock = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * Every saved version of the project, newest first, each one restorable.
 *
 * This is the long memory; Cmd+Z is the short one. Restoring doesn't delete
 * anything — the restored state is saved as a new version on top, so a restore
 * you regret is just another version to step back from.
 */
export default function HistoryPanel({ projectId, refreshKey, onRestore }: Props) {
  const [versions, setVersions] = useState<VersionMeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${projectId}/versions`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { versions: VersionMeta[] }) => {
        if (!cancelled) {
          setVersions(data.versions);
          setError(null);
        }
      })
      .catch(() => { if (!cancelled) setError("Couldn't load the history."); });
    return () => { cancelled = true; };
  }, [projectId, refreshKey]);

  const restore = useCallback(async (v: VersionMeta) => {
    setBusy(v.id);
    try {
      const res = await fetch(`/api/projects/${projectId}/versions/${v.id}`);
      if (!res.ok) throw new Error(String(res.status));
      onRestore(await res.json());
    } catch {
      setError("Couldn't restore that version.");
    } finally {
      setBusy(null);
    }
  }, [projectId, onRestore]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div
        style={{
          display: "flex", alignItems: "center", gap: 8, height: 32, flexShrink: 0,
          padding: "0 12px", borderBottom: "1px solid var(--border-hairline)",
        }}
      >
        <span className="t-section" style={{ color: "var(--ink-primary)" }}>History</span>
        {versions && (
          <span className="t-data-s" style={{ color: "var(--ink-tertiary)" }}>
            {versions.length} version{versions.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 0" }}>
        {error && (
          <div className="t-caption" style={{ color: "var(--danger, var(--ink-secondary))", padding: "8px 12px" }}>{error}</div>
        )}
        {versions && versions.length === 0 && (
          <div className="t-caption" style={{ color: "var(--ink-tertiary)", padding: "8px 12px" }}>
            No versions yet. Every change you make from now on is kept here, so you can go back to it any time.
          </div>
        )}
        {versions?.map((v, i) => (
          <div
            key={v.id}
            style={{
              padding: "8px 12px", borderBottom: "1px solid var(--border-hairline)",
              display: "flex", flexDirection: "column", gap: 4,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="t-control" style={{ color: "var(--ink-primary)" }}>{v.label}</span>
              {i === 0 && (
                <span className="t-data-s" style={{ color: "var(--ink-tertiary)" }}>current</span>
              )}
              <div style={{ flex: 1 }} />
              {i > 0 && (
                <Button size="dense" variant="secondary" disabled={busy !== null} onClick={() => restore(v)}>
                  {busy === v.id ? "Restoring…" : "Restore"}
                </Button>
              )}
            </div>
            <span className="t-data-s" style={{ color: "var(--ink-tertiary)" }} title={new Date(v.updatedAt).toLocaleString("en-GB")}>
              {relativeTime(v.updatedAt)} · {clock(v.updatedAt)}
            </span>
            {v.summary.length > 0 && (
              <span className="t-caption" style={{ color: "var(--ink-secondary)" }}>
                {v.summary.slice(0, 4).join(", ")}
                {v.summary.length > 4 ? `, and more` : ""}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
