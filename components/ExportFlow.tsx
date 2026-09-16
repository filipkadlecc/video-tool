"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Segmented from "@/components/ui/Segmented";
import Tag from "@/components/ui/Tag";
import { timecode, needsHours } from "@/lib/timecode";
import { formatBytes } from "@/lib/format";
import { relinkAsset, type EditorDoc } from "@/lib/editor-doc";

/**
 * The export arc: 4e -> 5d -> 5e or 5f, with 5g reachable from 4e's warning.
 *
 * One component rather than five files because these are one flow over one set
 * of facts — the job you started. Splitting them would mean threading the same
 * job through five places.
 *
 * The rules the design is enforcing here, in case they look arbitrary:
 *   - progress is stated in FRAMES, because a percentage stuck on 41% is
 *     indistinguishable from a hang;
 *   - 5d is the one dialog allowed to be green, because a render is the
 *     definition of something happening right now;
 *   - missing sources are stated BEFORE you commit, since they are the one
 *     thing that silently ruins an export (they render as black);
 *   - every failure says three things — what happened, what it cost, what to
 *     do next.
 */

type Quality = "draft" | "standard" | "master";
type Status = "idle" | "queued" | "rendering" | "done" | "error";

/** Lower is better. h264 only; the ProRes profiles carry their own quality. */
const CRF: Record<Quality, number> = { draft: 28, standard: 23, master: 18 };

const FORMATS = [
  { value: "h264", label: "MP4 · H.264", ext: "mp4" },
  { value: "prores", label: "MOV · ProRes 4444 (alpha)", ext: "mov" },
  { value: "prores-xq", label: "MOV · ProRes 4444 XQ", ext: "mov" },
  { value: "qtrle", label: "MOV · QuickTime RLE", ext: "mov" },
  { value: "hevc-alpha", label: "MOV · HEVC alpha", ext: "mov" },
];

export interface MissingSource {
  assetId: string;
  name: string;
  /** Folder it was last seen in, for the "last seen in …" line. */
  lastSeen: string;
  /** Every clip using it — so the row can say which track and when. */
  clips: { itemId: string; track: string; atFrame: number }[];
}

