"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import GeneratingOverlay from "@/components/GeneratingOverlay";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import ChatPanel from "@/components/ChatPanel";
import AssetBrowser from "@/components/AssetBrowser";
import ExportDialog from "@/components/ExportDialog";
import ConvertAspectRatioButton from "@/components/ConvertAspectRatioButton";
import { evalSceneCode } from "@/remotion/DynamicScene";
import type { Project, ChatMessage } from "@/lib/types";
import { getResolution } from "@/lib/types";

const PreviewPanel = dynamic(() => import("@/components/PreviewPanel"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-muted text-sm">
      Loading preview...
    </div>
  ),
});

const CodeEditor = dynamic(() => import("@/components/CodeEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-muted text-sm">
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

  const handleCodeChange = useCallback((newCode: string) => {
    setCode(newCode);
  }, []);

  const handleChatUpdate = useCallback((messages: ChatMessage[]) => {
    setChatHistory(messages);
  }, []);

  // Immediate save when generation completes (no debounce), then generate thumbnail
  const handleGenerationComplete = useCallback(async (finalCode: string, finalChat: ChatMessage[]) => {
    // Cancel any pending debounced save
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
    // Generate thumbnail in background (fire and forget)
    fetch(`/api/projects/${projectId}/thumbnail`, { method: "POST" }).catch(() => {});
  }, [projectId]);

  const { durationInFrames, fps: extractedFps, sceneError } = useMemo(() => {
    if (!code || !code.trim()) return { durationInFrames: 250, fps: project?.settings.fps ?? 25, sceneError: undefined };
    const result = evalSceneCode(code);
    return {
      durationInFrames: result?.durationInFrames ?? 250,
      fps: result?.fps ?? project?.settings.fps ?? 25,
      sceneError: result?.error,
    };
  }, [code, project?.settings.fps]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-muted text-sm">
        Loading project...
      </div>
    );
  }

  if (!project) return null;

  const { width, height } = getResolution(project.settings.orientation, project.settings.resolution);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            &larr; Projects
          </button>
          <h1 className="text-sm font-semibold tracking-tight">{project.name}</h1>
          <span className="text-[10px] text-muted">
            {width}x{height} &middot; {project.settings.fps}fps
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ConvertAspectRatioButton
            projectId={projectId}
            currentOrientation={project.settings.orientation}
            disabled={!code.trim() || isGenerating}
          />
          <button
            onClick={() => setAssetsOpen(true)}
            className="px-3 py-1.5 text-xs text-muted border border-border rounded-lg hover:bg-surface-hover transition-colors"
          >
            Assets
          </button>
          <button
            onClick={() => setExportOpen(true)}
            disabled={!code.trim()}
            className="px-4 py-1.5 bg-accent text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            Export
          </button>
        </div>
      </header>

      {/* 2-column grid layout */}
      <div className="flex-1 flex min-h-0">
        {/* Left column: Preview (top 60%) + Chat (bottom 40%) */}
        <div className="w-[60%] flex flex-col min-h-0 shrink-0">
          <div className="h-[60%] min-h-0 border-b border-border">
            <PreviewPanel code={code} width={width} height={height} />
          </div>
          <div className="h-[40%] min-h-0">
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
              svgContent={project.svgContent}
              currentCode={code}
              autoSend={!project.code && project.chatHistory.length === 0}
              onGenerationComplete={handleGenerationComplete}
              sceneError={sceneError}
            />
          </div>
        </div>

        {/* Right column: Code editor (full height) */}
        <div className="w-[40%] border-l border-border min-h-0">
          <CodeEditor code={code} onChange={handleCodeChange} />
        </div>
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
