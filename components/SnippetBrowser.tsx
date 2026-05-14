"use client";

import React, { useState, useEffect } from "react";
import Modal from "@/components/ui/Modal";
import Icon from "@/components/ui/Icon";
import { BRAND } from "@/lib/brand";

interface Snippet {
  id: string;
  name: string;
  subtitle: string;
  code: string;
}

interface SnippetBrowserProps {
  open: boolean;
  onClose: () => void;
  hasExistingCode: boolean;
  onUseSnippet: (code: string) => void;
}

const PREVIEW_COLORS: Record<string, string> = {
  IntroCard: BRAND.colors.pink,
  LowerThird: BRAND.colors.green,
  EndCard: BRAND.colors.blue,
  StatCallout: BRAND.colors.orange,
  QuoteCard: BRAND.colors.magenta.accent,
  LogoBumper: BRAND.colors.pink,
  CalloutBanner: BRAND.colors.blue,
  ListReveal: BRAND.colors.green,
  CodeSnippet: "#7DD3FC",
  SymbolBug: BRAND.colors.orange,
};

const PREVIEW_ICONS: Record<string, string> = {
  IntroCard: "film",
  LowerThird: "monitor",
  EndCard: "check",
  StatCallout: "bolt",
  QuoteCard: "chat",
  LogoBumper: "sparkle",
  CalloutBanner: "info",
  ListReveal: "list",
  CodeSnippet: "code",
  SymbolBug: "image",
};

export default function SnippetBrowser({
  open,
  onClose,
  hasExistingCode,
  onUseSnippet,
}: SnippetBrowserProps) {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/snippets")
      .then((r) => r.json())
      .then((data: Snippet[]) => {
        if (!cancelled) setSnippets(data);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  function handleSelect(snippet: Snippet) {
    if (hasExistingCode) {
      setConfirmId(snippet.id);
      return;
    }
    onUseSnippet(snippet.code);
    onClose();
  }

  function applyConfirmed() {
    const snippet = snippets.find((s) => s.id === confirmId);
    if (!snippet) return;
    onUseSnippet(snippet.code);
    setConfirmId(null);
    onClose();
  }

  function copySource(snippet: Snippet) {
    navigator.clipboard.writeText(snippet.code);
    setConfirmId(`copied:${snippet.id}`);
    setTimeout(() => setConfirmId(null), 1200);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={760}
      title="Brand snippets"
      stepLabel="Apify-branded scenes"
    >
      <div className="vt-scroll" style={{ overflowY: "auto", maxHeight: 560 }}>
        <div style={{ padding: "16px 20px", borderBottom: "0.5px solid var(--line-1)" }}>
          <p style={{ margin: 0, fontSize: 12, color: "var(--text-2)", lineHeight: 1.5 }}>
            Self-contained Remotion scenes with Apify branding baked in. Pick one to start a project,
            or copy the source to compose into an existing scene.
            {hasExistingCode && (
              <span style={{ color: "var(--text-1)" }}>
                {" "}This project already has code — selecting a snippet will replace it (you can undo).
              </span>
            )}
          </p>
        </div>

        {loading && (
          <div style={{ padding: 28, textAlign: "center", color: "var(--text-3)", fontSize: 12 }}>
            Loading…
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, padding: 20 }}>
          {snippets.map((s) => {
            const accent = PREVIEW_COLORS[s.id] ?? BRAND.colors.pink;
            const icon = PREVIEW_ICONS[s.id] ?? "film";
            const justCopied = confirmId === `copied:${s.id}`;
            return (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  padding: 14,
                  background: "var(--bg-inset)",
                  border: "0.5px solid var(--line-2)",
                  borderRadius: "var(--r-md)",
                }}
              >
                <div
                  style={{
                    aspectRatio: "16 / 9",
                    borderRadius: "var(--r-sm)",
                    background: `linear-gradient(135deg, ${BRAND.colors.bg} 0%, ${BRAND.colors.bgSoft} 100%)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "column",
                    gap: 8,
                    border: `0.5px solid ${accent}33`,
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      background: `${accent}22`,
                      border: `0.5px solid ${accent}55`,
                      display: "grid",
                      placeItems: "center",
                      color: accent,
                    }}
                  >
                    <Icon name={icon} size={18} />
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--text-0)",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {s.name}
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      bottom: 8,
                      right: 8,
                      width: 24,
                      height: 2,
                      background: accent,
                      borderRadius: 1,
                    }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-0)" }}>
                    {s.name}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-2)", lineHeight: 1.4 }}>
                    {s.subtitle}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                  <button
                    onClick={() => handleSelect(s)}
                    style={{
                      flex: 1,
                      height: 28,
                      padding: "0 10px",
                      background: "var(--accent)",
                      color: "var(--accent-ink)",
                      border: "none",
                      borderRadius: "var(--r-sm)",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 5,
                    }}
                  >
                    <Icon name="plus" size={11} />
                    Use as scene
                  </button>
                  <button
                    onClick={() => copySource(s)}
                    title="Copy source to clipboard"
                    style={{
                      height: 28,
                      padding: "0 10px",
                      background: "var(--bg-3)",
                      color: justCopied ? "var(--accent)" : "var(--text-1)",
                      border: "0.5px solid var(--line-2)",
                      borderRadius: "var(--r-sm)",
                      fontSize: 11,
                      fontWeight: 500,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <Icon name={justCopied ? "check" : "code"} size={11} />
                    {justCopied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {confirmId && !confirmId.startsWith("copied:") && (
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
            <div style={{ fontSize: 13, fontWeight: 600 }}>Replace existing code?</div>
            <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.5 }}>
              The snippet will replace what&rsquo;s currently in the editor. You can undo with Cmd+Z.
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
