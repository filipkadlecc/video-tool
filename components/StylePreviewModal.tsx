"use client";

import React, { useState } from "react";
import Modal from "@/components/ui/Modal";
import Icon from "@/components/ui/Icon";
import { STYLE_MODES } from "@/lib/prompts/styles";
import type { StyleMode } from "@/lib/types";

interface StylePreviewModalProps {
  open: boolean;
  onClose: () => void;
  selected: StyleMode;
  onSelect: (mode: StyleMode) => void;
}

function PreviewCell({
  id,
  label,
  description,
  active,
  onClick,
}: {
  id: StyleMode;
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 8,
        textAlign: "left",
        background: active ? "var(--brand-tint-bg)" : "var(--surface-void)",
        border: `1px solid ${active ? "var(--brand)" : "var(--border-hairline)"}`,
        borderRadius: "var(--r-panel)",
        cursor: "pointer",
        color: "var(--ink-primary)",
        transition: "all 120ms",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "16 / 9",
          borderRadius: "var(--r-control)",
          overflow: "hidden",
          background: "var(--surface-void)",
          display: "grid",
          placeItems: "center",
        }}
      >
        {failed ? (
          <span className="mono" style={{ fontSize: 10, color: "var(--ink-disabled)" }}>
            no preview
          </span>
        ) : (
          <video
            src={`/style-previews/${id}.mp4`}
            autoPlay
            loop
            muted
            playsInline
            onError={() => setFailed(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
        {active && <Icon name="info" size={11} style={{ color: "var(--brand)" }} />}
      </div>
      <span style={{ fontSize: 11, color: "var(--ink-tertiary)", lineHeight: 1.4 }}>{description}</span>
    </button>
  );
}

export default function StylePreviewModal({ open, onClose, selected, onSelect }: StylePreviewModalProps) {
  return (
    <Modal open={open} onClose={onClose} width={700} title="Style previews" subtitle="Pick a look">
      <div
        style={{
          padding: 20,
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 12,
          overflowY: "auto",
        }}
        className="vt-scroll"
      >
        {STYLE_MODES.map((m) => (
          <PreviewCell
            key={m.id}
            id={m.id}
            label={m.label}
            description={m.description}
            active={selected === m.id}
            onClick={() => {
              onSelect(m.id);
              onClose();
            }}
          />
        ))}
      </div>
    </Modal>
  );
}
