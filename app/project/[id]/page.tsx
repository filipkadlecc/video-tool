"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import GeneratingOverlay from "@/components/GeneratingOverlay";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import ChatPanel, { type ChatPanelHandle } from "@/components/ChatPanel";
import type { DocChange } from "@/lib/editor-agent";
import AssetBrowser from "@/components/AssetBrowser";
import PromptAnimationDialog from "@/components/PromptAnimationDialog";
import SnippetBrowser from "@/components/SnippetBrowser";
import SmartTrimDialog from "@/components/SmartTrimDialog";
import AnalyzeDialog from "@/components/AnalyzeDialog";
import FirstPassProgress, { type FirstPassState } from "@/components/FirstPassProgress";
import ExportFlow from "@/components/ExportFlow";
import TerminalPreview from "@/components/TerminalPreview";
import ConvertAspectRatioButton from "@/components/ConvertAspectRatioButton";
import { evalSceneCode } from "@/remotion/DynamicScene";
import { sceneFramesAtFps } from "@/lib/scene-eval";
import type { Project, ChatMessage, TerminalAnnotations, StyleMode, TopicCardStyle, TransitionStyle } from "@/lib/types";
import { normalizeAnimationType } from "@/lib/animation-types";
import { getProjectSize } from "@/lib/types";
import { buildTerminalExportPlan } from "@/lib/terminal-export";
import { stripBackgroundsForTransparency } from "@/lib/transparent-bg";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import IconButton from "@/components/ui/IconButton";
import Segmented from "@/components/ui/Segmented";
import Tabs from "@/components/ui/Tabs";
import { useCodeHistory } from "@/hooks/useCodeHistory";
import { useDocHistory } from "@/hooks/useDocHistory";
import { addItem, addTrack, docDuration, docFromScene, emptyDoc, findItem, fitSceneItem, fullFrameLayout, makeId, retimeSceneCode, splitItem, trackWithRoomAt, updateItem, type EditorDoc, type SceneItem , migrateDoc } from "@/lib/editor-doc";
import { docFromComposition, docFromCutPlan, docFromVideoEdit, suspiciousSegments } from "@/lib/editor-import";
import { Group, Panel, Separator, useDefaultLayout } from "react-resizable-panels";
import type { PanelImperativeHandle } from "react-resizable-panels";
import type { PlayerRef } from "@remotion/player";
import { useToast } from "@/components/ui/Toast";
import { PlayheadContext, useNewPlayheadStore } from "@/hooks/usePlayhead";
import Tooltip from "@/components/ui/Tooltip";
import ShortcutsModal from "@/components/ShortcutsModal";

const titleCase = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);

const EditorPreview = dynamic(() => import("@/components/EditorPreview"), {
  ssr: false,
  loading: () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--ink-tertiary)", fontSize: 13 }}>
      Loading preview...
    </div>
  ),
});

const DocTimeline = dynamic(() => import("@/components/DocTimeline"), { ssr: false });
const TimelineStrip = dynamic(() => import("@/components/TimelineStrip"), { ssr: false });
const CodeModeScreen = dynamic(() => import("@/components/CodeModeScreen"), { ssr: false });
const EditorInspector = dynamic(() => import("@/components/EditorInspector"), { ssr: false });
const FootageBrowser = dynamic(() => import("@/components/FootageBrowser"), { ssr: false });
const EffectsPanel = dynamic(() => import("@/components/EffectsPanel"), { ssr: false });
const SnippetEditDialog = dynamic(() => import("@/components/SnippetEditDialog"), { ssr: false });

const PreviewPanel = dynamic(() => import("@/components/PreviewPanel"), {
  ssr: false,
  loading: () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--ink-tertiary)", fontSize: 13 }}>
      Loading preview...
    </div>
  ),
});



const CodeEditor = dynamic(() => import("@/components/CodeEditor"), {
  ssr: false,
  loading: () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--ink-tertiary)", fontSize: 13 }}>
      Loading editor...
    </div>
  ),
});

const SAVE_LABEL = { saved: "SAVED", unsaved: "UNSAVED", saving: "SAVING", error: "UNSAVED" } as const;
const SAVE_DOT = {
  saved: "var(--brand)",
  unsaved: "var(--ink-disabled)",
  saving: "var(--warning)",
  error: "var(--danger)",
} as const;
const SAVE_TITLE = {
  saved: "All changes saved",
  unsaved: "Unsaved changes — saving shortly",
  saving: "Saving…",
  error: "Could not save — your last change is still only in this tab",
} as const;

