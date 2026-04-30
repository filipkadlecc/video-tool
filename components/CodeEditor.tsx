"use client";

import React from "react";
import Editor from "@monaco-editor/react";
import Icon from "@/components/ui/Icon";

interface CodeEditorProps {
  code: string;
  onChange: (code: string) => void;
}

export default function CodeEditor({ code, onChange }: CodeEditorProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Tabs */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: 36,
          padding: "0 6px",
          gap: 2,
          borderBottom: "0.5px solid var(--line-1)",
          background: "var(--bg-2)",
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
            fontFamily: "var(--mono)",
            color: "var(--text-0)",
            background: "var(--bg-3)",
            borderRadius: 4,
          }}
        >
          <span
            style={{
              width: 4,
              height: 4,
              borderRadius: "50%",
              background: "var(--accent)",
            }}
          />
          Scene.tsx
        </div>
        <div style={{ flex: 1 }} />
        <Icon name="code" size={13} style={{ color: "var(--text-2)", marginRight: 6 }} />
      </div>

      {/* Editor */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <Editor
          height="100%"
          language="typescript"
          theme="vs-dark"
          value={code}
          onChange={(val) => onChange(val || "")}
          options={{
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

      {/* Status bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 10px",
          height: 22,
          borderTop: "0.5px solid var(--line-1)",
          background: "var(--bg-2)",
          fontFamily: "var(--mono)",
          fontSize: 10,
          color: "var(--text-2)",
        }}
      >
        <span>TSX</span>
        <span>UTF-8</span>
        <span>LF</span>
      </div>
    </div>
  );
}
