"use client";

// =============================================================================
// Design Lab  (isolated, experimental feature)
// =============================================================================
// A standalone page — separate from the normal project flow — that takes a
// static design (pasted from Claude Design, or seeded by Claude Code via the
// DesignSync tool) and animates it with Remotion while preserving its exact
// look. It REUSES the existing preview (PreviewPanel) and export (ExportDialog)
// without modifying them. Visit at /design-lab.

import React, { useMemo, useRef, useState } from "react";
import PreviewPanel from "@/components/PreviewPanel";
import ExportDialog from "@/components/ExportDialog";
import { evalSceneCode } from "@/remotion/DynamicScene";
import Button from "@/components/ui/Button";
import Segmented from "@/components/ui/Segmented";

const SIZE_PRESETS = [
  { value: "16:9", label: "16:9 · 1080p", width: 1920, height: 1080 },
  { value: "4k", label: "16:9 · 4K", width: 3840, height: 2160 },
  { value: "9:16", label: "9:16 · Reel", width: 1080, height: 1920 },
  { value: "1:1", label: "1:1 · Square", width: 1080, height: 1080 },
];

// Pull the first COMPLETE ```tsx block (used live while streaming).
function extractClosedCode(text: string): string | null {
  const m = text.match(/```(?:tsx|jsx|ts|js)?\s*\n([\s\S]*?)```/);
  return m ? m[1].trim() : null;
}

// Looser extraction for the final result (handles a missing closing fence).
function extractLooseCode(text: string): string {
  const open = text.match(/```(?:tsx|jsx|ts|js)?\s*\n([\s\S]*)$/);
  if (open) return open[1].replace(/```\s*$/, "").trim();
  return text.trim();
}

