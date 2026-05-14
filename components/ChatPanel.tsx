"use client";

import React, { useState, useRef, useEffect } from "react";
import type { ChatMessage, SvgFile } from "@/lib/types";
import Icon from "@/components/ui/Icon";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";

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
  svgContents?: SvgFile[];
  currentCode: string;
  autoSend?: boolean;
  onGenerationComplete?: (code: string, chatHistory: ChatMessage[]) => void;
  sceneError?: string;
  styleMode?: import("@/lib/types").StyleMode;
  onStyleModeChange?: (mode: import("@/lib/types").StyleMode) => void;
}

export default function ChatPanel({
  projectId,
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
  svgContents,
  currentCode,
  autoSend,
  onGenerationComplete,
  sceneError,
  styleMode,
  onStyleModeChange,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [streamingContent, setStreamingContent] = useState("");
  const [attachedSvgs, setAttachedSvgs] = useState<SvgAttachment[]>([]);
  const [svgPickerOpen, setSvgPickerOpen] = useState(false);
  const [svgOptions, setSvgOptions] = useState<SvgAssetOption[]>([]);
  const [svgLoading, setSvgLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoSentRef = useRef(false);
  const svgPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isGenerating]);

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
      setAttachedSvgs((prev) => [...prev, { path: option.path, content: data.content, filename: data.filename }]);
    } catch {
      // ignore
    }
  }

  async function sendMessage(text: string) {
    if (!text.trim() || isGenerating) return;

    setIsGenerating(true);
    setStreamingContent("");

    let messageForAI = text.trim();
    if (sceneError) {
      messageForAI = `[SCENE ERROR: ${sceneError}]\n\n${messageForAI}`;
    }
    if (attachedSvgs.length > 0) {
      const svgBlock = attachedSvgs
        .map((svg, i) => `[SVG ${i + 1}: ${svg.filename}]\nPath: ${svg.path}\n${svg.content}\n[END SVG ${i + 1}]`)
        .join("\n\n");
      messageForAI = `${svgBlock}\n\n${messageForAI}`;
    }

    const displayText = attachedSvgs.length > 0
      ? `${text.trim()}\n\nAttached SVGs: ${attachedSvgs.map((s) => s.filename).join(", ")}`
      : text.trim();

    const userMessage: ChatMessage = { role: "user", content: displayText };
    const messagesForAI: ChatMessage[] = [...chatHistory, { role: "user", content: messageForAI }];
    const updatedHistory = [...chatHistory, userMessage];
    onChatUpdate(updatedHistory);

    setAttachedSvgs([]);

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
          svgContents,
          currentCode,
          projectId,
          styleMode,
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

      const textOnly = fullResponse.replace(/```[\s\S]*?```/g, "").trim();
      let doneNote: string;
      if (!fullResponse.trim()) {
        doneNote =
          "⚠️ The model returned an empty response. This sometimes happens with long prompts or model timeouts — try sending the message again.";
      } else if (finalCode && finalCode.length > 50) {
        doneNote = textOnly
          ? `${textOnly}\n\nAnimation generated — preview is live.`
          : "Animation generated — preview is live.";
      } else {
        doneNote = textOnly
          ? textOnly
          : "⚠️ The model responded but didn't produce a code block. Try rephrasing the request.";
      }
      const assistantMessage: ChatMessage = { role: "assistant", content: doneNote };
      const finalHistory = [...updatedHistory, assistantMessage];
      onChatUpdate(finalHistory);

      if (onGenerationComplete && finalCode && finalCode.length > 50) {
        onGenerationComplete(finalCode, finalHistory);
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

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Header */}
      <div
        style={{
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          borderBottom: "0.5px solid var(--line-1)",
        }}
      >
        <Icon name="chat" size={13} style={{ color: "var(--text-2)" }} />
        <span className="mono cap" style={{ color: "var(--text-1)" }}>
          Chat
        </span>
        <div style={{ flex: 1 }} />
        {onStyleModeChange && animationType !== "terminal" && animationType !== "video" && (
          <select
            value={styleMode ?? "default"}
            onChange={(e) => onStyleModeChange(e.target.value as import("@/lib/types").StyleMode)}
            title="Animation style — affects how the AI composes scenes"
            style={{
              fontSize: 10,
              fontFamily: "var(--mono)",
              padding: "3px 6px",
              background: "var(--bg-3)",
              color: "var(--text-1)",
              border: "0.5px solid var(--line-2)",
              borderRadius: 3,
              cursor: "pointer",
            }}
          >
            <option value="default">style: default</option>
            <option value="kinetic">style: kinetic</option>
            <option value="editorial">style: editorial</option>
            <option value="cinematic">style: cinematic</option>
          </select>
        )}
        <span className="mono nums" style={{ fontSize: 10, color: "var(--text-3)" }}>
          {chatHistory.length} msgs
        </span>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="vt-scroll"
        style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 14 }}
      >
        {/* Initial prompt */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 4,
                background: "var(--accent)",
                color: "var(--accent-ink)",
                display: "grid",
                placeItems: "center",
                fontSize: 9,
                fontWeight: 700,
              }}
            >
              <Icon name="sparkle" size={10} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-1)" }}>System</span>
          </div>
          <div
            style={{
              fontSize: 12.5,
              lineHeight: 1.55,
              color: "var(--text-0)",
              paddingLeft: 24,
              whiteSpace: "pre-wrap",
            }}
          >
            {initialPrompt}
          </div>
        </div>

        {chatHistory.map((msg, i) => {
          const isUser = msg.role === "user";
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    background: isUser ? "var(--bg-4)" : "var(--accent)",
                    color: isUser ? "var(--text-0)" : "var(--accent-ink)",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 9,
                    fontWeight: 700,
                  }}
                >
                  {isUser ? "Y" : <Icon name="sparkle" size={10} />}
                </div>
                <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-1)" }}>
                  {isUser ? "You" : "Studio"}
                </span>
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  lineHeight: 1.55,
                  color: "var(--text-0)",
                  paddingLeft: 24,
                  whiteSpace: "pre-wrap",
                }}
              >
                {msg.role === "assistant" ? <MessageContent content={msg.content} /> : msg.content}
              </div>
            </div>
          );
        })}

        {isGenerating && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginTop: 4,
              paddingLeft: 24,
              fontSize: 12,
              color: "var(--text-2)",
            }}
          >
            <span
              style={{
                width: 4,
                height: 4,
                borderRadius: "50%",
                background: "var(--accent)",
                animation: "vt-dot-fade 1.4s ease-in-out infinite",
              }}
            />
            <span
              style={{
                width: 4,
                height: 4,
                borderRadius: "50%",
                background: "var(--accent)",
                animation: "vt-dot-fade 1.4s ease-in-out .2s infinite",
              }}
            />
            <span
              style={{
                width: 4,
                height: 4,
                borderRadius: "50%",
                background: "var(--accent)",
                animation: "vt-dot-fade 1.4s ease-in-out .4s infinite",
              }}
            />
            <span style={{ marginLeft: 4 }}>Thinking...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: 10, borderTop: "0.5px solid var(--line-1)" }}>
        {/* SVG attachment chips */}
        {attachedSvgs.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
            {attachedSvgs.map((svg, i) => (
              <div
                key={i}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "2px 6px",
                  fontSize: 10,
                  background: "var(--accent-soft)",
                  border: "0.5px solid var(--accent-line)",
                  borderRadius: 3,
                  color: "var(--accent)",
                }}
              >
                <Icon name="image" size={10} />
                <span className="mono">{svg.filename}</span>
                <button
                  onClick={() => setAttachedSvgs((prev) => prev.filter((_, j) => j !== i))}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--accent)",
                    cursor: "pointer",
                    padding: 0,
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <Icon name="close" size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            padding: 8,
            background: "var(--bg-inset)",
            border: "0.5px solid var(--line-2)",
            borderRadius: "var(--r-sm)",
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask for a change..."
            rows={2}
            disabled={isGenerating}
            className="vt-scroll"
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text-0)",
              fontSize: 12.5,
              fontFamily: "inherit",
              resize: "none",
              padding: 0,
              lineHeight: 1.5,
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ position: "relative" }} ref={svgPickerRef}>
              <IconButton icon="attach" size={22} title="Attach SVG" onClick={openSvgPicker} disabled={isGenerating} />
              {svgPickerOpen && (
                <div
                  style={{
                    position: "absolute",
                    bottom: "100%",
                    left: 0,
                    marginBottom: 6,
                    width: 240,
                    maxHeight: 200,
                    overflowY: "auto",
                    background: "var(--bg-3)",
                    border: "0.5px solid var(--line-2)",
                    borderRadius: "var(--r-sm)",
                    boxShadow: "var(--sh-float)",
                    zIndex: 50,
                  }}
                >
                  <div
                    style={{
                      padding: "6px 10px",
                      borderBottom: "0.5px solid var(--line-1)",
                      fontSize: 10,
                      color: "var(--text-2)",
                      fontWeight: 500,
                    }}
                  >
                    Select SVG to animate
                  </div>
                  {svgLoading ? (
                    <div style={{ padding: 10, fontSize: 11, color: "var(--text-2)" }}>Loading...</div>
                  ) : svgOptions.length === 0 ? (
                    <div style={{ padding: 10, fontSize: 11, color: "var(--text-2)" }}>No SVG files in assets</div>
                  ) : (
                    <div style={{ padding: 4 }}>
                      {svgOptions.map((opt) => (
                        <button
                          key={opt.path}
                          onClick={() => selectSvg(opt)}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            padding: "6px 8px",
                            fontSize: 11,
                            color: "var(--text-0)",
                            background: "transparent",
                            border: "none",
                            borderRadius: 4,
                            cursor: "pointer",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-4)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <div style={{ fontWeight: 500 }}>{opt.name}</div>
                          <div className="mono" style={{ fontSize: 10, color: "var(--text-3)" }}>
                            {opt.path}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div style={{ flex: 1 }} />
            <span className="mono" style={{ fontSize: 10, color: "var(--text-3)", marginRight: 4 }}>
              <Kbd>&#8984;</Kbd> <Kbd>&#9166;</Kbd>
            </span>
            <Button variant="primary" size="sm" onClick={handleSend} disabled={!input.trim() || isGenerating} icon="send">
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 18,
        padding: "0 5px",
        fontSize: 10,
        color: "var(--text-1)",
        background: "var(--bg-3)",
        border: "0.5px solid var(--line-2)",
        borderRadius: 3,
      }}
    >
      {children}
    </span>
  );
}

function MessageContent({ content }: { content: string }) {
  const parts = content.split(/(```[\s\S]*?```)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("```")) {
          return (
            <details key={i} style={{ margin: "4px 0" }}>
              <summary style={{ color: "var(--accent)", cursor: "pointer", fontSize: 10 }}>Code block</summary>
              <pre className="mono" style={{ marginTop: 4, fontSize: 10, color: "var(--text-2)", overflowX: "auto" }}>
                {part}
              </pre>
            </details>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
