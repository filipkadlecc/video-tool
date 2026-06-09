"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import GeneratingOverlay from "@/components/GeneratingOverlay";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import ChatPanel, { type ChatPanelHandle } from "@/components/ChatPanel";
import AssetBrowser from "@/components/AssetBrowser";
import SnippetBrowser from "@/components/SnippetBrowser";
import SmartTrimDialog from "@/components/SmartTrimDialog";
import ExportDialog from "@/components/ExportDialog";
import TerminalPreview from "@/components/TerminalPreview";
import ConvertAspectRatioButton from "@/components/ConvertAspectRatioButton";
import Timeline from "@/components/Timeline";
import { evalSceneCode } from "@/remotion/DynamicScene";
import type { Project, ChatMessage, TerminalAnnotations, StyleMode } from "@/lib/types";
import { getResolution } from "@/lib/types";
import { buildTerminalExportPlan } from "@/lib/terminal-export";
import { stripBackgroundsForTransparency } from "@/lib/transparent-bg";
import Logo from "@/components/ui/Logo";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import TypeBadge from "@/components/ui/TypeBadge";
import { useCodeHistory } from "@/hooks/useCodeHistory";
import { Group, Panel, Separator, useDefaultLayout } from "react-resizable-panels";

const PreviewPanel = dynamic(() => import("@/components/PreviewPanel"), {
  ssr: false,
  loading: () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-2)", fontSize: 13 }}>
      Loading preview...
    </div>
  ),
});

