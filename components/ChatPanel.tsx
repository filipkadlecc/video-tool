"use client";

import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import type { ChatMessage, SvgFile } from "@/lib/types";
import { findItem, type EditorDoc, type EditorItem } from "@/lib/editor-doc";
import { timecode, needsHours } from "@/lib/timecode";
import Icon from "@/components/ui/Icon";
import Kbd from "@/components/ui/Kbd";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import { normalizeTapeQuotes } from "@/lib/tape-parser";
import { usePlayheadStore, usePlayheadFrame } from "@/hooks/usePlayhead";
import { SkeletonList } from "@/components/ui/Skeleton";
import type { DocChange } from "@/lib/editor-agent";

function extractCodeFromResponse(text: string, animationType?: string): string {
  // Accept tsx/js/html fences — older responses used a variety of them.
  const fenceMatch = text.match(/```(?:tsx|typescript|jsx|js|javascript|html|tape|vhs)?\s*\n([\s\S]*?)```/);
  let extracted = "";
  if (fenceMatch) {
    extracted = fenceMatch[1].trim();
  } else {
    const openFence = text.match(/```(?:tsx|typescript|jsx|js|javascript|html|tape|vhs)?\s*\n([\s\S]*)/);
    if (openFence) {
      extracted = openFence[1].trim();
    } else if (animationType === "terminal" && text.trim().length > 0) {
      // No code fence. For terminal projects, the AI is instructed to emit only
      // the .tape content, so an unfenced response is the script itself.
      extracted = text.trim();
    }
    // For non-terminal types with no fence, the model usually returns
    // prose-only; returning that would clobber Scene.tsx with markdown, so we
    // signal "no code" and preserve the existing file.
  }
  if (!extracted) return "";
  // VHS doesn't support backslash-escaped quotes; the AI occasionally emits
  // them anyway. Rewrite Type lines to use a quote style that actually parses.
  if (animationType === "terminal") extracted = normalizeTapeQuotes(extracted);
  return extracted;
}

/** What a clip is called in a chip: its words, its file, or its kind. */
function chipLabel(doc: EditorDoc, item: EditorItem): string {
  if (item.type === "text") return (item as { text?: string }).text?.slice(0, 32) || "Text";
  if (item.type === "scene" && "snippet" in item && item.snippet) return String(item.snippet.id);
  // A footage clip is its file, never "video" — the chip has to name the clip
  // you picked, and every clip on the track answers to "video".
  const assetId = (item as { assetId?: string }).assetId;
  const asset = assetId ? doc.assets.find((a) => a.id === assetId) : undefined;
  return asset?.name ?? item.type;
}

/** The 10px swatch. A clip that HAS a colour shows it; everything else is neutral. */
function chipSwatch(item: EditorItem): string {
  if (item.type === "solid") return (item as { color?: string }).color ?? "var(--ink-tertiary)";
  if (item.type === "text") return (item as { style?: { color?: string } }).style?.color ?? "var(--ink-tertiary)";
  return "var(--ink-tertiary)";
}

/**
 * The playhead as a chip.
 *
 * Its own component because it is the only thing here that changes 25 times a
 * second — subscribing the whole chat panel to the playhead would re-render
 * every message in the conversation on every frame of playback.
 */
function TimecodeChip({ fps }: { fps: number }) {
  const frame = usePlayheadFrame();
  return (
    <span style={chipStyle} className="t-data-s">
      @{timecode(frame, fps, needsHours(frame, fps))}
    </span>
  );
}

const chipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  height: 24,
  padding: "0 8px",
  borderRadius: "var(--r-pill)",
  background: "var(--surface-raised)",
  border: "1px solid var(--border-edge)",
  color: "var(--ink-secondary)",
  fontSize: 11,
};

interface SvgAttachment {
  path: string;
  content: string;
  filename: string;
}

interface SvgAssetOption {
  name: string;
  path: string;
}

export interface ChatPanelHandle {
  /** Programmatically send a prompt as if the user had typed it.
   *  Pass `overrideCode` when the caller has just mutated the editor code
   *  and React hasn't yet propagated the new value into our props. */
  runWithPrompt(prompt: string, opts?: { overrideCode?: string }): void;
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
  topicCardStyle?: import("@/lib/types").TopicCardStyle;
  transitionStyle?: import("@/lib/types").TransitionStyle;
  onTransitionStyleChange?: (mode: import("@/lib/types").TransitionStyle) => void;
  useSfx?: boolean;
  onUseSfxChange?: (v: boolean) => void;
  /**
   * With a document open the chat edits the TIMELINE instead of the code file:
   * the same box, pointed at /api/edit-doc, where the model drives real editing
   * tools rather than writing TSX. Without one, nothing below changes.
   */
  doc?: EditorDoc;
  selectedIds?: string[];
  onDocChanged?: (doc: EditorDoc, opts?: { transient?: boolean }) => void;
  /** Put the last AI edit back. */
  onUndoEdit?: () => void;
  /** Select the clips an AI edit touched. */
  onSelectItems?: (ids: string[]) => void;
  /**
   * The last AI edit, OWNED BY THE PAGE.
   *
   * It used to be state in here, which meant switching to Cut unmounted this
   * panel and threw the receipt away — the one moment you most want to see what
   * the model did is when you go and look at the timeline it just changed.
   */
  receipt?: DocChange[] | null;
  onReceipt?: (receipt: DocChange[] | null) => void;
  /** Drop a context chip — the clip stops being sent with the next message. */
  onDeselectItem?: (id: string) => void;
}

const ChatPanel = forwardRef<ChatPanelHandle, ChatPanelProps>(function ChatPanel(
  {
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
    topicCardStyle,
    transitionStyle,
    onTransitionStyleChange,
    useSfx,
    onUseSfxChange,
    doc,
    selectedIds,
    onDocChanged,
    onUndoEdit,
    onSelectItems,
    receipt,
    onReceipt,
    onDeselectItem,
  },
  ref,
) {
  // Only needed when a message is sent, so this never subscribes.
  const playhead = usePlayheadStore();
  /**
   * The last AI edit, as a list of what actually moved.
   *
   * It stays on screen until you Keep or Undo it, because "you must never lose
   * track of what the model did" is the whole reason it exists — a sentence
   * claiming what changed is not the same as being able to check it.
   *
   * The page owns it (see the `receipt` prop); this is only the setter so the
   * stream can report what it landed.
   */
  const setReceipt = onReceipt ?? (() => {});
  const [input, setInput] = useState("");
  const [streamingContent, setStreamingContent] = useState("");
  const [attachedSvgs, setAttachedSvgs] = useState<SvgAttachment[]>([]);
  const [svgPickerOpen, setSvgPickerOpen] = useState(false);
  const [svgOptions, setSvgOptions] = useState<SvgAssetOption[]>([]);
  const [svgLoading, setSvgLoading] = useState(false);
  /** A clip is hovering over the composer. */
  const [dropping, setDropping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoSentRef = useRef(false);
  const svgPickerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Synchronous mirror of isGenerating — the prop's setter is async, so we
  // can't rely on the React state to gate re-entry inside sendMessage when
  // runWithPrompt fires while a stream is already in flight.
  const generatingRef = useRef(false);

  /** The one clip this receipt is about, or null when it spans several. */
  const oneClip = receipt?.length
    ? (new Set(receipt.map((c) => c.itemId)).size === 1 ? receipt[0].label : null)
    : null;

  /** The selected clips, named and coloured, for the composer's context chips. */
  const contextClips = (selectedIds ?? []).flatMap((id) => {
    const found = doc ? findItem(doc, id) : null;
    if (!found) return [];
    return [{ id, label: chipLabel(doc!, found.item), swatch: chipSwatch(found.item) }];
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    // streamingContent too, or the view stops following once the prose starts.
  }, [chatHistory, isGenerating, streamingContent]);

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

  useImperativeHandle(
    ref,
    () => ({
      runWithPrompt(prompt, opts) {
        // Force preemption: if an autoSend / earlier prompt is mid-stream,
        // abort it and start the new one immediately. Without this the snippet
        // customize silently bails when autoSend is racing with the click.
        sendMessage(prompt, opts?.overrideCode, { force: true });
      },
    }),
    // sendMessage is stable for the lifetime of the component (defined inline),
    // but its closure captures props — re-bind the handle whenever any prop
    // sendMessage reads changes, otherwise runWithPrompt would use stale state.
    //
    // `doc` MUST be in here. sendMessage branches on it to choose /api/edit-doc
    // over /api/generate, and a timeline created AFTER mount (the "Start a
    // timeline" button) would otherwise leave runWithPrompt closed over
    // doc === undefined — so a first pass would write a TSX file and silently
    // ignore the timeline it was supposed to fill.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chatHistory, currentCode, isGenerating, projectSettings, animationType, notionContent, scriptWithTimestamps, svgContents, projectId, styleMode, topicCardStyle, transitionStyle, useSfx, attachedSvgs, sceneError, doc, selectedIds, playhead, onDocChanged],
  );

  async function sendMessage(text: string, overrideCode?: string, opts: { force?: boolean } = {}) {
    if (!text.trim()) return;
    if (generatingRef.current) {
      if (opts.force && abortRef.current) {
        // Cancel the in-flight stream. Its catch branch handles AbortError
        // silently and won't append a stale assistant message.
        abortRef.current.abort();
      } else {
        return;
      }
    }

    const controller = new AbortController();
    abortRef.current = controller;
    generatingRef.current = true;
    setIsGenerating(true);
    setStreamingContent("");
    /*
     * The old receipt belongs to the old edit. Leaving it up while a new turn
     * runs was the bug: if the new edit produced no recognised change the panel
     * simply kept showing the previous one, and its Undo — which steps history
     * back once — then undid the NEW edit while claiming to undo the old.
     */
    setReceipt(null);

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
      // The timeline is open: edit the document, not the code file.
      if (doc && onDocChanged) {
        await editDocument(messagesForAI, updatedHistory, controller);
        return;
      }
      /*
       * A project WITH a document must never fall through to /api/generate.
       * That route writes a TSX scene, which for a timeline project means the
       * chat quietly stops editing the thing on screen and starts overwriting a
       * file instead. If the document is here but the commit handler isn't,
       * that is a wiring mistake, and failing loudly beats editing the wrong
       * artefact.
       */
      if (doc) {
        throw new Error("This project is a timeline — chat can't write a scene file for it.");
      }

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: messagesForAI,
          projectSettings,
          animationType,
          notionContent,
          scriptWithTimestamps,
          svgContents,
          currentCode: overrideCode ?? currentCode,
          projectId,
          styleMode,
          topicCardStyle,
          transitionStyle,
          useSfx,
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
            let parsed: { text?: string; error?: string };
            try {
              parsed = JSON.parse(data);
            } catch {
              continue; // incomplete JSON chunk
            }
            // A failure mid-run arrives as an event, not an HTTP error. It was
            // being dropped, so the chat just said "empty response".
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.text) {
              fullResponse += parsed.text;
              const extracted = extractCodeFromResponse(fullResponse, animationType);
              if (extracted && extracted.length > 50) {
                onCodeUpdate(extracted);
              }
            }
          }
        }
      }

      const finalCode = extractCodeFromResponse(fullResponse, animationType);
      if (finalCode && finalCode.length > 50) {
        onCodeUpdate(finalCode);
      }

      // For terminal projects, the AI may emit the entire .tape script without
      // any fences (legacy responses) — treat the whole thing as code so it
      // doesn't get duplicated into the chat as prose.
      const hadFence = /```[\s\S]*?```/.test(fullResponse);
      const textOnly =
        animationType === "terminal" && !hadFence && finalCode && finalCode.length > 50
          ? ""
          : fullResponse.replace(/```[\s\S]*?```/g, "").trim();
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
      // Preempted by a later runWithPrompt — drop the partial state silently.
      // The new sendMessage call has already taken over generatingRef / abortRef
      // and will emit its own chat updates.
      if ((err as { name?: string } | null)?.name === "AbortError") {
        return;
      }
      const msg = err instanceof Error ? err.message : "Unknown error";
      const errorMessage: ChatMessage = { role: "assistant", content: `Error: ${msg}` };
      onChatUpdate([...updatedHistory, errorMessage]);
    } finally {
      // Only clear the global flags if this invocation still owns them — a
      // preempting call will have swapped abortRef.current to its own controller.
      if (abortRef.current === controller) {
        abortRef.current = null;
        generatingRef.current = false;
        setIsGenerating(false);
        setStreamingContent("");
      }
    }
  }

  /**
   * Ask the AI to edit the open timeline.
   *
   * The server owns the document while the turn runs and streams it back, so a
   * turn that fails part-way can never leave a half-applied edit here. Documents
   * arriving mid-turn are applied but NOT recorded (`transient`), and the last
   * one commits — that is what makes a ten-tool-call edit a single Cmd+Z, using
   * the same mechanism a mouse drag already uses.
   */
  async function editDocument(
    messagesForAI: ChatMessage[],
    updatedHistory: ChatMessage[],
    controller: AbortController,
  ) {
    let fullResponse = "";
    let latestDoc: EditorDoc | null = null;
    let edited = false;

    const res = await fetch("/api/edit-doc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        messages: messagesForAI,
        doc,
        projectId,
        selectedIds: selectedIds ?? [],
        playheadFrame: playhead.getFrame(),
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    // SSE events can be split across chunks — buffer until a full line arrives,
    // or a document (which is large) gets dropped as unparseable JSON.
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6);
        if (data === "[DONE]") continue;
        let parsed: { text?: string; doc?: EditorDoc; transient?: boolean; error?: string; edited?: boolean; changes?: DocChange[] };
        try {
          parsed = JSON.parse(data);
        } catch {
          continue;
        }
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.text) {
          fullResponse += parsed.text;
          setStreamingContent(fullResponse);
        }
        if (parsed.doc) {
          latestDoc = parsed.doc;
          onDocChanged?.(parsed.doc, { transient: parsed.transient === true });
        }
        if (parsed.changes?.length) setReceipt(parsed.changes);
        if (parsed.edited) edited = true;
      }
    }

    // Commit whatever the turn ended on, so the whole turn is one undo step even
    // if the stream only ever sent transient updates.
    if (latestDoc) onDocChanged?.(latestDoc);

    const said = fullResponse.replace(/```[\s\S]*?```/g, "").trim();
    const note = said
      ? said
      : edited
        ? "Done — the timeline is updated."
        : "⚠️ The model didn't change anything. Try saying more specifically what to edit.";
    onChatUpdate([...updatedHistory, { role: "assistant", content: note }]);
  }

  function handleSend() {
    if (!input.trim()) return;
    const text = input;
    setInput("");
    sendMessage(text);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    // Enter sends; Shift+Enter inserts a newline.
    if (e.key === "Enter" && !e.shiftKey) {
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
          borderBottom: "1px solid var(--border-hairline)",
        }}
      >
        <Icon name="chat" size={13} style={{ color: "var(--ink-tertiary)" }} />
        <span className="mono cap" style={{ color: "var(--ink-secondary)" }}>
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
              fontFamily: "var(--font-mono)",
              padding: "3px 6px",
              background: "var(--surface-raised)",
              color: "var(--ink-secondary)",
              border: "1px solid var(--border-hairline)",
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
        {onTransitionStyleChange && animationType !== "terminal" && animationType !== "video" && (
          <select
            value={transitionStyle ?? "cut"}
            onChange={(e) => onTransitionStyleChange(e.target.value as import("@/lib/types").TransitionStyle)}
            title="How scenes transition — affects the AI's scene handoffs"
            style={{
              fontSize: 10,
              fontFamily: "var(--font-mono)",
              padding: "3px 6px",
              background: "var(--surface-raised)",
              color: "var(--ink-secondary)",
              border: "1px solid var(--border-hairline)",
              borderRadius: 3,
              cursor: "pointer",
            }}
          >
            <option value="cut">transition: cut</option>
            <option value="blend">transition: blend</option>
            <option value="camera">transition: camera</option>
          </select>
        )}
        {onUseSfxChange && animationType !== "terminal" && (
          <button
            onClick={() => onUseSfxChange(!useSfx)}
            title="Toggle whether the AI may add sound effects"
            className="mono"
            style={{
              fontSize: 10,
              padding: "3px 6px",
              background: useSfx ? "var(--brand-tint-bg)" : "var(--surface-raised)",
              color: useSfx ? "var(--brand)" : "var(--ink-tertiary)",
              border: `1px solid ${useSfx ? "var(--brand-tint-line)" : "var(--border-hairline)"}`,
              borderRadius: 3,
              cursor: "pointer",
            }}
          >
            sfx: {useSfx ? "on" : "off"}
          </button>
        )}
        <span className="mono nums" style={{ fontSize: 10, color: "var(--ink-disabled)" }}>
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
                background: "var(--brand)",
                color: "var(--brand-ink)",
                display: "grid",
                placeItems: "center",
                fontSize: 9,
                fontWeight: 700,
              }}
            >
              <Icon name="sparkle" size={10} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 500, color: "var(--ink-secondary)" }}>System</span>
          </div>
          <div
            style={{
              fontSize: 12.5,
              lineHeight: 1.55,
              color: "var(--ink-primary)",
              paddingLeft: 24,
              whiteSpace: "pre-wrap",
            }}
          >
            {initialPrompt}
          </div>
        </div>

        {/*
          The two roles are drawn differently ON PURPOSE.

          They used to share one layout — same avatar, same label, same
          left-aligned prose — so a long conversation read as one voice talking
          to itself and you had to read the words to find your own question. A
          bubble on the right is the fastest "you said this" there is, and the
          assistant, which writes the long answers, gets the full width.
        */}
        {chatHistory.map((msg, i) => (
          msg.role === "user" ? (
            <div key={i} style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
              <div
                className="t-body"
                style={{
                  maxWidth: "88%",
                  background: "var(--surface-hover)",
                  borderRadius: "6px 6px 2px 6px",
                  padding: "10px 12px",
                  color: "var(--ink-primary)",
                  whiteSpace: "pre-wrap",
                }}
              >
                {msg.content}
              </div>
            </div>
          ) : (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div
                  style={{
                    width: 18, height: 18, borderRadius: 4,
                    background: "var(--brand)", color: "var(--brand-ink)",
                    display: "grid", placeItems: "center",
                  }}
                >
                  <Icon name="sparkle" size={10} />
                </div>
                <span className="t-caption" style={{ fontWeight: 600, color: "var(--ink-secondary)" }}>Assistant</span>
              </div>
              <div
                className="t-body"
                style={{ color: "var(--ink-primary)", paddingLeft: 24, whiteSpace: "pre-wrap" }}
              >
                <MessageContent content={msg.content} />
              </div>
            </div>
          )
        ))}

        {/*
          Working, as a state rather than as punctuation.

          Three pulsing dots say "something is happening" and nothing else. The
          pill says the assistant has the turn, and the skeleton bars say an
          answer of roughly this size is coming — which is the difference
          between waiting and wondering whether it has wedged. The bars give way
          the moment there are real words to show.
        */}
        {isGenerating && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  width: 18, height: 18, borderRadius: 4,
                  background: "var(--brand)", color: "var(--brand-ink)",
                  display: "grid", placeItems: "center",
                }}
              >
                <Icon name="sparkle" size={10} />
              </div>
              <span className="t-caption" style={{ fontWeight: 600, color: "var(--ink-secondary)" }}>Assistant</span>
              <span
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  height: 18, padding: "0 7px", borderRadius: "var(--r-pill)",
                  background: "rgba(52,208,107,0.12)",
                }}
              >
                <span
                  style={{
                    width: 5, height: 5, borderRadius: "50%", background: "var(--live)",
                    animation: "vt-dot-fade 1.4s ease-in-out infinite",
                  }}
                />
                <span className="t-caption" style={{ color: "var(--live)" }}>
                  {streamingContent.trim() ? "Working" : "Thinking"}
                </span>
              </span>
            </div>
            {!streamingContent.trim() && (
              <div style={{ paddingLeft: 24 }}>
                <SkeletonList rows={2} />
              </div>
            )}
          </div>
        )}

        {/*
          What the AI is saying WHILE it works. It was being accumulated and
          thrown away, so a ninety-second timeline edit showed three dots and
          nothing else — you could not tell whether it had understood you, was
          part-way through, or had wedged.
          Only on the timeline path: the /api/generate stream is mostly a TSX
          file, and streaming a scene file into the chat would be noise.
        */}
        {isGenerating && doc && streamingContent.trim() && (
          <div
            style={{
              marginTop: 6,
              paddingLeft: 24,
              fontSize: 12,
              lineHeight: 1.5,
              color: "var(--ink-tertiary)",
              whiteSpace: "pre-wrap",
            }}
          >
            {streamingContent.trim()}
          </div>
        )}

        {/* The AI edit receipt: what actually moved, and a way to put it back.
            Old value struck through, new value in full ink — the shape you read
            as "this became that". */}
        {receipt && receipt.length > 0 && !isGenerating && (
          <div
            style={{
              marginTop: 10,
              background: "var(--surface-raised)",
              border: "1px solid var(--border-edge)",
              borderRadius: "var(--r-panel)",
              padding: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span className="t-section" style={{ color: "var(--ink-tertiary)" }}>Changed</span>
              {/* When every row is about the same clip, name it ONCE up here.
                  Repeating it on each row spent the width that the values
                  themselves need, and a wrapped value is unreadable. */}
              {oneClip && (
                <span className="t-caption" style={{ color: "var(--ink-disabled)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {oneClip}
                </span>
              )}
              <div style={{ flex: 1 }} />
              <span className="t-caption" style={{ color: "var(--ink-tertiary)", flexShrink: 0 }}>
                {receipt.length} {receipt.length === 1 ? "edit" : "edits"}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
              {receipt.slice(0, 6).map((c, i) => (
                <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span className="t-data-m" style={{ color: "var(--ink-tertiary)", minWidth: 52, flexShrink: 0 }}>{c.field}</span>
                  {c.before && (
                    <span className="t-data-m" style={{ color: "var(--ink-tertiary)", textDecoration: "line-through", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.before}
                    </span>
                  )}
                  {c.before && c.after && <Icon name="arrowRight" size={11} style={{ color: "var(--ink-disabled)", flexShrink: 0 }} />}
                  {c.after && (
                    <span className="t-data-m" style={{ color: "var(--ink-primary)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.after}
                    </span>
                  )}
                  {!oneClip && (
                    <span className="t-caption" style={{ color: "var(--ink-disabled)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.label}
                    </span>
                  )}
                </div>
              ))}
              {receipt.length > 6 && (
                <span className="t-caption" style={{ color: "var(--ink-disabled)" }}>
                  and {receipt.length - 6} more
                </span>
              )}
            </div>

            <div style={{ display: "flex", gap: 4 }}>
              <Button size="chrome" variant="secondary" onClick={() => setReceipt(null)}>Keep</Button>
              <Button size="chrome" variant="ghost" onClick={() => { onUndoEdit?.(); setReceipt(null); }}>Undo</Button>
              <Button
                size="chrome"
                variant="ghost"
                onClick={() => { onSelectItems?.(receipt.map((c) => c.itemId)); setReceipt(null); }}
              >
                Show in timeline
              </Button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: 10, borderTop: "1px solid var(--border-hairline)" }}>
        {/*
          Context chips: what this message will carry besides the words.

          The selected clips and the playhead frame were ALREADY being posted
          with every message — they were just invisible, so "make it shorter"
          silently meant a different thing depending on what you had clicked
          last. Showing them makes the context checkable, and the ✕ makes it
          correctable.
        */}
        {doc && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
            {contextClips.map((c) => (
              <span key={c.id} style={chipStyle}>
                <span
                  aria-hidden
                  style={{ width: 10, height: 10, borderRadius: 2, background: c.swatch, flexShrink: 0 }}
                />
                <span style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.label}
                </span>
                {onDeselectItem && (
                  <button
                    onClick={() => onDeselectItem(c.id)}
                    aria-label={`Stop sending ${c.label}`}
                    style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0, display: "grid", placeItems: "center" }}
                  >
                    <Icon name="close" size={10} />
                  </button>
                )}
              </span>
            ))}
            <TimecodeChip fps={doc.size.fps} />
          </div>
        )}

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
                  background: "var(--brand-tint-bg)",
                  border: "1px solid var(--brand-tint-line)",
                  borderRadius: 3,
                  color: "var(--brand)",
                }}
              >
                <Icon name="image" size={10} />
                <span className="mono">{svg.filename}</span>
                <button
                  onClick={() => setAttachedSvgs((prev) => prev.filter((_, j) => j !== i))}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--brand)",
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

        {/*
          A clip dragged in from the timeline becomes context — the same chip
          selecting it would produce. "Drag a clip in here" is in the
          placeholder, so the box has to actually take one.
        */}
        <div
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes("application/x-vt-clip")) return;
            e.preventDefault();
            setDropping(true);
          }}
          onDragLeave={() => setDropping(false)}
          onDrop={(e) => {
            const id = e.dataTransfer.getData("application/x-vt-clip");
            setDropping(false);
            if (!id) return;
            e.preventDefault();
            onSelectItems?.([...new Set([...(selectedIds ?? []), id])]);
          }}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            padding: 8,
            background: "var(--surface-void)",
            border: `1px solid ${dropping ? "var(--ink-primary)" : "var(--border-hairline)"}`,
            borderRadius: "var(--r-panel)",
            transition: "border-color var(--dur-state) var(--ease)",
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={doc ? "Describe the change, or drag a clip in here…" : "Ask for a change..."}
            rows={2}
            disabled={isGenerating}
            className="vt-scroll"
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--ink-primary)",
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
                    background: "var(--surface-raised)",
                    border: "1px solid var(--border-hairline)",
                    borderRadius: "var(--r-panel)",
                    boxShadow: "var(--shadow-float)",
                    zIndex: 50,
                  }}
                >
                  <div
                    style={{
                      padding: "6px 10px",
                      borderBottom: "1px solid var(--border-hairline)",
                      fontSize: 10,
                      color: "var(--ink-tertiary)",
                      fontWeight: 500,
                    }}
                  >
                    Select SVG to animate
                  </div>
                  {svgLoading ? (
                    <div style={{ padding: 10 }}><SkeletonList rows={3} height={11} /></div>
                  ) : svgOptions.length === 0 ? (
                    <div style={{ padding: 10, fontSize: 11, color: "var(--ink-tertiary)" }}>No SVG files in assets</div>
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
                            color: "var(--ink-primary)",
                            background: "transparent",
                            border: "none",
                            borderRadius: 4,
                            cursor: "pointer",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <div style={{ fontWeight: 500 }}>{opt.name}</div>
                          <div className="mono" style={{ fontSize: 10, color: "var(--ink-disabled)" }}>
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
            <span className="mono" style={{ fontSize: 10, color: "var(--ink-disabled)", marginRight: 4 }}>
              <Kbd>&#9166;</Kbd>
            </span>
            <Button variant="primary" size="sm" onClick={handleSend} disabled={!input.trim() || isGenerating} icon="send">
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default ChatPanel;


function MessageContent({ content }: { content: string }) {
  const parts = content.split(/(```[\s\S]*?```)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("```")) {
          return (
            <details key={i} style={{ margin: "4px 0" }}>
              <summary style={{ color: "var(--brand)", cursor: "pointer", fontSize: 10 }}>Code block</summary>
              <pre className="mono" style={{ marginTop: 4, fontSize: 10, color: "var(--ink-tertiary)", overflowX: "auto" }}>
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
