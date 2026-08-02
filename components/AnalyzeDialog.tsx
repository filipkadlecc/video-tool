"use client";

import React, { useCallback, useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";

interface MediaFile {
  name: string;
  path: string;
  type: "video" | "audio" | "image" | "other";
  size: number;
  sizeFormatted: string;
}

interface Summary {
  durationSeconds?: number;
  fps?: number;
  width?: number;
  height?: number;
  cuts?: number;
  segments?: number;
}

interface FileState {
  file: MediaFile;
  status: "checking" | "pending" | "analyzed" | "running" | "error";
  stage?: "probe" | "scenes" | "transcript";
  progress?: number; // 0..1 during scene detection
  transcriptLine?: string;
  summary?: Summary;
  error?: string;
}

interface AnalyzeDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  hasMediaFolder: boolean;
}

const MODELS: { value: string; label: string; hint: string }[] = [
  { value: "tiny.en", label: "Tiny", hint: "fastest, rough" },
  { value: "small.en", label: "Small", hint: "good balance" },
  { value: "medium.en", label: "Medium", hint: "best, slow" },
];

function fmtDuration(s?: number): string {
  if (!s || !Number.isFinite(s)) return "—";
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

export default function AnalyzeDialog({ open, onClose, projectId, hasMediaFolder }: AnalyzeDialogProps) {
  const [files, setFiles] = useState<FileState[]>([]);
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState("small.en");

  const patch = useCallback((path: string, next: Partial<FileState>) => {
    setFiles((prev) => prev.map((f) => (f.file.path === path ? { ...f, ...next } : f)));
  }, []);

  // Load media files + their current analysis status on open.
  useEffect(() => {
    if (!open || !hasMediaFolder) return;
    let cancelled = false;
    setLoading(true);
    setFiles([]);
    (async () => {
      try {
        const listRes = await fetch(`/api/media/${projectId}/list`);
        const listData: { files?: MediaFile[] } = await listRes.json();
        const playable = (listData.files ?? []).filter((f) => f.type === "video" || f.type === "audio");
        if (cancelled) return;
        setFiles(playable.map((file) => ({ file, status: "checking" as const })));

        // Fetch cached status for each file in parallel.
        await Promise.all(
          playable.map(async (file) => {
            try {
              const res = await fetch(
                `/api/media/${projectId}/analyze?mediaFile=${encodeURIComponent(file.path)}`
              );
              const data = await res.json();
              if (cancelled) return;
              patch(file.path, {
                status: data.analysisPending ? "pending" : "analyzed",
                summary: {
                  durationSeconds: data.probe?.durationSeconds,
                  fps: data.probe?.fps,
                  width: data.probe?.width,
                  height: data.probe?.height,
                  cuts: data.scenes?.cutsSeconds?.length,
                  segments: data.transcript?.segments,
                },
              });
            } catch {
              if (!cancelled) patch(file.path, { status: "pending" });
            }
          })
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, hasMediaFolder, projectId, patch]);

  async function analyzeFile(fs: FileState, force = false) {
    const path = fs.file.path;
    patch(path, { status: "running", stage: "probe", progress: undefined, error: undefined });
    try {
      const res = await fetch(`/api/media/${projectId}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaFile: path, model, force }),
      });
      if (!res.ok || !res.body) {
        const msg = await res.text().catch(() => "");
        patch(path, { status: "error", error: msg || `HTTP ${res.status}` });
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const events = buf.split("\n\n");
        buf = events.pop() ?? "";
        for (const evt of events) {
          const line = evt.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") continue;
          let data: Record<string, unknown>;
          try {
            data = JSON.parse(payload);
          } catch {
            continue;
          }
          if (data.error) {
            patch(path, { status: "error", error: String(data.error) });
            continue;
          }
          if (data.stage === "probe" && data.status === "done" && data.probe) {
            const p = data.probe as Summary;
            patch(path, {
              stage: "scenes",
              summary: { ...fs.summary, durationSeconds: p.durationSeconds, fps: p.fps, width: p.width, height: p.height },
            });
          } else if (data.stage === "scenes") {
            if (data.status === "progress") patch(path, { stage: "scenes", progress: Number(data.progress) });
            else if (data.status === "done") patch(path, { stage: "transcript", progress: undefined, summary: { ...fs.summary, cuts: Number(data.cuts) } });
          } else if (data.stage === "transcript") {
            if (data.status === "progress" && data.line) patch(path, { stage: "transcript", transcriptLine: String(data.line).trim().slice(-80) });
            else if (data.status === "done") patch(path, { summary: { ...fs.summary, segments: Number(data.segments) } });
          }
        }
      }
      // Re-fetch consolidated status for a clean summary.
      const statusRes = await fetch(
        `/api/media/${projectId}/analyze?mediaFile=${encodeURIComponent(path)}`
      );
      const status = await statusRes.json();
      patch(path, {
        status: status.analysisPending ? "pending" : "analyzed",
        stage: undefined,
        transcriptLine: undefined,
        summary: {
          durationSeconds: status.probe?.durationSeconds,
          fps: status.probe?.fps,
          width: status.probe?.width,
          height: status.probe?.height,
          cuts: status.scenes?.cutsSeconds?.length,
          segments: status.transcript?.segments,
        },
      });
    } catch (err) {
      patch(path, { status: "error", error: err instanceof Error ? err.message : "Network error" });
    }
  }

  const anyRunning = files.some((f) => f.status === "running");
  const pending = files.filter((f) => f.status === "pending");

  return (
    <Modal open={open} onClose={onClose} width={640} title="Analyze video" stepLabel="Probe · scene cuts · transcript — so the AI can see your footage">
      <div className="vt-scroll" style={{ overflowY: "auto", maxHeight: 560, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        {!hasMediaFolder && (
          <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.5 }}>
            This project has no media folder. Upload a video first.
          </div>
        )}

        {hasMediaFolder && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span className="mono cap" style={{ color: "var(--text-2)" }}>Transcription model</span>
              <div style={{ display: "flex", gap: 4 }}>
                {MODELS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setModel(m.value)}
                    title={m.hint}
                    style={{
                      fontSize: 11,
                      padding: "4px 10px",
                      borderRadius: "var(--r-sm)",
                      border: "0.5px solid var(--line-2)",
                      background: model === m.value ? "var(--accent-soft)" : "var(--bg-inset)",
                      color: model === m.value ? "var(--accent)" : "var(--text-2)",
                      cursor: "pointer",
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <div style={{ flex: 1 }} />
              {pending.length > 0 && (
                <Button
                  variant="primary"
                  size="sm"
                  icon="sparkle"
                  disabled={anyRunning}
                  onClick={() => pending.forEach((f) => analyzeFile(f))}
                >
                  Analyze all ({pending.length})
                </Button>
              )}
            </div>

            {loading && <div style={{ fontSize: 12, color: "var(--text-2)" }}>Loading media…</div>}
            {!loading && files.length === 0 && (
              <div style={{ fontSize: 12, color: "var(--text-2)" }}>No video or audio files in this project.</div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {files.map((f) => (
                <div
                  key={f.file.path}
                  style={{
                    border: "0.5px solid var(--line-2)",
                    borderRadius: "var(--r-md)",
                    padding: "12px 14px",
                    background: "var(--bg-inset)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {f.file.name}
                    </div>
                    <span className="mono" style={{ fontSize: 10, color: "var(--text-2)" }}>{f.file.sizeFormatted}</span>
                    <StatusPill state={f} />
                  </div>

                  {/* Summary line */}
                  <div className="mono nums" style={{ fontSize: 10, color: "var(--text-2)" }}>
                    {f.summary?.durationSeconds != null
                      ? `${fmtDuration(f.summary.durationSeconds)} · ${f.summary.fps?.toFixed(0) ?? "?"}fps${f.summary.width ? ` · ${f.summary.width}×${f.summary.height}` : ""}`
                      : "not probed"}
                    {f.summary?.cuts != null && ` · ${f.summary.cuts} cuts`}
                    {f.summary?.segments != null && ` · ${f.summary.segments} segments`}
                  </div>

                  {/* Progress line while running */}
                  {f.status === "running" && (
                    <div style={{ fontSize: 11, color: "var(--accent)" }}>
                      {f.stage === "probe" && "Probing…"}
                      {f.stage === "scenes" && `Detecting scene cuts…${f.progress != null ? ` ${Math.round(f.progress * 100)}%` : ""}`}
                      {f.stage === "transcript" && `Transcribing…${f.transcriptLine ? ` ${f.transcriptLine}` : ""}`}
                    </div>
                  )}
                  {f.status === "error" && (
                    <div style={{ fontSize: 11, color: "var(--red, #e5484d)" }}>{f.error}</div>
                  )}

                  {(f.status === "pending" || f.status === "analyzed" || f.status === "error") && (
                    <div>
                      <Button
                        variant={f.status === "analyzed" ? "outline" : "primary"}
                        size="sm"
                        icon="sparkle"
                        disabled={anyRunning}
                        onClick={() => analyzeFile(f, f.status === "analyzed")}
                      >
                        {f.status === "analyzed" ? "Re-analyze" : "Analyze"}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ fontSize: 11, color: "var(--text-2)", lineHeight: 1.5, borderTop: "0.5px solid var(--line-1)", paddingTop: 12 }}>
              Once analyzed, the AI chat can see each clip&apos;s length, transcript timestamps, and scene cuts —
              so &ldquo;trim to where they say X&rdquo; or &ldquo;cut on the first scene change&rdquo; lands correctly.
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function StatusPill({ state }: { state: FileState }) {
  const map: Record<FileState["status"], { label: string; color: string; bg: string }> = {
    checking: { label: "…", color: "var(--text-2)", bg: "var(--bg-3)" },
    pending: { label: "not analyzed", color: "var(--text-2)", bg: "var(--bg-3)" },
    running: { label: "analyzing", color: "var(--accent)", bg: "var(--accent-soft)" },
    analyzed: { label: "analyzed", color: "var(--green, #30a46c)", bg: "var(--bg-3)" },
    error: { label: "error", color: "var(--red, #e5484d)", bg: "var(--bg-3)" },
  };
  const s = map[state.status];
  return (
    <span className="mono" style={{ fontSize: 9, padding: "2px 7px", borderRadius: 999, background: s.bg, color: s.color, textTransform: "uppercase", letterSpacing: 0.4 }}>
      {s.label}
    </span>
  );
}
