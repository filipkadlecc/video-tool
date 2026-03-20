"use client";

import React, { useState, useRef, useCallback } from "react";

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  code: string;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
  projectName: string;
}

export default function ExportDialog({
  open,
  onClose,
  code,
  durationInFrames,
  fps,
  width,
  height,
  projectName,
}: ExportDialogProps) {
  const [status, setStatus] = useState<"idle" | "queued" | "rendering" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState(projectName.replace(/\s+/g, "-").toLowerCase());
  const [codec, setCodec] = useState<"h264" | "prores">("h264");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  if (!open) return null;

  async function handleExport() {
    if (!code.trim()) return;

    setStatus("queued");
    setProgress(0);
    setDownloadUrl(null);
    setError(null);

    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, durationInFrames, fps, width, height, codec }),
      });

      if (!res.ok) throw new Error("Failed to enqueue render");

      const job = await res.json();
      const jobId = job.id;

      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/render/${jobId}`);
          const statusData = await statusRes.json();

          setStatus(statusData.status);
          setProgress(statusData.progress);

          if (statusData.status === "done") {
            stopPolling();
            setDownloadUrl(statusData.outputPath);
          } else if (statusData.status === "error") {
            stopPolling();
            setError(statusData.error);
          }
        } catch {
          stopPolling();
          setStatus("error");
          setError("Failed to check render status");
        }
      }, 1000);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  function handleClose() {
    stopPolling();
    setStatus("idle");
    setProgress(0);
    setDownloadUrl(null);
    setError(null);
    onClose();
  }

  const seconds = (durationInFrames / fps).toFixed(1);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-surface border border-border rounded-2xl w-[360px] shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">Export Video</h2>
          <button onClick={handleClose} className="text-muted hover:text-foreground text-xs">
            Close
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-background rounded-lg p-3">
              <span className="text-muted">Resolution</span>
              <p className="text-foreground font-medium">{width}x{height}</p>
            </div>
            <div className="bg-background rounded-lg p-3">
              <span className="text-muted">Duration</span>
              <p className="text-foreground font-medium">{durationInFrames}f / {seconds}s</p>
            </div>
            <div className="bg-background rounded-lg p-3">
              <span className="text-muted">FPS</span>
              <p className="text-foreground font-medium">{fps}</p>
            </div>
            <div className="bg-background rounded-lg p-3">
              <span className="text-muted">Codec</span>
              <div className="flex gap-1.5 mt-1">
                <button
                  onClick={() => setCodec("h264")}
                  className={`px-2 py-0.5 text-[11px] font-medium rounded ${
                    codec === "h264"
                      ? "bg-accent text-white"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  H.264
                </button>
                <button
                  onClick={() => setCodec("prores")}
                  className={`px-2 py-0.5 text-[11px] font-medium rounded ${
                    codec === "prores"
                      ? "bg-accent text-white"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  ProRes
                </button>
              </div>
            </div>
          </div>

          {codec === "prores" && (
            <p className="text-[10px] text-accent">ProRes 4444 — .mov with transparent background (alpha channel)</p>
          )}

          <div>
            <label className="block text-xs text-muted mb-1.5">File Name</label>
            <input
              type="text"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
            />
          </div>

          {status === "rendering" && (
            <div>
              <div className="flex justify-between text-xs text-muted mb-1">
                <span>Rendering...</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 bg-background rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {status === "done" && downloadUrl && (
            <a
              href={downloadUrl}
              download={`${fileName || "export"}.${codec === "prores" ? "mov" : "mp4"}`}
              className="block w-full py-2.5 text-center bg-[#5C8374] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
            >
              Download {codec === "prores" ? "MOV" : "MP4"}
            </a>
          )}

          {status === "error" && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          {(status === "idle" || status === "error") && (
            <button
              onClick={handleExport}
              disabled={!code.trim()}
              className="w-full py-2.5 bg-accent text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              Export
            </button>
          )}

          {status === "queued" && (
            <button disabled className="w-full py-2.5 bg-accent/50 text-white text-sm font-medium rounded-lg opacity-50">
              Queued...
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
