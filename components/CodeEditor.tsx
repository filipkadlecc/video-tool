"use client";

import React, { useEffect, useRef } from "react";
import Editor, { type BeforeMount, type OnMount } from "@monaco-editor/react";
import type { languages } from "monaco-editor";
import Icon from "@/components/ui/Icon";

const VHS_KEYWORDS = [
  "Output",
  "Require",
  "Set",
  "Env",
  "Sleep",
  "Wait",
  "Type",
  "Copy",
  "Paste",
  "Backspace",
  "Enter",
  "Tab",
  "Space",
  "Up",
  "Down",
  "Left",
  "Right",
  "PageUp",
  "PageDown",
  "ScrollUp",
  "ScrollDown",
  "Hide",
  "Show",
  "Source",
  "Screenshot",
  "Ctrl",
  "Alt",
  "Shift",
];

const VHS_SET_OPTIONS = [
  "Shell",
  "FontSize",
  "FontFamily",
  "Width",
  "Height",
  "Padding",
  "Margin",
  "MarginFill",
  "BorderRadius",
  "Theme",
  "TypingSpeed",
  "Framerate",
  "PlaybackSpeed",
  "LineHeight",
  "LetterSpacing",
  "LoopOffset",
  "WindowBar",
  "CursorBlink",
];

const registerVHSLanguage: BeforeMount = (monaco) => {
  if (monaco.languages.getLanguages().some((l: languages.ILanguageExtensionPoint) => l.id === "vhs")) return;

  monaco.languages.register({ id: "vhs" });

  monaco.languages.setMonarchTokensProvider("vhs", {
    keywords: VHS_KEYWORDS,
    setOptions: VHS_SET_OPTIONS,
    tokenizer: {
      root: [
        [/#.*$/, "comment"],
        [/"([^"\\]|\\.)*"/, "string"],
        [/\b\d+(\.\d+)?(ms|s)\b/, "number"],
        [/\b\d+(\.\d+)?\b/, "number"],
        [/(Ctrl|Alt|Shift)\+[A-Za-z]+/, "keyword.modifier"],
        [/@[\d]+(ms|s)/, "number.delay"],
        [
          /[A-Za-z]+/,
          {
            cases: {
              "@keywords": "keyword",
              "@setOptions": "type",
              "@default": "identifier",
            },
          },
        ],
      ],
    },
  });

  monaco.editor.defineTheme("vhs-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "FF64B8", fontStyle: "bold" },
      { token: "keyword.modifier", foreground: "F86606" },
      { token: "type", foreground: "20A34E" },
      { token: "string", foreground: "FEF3FF" },
      { token: "number", foreground: "246DFF" },
      { token: "number.delay", foreground: "246DFF", fontStyle: "italic" },
      { token: "comment", foreground: "5A4F60", fontStyle: "italic" },
    ],
    colors: {},
  });

  /*
   * scene.json gets a DELIBERATELY minimal palette (6a).
   *
   * An imported syntax theme brings five or six hues with it, none of which
   * mean anything in this system — and code mode sits next to a preview, an
   * inspector and a timeline that between them use two. So: strings are the
   * brand orange, numbers and structure are primary ink, keys are tertiary,
   * punctuation is disabled. Four steps of the same palette everything else
   * uses.
   */
  monaco.editor.defineTheme("scene-json", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "string.key.json", foreground: "838688" },
      { token: "string.value.json", foreground: "F86606" },
      { token: "string", foreground: "F86606" },
      { token: "number", foreground: "F4F4F5" },
      { token: "keyword.json", foreground: "F4F4F5" },
      { token: "delimiter", foreground: "5E6163" },
      { token: "delimiter.bracket.json", foreground: "5E6163" },
      { token: "delimiter.array.json", foreground: "5E6163" },
    ],
    colors: {
      "editor.background": "#141516",
      "editorLineNumber.foreground": "#4A4D4F",
      "editorLineNumber.activeForeground": "#838688",
      "editor.lineHighlightBackground": "#141516",
      "editorIndentGuide.background1": "#232527",
    },
  });
};

