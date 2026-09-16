"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { STYLE_MODES } from "@/lib/prompts/styles";
import { TRANSITION_MODES } from "@/lib/prompts/transitions";
import type { AnimationType, Engine, Resolution, Orientation, FPS, SvgFile, StyleMode, TopicCardStyle, TransitionStyle, Collection } from "@/lib/types";
import { normalizeAnimationType } from "@/lib/animation-types";
import { emptyDoc } from "@/lib/editor-doc";
import { getProjectSize, getResolution } from "@/lib/types";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Segmented from "@/components/ui/Segmented";
import { SNIPPET_SCHEMAS, buildDefaultValues } from "@/lib/snippet-schemas";
import { SNIPPET_ICONS } from "@/lib/snippet-icons";
import { renderSnippet } from "@/lib/snippet-template";
import StylePreviewModal from "@/components/StylePreviewModal";
import IconButton from "@/components/ui/IconButton";

/**
 * New project — ONE screen.
 *
 * ── What this replaces ──────────────────────────────────────────────────────
 *
 * A two-step wizard: "1 · Kind" then "2 · Frame". Three things were wrong with
 * it, and the new design names all three:
 *
 * 1. FOUR WAYS TO GIVE THE SAME BRIEF were scattered across both steps — a
 *    prompt field, a 22-card snippet grid, a Notion URL and a timestamped
 *    script. They are alternatives, but laid out as separate fields they read
 *    as a stack to fill in. Here they are one region with a switcher above it:
 *    pick where the brief comes from, and that is the only input on screen.
 * 2. THE STEP NAMES LIED. Step 2 held ten sections, three of which were the
 *    frame, and it scrolled to ~1350px.
 * 3. EVERYTHING HAD EQUAL WEIGHT. The frame — expensive to change once a
 *    composition is laid out — looked exactly as important as Sound effects,
 *    which has a good default and is one click to flip. Shape and Look are now
 *    a settings panel on the right, built like the editor's inspector.
 *
 * Nothing scrolls. Every state fits 1600×1000.
 *
 * ── Two departures from the handoff, both deliberate ─────────────────────────
 *
 * - The design has two kinds; this app has four project types. SVG becomes a
 *   fifth SOURCE ("From artwork") rather than a third tab, because an SVG is
 *   another way to brief an animation. Terminal keeps no tab: it is reachable
 *   by opening the wizard from /terminal, which locks the kind the way the old
 *   flow did.
 * - Footage keeps its FIRST PASS choice (Smart trim / Compose / I'll cut it),
 *   as a section in the right panel where the other settings live. Dropping it
 *   would have moved a daily-use decision behind a menu in the editor.
 */

interface SnippetSummary {
  id: string;
  name: string;
  subtitle: string;
  code: string;
}

type VideoMode = "smarttrim" | "compose" | "manual";

/** Where the brief comes from. The core idea of the screen. */
type Source = "describe" | "snippet" | "notion" | "script" | "artwork";

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

/** The four frames, drawn at their real ratio. Selected on load: Cinema 4K. */
const FRAME_PRESETS: { label: string; orientation: Orientation; resolution: Resolution; ratio: string }[] = [
  { label: "Landscape", orientation: "horizontal", resolution: "1080p", ratio: "16:9" },
  { label: "Square", orientation: "square", resolution: "1080p", ratio: "1:1" },
  { label: "Vertical", orientation: "vertical", resolution: "1080p", ratio: "9:16" },
  { label: "Cinema 4K", orientation: "horizontal", resolution: "4k", ratio: "16:9" },
];

/** Where a brief can come from, in the order the switcher shows them. */
const SOURCES: { id: Source; label: string }[] = [
  { id: "describe", label: "Describe it" },
  { id: "snippet", label: "From a snippet" },
  { id: "notion", label: "From Notion" },
  { id: "script", label: "From a script" },
  { id: "artwork", label: "From artwork" },
];

/** Openers for the blank page. Clicking one fills the box; you then edit it. */
const STARTERS: { label: string; text: string }[] = [
  { label: "Product launch", text: "A 20-second launch spot. Open on the problem, show the product doing the work, land on the wordmark. Confident, not frantic." },
  { label: "Feature explainer", text: "A 30-second explainer for one feature. Name it, show it working on real data, end on where to find it." },
  { label: "Conference loop", text: "A silent 15-second loop for a booth screen. Big type, one idea, reads from across the room, loops seamlessly." },
  { label: "Changelog clip", text: "A 12-second changelog clip. What shipped, what it replaces, one screenshot, the version number at the end." },
];

/**
 * Cues out of a script.
 *
 * `[MM:SS]` at the start of a line is a scene boundary. Parsing it here — and
 * showing what was parsed — is the difference between a script the assistant
 * paces to and a wall of text it guesses at.
 */
function parseCues(script: string): { at: number; text: string }[] {
  const out: { at: number; text: string }[] = [];
  for (const line of script.split("\n")) {
    const m = line.match(/^\s*\[(\d{1,2}):(\d{2})\]\s*(.*)$/);
    if (!m) continue;
    out.push({ at: Number(m[1]) * 60 + Number(m[2]), text: m[3].trim() });
  }
  return out;
}

/** "00:18" — cue times are minutes and seconds, never frames. */
function mmss(total: number): string {
  const m = Math.floor(total / 60);
  const s = Math.round(total % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * What a media file actually is, asked of the browser.
 *
 * The import list says "2560×1440 · 00:05:12 · 412 MB", and only the size is
 * knowable without decoding. A hidden media element gives the rest, and the
 * first video's dimensions seed the frame.
 */
function probeMedia(file: File): Promise<{ width?: number; height?: number; seconds?: number }> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("video") && !file.type.startsWith("audio")) { resolve({}); return; }
    const url = URL.createObjectURL(file);
    const el = document.createElement(file.type.startsWith("video") ? "video" : "audio");
    const done = (v: { width?: number; height?: number; seconds?: number }) => {
      URL.revokeObjectURL(url);
      resolve(v);
    };
    el.preload = "metadata";
    el.onloadedmetadata = () => done({
      width: (el as HTMLVideoElement).videoWidth || undefined,
      height: (el as HTMLVideoElement).videoHeight || undefined,
      seconds: Number.isFinite(el.duration) ? el.duration : undefined,
    });
    el.onerror = () => done({});
    el.src = url;
    // A file the browser can't decode must not hang the list.
    setTimeout(() => done({}), 4000);
  });
}

