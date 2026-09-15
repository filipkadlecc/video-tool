"use client";

import React, { useState, useEffect, useCallback } from "react";
import Modal from "@/components/ui/Modal";
import { useDialogs } from "@/components/ui/Dialogs";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import IconButton from "@/components/ui/IconButton";
import { formatBytes, type ProjectStorageEntry } from "@/lib/format";
import { SkeletonList } from "@/components/ui/Skeleton";

interface StorageModalProps {
  open: boolean;
  onClose: () => void;
  onProjectsDeleted?: (deletedIds: string[]) => void;
}

interface RenderCacheStats {
  count: number;
  totalBytes: number;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

export default function StorageModal({ open, onClose, onProjectsDeleted }: StorageModalProps) {
  const [projects, setProjects] = useState<ProjectStorageEntry[]>([]);
  const [totalBytes, setTotalBytes] = useState(0);
  const [renderCache, setRenderCache] = useState<RenderCacheStats | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const dialogs = useDialogs();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [storageRes, cacheRes] = await Promise.all([
        fetch("/api/projects/storage"),
        fetch("/api/renders/cleanup"),
      ]);
      if (storageRes.ok) {
        const data = await storageRes.json();
        setProjects(data.projects);
        setTotalBytes(data.totalBytes);
      }
      if (cacheRes.ok) {
        setRenderCache(await cacheRes.json());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setSelected(new Set());
      refresh();
    }
  }, [open, refresh]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleClearCache() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/renders/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteSelected() {
    if (busy || selected.size === 0) return;
    setBusy(true);
    try {
      const ids = Array.from(selected);
      await Promise.all(
        ids.map((id) => fetch(`/api/projects/${id}`, { method: "DELETE" })),
      );
      setSelected(new Set());
      onProjectsDeleted?.(ids);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const selectedBytes = projects
    .filter((p) => selected.has(p.id))
    .reduce((sum, p) => sum + p.bytes, 0);

  return (
    <>
      <Modal open={open} onClose={onClose} width={700} title="Storage" subtitle="Manage disk usage">
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0, maxHeight: "70vh" }}>
          {/* Summary */}
          <div
            style={{
              padding: "14px 20px",
              borderBottom: "1px solid var(--border-hairline)",
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <div>
              <div className="mono cap" style={{ color: "var(--ink-tertiary)", marginBottom: 2 }}>
                Total
              </div>
              <div className="mono nums" style={{ fontSize: 16, fontWeight: 600 }}>
                {formatBytes(totalBytes + (renderCache?.totalBytes ?? 0))}
              </div>
            </div>
            <div style={{ flex: 1 }} />
            <div className="mono" style={{ fontSize: 11, color: "var(--ink-disabled)" }}>
              {projects.length} project{projects.length === 1 ? "" : "s"}
            </div>
          </div>

          {/* Render cache row */}
          {renderCache && renderCache.count > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 20px",
                background: "var(--surface-void)",
                borderBottom: "1px solid var(--border-hairline)",
              }}
            >
              <Icon name="folder" size={14} style={{ color: "var(--ink-tertiary)" }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13 }}>Render cache</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--ink-disabled)" }}>
                  {renderCache.count} file{renderCache.count === 1 ? "" : "s"} · auto-deletes after 7 days
                </div>
              </div>
              <div className="mono nums" style={{ fontSize: 12, color: "var(--ink-secondary)", marginRight: 8 }}>
                {formatBytes(renderCache.totalBytes)}
              </div>
              <Button variant="ghost" size="sm" onClick={handleClearCache} disabled={busy}>
                {busy ? "..." : "Clear"}
              </Button>
            </div>
          )}

          {/* Projects list */}
          <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
            {loading && projects.length === 0 && (
              <div style={{ padding: 40, textAlign: "center", color: "var(--ink-disabled)", fontSize: 12 }}>
                <SkeletonList rows={5} />
              </div>
            )}
            {!loading && projects.length === 0 && (
              <div style={{ padding: 40, textAlign: "center", color: "var(--ink-disabled)", fontSize: 12 }}>
                No projects on disk.
              </div>
            )}
            {projects.map((p) => {
              const isSelected = selected.has(p.id);
              return (
                <label
                  key={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 20px",
                    borderBottom: "1px solid var(--border-hairline)",
                    cursor: "pointer",
                    background: isSelected ? "var(--brand-tint-bg)" : "transparent",
                    transition: "background 100ms",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(p.id)}
                    style={{ cursor: "pointer" }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {p.name}
                    </div>
                    <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-disabled)", marginTop: 2 }}>
                      {p.animationType} · updated {formatDate(p.updatedAt)}
                      {p.mediaBytes > 0 && ` · media ${formatBytes(p.mediaBytes)}`}
                    </div>
                  </div>
                  <div
                    className="mono nums"
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: p.bytes > 1024 * 1024 * 1024 ? "var(--danger)" : "var(--ink-primary)",
                      minWidth: 70,
                      textAlign: "right",
                    }}
                  >
                    {formatBytes(p.bytes)}
                  </div>
                  <IconButton
                    icon="trash"
                    size={26}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelected(new Set([p.id]));
                      (async () => {
              const ok = await dialogs.confirm({
                title: `Delete ${selected.size} project${selected.size === 1 ? "" : "s"}?`,
                body: `This frees ${formatBytes(selectedBytes)}. Chat history and media go with them, and it can't be undone.`,
                confirmLabel: `Delete ${selected.size} project${selected.size === 1 ? "" : "s"}`,
                destructive: true,
              });
              if (ok) handleDeleteSelected();
            })();
                    }}
                  />
                </label>
              );
            })}
          </div>

          {/* Footer */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 20px",
              borderTop: "1px solid var(--border-hairline)",
              background: "var(--surface-chrome)",
            }}
          >
            <div className="mono" style={{ fontSize: 11, color: "var(--ink-tertiary)" }}>
              {selected.size > 0
                ? `${selected.size} selected · ${formatBytes(selectedBytes)}`
                : "Select projects to delete"}
            </div>
            <div style={{ flex: 1 }} />
            <Button
              variant="danger"
              size="sm"
              icon="trash"
              onClick={() => (async () => {
              const ok = await dialogs.confirm({
                title: `Delete ${selected.size} project${selected.size === 1 ? "" : "s"}?`,
                body: `This frees ${formatBytes(selectedBytes)}. Chat history and media go with them, and it can't be undone.`,
                confirmLabel: `Delete ${selected.size} project${selected.size === 1 ? "" : "s"}`,
                destructive: true,
              });
              if (ok) handleDeleteSelected();
            })()}
              disabled={selected.size === 0 || busy}
            >
              Delete selected
            </Button>
          </div>
        </div>
      </Modal>

    </>
  );
}
