"use client";

import React, { useCallback, useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";

interface BrowseEntry {
  name: string;
}

interface BrowseData {
  path: string;
  parent: string | null;
  home: string;
  entries: BrowseEntry[];
  mediaCount: number;
}

interface FolderPickerModalProps {
  open: boolean;
  initialPath?: string;
  onClose: () => void;
  onPick: (path: string) => void;
}

export default function FolderPickerModal({ open, initialPath, onClose, onPick }: FolderPickerModalProps) {
  const [data, setData] = useState<BrowseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (p?: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = p ? `/api/fs/browse?path=${encodeURIComponent(p)}` : "/api/fs/browse";
      const res = await fetch(url);
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Failed to read directory");
        return;
      }
      setData(body);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load(initialPath || undefined);
  }, [open, initialPath, load]);

  function handleChoose() {
    if (!data) return;
    onPick(data.path);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} width={520} title="Pick a folder">
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <div
          className="mono"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 10px",
            background: "var(--bg-inset)",
            border: "0.5px solid var(--line-2)",
            borderRadius: 4,
            fontSize: 11,
            color: "var(--text-1)",
          }}
        >
          <Icon name="folder" size={12} style={{ color: "var(--text-2)" }} />
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", direction: "rtl" }}>
            {data?.path ?? (loading ? "Loading…" : "—")}
          </span>
          {data && (
            <span className="nums" style={{ color: "var(--text-2)" }}>
              {data.mediaCount} media · {data.entries.length} folders
            </span>
          )}
        </div>

        {data?.home && data.path !== data.home && (
          <button
            onClick={() => load(data.home)}
            className="mono"
            style={{
              alignSelf: "flex-start",
              fontSize: 10,
              padding: "3px 8px",
              background: "transparent",
              border: "0.5px solid var(--line-2)",
              borderRadius: 3,
              color: "var(--text-2)",
              cursor: "pointer",
            }}
          >
            ~ Home
          </button>
        )}

        <div
          className="vt-scroll"
          style={{
            height: 320,
            overflowY: "auto",
            border: "0.5px solid var(--line-2)",
            borderRadius: 4,
            background: "var(--bg-inset)",
          }}
        >
          {data?.parent && (
            <button
              onClick={() => load(data.parent!)}
              style={rowStyle}
              onMouseEnter={hoverRowOn}
              onMouseLeave={hoverRowOff}
            >
              <Icon name="arrowLeft" size={12} style={{ color: "var(--text-2)" }} />
              <span style={{ color: "var(--text-1)" }}>..</span>
            </button>
          )}
          {data?.entries.map((e) => (
            <button
              key={e.name}
              onClick={() => load(`${data.path}${data.path.endsWith("/") ? "" : "/"}${e.name}`)}
              style={rowStyle}
              onMouseEnter={hoverRowOn}
              onMouseLeave={hoverRowOff}
            >
              <Icon name="folder" size={12} style={{ color: "var(--text-2)" }} />
              <span style={{ color: "var(--text-0)" }}>{e.name}</span>
            </button>
          ))}
          {data && data.entries.length === 0 && !data.parent && (
            <div style={{ padding: 16, fontSize: 11, color: "var(--text-2)", textAlign: "center" }}>
              Empty
            </div>
          )}
          {loading && !data && (
            <div style={{ padding: 16, fontSize: 11, color: "var(--text-2)", textAlign: "center" }}>
              Loading…
            </div>
          )}
        </div>

        {error && (
          <div className="mono" style={{ fontSize: 11, color: "var(--red)" }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 4 }}>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!data} onClick={handleChoose}>
            Choose this folder
          </Button>
        </div>
      </div>
    </Modal>
  );
}

const rowStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 12px",
  background: "transparent",
  border: "none",
  borderBottom: "0.5px solid var(--line-1)",
  cursor: "pointer",
  fontSize: 12,
  textAlign: "left",
};

function hoverRowOn(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.background = "var(--bg-3)";
}
function hoverRowOff(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.background = "transparent";
}
