"use client";

import React from "react";
import Select from "@/components/ui/Select";
import {
  addAsset, makeId, updateItem,
  type EditorDoc, type VideoItem,
} from "@/lib/editor-doc";

/**
 * Per-clip colour grade. Extracted from EditorInspector when that became
 * the effect stack; the behaviour is unchanged.
 *
 * Not a render-time effect: ffmpeg bakes the LUT into a copy of the file and
 * the clip is repointed at it, with `baseAssetId` keeping the original so it
 * can be reverted. Non-destructive by asset bookkeeping, not parametrically.
 */
export default function GradeSection({
  doc, item, projectId, onChange,
}: {
  doc: EditorDoc;
  item: VideoItem;
  projectId: string;
  onChange: (next: EditorDoc, opts?: { transient?: boolean }) => void;
}) {
  const [luts, setLuts] = React.useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let live = true;
    fetch("/api/luts")
      .then((r) => r.json())
      .then((d) => { if (live) setLuts(d.luts ?? []); })
      .catch(() => { /* picker just stays empty */ });
    return () => { live = false; };
  }, []);

  async function apply(lutId: string) {
    setError(null);
    const baseId = item.baseAssetId ?? item.assetId;
    const base = doc.assets.find((a) => a.id === baseId);
    if (!base) return;

    if (lutId === "none") {
      onChange(updateItem<VideoItem>(doc, item.id, { assetId: baseId, lut: undefined, baseAssetId: undefined }));
      return;
    }

    setBusy(true);
    try {
      // The grade is baked from the file the clip ORIGINALLY used, never from an
      // already-graded copy — stacking looks would compound them silently.
      const file = base.src.replace(`/api/media/${projectId}/`, "");
      const res = await fetch(`/api/media/${projectId}/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file, lut: lutId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Grade failed");

      const existing = doc.assets.find((a) => a.src === data.src);
      const graded = existing ?? { ...base, id: makeId("asset"), src: data.src, name: `${base.name} · graded` };
      const withAsset = existing ? doc : addAsset(doc, graded);
      onChange(updateItem<VideoItem>(withAsset, item.id, {
        assetId: graded.id,
        lut: lutId,
        baseAssetId: baseId,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Grade failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ borderBottom: "1px solid var(--border-hairline)" }}>
      <div
        style={{
          display: "flex", alignItems: "center", gap: 8, height: 32,
          padding: "0 8px 0 10px", background: "var(--surface-raised)",
        }}
      >
        <span className="t-section" style={{ flex: 1, color: "var(--ink-primary)" }}>Colour</span>
        {busy && <span className="t-data-s" style={{ color: "var(--live)" }}>grading…</span>}
      </div>
      <div style={{ padding: "8px 8px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "grid", gridTemplateColumns: "72px minmax(0,1fr) 20px 20px", gap: 6, alignItems: "center" }}>
          <span className="t-control" style={{ textAlign: "right", color: "var(--ink-secondary)" }}>Look</span>
          <Select
            height={24}
            value={item.lut ?? "none"}
            disabled={busy}
            onChange={(v) => apply(v)}
            options={[{ value: "none", label: "None" }, ...luts.map((l) => ({ value: l.id, label: l.name }))]}
          />
          <span />
          <span />
        </div>
        {busy && (
          <div className="t-caption" style={{ color: "var(--ink-tertiary)" }}>
            Grading this clip — the footage is re-encoded once, then cached.
          </div>
        )}
        {error && (
          <div className="t-caption" style={{ color: "var(--danger)" }}>{error}</div>
        )}
      </div>
    </div>
  );
}
