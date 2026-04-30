"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import GeneratingOverlay from "@/components/GeneratingOverlay";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import ChatPanel from "@/components/ChatPanel";
import AssetBrowser from "@/components/AssetBrowser";
import ExportDialog from "@/components/ExportDialog";
import ConvertAspectRatioButton from "@/components/ConvertAspectRatioButton";
import Timeline from "@/components/Timeline";
import { evalSceneCode } from "@/remotion/DynamicScene";
import type { Project, ChatMessage } from "@/lib/types";
import { getResolution } from "@/lib/types";
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
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [code, setCode] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<{ code: string; chatLength: number }>({ code: "", chatLength: 0 });
  const codeHistory = useCodeHistory();

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
        lastSavedRef.current = { code: data.code, chatLength: data.chatHistory.length };
      } catch {
        router.push("/");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId, router]);

  // Auto-save with 2s debounce
  useEffect(() => {
    if (!project) return;
    const hasCodeChanged = code !== lastSavedRef.current.code;
    const hasChatChanged = chatHistory.length !== lastSavedRef.current.chatLength;
    if (!hasCodeChanged && !hasChatChanged) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, chatHistory }),
        });
        lastSavedRef.current = { code, chatLength: chatHistory.length };
      } catch {
        // silent fail
      }
    }, 2000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [code, chatHistory, project, projectId]);

  // Force save (Cmd+S)
  const forceSave = useCallback(async () => {
    if (!project) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, chatHistory }),
      });
      lastSavedRef.current = { code, chatLength: chatHistory.length };
    } catch {
      // silent
    }
  }, [project, projectId, code, chatHistory]);

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
      lastSavedRef.current = { code: finalCode, chatLength: finalChat.length };
    } catch {
      // silent fail
    }
    fetch(`/api/projects/${projectId}/thumbnail`, { method: "POST" }).catch(() => {});
  }, [projectId, codeHistory]);

  const { durationInFrames, fps: extractedFps, sceneError } = useMemo(() => {
    if (!code || !code.trim()) return { durationInFrames: 250, fps: project?.settings.fps ?? 25, sceneError: undefined };
    const result = evalSceneCode(code);
    return {
      durationInFrames: result?.durationInFrames ?? 250,
      fps: result?.fps ?? project?.settings.fps ?? 25,
      sceneError: result?.error,
    };
  }, [code, project?.settings.fps]);

  const layoutKind = project?.animationType === "video" ? "video" : "still";
  const storage = typeof window !== "undefined" ? window.localStorage : undefined;
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
        <ConvertAspectRatioButton
          projectId={projectId}
          currentOrientation={project.settings.orientation}
          disabled={!code.trim() || isGenerating}
        />
        <Button variant="outline" size="sm" icon="folder" onClick={() => setAssetsOpen(true)}>
          Assets
        </Button>
        <Button
          variant="primary"
          size="sm"
          icon="download"
          onClick={() => setExportOpen(true)}
          disabled={!code.trim()}
        >
          Export
        </Button>
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
              <Panel id="preview" defaultSize={isVideoProject ? "55%" : "65%"} minSize="15%">
                <div style={{ background: "#000", height: "100%", minHeight: 0, minWidth: 0, overflow: "hidden" }}>
                  <PreviewPanel code={code} width={width} height={height} />
                </div>
              </Panel>
              {isVideoProject && (
                <>
                  <Separator className="resize-handle resize-handle-horizontal" />
                  <Panel id="timeline" defaultSize="15%" minSize="8%">
                    <div style={{ background: "var(--bg-2)", height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
                      <Timeline code={code} fps={extractedFps} durationInFrames={durationInFrames} />
                    </div>
                  </Panel>
                </>
              )}
              <Separator className="resize-handle resize-handle-horizontal" />
              <Panel id="code" defaultSize={isVideoProject ? "30%" : "35%"} minSize="10%">
                <div style={{ background: "var(--bg-2)", height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
                  <CodeEditor code={code} onChange={handleCodeChange} />
                </div>
              </Panel>
            </Group>
          </Panel>
          <Separator className="resize-handle resize-handle-vertical" />
          <Panel id="chat" defaultSize="28%" minSize="18%" maxSize="50%">
            <div style={{ background: "var(--bg-2)", height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
              <ChatPanel
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
                currentCode={code}
                autoSend={!project.code && project.chatHistory.length === 0}
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

      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        code={code}
        durationInFrames={durationInFrames}
        fps={extractedFps}
        width={width}
        height={height}
        projectName={project.name}
      />

      <GeneratingOverlay visible={isGenerating} />
    </div>
  );
}