/** "00:05:12" — file durations, which are longer than a cue. */
function hhmmss(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${p(h)}:${p(m)}:${p(s)}` : `00:${p(m)}:${p(s)}`;
}

/** The first sentence only — these rows describe a parameter, not a feature. */
function firstSentence(text?: string): string {
  if (!text) return "";
  const stop = text.indexOf(". ");
  return stop === -1 ? text : text.slice(0, stop + 1);
}

/** A section in the right panel: 32px header, a qualifier, collapsible. */
function PanelSection({ label, qualifier, open, onToggle, children }: {
  label: string; qualifier: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div style={{ flexShrink: 0, borderBottom: "1px solid var(--border-hairline)" }}>
      <button
        onClick={onToggle}
        style={{
          display: "flex", alignItems: "center", gap: 8, width: "100%", height: 32,
          padding: "0 8px 0 12px", background: "var(--surface-raised)", border: "none",
          cursor: "pointer", textAlign: "left",
        }}
      >
        <Icon name={open ? "chevronDown" : "chevronRight"} size={13} style={{ color: "var(--ink-secondary)" }} />
        <span className="t-section" style={{ color: "var(--ink-primary)", flex: 1 }}>{label}</span>
        <span style={{ fontSize: 11, color: "var(--ink-tertiary)" }}>{qualifier}</span>
      </button>
      {open && <div style={{ padding: "10px 12px 12px", display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>}
    </div>
  );
}

/** A right-panel row: a right-aligned 62px label beside its control. */
function PanelRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "62px minmax(0,1fr)", gap: 6, alignItems: "center" }}>
      <span className="t-control" style={{ color: "var(--ink-secondary)", textAlign: "right" }}>{label}</span>
      {children}
    </div>
  );
}

export default function NewProjectModal({ open, onClose, initialType, onCreated }: NewProjectModalProps) {
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

  const [prompt, setPrompt] = useState("");
  const [notionUrl, setNotionUrl] = useState("");
  const [notionContent, setNotionContent] = useState<string | undefined>();
  const [notionLoading, setNotionLoading] = useState(false);
  const [scriptWithTimestamps, setScriptWithTimestamps] = useState("");

  const [svgFiles, setSvgFiles] = useState<SvgFile[]>([]);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const currentXhrRef = useRef<XMLHttpRequest | null>(null);
  const creating = phase.kind === "creating-project" || phase.kind === "uploading";

  const [snippets, setSnippets] = useState<SnippetSummary[]>([]);
  const [selectedSnippetId, setSelectedSnippetId] = useState<string | null>(null);
  const [snippetValues, setSnippetValues] = useState<Record<string, unknown>>({});
  const [videoMode, setVideoMode] = useState<VideoMode>("smarttrim");
  const [dragActive, setDragActive] = useState(false);
  const [styleMode, setStyleMode] = useState<StyleMode>("default");
  // Kept as a stored project setting; the screen no longer asks for it.
  const topicCardStyle: TopicCardStyle = "cards";
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


  /* ── the new screen's own state ──────────────────────────────────────── */

  /** Where the brief comes from. Switching preserves every other mode. */
  const [source, setSource] = useState<Source>("describe");
  const [snippetQuery, setSnippetQuery] = useState("");
  const [shapeOpen, setShapeOpen] = useState(true);
  const [lookOpen, setLookOpen] = useState(true);
  /** Frame overridden by hand — so an imported clip stops seeding it. */
  const [frameTouched, setFrameTouched] = useState(false);
  const [customSize, setCustomSize] = useState<{ width: number; height: number } | null>(null);
  /** What each picked file turned out to be, keyed by name+size. */
  const [probes, setProbes] = useState<Record<string, { width?: number; height?: number; seconds?: number }>>({});

  // A hand-typed frame — or one seeded by the first clip — is not a preset any
  // more, and the summary must not go on claiming it is.
  const preset = customSize
    ? null
    : FRAME_PRESETS.find((p) => p.orientation === orientation && p.resolution === resolution) ?? null;
  const size = customSize ?? getResolution(orientation, resolution);

  const isFootage = animationType === "video";
  const isTerminal = animationType === "terminal";
  /** SVG is a SOURCE here, not a kind — but it is still a project type. */
  const effectiveType: AnimationType = isFootage
    ? "video"
    : isTerminal
      ? "terminal"
      : source === "artwork" ? "svg" : "animation";

  const cues = useMemo(() => parseCues(scriptWithTimestamps), [scriptWithTimestamps]);
  const scriptSeconds = cues.length
    ? Math.round(cues[cues.length - 1].at + (cues.length > 1 ? cues[cues.length - 1].at - cues[cues.length - 2].at : 4))
    : 0;

  const filteredSnippets = useMemo(() => {
    const q = snippetQuery.trim().toLowerCase();
    const list = q
      ? snippets.filter((s) => s.name.toLowerCase().includes(q) || s.subtitle.toLowerCase().includes(q))
      : snippets;
    return list;
  }, [snippets, snippetQuery]);

  /*
   * The brief, whatever it was written in.
   *
   * One derived value rather than four fields the creator has to know about:
   * the screen's whole argument is that these are alternatives.
   */
  const brief = (() => {
    if (isFootage) return prompt.trim();
    switch (source) {
      case "describe": return prompt.trim();
      case "script": return scriptWithTimestamps.trim();
      case "notion": return (notionContent ?? "").trim();
      case "snippet": return prompt.trim();
      case "artwork": return prompt.trim();
    }
  })();

  /*
   * A script sets the length, so you never state the duration twice. The field
   * goes read-only while cues exist and follows what was parsed.
   */
  useEffect(() => {
    if (source === "script" && cues.length > 0) setTargetSeconds(String(scriptSeconds));
  }, [source, cues.length, scriptSeconds]);

  /** Probe a file as it lands, and let the first video seed the frame. */
  const addFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setMediaFiles((prev) => [...prev, ...files]);
    for (const f of files) {
      const info = await probeMedia(f);
      setProbes((prev) => ({ ...prev, [`${f.name}:${f.size}`]: info }));
      if (!frameTouched && info.width && info.height) {
        setFrameTouched(true);
        setCustomSize({ width: info.width, height: info.height });
      }
    }
  }, [frameTouched]);

  /*
   * What the fetch actually read, derived from the markdown it returned.
   *
   * The card has to show this: a silent "attached" state is exactly what the
   * new screen replaces, and a heading count is the cheapest proof that the
   * right page came back.
   */
  const notionTitle = useMemo(() => {
    const first = (notionContent ?? "").split("\n").map((l) => l.trim()).find(Boolean) ?? "";
    return first.replace(/^#+\s*/, "").slice(0, 80) || null;
  }, [notionContent]);

  const notionCounts = useMemo(() => {
    const lines = (notionContent ?? "").split("\n");
    return {
      headings: lines.filter((l) => /^\s*#{1,6}\s/.test(l)).length,
      bullets: lines.filter((l) => /^\s*[-*•]\s/.test(l)).length,
    };
  }, [notionContent]);

  /*
   * A name the project can have without you typing one.
   *
   * The Notion page title and the snippet name are both better defaults than
   * "Untitled", and the design says the field is "often derivable" — so it is
   * offered as the placeholder and used verbatim if you leave it blank.
   */
  const suggestedName = (() => {
    if (source === "notion" && notionTitle) return notionTitle;
    if (source === "snippet" && selectedSnippetId) {
      return snippets.find((s) => s.id === selectedSnippetId)?.name ?? "";
    }
    if (isFootage && mediaFiles[0]) return mediaFiles[0].name.replace(/\.[^.]+$/, "");
    return "";
  })();

  /** Everything this screen needs to be told before it can create. */
  function ready(): boolean {
    if (isFootage) return mediaFiles.length > 0;
    if (source === "snippet") return Boolean(selectedSnippetId);
    if (source === "notion") return Boolean(notionContent);
    if (source === "script") return cues.length > 0;
    if (source === "artwork") return svgFiles.length > 0;
    return prompt.trim().length > 0;
  }

  function handleClose() {
    // Abort any in-flight upload so the user can't leave one half-running.
    if (currentXhrRef.current) {
      try {
        currentXhrRef.current.abort();
      } catch {}
      currentXhrRef.current = null;
    }
    setName("");
    setPrompt("");
    setNotionUrl("");
    setNotionContent(undefined);
    setScriptWithTimestamps("");
    setSvgFiles([]);
    setMediaFiles([]);
    setSelectedSnippetId(null);
    setSnippetValues({});
    setVideoMode("smarttrim");
    setPhase({ kind: "idle" });
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
        // The fetched page IS the brief now — it lands in the card, editable,
        // rather than in a separate notes box the creator had to know about.
        setNotionContent(data.content);
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

  const isVideo = isFootage;
  const isSmartTrim = isVideo && videoMode === "smarttrim";

  async function handleCreate() {
    if (!ready()) return;
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
    const composeSettings = {
      resolution, orientation, fps,
      // A frame typed by hand (or seeded by the first clip) overrides the
      // preset — the same width/height override getProjectSize reads.
      ...(customSize ? { width: customSize.width, height: customSize.height } : {}),
    };

    /*
     * The target length goes into the brief, because that is where it is
     * actionable: "about 20 seconds" is something the assistant can build to,
     * whereas the composition's own length is decided by what ends up on the
     * timeline. Only added when there is a brief to add it to, and only when
     * the brief doesn't already say how long it should be.
     */
    const briefed = brief;
    const withLength = briefed && targetSeconds && !isVideo && !/\b\d+\s*(s|sec|second)/i.test(briefed)
      ? `${briefed}\n\nTarget length: about ${targetSeconds} seconds.`
      : briefed;
    // "manual" gets one too: the whole point is to land on a timeline with the
    // footage ready and nothing done to it yet.
    const startsAsTimeline = isVideo && (videoMode === "compose" || videoMode === "manual");
    const projectBody = {
      // The name is often derivable — a Notion page title, a snippet, the first
      // clip — so an empty field takes the suggestion rather than refusing.
      name: name.trim() || suggestedName || "Untitled project",
      // SVG is a SOURCE on this screen and a TYPE in the data model.
      animationType: effectiveType,
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
      // The fetched page is the brief (it went in as `initialPrompt` above), so
      // it is also kept as the project's notes for later reference.
      notionContent: notionContent || undefined,
      scriptWithTimestamps: scriptWithTimestamps.trim() || undefined,
      svgContents: svgFiles.length > 0 ? svgFiles : undefined,
      styleMode: isTerminal || isVideo ? undefined : styleMode,
      topicCardStyle: isVideo ? topicCardStyle : undefined,
      transitionStyle: isTerminal || isVideo ? undefined : transitionStyle,
      useSfx: isTerminal ? false : useSfx,
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


  // A fixed, full-screen overlay. This guard is the one whose loss once left
  // the wizard covering the entire app with no way past it.
  if (!open) return null;

  const question = isFootage
    ? { title: "What are we cutting?", sub: "Bring the files in now and they'll be on the timeline when the editor opens." }
    : isTerminal
      ? { title: "What's the recording?", sub: "Describe the commands, the timing and the look — it becomes a tape the tool types out." }
      : { title: "What's the animation?", sub: "Say it however you already have it — in your head, as a snippet, in Notion, or as a script." };

  return (
    <>
    <div
      role="dialog"
      aria-modal="true"
      onKeyDown={(e) => {
        if (e.key === "Escape") handleClose();
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && ready() && !creating) handleCreate();
      }}
      style={{
        position: "fixed", inset: 0, zIndex: 60,
        background: "var(--surface-void)",
        display: "flex", flexDirection: "column",
        animation: "vt-fade-in var(--dur-enter) var(--ease)",
      }}
    >
      {/* ── Header, 56px: what this is, and which kind you are making ───── */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 24, height: 56, flexShrink: 0,
          padding: "0 12px 0 32px", borderBottom: "1px solid var(--border-hairline)",
        }}
      >
        <span className="t-heading" style={{ color: "var(--ink-primary)", flex: "none" }}>New project</span>
        <div style={{ display: "flex", gap: 4, alignSelf: "stretch" }}>
          {(isTerminal
            ? [{ id: "terminal" as AnimationType, label: "Terminal", hint: "A typed-out command recording" }]
            : [
                { id: "animation" as AnimationType, label: "Animation", hint: "The assistant builds the scene" },
                { id: "video" as AnimationType, label: "From footage", hint: "Start with files you already have" },
              ]
          ).map((tab) => {
            const active = animationType === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setAnimationType(tab.id)}
                style={{
                  display: "flex", flexDirection: "column", justifyContent: "center", gap: 2,
                  padding: "0 14px", alignSelf: "stretch", background: "none", border: "none",
                  cursor: "pointer", textAlign: "left",
                  boxShadow: active ? "inset 0 -1px 0 0 var(--ink-primary)" : undefined,
                }}
              >
                <span className="t-control" style={{ color: active ? "var(--ink-primary)" : "var(--ink-tertiary)" }}>
                  {tab.label}
                </span>
                <span style={{ fontSize: 11, color: "var(--ink-disabled)" }}>{tab.hint}</span>
              </button>
            );
          })}
        </div>
        <div style={{ flex: 1 }} />
        <IconButton icon="close" title="Close" onClick={handleClose} />
      </div>

      {/* ── The two columns ──────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
        {/* Left: the one question, and the one input that answers it. */}
        <div
          style={{
            flex: 1, minWidth: 0, minHeight: 0, padding: "40px 44px", overflow: "hidden",
            display: "flex", flexDirection: "column", gap: 24,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <h2 className="t-display" style={{ color: "var(--ink-primary)", margin: 0 }}>{question.title}</h2>
            <p className="t-body" style={{ color: "var(--ink-secondary)", margin: 0 }}>{question.sub}</p>
          </div>

          {/* The source switcher — animation only. Footage has no AI brief to
              source, and the design drops the whole row there. */}
          {!isFootage && !isTerminal && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <span className="t-section" style={{ color: "var(--ink-tertiary)" }}>Source</span>
              <Segmented
                height={28}
                value={source}
                onChange={(v) => setSource(v as Source)}
                options={SOURCES.map((s) => ({ value: s.id, label: s.label }))}
                style={{ width: "fit-content", background: "var(--surface-chrome)" }}
              />
            </div>
          )}

          {/* A · describe (and the terminal script prompt, which is the same
              box with different words). */}
          {(isTerminal || (!isFootage && (source === "describe" || source === "snippet" || source === "artwork"))) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(isTerminal || source === "describe") && (
                <>
                  <div
                    style={{
                      height: 260, padding: "16px 18px", display: "flex", flexDirection: "column",
                      justifyContent: "space-between", background: "var(--surface-chrome)",
                      border: "1px solid var(--border-edge)", borderRadius: "var(--r-panel)",
                      boxShadow: "var(--focus-ring)",
                    }}
                  >
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value.slice(0, 2000))}
                      autoFocus
                      placeholder={isTerminal
                        ? "e.g. Type 'apify actors search instagram', press Enter, show the results. 8 seconds, dark theme, large font."
                        : "A 20-second spot for Innovation Week. Open on the LED wall, cut to hands on a keyboard, land on the Apify wordmark. Confident, not frantic."}
                      className="vt-scroll"
                      style={{
                        flex: 1, width: "100%", resize: "none", border: "none", outline: "none",
                        background: "transparent", color: "var(--ink-primary)",
                        fontSize: 15, lineHeight: 1.6, fontFamily: "inherit",
                      }}
                    />
                    <div style={{ display: "flex", alignItems: "baseline", gap: 12, paddingTop: 12 }}>
                      <span className="t-caption" style={{ color: "var(--ink-tertiary)", flex: 1 }}>
                        The more concrete the beats, the less you&apos;ll re-direct later.
                      </span>
                      <span className="t-data-s" style={{ color: "var(--ink-disabled)" }}>
                        {prompt.length} / 2000
                      </span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <span className="t-caption" style={{ color: "var(--ink-tertiary)" }}>Nothing in mind?</span>
                    {STARTERS.map((s) => (
                      <button
                        key={s.label}
                        onClick={() => setPrompt(s.text)}
                        style={{
                          height: 24, padding: "0 9px", background: "var(--surface-chrome)",
                          border: "1px solid var(--border-hairline)", borderRadius: "var(--r-pill)",
                          color: "var(--ink-secondary)", fontSize: 12, fontWeight: 500, cursor: "pointer",
                        }}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* B · from a snippet — search, six results, and what the selected
              one actually lands as. */}
          {!isFootage && !isTerminal && source === "snippet" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minHeight: 0 }}>
              <Input
                value={snippetQuery}
                onChange={setSnippetQuery}
                autoFocus
                placeholder={`Search ${snippets.length || 22} brand snippets…`}
                prefix={<Icon name="search" size={14} style={{ color: "var(--ink-disabled)" }} />}
                suffix="↑↓ ↵"
                style={{ background: "var(--surface-chrome)" }}
              />
              {/*
                All of them, scrolling.
                The handoff shows six and says the rest are "reachable by
                typing" — but the six sat above a screen of empty space, and a
                list you can only reach by guessing its name is not a list.
              */}
              <div
                className="vt-scroll"
                style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
                  gridAutoRows: "min-content",
                  flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 4,
                }}
              >
                {filteredSnippets.map((s) => {
                  const active = selectedSnippetId === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSnippetId(s.id)}
                      style={{
                        display: "flex", gap: 10, padding: "10px 12px", textAlign: "left",
                        background: active ? "var(--brand-tint-bg)" : "var(--surface-chrome)",
                        border: `1px solid ${active ? "var(--brand)" : "var(--border-hairline)"}`,
                        borderRadius: "var(--r-panel)", cursor: "pointer",
                      }}
                    >
                      {/* Neutral glyphs. The build gave each of the 22 snippets
                          its own hue — 22 arbitrary colours carrying no
                          information. Shape distinguishes them; only the
                          selected card takes brand. */}
                      <Icon
                        name={SNIPPET_ICONS[s.id] ?? "layers"}
                        size={14}
                        style={{ color: active ? "var(--brand)" : "var(--ink-tertiary)", marginTop: 2, flexShrink: 0 }}
                      />
                      <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                        <span className="t-control" style={{ color: "var(--ink-primary)" }}>{s.name}</span>
                        <span className="t-caption" style={{ color: "var(--ink-tertiary)" }}>{s.subtitle}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {selectedSnippet && (
                <div
                  style={{
                    display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", flexShrink: 0,
                    background: "var(--surface-chrome)", border: "1px solid var(--border-edge)",
                    borderRadius: "var(--r-panel)",
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 88, height: 50, flexShrink: 0, background: "var(--surface-void)",
                      border: "1px solid var(--border-hairline)", borderRadius: 2,
                    }}
                  />
                  <span style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 0 }}>
                    <span className="t-control" style={{ color: "var(--ink-primary)" }}>{selectedSnippet.name}</span>
                    <span className="t-caption" style={{ color: "var(--ink-tertiary)" }}>
                      Lands as editable scenes. The assistant can extend it, or you can leave it as-is —
                      its parameters are editable in the editor.
                    </span>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* C · from Notion — and the fetch has to show what it read. A
              silent "attached" state is the thing this replaces. */}
          {!isFootage && !isTerminal && source === "notion" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <Input
                  value={notionUrl}
                  onChange={setNotionUrl}
                  autoFocus
                  mono
                  placeholder="notion.so/apify/…"
                  style={{ flex: 1, background: "var(--surface-chrome)" }}
                  onKeyDown={(e) => { if (e.key === "Enter") void fetchNotion(); }}
                />
                <Button size="form" variant="secondary" onClick={() => void fetchNotion()} disabled={notionLoading || !notionUrl.trim()}>
                  {notionLoading ? "Fetching…" : "Fetch"}
                </Button>
              </div>
              {notionContent && (
                <div
                  style={{
                    padding: "16px 18px", background: "var(--surface-chrome)",
                    border: "1px solid var(--border-edge)", borderRadius: "var(--r-panel)",
                    display: "flex", flexDirection: "column", gap: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon name="check" size={16} style={{ color: "var(--live)" }} />
                    <span style={{ fontSize: 14, fontWeight: 500, color: "var(--ink-primary)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {notionTitle ?? "Fetched page"}
                    </span>
                    <span className="t-data-s" style={{ color: "var(--ink-tertiary)", flexShrink: 0 }}>
                      read {notionCounts.headings} headings, {notionCounts.bullets} bullets
                    </span>
                  </div>
                  <div style={{ height: 1, background: "var(--border-hairline)" }} />
                  <textarea
                    value={notionContent}
                    onChange={(e) => setNotionContent(e.target.value)}
                    className="vt-scroll"
                    style={{
                      height: 200, width: "100%", resize: "none", border: "none", outline: "none",
                      background: "transparent", color: "var(--ink-secondary)",
                      fontSize: 13, lineHeight: 1.5, fontFamily: "inherit",
                    }}
                  />
                  <span className="t-caption" style={{ color: "var(--ink-tertiary)" }}>
                    Editable before you create — this becomes the prompt, not a hidden attachment.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* D · from a script — the readout is the point: it proves the
              timecodes parsed, and it derives the length so you don't set it
              twice. */}
          {!isFootage && !isTerminal && source === "script" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <textarea
                value={scriptWithTimestamps}
                onChange={(e) => setScriptWithTimestamps(e.target.value)}
                autoFocus
                placeholder={"[00:00] Cold open on the LED wall\n[00:04] Hands on a keyboard, mid-build\n[00:09] Stat callout — 314 projects"}
                className="vt-scroll"
                style={{
                  height: 224, padding: "14px 16px", resize: "none",
                  background: "var(--surface-chrome)", border: "1px solid var(--border-edge)",
                  borderRadius: "var(--r-panel)", boxShadow: "var(--focus-ring)",
                  color: "var(--ink-primary)", outline: "none",
                  fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: 1.7,
                }}
              />
              {cues.length > 0 && (
                <div
                  style={{
                    display: "flex", alignItems: "center", gap: 14, padding: "10px 14px",
                    background: "var(--surface-chrome)", border: "1px solid var(--border-edge)",
                    borderRadius: "var(--r-panel)",
                  }}
                >
                  <span
                    className="t-data-s"
                    style={{
                      height: 22, display: "inline-flex", alignItems: "center", padding: "0 10px",
                      background: "var(--surface-raised)", borderRadius: "var(--r-pill)",
                      color: "var(--ink-primary)", flexShrink: 0,
                    }}
                  >
                    {cues.length} {cues.length === 1 ? "scene" : "scenes"}
                  </span>
                  <span style={{ flex: 1, display: "flex", gap: 2, height: 8 }}>
                    {cues.map((c, i) => {
                      const next = i + 1 < cues.length ? cues[i + 1].at : scriptSeconds;
                      const span = Math.max(1, next - c.at);
                      return (
                        <span
                          key={i}
                          title={`${mmss(c.at)} · ${c.text}`}
                          style={{ flex: span, background: "var(--surface-active)", borderRadius: 1 }}
                        />
                      );
                    })}
                  </span>
                  <span className="t-data-s" style={{ color: "var(--ink-tertiary)", flexShrink: 0 }}>
                    last cue {mmss(cues[cues.length - 1].at)} · duration {scriptSeconds}s
                  </span>
                </div>
              )}
              <span className="t-caption" style={{ color: "var(--ink-tertiary)" }}>
                Each timecode becomes a scene boundary, so the assistant paces to your script instead of guessing.
              </span>
            </div>
          )}

          {/* E · from artwork — this app's fifth source. An SVG is another way
              to brief an animation, so it sits with the other three rather
              than becoming a third kind. */}
          {!isFootage && !isTerminal && source === "artwork" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minHeight: 0 }}>
              <label
                style={{
                  height: 168, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center",
                  justifyContent: "center", gap: 10, background: "var(--surface-chrome)",
                  border: "1px dashed var(--border-edge)", borderRadius: "var(--r-panel)",
                  cursor: "pointer",
                }}
              >
                <Icon name="upload" size={22} style={{ color: "var(--ink-disabled)" }} />
                <span style={{ fontSize: 14, fontWeight: 500, color: "var(--ink-primary)" }}>Drop SVG artwork here</span>
                <span className="t-caption" style={{ color: "var(--ink-tertiary)" }}>
                  Each file becomes a layer the assistant can animate
                </span>
                <input
                  type="file"
                  accept=".svg,image/svg+xml"
                  multiple
                  hidden
                  onChange={async (e) => {
                    const picked = Array.from(e.target.files ?? []);
                    e.target.value = "";
                    const read = await Promise.all(picked.map(async (f) => ({ filename: f.name, content: await f.text() })));
                    setSvgFiles((prev) => [...prev, ...read]);
                  }}
                />
              </label>
              {svgFiles.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minHeight: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline" }}>
                    <span className="t-section" style={{ color: "var(--ink-tertiary)" }}>Ready to import</span>
                    <div style={{ flex: 1 }} />
                    <span className="t-data-s" style={{ color: "var(--ink-tertiary)" }}>
                      {svgFiles.length} {svgFiles.length === 1 ? "file" : "files"}
                    </span>
                  </div>
                  <div
                    className="vt-scroll"
                    style={{
                      flex: 1, minHeight: 0, overflowY: "auto", background: "var(--surface-chrome)",
                      border: "1px solid var(--border-hairline)", borderRadius: "var(--r-panel)",
                    }}
                  >
                    {svgFiles.map((f, i) => (
                      <div
                        key={`${f.filename}:${i}`}
                        style={{
                          display: "flex", alignItems: "center", gap: 12, height: 48, padding: "0 12px",
                          borderBottom: i < svgFiles.length - 1 ? "1px solid var(--border-hairline)" : undefined,
                        }}
                      >
                        <Icon name="image" size={14} style={{ color: "var(--ink-tertiary)" }} />
                        <span className="t-control" style={{ color: "var(--ink-primary)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {f.filename}
                        </span>
                        <IconButton
                          icon="close" size={24} title="Remove"
                          onClick={() => setSvgFiles((prev) => prev.filter((_, j) => j !== i))}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <Textarea
                value={prompt}
                onChange={setPrompt}
                rows={3}
                placeholder="How should it move? e.g. the logo draws in, then the tagline rises under it."
              />
            </div>
          )}

          {/* F · from footage — no source switcher, because there is no brief
              to source. */}
          {isFootage && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24, flex: 1, minHeight: 0 }}>
              <label
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  void addFiles(Array.from(e.dataTransfer.files));
                }}
                style={{
                  height: 168, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center",
                  justifyContent: "center", gap: 10,
                  background: dragActive ? "var(--surface-raised)" : "var(--surface-chrome)",
                  border: `1px dashed ${dragActive ? "var(--ink-primary)" : "var(--border-edge)"}`,
                  borderRadius: "var(--r-panel)", cursor: "pointer",
                  transition: "background var(--dur-state) var(--ease), border-color var(--dur-state) var(--ease)",
                }}
              >
                <Icon name="upload" size={22} style={{ color: "var(--ink-disabled)" }} />
                <span style={{ fontSize: 14, fontWeight: 500, color: "var(--ink-primary)" }}>Drop footage here</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      height: 28, display: "inline-flex", alignItems: "center", padding: "0 12px",
                      background: "var(--surface-raised)", border: "1px solid var(--border-edge)",
                      borderRadius: "var(--r-control)", color: "var(--ink-primary)",
                      fontSize: 13, fontWeight: 500,
                    }}
                  >
                    Browse…
                  </span>
                  <span className="t-data-s" style={{ color: "var(--ink-disabled)" }}>⌘I</span>
                </span>
                <input
                  type="file"
                  accept="video/*,audio/*,image/*"
                  multiple
                  hidden
                  onChange={(e) => {
                    const picked = Array.from(e.target.files ?? []);
                    e.target.value = "";
                    void addFiles(picked);
                  }}
                />
              </label>

              {mediaFiles.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minHeight: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline" }}>
                    <span className="t-section" style={{ color: "var(--ink-tertiary)" }}>Ready to import</span>
                    <div style={{ flex: 1 }} />
                    <span className="t-data-s" style={{ color: "var(--ink-tertiary)" }}>
                      {mediaFiles.length} {mediaFiles.length === 1 ? "file" : "files"} ·{" "}
                      {formatBytes(mediaFiles.reduce((s, f) => s + f.size, 0))}
                    </span>
                  </div>
                  <div
                    className="vt-scroll"
                    style={{
                      flex: 1, minHeight: 0, overflowY: "auto", background: "var(--surface-chrome)",
                      border: "1px solid var(--border-hairline)", borderRadius: "var(--r-panel)",
                    }}
                  >
                    {mediaFiles.map((f, i) => {
                      const info = probes[`${f.name}:${f.size}`] ?? {};
                      const meta = [
                        info.width && info.height ? `${info.width}×${info.height}` : f.type.split("/")[0] || "file",
                        info.seconds ? hhmmss(info.seconds) : null,
                        formatBytes(f.size),
                      ].filter(Boolean).join(" · ");
                      return (
                        <div
                          key={`${f.name}:${f.size}:${i}`}
                          style={{
                            display: "flex", alignItems: "center", gap: 12, height: 48, padding: "0 12px",
                            borderBottom: i < mediaFiles.length - 1 ? "1px solid var(--border-hairline)" : undefined,
                          }}
                        >
                          <span
                            aria-hidden
                            style={{
                              width: 48, height: 27, flexShrink: 0, background: "var(--surface-void)",
                              border: "1px solid var(--border-hairline)", borderRadius: 2,
                            }}
                          />
                          <span style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
                            <span className="t-control" style={{ color: "var(--ink-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {f.name}
                            </span>
                            <span className="t-data-s" style={{ color: "var(--ink-tertiary)" }}>{meta}</span>
                          </span>
                          <IconButton
                            icon="close" size={24} title="Remove"
                            onClick={() => setMediaFiles((prev) => prev.filter((_, j) => j !== i))}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <span className="t-caption" style={{ color: "var(--ink-tertiary)" }}>
                    The first clip&apos;s dimensions set the frame — override it on the right if you need to.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right panel, 396px: the settings, not the work. */}
        <div
          style={{
            width: 396, flexShrink: 0, display: "flex", flexDirection: "column",
            background: "var(--surface-chrome)", borderLeft: "1px solid var(--border-edge)",
          }}
        >
          {/* 1 · The frame preview. The ONLY summary of the frame — the box's
              ratio tracks the preset, so the shape is the readout. */}
          <div style={{ flexShrink: 0, padding: 20, borderBottom: "1px solid var(--border-hairline)", display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              style={{
                width: "100%", aspectRatio: `${size.width} / ${size.height}`, maxHeight: 220,
                margin: "0 auto", position: "relative", background: "var(--surface-void)",
                border: "1px solid var(--border-hairline)", borderRadius: 2,
                display: "grid", placeItems: "center",
              }}
            >
              <span style={{ position: "absolute", inset: 16, border: "1px dashed var(--border-hairline)" }} />
              <span className="t-data-s" style={{ color: "var(--ink-disabled)" }}>safe area</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span className="t-control" style={{ color: "var(--ink-primary)", flex: 1 }}>
                {preset?.label ?? "Custom"}
              </span>
              <span className="t-data-m" style={{ color: "var(--ink-secondary)" }}>
                {size.width}×{size.height} · {fps} fps · {targetSeconds || 0}s
              </span>
            </div>
          </div>

          {/* 2 · SHAPE — hard to change later, and said so. */}
          <PanelSection label="Shape" qualifier="hard to change later" open={shapeOpen} onToggle={() => setShapeOpen((v) => !v)}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 4 }}>
              {FRAME_PRESETS.map((p) => {
                const dims = getResolution(p.orientation, p.resolution);
                const active = !customSize && orientation === p.orientation && resolution === p.resolution;
                // Fit the real ratio into a 40×26 box — the point of showing a
                // shape is that it IS the shape, so nothing is hardcoded.
                const scale = Math.min(40 / dims.width, 26 / dims.height);
                const w = Math.round(dims.width * scale);
                const h = Math.round(dims.height * scale);
                return (
                  <button
                    key={p.label}
                    onClick={() => {
                      setOrientation(p.orientation);
                      setResolution(p.resolution);
                      setCustomSize(null);
                      setFrameTouched(true);
                    }}
                    title={`${p.label} · ${dims.width}×${dims.height}`}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                      padding: "8px 4px 7px", borderRadius: "var(--r-control)",
                      background: active ? "var(--surface-raised)" : "var(--surface-chrome)",
                      border: `1px solid ${active ? "var(--ink-primary)" : "var(--border-hairline)"}`,
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ height: 26, display: "grid", placeItems: "center" }}>
                      <span
                        style={{
                          display: "block",
                          width: w, height: h,
                          border: `1px solid ${active ? "var(--ink-primary)" : "var(--border-edge)"}`,
                          borderRadius: 1,
                        }}
                      />
                    </span>
                    <span className="t-data-s" style={{ color: "var(--ink-secondary)" }}>{p.ratio}</span>
                  </button>
                );
              })}
            </div>

            <PanelRow label="Frame">
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Input
                  height={24} mono value={String(size.width)}
                  onChange={(v) => { setFrameTouched(true); setCustomSize({ width: Number(v) || 0, height: size.height }); }}
                  style={{ flex: 1, minWidth: 0 }}
                />
                <span className="t-data-s" style={{ color: "var(--ink-disabled)" }}>×</span>
                <Input
                  height={24} mono value={String(size.height)}
                  onChange={(v) => { setFrameTouched(true); setCustomSize({ width: size.width, height: Number(v) || 0 }); }}
                  style={{ flex: 1, minWidth: 0 }}
                />
              </span>
            </PanelRow>

            <PanelRow label="Rate">
              <Segmented
                height={22}
                value={fps}
                onChange={(v) => setFps(v as FPS)}
                options={[24, 25, 30, 50].map((r) => ({ value: r, label: String(r) }))}
                stretch
              />
            </PanelRow>

            <PanelRow label="Length">
              {/* Seconds, not timecode: here the number is a brief, not a
                  measurement. A script derives it. */}
              <Input
                height={24} mono
                value={targetSeconds}
                onChange={(v) => setTargetSeconds(v.replace(/[^0-9]/g, "").slice(0, 4))}
                disabled={source === "script" && cues.length > 0}
                suffix="seconds"
              />
            </PanelRow>
          </PanelSection>

          {/* 3 · LOOK — animation only. There is no AI style to set on a cut. */}
          {!isFootage && (
            <PanelSection label="Look" qualifier="safe defaults" open={lookOpen} onToggle={() => setLookOpen((v) => !v)}>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <span className="t-control" style={{ color: "var(--ink-secondary)", flex: 1 }}>Style</span>
                  <button
                    onClick={() => setStylePreviewOpen(true)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5, height: 20, padding: 0,
                      background: "none", border: "none", cursor: "pointer",
                      color: "var(--ink-secondary)", fontSize: 12, fontWeight: 500,
                    }}
                  >
                    <Icon name="play" size={11} />
                    Preview
                  </button>
                </div>
                <Segmented
                  height={22}
                  value={styleMode}
                  onChange={(v) => setStyleMode(v as StyleMode)}
                  options={STYLE_MODES.map((m) => ({ value: m.id, label: m.label }))}
                  stretch
                />
                <span className="t-data-s" style={{ color: "var(--ink-tertiary)" }}>
                  {firstSentence(STYLE_MODES.find((m) => m.id === styleMode)?.description)}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <span className="t-control" style={{ color: "var(--ink-secondary)" }}>Transition</span>
                <Segmented
                  height={22}
                  value={transitionStyle}
                  onChange={(v) => setTransitionStyle(v as TransitionStyle)}
                  options={TRANSITION_MODES.map((m) => ({ value: m.id, label: m.label }))}
                  stretch
                />
                <span className="t-data-s" style={{ color: "var(--ink-tertiary)" }}>
                  {firstSentence(TRANSITION_MODES.find((m) => m.id === transitionStyle)?.description)}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center" }}>
                <span className="t-control" style={{ color: "var(--ink-secondary)", flex: 1 }}>Sound effects</span>
                <Segmented
                  height={22}
                  value={useSfx ? "on" : "off"}
                  onChange={(v) => setUseSfx(v === "on")}
                  options={[{ value: "on", label: "On" }, { value: "off", label: "Off" }]}
                />
              </div>
            </PanelSection>
          )}

          {/* 3b · FIRST PASS — footage only, and this app's own. The design
              drops it; keeping it here rather than in the left column keeps it
              a setting, which is what it is. */}
          {isFootage && (
            <PanelSection label="First pass" qualifier="changeable in Tools" open={lookOpen} onToggle={() => setLookOpen((v) => !v)}>
              <Segmented
                height={22}
                value={videoMode}
                onChange={(v) => setVideoMode(v as VideoMode)}
                options={[
                  { value: "smarttrim", label: "Smart trim" },
                  { value: "compose", label: "Compose" },
                  { value: "manual", label: "I'll cut it" },
                ]}
                stretch
              />
              <span className="t-data-s" style={{ color: "var(--ink-tertiary)", lineHeight: 1.5 }}>
                {videoMode === "smarttrim"
                  ? "Cuts the silences and filler words out of your footage."
                  : videoMode === "compose"
                    ? "The assistant edits from your footage and notes."
                    : "Imports the footage and leaves the timeline alone."}
              </span>
            </PanelSection>
          )}

          <div style={{ flex: 1, minHeight: 0 }} />

          {/* 5 · The least interesting decisions, last. */}
          <div style={{ flexShrink: 0, padding: 12, borderTop: "1px solid var(--border-hairline)", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <span className="t-control" style={{ color: "var(--ink-secondary)" }}>Name</span>
              <Input value={name} onChange={setName} placeholder={suggestedName || "Untitled project"} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <span className="t-control" style={{ color: "var(--ink-secondary)" }}>Collection</span>
              <select
                value={collectionId}
                onChange={(e) => setCollectionId(e.target.value)}
                style={{
                  width: "100%", height: 32, padding: "0 10px",
                  background: "var(--surface-raised)", border: "1px solid var(--border-hairline)",
                  borderRadius: "var(--r-control)", color: "var(--ink-primary)",
                  fontSize: 14, cursor: "pointer",
                }}
              >
                <option value="">None</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer, 72px: the consequence, then the one action ───────────── */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 24, height: 72, flexShrink: 0,
          padding: "0 32px", background: "var(--surface-chrome)",
          borderTop: "1px solid var(--border-hairline)",
        }}
      >
        <span className="t-body" style={{ color: "var(--ink-tertiary)" }}>
          Opens in{" "}
          <span style={{ color: "var(--ink-primary)" }}>{isFootage ? "Cut" : "Direct"}</span>
          {isFootage ? " · ⌥2 switches to Direct" : " · ⌥1 switches to Cut"}
        </span>
        <div style={{ flex: 1 }} />
        <Button variant="ghost" size="dialog" onClick={handleClose}>Cancel</Button>
        <Button variant="primary" size="dialog" onClick={handleCreate} disabled={!ready() || creating}>
          {creating ? "Creating…" : isFootage ? "Create project" : isTerminal ? "Create recording" : "Create animation"}
        </Button>
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
    <StylePreviewModal
      open={stylePreviewOpen}
      onClose={() => setStylePreviewOpen(false)}
      selected={styleMode}
      onSelect={(m) => setStyleMode(m)}
    />
    </>
  );
}
