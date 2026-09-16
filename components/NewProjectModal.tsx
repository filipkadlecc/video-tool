"use client";

import React, { useState, useEffect, useRef } from "react";
import { STYLE_MODES } from "@/lib/prompts/styles";
import { TRANSITION_MODES } from "@/lib/prompts/transitions";
import type { AnimationType, Engine, Resolution, Orientation, FPS, SvgFile, StyleMode, TopicCardStyle, TransitionStyle, Collection } from "@/lib/types";
import { getAnimationTypeMeta, normalizeAnimationType } from "@/lib/animation-types";
import { emptyDoc } from "@/lib/editor-doc";
import { getProjectSize, getResolution } from "@/lib/types";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Segmented from "@/components/ui/Segmented";
import SnippetParamsForm from "@/components/SnippetParamsForm";
import { SNIPPET_SCHEMAS, buildDefaultValues } from "@/lib/snippet-schemas";
import { SNIPPET_ICONS } from "@/lib/snippet-icons";
import { renderSnippet } from "@/lib/snippet-template";
import StylePreviewModal from "@/components/StylePreviewModal";
import IconButton from "@/components/ui/IconButton";

interface SnippetSummary {
  id: string;
  name: string;
  subtitle: string;
  code: string;
}

type VideoMode = "smarttrim" | "compose" | "manual";

interface NewProjectModalProps {
  open: boolean;
  onClose: () => void;
  initialType?: AnimationType;
  // Called when the project is created and all media (if any) has finished
  // uploading. The parent is responsible for navigating to the new project.
  onCreated: (result: { projectId: string; autoAction?: "smarttrim" | "compose" }) => void;
}

type Phase =
  | { kind: "idle" }
  | { kind: "creating-project" }
  | {
      kind: "uploading";
      fileIndex: number;
      fileName: string;
      fileSize: number;
      bytesUploadedTotal: number;
      totalBytes: number;
    }
  | { kind: "error"; message: string };

