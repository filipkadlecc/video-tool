"use client";

import React, { useState, useEffect } from "react";
import type { AnimationType, Resolution, Orientation, FPS, SvgFile } from "@/lib/types";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Segmented from "@/components/ui/Segmented";

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
    svgContents?: SvgFile[];
    mediaFolder?: string;
  }) => void;
}

function OrientationPreview({ ratio, active }: { ratio: string; active: boolean }) {
  const dims =
    ratio === "16:9" ? { w: 36, h: 20 } : ratio === "9:16" ? { w: 20, h: 36 } : { w: 28, h: 28 };
  return (
    <div
      style={{
        width: dims.w,
        height: dims.h,
        background: active ? "var(--accent)" : "var(--bg-3)",
        border: `0.5px solid ${active ? "var(--accent)" : "var(--line-3)"}`,
        borderRadius: 3,
      }}
    />
  );
}

function TypeTile({
  type,
  active,
  onClick,
}: {
  type: AnimationType;
  active: boolean;
  onClick: () => void;
}) {
  const info: Record<AnimationType, { label: string; sub: string; icon: string; c: string }> = {
    broll: { label: "B-Roll", sub: "Dark, cinematic style", icon: "film", c: "var(--magenta)" },
    animation: { label: "Animation", sub: "Generic motion graphics", icon: "bolt", c: "var(--cyan)" },
    svg: { label: "SVG", sub: "Animate SVG assets", icon: "layers", c: "var(--amber)" },
    video: { label: "Video Edit", sub: "Compose & edit video files", icon: "movie", c: "var(--accent)" },
  };
  const t = info[type];
  const [hover, setHover] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flex: 1,
        padding: 14,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 10,
        background: active ? "var(--accent-soft)" : hover ? "var(--bg-3)" : "var(--bg-inset)",
        border: `0.5px solid ${active ? "var(--accent)" : "var(--line-2)"}`,
        borderRadius: "var(--r-md)",
        cursor: "pointer",
        textAlign: "left",
        color: "var(--text-0)",
        transition: "all 120ms",
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 6,
          background: `color-mix(in oklab, ${t.c} 15%, transparent)`,
          border: `0.5px solid color-mix(in oklab, ${t.c} 40%, transparent)`,
          color: t.c,
          display: "grid",
          placeItems: "center",
        }}
      >
        <Icon name={t.icon} size={16} />
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{t.label}</div>
        <div style={{ fontSize: 11, color: "var(--text-2)" }}>{t.sub}</div>
      </div>
    </button>
  );
}

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
      <span className="mono cap" style={{ color: "var(--text-1)" }}>
        {children}
      </span>
      {hint && (
        <span className="mono" style={{ fontSize: 10, color: "var(--text-3)" }}>
          {hint}
        </span>
      )}
    </div>
  );
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

  const [svgFiles, setSvgFiles] = useState<SvgFile[]>([]);
  const [mediaFolder, setMediaFolder] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) setStep(1);
  }, [open]);

  function handleClose() {
    setStep(1);
    setName("");
    setPrompt("");
    setNotionUrl("");
    setNotionContent(undefined);
    setScriptWithTimestamps("");
    setSvgFiles([]);
    setMediaFolder("");
    setCreating(false);
    onClose();
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
      svgContents: svgFiles.length > 0 ? svgFiles : undefined,
      mediaFolder: mediaFolder.trim() || undefined,
    });
  }

  const ratioForOrientation = (o: Orientation) =>
    o === "horizontal" ? "16:9" : o === "vertical" ? "9:16" : "1:1";

  return (
    <Modal
      open={open}
      onClose={handleClose}
      width={560}
      title={step === 1 ? "New project" : "Describe the animation"}
      stepLabel={`Step ${step} of 2`}
    >
      {/* Step progress bar */}
      <div style={{ display: "flex", gap: 6, padding: "0 20px 16px" }}>
        <div style={{ flex: 1, height: 3, background: "var(--accent)", borderRadius: 2 }} />
        <div
          style={{
            flex: 1,
            height: 3,
            background: step === 2 ? "var(--accent)" : "var(--bg-3)",
            borderRadius: 2,
            transition: "background 200ms",
          }}
        />
      </div>

      <div className="vt-scroll" style={{ overflowY: "auto" }}>
        {step === 1 && (
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <FieldLabel>Project name</FieldLabel>
              <Input
                value={name}
                onChange={setName}
                placeholder="e.g. Product Launch Teaser"
                autoFocus
              />
            </div>

            <div>
              <FieldLabel>Type</FieldLabel>
              <div style={{ display: "flex", gap: 8 }}>
                {(["broll", "animation", "svg", "video"] as AnimationType[]).map((t) => (
                  <TypeTile
                    key={t}
                    type={t}
                    active={animationType === t}
                    onClick={() => setAnimationType(t)}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 14 }}>
              <div style={{ flex: 1 }}>
                <FieldLabel>Resolution</FieldLabel>
                <Segmented
                  value={resolution}
                  onChange={(v) => setResolution(v as Resolution)}
                  options={[
                    { value: "4k", label: "4K" },
                    { value: "1080p", label: "1080p" },
                  ]}
                />
              </div>
              <div style={{ flex: 2 }}>
                <FieldLabel>FPS</FieldLabel>
                <Segmented
                  value={fps}
                  onChange={(v) => setFps(v as FPS)}
                  options={[
                    { value: 24, label: "24" },
                    { value: 25, label: "25" },
                    { value: 30, label: "30" },
                    { value: 50, label: "50" },
                  ]}
                />
              </div>
            </div>

            <div>
              <FieldLabel>Orientation</FieldLabel>
              <div style={{ display: "flex", gap: 8 }}>
                {(
                  [
                    { o: "horizontal" as Orientation, label: "Horizontal", sub: "16 : 9" },
                    { o: "vertical" as Orientation, label: "Vertical", sub: "9 : 16" },
                    { o: "square" as Orientation, label: "Square", sub: "1 : 1" },
                  ] as const
                ).map(({ o, label, sub }) => {
                  const active = orientation === o;
                  return (
                    <button
                      key={o}
                      onClick={() => setOrientation(o)}
                      style={{
                        flex: 1,
                        height: 92,
                        padding: 10,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        background: active ? "var(--accent-soft)" : "var(--bg-inset)",
                        border: `0.5px solid ${active ? "var(--accent)" : "var(--line-2)"}`,
                        borderRadius: "var(--r-md)",
                        cursor: "pointer",
                        color: "var(--text-0)",
                        transition: "all 120ms",
                      }}
                    >
                      <div style={{ height: 40, display: "grid", placeItems: "center" }}>
                        <OrientationPreview ratio={ratioForOrientation(o)} active={active} />
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 1,
                        }}
                      >
                        <span style={{ fontSize: 12, fontWeight: 500 }}>{label}</span>
                        <span className="mono" style={{ fontSize: 10, color: "var(--text-2)" }}>
                          {sub}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ paddingTop: 4 }}>
              <Button
                variant="primary"
                size="lg"
                full
                onClick={() => {
                  if (name.trim()) setStep(2);
                }}
                disabled={!name.trim()}
              >
                Next &middot; Content <Icon name="arrowRight" size={14} />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <FieldLabel hint="What should the AI generate?">Prompt</FieldLabel>
              <Textarea
                value={prompt}
                onChange={setPrompt}
                rows={5}
                placeholder="Describe the animation you want..."
                style={undefined}
              />
            </div>

            {animationType === "svg" && (
              <div>
                <FieldLabel hint={`${svgFiles.length} file${svgFiles.length === 1 ? "" : "s"}`}>
                  SVG assets
                </FieldLabel>
                <div
                  style={{
                    padding: 12,
                    background: "var(--bg-inset)",
                    border: "0.5px dashed var(--line-2)",
                    borderRadius: "var(--r-sm)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  {svgFiles.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {svgFiles.map((svg, i) => (
                        <div
                          key={i}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "4px 6px 4px 10px",
                            height: 26,
                            background: "var(--bg-3)",
                            border: "0.5px solid var(--line-2)",
                            borderRadius: 4,
                          }}
                        >
                          <Icon name="image" size={11} style={{ color: "var(--text-2)" }} />
                          <span className="mono" style={{ fontSize: 11 }}>
                            {svg.filename}
                          </span>
                          <span className="mono nums" style={{ fontSize: 10, color: "var(--text-3)" }}>
                            {svg.content.length.toLocaleString()}ch
                          </span>
                          <button
                            onClick={() => setSvgFiles(svgFiles.filter((_, j) => j !== i))}
                            style={{
                              width: 16,
                              height: 16,
                              border: "none",
                              background: "transparent",
                              color: "var(--text-2)",
                              cursor: "pointer",
                              display: "grid",
                              placeItems: "center",
                              borderRadius: 3,
                            }}
                          >
                            <Icon name="close" size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <label
                    style={{
                      height: 28,
                      border: "0.5px dashed var(--line-3)",
                      background: "transparent",
                      color: "var(--text-1)",
                      borderRadius: 4,
                      cursor: "pointer",
                      fontSize: 11,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    + Add SVG
                    <input
                      type="file"
                      accept=".svg"
                      multiple
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const files = e.target.files;
                        if (!files || files.length === 0) return;
                        const newFiles: SvgFile[] = [];
                        let remaining = files.length;
                        for (let i = 0; i < files.length; i++) {
                          const file = files[i];
                          const reader = new FileReader();
                          reader.onload = () => {
                            newFiles.push({ filename: file.name, content: reader.result as string });
                            remaining--;
                            if (remaining === 0) {
                              setSvgFiles((prev) => [...prev, ...newFiles]);
                            }
                          };
                          reader.readAsText(file);
                        }
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>
            )}

            {animationType === "video" && (
              <div>
                <FieldLabel hint="Absolute path to your video files">Media folder</FieldLabel>
                <Input
                  value={mediaFolder}
                  onChange={setMediaFolder}
                  placeholder="/Users/you/Movies/project-folder"
                  mono
                />
                <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-2)", lineHeight: 1.4 }}>
                  Point to a local folder with your video/audio/image files. Files are streamed directly — nothing gets copied or uploaded.
                </div>
              </div>
            )}

            {animationType === "broll" && (
              <>
                <div>
                  <FieldLabel hint="Optional">Notion URL</FieldLabel>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Input
                      value={notionUrl}
                      onChange={setNotionUrl}
                      placeholder="https://notion.so/..."
                      mono
                      style={{ flex: 1 }}
                    />
                    <Button
                      variant="outline"
                      onClick={fetchNotion}
                      disabled={!notionUrl.trim() || notionLoading}
                    >
                      {notionLoading ? "Fetching..." : "Fetch"}
                    </Button>
                  </div>
                  {notionContent && (
                    <div
                      className="mono"
                      style={{ fontSize: 10, color: "var(--accent)", marginTop: 6 }}
                    >
                      Fetched {notionContent.length.toLocaleString()} characters
                    </div>
                  )}
                </div>

                <div>
                  <FieldLabel hint="Timecodes drive scene pacing">Script with timestamps</FieldLabel>
                  <Textarea
                    rows={4}
                    value={scriptWithTimestamps}
                    onChange={setScriptWithTimestamps}
                    placeholder={"[00:00] Cold open on the hero surface\n[00:03] Logo reveal, subtle glow\n[00:06] Pan across the UI..."}
                    style={{ fontFamily: "var(--mono)", fontSize: 12 }}
                  />
                </div>
              </>
            )}

            <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
              <Button variant="outline" onClick={() => setStep(1)} icon="arrowLeft">
                Back
              </Button>
              <div style={{ flex: 1 }} />
              <Button
                variant="primary"
                size="lg"
                onClick={handleCreate}
                disabled={!prompt.trim() || creating}
                icon="sparkle"
              >
                {creating ? "Creating..." : "Create animation"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
