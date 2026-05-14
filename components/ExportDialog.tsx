"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import IconButton from "@/components/ui/IconButton";
import Input from "@/components/ui/Input";
import Segmented from "@/components/ui/Segmented";
import { formatBytes } from "@/lib/format";

interface RenderPreset {
  name: string;
  codec: string;
  builtIn?: boolean;
}

const BUILT_IN_PRESETS: RenderPreset[] = [
  { name: "YouTube 4K", codec: "h264", builtIn: true },
  { name: "Instagram Reel", codec: "h264", builtIn: true },
  { name: "Color Grading", codec: "prores-xq", builtIn: true },
  { name: "Compositing", codec: "prores", builtIn: true },
  { name: "No Background", codec: "prores", builtIn: true },
  { name: "OBS (Transparent .mov)", codec: "qtrle", builtIn: true },
];

function loadUserPresets(): RenderPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("vt-render-presets");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveUserPresets(presets: RenderPreset[]) {
  localStorage.setItem("vt-render-presets", JSON.stringify(presets));
}

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
  const [codec, setCodec] = useState<string>("h264");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [presetOpen, setPresetOpen] = useState(false);
  const [userPresets, setUserPresets] = useState<RenderPreset[]>([]);
  const [savePresetName, setSavePresetName] = useState("");
  const [showSavePreset, setShowSavePreset] = useState(false);
  const presetRef = useRef<HTMLDivElement>(null);

  const [cacheStats, setCacheStats] = useState<{ count: number; totalBytes: number } | null>(null);
  const [cleaning, setCleaning] = useState(false);

  const refreshCacheStats = useCallback(async () => {
    try {
      const res = await fetch("/api/renders/cleanup");
      if (res.ok) setCacheStats(await res.json());
    } catch {}
  }, []);

  async function handleClearRenders() {
    if (cleaning) return;
    setCleaning(true);
    try {
      await fetch("/api/renders/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      await refreshCacheStats();
    } finally {
      setCleaning(false);
    }
  }

  useEffect(() => {
    setUserPresets(loadUserPresets());
  }, []);

  useEffect(() => {
    if (open) refreshCacheStats();
  }, [open, refreshCacheStats, status]);

  useEffect(() => {
    if (!presetOpen) return;
    function handleClick(e: MouseEvent) {
      if (presetRef.current && !presetRef.current.contains(e.target as Node)) setPresetOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [presetOpen]);

  function applyPreset(preset: RenderPreset) {
    setCodec(preset.codec);
    setPresetOpen(false);
  }

  function handleSavePreset() {
    if (!savePresetName.trim()) return;
    const newPreset: RenderPreset = { name: savePresetName.trim(), codec };
    const updated = [...userPresets, newPreset];
    setUserPresets(updated);
    saveUserPresets(updated);
    setSavePresetName("");
    setShowSavePreset(false);
  }

  function deleteUserPreset(index: number) {
    const updated = userPresets.filter((_, i) => i !== index);
    setUserPresets(updated);
    saveUserPresets(updated);
  }

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

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
            new Audio("/assets/render-complete.m4a").play().catch(() => {});
            const a = document.createElement("a");
            a.href = statusData.outputPath;
            a.download = `${fileName || "export"}.${codec === "h264" ? "mp4" : "mov"}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
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
  const stats = [
    { label: "Resolution", value: `${width}\u00d7${height}` },
    { label: "Duration", value: `${seconds}s` },
    { label: "FPS", value: String(fps) },
    { label: "Codec", value: codec === "h264" ? "H.264" : codec === "prores" ? "ProRes 4444" : codec === "prores-xq" ? "ProRes 4444 XQ" : "QT Animation (RLE)" },
  ];

  return (
    <Modal open={open} onClose={handleClose} width={480} title="Export" stepLabel="Render to file">
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Presets */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ position: "relative" }} ref={presetRef}>
            <Button variant="outline" size="sm" icon="settings" onClick={() => setPresetOpen(!presetOpen)}>
              Presets <Icon name="chevronDown" size={12} />
            </Button>
            {presetOpen && (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: "100%",
                  marginTop: 6,
                  minWidth: 220,
                  padding: 5,
                  background: "var(--bg-3)",
                  border: "0.5px solid var(--line-2)",
                  borderRadius: "var(--r-sm)",
                  boxShadow: "var(--sh-float)",
                  zIndex: 10,
                }}
              >
                <div className="mono cap" style={{ padding: "6px 8px", color: "var(--text-3)" }}>
                  Built-in
                </div>
                {BUILT_IN_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => applyPreset(p)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      width: "100%",
                      padding: "7px 8px",
                      fontSize: 12,
                      background: "transparent",
                      border: "none",
                      color: "var(--text-0)",
                      borderRadius: 4,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-4)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <span style={{ flex: 1 }}>{p.name}</span>
                    <span className="mono" style={{ fontSize: 10, color: "var(--text-3)" }}>
                      {p.codec === "h264" ? "H.264" : p.codec === "prores" ? "ProRes" : p.codec === "prores-xq" ? "XQ" : "QT-RLE"}
                    </span>
                  </button>
                ))}
                {userPresets.length > 0 && (
                  <>
                    <div style={{ height: 1, background: "var(--line-1)", margin: "4px 0" }} />
                    <div className="mono cap" style={{ padding: "6px 8px", color: "var(--text-3)" }}>
                      Custom
                    </div>
                    {userPresets.map((p, i) => (
                      <div
                        key={i}
                        style={{ display: "flex", alignItems: "center" }}
                      >
                        <button
                          onClick={() => applyPreset(p)}
                          style={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "7px 8px",
                            fontSize: 12,
                            background: "transparent",
                            border: "none",
                            color: "var(--text-0)",
                            borderRadius: 4,
                            cursor: "pointer",
                            textAlign: "left",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-4)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <span style={{ flex: 1 }}>{p.name}</span>
                          <span className="mono" style={{ fontSize: 10, color: "var(--text-3)" }}>
                            {p.codec === "h264" ? "H.264" : p.codec === "prores" ? "ProRes" : p.codec === "prores-xq" ? "XQ" : "QT-RLE"}
                          </span>
                        </button>
                        <IconButton icon="close" size={20} onClick={() => deleteUserPreset(i)} />
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
          <div style={{ flex: 1 }} />
          {!showSavePreset ? (
            <Button variant="ghost" size="sm" onClick={() => setShowSavePreset(true)}>
              Save as preset
            </Button>
          ) : (
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <Input
                value={savePresetName}
                onChange={setSavePresetName}
                placeholder="Preset name"
                autoFocus
                style={{ height: 26, fontSize: 11, width: 140 }}
                onKeyDown={(e) => { if (e.key === "Enter") handleSavePreset(); if (e.key === "Escape") setShowSavePreset(false); }}
              />
              <Button variant="primary" size="sm" onClick={handleSavePreset} disabled={!savePresetName.trim()}>
                Save
              </Button>
              <IconButton icon="close" size={22} onClick={() => setShowSavePreset(false)} />
            </div>
          )}
        </div>

        {/* Stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {stats.map((s) => (
            <div
              key={s.label}
              style={{
                padding: 12,
                background: "var(--bg-inset)",
                border: "0.5px solid var(--line-2)",
                borderRadius: "var(--r-sm)",
              }}
            >
              <div className="mono cap" style={{ color: "var(--text-2)", marginBottom: 4 }}>
                {s.label}
              </div>
              <div className="mono nums" style={{ fontSize: 14, fontWeight: 600, letterSpacing: -0.2 }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* Codec */}
        <div>
          <div className="mono cap" style={{ color: "var(--text-1)", marginBottom: 8 }}>
            Codec
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Segmented
              value={codec}
              onChange={(v) => setCodec(v as string)}
              options={[
                { value: "h264", label: "H.264" },
                { value: "prores", label: "ProRes 4444" },
                { value: "prores-xq", label: "ProRes XQ" },
                { value: "qtrle", label: "QT-RLE" },
              ]}
            />
            {codec === "prores" && (
              <div
                style={{
                  padding: 8,
                  fontSize: 11,
                  color: "var(--text-2)",
                  background: "var(--amber-soft)",
                  borderRadius: 4,
                  border: "0.5px solid color-mix(in oklab, var(--amber) 30%, transparent)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Icon name="info" size={12} style={{ color: "var(--amber)" }} />
                ProRes 4444 — .mov with alpha channel. Good for compositing.
              </div>
            )}
            {codec === "prores-xq" && (
              <div
                style={{
                  padding: 8,
                  fontSize: 11,
                  color: "var(--text-2)",
                  background: "var(--accent-soft)",
                  borderRadius: 4,
                  border: "0.5px solid var(--accent-line)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Icon name="info" size={12} style={{ color: "var(--accent)" }} />
                ProRes 4444 XQ — highest quality, 10-bit 4:4:4, alpha channel. Best for color grading. Large files.
              </div>
            )}
            {codec === "qtrle" && (
              <div
                style={{
                  padding: 8,
                  fontSize: 11,
                  color: "var(--text-2)",
                  background: "var(--accent-soft)",
                  borderRadius: 4,
                  border: "0.5px solid var(--accent-line)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Icon name="info" size={12} style={{ color: "var(--accent)" }} />
                QuickTime Animation (RLE) — .mov with ARGB alpha channel. Drop into OBS as a Media Source. Large files.
              </div>
            )}
          </div>
        </div>

        {/* File name */}
        <div>
          <div className="mono cap" style={{ color: "var(--text-1)", marginBottom: 8 }}>
            File name
          </div>
          <Input
            value={fileName}
            onChange={setFileName}
            mono
            suffix={`.${codec === "h264" ? "mp4" : "mov"}`}
          />
        </div>

        {/* States */}
        {(status === "idle" || status === "error") && (
          <>
            {status === "error" && (
              <div style={{ fontSize: 12, color: "var(--red)" }}>{error}</div>
            )}
            <Button variant="primary" size="lg" full icon="download" onClick={handleExport} disabled={!code.trim()}>
              Export
            </Button>
          </>
        )}

        {(status === "queued" || status === "rendering") && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="mono cap" style={{ color: "var(--text-1)" }}>
                {status === "queued" ? "Queued..." : "Rendering"}
              </span>
              <span className="mono nums" style={{ fontSize: 12, color: "var(--accent)" }}>
                {Math.min(100, Math.round(progress))}%
              </span>
            </div>
            <div style={{ height: 6, background: "var(--bg-inset)", borderRadius: 3, overflow: "hidden" }}>
              <div
                style={{
                  width: `${Math.min(100, progress)}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, var(--accent), oklch(0.92 0.22 124))",
                  transition: "width 100ms linear",
                  boxShadow: "0 0 12px oklch(0.88 0.22 124 / 0.5)",
                }}
              />
            </div>
            <div className="mono nums" style={{ fontSize: 11, color: "var(--text-3)" }}>
              frame {Math.round((progress / 100) * durationInFrames)} / {durationInFrames}
            </div>
          </div>
        )}

        {cacheStats && cacheStats.count > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              paddingTop: 10,
              borderTop: "0.5px solid var(--line-1)",
              fontSize: 11,
              color: "var(--text-3)",
            }}
          >
            <Icon name="info" size={12} />
            <span className="mono">
              {cacheStats.count} cached render{cacheStats.count === 1 ? "" : "s"} ·{" "}
              {formatBytes(cacheStats.totalBytes)}
            </span>
            <span style={{ flex: 1 }} />
            <Button variant="ghost" size="sm" onClick={handleClearRenders} disabled={cleaning}>
              {cleaning ? "Clearing..." : "Clear cache"}
            </Button>
          </div>
        )}

        {status === "done" && downloadUrl && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: 12,
                background: "var(--accent-soft)",
                border: "0.5px solid var(--accent-line)",
                borderRadius: "var(--r-sm)",
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  background: "var(--accent)",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <Icon name="check" size={14} style={{ color: "var(--accent-ink)" }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Render complete</div>
                <div className="mono nums" style={{ fontSize: 11, color: "var(--text-2)" }}>
                  {fileName}.{codec === "h264" ? "mp4" : "mov"}
                </div>
              </div>
            </div>
            <a
              href={downloadUrl}
              download={`${fileName || "export"}.${codec === "h264" ? "mp4" : "mov"}`}
              style={{ textDecoration: "none" }}
            >
              <Button variant="primary" size="lg" full icon="download">
                Download file
              </Button>
            </a>
          </div>
        )}
      </div>
    </Modal>
  );
}
