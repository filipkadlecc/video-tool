"use client";

import React, { useState, useRef, useEffect } from "react";
import type { ChatMessage } from "@/lib/types";

function extractCodeFromResponse(text: string): string {
  const fenceMatch = text.match(/```(?:tsx|typescript|jsx)?\s*\n([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const openFence = text.match(/```(?:tsx|typescript|jsx)?\s*\n([\s\S]*)/);
  if (openFence) return openFence[1].trim();
  return text.trim();
}

interface SvgAttachment {
  path: string;
  content: string;
  filename: string;
}

interface SvgAssetOption {
  name: string;
  path: string;
}

interface ChatPanelProps {
  projectId: string;
  chatHistory: ChatMessage[];
  initialPrompt: string;
  onCodeUpdate: (code: string) => void;
  onChatUpdate: (messages: ChatMessage[]) => void;
  isGenerating: boolean;
  setIsGenerating: (v: boolean) => void;
  projectSettings: {
    resolution: string;
    orientation: string;
    fps: number;
  };
  animationType: string;
  notionContent?: string;
  scriptWithTimestamps?: string;
  svgContent?: string;
  currentCode: string;
  autoSend?: boolean;
  onGenerationComplete?: (code: string, chatHistory: ChatMessage[]) => void;
  sceneError?: string;
}