function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)}KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)}MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)}GB`;
}

function uploadFileWithProgress(
  projectId: string,
  file: File,
  onProgress: (bytesLoaded: number) => void,
  registerXhr: (xhr: XMLHttpRequest) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    registerXhr(xhr);
    const url = `/api/media/${projectId}/upload?name=${encodeURIComponent(file.name)}`;
    console.log("[upload] starting", { name: file.name, size: file.size, url });
    xhr.open("POST", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onloadstart = () => {
      console.log("[upload] loadstart", file.name);
      // Tell the caller we've started even before bytes leave so the UI moves.
      onProgress(0);
    };
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded);
    };
    xhr.upload.onerror = () => {
      console.error("[upload] upload.onerror", file.name);
    };
    xhr.upload.onabort = () => {
      console.warn("[upload] upload.onabort", file.name);
    };
    xhr.onload = () => {
      console.log("[upload] onload", file.name, xhr.status);
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else
        reject(
          new Error(
            `Upload failed (HTTP ${xhr.status})${xhr.responseText ? `: ${xhr.responseText}` : ""}`
          )
        );
    };
    xhr.onerror = () => {
      console.error("[upload] onerror", file.name);
      reject(new Error("Network error during upload (server may have crashed)"));
    };
    xhr.onabort = () => {
      console.warn("[upload] onabort", file.name);
      reject(new Error("Upload aborted"));
    };
    xhr.ontimeout = () => {
      console.error("[upload] ontimeout", file.name);
      reject(new Error("Upload timed out"));
    };
    xhr.send(file);
  });
}

const SNIPPET_ACCENT: Record<string, string> = {
  IntroCard: "#FF64B8",
  LowerThird: "#20A34E",
  EndCard: "#246DFF",
  StatCallout: "#F86606",
  QuoteCard: "#9D829F",
  LogoBumper: "#FF64B8",
  CalloutBanner: "#246DFF",
  ListReveal: "#20A34E",
  CodeSnippet: "#7DD3FC",
  SymbolBug: "#F86606",
};

/**
 * The kinds of project, and — the point of the step — where each one opens.
 *
 * The design has two cards; this app has three types, and inventing a fourth
 * question to hide one of them would be worse than showing it.
 */
/**
 * The four frames the sheet draws, in its order. Each is a preset this app
 * already has — the wizard is not inventing sizes, it is naming the ones that
 * exist so they can be drawn at their true proportion.
 */
const FRAME_PRESETS: { label: string; orientation: Orientation; resolution: Resolution; ratio: string }[] = [
  { label: "Landscape", orientation: "horizontal", resolution: "1080p", ratio: "16:9" },
  { label: "Square", orientation: "square", resolution: "1080p", ratio: "1:1" },
  { label: "Vertical", orientation: "vertical", resolution: "1080p", ratio: "9:16" },
  { label: "Cinema 4K", orientation: "horizontal", resolution: "4k", ratio: "16:9" },
];

const KINDS: { type: AnimationType; title: string; detail: string }[] = [
  { type: "animation", title: "Animation", detail: "Describe it and the assistant builds the scene. Opens in Direct." },
  { type: "svg", title: "From artwork", detail: "Animate an SVG you already have. Opens in Direct." },
  { type: "video", title: "From footage", detail: "Start with files you already have. Opens in Cut." },
];

/**
 * A choice card with a radio ring.
 *
 * The ring matters: these are one-of-N, and a card that only changes colour
 * when chosen reads as a toggle you could have several of.
 */
function KindCard({ active, title, detail, onClick }: {
  active: boolean; title: string; detail: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      role="radio"
      aria-checked={active}
      style={{
        display: "flex", flexDirection: "column", gap: 8, padding: 16, textAlign: "left",
        background: active ? "var(--surface-raised)" : "var(--surface-chrome)",
        border: `1px solid ${active ? "var(--ink-primary)" : "var(--border-edge)"}`,
        borderRadius: "var(--r-panel)", cursor: "pointer",
        transition: "border-color var(--dur-state) var(--ease), background var(--dur-state) var(--ease)",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
        <span className="t-heading" style={{ color: "var(--ink-primary)", flex: 1 }}>{title}</span>
        <span
          aria-hidden
          style={{
            width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
            border: `1px solid ${active ? "var(--ink-primary)" : "var(--ink-disabled)"}`,
            display: "grid", placeItems: "center",
          }}
        >
          {active && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--ink-primary)" }} />}
        </span>
      </span>
      <span className="t-body" style={{ color: "var(--ink-secondary)", lineHeight: 1.45 }}>{detail}</span>
    </button>
  );
}

/**
 * A form label. Sentence case, in the UI face — not mono small-caps.
 *
 * The wizard used to shout every label in uppercase monospace, which reads as
 * machine output rather than as a question someone is asking you.
 */
function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
      <span className="t-control" style={{ color: "var(--ink-secondary)" }}>
        {children}
      </span>
      {hint && (
        <span className="t-caption" style={{ color: "var(--ink-disabled)" }}>
          {hint}
        </span>
      )}
    </div>
  );
}

export default function NewProjectModal({ open, onClose, initialType, onCreated }: NewProjectModalProps) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [resolution, setResolution] = useState<Resolution>("4k");
  const [fps, setFps] = useState<FPS>(25);
  const [orientation, setOrientation] = useState<Orientation>("horizontal");
  /**
   * Roughly how long it should run. Not a canvas property — the composition's
   * length is decided by what is on the timeline — so it goes into the brief,
   * where "a 20-second spot" is a real instruction the assistant can follow.
   */
  const [targetSeconds, setTargetSeconds] = useState("20");
  // "broll" is still a valid stored value, but new projects are "animation" —
  // the two generate from an identical prompt (see normalizeAnimationType).
  const [animationType, setAnimationType] = useState<AnimationType>(
    initialType ? normalizeAnimationType(initialType) : "animation",
  );
  // Remotion is the only engine; kept explicit because it is stored on the
  // project and sent to the generate/render routes.
  const engine: Engine = "remotion";
  const typeLocked = initialType !== undefined;

  const [prompt, setPrompt] = useState("");
  const [notionUrl, setNotionUrl] = useState("");
  const [notionContent, setNotionContent] = useState<string | undefined>();
  const [notionLoading, setNotionLoading] = useState(false);
  // Video projects: editable editorial-notes box. Fetch fills it; the user can
  // also type/paste directly. Its content becomes the project's notionContent.
  const [notesText, setNotesText] = useState("");
  const [scriptWithTimestamps, setScriptWithTimestamps] = useState("");

  const [svgFiles, setSvgFiles] = useState<SvgFile[]>([]);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const currentXhrRef = useRef<XMLHttpRequest | null>(null);
  const creating = phase.kind === "creating-project" || phase.kind === "uploading";
  // Diagnostics so we can tell whether the file-input onChange ever fires.
  const [pickEvents, setPickEvents] = useState(0);
  const [lastPickStatus, setLastPickStatus] = useState<string>("");

  const [snippets, setSnippets] = useState<SnippetSummary[]>([]);
  const [selectedSnippetId, setSelectedSnippetId] = useState<string | null>(null);
  const [snippetValues, setSnippetValues] = useState<Record<string, unknown>>({});
  const [videoMode, setVideoMode] = useState<VideoMode>("smarttrim");
  const [dragActive, setDragActive] = useState(false);
  const [styleMode, setStyleMode] = useState<StyleMode>("default");
  const [topicCardStyle, setTopicCardStyle] = useState<TopicCardStyle>("cards");
  const [transitionStyle, setTransitionStyle] = useState<TransitionStyle>("cut");
  const [stylePreviewOpen, setStylePreviewOpen] = useState(false);
  const [useSfx, setUseSfx] = useState(true);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionId, setCollectionId] = useState<string>("");

  // Load collections so the user can file the new project into one at creation.
  useEffect(() => {
    if (!open) return;
    fetch("/api/collections")
      .then((r) => r.json())
      .then(setCollections)
      .catch(() => setCollections([]));
  }, [open]);

  // Reset the params form whenever the user picks a different snippet — each
  // snippet has its own schema and defaults.
  useEffect(() => {
    if (!selectedSnippetId) {
      setSnippetValues({});
      return;
    }
    const schema = SNIPPET_SCHEMAS[selectedSnippetId];
    if (schema) setSnippetValues(buildDefaultValues(schema));
  }, [selectedSnippetId]);

  useEffect(() => {
    if (open) {
      setStep(1);
      setSelectedSnippetId(null);
      setVideoMode("smarttrim");
      if (initialType) setAnimationType(initialType);
    }
  }, [open, initialType]);

  // Fetch snippets once when the modal first opens.
  useEffect(() => {
    if (!open || snippets.length > 0) return;
    let cancelled = false;
    fetch("/api/snippets")
      .then((r) => r.json())
      .then((data: SnippetSummary[]) => {
        if (!cancelled) setSnippets(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, snippets.length]);

  function handleClose() {
    // Abort any in-flight upload so the user can't leave one half-running.
    if (currentXhrRef.current) {
      try {
        currentXhrRef.current.abort();
      } catch {}
      currentXhrRef.current = null;
    }
    setStep(1);
    setName("");
    setPrompt("");
    setNotionUrl("");
    setNotionContent(undefined);
    setNotesText("");
    setScriptWithTimestamps("");
    setSvgFiles([]);
    setMediaFiles([]);
    setSelectedSnippetId(null);
    setSnippetValues({});
    setVideoMode("smarttrim");
    setPhase({ kind: "idle" });
    setPickEvents(0);
    setLastPickStatus("");
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
        // Drop the fetched content into the editable notes box (append so any
        // notes the user already typed aren't lost).
        if (data.content) {
          setNotesText((prev) => [prev.trim(), data.content].filter(Boolean).join("\n\n"));
        }
      }
    } catch {
      // ignore
    } finally {
      setNotionLoading(false);
    }
  }

  const selectedSnippet = selectedSnippetId
    ? snippets.find((s) => s.id === selectedSnippetId) ?? null
    : null;

  const isVideo = animationType === "video";
  const isSmartTrim = isVideo && videoMode === "smarttrim";

  function canCreate(): boolean {
    if (isSmartTrim) return mediaFiles.length > 0;
    if (isVideo) return mediaFiles.length > 0 || prompt.trim().length > 0;
    if (selectedSnippet) return true;
    return prompt.trim().length > 0;
  }

  async function handleCreate() {
    if (!canCreate()) return;
    console.log("[create] start", {
      name: name.trim(),
      animationType,
      mediaFiles: mediaFiles.map((f) => ({ name: f.name, size: f.size })),
    });
    // Immediately surface the overlay so the user sees something is happening,
    // even before the project create POST resolves.
    setPhase({ kind: "creating-project" });

    // Compose assembles onto a TIMELINE. Creating the document with the project
    // (rather than after mount) is what makes the handoff work: useImperativeHandle
    // re-binds during commit, before the effect that starts the first pass, so
    // ChatPanel's runWithPrompt sees the document and routes to /api/edit-doc.
    // Created client-side instead, it would still be closed over `undefined` and
    // the first pass would quietly write a TSX file.
    //
    // Smart trim gets none: it builds its own document from the cut plan.
    const composeSettings = { resolution, orientation, fps };

    /*
     * The target length goes into the brief, because that is where it is
     * actionable: "about 20 seconds" is something the assistant can build to,
     * whereas the composition's own length is decided by what ends up on the
     * timeline. Only added when there is a brief to add it to, and only when
     * the brief doesn't already say how long it should be.
     */
    const briefed = prompt.trim();
    const withLength = briefed && targetSeconds && !isVideo && !/\b\d+\s*(s|sec|second)/i.test(briefed)
      ? `${briefed}\n\nTarget length: about ${targetSeconds} seconds.`
      : briefed;
    // "manual" gets one too: the whole point is to land on a timeline with the
    // footage ready and nothing done to it yet.
    const startsAsTimeline = isVideo && (videoMode === "compose" || videoMode === "manual");
    const projectBody = {
      name: name.trim(),
      animationType,
      engine,
      settings: composeSettings,
      ...(startsAsTimeline
        ? { doc: emptyDoc({ ...getProjectSize(composeSettings), fps }) }
        : {}),
      initialPrompt: isSmartTrim
        ? briefed || "Smart trim recording"
        : selectedSnippet
          ? briefed || `Started from ${selectedSnippet.name}`
          : isVideo
            ? // Video projects build via Analyze → chat, so a prompt is optional.
              // Fall back to a label so the API's (initialPrompt||initialCode) check passes.
              briefed || "Edit uploaded footage"
            : withLength,
      initialCode: selectedSnippet
        ? (() => {
            const schema = SNIPPET_SCHEMAS[selectedSnippet.id];
            if (!schema || Object.keys(schema.params).length === 0) return selectedSnippet.code;
            return renderSnippet(selectedSnippet.code, schema, snippetValues);
          })()
        : undefined,
      // Video uses the editable notes box (which Fetch fills from Notion); other
      // types keep the fetched-Notion content as-is.
      notionContent: isVideo ? notesText.trim() || undefined : notionContent,
      scriptWithTimestamps: scriptWithTimestamps.trim() || undefined,
      svgContents: svgFiles.length > 0 ? svgFiles : undefined,
      styleMode: animationType === "terminal" || isVideo ? undefined : styleMode,
      topicCardStyle: isVideo ? topicCardStyle : undefined,
      transitionStyle: animationType === "terminal" || isVideo ? undefined : transitionStyle,
      useSfx: animationType === "terminal" ? false : useSfx,
      collectionId: collectionId || undefined,
    };

    try {
      console.log("[create] POST /api/projects");
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projectBody),
      });
      console.log("[create] /api/projects status", res.status);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        setPhase({
          kind: "error",
          message: `Failed to create project (HTTP ${res.status})${text ? `: ${text}` : ""}`,
        });
        return;
      }
      const project = await res.json();
      console.log("[create] project created", project.id);

      if (mediaFiles.length > 0) {
        const totalBytes = mediaFiles.reduce((s, f) => s + f.size, 0);
        let cumulative = 0;
        for (let i = 0; i < mediaFiles.length; i++) {
          const file = mediaFiles[i];
          const baseCumulative = cumulative;
          setPhase({
            kind: "uploading",
            fileIndex: i,
            fileName: file.name,
            fileSize: file.size,
            bytesUploadedTotal: baseCumulative,
            totalBytes,
          });
          await uploadFileWithProgress(
            project.id,
            file,
            (loaded) => {
              setPhase({
                kind: "uploading",
                fileIndex: i,
                fileName: file.name,
                fileSize: file.size,
                bytesUploadedTotal: baseCumulative + loaded,
                totalBytes,
              });
            },
            (xhr) => {
              currentXhrRef.current = xhr;
            }
          );
          currentXhrRef.current = null;
          cumulative += file.size;
        }
      }

      console.log("[create] done");
      // For video projects, hand the chosen first-pass mode to the project page,
      // which runs the whole first pass (analyze → smart-trim/compose) with a
      // visible progress panel.
      onCreated({
        projectId: project.id,
        // "manual" deliberately has no first pass — the timeline opens with the
        // footage imported and untouched.
        autoAction: isVideo && videoMode !== "manual" ? videoMode : undefined,
      });
    } catch (err) {
      console.error("[create] failed", err);
      setPhase({
        kind: "error",
        message: err instanceof Error ? err.message : "Upload failed",
      });
    }
  }

  function cancelUpload() {
    if (currentXhrRef.current) {
      try {
        currentXhrRef.current.abort();
      } catch {}
      currentXhrRef.current = null;
    }
    setPhase({ kind: "idle" });
  }

  const showSnippetPicker =
    animationType !== "terminal" && animationType !== "video";

  // This is a fixed, full-screen overlay. <Modal> used to return null when it
  // was closed, and taking Modal away took that guard with it — so the wizard
  // rendered over the whole app, permanently, with no way past it. The guard
  // has to live here now.
  if (!open) return null;

  /*
   * 4c / 4d — a full-screen flow, not a dialog.
   *
   * The design makes this a screen because it IS one: two steps, a decision on
   * each, and a consequence worth stating. A 560px box with a scroll bar made
   * it feel like a form to get through rather than a choice to make.
   *
   * The logic underneath is untouched — same steps, same creation, same
   * uploads. Rewriting the machinery that creates projects in order to get a
   * layout would be trading a working thing for a prettier one.
   */
  return (
    <>
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed", inset: 0, zIndex: 60,
        background: "var(--surface-void)",
        display: "flex", flexDirection: "column",
        animation: "vt-fade-in var(--dur-enter) var(--ease)",
      }}
    >
      {/* 56px header: what this is, where you are, and the way out */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 12, height: 56, flexShrink: 0,
          padding: "0 32px", borderBottom: "1px solid var(--border-hairline)",
        }}
      >
        <span className="t-heading" style={{ color: "var(--ink-primary)" }}>New project</span>
        <StepPill n={1} label="Kind" active={step === 1} />
        <span style={{ width: 20, height: 1, background: "var(--border-hairline)" }} />
        <StepPill n={2} label="Frame" active={step === 2} />
        <div style={{ flex: 1 }} />
        <IconButton icon="close" title="Close" onClick={handleClose} />
      </div>

      {/* the 760px column the design centres everything in */}
      <div className="vt-scroll" style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        <div style={{ width: 760, margin: "0 auto", padding: "40px 0 48px", display: "flex", flexDirection: "column", gap: 32 }}>
      {/* No progress bar: the step pills in the header already say where you
          are, and two things saying it disagree the moment one is wrong. */}

      <div className="vt-scroll" style={{ overflowY: "auto" }}>
        {/*
          `4c` — step 1 asks what you are making, because that decides which
          room the editor opens in, and then the two things only you can say:
          what it should be, and what it is called.

          It used to ask name -> collection -> type -> resolution -> fps ->
          orientation, so the "Kind" pill sat over four questions about the
          frame and the "Frame" pill sat over a step about snippets and notes.
        */}
        {step === 1 && (
          <div style={{ padding: "0 0 20px", display: "flex", flexDirection: "column", gap: 24 }}>
            <div>
              <h2 className="t-display" style={{ color: "var(--ink-primary)", margin: 0 }}>
                What are you making?
              </h2>
              <p className="t-body" style={{ color: "var(--ink-secondary)", margin: "8px 0 0" }}>
                This sets which workspace the editor opens in. You can switch at any time.
              </p>
            </div>

            {!typeLocked && (
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${KINDS.length}, minmax(0,1fr))`, gap: 12 }}>
                {KINDS.map((k) => (
                  <KindCard
                    key={k.type}
                    active={animationType === k.type}
                    title={k.title}
                    detail={k.detail}
                    onClick={() => setAnimationType(k.type)}
                  />
                ))}
              </div>
            )}

            {!isVideo && (
              <div>
                <FieldLabel
                  hint={
                    selectedSnippet
                      ? "Optional — refine after creation via chat"
                      : "Optional. The assistant uses this to build a first pass — you can also start empty."
                  }
                >
                  {animationType === "terminal" ? "Terminal script prompt" : "Describe it"}
                </FieldLabel>
                <Textarea
                  value={prompt}
                  onChange={setPrompt}
                  rows={4}
                  placeholder={
                    selectedSnippet
                      ? `${selectedSnippet.name} loaded — leave blank or note any tweaks…`
                      : animationType === "terminal"
                        ? `e.g. "Type 'apify actors search instagram', press Enter, show results, 8 seconds total. Dark theme, large font."`
                        : "A 20-second spot for the LED installation at Innovation Week — headline lands on the beat, ends on the Apify mark."
                  }
                />
              </div>
            )}

            <div>
              <FieldLabel>Name</FieldLabel>
              <Input
                value={name}
                onChange={setName}
                placeholder="e.g. Product Launch Teaser"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && name.trim()) {
                    e.preventDefault();
                    setStep(2);
                  }
                }}
              />
            </div>
          </div>
        )}

        {/*
          `4d` — step 2 asks what shape it is, at true proportion, and then the
          questions the design didn't know this app asks (a snippet to start
          from, a style, footage, notes). Those live BELOW the summary, so the
          step still opens with the thing its pill is named after.
        */}
        {step === 2 && (
          <div style={{ padding: "0 0 20px", display: "flex", flexDirection: "column", gap: 24 }}>
            <div>
              <h2 className="t-display" style={{ color: "var(--ink-primary)", margin: 0 }}>
                What shape is it?
              </h2>
              <p className="t-body" style={{ color: "var(--ink-secondary)", margin: "8px 0 0" }}>
                Changeable later, but re-framing a finished animation means re-laying it out — so
                it&apos;s worth picking now.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
              {FRAME_PRESETS.map((preset) => {
                const size = getResolution(preset.orientation, preset.resolution);
                const active = orientation === preset.orientation && resolution === preset.resolution;
                return (
                  <button
                    key={preset.label}
                    onClick={() => {
                      setOrientation(preset.orientation);
                      setResolution(preset.resolution);
                    }}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
                      padding: "16px 10px",
                      background: active ? "var(--surface-raised)" : "var(--surface-chrome)",
                      border: `1px solid ${active ? "var(--ink-primary)" : "var(--border-edge)"}`,
                      borderRadius: "var(--r-panel)", cursor: "pointer",
                    }}
                  >
                    {/* Drawn from the real ratio, not from a hardcoded box —
                        the point of showing a shape is that it is the shape. */}
                    <span style={{ height: 52, display: "grid", placeItems: "center" }}>
                      <span
                        style={{
                          display: "block",
                          width: size.width >= size.height ? 52 : Math.round((size.width / size.height) * 52),
                          height: size.height >= size.width ? 52 : Math.round((size.height / size.width) * 52),
                          background: active ? "var(--ink-primary)" : "var(--surface-active)",
                          borderRadius: 2,
                        }}
                      />
                    </span>
                    <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                      <span className="t-control" style={{ color: "var(--ink-primary)" }}>{preset.label}</span>
                      <span className="t-data-s" style={{ color: "var(--ink-tertiary)" }}>
                        {size.width}×{size.height} · {preset.ratio}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <div>
                <FieldLabel>Width · height</FieldLabel>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Input value={String(getResolution(orientation, resolution).width)} onChange={() => {}} disabled mono style={{ flex: 1, minWidth: 0 }} />
                  <Input value={String(getResolution(orientation, resolution).height)} onChange={() => {}} disabled mono style={{ flex: 1, minWidth: 0 }} />
                </div>
              </div>
              <div>
                <FieldLabel>Frame rate</FieldLabel>
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
              <div>
                <FieldLabel hint={isVideo ? "Footage decides" : undefined}>Duration</FieldLabel>
                <Input
                  value={String(targetSeconds)}
                  onChange={(v) => setTargetSeconds(v.replace(/[^0-9]/g, "").slice(0, 4))}
                  disabled={isVideo}
                  mono
                  suffix="seconds"
                />
              </div>
            </div>

            {!isVideo && (
              <span className="t-caption" style={{ color: "var(--ink-disabled)", marginTop: -14 }}>
                Duration goes into the brief — the composition&apos;s real length is whatever ends up on
                the timeline.
              </span>
            )}

            {/* The summary: the four answers in one sentence, so the step can
                be checked without re-reading the controls. */}
            <div
              style={{
                display: "flex", alignItems: "center", gap: 14, padding: 14,
                background: "var(--surface-chrome)", border: "1px solid var(--border-hairline)",
                borderRadius: "var(--r-panel)",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 64, height: 40, flexShrink: 0, borderRadius: 3,
                  background: "var(--surface-void)", border: "1px solid var(--border-edge)",
                  display: "grid", placeItems: "center",
                }}
              >
                <span
                  style={{
                    display: "block",
                    width: getResolution(orientation, resolution).width >= getResolution(orientation, resolution).height ? 44 : 20,
                    height: getResolution(orientation, resolution).width >= getResolution(orientation, resolution).height ? 25 : 32,
                    background: "var(--surface-active)", borderRadius: 2,
                  }}
                />
              </span>
              <span style={{ minWidth: 0 }}>
                <span className="t-body" style={{ color: "var(--ink-primary)", display: "block" }}>
                  {FRAME_PRESETS.find((f) => f.orientation === orientation && f.resolution === resolution)?.label
                    ?? `${orientation} · ${resolution}`}
                  {" · "}
                  {getResolution(orientation, resolution).width}×{getResolution(orientation, resolution).height}
                  {" · "}{fps} fps
                  {!isVideo && targetSeconds ? ` · ${targetSeconds} seconds` : ""}
                </span>
                <span className="t-caption" style={{ color: "var(--ink-tertiary)" }}>
                  Safe area shown in the editor. Exports as MP4 by default.
                </span>
              </span>
            </div>

            <div>
              <FieldLabel hint="Optional — group several projects for one video">Collection</FieldLabel>
              <select
                value={collectionId}
                onChange={(e) => setCollectionId(e.target.value)}
                className="mono"
                style={{
                  width: "100%",
                  height: 34,
                  padding: "0 10px",
                  background: "var(--surface-void)",
                  border: "1px solid var(--border-hairline)",
                  borderRadius: "var(--r-panel)",
                  color: "var(--ink-primary)",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                <option value="">None</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {isVideo && (
              <div>
                <FieldLabel hint="How should we build your starting cut?">
                  First pass
                </FieldLabel>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  <ModeCard
                    active={videoMode === "smarttrim"}
                    accent="#FF64B8"
                    icon="sparkle"
                    title="Smart trim"
                    subtitle="Auto-cut the dead air — silences + filler words drop out"
                    onClick={() => setVideoMode("smarttrim")}
                  />
                  <ModeCard
                    active={videoMode === "compose"}
                    accent="#246DFF"
                    icon="code"
                    title="Compose"
                    subtitle="The AI edits from your footage + notes"
                    onClick={() => setVideoMode("compose")}
                  />
                  <ModeCard
                    active={videoMode === "manual"}
                    accent="#6CD99A"
                    icon="film"
                    title="I'll cut it"
                    subtitle="Open a timeline with your footage and nothing done to it"
                    onClick={() => setVideoMode("manual")}
                  />
                </div>
                <div
                  className="mono"
                  style={{ fontSize: 10, color: "var(--ink-disabled)", marginTop: 8 }}
                >
                  {videoMode === "manual"
                    ? "Your footage is imported and the timeline opens empty. Smart trim and Compose stay available from Tools whenever you want them."
                    : "After you create, we analyze the footage and build this first cut automatically — then you refine it by chatting."}
                </div>
              </div>
            )}

            {showSnippetPicker && snippets.length > 0 && (
              <div>
                <FieldLabel hint="Skip the AI prompt and start from a finished scene">
                  Start from a brand snippet
                </FieldLabel>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 8,
                  }}
                >
                  <button
                    onClick={() => setSelectedSnippetId(null)}
                    style={{
                      padding: "10px 12px",
                      minHeight: 64,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      gap: 4,
                      background:
                        selectedSnippetId === null ? "var(--brand-tint-bg)" : "var(--surface-void)",
                      border: `1px solid ${
                        selectedSnippetId === null ? "var(--brand)" : "var(--border-hairline)"
                      }`,
                      borderRadius: "var(--r-panel)",
                      cursor: "pointer",
                      textAlign: "left",
                      color: "var(--ink-primary)",
                      transition: "all 120ms",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Icon name="sparkle" size={11} style={{ color: "var(--brand)" }} />
                      <span style={{ fontSize: 12, fontWeight: 600 }}>AI prompt</span>
                    </div>
                    <span style={{ fontSize: 10, color: "var(--ink-tertiary)" }}>
                      Describe it, AI generates
                    </span>
                  </button>
                  {snippets.map((s) => {
                    const accent = SNIPPET_ACCENT[s.id] ?? "var(--brand)";
                    const icon = SNIPPET_ICONS[s.id] ?? "film";
                    const active = selectedSnippetId === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => setSelectedSnippetId(s.id)}
                        style={{
                          padding: "10px 12px",
                          minHeight: 64,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-start",
                          gap: 4,
                          background: active
                            ? `color-mix(in oklab, ${accent} 14%, transparent)`
                            : "var(--surface-void)",
                          border: `1px solid ${active ? accent : "var(--border-hairline)"}`,
                          borderRadius: "var(--r-panel)",
                          cursor: "pointer",
                          textAlign: "left",
                          color: "var(--ink-primary)",
                          transition: "all 120ms",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Icon name={icon} size={11} style={{ color: accent }} />
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{s.name}</span>
                        </div>
                        <span style={{ fontSize: 10, color: "var(--ink-tertiary)", lineHeight: 1.3 }}>
                          {s.subtitle}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedSnippet && (() => {
              const schema = SNIPPET_SCHEMAS[selectedSnippet.id];
              if (!schema || Object.keys(schema.params).length === 0) return null;
              return (
                <div>
                  <FieldLabel hint="Fill in the values — the snippet is generated deterministically from your inputs">
                    Snippet parameters
                  </FieldLabel>
                  <div
                    style={{
                      padding: 14,
                      background: "var(--surface-void)",
                      border: "1px solid var(--border-hairline)",
                      borderRadius: "var(--r-panel)",
                    }}
                  >
                    <SnippetParamsForm
                      schema={schema}
                      values={snippetValues}
                      onValuesChange={setSnippetValues}
                      hideFooter
                    />
                  </div>
                </div>
              );
            })()}

            {!isSmartTrim && !isVideo && animationType !== "terminal" && (
              <div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <FieldLabel hint="Visual style for the AI — kinetic/editorial/cinematic produce noticeably different looks">
                    Style
                  </FieldLabel>
                  <button
                    type="button"
                    onClick={() => setStylePreviewOpen(true)}
                    title="Preview the styles"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      marginBottom: 8,
                      padding: "2px 8px",
                      fontSize: 10,
                      color: "var(--ink-tertiary)",
                      background: "var(--surface-void)",
                      border: "1px solid var(--border-hairline)",
                      borderRadius: "var(--r-panel)",
                      cursor: "pointer",
                    }}
                  >
                    <Icon name="info" size={11} />
                    Preview
                  </button>
                </div>
                <Segmented
                  value={styleMode}
                  onChange={(v) => setStyleMode(v as StyleMode)}
                  options={STYLE_MODES.map((m) => ({ label: m.label, value: m.id }))}
                />
                <div className="mono" style={{ fontSize: 10, color: "var(--ink-disabled)", marginTop: 6 }}>
                  {STYLE_MODES.find((m) => m.id === styleMode)?.description}
                </div>
              </div>
            )}

            {!isSmartTrim && !isVideo && animationType !== "terminal" && (
              <div>
                <FieldLabel hint="How scenes hand off — cut (clean), blend (soft), or camera (a dolly push). The background stays continuous in all three.">
                  Transition style
                </FieldLabel>
                <Segmented
                  value={transitionStyle}
                  onChange={(v) => setTransitionStyle(v as TransitionStyle)}
                  options={TRANSITION_MODES.map((m) => ({ label: m.label, value: m.id }))}
                />
                <div className="mono" style={{ fontSize: 10, color: "var(--ink-disabled)", marginTop: 6 }}>
                  {TRANSITION_MODES.find((m) => m.id === transitionStyle)?.description}
                </div>
              </div>
            )}

            {animationType !== "terminal" && (
              <div>
                <FieldLabel hint="Let the AI add tasteful whooshes / pops / impacts where they fit">
                  Sound effects
                </FieldLabel>
                <Segmented
                  value={useSfx ? "on" : "off"}
                  onChange={(v) => setUseSfx(v === "on")}
                  options={[
                    { label: "On", value: "on" },
                    { label: "Off", value: "off" },
                  ]}
                />
              </div>
            )}

            {/* Video projects have a single input — the Editorial notes box below —
                so notes/instructions can't be split across two fields (the trap
                where notes silently land in the wrong one). Non-video keeps its
                generate prompt. */}
            {/* The brief moved to step 1, where `4c` asks for it: "Describe
                it" belongs with what you are making, not with how it is set
                up. */}

            {isVideo && (
              <div
                style={{
                  padding: 12,
                  background: "var(--brand-tint-bg)",
                  border: "1px solid var(--brand)",
                  borderRadius: "var(--r-panel)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  fontSize: 12,
                  color: "var(--ink-secondary)",
                  lineHeight: 1.5,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon name="sparkle" size={12} style={{ color: "var(--brand)" }} />
                  <span style={{ fontWeight: 600, color: "var(--ink-primary)" }}>
                    What happens next
                  </span>
                </div>
                <div style={{ color: "var(--ink-tertiary)" }}>
                  {isSmartTrim
                    ? "On create we analyze your footage (transcript + scene cuts, and auto-reframe if the timeline aspect differs), then auto-cut the silences + filler words into a first cut. You'll see the progress, then land on the edit to refine."
                    : "On create we analyze your footage (transcript + scene cuts, and auto-reframe if the timeline aspect differs), then the AI builds a first cut from your notes. You'll see the progress, then land on the edit to refine."}
                </div>
              </div>
            )}

            {animationType === "svg" && (
              <div>
                <FieldLabel hint={`${svgFiles.length} file${svgFiles.length === 1 ? "" : "s"}`}>
                  SVG assets
                </FieldLabel>
                <div
                  style={{
                    padding: 12,
                    background: "var(--surface-void)",
                    border: "1px dashed var(--border-hairline)",
                    borderRadius: "var(--r-panel)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  {svgFiles.length >= 2 && (() => {
                    const viewBoxes = svgFiles.map((s) => {
                      const m = s.content.match(/viewBox="([\d.\-\s]+)"/);
                      return m ? m[1].trim().replace(/\s+/g, " ") : null;
                    });
                    const allMatch = viewBoxes.every((v) => v !== null && v === viewBoxes[0]);
                    if (!allMatch) return null;
                    return (
                      <div style={{ fontSize: 11, color: "var(--ink-tertiary)", lineHeight: 1.4 }}>
                        Detected animation sequence — Claude will animate the deltas between frames.
                      </div>
                    );
                  })()}
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
                            background: "var(--surface-raised)",
                            border: "1px solid var(--border-hairline)",
                            borderRadius: 4,
                          }}
                        >
                          <Icon name="image" size={11} style={{ color: "var(--ink-tertiary)" }} />
                          <span className="mono" style={{ fontSize: 11 }}>
                            {svg.filename}
                          </span>
                          <span className="mono nums" style={{ fontSize: 10, color: "var(--ink-disabled)" }}>
                            {svg.content.length.toLocaleString()}ch
                          </span>
                          <button
                            onClick={() => setSvgFiles(svgFiles.filter((_, j) => j !== i))}
                            style={{
                              width: 16,
                              height: 16,
                              border: "none",
                              background: "transparent",
                              color: "var(--ink-tertiary)",
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
                      border: "1px dashed var(--border-edge)",
                      background: "transparent",
                      color: "var(--ink-secondary)",
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
                <FieldLabel
                  hint={`${mediaFiles.length} file${mediaFiles.length === 1 ? "" : "s"}`}
                >
                  Media files
                </FieldLabel>
                <div
                  style={{
                    padding: 12,
                    background: "var(--surface-void)",
                    border: "1px dashed var(--border-hairline)",
                    borderRadius: "var(--r-panel)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  {mediaFiles.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {mediaFiles.map((file, i) => (
                        <div
                          key={i}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "4px 6px 4px 10px",
                            height: 26,
                            background: "var(--surface-raised)",
                            border: "1px solid var(--border-hairline)",
                            borderRadius: 4,
                            maxWidth: "100%",
                          }}
                        >
                          <Icon name="film" size={11} style={{ color: "var(--ink-tertiary)" }} />
                          <span
                            className="mono"
                            style={{
                              fontSize: 11,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              maxWidth: 200,
                            }}
                          >
                            {file.name}
                          </span>
                          <span
                            className="mono nums"
                            style={{ fontSize: 10, color: "var(--ink-disabled)" }}
                          >
                            {(file.size / (1024 * 1024)).toFixed(1)}MB
                          </span>
                          <button
                            onClick={() =>
                              setMediaFiles(mediaFiles.filter((_, j) => j !== i))
                            }
                            style={{
                              width: 16,
                              height: 16,
                              border: "none",
                              background: "transparent",
                              color: "var(--ink-tertiary)",
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
                    onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
                    onDragOver={(e) => { e.preventDefault(); if (!dragActive) setDragActive(true); }}
                    onDragLeave={(e) => {
                      // Only clear when the pointer actually leaves the dropzone.
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragActive(false);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragActive(false);
                      const dropped = Array.from(e.dataTransfer.files).filter((f) =>
                        /\.(mp4|mov|webm|mkv|avi|m4v|mp3|wav|m4a|aac|png|jpe?g|webp|gif)$/i.test(f.name)
                      );
                      if (dropped.length) setMediaFiles((prev) => [...prev, ...dropped]);
                    }}
                    style={{
                      minHeight: 72,
                      padding: "14px 12px",
                      border: dragActive ? "1.5px dashed var(--brand)" : "1px dashed var(--border-edge)",
                      background: dragActive ? "var(--brand-tint-bg)" : "var(--surface-void)",
                      color: dragActive ? "var(--brand)" : "var(--ink-secondary)",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 600,
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      transition: "background 120ms, border-color 120ms, color 120ms",
                    }}
                  >
                    {dragActive ? "Drop to add" : "＋ Add media"}
                    <span style={{ fontWeight: 400, fontSize: 11, color: dragActive ? "var(--brand)" : "var(--ink-disabled)" }}>
                      {dragActive ? "release the files here" : "drag & drop video files here, or click to browse (select several)"}
                    </span>
                    <input
                      type="file"
                      accept="video/*,audio/*,image/*,.mp4,.mov,.webm,.mkv,.avi,.m4v,.mp3,.wav,.m4a,.aac"
                      multiple
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const fileList = e.target.files;
                        console.log("[picker] onChange fired", {
                          fileCount: fileList?.length ?? 0,
                          files: fileList
                            ? Array.from(fileList).map((f) => ({
                                name: f.name,
                                size: f.size,
                                type: f.type,
                              }))
                            : null,
                        });
                        setPickEvents((n) => n + 1);
                        if (!fileList || fileList.length === 0) {
                          setLastPickStatus("Picker fired but no files were selected.");
                          return;
                        }
                        const picked = Array.from(fileList);
                        setLastPickStatus(
                          `Picked ${picked.length} file${picked.length === 1 ? "" : "s"}: ${picked
                            .map((f) => `${f.name} (${(f.size / (1024 * 1024 * 1024)).toFixed(2)} GB)`)
                            .join(", ")}`
                        );
                        setMediaFiles((prev) => {
                          const next = [...prev, ...picked];
                          console.log("[picker] mediaFiles now", next.length, next.map((f) => f.name));
                          return next;
                        });
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
                <div
                  className="mono"
                  style={{
                    marginTop: 8,
                    fontSize: 11,
                    color: pickEvents > 0 ? "var(--brand)" : "var(--ink-disabled)",
                    lineHeight: 1.4,
                  }}
                >
                  {pickEvents === 0
                    ? "Files upload into the project on create. Large videos take a moment."
                    : `Picker fired ${pickEvents}× · ${mediaFiles.length} file${mediaFiles.length === 1 ? "" : "s"} queued${lastPickStatus ? ` · ${lastPickStatus}` : ""}`}
                </div>
              </div>
            )}

            {animationType === "video" && (
              <div>
                <FieldLabel hint="Your instructions + notes — the one place the AI reads for the edit">
                  Notes & instructions
                </FieldLabel>
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  <Input
                    value={notionUrl}
                    onChange={setNotionUrl}
                    placeholder="Paste a Notion link to import…"
                    mono
                    style={{ flex: 1 }}
                  />
                  <Button
                    variant="outline"
                    onClick={fetchNotion}
                    disabled={!notionUrl.trim() || notionLoading}
                  >
                    {notionLoading ? "Fetching…" : "Fetch"}
                  </Button>
                </div>
                <Textarea
                  rows={5}
                  value={notesText}
                  onChange={setNotesText}
                  placeholder={"Everything the AI should follow goes here: what to make (\"a 60s highlight reel\"), plus your KEEP highlights / comments. Or Fetch from a Notion link above."}
                  style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}
                />
                <div className="mono" style={{ fontSize: 10, color: notesText.trim() ? "var(--brand)" : "var(--ink-disabled)", marginTop: 6, lineHeight: 1.4 }}>
                  {notesText.trim()
                    ? `${notesText.length.toLocaleString()} characters — after you Analyze the video, the AI matches these to the transcript + scene cuts.`
                    : "After you Analyze the video, the AI matches these notes to the transcript + scene cuts."}
                </div>
              </div>
            )}

            {isVideo && (
              <div>
                <FieldLabel hint="How each interview topic is introduced in the edit">
                  Topic labels
                </FieldLabel>
                <Segmented
                  value={topicCardStyle}
                  onChange={(v) => setTopicCardStyle(v as TopicCardStyle)}
                  options={[
                    { value: "cards", label: "Full-screen cards" },
                    { value: "chips", label: "Corner chips" },
                    { value: "none", label: "None" },
                  ]}
                />
                <div className="mono" style={{ fontSize: 10, color: "var(--ink-disabled)", marginTop: 6, lineHeight: 1.4 }}>
                  {topicCardStyle === "cards"
                    ? "A branded full-screen card wipes in between answers, then cuts to the clip."
                    : topicCardStyle === "chips"
                      ? "A small pill label sits in the corner over the footage."
                      : "No topic labels — just the cuts."}
                </div>
              </div>
            )}

            {animationType === "animation" && (
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
                      style={{ fontSize: 10, color: "var(--brand)", marginTop: 6 }}
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
                    style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}
                  />
                </div>
              </>
            )}

          </div>
        )}
      </div>
      {phase.kind !== "idle" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(5,5,8,0.88)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            zIndex: 100,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 460,
              display: "flex",
              flexDirection: "column",
              gap: 14,
              background: "var(--surface-chrome)",
              border: "1px solid var(--border-hairline)",
              borderRadius: "var(--r-dialog)",
              padding: 20,
              boxShadow: "var(--shadow-float)",
            }}
          >
            {phase.kind === "creating-project" && (
              <>
                <div className="mono cap" style={{ color: "var(--ink-tertiary)", fontSize: 10 }}>
                  Setting up project…
                </div>
                <div style={{ fontSize: 14, color: "var(--ink-secondary)" }}>
                  Creating the project on the server. The upload starts right after.
                </div>
                <div
                  style={{
                    height: 6,
                    width: "100%",
                    background: "var(--surface-raised)",
                    borderRadius: 3,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: "30%",
                      background: "var(--brand)",
                      animation: "vt-indeterminate 1.4s ease-in-out infinite",
                    }}
                  />
                </div>
              </>
            )}

            {phase.kind === "uploading" && (
              <>
                <div className="mono cap" style={{ color: "var(--ink-tertiary)", fontSize: 10 }}>
                  Uploading media · {phase.fileIndex + 1} of {mediaFiles.length}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--ink-primary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={phase.fileName}
                >
                  {phase.fileName}
                </div>
                <div
                  style={{
                    height: 6,
                    width: "100%",
                    background: "var(--surface-raised)",
                    borderRadius: 3,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(
                        100,
                        (phase.bytesUploadedTotal / Math.max(1, phase.totalBytes)) * 100
                      ).toFixed(1)}%`,
                      background: "var(--brand)",
                      transition: "width 120ms linear",
                    }}
                  />
                </div>
                <div
                  className="mono nums"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 11,
                    color: "var(--ink-tertiary)",
                  }}
                >
                  <span>
                    {formatBytes(phase.bytesUploadedTotal)} / {formatBytes(phase.totalBytes)}
                  </span>
                  <span>
                    {(
                      (phase.bytesUploadedTotal / Math.max(1, phase.totalBytes)) *
                      100
                    ).toFixed(0)}
                    %
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-disabled)", lineHeight: 1.4 }}>
                  Large files take a while — feel free to grab a coffee. Don&apos;t close this tab.
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <Button variant="outline" onClick={cancelUpload}>
                    Cancel
                  </Button>
                </div>
              </>
            )}

            {phase.kind === "error" && (
              <>
                <div
                  className="mono cap"
                  style={{ color: "var(--danger)", fontSize: 10 }}
                >
                  Upload failed
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--ink-primary)",
                    wordBreak: "break-word",
                  }}
                >
                  {phase.message}
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-disabled)", lineHeight: 1.4 }}>
                  Open the browser DevTools console for diagnostic logs prefixed with{" "}
                  <code className="mono">[upload]</code> / <code className="mono">[create]</code>.
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <Button variant="outline" onClick={() => setPhase({ kind: "idle" })}>
                    Dismiss
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
        </div>
      </div>

      {/* 72px footer: the consequence on the left, the actions on the right */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 8, height: 72, flexShrink: 0,
          padding: "0 32px", background: "var(--surface-chrome)",
          borderTop: "1px solid var(--border-hairline)",
        }}
      >
        <span className="t-caption" style={{ color: "var(--ink-tertiary)" }}>
          {/* The consequence of the choice you just made, stated where you
              are about to act on it. */}
          {animationType === "video"
            ? "Opens in Cut · ⌥2 switches to Direct"
            : "Opens in Direct · ⌥1 switches to Cut"}
        </span>
        <div style={{ flex: 1 }} />
        {step === 2 && (
          <Button variant="ghost" size="dialog" icon="chevronLeft" onClick={() => setStep(1)}>
            Back
          </Button>
        )}
        <Button variant="ghost" size="dialog" onClick={handleClose}>Cancel</Button>
        {step === 1 ? (
          <Button
            variant="primary"
            size="dialog"
            iconRight="arrowRight"
            disabled={!name.trim()}
            onClick={() => { if (name.trim()) setStep(2); }}
          >
            Next · Frame
          </Button>
        ) : (
          <Button
            variant="primary"
            size="dialog"
            onClick={handleCreate}
            disabled={!canCreate() || creating}
          >
            {creating
              ? "Creating…"
              : isVideo
                ? "Create & build first cut"
                : selectedSnippet
                  ? `Create from ${selectedSnippet.name}`
                  : animationType === "terminal" ? "Create recording" : "Create animation"}
          </Button>
        )}
      </div>
    </div>
    <StylePreviewModal
      open={stylePreviewOpen}
      onClose={() => setStylePreviewOpen(false)}
      selected={styleMode}
      onSelect={(m) => setStyleMode(m)}
    />
    </>
  );
}

function ModeCard({
  active,
  accent,
  icon,
  title,
  subtitle,
  onClick,
}: {
  active: boolean;
  accent: string;
  icon: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "12px 14px",
        minHeight: 86,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 6,
        background: active
          ? `color-mix(in oklab, ${accent} 14%, transparent)`
          : "var(--surface-void)",
        border: `1px solid ${active ? accent : "var(--border-hairline)"}`,
        borderRadius: "var(--r-panel)",
        cursor: "pointer",
        textAlign: "left",
        color: "var(--ink-primary)",
        transition: "all 120ms",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Icon name={icon} size={12} style={{ color: accent }} />
        <span style={{ fontSize: 13, fontWeight: 600 }}>{title}</span>
      </div>
      <span style={{ fontSize: 11, color: "var(--ink-tertiary)", lineHeight: 1.35 }}>
        {subtitle}
      </span>
    </button>
  );
}


/**
 * A step marker. Active is an ink-primary fill with dark text; inactive is a
 * raised chip — so where you are reads at a glance rather than by counting.
 */
function StepPill({ n, label, active }: { n: number; label: string; active: boolean }) {
  return (
    <span
      className="t-control"
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, height: 22, padding: "0 10px",
        borderRadius: "var(--r-pill)",
        background: active ? "var(--ink-primary)" : "var(--surface-raised)",
        color: active ? "var(--surface-void)" : "var(--ink-secondary)",
      }}
    >
      {n} · {label}
    </span>
  );
}