const CodeEditor = dynamic(() => import("@/components/CodeEditor"), {
  ssr: false,
  loading: () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-2)", fontSize: 13 }}>
      Loading editor...
    </div>
  ),
});

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
  const [isGenerating, setIsGenerating] = useState(false);
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [snippetsOpen, setSnippetsOpen] = useState(false);
  const [smartTrimOpen, setSmartTrimOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [bgRemovedFlash, setBgRemovedFlash] = useState(false);
  const [loading, setLoading] = useState(true);
  // Captured once on mount from ?action=, before we clean the URL via router.replace.
  const [initialAutoAction] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("action");
  });

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<{ code: string; chatLength: number; annotations: string; styleMode: StyleMode }>({ code: "", chatLength: 0, annotations: "", styleMode: "default" });
  const codeHistory = useCodeHistory();
  const chatRef = useRef<ChatPanelHandle>(null);

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
        setTerminalAnnotations(data.terminalAnnotations);
        setCustomTheme(Boolean(data.customTheme));
        setStyleMode(data.styleMode ?? "default");
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
  }, [projectId, router]);

  // Honor ?action=smartTrim once: open the dialog and clean the URL.
  const consumedActionRef = useRef(false);
  useEffect(() => {
    if (consumedActionRef.current) return;
    if (loading || !project) return;
    if (searchParams.get("action") !== "smartTrim") return;
    if (project.animationType !== "video") return;
    consumedActionRef.current = true;
    setSmartTrimOpen(true);
    router.replace(`/project/${projectId}`);
  }, [loading, project, projectId, router, searchParams]);

  // Auto-save with 2s debounce
  useEffect(() => {
    if (!project) return;
    const annotationsKey = JSON.stringify(terminalAnnotations ?? null);
    const hasCodeChanged = code !== lastSavedRef.current.code;
    const hasChatChanged = chatHistory.length !== lastSavedRef.current.chatLength;
    const hasAnnotationsChanged = annotationsKey !== lastSavedRef.current.annotations;
    const hasStyleChanged = styleMode !== lastSavedRef.current.styleMode;
    if (!hasCodeChanged && !hasChatChanged && !hasAnnotationsChanged && !hasStyleChanged) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, chatHistory, styleMode, ...(terminalAnnotations !== undefined ? { terminalAnnotations } : {}) }),
        });
        lastSavedRef.current = { code, chatLength: chatHistory.length, annotations: annotationsKey, styleMode };
      } catch {
        // silent fail
      }
    }, 2000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [code, chatHistory, terminalAnnotations, styleMode, project, projectId]);

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

  // Force save (Cmd+S)
  const forceSave = useCallback(async () => {
    if (!project) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, chatHistory, styleMode, ...(terminalAnnotations !== undefined ? { terminalAnnotations } : {}) }),
      });
      lastSavedRef.current = {
        code,
        chatLength: chatHistory.length,
        annotations: JSON.stringify(terminalAnnotations ?? null),
        styleMode,
      };
    } catch {
      // silent
    }
  }, [project, projectId, code, chatHistory, terminalAnnotations, styleMode]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "s") {
        e.preventDefault();
        forceSave();
      } else if (mod && e.key === "e") {
        e.preventDefault();
        if (code.trim()) setExportOpen(true);
      } else if (mod && e.key === "z" && !e.shiftKey) {
        // Only handle composition-level undo when focus is NOT inside Monaco
        const active = document.activeElement;
        const inMonaco = active?.closest(".monaco-editor");
        if (!inMonaco) {
          e.preventDefault();
          const prev = codeHistory.undo();
          if (prev !== null) setCode(prev);
        }
      } else if (mod && e.key === "z" && e.shiftKey) {
        const active = document.activeElement;
        const inMonaco = active?.closest(".monaco-editor");
        if (!inMonaco) {
          e.preventDefault();
          const next = codeHistory.redo();
          if (next !== null) setCode(next);
        }
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [forceSave, code, codeHistory]);

  // Snapshot code before AI generation starts
  const prevGeneratingRef = useRef(false);
  useEffect(() => {
    if (isGenerating && !prevGeneratingRef.current && code) {
      codeHistory.pushSnapshot(code);
    }
    prevGeneratingRef.current = isGenerating;
  }, [isGenerating, code, codeHistory]);

  const handleCodeChange = useCallback((newCode: string) => {
    setCode(newCode);
  }, []);

  const handleChatUpdate = useCallback((messages: ChatMessage[]) => {
    setChatHistory(messages);
  }, []);

  // Immediate save when generation completes (no debounce), then generate thumbnail
  const handleGenerationComplete = useCallback(async (finalCode: string, finalChat: ChatMessage[]) => {
    codeHistory.pushSnapshot(finalCode);
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
  }, [projectId, codeHistory, terminalAnnotations, styleMode]);

  const { durationInFrames, fps: extractedFps, sceneError } = useMemo(() => {
    if (!code || !code.trim()) return { durationInFrames: 250, fps: project?.settings.fps ?? 25, sceneError: undefined };
    const result = evalSceneCode(code);
    return {
      durationInFrames: result?.durationInFrames ?? 250,
      fps: result?.fps ?? project?.settings.fps ?? 25,
      sceneError: result?.error,
    };
  }, [code, project?.settings.fps]);

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
  const horizontalLayout = useDefaultLayout({
    id: `studio-h-${layoutKind}`,
    panelIds: ["main", "chat"],
    storage,
  });
  const verticalLayout = useDefaultLayout({
    id: `studio-v-${layoutKind}`,
    panelIds: layoutKind === "video" ? ["preview", "timeline", "code"] : ["preview", "code"],
    storage,
  });

  if (loading) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-2)", fontSize: 13 }}>
        Loading project...
      </div>
    );
  }

  if (!project) return null;

  const { width, height } = getResolution(project.settings.orientation, project.settings.resolution);
  const resLabel = project.settings.resolution === "4k" ? "3840\u00d72160" : "1920\u00d71080";
  const isVideoProject = project.animationType === "video";
  // The timeline panel mounts for every Remotion-scene project type too —
  // animation / broll / svg compositions are made of <Sequence> blocks and
  // can be reordered, trimmed, and split via the editable timeline.
  const hasTimeline =
    project.animationType === "video" ||
    project.animationType === "animation" ||
    project.animationType === "broll" ||
    project.animationType === "svg";

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 16px",
          height: 48,
          background: "var(--bg-2)",
          borderBottom: "0.5px solid var(--line-1)",
          position: "relative",
          zIndex: 5,
          flexShrink: 0,
        }}
      >
        <IconButton icon="arrowLeft" onClick={() => router.push("/")} title="Back to projects" />
        <Logo size={20} />
        <div style={{ width: 1, height: 20, background: "var(--line-2)", marginLeft: 4 }} />
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{project.name}</div>
          <div className="mono nums" style={{ fontSize: 10, color: "var(--text-2)" }}>
            {resLabel} &middot; {project.settings.fps}fps &middot;{" "}
            {project.settings.orientation === "horizontal" ? "16:9" : project.settings.orientation === "vertical" ? "9:16" : "1:1"}
          </div>
        </div>
        <TypeBadge type={project.animationType} />
        <div style={{ flex: 1 }} />
        {/* Undo / Redo */}
        <div style={{ display: "flex", gap: 1 }}>
          <IconButton
            icon="arrowLeft"
            size={26}
            title="Undo (Cmd+Z)"
            onClick={() => { const prev = codeHistory.undo(); if (prev !== null) setCode(prev); }}
            style={{ opacity: codeHistory.canUndo ? 1 : 0.3 }}
          />
          <IconButton
            icon="arrowRight"
            size={26}
            title="Redo (Cmd+Shift+Z)"
            onClick={() => { const next = codeHistory.redo(); if (next !== null) setCode(next); }}
            style={{ opacity: codeHistory.canRedo ? 1 : 0.3 }}
          />
        </div>
        <div style={{ width: 1, height: 20, background: "var(--line-2)" }} />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            padding: 3,
            background: "var(--bg-inset)",
            border: "0.5px solid var(--line-2)",
            borderRadius: "var(--r-sm)",
          }}
        >
          <span className="mono" style={{ fontSize: 10, color: "var(--text-2)", padding: "0 6px" }}>
            SAVED
          </span>
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "var(--accent)",
              marginRight: 6,
            }}
          />
        </div>
        {!isTerminalProject && (
          <ConvertAspectRatioButton
            projectId={projectId}
            currentOrientation={project.settings.orientation}
            disabled={!code.trim() || isGenerating}
          />
        )}
        {!isTerminalProject && (
          <Button variant="outline" size="sm" icon="layers" onClick={() => setSnippetsOpen(true)}>
            Snippets
          </Button>
        )}
        {hasTimeline && (
          <Button
            variant="outline"
            size="sm"
            icon="checkerboard"
            title="Remove background (Cmd+Z to undo)"
            disabled={!code.trim() || bgRemovedFlash}
            onClick={() => {
              const next = stripBackgroundsForTransparency(code);
              if (next === code) return;
              codeHistory.pushSnapshot(code);
              setCode(next);
              setBgRemovedFlash(true);
              setTimeout(() => setBgRemovedFlash(false), 1500);
            }}
          >
            {bgRemovedFlash ? "Removed" : "Remove background"}
          </Button>
        )}
        {isVideoProject && (
          <Button variant="outline" size="sm" icon="sparkle" onClick={() => setSmartTrimOpen(true)}>
            Smart trim
          </Button>
        )}
        <Button variant="outline" size="sm" icon="folder" onClick={() => setAssetsOpen(true)}>
          Assets
        </Button>
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
            disabled={!code.trim()}
          >
            Export
          </Button>
        )}
      </div>

      {/* Studio layout: resizable panels */}
      <div style={{ flex: 1, minHeight: 0, background: "var(--line-1)" }}>
        <Group
          orientation="horizontal"
          defaultLayout={horizontalLayout.defaultLayout}
          onLayoutChanged={horizontalLayout.onLayoutChanged}
          style={{ height: "100%" }}
        >
          <Panel id="main" defaultSize="72%" minSize="30%">
            <Group
              orientation="vertical"
              defaultLayout={verticalLayout.defaultLayout}
              onLayoutChanged={verticalLayout.onLayoutChanged}
              style={{ height: "100%" }}
            >
              <Panel id="preview" defaultSize={hasTimeline ? "55%" : "65%"} minSize="15%">
                <div style={{ background: "#000", height: "100%", minHeight: 0, minWidth: 0, overflow: "hidden" }}>
                  {isTerminalProject ? (
                    <TerminalPreview
                      projectId={projectId}
                      code={code}
                      onReplaceCode={(next) => {
                        if (code) codeHistory.pushSnapshot(code);
                        setCode(next);
                      }}
                      annotations={terminalAnnotations}
                      onAnnotationsChange={setTerminalAnnotations}
                      customTheme={customTheme}
                      onCustomThemeChange={handleCustomThemeChange}
                    />
                  ) : (
                    <PreviewPanel code={code} width={width} height={height} svgContents={project.svgContents} />
                  )}
                </div>
              </Panel>
              {hasTimeline && (
                <>
                  <Separator className="resize-handle resize-handle-horizontal" />
                  <Panel id="timeline" defaultSize="15%" minSize="8%">
                    <div style={{ background: "var(--bg-2)", height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
                      <Timeline
                        code={code}
                        fps={extractedFps}
                        durationInFrames={durationInFrames}
                        onCodeChange={(next) => {
                          if (code) codeHistory.pushSnapshot(code);
                          setCode(next);
                        }}
                      />
                    </div>
                  </Panel>
                </>
              )}
              <Separator className="resize-handle resize-handle-horizontal" />
              <Panel id="code" defaultSize={hasTimeline ? "30%" : "35%"} minSize="10%">
                <div style={{ background: "var(--bg-2)", height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
                  <CodeEditor
                    code={code}
                    onChange={handleCodeChange}
                    language={isTerminalProject ? "vhs" : "typescript"}
                    filename={isTerminalProject ? "tape.tape" : "Scene.tsx"}
                  />
                </div>
              </Panel>
            </Group>
          </Panel>
          <Separator className="resize-handle resize-handle-vertical" />
          <Panel id="chat" defaultSize="28%" minSize="18%" maxSize="50%">
            <div style={{ background: "var(--bg-2)", height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
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
                currentCode={code}
                autoSend={
                  !project.code &&
                  project.chatHistory.length === 0 &&
                  // For Smart Trim projects the dialog generates the composition,
                  // not the AI chat — captured from the URL once on mount before
                  // the ?action=smartTrim param gets cleaned.
                  initialAutoAction !== "smartTrim"
                }
                onGenerationComplete={handleGenerationComplete}
                sceneError={sceneError}
              />
            </div>
          </Panel>
        </Group>
      </div>

      <AssetBrowser
        open={assetsOpen}
        onClose={() => setAssetsOpen(false)}
        onCopyPath={() => {}}
      />

      <SnippetBrowser
        open={snippetsOpen}
        onClose={() => setSnippetsOpen(false)}
        hasExistingCode={code.trim().length > 0}
        onUseSnippet={(snippetCode) => {
          if (code) codeHistory.pushSnapshot(code);
          setCode(snippetCode);
        }}
      />

      <SmartTrimDialog
        open={smartTrimOpen}
        onClose={() => setSmartTrimOpen(false)}
        projectId={projectId}
        fps={extractedFps}
        hasMediaFolder={!!project.mediaFolder}
        hasExistingCode={code.trim().length > 0}
        onApply={(generatedCode) => {
          if (code) codeHistory.pushSnapshot(code);
          setCode(generatedCode);
        }}
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
          <ExportDialog
            open={exportOpen}
            onClose={() => setExportOpen(false)}
            code={exportCode}
            durationInFrames={exportDuration}
            fps={exportFps}
            width={exportWidth}
            height={exportHeight}
            projectName={project.name}
            projectId={projectId}
          />
        );
      })()}

      <GeneratingOverlay visible={isGenerating} />
    </div>
  );
}
