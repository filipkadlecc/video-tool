"use client";

import React, { useState } from "react";
import type { AnimationType, Resolution, Orientation, FPS } from "@/lib/types";

interface NewProjectModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (data: {
    name: string;
    animationType: AnimationType;
    settings: { resolution: Resolution; orientation: Orientation; fps: FPS };
    initialPrompt: string;
    notionContent?: string;
    scriptWithTimestamps?: string;
    svgContent?: string;
  }) => void;
}

export default function NewProjectModal({ open, onClose, onCreate }: NewProjectModalProps) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [resolution, setResolution] = useState<Resolution>("4k");
  const [fps, setFps] = useState<FPS>(25);
  const [orientation, setOrientation] = useState<Orientation>("horizontal");
  const [animationType, setAnimationType] = useState<AnimationType>("broll");

  const [prompt, setPrompt] = useState("");
  const [notionUrl, setNotionUrl] = useState("");
  const [notionContent, setNotionContent] = useState<string | undefined>();
  const [notionLoading, setNotionLoading] = useState(false);
  const [scriptWithTimestamps, setScriptWithTimestamps] = useState("");

  const [svgContent, setSvgContent] = useState<string | undefined>();
  const [svgFilename, setSvgFilename] = useState<string | undefined>();

  const [creating, setCreating] = useState(false);

  if (!open) return null;

  function handleNext() {
    if (!name.trim()) return;
    setStep(2);
  }

  async function fetchNotion() {
    if (!notionUrl.trim()) return;
    setNotionLoading(true);
    try {
      const res = await fetch("/api/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: notionUrl.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setNotionContent(data.content);
      }
    } catch {
      // ignore
    } finally {
      setNotionLoading(false);
    }
  }

  async function handleCreate() {
    if (!prompt.trim()) return;
    setCreating(true);
    onCreate({
      name: name.trim(),
      animationType,
      settings: { resolution, orientation, fps },
      initialPrompt: prompt.trim(),
      notionContent,
      scriptWithTimestamps: scriptWithTimestamps.trim() || undefined,
      svgContent,
    });
  }

  function handleClose() {
    setStep(1);
    setName("");
    setPrompt("");
    setNotionUrl("");
    setNotionContent(undefined);
    setScriptWithTimestamps("");
    setSvgContent(undefined);
    setSvgFilename(undefined);
    setCreating(false);
    onClose();
  }

  const radioBtn = (selected: boolean) =>
    `px-3 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
      selected ? "border-accent bg-accent/15 text-accent" : "border-border text-muted hover:border-accent/40"
    }`;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
      <div className="bg-surface border border-border rounded-xl w-[560px] max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold">New Project — Step {step}/2</h2>
          <button onClick={handleClose} className="text-muted hover:text-foreground text-sm">
            Close
          </button>
        </div>

        <div className="p-5 space-y-5">
          {step === 1 && (
            <>
              <div>
                <label className="block text-xs text-muted mb-1.5">Project Name</label>
                <input
                  type="text"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent placeholder:text-muted"
                  placeholder="My Animation"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs text-muted mb-1.5">Type</label>
                <div className="flex gap-2">
                  <button className={radioBtn(animationType === "broll")} onClick={() => setAnimationType("broll")}>
                    B-Roll (Dark Style)
                  </button>
                  <button className={radioBtn(animationType === "animation")} onClick={() => setAnimationType("animation")}>
                    Animation (Generic)
                  </button>
                  <button className={radioBtn(animationType === "svg")} onClick={() => setAnimationType("svg")}>
                    SVG Animation
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs text-muted mb-1.5">Resolution</label>
                <div className="flex gap-2">
                  {(["4k", "1080p"] as Resolution[]).map((r) => (
                    <button key={r} className={radioBtn(resolution === r)} onClick={() => setResolution(r)}>
                      {r.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-muted mb-1.5">Orientation</label>
                <div className="flex gap-2">
                  {([["horizontal", "Horizontal (16:9)"], ["vertical", "Vertical (9:16)"], ["square", "Square (1:1)"]] as [Orientation, string][]).map(([o, label]) => (
                    <button key={o} className={radioBtn(orientation === o)} onClick={() => setOrientation(o)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-muted mb-1.5">FPS</label>
                <div className="flex gap-2">
                  {([24, 25, 30, 50] as FPS[]).map((f) => (
                    <button key={f} className={radioBtn(fps === f)} onClick={() => setFps(f)}>
                      {f}fps
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleNext}
                disabled={!name.trim()}
                className="w-full py-2.5 bg-accent text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                Next
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <label className="block text-xs text-muted mb-1.5">Prompt</label>
                <textarea
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:border-accent placeholder:text-muted"
                  rows={4}
                  placeholder="Describe the animation you want..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  autoFocus
                />
              </div>

              {animationType === "svg" && (
                <div>
                  <label className="block text-xs text-muted mb-1.5">SVG File</label>
                  {svgFilename ? (
                    <div className="flex items-center gap-2">
                      <div className="inline-flex items-center gap-1.5 bg-accent/15 border border-accent/30 rounded-full px-3 py-1.5">
                        <span className="text-xs text-accent font-medium">{svgFilename}</span>
                        <button
                          onClick={() => { setSvgContent(undefined); setSvgFilename(undefined); }}
                          className="text-accent/60 hover:text-accent ml-0.5"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <span className="text-[10px] text-muted">{(svgContent?.length ?? 0).toLocaleString()} chars</span>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center w-full h-20 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-accent/40 transition-colors">
                      <div className="text-center">
                        <p className="text-xs text-muted">Click to upload .svg file</p>
                      </div>
                      <input
                        type="file"
                        accept=".svg"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => {
                            setSvgContent(reader.result as string);
                            setSvgFilename(file.name);
                          };
                          reader.readAsText(file);
                        }}
                      />
                    </label>
                  )}
                </div>
              )}

              {animationType === "broll" && (
                <>
                  <div>
                    <label className="block text-xs text-muted mb-1.5">Notion URL (optional)</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent placeholder:text-muted"
                        placeholder="https://notion.so/..."
                        value={notionUrl}
                        onChange={(e) => setNotionUrl(e.target.value)}
                      />
                      <button
                        onClick={fetchNotion}
                        disabled={!notionUrl.trim() || notionLoading}
                        className="px-3 py-2 text-xs border border-border rounded-lg hover:bg-surface-hover disabled:opacity-50 transition-colors"
                      >
                        {notionLoading ? "Fetching..." : "Fetch"}
                      </button>
                    </div>
                    {notionContent && (
                      <p className="text-[10px] text-accent mt-1">
                        Fetched {notionContent.length} characters from Notion
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs text-muted mb-1.5">Script with Timestamps (optional)</label>
                    <textarea
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:border-accent placeholder:text-muted font-mono"
                      rows={4}
                      placeholder={"0:00 — Introduction\n0:15 — Key stat: 80% growth\n0:30 — Comparison chart"}
                      value={scriptWithTimestamps}
                      onChange={(e) => setScriptWithTimestamps(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setStep(1)}
                  className="px-4 py-2.5 text-sm text-muted border border-border rounded-lg hover:bg-surface-hover transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!prompt.trim() || creating}
                  className="flex-1 py-2.5 bg-accent text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {creating ? "Creating..." : "Create Animation"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