export default function ProjectEditor() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [code, setCode] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [terminalAnnotations, setTerminalAnnotations] = useState<TerminalAnnotations | undefined>(undefined);
  const [customTheme, setCustomTheme] = useState<boolean>(false);
  const [styleMode, setStyleMode] = useState<StyleMode>("default");
  const [topicCardStyle, setTopicCardStyle] = useState<TopicCardStyle>("cards");
  const [transitionStyle, setTransitionStyle] = useState<TransitionStyle>("cut");
  const [useSfx, setUseSfx] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [snippetsOpen, setSnippetsOpen] = useState(false);
  const [smartTrimOpen, setSmartTrimOpen] = useState(false);
  const [analyzeOpen, setAnalyzeOpen] = useState(false);
  // Automatic first-pass (analyze → smart-trim/compose) progress, for fresh video projects.
  const [firstPass, setFirstPass] = useState<FirstPassState | null>(null);
  // Video editor "Tools ▾" dropdown (Analyze / Smart trim / Snippets / Assets).
  const [toolsOpen, setToolsOpen] = useState(false);
  const [promptAnimOpen, setPromptAnimOpen] = useState(false);
  const toolsRef = useRef<HTMLDivElement>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [bgRemovedFlash, setBgRemovedFlash] = useState(false);
  const [loading, setLoading] = useState(true);
  // Captured once on mount from ?action=, before we clean the URL via router.replace.
  const [initialAutoAction] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("action");
  });

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<{ code: string; chatLength: number; annotations: string; styleMode: StyleMode }>({ code: "", chatLength: 0, annotations: "", styleMode: "default" });
  // Drives the toolbar indicator. The autosave effect below already knows
  // whether anything differs from what was last written — this just surfaces it
  // instead of the badge claiming "SAVED" unconditionally.
  const [saveState, setSaveState] = useState<"saved" | "unsaved" | "saving" | "error">("saved");
  const codeHistory = useCodeHistory();
  // The editor document. When present it is the source of truth for the video
  // and this project opens in the visual editor instead of the code editor.
  const toast = useToast();
  const [doc, setDoc] = useState<EditorDoc | undefined>(undefined);
  const docHistory = useDocHistory();
  const [docMedia, setDocMedia] = useState<{ name: string; path: string; type: string }[]>([]);
  const [docMediaDurations, setDocMediaDurations] = useState<Record<string, number>>({});
  const lastSavedDocRef = useRef<string>("");
  // Which editor is on screen for a project that HAS a document. Purely a view
  // toggle — switching back to code destroys nothing, so trying the editor is
  // never a one-way door.
  const [showCodeEditor, setShowCodeEditor] = useState(false);
  // Shared by the canvas, the timeline and the inspector.
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  // Which tab each panel is showing while the visual editor is open. Code-first
  // projects keep the old single-purpose panels.
  const [bottomTab, setBottomTab] = useState<"footage" | "assets" | "snippets" | "effects">("footage");
  const [rightTab, setRightTab] = useState<"chat" | "properties">("chat");

  /**
   * Cut (timeline-first) vs Direct (chat-first), the Premiere-style workspaces.
   *
   * Remembered PER PROJECT — a footage cut and a prompted animation want
   * different rooms, and the kind you made decides where it opens.
   *
   * Switching must NOT move the document: playhead, selection, zoom, scroll and
   * undo history all carry across untouched. That is why the switch resizes the
   * existing panels imperatively instead of rendering a different tree —
   * nothing unmounts, so nothing has state to lose.
   */
  const [workspace, setWorkspace] = useState<"cut" | "direct">("cut");
  const workspaceKey = `vt:workspace:${projectId}`;

  /**
   * In / out points — the range you actually want out of a longer edit.
   *
   * Editorial state rather than document state: it changes what you EXPORT and
   * what the transport reads out, but it is not part of the composition, and
   * putting it in the document would mean a schema change and a migration for
   * something that is really a view preference. Persisted per project so it
   * survives a reload, the same way the workspace is.
   */
  const [range, setRange] = useState<{ in: number | null; out: number | null }>({ in: null, out: null });

  /**
   * The last AI edit, as a reviewable list.
   *
   * It lives HERE, not in ChatPanel, because the chat column is unmounted the
   * moment you switch to Cut or open Properties — and the moment you most want
   * to know what the model changed is when you go and look at the timeline it
   * changed. Held by the page, the same receipt survives the trip and arrives
   * in Cut as a toast with the same three actions.
   */
  const [aiEdit, setAiEdit] = useState<DocChange[] | null>(null);

  /**
   * Direct's timeline: the collapsed strip, or the full one at 428px.
   *
   * Direct only — Cut's timeline is always the full one, and its own Expand is
   * about the property lanes rather than about the panel.
   */
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const rangeKey = `vt:range:${projectId}`;
  const rightPanelRef = useRef<PanelImperativeHandle | null>(null);
  const timelinePanelRef = useRef<PanelImperativeHandle | null>(null);
  const railPanelRef = useRef<PanelImperativeHandle | null>(null);
  const [editingSnippetId, setEditingSnippetId] = useState<string | null>(null);
  const chatRef = useRef<ChatPanelHandle>(null);
  // Bounds automatic error-retry so a persistently-broken generation can't loop
  // the model forever. Reset to 0 whenever a generation lands with no error.
  const autoRetryRef = useRef(0);

  // Synced playhead: the timeline drives / follows the preview <Player>.
  const playerRef = useRef<PlayerRef | null>(null);
  // The playhead lives in a store, not in page state: a rAF setState here
  // re-rendered this entire 1,460-line component on every frame of playback.
  const playhead = useNewPlayheadStore();

  // Load project
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        if (!res.ok) {
          router.push("/");
          return;
        }
        const data: Project = await res.json();
        setProject(data);
        setCode(data.code);
        setChatHistory(data.chatHistory);
        // Seed version history with the loaded state so the first generation
        // can be undone back to it (code + chat together).
        codeHistory.pushSnapshot(data.code, data.chatHistory);
        if (data.doc) {
          // The one place migration runs. A v1 document is already a valid v2
          // document, so this only folds the two legacy animation slots into
          // the effect list — and returns the SAME object when there is nothing
          // to do, so merely opening a project never dirties it into a save.
          const migrated = migrateDoc(data.doc);
          setDoc(migrated);
          docHistory.pushSnapshot(migrated);
          lastSavedDocRef.current = JSON.stringify(migrated);
        }
        setTerminalAnnotations(data.terminalAnnotations);
        setCustomTheme(Boolean(data.customTheme));
        setStyleMode(data.styleMode ?? "default");
        setTopicCardStyle(data.topicCardStyle ?? "cards");
        setTransitionStyle(data.transitionStyle ?? "cut");
        setUseSfx(data.useSfx ?? data.animationType !== "terminal");
        lastSavedRef.current = {
          code: data.code,
          chatLength: data.chatHistory.length,
          annotations: JSON.stringify(data.terminalAnnotations ?? null),
          styleMode: data.styleMode ?? "default",
        };
      } catch {
        router.push("/");
      } finally {
        setLoading(false);
      }
    }
    load();
    // codeHistory is intentionally omitted — the hook returns a fresh object
    // each render, so including it would re-run this loader (and re-fetch) every
    // render. Its methods are stable, so calling pushSnapshot here is safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, router]);

  // Honor ?action=smarttrim|compose once: run the automatic first pass
  // (analyze every clip → build the first cut) with a visible progress panel,
  // then clean the URL. Replaces the old "open the Smart Trim dialog" behavior.
  const consumedActionRef = useRef(false);
  useEffect(() => {
    if (consumedActionRef.current) return;
    if (loading || !project) return;
    const action = searchParams.get("action");
    if (action !== "smarttrim" && action !== "compose") return;
    if (project.animationType !== "video") return;
    // A timeline-native project has no code at all, so the old `project.code`
    // test would have let the first pass re-run on every single load.
    if (project.code || (project.doc?.tracks.some((t) => t.items.length) ?? false)) return; // already built
    consumedActionRef.current = true;
    router.replace(`/project/${projectId}`);
    void runFirstPass(action);
    // runFirstPass is a stable inner fn; deps intentionally minimal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, project, projectId, router, searchParams]);

  // Drive one analyze SSE request, mapping stages to a friendly label.
  async function analyzeOne(mediaFile: string, onStage: (label: string) => void) {
    const res = await fetch(`/api/media/${projectId}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mediaFile }),
    });
    if (!res.ok || !res.body) throw new Error(`Analyze failed (HTTP ${res.status})`);
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
        let d: Record<string, unknown>;
        try { d = JSON.parse(payload); } catch { continue; }
        const stage = d.stage as string | undefined;
        const status = d.status as string | undefined;
        // Auto-reframe is best-effort — if it fails, note it and keep going
        // (the cut still builds from the original clips). Only genuinely fatal
        // errors (probe/transcript, or a top-level error) abort the first pass.
        if (stage === "reframe" && status === "error") { onStage("Auto-reframe unavailable — using original clips"); continue; }
        if (d.error) throw new Error(String(d.error));
        if (stage === "probe") onStage("Reading the video…");
        else if (stage === "scenes") onStage(status === "progress" ? `Finding scene cuts… ${Math.round(Number(d.progress || 0) * 100)}%` : "Finding scene cuts…");
        else if (stage === "transcript") onStage("Transcribing…");
        else if (stage === "reframe") onStage("Auto-reframing to the timeline aspect…");
      }
    }
  }

  // Smart-trim first pass: transcribe-driven silence/filler cut on the primary clip.
  async function buildSmartTrim(files: { path: string }[]) {
    const primary = files[0];
    const tRes = await fetch(`/api/transcribe/${projectId}?mediaFile=${encodeURIComponent(primary.path)}`).then((r) => r.json());
    const transcript = tRes.transcript;
    if (!transcript) throw new Error("No transcript available to trim");
    // Prefer the auto-reframed clip if one exists (same timeline as the source).
    const st = await fetch(`/api/media/${projectId}/analyze?mediaFile=${encodeURIComponent(primary.path)}`).then((r) => r.json());
    const srcName = st.reframed || primary.path;
    const mediaSrc = `/api/media/${projectId}/${srcName}`;
    const cp = await fetch(`/api/cut-plan/${projectId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript, generate: { mediaSrc, fps: extractedFps } }),
    }).then((r) => r.json());
    if (!cp.ok) throw new Error(cp.error || "Cut plan failed");

    // Land the cut on the TIMELINE. The same plan used to become one <Series> of
    // hard-coded trims — a finished artefact you could regenerate but not edit.
    // As a document every kept range is a clip you can drag, retrim or delete.
    const size = { width, height, fps: extractedFps };
    const asDoc = docFromCutPlan(cp.plan, size, mediaSrc, { name: srcName });
    if (asDoc) {
      commitDoc(asDoc);
      return;
    }
    // Nothing survived the plan (or it came back empty) — fall back to the code
    // path rather than leaving the project with nothing at all.
    if (!cp.code) throw new Error("Cut plan produced no ranges");
    commitComposition(cp.code);
  }

  // Compose means two different things depending on what is already there:
  // assemble a cut from nothing, or add to one that exists. Both the menu label
  // and the prompt follow that, so re-running it can never wipe a cut.
  const docHasContent = !!doc?.tracks.some((t) => t.items.length > 0);
  const composeLabel = docHasContent ? "Compose into this cut" : "Compose (re-run)";

  async function runFirstPass(mode: "smarttrim" | "compose") {
    // Editorial notes can live in the notes box (notionContent) or the prompt box
    // (initialPrompt). The generate route falls back across both; here we just
    // detect whether ANY were attached, to drive the visible signal + prompt.
    const initP = project?.initialPrompt?.trim();
    const hasNotes = !!project?.notionContent?.trim() || !!(initP && initP !== "Edit uploaded footage");
    try {
      const list = await fetch(`/api/media/${projectId}/list`).then((r) => r.json());
      const files: { name: string; path: string; type: string }[] = (list.files ?? []).filter(
        (f: { type: string }) => f.type === "video" || f.type === "audio"
      );
      if (files.length === 0) {
        setFirstPass({ mode, status: "error", fileCount: 0, fileIndex: 0, fileName: "", stageLabel: "", notesAttached: hasNotes, error: "No footage found to analyze. Add media, then re-run from Tools → Analyze." });
        return;
      }
      setFirstPass({ mode, status: "analyzing", fileCount: files.length, fileIndex: 1, fileName: files[0].name, stageLabel: "Starting…", notesAttached: hasNotes });

      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setFirstPass((s) => (s ? { ...s, fileIndex: i + 1, fileName: f.name, stageLabel: "Analyzing…" } : s));
        await analyzeOne(f.path, (label) => setFirstPass((s) => (s ? { ...s, stageLabel: label } : s)));
      }

      setFirstPass((s) => (s ? { ...s, status: "building", stageLabel: mode === "smarttrim" ? "Cutting silences + fillers…" : "Writing the first cut…" } : s));
      if (mode === "smarttrim") {
        await buildSmartTrim(files);
        setFirstPass(null);
      } else {
        setFirstPass(null); // hand off to the AI chat's own generating UI
        // Two prompts, because the two paths ask for different things. With a
        // timeline open the chat routes to /api/edit-doc and ASSEMBLES; without
        // one it writes a scene file, as it always has.
        const notesLine = hasNotes
          ? "Follow my editorial notes: keep the highlighted passages and honour the inline comments."
          : "No editorial notes were attached — use your judgment about what is worth keeping.";
        const prompt = doc
          ? (docHasContent
              ? `Build on the cut that is already on the timeline — do not start it over. ${notesLine}\n\n` +
                "Keep every clip and card that is there; the arrangement is deliberate. Read the sources' transcripts to find passages worth ADDING, place them with sequence_media where they belong, and add a branded card only where one is genuinely missing. Render a few frames when you're done and fix anything that reads badly."
              : `Assemble a first cut on the timeline. ${notesLine}\n\n` +
                "Work in this order: read each source's transcript to find the passages worth using, lay them out in order with sequence_media, then put a branded card between the sections and an end card on the finish. Choose passages that are self-contained — start on a complete thought, end before the next one begins — and prefer an auto-reframed version of a clip where one exists. Render a few frames when you're done and fix anything that reads badly.")
          : hasNotes
            ? "Build a first cut from my editorial notes: keep the highlighted passages, follow the inline comments, and structure it into topic segments. Ground every cut in the transcript timestamps and scene cuts. If an auto-reframed version of a clip is available, use it."
            : "Build a strong first cut from the transcript and scene cuts: pick the most compelling, self-contained moments and assemble them cleanly. (No editorial notes were attached — use your judgment.) If an auto-reframed version of a clip is available, use it.";
        chatRef.current?.runWithPrompt(prompt);
      }
    } catch (err) {
      setFirstPass((s) => ({ mode, status: "error", fileCount: s?.fileCount ?? 0, fileIndex: s?.fileIndex ?? 0, fileName: s?.fileName ?? "", stageLabel: "", error: err instanceof Error ? err.message : "First pass failed" }));
    }
  }

  // Close the Tools dropdown on an outside click.
  useEffect(() => {
    if (!toolsOpen) return;
    function onClick(e: MouseEvent) {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) setToolsOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [toolsOpen]);

  // Auto-save with 2s debounce
  useEffect(() => {
    if (!project) return;
    const annotationsKey = JSON.stringify(terminalAnnotations ?? null);
    const hasCodeChanged = code !== lastSavedRef.current.code;
    const hasChatChanged = chatHistory.length !== lastSavedRef.current.chatLength;
    const hasAnnotationsChanged = annotationsKey !== lastSavedRef.current.annotations;
    const hasStyleChanged = styleMode !== lastSavedRef.current.styleMode;
    const docKey = doc ? JSON.stringify(doc) : "";
    const hasDocChanged = docKey !== lastSavedDocRef.current;
    if (!hasCodeChanged && !hasChatChanged && !hasAnnotationsChanged && !hasStyleChanged && !hasDocChanged) return;

    setSaveState("unsaved");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaveState("saving");
      try {
        const res = await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, chatHistory, styleMode, ...(terminalAnnotations !== undefined ? { terminalAnnotations } : {}), ...(doc ? { doc } : {}) }),
        });
        if (!res.ok) throw new Error(String(res.status));
        lastSavedRef.current = { code, chatLength: chatHistory.length, annotations: annotationsKey, styleMode };
        lastSavedDocRef.current = docKey;
        setSaveState("saved");
      } catch {
        // Left visible rather than silent: a save that failed used to still
        // read as "SAVED", which is the worst possible thing for this badge.
        setSaveState("error");
      }
    }, 2000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [code, chatHistory, terminalAnnotations, styleMode, doc, project, projectId]);

  // Toggle customTheme with an immediate PATCH so the next AI request reads
  // the new value (the debounced save would race against fast chat sends).
  const handleCustomThemeChange = useCallback(async (next: boolean) => {
    setCustomTheme(next);
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customTheme: next }),
      });
    } catch {
      // silent — local state is already updated; user can retry
    }
  }, [projectId]);

  // Immediate-PATCH so the next AI request reads the new transition style.
  const handleTransitionStyleChange = useCallback(async (next: TransitionStyle) => {
    setTransitionStyle(next);
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transitionStyle: next }),
      });
    } catch {
      // silent — local state is already updated; user can retry
    }
  }, [projectId]);

  // Same immediate-PATCH pattern so the next AI request reads the new value.
  const handleUseSfxChange = useCallback(async (next: boolean) => {
    setUseSfx(next);
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ useSfx: next }),
      });
    } catch {
      // silent — local state is already updated; user can retry
    }
  }, [projectId]);

  // Force save (Cmd+S)
  const forceSave = useCallback(async () => {
    if (!project) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, chatHistory, styleMode, ...(terminalAnnotations !== undefined ? { terminalAnnotations } : {}), ...(doc ? { doc } : {}) }),
      });
      lastSavedRef.current = {
        code,
        chatLength: chatHistory.length,
        annotations: JSON.stringify(terminalAnnotations ?? null),
        styleMode,
      };
      // Must be updated too: this cancelled the debounced save on its way in, and
      // the effect only reschedules when something CHANGES. Leaving the ref stale
      // meant Cmd+S after a timeline edit discarded it until the next edit.
      lastSavedDocRef.current = doc ? JSON.stringify(doc) : "";
    } catch {
      // silent
    }
  }, [project, projectId, code, chatHistory, terminalAnnotations, styleMode, doc]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      // Don't steal keys from a field. Without this, Cmd+S and Cmd+E fired
      // while you were typing in the chat box — Cmd+E in particular opened the
      // export dialog mid-sentence.
      const el = document.activeElement as HTMLElement | null;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);

      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "/") {
        e.preventDefault();
        setShortcutsOpen(true);
      } else if (mod && e.altKey && (e.key === "c" || e.key === "ç")) {
        // Code is a toolbar toggle, and this is its shortcut.
        e.preventDefault();
        if (doc) setShowCodeEditor((v) => !v);
      } else if (typing && mod && (e.key === "s" || e.key === "e")) {
        // Let the field have it.
      } else if (mod && e.key === "s") {
        e.preventDefault();
        forceSave();
      } else if (mod && e.key === "e") {
        e.preventDefault();
        if (code.trim() || doc) setExportOpen(true);
      } else if (mod && e.key === "z" && !e.shiftKey) {
        // Only handle composition-level undo when focus is NOT inside Monaco
        const active = document.activeElement;
        const inMonaco = active?.closest(".monaco-editor");
        if (!inMonaco) {
          e.preventDefault();
          if (doc) {
            const prevDoc = docHistory.undo();
            if (prevDoc !== null) setDoc(prevDoc);
          } else {
            const prev = codeHistory.undo();
            if (prev !== null) { setCode(prev.code); setChatHistory(prev.chat); }
          }
        }
      } else if (!mod && !e.altKey && !typing && (e.key === "i" || e.key === "I")) {
        e.preventDefault();
        setRange((r) => ({ ...r, in: playhead.getFrame() }));
      } else if (!mod && !e.altKey && !typing && (e.key === "o" || e.key === "O")) {
        e.preventDefault();
        setRange((r) => ({ ...r, out: playhead.getFrame() }));
      } else if (!mod && !e.altKey && !typing && e.shiftKey && (e.key === "X" || e.key === "x")) {
        e.preventDefault();
        setRange({ in: null, out: null });
      } else if (e.altKey && (e.key === "1" || e.key === "\u00a1")) {
        // Alt+1 / Alt+2. macOS gives the alt glyph for the digit, so accept both.
        e.preventDefault();
        setWorkspace("cut");
      } else if (e.altKey && (e.key === "2" || e.key === "\u2122")) {
        e.preventDefault();
        setWorkspace("direct");
      } else if (mod && e.key === "z" && e.shiftKey) {
        const active = document.activeElement;
        const inMonaco = active?.closest(".monaco-editor");
        if (!inMonaco) {
          e.preventDefault();
          if (doc) {
            const nextDoc = docHistory.redo();
            if (nextDoc !== null) setDoc(nextDoc);
          } else {
            const next = codeHistory.redo();
            if (next !== null) { setCode(next.code); setChatHistory(next.chat); }
          }
        }
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [forceSave, code, codeHistory, doc, docHistory, playhead]);

  const docView = doc && !showCodeEditor ? doc : undefined;

  const { durationInFrames, fps: extractedFps, sceneError } = useMemo(() => {
    // The document comes FIRST. Every doc so far was born from "Open in editor"
    // on a project that had code, so `code` was never empty beside a doc and the
    // order never mattered. A project born AS a timeline has no code at all, and
    // the old order pinned it to 250 frames: the timeline stopped scrubbing past
    // frame 249 and Export reported the wrong runtime.
    if (docView) {
      return { durationInFrames: docDuration(docView), fps: docView.size.fps, sceneError: undefined };
    }
    if (!code || !code.trim()) return { durationInFrames: 250, fps: project?.settings.fps ?? 25, sceneError: undefined };
    const result = evalSceneCode(code);
    return {
      durationInFrames: result?.durationInFrames ?? 250,
      fps: result?.fps ?? project?.settings.fps ?? 25,
      sceneError: result?.error,
    };
  }, [code, docView, project?.settings.fps]);

  // Poll the preview Player for the current frame so the timeline playhead
  // tracks playback. No-ops when the Player isn't mounted (Terminal / first
  // pass), so those paths are untouched.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const p = playerRef.current;
      if (p) {
        const f = p.getCurrentFrame();
        // `set` no-ops when neither value changed, so a paused editor costs
        // nothing beyond the rAF tick itself.
        if (typeof f === "number") playhead.set(f, p.isPlaying());
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playhead]);

  const seekTo = useCallback((frame: number) => {
    const p = playerRef.current;
    if (!p) return;
    const max = Math.max(0, durationInFrames - 1);
    p.seekTo(Math.min(max, Math.max(0, Math.round(frame))));
  }, [durationInFrames]);

  const handleScrubStart = useCallback(() => {
    playerRef.current?.pause();
  }, []);

  const togglePlay = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    if (p.isPlaying()) p.pause();
    else p.play();
  }, []);

  // The editor's insert picker needs to know what media the project holds and
  // how long each file is, so a dropped clip lands at its true length.
  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    Promise.all([
      fetch(`/api/media/${projectId}/list`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`/api/media/${projectId}/probe-map`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([list, probe]) => {
      if (cancelled) return;
      const files = (list?.files ?? list ?? []) as { name: string; path: string; type: string }[];
      if (Array.isArray(files)) setDocMedia(files);
      if (probe?.fps && probe?.nbFrames) {
        const durations: Record<string, number> = {};
        for (const [rel, frames] of Object.entries(probe.nbFrames as Record<string, number>)) {
          const f = (probe.fps as Record<string, number>)[rel];
          if (f) durations[rel] = frames / f;
        }
        setDocMediaDurations(durations);
      }
    });
    return () => { cancelled = true; };
  }, [doc, projectId]);

  const handleCodeChange = useCallback((newCode: string) => {
    setCode(newCode);
  }, []);

  // Apply a composition change AND record it for undo. The history model keeps the
  // CURRENT code at the top of the stack, so we snapshot the pre-edit state (a
  // no-op if it's already the top) AND the new state — that way one Cmd+Z steps
  // back exactly one edit. (Previously callers pushed only the OLD code and never
  // the new one, so the first edit had nothing to undo to and later undos jumped
  // a step too far.)
  const commitComposition = useCallback((next: string) => {
    if (next === code) return;
    codeHistory.pushSnapshot(code, chatHistory);
    codeHistory.pushSnapshot(next, chatHistory);
    setCode(next);
  }, [code, chatHistory, codeHistory]);

  /**
   * Apply a document change AND record it for undo. Mirrors commitComposition.
   *
   * `transient` is for the values streaming out of a drag: they are applied so
   * the preview follows the cursor, but not recorded. Without this one drag of a
   * scrubbable number pushed a snapshot per pixel — 180 pixels of travel filled
   * the entire 100-entry history with scrub steps and threw away everything
   * before it, so Cmd+Z stepped back a pixel at a time. The state from before the
   * drag is stashed on the first transient call and used as the undo point when
   * the final value commits, so a whole drag is one edit.
   */
  const preDragDocRef = useRef<EditorDoc | null>(null);
  /**
   * Put the last AI edit back, and take the receipt down with it.
   *
   * One history step, because a whole assistant turn is committed as one entry
   * (see useDocHistory's dedupe) — so Undo here means "that edit", not "the
   * last tool call the model happened to make".
   */
  const undoAiEdit = useCallback(() => {
    const prev = docHistory.undo();
    if (prev !== null) setDoc(prev);
    setAiEdit(null);
  }, [docHistory]);

  /** The strip's one edit: cut the selected clip where the playhead is. */
  const splitSelectedAtPlayhead = useCallback(() => {
    const id = [...selectedItemIds][0];
    if (!id || !doc) return;
    setDoc(splitItem(doc, id, playhead.getFrame(), doc.size.fps));
  }, [selectedItemIds, doc, playhead]);

  const commitDoc = useCallback((next: EditorDoc, opts?: { transient?: boolean }) => {
    setDoc((prev) => {
      if (opts?.transient) {
        if (!preDragDocRef.current && prev) preDragDocRef.current = prev;
        return next;
      }
      const undoPoint = preDragDocRef.current ?? prev;
      preDragDocRef.current = null;
      if (undoPoint) docHistory.pushSnapshot(undoPoint);
      docHistory.pushSnapshot(next);
      return next;
    });
  }, [docHistory]);

  /**
   * Use a snippet. In the code editor that replaces the whole project, which is
   * the only thing it could ever do and the reason the branded library has been
   * so hard to actually use. In the visual editor it becomes a block on a track
   * at the playhead, next to your footage.
   */
  const handleUseSnippet = useCallback((rendered: string, provenance?: { id: string; values: Record<string, unknown> }) => {
    if (!doc) { commitComposition(rendered); return; }
    const evaluated = evalSceneCode(rendered);
    const trackId = doc.tracks[doc.tracks.length - 1]?.id;
    if (!trackId) return;
    const item: SceneItem = {
      type: "scene",
      id: makeId("snippet"),
      from: playhead.getFrame(),
      // A scene authored at 25fps needs MORE frames in a 30fps document to play
      // to its end — inside EditorComposition it is driven by the document's
      // rate, not its own. Taking the raw number cut every 25fps snippet 20%
      // short (LowerThird: 775 frames instead of 930).
      durationInFrames: evaluated
        ? sceneFramesAtFps({ durationInFrames: evaluated.durationInFrames, fps: evaluated.fps }, doc.size.fps)
        : doc.size.fps * 3,
      layout: fullFrameLayout(doc.size),
      code: rendered,
      // Keep the snippet's identity and the values it was built from, so its
      // form can be reopened and its texts changed later. The substitution in
      // lib/snippet-template.ts runs one way only, so these cannot be recovered
      // from the rendered code afterwards.
      snippet: provenance,
      // A placed snippet is a whole piece, not a window onto a longer one, so
      // resizing it retimes the animation rather than sliding what you see.
      fit: "retime" as const,
    };
    commitDoc(addItem(doc, trackId, fitSceneItem(item, doc.size.fps)));
    setSelectedItemIds(new Set([item.id]));
  }, [doc, playhead, commitComposition, commitDoc]);

  /**
   * Describe an animation, get it as a block on its own track at the playhead.
   *
   * Uses the same system prompt as the chat, so the house style and the motion
   * bans are identical — what differs is that the result is ONE piece added to
   * the timeline rather than a rewrite of the project's scene. It goes on a new
   * track so it never displaces anything already laid down.
   */
  const generateAnimation = useCallback(async (promptText: string, images: string[]) => {
    if (!doc || !project) return;
    const res = await fetch("/api/generate-scene", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: promptText,
        images,
        projectSettings: project.settings,
        animationType: project.animationType,
        styleMode,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Generation failed");

    const evaluated = evalSceneCode(data.code);
    if (!evaluated) throw new Error("The scene came back but wouldn't compile. Try describing it differently.");
    const duration = sceneFramesAtFps(
      { durationInFrames: evaluated.durationInFrames, fps: evaluated.fps },
      doc.size.fps,
    );

    const withTrack = addTrack(doc);
    const trackId = withTrack.tracks[withTrack.tracks.length - 1].id;
    const item: SceneItem = {
      type: "scene",
      id: makeId("scene"),
      from: playhead.getFrame(),
      durationInFrames: duration,
      layout: fullFrameLayout(doc.size),
      code: retimeSceneCode(data.code, duration, doc.size.fps),
      // Generated whole, so resizing it retimes the animation rather than
      // sliding a window over a longer one.
      fit: "retime",
    };
    commitDoc(addItem(withTrack, trackId, item));
    setSelectedItemIds(new Set([item.id]));
  }, [doc, project, styleMode, playhead, commitDoc]);

  /**
   * Put a brand asset on a track. In the code editor an asset's only use is its
   * `staticFile()` path on the clipboard; with a document open it can simply
   * become a layer.
   */
  const insertAsset = useCallback((path: string, type: string) => {
    if (!doc) return;
    const isImage = type === "image" || type === "svg";
    if (!isImage) {
      toast.warning(
        `${path.split("/").pop()} isn't an image`,
        "Only images can be placed on a track. Video and audio go in via Footage.",
      );
      return;
    }
    const frames = doc.size.fps * 3;
    const { doc: host, trackId } = trackWithRoomAt(doc, playhead.getFrame(), frames);
    const asset = { id: makeId("asset"), kind: "image" as const, src: path, name: path.split("/").pop() ?? path };
    const size = Math.round(Math.min(doc.size.width, doc.size.height) * 0.4);
    const item = {
      type: "image" as const,
      id: makeId("image"),
      from: playhead.getFrame(),
      durationInFrames: frames,
      layout: {
        x: Math.round((doc.size.width - size) / 2),
        y: Math.round((doc.size.height - size) / 2),
        width: size,
        height: size,
      },
      assetId: asset.id,
      fit: "contain" as const,
    };
    commitDoc(addItem({ ...host, assets: [...host.assets, asset] }, trackId, item));
    setSelectedItemIds(new Set([item.id]));
  }, [doc, playhead, commitDoc]);

  const handleChatUpdate = useCallback((messages: ChatMessage[]) => {
    setChatHistory(messages);
  }, []);

  // Immediate save when generation completes (no debounce), then generate thumbnail
  const handleGenerationComplete = useCallback(async (finalCode: string, finalChat: ChatMessage[]) => {
    codeHistory.pushSnapshot(finalCode, finalChat);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: finalCode, chatHistory: finalChat }),
      });
      lastSavedRef.current = {
        code: finalCode,
        chatLength: finalChat.length,
        annotations: JSON.stringify(terminalAnnotations ?? null),
        styleMode,
      };
    } catch {
      // silent fail
    }
    fetch(`/api/projects/${projectId}/thumbnail`, { method: "POST" }).catch(() => {});

    // Auto-fix on error: if the freshly generated Remotion scene doesn't compile,
    // relaunch the model to repair it — no manual resend needed. The [SCENE ERROR]
    // is injected into the AI message by ChatPanel's sceneError prop (which keeps
    // the visible chat message clean); we defer to setTimeout(0) so that prop has
    // settled after the setCode → sceneError re-render. Bounded by autoRetryRef.
    if (project?.animationType !== "terminal") {
      const err = evalSceneCode(finalCode)?.error;
      if (err) {
        if (autoRetryRef.current < 2) {
          autoRetryRef.current += 1;
          setTimeout(() => {
            chatRef.current?.runWithPrompt(
              "The preview is showing an error — fix the scene and return the complete corrected file."
            );
          }, 0);
        }
      } else {
        autoRetryRef.current = 0;
      }
    }
  }, [projectId, codeHistory, terminalAnnotations, styleMode, project?.animationType]);

  const isTerminalProject = project?.animationType === "terminal";
  const layoutKind = project?.animationType === "video" ? "video" : project?.animationType === "terminal" ? "terminal" : "still";
  const storage =
    typeof window !== "undefined"
      ? window.localStorage
      : ({
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
          clear: () => {},
          key: () => null,
          length: 0,
        } as Storage);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(rangeKey);
      if (saved) {
        const parsed = JSON.parse(saved) as { in: number | null; out: number | null };
        if (parsed && typeof parsed === "object") setRange(parsed);
      }
    } catch { /* private window — no range is fine */ }
  }, [rangeKey]);

  useEffect(() => {
    try {
      if (range.in === null && range.out === null) window.localStorage.removeItem(rangeKey);
      else window.localStorage.setItem(rangeKey, JSON.stringify(range));
    } catch { /* ignore */ }
  }, [range, rangeKey]);

  /*
   * The receipt follows you out of the chat.
   *
   * In Cut the chat column is replaced by the inspector, so a receipt rendered
   * only inside ChatPanel would be invisible exactly when you have gone to look
   * at the timeline it describes. The same three actions arrive as a toast
   * instead, and it stays up until you answer it (`duration: 0`).
   */
  const chatOnScreen = !(doc && !showCodeEditor && rightTab === "properties");
  useEffect(() => {
    if (!aiEdit?.length || chatOnScreen) return;
    const first = aiEdit[0];
    const id = toast.show({
      tone: "neutral",
      duration: 0,
      text: `${aiEdit.length} ${aiEdit.length === 1 ? "edit" : "edits"} from the assistant`,
      // "Headline · in 00:01:08 → 00:02:00" — the arrow is the separator
      // between the two values, so it must not get a dot as well.
      detail: [
        first.label,
        [first.field, [first.before, first.after].filter(Boolean).join(" → ")].filter(Boolean).join(" "),
      ].filter(Boolean).join(" · "),
      actions: [
        { label: "Keep", onClick: () => setAiEdit(null) },
        { label: "Undo", onClick: undoAiEdit },
        {
          label: "Show in timeline",
          onClick: () => { setSelectedItemIds(new Set(aiEdit.map((c) => c.itemId))); setAiEdit(null); },
        },
      ],
    });
    return () => toast.dismiss(id);
    // `toast` is a stable context value; listing it here re-fires the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiEdit, chatOnScreen, undoAiEdit]);

  // Restore the last workspace for THIS project.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(workspaceKey);
      if (saved === "cut" || saved === "direct") setWorkspace(saved);
    } catch { /* private window — the default is fine */ }
  }, [workspaceKey]);

  // Apply the workspace's geometry. Panels are resized in place.
  useEffect(() => {
    try { window.localStorage.setItem(workspaceKey, workspace); } catch { /* ignore */ }
    // Applied on the next frame: the Group restores its own saved layout on
    // mount, and whichever runs last wins. These are the spec's widths, so
    // they should.
    // Two frames, not one: on first mount the Group is still applying its own
    // restored layout during the first, and whichever runs last wins.
    let inner = 0;
    const raf = requestAnimationFrame(() => { inner = requestAnimationFrame(() => {
      if (workspace === "direct") {
        // Chat-first: a wide chat column and the timeline down to a strip, so
        // an AI edit's result is visible in the same glance as the sentence
        // describing it. Expanded, the strip gives way to the real timeline
        // and the keyframe lanes it carries.
        rightPanelRef.current?.resize("452px");
        timelinePanelRef.current?.resize(timelineExpanded ? "428px" : "152px");
      } else {
        // Timeline-first: the inspector at 360px — the narrowest width that
        // holds the property row grid — and the timeline at full height.
        // Order matters: sizing the right panel steals width back from its
        // neighbours, so the rail goes last or it ends up 24px short.
        rightPanelRef.current?.resize("360px");
        timelinePanelRef.current?.resize("296px");
        railPanelRef.current?.resize("248px");
      }
    }); });
    setRightTab(workspace === "direct" ? "chat" : "properties");
    if (workspace !== "direct") setTimelineExpanded(false);
    return () => { cancelAnimationFrame(raf); cancelAnimationFrame(inner); };
  }, [workspace, workspaceKey, timelineExpanded]);

  const horizontalLayout = useDefaultLayout({
    // v3: the stage row is now rail | preview | right, and the timeline moved
    // out to full width beneath it.
    id: `studio-h3-${layoutKind}`,
    panelIds: ["rail", "preview", "chat"],
    storage,
  });
  const verticalLayout = useDefaultLayout({
    // v3: the outer group is now vertical — stage over timeline (over the
    // legacy code panel, when there is no document).
    id: `studio-v3-${layoutKind}`,
    panelIds: layoutKind === "video" ? ["stage", "timeline"] : ["stage", "code"],
    storage,
  });

  if (loading) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-tertiary)", fontSize: 13 }}>
        Loading project...
      </div>
    );
  }

  if (!project) return null;

  const { width, height } = getProjectSize(project.settings);
  const resLabel = `${width}\u00d7${height}`;
  const isVideoProject = project.animationType === "video";
  // The timeline panel mounts for every Remotion-scene project type too —
  // animation / broll / svg compositions are made of <Sequence> blocks and
  // can be reordered, trimmed, and split via the editable timeline.
  // The editable timeline parses Remotion <Sequence> blocks — it doesn't apply
  // to scenes with no Sequence model.
  // There is one timeline now, and it draws a document. A code project reaches it
  // by importing — "Open in editor" — rather than by being parsed in place.
  const hasTimeline = Boolean(docView);

  /** Code mode is only a mode for a DOCUMENT project; legacy code keeps its panel. */
  const codeMode = showCodeEditor && Boolean(doc);

  /*
   * One preview element, used by both layouts. Built once so the studio layout
   * and code mode cannot drift into showing different things — the bug this
   * replaces was exactly that: two call sites, one of which rendered the legacy
   * scene code for a project that has no scene code.
   */
  const docPreview = doc ? (
    <EditorPreview
      range={range}
      doc={doc}
      playerRef={playerRef}
      selectedIds={selectedItemIds}
      onSelectionChange={setSelectedItemIds}
      onChange={commitDoc}
      onSeek={seekTo}
      onTogglePlay={togglePlay}
    />
  ) : null;

  return (
    <PlayheadContext.Provider value={playhead}>
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 16px",
          height: 48,
          background: "var(--surface-chrome)",
          borderBottom: "1px solid var(--border-hairline)",
          position: "relative",
          zIndex: 5,
          flexShrink: 0,
        }}
      >
        {/* Back is chevron-left plus THE NAME OF WHERE YOU LAND, far left. The
            app logo used to sit here; in the editor it earns nothing — you know
            which app you are in — and it pushed the project's own name off the
            place your eye starts. */}
        <Button
          variant="ghost"
          size="chrome"
          icon="chevronLeft"
          onClick={() => router.push(project ? `/${normalizeAnimationType(project.animationType)}` : "/")}
        >
          {project ? titleCase(normalizeAnimationType(project.animationType)) : "Projects"}
        </Button>
        <div style={{ width: 1, height: 20, background: "var(--border-hairline)" }} />
        <span className="t-heading" style={{ color: "var(--ink-primary)", whiteSpace: "nowrap" }}>
          {project.name}
        </span>
        {/* Frame pill — state, not an action, so it is a pill and never a button. */}
        <span
          className="t-data-s"
          style={{
            display: "inline-flex", alignItems: "center", height: 22, padding: "0 8px",
            background: "var(--surface-raised)", borderRadius: "var(--r-pill)",
            color: "var(--ink-tertiary)", whiteSpace: "nowrap",
          }}
        >
          {resLabel} · {project.settings.fps}fps
        </span>
        <div style={{ flex: 1 }} />

        {/* Cut / Direct. Named for the job, not the furniture. The document does
            not move when you switch — only the room does. */}
        {docView && (
          <>
            <Segmented
              value={workspace}
              onChange={(v) => setWorkspace(v as "cut" | "direct")}
              options={[
                { value: "cut", label: "Cut", shortcut: "\u2325 1" },
                { value: "direct", label: "Direct", shortcut: "\u2325 2" },
              ]}
            />
            <div style={{ width: 1, height: 20, background: "var(--border-hairline)" }} />
          </>
        )}

        {/* Undo / Redo — 2px gap, circular arrows, disabled when there is
            nothing to go back (or forward) to.

            These used to call codeHistory unconditionally, so in a doc-backed
            project the buttons undid the LEGACY CODE while Cmd+Z correctly
            undid the document. Branch the same way the keyboard handler does. */}
        <div style={{ display: "flex", gap: 2 }}>
          <Tooltip label="Undo" shortcut="⌘Z">
          <IconButton
            icon="undo"
            size={26}
            aria-label="Undo"
            disabled={doc ? !docHistory.canUndo : !codeHistory.canUndo}
            onClick={() => {
              if (doc) { const prevDoc = docHistory.undo(); if (prevDoc !== null) setDoc(prevDoc); return; }
              const prev = codeHistory.undo();
              if (prev !== null) { setCode(prev.code); setChatHistory(prev.chat); }
            }}
          />
          </Tooltip>
          <Tooltip label="Redo" shortcut="⇧⌘Z">
          <IconButton
            icon="redo"
            size={26}
            aria-label="Redo"
            disabled={doc ? !docHistory.canRedo : !codeHistory.canRedo}
            onClick={() => {
              if (doc) { const nextDoc = docHistory.redo(); if (nextDoc !== null) setDoc(nextDoc); return; }
              const next = codeHistory.redo();
              if (next !== null) { setCode(next.code); setChatHistory(next.chat); }
            }}
          />
          </Tooltip>
        </div>
        <div style={{ width: 1, height: 20, background: "var(--border-hairline)" }} />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            padding: 3,
            background: "var(--surface-void)",
            border: "1px solid var(--border-hairline)",
            borderRadius: "var(--r-panel)",
          }}
        >
          <span className="mono" style={{ fontSize: 10, color: "var(--ink-tertiary)", padding: "0 6px" }}>
            {SAVE_LABEL[saveState]}
          </span>
          <span
            title={SAVE_TITLE[saveState]}
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: SAVE_DOT[saveState],
              marginRight: 6,
              animation: saveState === "saving" ? "vt-pulse 1s ease-in-out infinite" : undefined,
            }}
          />
        </div>
        {/* Convert ratio / Remove background are meaningful for animation scenes,
            but footguns for uploaded footage — hidden for video (reframe handles
            aspect; Remove background does nothing to a video). */}
        {!isTerminalProject && !isVideoProject && (
          <ConvertAspectRatioButton
            projectId={projectId}
            currentOrientation={project.settings.orientation}
            disabled={!code.trim() || isGenerating}
          />
        )}
        {!isTerminalProject && !isVideoProject && (
          <Button variant="outline" size="sm" icon="layers" onClick={() => setSnippetsOpen(true)}>
            Snippets
          </Button>
        )}
        {hasTimeline && !isVideoProject && (
          <Button
            variant="outline"
            size="sm"
            icon="checkerboard"
            title="Remove background (Cmd+Z to undo)"
            disabled={!code.trim() || bgRemovedFlash}
            onClick={() => {
              const next = stripBackgroundsForTransparency(code);
              if (next === code) return;
              commitComposition(next);
              setBgRemovedFlash(true);
              setTimeout(() => setBgRemovedFlash(false), 1500);
            }}
          >
            {bgRemovedFlash ? "Removed" : "Remove background"}
          </Button>
        )}
        {/* Video: fewer top buttons — analyze / smart trim / snippets / assets
            live under one Tools menu; the chat is the main editing surface. */}
        {isVideoProject ? (
          <div style={{ position: "relative" }} ref={toolsRef}>
            <Button variant="outline" size="sm" icon="settings" onClick={() => setToolsOpen((v) => !v)}>
              Tools <Icon name="chevronDown" size={12} />
            </Button>
            {toolsOpen && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: "100%",
                  marginTop: 6,
                  minWidth: 200,
                  padding: 5,
                  background: "var(--surface-raised)",
                  border: "1px solid var(--border-hairline)",
                  borderRadius: "var(--r-panel)",
                  boxShadow: "var(--shadow-float)",
                  zIndex: 20,
                }}
              >
                {[
                  // Snippets and Assets are tabs in the bottom panel now, so
                  // listing them here was a second door to the same room.
                  { icon: "search", label: "Analyze footage", onClick: () => setAnalyzeOpen(true) },
                  { icon: "sparkle", label: "Smart trim (re-run)", onClick: () => setSmartTrimOpen(true) },
                  { icon: "film", label: composeLabel, onClick: () => runFirstPass("compose") },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => { setToolsOpen(false); item.onClick(); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, width: "100%",
                      padding: "8px 8px", fontSize: 12, background: "transparent", border: "none",
                      color: "var(--ink-primary)", borderRadius: 4, cursor: "pointer", textAlign: "left",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <Icon name={item.icon} size={13} style={{ color: "var(--ink-tertiary)" }} />
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <Button variant="outline" size="sm" icon="folder" onClick={() => setAssetsOpen(true)}>
            Assets
          </Button>
        )}
        {doc && (
          <Button
            variant="outline"
            size="sm"
            icon={showCodeEditor ? "layers" : "code"}
            onClick={() => setShowCodeEditor((v) => !v)}
          >
            {showCodeEditor ? "Editor" : "Code view"}
          </Button>
        )}
        {!doc && !isTerminalProject && (
          <Button
            variant="outline"
            size="sm"
            icon="layers"
            onClick={async () => {
              const evaluated = evalSceneCode(code);
              const size = { width, height, fps: evaluated?.fps ?? project.settings.fps };

              // Nothing written yet: start an EMPTY timeline rather than wrapping
              // an empty string as a scene block. This is the only way a document
              // can currently be born from scratch in the UI.
              if (!code.trim()) {
                commitDoc(emptyDoc(size));
                return;
              }

              // The importer records how long the source file is so the timeline
              // can show the right slice of its filmstrip on each clip.
              let sourceDurationSec: number | undefined;
              try {
                const probe = await fetch(`/api/media/${projectId}/probe-map`).then((r) => (r.ok ? r.json() : null));
                const rel = /["\`'](?:\/api\/media\/[^/]+\/)([^"\`']+)["\`']/.exec(code)?.[1];
                if (rel && probe?.fps?.[rel] && probe?.nbFrames?.[rel]) {
                  sourceDurationSec = probe.nbFrames[rel] / probe.fps[rel];
                }
              } catch {
                // Filmstrips just won't window; the import itself is unaffected.
              }

              // An edit driven by a topics array carries its own decisions as
              // structured data — which footage, named how — so rebuild those as
              // real clips rather than dropping the whole thing in as one
              // immovable block. Falls back to the block for everything else.
              const imported = docFromVideoEdit(code, size, {
                sourceDurationSec,
                compositionDurationInFrames: evaluated?.durationInFrames,
              });
              if (imported) {
                commitDoc(imported);
                const n = imported.tracks[0].items.length;
                const odd = suspiciousSegments(code, size.fps);
                if (odd.length > 0) {
                  // A caveat you can proceed past, so amber and dismissible —
                  // not a dialog, and not on a timer you have to wait out.
                  toast.warning(
                    `Imported ${n} ${n === 1 ? "clip" : "clips"} — ${odd.length === 1 ? "one topic is" : `${odd.length} topics are`} nearly invisible`,
                    `${odd.map((o) => `${o.label} ${o.seconds.toFixed(2)}s`).join(" · ")}. That came from the generated edit, not the import — trim the clip out or drag its edge.`,
                  );
                } else {
                  toast.success(`Imported ${n} ${n === 1 ? "clip" : "clips"}`);
                }
                return;
              }
              // No footage, but the animation still has cuts: a TransitionSeries
              // of branded scenes, or a few Sequences. Each cut becomes a block
              // windowed onto the original, so the design and motion are exactly
              // as authored and only the arrangement becomes editable.
              const asBlocks = docFromComposition(code, size, evaluated?.durationInFrames ?? 0);
              if (asBlocks) {
                commitDoc(asBlocks);
                return;
              }

              // Nothing to cut on — a continuous move, say. One block is then the
              // honest answer, not a failure.
              commitDoc(docFromScene(size, code, evaluated?.durationInFrames ?? 250, project.name));
            }}
          >
            Open in editor
          </Button>
        )}
        {isTerminalProject ? (
          <Button
            variant="primary"
            size="sm"
            icon="download"
            onClick={() => {
              const a = document.createElement("a");
              a.href = `/api/vhs/${projectId}/output`;
              a.download = `${project.name}.mp4`;
              a.click();
            }}
            disabled={!code.trim()}
          >
            Download
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            icon="download"
            onClick={() => setExportOpen(true)}
            // A document renders through sceneCodeFromDoc, so it exports with no
            // code file at all — gating on `code` alone locked those projects in.
            disabled={!code.trim() && !doc}
          >
            Export
          </Button>
        )}
      </div>

      {/*
        Code mode is a SCREEN, not a panel (6a). It used to drop scene.json into
        the timeline's slot and leave the editor standing around it — which also
        meant the preview, gated on the document being visible, fell back to the
        legacy scene-code path and rendered nothing for a timeline project.
      */}
      {codeMode && doc ? (
        <CodeModeScreen
          doc={doc}
          selectedIds={selectedItemIds}
          onSelectionChange={setSelectedItemIds}
          saveLabel={SAVE_LABEL[saveState].toLowerCase()}
          preview={docPreview}
          strip={
            <TimelineStrip
              doc={doc}
              selectedIds={selectedItemIds}
              onSelectionChange={setSelectedItemIds}
              onSeek={seekTo}
              onScrubStart={handleScrubStart}
              onExpand={() => setShowCodeEditor(false)}
              onSplit={splitSelectedAtPlayhead}
            />
          }
        />
      ) : (
      /* Studio layout: resizable panels */
      <div style={{ flex: 1, minHeight: 0, background: "var(--border-hairline)" }}>
        <Group
          orientation="vertical"
          defaultLayout={verticalLayout.defaultLayout}
          onLayoutChanged={verticalLayout.onLayoutChanged}
          style={{ height: "100%" }}
        >
          <Panel id="stage" defaultSize="70%" minSize="30%">
            <Group
              orientation="horizontal"
              defaultLayout={horizontalLayout.defaultLayout}
              onLayoutChanged={horizontalLayout.onLayoutChanged}
              style={{ height: "100%" }}
            >
              {/* Media rail — Cut only. Direct is chat-first: you ask for the
                  change rather than going and finding the file yourself. */}
              {docView && workspace === "cut" && (
                <>
                  <Panel id="rail" panelRef={railPanelRef} defaultSize="248px" minSize="180px" maxSize="30%">
                    <div style={{ background: "var(--surface-chrome)", height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
                    <>
                      {/* Underline tabs, because these are PLACES. Code is not
                          here — it is a toolbar toggle, and having both was two
                          doors to one room. Effects moves into the inspector
                          when the effect stack lands. */}
                      <div style={{ padding: "0 12px", flexShrink: 0 }}>
                        <Tabs
                          value={bottomTab}
                          onChange={(v) => setBottomTab(v as typeof bottomTab)}
                          options={[
                            { value: "footage", label: "Footage" },
                            { value: "assets", label: "Assets" },
                            { value: "snippets", label: "Snippets" },
                            { value: "effects", label: "Effects" },
                          ]}
                        />
                      </div>
                      <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
                        {bottomTab === "footage" && (
                          <FootageBrowser
                            projectId={projectId}
                            doc={docView}
                            onChange={commitDoc}
                                  onSelect={(id: string) => setSelectedItemIds(new Set([id]))}
                          />
                        )}
                        {bottomTab === "assets" && (
                          <AssetBrowser
                            inline
                            open={false}
                            onClose={() => {}}
                            onCopyPath={() => {}}
                            onInsert={(path, type) => insertAsset(path, type)}
                          />
                        )}
                        {bottomTab === "snippets" && (
                          <SnippetBrowser
                            inline
                            open={false}
                            onClose={() => {}}
                            hasExistingCode={false}
                            onUseSnippet={handleUseSnippet}
                          />
                        )}
                        {bottomTab === "effects" && (
                          <EffectsPanel doc={docView} selectedIds={selectedItemIds} onChange={commitDoc} />
                        )}
                      </div>
                    </>
                    </div>
                  </Panel>
                  <Separator className="resize-handle resize-handle-vertical" />
                </>
              )}
              <Panel id="preview" defaultSize={hasTimeline ? "50%" : "65%"} minSize="15%">
                <div style={{ background: "#000", height: "100%", minHeight: 0, minWidth: 0, overflow: "hidden", position: "relative" }}>
                  {/*
                    The first-pass panel used to be one branch of this chain, so a
                    project WITH a document could never show it — and compose now
                    starts with an empty one, which would have left a two-minute
                    analyze running behind a blank canvas with no sign of life.
                    Over the top, not instead of.
                  */}
                  {docView && firstPass && (
                    <div style={{ position: "absolute", inset: 0, zIndex: 10 }}>
                      <FirstPassProgress state={firstPass} onDismiss={() => setFirstPass(null)} />
                    </div>
                  )}
                  {docView ? (
                    docPreview
                  ) : isTerminalProject ? (
                    <TerminalPreview
                      projectId={projectId}
                      code={code}
                      onReplaceCode={commitComposition}
                      annotations={terminalAnnotations}
                      onAnnotationsChange={setTerminalAnnotations}
                      customTheme={customTheme}
                      onCustomThemeChange={handleCustomThemeChange}
                    />
                  ) : firstPass ? (
                    <FirstPassProgress state={firstPass} onDismiss={() => setFirstPass(null)} />
                  ) : (
                    <PreviewPanel code={code} width={width} height={height} svgContents={project.svgContents} playerRef={playerRef} />
                  )}
                </div>
              </Panel>
              <Separator className="resize-handle resize-handle-vertical" />
          <Panel id="chat" panelRef={rightPanelRef} defaultSize="360px" minSize="18%" maxSize="50%">
            <div style={{ background: "var(--surface-chrome)", height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
              {docView && (
                <div style={{ padding: "5px 8px", borderBottom: "1px solid var(--border-hairline)" }}>
                  <Segmented
                    value={rightTab}
                    onChange={(v) => setRightTab(v as typeof rightTab)}
                    options={[
                      { value: "chat", label: "Chat" },
                      { value: "properties", label: "Properties" },
                    ]}
                  />
                </div>
              )}
              {docView && rightTab === "properties" ? (
                <EditorInspector
                  doc={docView}
                  selectedIds={selectedItemIds}
                  onChange={commitDoc}
                  onEditSnippet={setEditingSnippetId}
                  projectId={projectId}
                />
              ) : (
              <ChatPanel
                ref={chatRef}
                projectId={projectId}
                chatHistory={chatHistory}
                initialPrompt={project.initialPrompt}
                onCodeUpdate={handleCodeChange}
                onChatUpdate={handleChatUpdate}
                isGenerating={isGenerating}
                setIsGenerating={setIsGenerating}
                projectSettings={project.settings}
                animationType={project.animationType}
                notionContent={project.notionContent}
                scriptWithTimestamps={project.scriptWithTimestamps}
                svgContents={project.svgContents}
                styleMode={styleMode}
                onStyleModeChange={setStyleMode}
                topicCardStyle={topicCardStyle}
                transitionStyle={transitionStyle}
                onTransitionStyleChange={handleTransitionStyleChange}
                useSfx={useSfx}
                onUseSfxChange={handleUseSfxChange}
                currentCode={code}
                autoSend={
                  !project.code &&
                  project.chatHistory.length === 0 &&
                  // For Smart Trim projects the dialog generates the composition,
                  // not the AI chat — captured from the URL once on mount before
                  // the ?action=smartTrim param gets cleaned.
                  initialAutoAction !== "smartTrim" &&
                  // Video projects must be Analyzed first, then edited via chat —
                  // never auto-generate blind on load.
                  !isVideoProject
                }
                onGenerationComplete={handleGenerationComplete}
                sceneError={sceneError}
                doc={docView}
                selectedIds={[...selectedItemIds]}
                onDocChanged={commitDoc}
                onUndoEdit={undoAiEdit}
                onSelectItems={(ids) => setSelectedItemIds(new Set(ids))}
                receipt={aiEdit}
                onReceipt={setAiEdit}
                onDeselectItem={(id) => setSelectedItemIds((prev) => {
                  const next = new Set(prev);
                  next.delete(id);
                  return next;
                })}
              />
              )}
            </div>
          </Panel>
            </Group>
          </Panel>
              {hasTimeline && (
                <>
                  <Separator className="resize-handle resize-handle-horizontal" />
                  <Panel id="timeline" panelRef={timelinePanelRef} defaultSize="296px" minSize="120px">
                    <div style={{ background: "var(--surface-chrome)", height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
                      {/*
                        Direct gets the collapsed STRIP, not the full timeline
                        squeezed into 152px. Expand swaps the real one in at
                        428px — the same control, two different components,
                        because a 26px row and a 52px track want different
                        furniture.
                      */}
                      {docView && (workspace === "direct" && !timelineExpanded ? (
                        <TimelineStrip
                          doc={docView}
                          selectedIds={selectedItemIds}
                          onSelectionChange={setSelectedItemIds}
                          onSeek={seekTo}
                          onScrubStart={handleScrubStart}
                          onExpand={() => setTimelineExpanded(true)}
                          onSplit={splitSelectedAtPlayhead}
                        />
                      ) : (
                        <DocTimeline
                          doc={docView}
                          onChange={commitDoc}
                          onSeek={seekTo}
                          onScrubStart={handleScrubStart}
                          onTogglePlay={togglePlay}
                          mediaFiles={docMedia}
                          mediaDurations={docMediaDurations}
                          projectId={projectId}
                          selectedIds={selectedItemIds}
                          onSelectionChange={setSelectedItemIds}
                          onPromptAnimation={() => setPromptAnimOpen(true)}
                          onShowShortcuts={() => setShortcutsOpen(true)}
                          range={range}
                          expanded={workspace === "direct" ? timelineExpanded : undefined}
                          onExpandedChange={workspace === "direct" ? setTimelineExpanded : undefined}
                        />
                      ))}
                    </div>
                  </Panel>
                </>
              )}
          {/* A legacy project has no document, so its code IS the edit surface.
              It keeps the full-width bottom panel it has always had. */}
          {!docView && (
            <>
              <Separator className="resize-handle resize-handle-horizontal" />
              <Panel id="code" defaultSize="35%" minSize="10%">
                <div style={{ background: "var(--surface-chrome)", height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
                  {/* A legacy project's code IS its composition, so this is an
                      edit surface rather than a readout. A DOCUMENT project's
                      scene.json lives in code mode's own screen (6a). */}
                  <CodeEditor
                    code={code}
                    onChange={handleCodeChange}
                    language={isTerminalProject ? "vhs" : "typescript"}
                    filename={isTerminalProject ? "tape.tape" : "Scene.tsx"}
                  />
                </div>
              </Panel>
            </>
          )}
        </Group>
      </div>
      )}

      {docView && (
        <SnippetEditDialog
          open={editingSnippetId !== null}
          item={(() => {
            if (!editingSnippetId) return null;
            const found = findItem(docView, editingSnippetId);
            return found && found.item.type === "scene" ? found.item : null;
          })()}
          onClose={() => setEditingSnippetId(null)}
          onSave={(nextCode, values) => {
            if (!editingSnippetId) return;
            // Changing a parameter can change how long the scene runs (PromptBox's
            // typing seconds, AiChat's logo flag), so the block has to be re-timed
            // with it — otherwise the animation and its slot disagree.
            const re = evalSceneCode(nextCode);
            const reDur = re
              ? sceneFramesAtFps({ durationInFrames: re.durationInFrames, fps: re.fps }, docView.size.fps)
              : undefined;
            commitDoc(updateItem<SceneItem>(docView, editingSnippetId, {
              // Re-rendered code carries the snippet's own length again, so it is
              // put back into document units or the exit stops being reachable.
              code: reDur
                ? retimeSceneCode(nextCode, reDur, docView.size.fps)
                : nextCode,
              ...(reDur !== undefined ? { durationInFrames: reDur } : {}),
              fit: "retime",
              snippet: { id: findItem(docView, editingSnippetId)?.item.type === "scene"
                ? (findItem(docView, editingSnippetId)!.item as SceneItem).snippet!.id
                : "", values },
            }));
          }}
        />
      )}

      <AssetBrowser
        open={assetsOpen}
        onClose={() => setAssetsOpen(false)}
        onCopyPath={() => {}}
      />

      <SnippetBrowser
        open={snippetsOpen}
        onClose={() => setSnippetsOpen(false)}
        hasExistingCode={!doc && code.trim().length > 0}
        onUseSnippet={handleUseSnippet}
      />

      <SmartTrimDialog
        open={smartTrimOpen}
        onClose={() => setSmartTrimOpen(false)}
        projectId={projectId}
        fps={extractedFps}
        hasMediaFolder={!!project.mediaFolder}
        hasExistingCode={!doc && code.trim().length > 0}
        onApply={({ code: trimmedCode, plan, mediaSrc, name }) => {
          // Same choice as the first pass: land it on the timeline when there is
          // a plan to lay out, fall back to the generated code when there isn't.
          const asDoc = docFromCutPlan(plan, { width, height, fps: extractedFps }, mediaSrc, { name });
          if (asDoc) commitDoc(asDoc);
          else if (trimmedCode) commitComposition(trimmedCode);
        }}
      />

      <PromptAnimationDialog
        open={promptAnimOpen}
        onClose={() => setPromptAnimOpen(false)}
        onGenerate={generateAnimation}
      />

      <AnalyzeDialog
        open={analyzeOpen}
        onClose={() => setAnalyzeOpen(false)}
        projectId={projectId}
        hasMediaFolder={!!project.mediaFolder}
      />

      {(() => {
        let exportCode = code;
        let exportDuration = durationInFrames;
        let exportFps = extractedFps;
        let exportWidth = width;
        let exportHeight = height;
        if (isTerminalProject && terminalAnnotations) {
          const origin = typeof window !== "undefined" ? window.location.origin : "";
          const videoUrl = `${origin}/api/vhs/${projectId}/output`;
          const plan = buildTerminalExportPlan(videoUrl, terminalAnnotations);
          exportCode = plan.code;
          exportDuration = plan.durationInFrames;
          exportFps = plan.fps;
          exportWidth = plan.width;
          exportHeight = plan.height;
        }
        return (
          <ExportFlow
            open={exportOpen}
            onClose={() => setExportOpen(false)}
            code={exportCode}
            durationInFrames={exportDuration}
            fps={exportFps}
            width={exportWidth}
            height={exportHeight}
            projectName={project.name}
            projectId={projectId}
            doc={doc}
            range={range}
            onDocChange={commitDoc}
          />
        );
      })()}

      <ShortcutsModal
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
        kind={doc ? "doc" : "code"}
      />

      <GeneratingOverlay visible={isGenerating} />
    </div>
    </PlayheadContext.Provider>
  );
}