interface CodeEditorProps {
  code: string;
  onChange: (code: string) => void;
  language?: "typescript" | "plaintext" | "vhs" | "json";
  /** A document view is a readout, not an edit surface. */
  readOnly?: boolean;
  filename?: string;
  /**
   * One selection, three views (`6a`): the lines belonging to the selected clip,
   * washed and given a left edge, and scrolled to when the selection changes
   * somewhere else.
   */
  highlight?: [number, number] | null;
  /** Lines carrying a problem, tinted amber with their line number in warning. */
  warnLines?: number[];
  /** Clicking a line says which line — the page turns that back into a clip. */
  onLineClick?: (line: number) => void;
  /** Chrome above the editor. Code mode puts COMPOSITION + state here. */
  header?: React.ReactNode;
}

export default function CodeEditor({
  code,
  onChange,
  language = "typescript",
  filename,
  readOnly,
  highlight,
  warnLines,
  onLineClick,
  header,
}: CodeEditorProps) {
  const tabName = filename ?? (language === "plaintext" ? "tape.tape" : language === "json" ? "scene.json" : "Scene.tsx");
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const decorationsRef = useRef<string[]>([]);
  /*
   * The click handler, kept in a ref so Monaco's listener — registered once on
   * mount — always calls the CURRENT one. Written in an effect rather than
   * during render: a ref assignment in the render body runs on every attempt,
   * including ones React throws away.
   */
  const clickRef = useRef(onLineClick);
  useEffect(() => { clickRef.current = onLineClick; }, [onLineClick]);

  /*
   * Decorations, re-applied whenever the selection or the problems change.
   *
   * `deltaDecorations` takes the previous ids and returns the new ones — that
   * is how Monaco replaces rather than accumulates, and forgetting it leaves
   * every past highlight painted on top of the current one.
   */
  useEffect(() => {
    const ed = editorRef.current;
    const monaco = monacoRef.current;
    if (!ed || !monaco) return;
    const decorations = [];
    if (highlight) {
      decorations.push({
        range: new monaco.Range(highlight[0], 1, highlight[1], 1),
        options: { isWholeLine: true, className: "vt-code-selected", linesDecorationsClassName: "vt-code-selected-edge" },
      });
    }
    for (const line of warnLines ?? []) {
      decorations.push({
        range: new monaco.Range(line, 1, line, 1),
        options: { isWholeLine: true, className: "vt-code-warned" },
      });
    }
    decorationsRef.current = ed.deltaDecorations(decorationsRef.current, decorations);
  }, [highlight, warnLines, code]);

  // Bring the selected clip into view when the selection came from elsewhere.
  useEffect(() => {
    if (highlight) editorRef.current?.revealLineInCenterIfOutsideViewport(highlight[0]);
  }, [highlight]);

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    editor.onMouseDown((e) => {
      const line = e.target.position?.lineNumber;
      if (line) clickRef.current?.(line);
    });
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {header ?? (
      /* Tabs */
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: 36,
          padding: "0 6px",
          gap: 2,
          borderBottom: "1px solid var(--border-hairline)",
          background: "var(--surface-chrome)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            height: 28,
            padding: "0 10px",
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            color: "var(--ink-primary)",
            background: "var(--surface-raised)",
            borderRadius: 4,
          }}
        >
          <span
            style={{
              width: 4,
              height: 4,
              borderRadius: "50%",
              background: "var(--brand)",
            }}
          />
          {tabName}
        </div>
        <div style={{ flex: 1 }} />
        <Icon name="code" size={13} style={{ color: "var(--ink-tertiary)", marginRight: 6 }} />
      </div>
      )}

      {/* Editor */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <Editor
          height="100%"
          language={language}
          theme={language === "vhs" ? "vhs-dark" : language === "json" ? "scene-json" : "vs-dark"}
          beforeMount={registerVHSLanguage}
          onMount={onMount}
          value={code}
          onChange={(val) => onChange(val || "")}
          options={{
            readOnly,
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            wordWrap: "on",
            tabSize: 2,
            automaticLayout: true,
            padding: { top: 8 },
          }}
        />
      </div>

      {/* Status bar. Code mode passes its own header and has no room for a
          second strip of chrome, so it opts out of this one too. */}
      {!header && (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 10px",
          height: 22,
          borderTop: "1px solid var(--border-hairline)",
          background: "var(--surface-chrome)",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--ink-tertiary)",
        }}
      >
        <span>{language === "vhs" ? "VHS" : language === "plaintext" ? "TXT" : language === "json" ? "JSON" : "TSX"}</span>
        <span>UTF-8</span>
        <span>LF</span>
      </div>
      )}
    </div>
  );
}