export default function ChatPanel({
  chatHistory,
  initialPrompt,
  onCodeUpdate,
  onChatUpdate,
  isGenerating,
  setIsGenerating,
  projectSettings,
  animationType,
  notionContent,
  scriptWithTimestamps,
  svgContent,
  currentCode,
  autoSend,
  onGenerationComplete,
  sceneError,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [streamingContent, setStreamingContent] = useState("");
  const [attachedSvg, setAttachedSvg] = useState<SvgAttachment | null>(null);
  const [svgPickerOpen, setSvgPickerOpen] = useState(false);
  const [svgOptions, setSvgOptions] = useState<SvgAssetOption[]>([]);
  const [svgLoading, setSvgLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const autoSentRef = useRef(false);
  const svgPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isGenerating]);

  // Close SVG picker on outside click
  useEffect(() => {
    if (!svgPickerOpen) return;
    function handleClick(e: MouseEvent) {
      if (svgPickerRef.current && !svgPickerRef.current.contains(e.target as Node)) {
        setSvgPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [svgPickerOpen]);

  // Auto-send initial prompt for new projects
  useEffect(() => {
    if (autoSend && !autoSentRef.current && !isGenerating && chatHistory.length === 0) {
      autoSentRef.current = true;
      sendMessage(initialPrompt);
    }
  }, [autoSend]); // eslint-disable-line react-hooks/exhaustive-deps

  async function openSvgPicker() {
    setSvgPickerOpen(true);
    setSvgLoading(true);
    try {
      const res = await fetch("/api/assets");
      if (!res.ok) return;
      const groups: { folder: string; items: { name: string; path: string; type: string }[] }[] = await res.json();
      const svgs: SvgAssetOption[] = [];
      for (const group of groups) {
        for (const item of group.items) {
          if (item.type === "svg") {
            svgs.push({ name: item.name, path: item.path });
          }
        }
      }
      setSvgOptions(svgs);
    } catch {
      // ignore
    } finally {
      setSvgLoading(false);
    }
  }

  async function selectSvg(option: SvgAssetOption) {
    setSvgPickerOpen(false);
    try {
      const res = await fetch(`/api/assets/content?path=${encodeURIComponent(option.path)}`);
      if (!res.ok) return;
      const data: { content: string; filename: string } = await res.json();
      setAttachedSvg({ path: option.path, content: data.content, filename: data.filename });
    } catch {
      // ignore
    }
  }

  async function sendMessage(text: string) {
    if (!text.trim() || isGenerating) return;

    setIsGenerating(true);
    setStreamingContent("");

    // Build the AI message with context
    let messageForAI = text.trim();
    if (sceneError) {
      messageForAI = `[SCENE ERROR: ${sceneError}]\n\n${messageForAI}`;
    }
    if (attachedSvg) {
      messageForAI = `[SVG TO ANIMATE: ${attachedSvg.filename}]\nPath: ${attachedSvg.path}\n${attachedSvg.content}\n[END SVG]\n\n${messageForAI}`;
    }

    // User-visible message shows attachment info but not the SVG content
    const displayText = attachedSvg
      ? `${text.trim()}\n\nAttached SVG: ${attachedSvg.filename}`
      : text.trim();

    const userMessage: ChatMessage = { role: "user", content: displayText };
    const messagesForAI: ChatMessage[] = [...chatHistory, { role: "user", content: messageForAI }];
    const updatedHistory = [...chatHistory, userMessage];
    onChatUpdate(updatedHistory);

    // Clear attachment after sending
    setAttachedSvg(null);

    let fullResponse = "";

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messagesForAI,
          projectSettings,
          animationType,
          notionContent,
          scriptWithTimestamps,
          svgContent,
          currentCode,
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status}: ${body}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                fullResponse += parsed.text;
                const extracted = extractCodeFromResponse(fullResponse);
                if (extracted && extracted.length > 50) {
                  onCodeUpdate(extracted);
                }
              }
            } catch {
              // incomplete JSON chunk
            }
          }
        }
      }

      const finalCode = extractCodeFromResponse(fullResponse);
      if (finalCode && finalCode.length > 50) {
        onCodeUpdate(finalCode);
      }

      // Strip the code block from the visible message and append a done note
      const textOnly = fullResponse.replace(/```[\s\S]*?```/g, "").trim();
      const doneNote = textOnly
        ? `${textOnly}\n\nAnimation generated — preview is live.`
        : "Animation generated — preview is live.";
      const assistantMessage: ChatMessage = { role: "assistant", content: doneNote };
      const finalHistory = [...updatedHistory, assistantMessage];
      onChatUpdate(finalHistory);

      // Immediate save
      if (onGenerationComplete) {
        onGenerationComplete(finalCode || currentCode, finalHistory);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      const errorMessage: ChatMessage = { role: "assistant", content: `Error: ${msg}` };
      onChatUpdate([...updatedHistory, errorMessage]);
    } finally {
      setIsGenerating(false);
      setStreamingContent("");
    }
  }

  function handleSend() {
    if (!input.trim()) return;
    const text = input;
    setInput("");
    sendMessage(text);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  }

  const displayMessages = chatHistory;

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border">
        <span className="text-sm font-medium text-muted">Chat</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {/* Initial prompt display */}
        <div className="bg-accent/10 border border-accent/20 rounded-lg p-3">
          <p className="text-[10px] text-accent font-medium mb-1">Initial Prompt</p>
          <p className="text-xs text-foreground whitespace-pre-wrap">{initialPrompt}</p>
        </div>

        {displayMessages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-lg p-3 text-xs whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-accent/20 text-foreground"
                  : "bg-surface border border-border text-foreground"
              }`}
            >
              {msg.role === "assistant" ? (
                <MessageContent content={msg.content} />
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}

        {isGenerating && (
          <div className="flex justify-start">
            <div className="rounded-lg p-3 bg-surface border border-border">
              <p className="text-xs text-accent">Generating...</p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 border-t border-border space-y-2">
        {/* SVG attachment chip */}
        {attachedSvg && (
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1.5 bg-accent/15 border border-accent/30 rounded-full px-3 py-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M7 12l3 3 7-7" />
              </svg>
              <span className="text-[11px] text-accent font-medium">{attachedSvg.filename}</span>
              <button
                onClick={() => setAttachedSvg(null)}
                className="text-accent/60 hover:text-accent ml-0.5"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        <div className="relative flex gap-2">
          <textarea
            className="flex-1 bg-background border border-border rounded-lg p-3 text-sm text-foreground resize-none focus:outline-none focus:border-accent placeholder:text-muted"
            rows={3}
            placeholder="Describe changes... (Cmd+Enter to send)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isGenerating}
          />
          {/* SVG attach button */}
          <div className="relative" ref={svgPickerRef}>
            <button
              onClick={openSvgPicker}
              disabled={isGenerating}
              title="Attach SVG to animate"
              className="h-full px-2.5 border border-border rounded-lg text-muted hover:text-accent hover:border-accent disabled:opacity-50 transition-colors flex items-center"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
                <polyline points="14 2 14 8 20 8" />
                <text x="8" y="18" fontSize="7" fontWeight="bold" fill="currentColor" stroke="none">SVG</text>
              </svg>
            </button>

            {/* SVG picker dropdown */}
            {svgPickerOpen && (
              <div className="absolute bottom-full right-0 mb-2 w-64 max-h-60 overflow-y-auto bg-surface border border-border rounded-lg shadow-lg z-50">
                <div className="p-2 border-b border-border">
                  <span className="text-[10px] font-medium text-muted">Select SVG to animate</span>
                </div>
                {svgLoading ? (
                  <div className="p-3 text-xs text-muted">Loading...</div>
                ) : svgOptions.length === 0 ? (
                  <div className="p-3 text-xs text-muted">No SVG files found in assets</div>
                ) : (
                  <div className="p-1">
                    {svgOptions.map((opt) => (
                      <button
                        key={opt.path}
                        onClick={() => selectSvg(opt)}
                        className="w-full text-left px-3 py-2 text-xs text-foreground hover:bg-accent/10 rounded-md transition-colors"
                      >
                        <div className="font-medium truncate">{opt.name}</div>
                        <div className="text-[10px] text-muted truncate">{opt.path}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <button
          onClick={handleSend}
          disabled={!input.trim() || isGenerating}
          className="w-full py-2 bg-accent text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          {isGenerating ? "Generating..." : "Send"}
        </button>
      </div>
    </div>
  );
}

function MessageContent({ content }: { content: string }) {
  // Show text outside code fences, collapse code blocks
  const parts = content.split(/(```[\s\S]*?```)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("```")) {
          return (
            <details key={i} className="my-1">
              <summary className="text-accent cursor-pointer text-[10px]">Code block</summary>
              <pre className="mt-1 text-[10px] text-muted overflow-x-auto">{part}</pre>
            </details>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
