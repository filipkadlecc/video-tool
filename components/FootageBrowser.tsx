"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/Icon";
import { addItem, makeId, type Asset, type EditorDoc, type EditorItem } from "@/lib/editor-doc";
import { usePlayheadStore } from "@/hooks/usePlayhead";
import Input from "@/components/ui/Input";
import { formatBytes } from "@/lib/format";
import IconButton from "@/components/ui/IconButton";

/**
 * Everything imported into this project, in one place — and the way to import
 * more. Until now media could only be attached when the project was created.
 */

export interface MediaFile {
  name: string;
  path: string;
  type: "video" | "audio" | "image" | "other";
  /** Bytes, from the list route. Optional: older callers don't pass it. */
  size?: number;
}

interface Props {
  projectId: string;
  doc: EditorDoc;
  onChange: (next: EditorDoc) => void;
  onSelect?: (itemId: string) => void;
}

/**
 * Read a media file's length in the browser. A freshly uploaded file isn't in
 * the ffprobe cache yet, and a hidden element answers this in milliseconds.
 */
export function readMediaDuration(src: string, kind: "video" | "audio") {
  return new Promise<number | undefined>((resolve) => {
    const el = document.createElement(kind === "audio" ? "audio" : "video");
    const done = (v: number | undefined) => { el.removeAttribute("src"); resolve(v); };
    el.preload = "metadata";
    el.onloadedmetadata = () => done(Number.isFinite(el.duration) ? el.duration : undefined);
    el.onerror = () => done(undefined);
    window.setTimeout(() => done(undefined), 8000);
    el.src = src;
  });
}

