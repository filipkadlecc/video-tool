"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/ui/Logo";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Modal from "@/components/ui/Modal";
import type { FeedbackEntry } from "@/lib/feedback";

export default function FeedbackViewer() {
  const router = useRouter();
  const [entries, setEntries] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState<string | null>(null);

  useEffect(() => {
    fetchFeedback();
  }, []);

  async function fetchFeedback() {
    try {
      const res = await fetch("/api/feedback");
      setEntries(await res.json());
    } catch (err) {
      console.error("Failed to load feedback:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/feedback/${id}`, { method: "DELETE" });
      if (res.ok) setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      console.error("Failed to delete feedback:", err);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-1)" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          padding: "16px 28px",
          borderBottom: "0.5px solid var(--line-1)",
        }}
      >
        <Logo onClick={() => router.push("/")} />
        <div style={{ flex: 1 }} />
        <div className="mono" style={{ fontSize: 11, color: "var(--text-2)", marginRight: 10 }}>
          {entries.length} {entries.length === 1 ? "entry" : "entries"}
        </div>
        <Button variant="ghost" size="sm" icon="arrowLeft" onClick={() => router.push("/")}>
          Home
        </Button>
      </header>

      <div
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding: "48px 28px 64px",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        <div>
          <div className="mono cap" style={{ color: "var(--text-2)", marginBottom: 10 }}>
            Feedback
          </div>
          <h1 style={{ margin: 0, fontSize: 32, letterSpacing: -0.6, fontWeight: 600 }}>
            What people are saying
          </h1>
        </div>

        {loading ? (
          <div className="mono" style={{ fontSize: 12, color: "var(--text-2)" }}>
            Loading…
          </div>
        ) : entries.length === 0 ? (
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              color: "var(--text-2)",
              background: "var(--bg-2)",
              border: "0.5px solid var(--line-1)",
              borderRadius: "var(--r-lg)",
            }}
          >
            <Icon name="chat" size={24} style={{ opacity: 0.5 }} />
            <p style={{ margin: "10px 0 0", fontSize: 13 }}>No feedback yet.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {entries.map((entry) => (
              <FeedbackCard key={entry.id} entry={entry} onDelete={handleDelete} onZoom={setZoom} />
            ))}
          </div>
        )}
      </div>

      <Modal open={!!zoom} onClose={() => setZoom(null)} width={960}>
        {zoom && (
          <div style={{ padding: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={zoom} alt="Screenshot" style={{ width: "100%", borderRadius: "var(--r-sm)" }} />
          </div>
        )}
      </Modal>
    </div>
  );
}

function FeedbackCard({
  entry,
  onDelete,
  onZoom,
}: {
  entry: FeedbackEntry;
  onDelete: (id: string) => void;
  onZoom: (dataUrl: string) => void;
}) {
  const when = new Date(entry.createdAt).toLocaleString();

  return (
    <div
      style={{
        display: "flex",
        gap: 14,
        padding: 16,
        background: "var(--bg-2)",
        border: "0.5px solid var(--line-1)",
        borderRadius: "var(--r-lg)",
      }}
    >
      {entry.screenshot && (
        <button
          onClick={() => onZoom(entry.screenshot!)}
          title="View full screenshot"
          style={{
            flexShrink: 0,
            padding: 0,
            border: "0.5px solid var(--line-2)",
            borderRadius: "var(--r-sm)",
            overflow: "hidden",
            cursor: "zoom-in",
            background: "var(--bg-inset)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={entry.screenshot}
            alt="Screenshot"
            style={{ width: 120, height: 68, objectFit: "cover", display: "block" }}
          />
        </button>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, color: "var(--text-0)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
          {entry.message}
        </p>
        <div
          className="mono"
          style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 10, fontSize: 11, color: "var(--text-2)" }}
        >
          <span>{when}</span>
          {entry.projectId ? (
            <a href={`/project/${entry.projectId}`} style={{ color: "var(--accent)" }}>
              {entry.url ?? `/project/${entry.projectId}`}
            </a>
          ) : (
            entry.url && <span>{entry.url}</span>
          )}
        </div>
      </div>

      <button
        onClick={() => onDelete(entry.id)}
        title="Delete"
        className="focus-ring"
        style={{
          flexShrink: 0,
          alignSelf: "flex-start",
          display: "grid",
          placeItems: "center",
          width: 28,
          height: 28,
          color: "var(--text-2)",
          background: "transparent",
          border: "0.5px solid transparent",
          borderRadius: "var(--r-sm)",
          cursor: "pointer",
        }}
      >
        <Icon name="trash" size={14} />
      </button>
    </div>
  );
}
