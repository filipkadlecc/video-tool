"use client";

import React from "react";
import Modal from "@/components/ui/Modal";
import Icon from "@/components/ui/Icon";

interface TapeExample {
  id: string;
  name: string;
  subtitle: string;
  duration: string;
  source: string;
}

const EXAMPLES: TapeExample[] = [
  {
    id: "starter",
    name: "Starter",
    subtitle: "Minimal hello world — fastest to render",
    duration: "~5s render",
    source: `Output out.mp4

Set FontSize 22
Set Width 1200
Set Height 600
Set Theme "Catppuccin Mocha"
Set TypingSpeed 50ms

Type "echo 'Hello from VHS'"
Sleep 500ms
Enter
Sleep 1s

Type "ls -la"
Sleep 500ms
Enter
Sleep 2s
`,
  },
  {
    id: "tour",
    name: "Quick tour",
    subtitle: "Multiple commands, demonstrates typing + sleeps",
    duration: "~10s render",
    source: `Output out.mp4

Set FontSize 24
Set Width 1200
Set Height 600
Set Theme "Catppuccin Mocha"
Set TypingSpeed 60ms
Set Padding 30
Set BorderRadius 8

Type "echo 'Hello from VHS 👋'"
Sleep 400ms
Enter
Sleep 1s

Type "ls -la | head -10"
Sleep 300ms
Enter
Sleep 2s

Type "uname -a"
Sleep 300ms
Enter
Sleep 2s
`,
  },
  {
    id: "npm",
    name: "Fake npm install",
    subtitle: "Looks like a product demo — Hide/Show for setup",
    duration: "~12s render",
    source: `Output out.mp4

Set FontSize 22
Set Width 1280
Set Height 640
Set Theme "Tokyo Night"
Set TypingSpeed 45ms
Set WindowBar Colorful
Set Padding 40

Hide
Type "cd /tmp && clear"
Enter
Show

Type "npm install apify"
Sleep 500ms
Enter
Sleep 3s

Type "npx apify run"
Sleep 500ms
Enter
Sleep 3s
`,
  },
  {
    id: "apify",
    name: "Apify-branded",
    subtitle: "Apify dev-tool demo with brand colors",
    duration: "~15s render",
    source: `Output out.mp4

Set FontSize 24
Set Width 1280
Set Height 720
Set Theme "Dracula"
Set TypingSpeed 50ms
Set Padding 40
Set MarginFill "#12091A"
Set Margin 40
Set BorderRadius 10
Set WindowBar Rings

Hide
Type "clear"
Enter
Show

Type "# Spin up an Apify Actor"
Enter
Sleep 800ms

Type "apify create my-scraper"
Sleep 400ms
Enter
Sleep 2s

Type "cd my-scraper && apify run"
Sleep 400ms
Enter
Sleep 3s
`,
  },
];

const PREVIEW_COLORS: Record<string, string> = {
  starter: "#FF64B8",
  tour: "#246DFF",
  npm: "#20A34E",
  apify: "#F86606",
};

interface TapeExamplesPickerProps {
  open: boolean;
  onClose: () => void;
  hasExistingCode: boolean;
  onUseExample: (source: string) => void;
}

export default function TapeExamplesPicker({
  open,
  onClose,
  hasExistingCode,
  onUseExample,
}: TapeExamplesPickerProps) {
  const [confirmId, setConfirmId] = React.useState<string | null>(null);

  function handleSelect(example: TapeExample) {
    if (hasExistingCode) {
      setConfirmId(example.id);
      return;
    }
    onUseExample(example.source);
    onClose();
  }

  function applyConfirmed() {
    const example = EXAMPLES.find((e) => e.id === confirmId);
    if (!example) return;
    onUseExample(example.source);
    setConfirmId(null);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={680}
      title="VHS tape examples"
      stepLabel="Replace the current tape with a recipe"
    >
      <div className="vt-scroll" style={{ overflowY: "auto", maxHeight: 540 }}>
        <div style={{ padding: "14px 20px", borderBottom: "0.5px solid var(--line-1)" }}>
          <p style={{ margin: 0, fontSize: 12, color: "var(--text-2)", lineHeight: 1.5 }}>
            Click a recipe to load it into the editor, then hit{" "}
            <span style={{ color: "var(--accent)" }}>Render</span>.
            {hasExistingCode && (
              <span style={{ color: "var(--text-1)" }}>
                {" "}This replaces what&rsquo;s currently in the editor (Cmd+Z to undo).
              </span>
            )}
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 20 }}>
          {EXAMPLES.map((ex) => {
            const accent = PREVIEW_COLORS[ex.id] ?? "var(--accent)";
            return (
              <button
                key={ex.id}
                onClick={() => handleSelect(ex)}
                style={{
                  display: "flex",
                  alignItems: "stretch",
                  gap: 12,
                  padding: 12,
                  background: "var(--bg-inset)",
                  border: "0.5px solid var(--line-2)",
                  borderRadius: "var(--r-md)",
                  cursor: "pointer",
                  textAlign: "left",
                  color: "var(--text-0)",
                  transition: "border-color 120ms",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = accent;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--line-2)";
                }}
              >
                <div
                  style={{
                    width: 4,
                    background: accent,
                    borderRadius: 2,
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 10,
                      justifyContent: "space-between",
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{ex.name}</span>
                    <span
                      className="mono"
                      style={{ fontSize: 10, color: "var(--text-3)" }}
                    >
                      {ex.duration}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text-2)" }}>
                    {ex.subtitle}
                  </span>
                </div>
                <Icon
                  name="arrowRight"
                  size={14}
                  style={{ color: "var(--text-3)", alignSelf: "center" }}
                />
              </button>
            );
          })}
        </div>
      </div>

      {confirmId && (
        <div
          onClick={() => setConfirmId(null)}
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            zIndex: 10,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 380,
              width: "100%",
              background: "var(--bg-2)",
              border: "0.5px solid var(--line-2)",
              borderRadius: "var(--r-md)",
              padding: 22,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600 }}>Replace tape source?</div>
            <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.5 }}>
              The example will replace what&rsquo;s currently in the editor. You can undo with Cmd+Z.
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setConfirmId(null)}
                style={{
                  height: 30,
                  padding: "0 14px",
                  background: "var(--bg-3)",
                  color: "var(--text-1)",
                  border: "0.5px solid var(--line-2)",
                  borderRadius: "var(--r-sm)",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={applyConfirmed}
                style={{
                  height: 30,
                  padding: "0 14px",
                  background: "var(--accent)",
                  color: "var(--accent-ink)",
                  border: "none",
                  borderRadius: "var(--r-sm)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Replace
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