export default function ExportFlow({
  open, onClose, code, durationInFrames, fps, width, height,
  projectName, projectId, doc, range, onDocChange,
}: {
  open: boolean;
  onClose: () => void;
  code: string;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
  projectName: string;
  projectId?: string;
  doc?: EditorDoc;
  range?: { in: number | null; out: number | null };
  /** Re-linking a moved file edits the document, so the page commits it. */
  onDocChange?: (doc: EditorDoc) => void;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [format, setFormat] = useState("h264");
  const [quality, setQuality] = useState<Quality>("standard");
  const [useRange, setUseRange] = useState(false);
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState(0);
  const [frames, setFrames] = useState<{ done: number; total: number } | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [result, setResult] = useState<{ url: string; bytes?: number; ms?: number } | null>(null);
  const [failure, setFailure] = useState<{ message: string; log?: string } | null>(null);
  const [showMissing, setShowMissing] = useState(false);
  const [missing, setMissing] = useState<MissingSource[]>([]);
  const [relinking, setRelinking] = useState<string | null>(null);
  const [locateFor, setLocateFor] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);
  const poll = useRef<number | null>(null);
  const locateRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  const ext = FORMATS.find((f) => f.value === format)?.ext ?? "mp4";
  const hours = needsHours(durationInFrames, fps);

  useEffect(() => {
    if (open && !fileName) {
      setFileName(projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "export");
    }
  }, [open, projectName, fileName]);

  useEffect(() => () => { if (poll.current) window.clearInterval(poll.current); }, []);

  /*
   * Sources whose FILE is gone — asked of the disk, every time the dialog
   * opens.
   *
   * This used to be computed from the document: a clip pointing at an assetId
   * with no row in `doc.assets`. That catches a corrupt document, which
   * essentially never happens, and misses the case that does — the row is
   * intact and the file has been moved or renamed underneath it. It also
   * displayed the raw asset id, because a dangling reference has no name.
   */
  useEffect(() => {
    if (!open || !doc || !projectId) return;
    let cancelledCheck = false;
    (async () => {
      try {
        const r = await fetch(`/api/projects/${projectId}/missing-sources`);
        if (!r.ok) return;
        const j = await r.json();
        if (!cancelledCheck) setMissing(j.missing ?? []);
      } catch { /* a failed check must not block an export */ }
    })();
    return () => { cancelledCheck = true; };
  }, [open, doc, projectId]);

  const rangeIn = range?.in ?? 0;
  const rangeOut = range?.out ?? durationInFrames;
  const hasRange = (range?.in ?? null) !== null || (range?.out ?? null) !== null;
  const exportFrames = useRange && hasRange ? Math.max(1, rangeOut - rangeIn) : durationInFrames;

  /**
   * Put a moved file back.
   *
   * The browser cannot hand us a path, so "found it" means uploading the bytes
   * into the project's media folder and pointing the asset at them. That is the
   * honest version of Locate… here, and it has a side benefit: the file is now
   * *inside* the project, so it cannot wander off again.
   *
   * Every clip using the asset is fixed at once, because the asset is what was
   * lost — the clips' trims, effects and keyframes were never in question.
   */
  const relink = useCallback(async (assetId: string, file: File) => {
    if (!doc || !projectId || !onDocChange) return false;
    setRelinking(assetId);
    try {
      const res = await fetch(
        `/api/media/${projectId}/upload?name=${encodeURIComponent(file.name)}`,
        { method: "POST", body: file },
      );
      if (!res.ok) throw new Error(`Upload failed (HTTP ${res.status})`);
      const { path: rel } = await res.json();
      const src = `/api/media/${projectId}/${String(rel ?? file.name).split("/").map(encodeURIComponent).join("/")}`;
      onDocChange(relinkAsset(doc, assetId, src, file.name));
      setMissing((prev) => prev.filter((m) => m.assetId !== assetId));
      return true;
    } catch {
      return false;
    } finally {
      setRelinking(null);
    }
  }, [doc, projectId, onDocChange]);

  /**
   * "Point at one and I'll find the rest in the same folder."
   *
   * A directory picker is the only way a page can see a folder's contents, and
   * it is exactly the gesture the sentence describes. Names are matched
   * case-insensitively; anything not found stays listed rather than being
   * quietly dropped.
   */
  const searchFolder = useCallback(async (files: FileList) => {
    const byName = new Map<string, File>();
    for (const f of Array.from(files)) byName.set(f.name.toLowerCase(), f);
    for (const m of [...missing]) {
      const found = byName.get(m.name.toLowerCase());
      if (found) await relink(m.assetId, found);
    }
  }, [missing, relink]);

  const start = useCallback(async () => {
    setStatus("queued");
    setFailure(null);
    setResult(null);
    setFrames(null);
    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneId: fileName, code, durationInFrames, fps, width, height,
          codec: format, projectId,
          crf: format === "h264" ? CRF[quality] : undefined,
          frameRange: useRange && hasRange ? [rangeIn, rangeOut - 1] : undefined,
          ...(doc ? { doc } : {}),
        }),
      });
      if (!res.ok) throw new Error(`The render couldn't be started (HTTP ${res.status}).`);
      const job = await res.json();
      setJobId(job.id);
      setStatus("rendering");

      poll.current = window.setInterval(async () => {
        try {
          const r = await fetch(`/api/render/${job.id}`);
          if (!r.ok) return;
          const j = await r.json();
          setProgress(j.progress ?? 0);
          if (typeof j.renderedFrames === "number" && typeof j.totalFrames === "number") {
            setFrames({ done: j.renderedFrames, total: j.totalFrames });
          }
          if (typeof j.startedAt === "number") setStartedAt(j.startedAt);
          if (j.status === "done") {
            if (poll.current) window.clearInterval(poll.current);
            setResult({ url: j.outputPath, bytes: j.bytes, ms: j.finishedAt && j.startedAt ? j.finishedAt - j.startedAt : undefined });
            setStatus("done");
          } else if (j.status === "error") {
            if (poll.current) window.clearInterval(poll.current);
            setFailure({ message: j.error ?? "The render stopped.", log: j.log });
            setStatus("error");
          } else if (j.status === "cancelled") {
            // You asked for this, so there is nothing to report: the dialog
            // goes away and the half-written file has already been removed.
            if (poll.current) window.clearInterval(poll.current);
            setStatus("idle");
            onClose();
          }
        } catch { /* a dropped poll is not a failed render */ }
      }, 1000);
    } catch (e) {
      setFailure({ message: e instanceof Error ? e.message : "The render couldn't be started." });
      setStatus("error");
    }
  }, [fileName, code, durationInFrames, fps, width, height, format, projectId, quality, useRange, hasRange, rangeIn, rangeOut, doc]);

  const reset = () => { setStatus("idle"); setResult(null); setFailure(null); setProgress(0); setFrames(null); };
  const close = () => { onClose(); };

  /**
   * Stop the render — the renderer, not just the dialog.
   *
   * "Stop render" and "Hide and keep working" used to call the same function,
   * so the only thing Stop stopped was the window it was in: the render carried
   * on, held a CPU, and eventually wrote a file nobody had asked for any more.
   */
  const stopRender = useCallback(async () => {
    if (!jobId) { close(); return; }
    setStopping(true);
    try {
      await fetch(`/api/render/${jobId}`, { method: "DELETE" });
    } catch { /* the poll below settles it either way */ }
    if (poll.current) window.clearInterval(poll.current);
    setStopping(false);
    setStatus("idle");
    setJobId(null);
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, onClose]);

  const remaining = (() => {
    if (!frames || !startedAt || frames.done < 10) return null;
    const perFrame = (Date.now() - startedAt) / frames.done;
    const secs = Math.round((perFrame * (frames.total - frames.done)) / 1000);
    if (!Number.isFinite(secs) || secs <= 0) return null;
    return secs < 60 ? `${secs}s` : `${Math.round(secs / 60)}m`;
  })();

  /* ── 5g — missing sources ───────────────────────────────────────── */
  if (open && showMissing && missing.length > 0) {
    return (
      <Modal
        open
        padded
        width={620}
        onClose={() => setShowMissing(false)}
        title={missing.length === 1 ? "One file is missing" : `${missing.length} files are missing`}
        subtitle="They were moved or renamed since this project was last opened. Point at one and I'll look for the rest in the same folder."
        footer={
          <>
            <span className="t-caption" style={{ color: "var(--ink-tertiary)" }}>
              Skipped clips export as black.
            </span>
            <div style={{ flex: 1 }} />
            <Button size="dialog" variant="ghost" onClick={() => setShowMissing(false)}>Skip for now</Button>
            <Button
              size="dialog"
              variant="primary"
              disabled={relinking !== null || !onDocChange}
              onClick={() => folderRef.current?.click()}
            >
              Search folder…
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {missing.map((m) => {
            const first = m.clips[0];
            return (
              <div
                key={m.assetId}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: 12,
                  background: "var(--surface-raised)", border: "1px solid var(--border-hairline)",
                  borderRadius: "var(--r-panel)",
                }}
              >
                <Icon name="warn" size={16} style={{ color: "var(--warning)", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t-control" style={{ color: "var(--ink-primary)" }}>{m.name}</div>
                  <div
                    className="t-data-s"
                    style={{ color: "var(--ink-tertiary)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {first ? `${first.track} · ${timecode(first.atFrame, fps, hours)}` : "unused"}
                    {m.clips.length > 1 ? ` (+${m.clips.length - 1} more)` : ""}
                    {` · last seen in ${m.lastSeen}`}
                  </div>
                </div>
                <Button
                  size="chrome"
                  variant="secondary"
                  disabled={relinking !== null || !onDocChange}
                  onClick={() => {
                    setLocateFor(m.assetId);
                    locateRef.current?.click();
                  }}
                >
                  {relinking === m.assetId ? "Copying…" : "Locate…"}
                </Button>
              </div>
            );
          })}
        </div>

        {/* The two pickers. Hidden, because the buttons above are the UI. */}
        <input
          ref={locateRef}
          type="file"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file && locateFor) await relink(locateFor, file);
            setLocateFor(null);
          }}
        />
        <input
          ref={folderRef}
          type="file"
          hidden
          // A directory picker: the only way a page can look in a folder, and
          // exactly the gesture "point at one and I'll find the rest" describes.
          {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
          onChange={async (e) => {
            const files = e.target.files;
            e.target.value = "";
            if (files?.length) await searchFolder(files);
          }}
        />
      </Modal>
    );
  }

  /* ── 5d — rendering ─────────────────────────────────────────────── */
  if (open && (status === "queued" || status === "rendering")) {
    return (
      <Modal
        open
        padded
        width={520}
        dismissible={false}
        hideClose
        onClose={close}
        title="Rendering"
        subtitle={`${projectName} · ${FORMATS.find((f) => f.value === format)?.label}`}
        footer={
          <>
            <Button
              size="dialog"
              variant="ghost"
              style={{ color: "var(--danger)" }}
              disabled={stopping}
              onClick={stopRender}
            >
              {stopping ? "Stopping…" : "Stop render"}
            </Button>
            <div style={{ flex: 1 }} />
            <Button size="dialog" variant="secondary" onClick={close}>Hide and keep working</Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <Tag tone="live">{status === "queued" ? "Queued" : "Live"}</Tag>
          </div>
          <div style={{ height: 4, background: "var(--surface-void)", borderRadius: 2, overflow: "hidden" }}>
            <div
              style={{
                width: `${Math.min(100, progress)}%`, height: "100%",
                background: "var(--live)", transition: "width 200ms linear",
              }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "baseline" }}>
            {/* Frames lead. They are the number that tells you it isn't stuck. */}
            <span className="t-data-m" style={{ color: "var(--ink-primary)" }}>
              {frames ? `${frames.done} / ${frames.total} frames` : `0 / ${exportFrames} frames`}
            </span>
            <div style={{ flex: 1 }} />
            <span className="t-data-m" style={{ color: "var(--live)" }}>
              {Math.min(100, Math.round(progress))}%{remaining ? ` · about ${remaining} left` : ""}
            </span>
          </div>
          <div className="t-caption" style={{ color: "var(--ink-tertiary)" }}>
            Renders in the background — you can keep working.
          </div>
        </div>
      </Modal>
    );
  }

  /* ── 5e — export finished ───────────────────────────────────────── */
  if (open && status === "done" && result) {
    return (
      <Modal
        open
        padded
        width={560}
        onClose={close}
        title="Export finished"
        footer={
          <>
            <Button size="dialog" variant="ghost" onClick={reset}>Export again…</Button>
            <div style={{ flex: 1 }} />
            <a href={result.url} download={`${fileName}.${ext}`} style={{ textDecoration: "none" }}>
              <Button size="dialog" variant="secondary" icon="download">Save file</Button>
            </a>
            <a href={result.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
              <Button size="dialog" variant="primary">Open</Button>
            </a>
          </>
        }
      >
        <div style={{ display: "flex", gap: 16 }}>
          <div
            style={{
              width: 200, aspectRatio: "16 / 9", flexShrink: 0, borderRadius: "var(--r-frame)",
              background: "var(--surface-void)", border: "1px solid var(--border-hairline)",
              display: "grid", placeItems: "center",
            }}
          >
            <Icon name="play" size={22} style={{ color: "var(--ink-tertiary)" }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* Green is on the tick only — the render is over, nothing is live. */}
              <Icon name="check" size={16} style={{ color: "var(--live)" }} />
              <span className="t-body" style={{ color: "var(--ink-primary)", overflow: "hidden", textOverflow: "ellipsis" }}>
                {fileName}.{ext}
              </span>
            </div>
            <div className="t-data-m" style={{ color: "var(--ink-tertiary)", marginTop: 10, lineHeight: 1.7 }}>
              {result.bytes ? `${formatBytes(result.bytes)} · ` : ""}{width}×{height} · {fps} fps
              <br />
              {timecode(exportFrames, fps, hours)}
              {result.ms ? ` · rendered in ${result.ms < 60000 ? `${Math.round(result.ms / 1000)}s` : `${Math.round(result.ms / 60000)}m`}` : ""}
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  /* ── 5f — render failed ─────────────────────────────────────────── */
  if (open && status === "error" && failure) {
    return (
      <Modal
        open
        padded
        width={560}
        tone="danger"
        onClose={close}
        title={frames ? `Render stopped at frame ${frames.done}` : "The render stopped"}
        subtitle={failure.message}
        footer={
          <>
            <Button
              size="dialog"
              variant="ghost"
              onClick={() => { void navigator.clipboard.writeText(failure.log ?? failure.message).catch(() => {}); }}
            >
              Copy log
            </Button>
            <div style={{ flex: 1 }} />
            <Button size="dialog" variant="ghost" onClick={close}>Close</Button>
            <Button size="dialog" variant="primary" onClick={reset}>Change settings…</Button>
          </>
        }
      >
        {failure.log && (
          <pre
            className="t-data-s"
            style={{
              margin: 0, padding: 12, background: "var(--surface-void)",
              border: "1px solid var(--border-hairline)", borderRadius: "var(--r-panel)",
              color: "var(--ink-tertiary)", whiteSpace: "pre-wrap", wordBreak: "break-word",
              maxHeight: 180, overflow: "auto",
            }}
          >
            {failure.log}
          </pre>
        )}
      </Modal>
    );
  }

  /* ── 4e — export ────────────────────────────────────────────────── */
  return (
    <Modal
      open={open}
      padded
      width={620}
      onClose={close}
      title="Export video"
      subtitle={`${projectName} · ${exportFrames} frames at ${fps} fps`}
      footer={
        <>
          <span className="t-caption" style={{ color: "var(--ink-tertiary)" }}>
            Renders in the background — you can keep working.
          </span>
          <div style={{ flex: 1 }} />
          <Button size="dialog" variant="ghost" onClick={close}>Cancel</Button>
          <Button size="dialog" variant="primary" icon="download" onClick={() => void start()}>Export</Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Field label="Format">
            <Select value={format} onChange={setFormat} options={FORMATS.map((f) => ({ value: f.value, label: f.label }))} />
          </Field>
          <Field label="Quality">
            <Segmented
              height={24}
              value={quality}
              onChange={(v) => setQuality(v as Quality)}
              options={[
                { value: "draft", label: "Draft" },
                { value: "standard", label: "Standard" },
                { value: "master", label: "Master" },
              ]}
            />
          </Field>
        </div>

        <Field label="Range">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Segmented
              height={24}
              value={useRange ? "range" : "whole"}
              onChange={(v) => setUseRange(v === "range")}
              options={[
                { value: "whole", label: "Whole project" },
                { value: "range", label: "In to out", disabled: !hasRange },
              ]}
            />
            <span className="t-data-m" style={{ color: "var(--ink-tertiary)" }}>
              {useRange && hasRange
                ? `${timecode(rangeIn, fps, hours)} → ${timecode(rangeOut, fps, hours)}`
                : `${timecode(0, fps, hours)} → ${timecode(durationInFrames, fps, hours)}`}
            </span>
            {!hasRange && (
              <span className="t-caption" style={{ color: "var(--ink-disabled)" }}>
                Set in and out with I and O
              </span>
            )}
          </div>
        </Field>

        <Field label="Save to">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Input value={fileName} onChange={setFileName} suffix={`.${ext}`} />
          </div>
          <div className="t-caption" style={{ color: "var(--ink-tertiary)", marginTop: 6 }}>
            {width}×{height} · downloads when it finishes
          </div>
        </Field>

        {missing.length > 0 && (
          <div
            style={{
              display: "flex", gap: 10, padding: 12,
              background: "var(--surface-raised)",
              border: "1px solid var(--warning-tint-line)",
              borderRadius: "var(--r-panel)",
            }}
          >
            <Icon name="warn" size={16} style={{ color: "var(--warning)", flexShrink: 0, marginTop: 1 }} />
            <div>
              <div className="t-body" style={{ color: "var(--ink-primary)" }}>
                {missing.length === 1
                  ? "One clip is missing its source file"
                  : `${missing.length} clips are missing their source files`}
              </div>
              <div className="t-caption" style={{ color: "var(--ink-tertiary)", marginTop: 2 }}>
                {missing.length === 1 ? "It'll" : "They'll"} export as black.{" "}
                <button
                  onClick={() => setShowMissing(true)}
                  className="t-caption"
                  style={{ background: "none", border: "none", padding: 0, color: "var(--ink-primary)", textDecoration: "underline", cursor: "pointer" }}
                >
                  Show me
                </button>{" "}
                · or export anyway.
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="t-control" style={{ color: "var(--ink-secondary)", marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}