export default function DesignLabPage() {
  const [designHtml, setDesignHtml] = useState("");
  const [instructions, setInstructions] = useState("");
  const [sizePreset, setSizePreset] = useState("16:9");
  const [fps, setFps] = useState(30);

  const [code, setCode] = useState("");
  const [rawResponse, setRawResponse] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { width, height } = useMemo(
    () => SIZE_PRESETS.find((p) => p.value === sizePreset) ?? SIZE_PRESETS[0],
    [sizePreset],
  );

  // Duration / fps for the export dialog, read straight off the generated code.
  const { durationInFrames, sceneFps } = useMemo(() => {
    if (!code.trim()) return { durationInFrames: 180, sceneFps: fps };
    const result = evalSceneCode(code);
    return {
      durationInFrames: result?.durationInFrames ?? 180,
      sceneFps: result?.fps ?? fps,
    };
  }, [code, fps]);

  async function handleGenerate() {
    if (!designHtml.trim() || streaming) return;
    setStreaming(true);
    setError(null);
    setRawResponse("");
    setCode("");

    try {
      const res = await fetch("/api/design-animate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designHtml, instructions, width, height, fps }),
      });
      if (!res.ok || !res.body) throw new Error("Failed to start generation");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              full += parsed.text;
              setRawResponse(full);
              const closed = extractClosedCode(full);
              if (closed) setCode(closed); // update preview as soon as a full block exists
            }
            if (parsed.error) setError(parsed.error);
          } catch {
            /* ignore partial JSON lines */
          }
        }
      }

      // Final pass — accept code even if the model omitted a closing fence.
      const finalCode = extractClosedCode(full) ?? extractLooseCode(full);
      if (finalCode) setCode(finalCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setStreaming(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setDesignHtml(text);
      setUploadedName(file.name);
      setError(null);
    } catch {
      setError("Couldn't read that file.");
    } finally {
      // reset so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const labelStyle: React.CSSProperties = {
    color: "var(--text-2)",
    marginBottom: 6,
    display: "block",
  };
  const textareaStyle: React.CSSProperties = {
    width: "100%",
    background: "var(--bg-inset)",
    border: "0.5px solid var(--line-2)",
    borderRadius: "var(--r-sm)",
    color: "var(--text-0)",
    padding: 10,
    fontSize: 12,
    fontFamily: "var(--font-mono, monospace)",
    resize: "vertical",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--bg-0)", color: "var(--text-0)" }}>
      {/* Header */}
      <div
        style={{
          padding: "14px 20px",
          borderBottom: "0.5px solid var(--line-1)",
          display: "flex",
          alignItems: "baseline",
          gap: 12,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 15 }}>Design Lab</span>
        <span className="mono cap" style={{ color: "var(--text-3)", fontSize: 11 }}>
          Experimental · separate from your projects
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ color: "var(--text-2)", fontSize: 12 }}>
          Paste a Claude Design layout → animate it, with its look preserved.
        </span>
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Left: controls */}
        <div
          style={{
            width: 420,
            borderRight: "0.5px solid var(--line-1)",
            padding: 18,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div>
            <label className="mono cap" style={labelStyle}>Canvas</label>
            <Segmented
              value={sizePreset}
              onChange={(v) => setSizePreset(v as string)}
              options={SIZE_PRESETS.map((p) => ({ value: p.value, label: p.label }))}
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
                { value: "60", label: "60" },
              ]}
            />
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
              <label className="mono cap" style={{ ...labelStyle, marginBottom: 0, flex: 1 }}>
                Design HTML (paste or upload)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".html,.htm,text/html"
                onChange={handleFileUpload}
                style={{ display: "none" }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mono cap"
                style={{
                  background: "transparent",
                  border: "0.5px solid var(--line-2)",
                  borderRadius: "var(--r-sm)",
                  color: "var(--text-2)",
                  cursor: "pointer",
                  padding: "3px 8px",
                  fontSize: 10,
                }}
              >
                ↑ Upload .html
              </button>
            </div>
            {uploadedName && (
              <div className="mono" style={{ color: "var(--text-3)", fontSize: 10, marginBottom: 6 }}>
                Loaded: {uploadedName}
              </div>
            )}
            <textarea
              value={designHtml}
              onChange={(e) => {
                setDesignHtml(e.target.value);
                if (uploadedName) setUploadedName(null);
              }}
              placeholder="<div style='...'> ... </div>  — or upload an .html file"
              spellCheck={false}
              style={{ ...textareaStyle, minHeight: 220 }}
            />
          </div>

          <div>
            <label className="mono cap" style={labelStyle}>Motion notes (optional)</label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. reveal the heading first, then cascade the three cards; hold ~6s"
              spellCheck={false}
              style={{ ...textareaStyle, minHeight: 64 }}
            />
          </div>

          <Button
            variant="primary"
            size="lg"
            full
            icon="sparkle"
            onClick={handleGenerate}
            disabled={!designHtml.trim() || streaming}
          >
            {streaming ? "Animating…" : "Animate design"}
          </Button>

          {error && <div style={{ fontSize: 12, color: "var(--red)" }}>{error}</div>}

          {rawResponse && (
            <div>
              <button
                onClick={() => setShowRaw((v) => !v)}
                className="mono cap"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-3)",
                  cursor: "pointer",
                  padding: 0,
                  fontSize: 10,
                }}
              >
                {showRaw ? "▼" : "▶"} Generated code
              </button>
              {showRaw && (
                <pre
                  style={{
                    marginTop: 8,
                    maxHeight: 260,
                    overflow: "auto",
                    background: "var(--bg-inset)",
                    border: "0.5px solid var(--line-2)",
                    borderRadius: "var(--r-sm)",
                    padding: 10,
                    fontSize: 11,
                    whiteSpace: "pre-wrap",
                    color: "var(--text-1)",
                  }}
                >
                  {code || rawResponse}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Right: preview + export */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div
            style={{
              padding: "10px 16px",
              borderBottom: "0.5px solid var(--line-1)",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span className="mono cap" style={{ color: "var(--text-2)", fontSize: 11 }}>Preview</span>
            <span style={{ flex: 1 }} />
            <Button
              variant="outline"
              size="sm"
              icon="download"
              onClick={() => setExportOpen(true)}
              disabled={!code.trim()}
            >
              Export video
            </Button>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <PreviewPanel code={code} width={width} height={height} />
          </div>
        </div>
      </div>

      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        code={code}
        durationInFrames={durationInFrames}
        fps={sceneFps}
        width={width}
        height={height}
        projectName="design-lab"
      />
    </div>
  );
}
