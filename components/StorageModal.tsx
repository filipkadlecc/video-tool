"use client";

import React, { useState, useEffect, useCallback } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import IconButton from "@/components/ui/IconButton";
import { formatBytes, type ProjectStorageEntry } from "@/lib/format";

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
  const [confirmOpen, setConfirmOpen] = useState(false);

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
      setConfirmOpen(false);
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
      <Modal open={open} onClose={onClose} width={680} title="Storage" stepLabel="Manage disk usage">
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0, maxHeight: "70vh" }}>
          {/* Summary */}
          <div
            style={{
              padding: "14px 20px",
              borderBottom: "0.5px solid var(--line-1)",
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <div>
              <div className="mono cap" style={{ color: "var(--text-2)", marginBottom: 2 }}>
                Total
              </div>
              <div className="mono nums" style={{ fontSize: 16, fontWeight: 600 }}>
                {formatBytes(totalBytes + (renderCache?.totalBytes ?? 0))}
              </div>
            </div>
            <div style={{ flex: 1 }} />
            <div className="mono" style={{ fontSize: 11, color: "var(--text-3)" }}>
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
                background: "var(--bg-inset)",
                borderBottom: "0.5px solid var(--line-1)",
              }}
            >
              <Icon name="folder" size={14} style={{ color: "var(--text-2)" }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13 }}>Render cache</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--text-3)" }}>
                  {renderCache.count} file{renderCache.count === 1 ? "" : "s"} · auto-deletes after 7 days
                </div>
              </div>
              <div className="mono nums" style={{ fontSize: 12, color: "var(--text-1)", marginRight: 8 }}>
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
              <div style={{ padding: 40, textAlign: "center", color: "var(--text-3)", fontSize: 12 }}>
                Loading…
              </div>
            )}
            {!loading && projects.length === 0 && (
              <div style={{ padding: 40, textAlign: "center", color: "var(--text-3)", fontSize: 12 }}>
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
                    borderBottom: "0.5px solid var(--line-1)",
                    cursor: "pointer",
                    background: isSelected ? "var(--accent-soft)" : "transparent",
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
                    <div className="mono" style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 2 }}>
                      {p.animationType} · updated {formatDate(p.updatedAt)}
                      {p.mediaBytes > 0 && ` · media ${formatBytes(p.mediaBytes)}`}
                    </div>
                  </div>
                  <div
                    className="mono nums"
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: p.bytes > 1024 * 1024 * 1024 ? "var(--red)" : "var(--text-0)",
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
                      setConfirmOpen(true);
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
              borderTop: "0.5px solid var(--line-1)",
              background: "var(--bg-2)",
            }}
          >
            <div className="mono" style={{ fontSize: 11, color: "var(--text-2)" }}>
              {selected.size > 0
                ? `${selected.size} selected · ${formatBytes(selectedBytes)}`
                : "Select projects to delete"}
            </div>
            <div style={{ flex: 1 }} />
            <Button
              variant="danger"
              size="sm"
              icon="trash"
              onClick={() => setConfirmOpen(true)}
              disabled={selected.size === 0 || busy}
            >
              Delete selected
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={confirmOpen} onClose={() => !busy && setConfirmOpen(false)} width={380}>
        <div style={{ padding: 24 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              background: "var(--red-soft)",
              display: "grid",
              placeItems: "center",
              color: "var(--red)",
              marginBottom: 14,
            }}
          >
            <Icon name="trash" size={16} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
            Delete {selected.size} project{selected.size === 1 ? "" : "s"}?
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-1)", lineHeight: 1.5, marginBottom: 18 }}>
            This will free <span style={{ color: "var(--text-0)", fontWeight: 500 }}>{formatBytes(selectedBytes)}</span>.
            All chat history and media will be permanently removed. This cannot be undone.
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteSelected} disabled={busy}>
              {busy ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
