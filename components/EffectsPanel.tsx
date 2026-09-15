"use client";

import React from "react";
import {
  ANIMATION_PRESETS, itemEffects, presetsFor, setEffectEnabled, setEffectPreset,
  type AnimationPreset, type PresetInfo,
} from "@/lib/editor-effects";
import { findItem, updateItem, type EditorDoc, type EditorItem } from "@/lib/editor-doc";

/**
 * In/out animations you can drag onto a clip.
 *
 * The list is short on purpose. Most of a stock transitions panel — fades from
 * black, blur reveals, slides and wipes — is banned in this project, and what's
 * left is the vocabulary the branded scenes actually use: opacity combined with
 * translate, scale and rotation, plus real per-character typing.
 */

interface Props {
  doc: EditorDoc;
  selectedIds: Set<string>;
  onChange: (next: EditorDoc) => void;
}

const DEFAULT_FRAMES = 12;

export default function EffectsPanel({ doc, selectedIds, onChange }: Props) {
  const id = selectedIds.size === 1 ? [...selectedIds][0] : null;
  const found = id ? findItem(doc, id) : null;
  const item = found?.item;

  const apply = (preset: AnimationPreset, edge: "in" | "out", target?: EditorItem) => {
    const t = target ?? item;
    if (!t) return;
    const kind = edge === "in" ? "animateIn" : "animateOut";
    // "Cut" bypasses rather than deletes, so the duration you set survives
    // being turned off and comes back when you turn it on again.
    const effects = preset === "none"
      ? setEffectEnabled(itemEffects(t), `${t.id}:${edge}`, false)
      : setEffectPreset(t, kind, preset, DEFAULT_FRAMES);
    onChange(updateItem(doc, t.id, { effects } as Partial<EditorItem>));
  };

  const available: PresetInfo[] = item ? presetsFor(item.type) : ANIMATION_PRESETS;

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: 10 }}>
      {!item && (
        <div style={{ fontSize: 11, color: "var(--ink-disabled)", marginBottom: 10 }}>
          Select a clip, then click an effect — or drag one onto a clip on the timeline.
        </div>
      )}
      {item && (
        <div className="mono cap" style={{ fontSize: 9, color: "var(--ink-disabled)", marginBottom: 8 }}>
          {item.type} · in: {item.animateIn?.preset ?? "cut"} · out: {item.animateOut?.preset ?? "cut"}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {available.map((p) => (
          <div
            key={p.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("application/x-vt-effect", p.id);
              e.dataTransfer.effectAllowed = "copy";
            }}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "6px 8px",
              background: "var(--surface-raised)", border: "1px solid var(--border-hairline)",
              borderRadius: "var(--r-panel)", cursor: "grab",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: "var(--ink-primary)" }}>{p.label}</div>
              <div style={{ fontSize: 9, color: "var(--ink-disabled)" }}>{p.hint}</div>
            </div>
            <button disabled={!item} onClick={() => apply(p.id, "in")} style={chip(Boolean(item))}>In</button>
            <button disabled={!item} onClick={() => apply(p.id, "out")} style={chip(Boolean(item))}>Out</button>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 9, color: "var(--ink-disabled)", marginTop: 12, lineHeight: 1.5 }}>
        Elements arrive sharp — no blur reveals, no fades from black, no slides or wipes.
        Typing is genuinely per character.
      </div>
    </div>
  );
}

const chip = (enabled: boolean): React.CSSProperties => ({
  background: "var(--surface-hover)", border: "1px solid var(--border-hairline)", borderRadius: 3,
  color: enabled ? "var(--ink-secondary)" : "var(--ink-disabled)", fontSize: 9,
  padding: "2px 7px", cursor: enabled ? "pointer" : "default",
});