export default function FootageBrowser({ projectId, doc, onChange, onSelect }: Props) {
  // Needed only when a clip is dropped, so read it then rather than
  // re-rendering this list on every frame of playback.
  const playhead = usePlayheadStore();
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [durations, setDurations] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    fetch(`/api/media/${projectId}/list`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (Array.isArray(d?.files)) setFiles(d.files); })
      .catch(() => {});
    fetch(`/api/media/${projectId}/probe-map`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.fps || !d?.nbFrames) return;
        const out: Record<string, number> = {};
        for (const [rel, frames] of Object.entries(d.nbFrames as Record<string, number>)) {
          const f = (d.fps as Record<string, number>)[rel];
          if (f) out[rel] = frames / f;
        }
        setDurations(out);
      })
      .catch(() => {});
  }, [projectId]);

  useEffect(refresh, [refresh]);

  const upload = useCallback(async (picked: File[]) => {
    setError(null);
    for (const file of picked) {
      setBusy(file.name);
      try {
        const res = await fetch(
          `/api/media/${projectId}/upload?name=${encodeURIComponent(file.name)}`,
          { method: "POST", body: file },
        );
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Upload failed");
      } catch (e) {
        setError(`${file.name}: ${e instanceof Error ? e.message : "Upload failed"}`);
      }
    }
    setBusy(null);
    refresh();
  }, [projectId, refresh]);

  // ⌘I / Ctrl+I opens the picker, as in every editor.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.closest(".monaco-editor"))) return;
      if ((e.metaKey || e.ctrlKey) && (e.key === "i" || e.key === "I")) {
        e.preventDefault();
        inputRef.current?.click();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /** Place a file on the last track at the playhead. */
  const insert = useCallback(async (file: MediaFile) => {
    const src = `/api/media/${projectId}/${file.path}`;
    const kind: Asset["kind"] = file.type === "audio" ? "audio" : file.type === "image" ? "image" : "video";
    const existing = doc.assets.find((a) => a.src === src);
    const durationSec = existing?.durationSec
      ?? durations[file.path]
      ?? (kind === "image" ? undefined : await readMediaDuration(src, kind));
    const asset: Asset = existing ?? { id: makeId("asset"), kind, src, name: file.name, durationSec };
    const trackId = doc.tracks[doc.tracks.length - 1]?.id;
    if (!trackId) return;

    const item = {
      type: kind === "audio" ? "audio" : kind === "image" ? "image" : "video",
      id: makeId(kind),
      from: playhead.getFrame(),
      durationInFrames: Math.max(1, Math.round((durationSec ?? 3) * doc.size.fps)),
      layout: { x: 0, y: 0, width: doc.size.width, height: doc.size.height },
      assetId: asset.id,
      ...(kind === "video" || kind === "audio" ? { sourceIn: 0, sourceOut: durationSec } : {}),
    } as EditorItem;

    onChange(addItem(existing ? doc : { ...doc, assets: [...doc.assets, asset] }, trackId, item));
    onSelect?.(item.id);
  }, [doc, projectId, durations, playhead, onChange, onSelect]);

  const used = new Set(doc.assets.map((a) => a.src));
  const [query, setQuery] = useState("");
  const shown = query.trim()
    ? files.filter((f) => f.name.toLowerCase().includes(query.trim().toLowerCase()))
    : files;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Search over a rail of takes: with a dozen files off one shoot the names
          differ by four digits, so filtering beats scrolling. */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", flexShrink: 0 }}>
        <Input
          value={query}
          onChange={setQuery}
          placeholder="Search footage"
          height={28}
          prefix={<Icon name="search" size={13} style={{ color: "var(--ink-tertiary)" }} />}
        />
        <IconButton icon="plus" title="Import footage" shortcut="⌘I" onClick={() => inputRef.current?.click()} />
      </div>
      {(busy || error) && (
        <div className="t-data-s" style={{ padding: "0 8px 6px", color: error ? "var(--danger)" : "var(--live)" }}>
          {error ?? `uploading ${busy}…`}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="video/*,audio/*,image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (picked.length) void upload(picked);
        }}
      />

      {/*
        A LIST, not a grid of tiles.
        
        The rail is 248px wide; a grid there gives two ~110px thumbnails per row
        with the filename truncated to nothing underneath, so you cannot tell
        two takes of the same shot apart. A row per file fits a 64x36 still
        beside the name AND its meta, which is what you actually pick by.
      */}
      <div style={{ flex: 1, overflowY: "auto", padding: 6, display: "flex", flexDirection: "column", gap: 8, alignContent: "start" }}>
        {shown.length === 0 && (
          <div className="t-caption" style={{ color: "var(--ink-tertiary)" }}>
            Nothing imported yet — press Import or ⌘I, or drop files onto a track.
          </div>
        )}
        {shown.map((f) => {
          const src = `/api/media/${projectId}/${f.path}`;
          const strip = `/api/media/${projectId}/filmstrip?file=${encodeURIComponent(f.path)}`;
          const secs = durations[f.path];
          const meta = [
            f.type === "audio" ? "audio" : f.type,
            secs ? `${Math.floor(secs / 60)}:${String(Math.round(secs % 60)).padStart(2, "0")}` : null,
          ].filter(Boolean).join(" · ");
          return (
            <button
              key={f.path}
              onClick={() => void insert(f)}
              draggable
              onDragStart={(e) => e.dataTransfer.setData("application/x-vt-media", JSON.stringify(f))}
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: 6,
                background: used.has(src) ? "var(--surface-raised)" : "transparent",
                border: `1px solid ${used.has(src) ? "var(--border-edge)" : "transparent"}`,
                borderRadius: "var(--r-control)",
                cursor: "pointer", textAlign: "left", width: "100%",
              }}
            >
              <div
                style={{
                  width: 64, height: 36, flexShrink: 0, borderRadius: "var(--r-frame)",
                  border: "1px solid var(--border-hairline)",
                  overflow: "hidden", background: "var(--surface-void)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  ...(f.type === "video"
                    ? { backgroundImage: `url(${strip})`, backgroundSize: "auto 100%", backgroundRepeat: "no-repeat" }
                    : {}),
                }}
              >
                {f.type === "image" && (
                  // eslint-disable-next-line @next/next/no-img-element -- local project media, same as AssetBrowser
                  <img src={src} alt={f.name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                )}
                {f.type === "audio" && <Icon name="speaker" size={14} style={{ color: "var(--ink-disabled)" }} />}
              </div>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="t-control" style={{ color: "var(--ink-primary)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {f.name}
                </span>
                <span className="t-data-s" style={{ color: "var(--ink-tertiary)", display: "block", marginTop: 2 }}>
                  {meta}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Footer: what you have, and the way to get more. */}
      <div
        style={{
          display: "flex", alignItems: "center", height: 32, padding: "0 8px", flexShrink: 0,
          borderTop: "1px solid var(--border-hairline)",
        }}
      >
        <span className="t-data-s" style={{ color: "var(--ink-tertiary)" }}>
          {/* Count AND size, per the spec — "7 items" doesn't tell you whether
              this project is 40 MB or 4 GB, which is the thing you want to know
              before an import or a copy. */}
          {files.length} {files.length === 1 ? "item" : "items"}
          {files.length > 0 ? ` · ${formatBytes(files.reduce((n, f) => n + (f.size ?? 0), 0))}` : ""}
        </span>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => inputRef.current?.click()}
          className="t-control"
          style={{ background: "none", border: "none", color: "var(--ink-secondary)", cursor: "pointer", padding: 0 }}
        >
          Import…
        </button>
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  background: "var(--surface-raised)", border: "1px solid var(--border-hairline)", borderRadius: 3,
  color: "var(--ink-secondary)", fontSize: 10, padding: "3px 9px", cursor: "pointer",
};
