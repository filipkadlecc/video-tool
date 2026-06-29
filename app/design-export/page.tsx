"use client";

// =============================================================================
// Design Export  (isolated, experimental feature)
// =============================================================================
// Drop in a self-contained Claude Design *animation* (the standalone source
// HTML) and export it to a video file. It reuses the existing HyperFrames render
// queue via /api/design-export, which turns the animation into a frame-steppable
// composition. Separate from the normal project flow and from Design Lab; can be
// deleted with zero impact. Visit at /design-export.

import React, { useMemo, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import Segmented from "@/components/ui/Segmented";

// Client-side mirror of parseClaudeDesignMeta (just for pre-filling the form).
function parseMeta(src: string) {
  const num = (re: RegExp, fallback: number) => {
    const m = src.match(re);
    const v = m ? parseFloat(m[1]) : NaN;
    return isFinite(v) && v > 0 ? v : fallback;
  };
  return {
    width: num(/\bconst\s+W\s*=\s*(\d+)/, num(/\bwidth=\{(\d+)\}/, 3840)),
    height: num(/\bH\s*=\s*(\d+)/, num(/\bheight=\{(\d+)\}/, 2160)),
    durationSeconds: num(/\bDUR\s*=\s*([\d.]+)/, num(/\bduration=\{([\d.]+)\}/, 15)),
    fps: num(/\bconst\s+fps\s*=\s*(\d+)/, 25),
  };
}

interface RenderJob {
  id: string;
  status: "queued" | "rendering" | "done" | "error";
  progress: number;
  outputPath?: string;
  error?: string;
}

const FORMATS = [
  { value: "mp4", label: "MP4" },
  { value: "webm", label: "WebM α" },
  { value: "mov", label: "MOV α" },
];

export default function DesignExportPage() {
  const [sourceHtml, setSourceHtml] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [resPreset, setResPreset] = useState("1080");
  const [fps, setFps] = useState(25);
  const [format, setFormat] = useState("mp4");

  const [job, setJob] = useState<RenderJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const meta = useMemo(() => (sourceHtml.trim() ? parseMeta(sourceHtml) : null), [sourceHtml]);

  // Export size keeps the native aspect; presets pin the height.
  const exportSize = useMemo(() => {
    const nW = meta?.width ?? 3840;
    const nH = meta?.height ?? 2160;
    const aspect = nW / nH;
    const heightFor = (h: number) => ({ width: Math.round(h * aspect), height: h });
    if (resPreset === "native") return { width: nW, height: nH };
    if (resPreset === "2160") return heightFor(2160);
    return heightFor(1080);
  }, [meta, resPreset]);

  function ingest(text: string, name?: string) {
    setSourceHtml(text);
    setFileName(name ?? null);
    setJob(null);
    setError(null);
    const m = parseMeta(text);
    setFps(m.fps);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    ingest(text, f.name);
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function handleExport() {
    if (!sourceHtml.trim() || busy) return;
    setBusy(true);
    setError(null);
    setJob(null);
    stopPolling();

    try {
      const res = await fetch("/api/design-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceHtml,
          exportWidth: exportSize.width,
          exportHeight: exportSize.height,
          fps,
          durationSeconds: meta?.durationSeconds,
          format,
          sceneName: (fileName || "design-export").replace(/\.html?$/i, ""),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Export failed to start");

      setJob(data);
      // Poll the shared render status route until done/error.
      pollRef.current = setInterval(async () => {
        try {
          const r = await fetch(`/api/render/${data.id}`);
          const j: RenderJob = await r.json();
          setJob(j);
          if (j.status === "done" || j.status === "error") {
            stopPolling();
            setBusy(false);
            if (j.status === "error") setError(j.error || "Render failed");
          }
        } catch {
          /* transient — keep polling */
        }
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setBusy(false);
    }
  }

  const labelStyle: React.CSSProperties = { color: "var(--text-2)", marginBottom: 6, display: "block" };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--bg-0)", color: "var(--text-0)" }}>
      {/* Header */}
      <div style={{ padding: "14px 20px", borderBottom: "0.5px solid var(--line-1)", display: "flex", alignItems: "baseline", gap: 12 }}>
        <span style={{ fontWeight: 600, fontSize: 15 }}>Design Export</span>
        <span className="mono cap" style={{ color: "var(--text-3)", fontSize: 11 }}>Experimental · separate from your projects</span>
        <span style={{ flex: 1 }} />
        <span style={{ color: "var(--text-2)", fontSize: 12 }}>Drop a Claude Design animation → export it to video, faithfully.</span>
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Left: controls */}
        <div style={{ width: 420, borderRight: "0.5px solid var(--line-1)", padding: 18, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label className="mono cap" style={labelStyle}>Animation file</label>
            <input
              type="file"
              accept=".html,.htm,text/html"
              onChange={onFile}
              style={{ fontSize: 12, color: "var(--text-1)", width: "100%" }}
            />
            <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-3)" }}>
              {fileName ? `Loaded: ${fileName}` : "The standalone source HTML exported from Claude Design."}
            </div>
            <details style={{ marginTop: 10 }}>
              <summary className="mono cap" style={{ cursor: "pointer", color: "var(--text-3)", fontSize: 10 }}>or paste HTML</summary>
              <textarea
                value={sourceHtml}
                onChange={(e) => ingest(e.target.value)}
                placeholder="<!doctype html>…"
                spellCheck={false}
                style={{ width: "100%", marginTop: 8, minHeight: 120, background: "var(--bg-inset)", border: "0.5px solid var(--line-2)", borderRadius: "var(--r-sm)", color: "var(--text-0)", padding: 10, fontSize: 11, fontFamily: "var(--font-mono, monospace)", resize: "vertical" }}
              />
            </details>
          </div>

          {meta && (
            <div style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.6, padding: "10px 12px", background: "var(--bg-inset)", borderRadius: "var(--r-sm)", border: "0.5px solid var(--line-2)" }}>
              <div>Detected: <span style={{ color: "var(--text-1)" }}>{meta.width}×{meta.height}</span> · <span style={{ color: "var(--text-1)" }}>{meta.durationSeconds}s</span> · <span style={{ color: "var(--text-1)" }}>{meta.fps}fps</span></div>
              <div style={{ marginTop: 2 }}>Will export at <span style={{ color: "var(--text-1)" }}>{exportSize.width}×{exportSize.height}</span></div>
            </div>
          )}

          <div>
            <label className="mono cap" style={labelStyle}>Resolution</label>
            <Segmented
              value={resPreset}
              onChange={(v) => setResPreset(v as string)}
              options={[
                { value: "1080", label: "1080p" },
                { value: "2160", label: "4K" },
                { value: "native", label: "Native" },
              ]}
            />
          </div>

          <div>
            <label className="mono cap" style={labelStyle}>Frame rate</label>
            <Segmented
              value={String(fps)}
              onChange={(v) => setFps(Number(v))}
              options={[
                { value: "24", label: "24" },
                { value: "25", label: "25" },
                { value: "30", label: "30" },
              ]}
            />
          </div>

          <div>
            <label className="mono cap" style={labelStyle}>Format</label>
            <Segmented value={format} onChange={(v) => setFormat(v as string)} options={FORMATS} />
          </div>

          <Button variant="primary" size="lg" full icon="download" onClick={handleExport} disabled={!sourceHtml.trim() || busy}>
            {busy ? `Rendering… ${job?.progress ?? 0}%` : "Export video"}
          </Button>

          {error && <div style={{ fontSize: 12, color: "var(--red)", whiteSpace: "pre-wrap" }}>{error}</div>}

          {job?.status === "done" && job.outputPath && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <a href={job.outputPath} download style={{ fontSize: 13, color: "var(--accent, #1672EB)", fontWeight: 600 }}>↓ Download video</a>
              <video src={job.outputPath} controls style={{ width: "100%", borderRadius: "var(--r-sm)", background: "#000" }} />
            </div>
          )}
        </div>

        {/* Right: preview (the original animation with its own player) */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ padding: "10px 16px", borderBottom: "0.5px solid var(--line-1)", display: "flex", alignItems: "center", gap: 10 }}>
            <span className="mono cap" style={{ color: "var(--text-2)", fontSize: 11 }}>Preview (original)</span>
          </div>
          <div style={{ flex: 1, minHeight: 0, background: "#0a0a0a" }}>
            {sourceHtml.trim() ? (
              <iframe title="preview" srcDoc={sourceHtml} style={{ width: "100%", height: "100%", border: "none" }} />
            ) : (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)", fontSize: 13 }}>
                Load an animation to preview it here.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
