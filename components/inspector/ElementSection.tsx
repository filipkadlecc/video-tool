"use client";

import React, { useLayoutEffect, useMemo, useState } from "react";
import ScrubNumber from "@/components/ui/ScrubNumber";
import Icon from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { findItem, updateItem, type EditorDoc, type SceneItem } from "@/lib/editor-doc";
import { describeElement, elementLabel, findPickedNode, type ElementPick } from "@/lib/scene-elements";
import {
  readElementProps, setElementStyle, setElementText, parseTranslate, type StyleKey,
} from "@/lib/scene-element-edit";
import { evalSceneCode } from "@/remotion/DynamicScene";

/**
 * The element picked inside a scene block (double-click on the canvas), edited
 * by hand: its words, colour, fill, size and position. No AI, no waiting.
 *
 * Values that the scene works out in code — anything animated — are shown but
 * locked, with a pointer to the chat. Overwriting one would silently kill the
 * motion; the AI can see what the maths is for.
 *
 * What the fields SHOW is read from the rendered element, not the source, so
 * `COLORS.text` or an inherited size still reads as the colour or size you see.
 */

const ROW: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "72px minmax(0,1fr)", gap: 6, alignItems: "center",
};
const FIELD: React.CSSProperties = {
  height: 24, background: "var(--surface-raised)", border: "1px solid var(--border-hairline)",
  borderRadius: "var(--r-control)", color: "var(--ink-primary)", padding: "0 6px", width: "100%", minWidth: 0,
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={ROW}>
      <span className="t-control" style={{ textAlign: "right", color: "var(--ink-secondary)" }}>{label}</span>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}

function Locked({ why }: { why: string }) {
  return (
    <div
      className="t-caption"
      title="This value is worked out in the scene's code. Ask for the change in the chat."
      style={{ ...FIELD, display: "flex", alignItems: "center", gap: 6, color: "var(--ink-disabled)" }}
    >
      <Icon name="lock" size={11} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{why}</span>
    </div>
  );
}

/** rgb()/rgba() from getComputedStyle → #rrggbb for the colour input. */
function toHex(css: string): string | null {
  const m = css.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/);
  if (!m) return null;
  if (m[4] !== undefined && parseFloat(m[4]) === 0) return null; // fully transparent — no fill
  return "#" + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("");
}

function ColourInput({ value, onChange }: { value: string | null; onChange: (hex: string) => void }) {
  return (
    <label style={{ ...FIELD, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", position: "relative" }}>
      <span
        style={{
          width: 12, height: 12, borderRadius: 3, flexShrink: 0, border: "1px solid var(--border-hairline)",
          background: value ?? "repeating-conic-gradient(var(--surface-hover) 0 25%, transparent 0 50%) 0 0 / 6px 6px",
        }}
      />
      <span className="t-data-s" style={{ color: value ? "var(--ink-primary)" : "var(--ink-disabled)", textTransform: "uppercase" }}>
        {value ?? "none"}
      </span>
      <input
        type="color"
        value={value ?? "#000000"}
        onChange={(e) => onChange(e.target.value)}
        style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
      />
    </label>
  );
}

export default function ElementSection({ doc, pick, frame, onChange, onClear }: {
  doc: EditorDoc;
  pick: ElementPick;
  frame: number;
  onChange: (next: EditorDoc, opts?: { transient?: boolean }) => void;
  onClear: () => void;
}) {
  const toast = useToast();
  const item = findItem(doc, pick.itemId)?.item;
  const code = item?.type === "scene" ? (item as SceneItem).code : "";
  const described = useMemo(() => describeElement(code, pick.offset), [code, pick.offset]);
  const props = useMemo(() => readElementProps(code, pick.offset), [code, pick.offset]);

  // What it looks like right now, from the rendered node.
  const [live, setLive] = useState<{ color: string | null; background: string | null; fontSize: number | null }>({
    color: null, background: null, fontSize: null,
  });
  useLayoutEffect(() => {
    const raf = requestAnimationFrame(() => {
      const node = findPickedNode(pick);
      if (!node) return;
      const cs = getComputedStyle(node);
      setLive({ color: toHex(cs.color), background: toHex(cs.backgroundColor), fontSize: parseFloat(cs.fontSize) || null });
    });
    return () => cancelAnimationFrame(raf);
  }, [pick, code, frame]);

  if (!item || !described || !props) return null;

  /** Commit a new version of the block's code — but never one that won't compile. */
  const apply = (next: string | null, opts?: { transient?: boolean }) => {
    if (!next || next === code) return;
    if (evalSceneCode(next)?.error) {
      if (!opts?.transient) toast.warning("That change would break the scene", "Nothing was changed. Try asking for it in the chat.");
      return;
    }
    onChange(updateItem<SceneItem>(doc, item.id, { code: next }), opts);
  };
  const setStyle = (key: StyleKey, source: string, opts?: { transient?: boolean }) =>
    apply(setElementStyle(code, pick.offset, key, source), opts);

  const s = props.style;
  const [tx, ty] = s.translate.kind === "editable" ? parseTranslate(s.translate.raw) : [0, 0];
  const LOCKED = "animated — ask the AI";

  return (
    <div style={{ borderBottom: "1px solid var(--border-hairline)" }}>
      <div
        style={{
          display: "flex", alignItems: "center", gap: 8, height: 32, padding: "0 8px 0 10px",
          background: "var(--brand-tint-bg)", borderBottom: "1px solid var(--brand-tint-line)",
        }}
      >
        <span className="t-section" style={{ color: "var(--brand)" }}>Element</span>
        <span className="t-caption" style={{ color: "var(--ink-secondary)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {elementLabel(described)}
        </span>
        <div style={{ flex: 1 }} />
        <span className="t-data-s" style={{ color: "var(--ink-disabled)", flexShrink: 0 }}>line {described.line}</span>
        <button
          onClick={onClear}
          aria-label="Stop editing this element"
          style={{ background: "none", border: "none", color: "var(--ink-tertiary)", cursor: "pointer", padding: 2, display: "grid", placeItems: "center" }}
        >
          <Icon name="close" size={11} />
        </button>
      </div>

      <div style={{ padding: "8px 10px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
        {props.text.kind !== "none" && (
          <Row label="Text">
            {props.text.kind === "editable" ? (
              <input
                key={`${pick.offset}:${props.text.value}`}
                aria-label="Element text"
                defaultValue={props.text.value}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape" && props.text.kind === "editable") {
                    e.currentTarget.value = props.text.value;
                    e.currentTarget.blur();
                  }
                }}
                onBlur={(e) => apply(setElementText(code, pick.offset, e.currentTarget.value))}
                className="t-data-m"
                style={FIELD}
              />
            ) : (
              <Locked why="set in code — ask the AI" />
            )}
          </Row>
        )}

        <Row label="Colour">
          {s.color.kind === "computed" ? <Locked why={LOCKED} /> : (
            <ColourInput value={live.color} onChange={(hex) => setStyle("color", JSON.stringify(hex))} />
          )}
        </Row>

        <Row label="Fill">
          {s.background.kind === "computed" ? <Locked why={LOCKED} /> : (
            <ColourInput value={live.background} onChange={(hex) => setStyle("background", JSON.stringify(hex))} />
          )}
        </Row>

        <Row label="Size">
          {s.fontSize.kind === "computed" ? <Locked why={LOCKED} /> : (
            <ScrubNumber
              value={Math.round(live.fontSize ?? 16)}
              min={1}
              max={2000}
              suffix="px"
              onChange={(n, o) => setStyle("fontSize", String(Math.round(n)), o)}
            />
          )}
        </Row>

        <Row label="Offset">
          {s.translate.kind === "computed" ? <Locked why={LOCKED} /> : (
            <div style={{ display: "flex", gap: 4 }}>
              <ScrubNumber value={tx} prefix="X" onChange={(n, o) => setStyle("translate", JSON.stringify(`${Math.round(n)}px ${ty}px`), o)} />
              <ScrubNumber value={ty} prefix="Y" onChange={(n, o) => setStyle("translate", JSON.stringify(`${tx}px ${Math.round(n)}px`), o)} />
            </div>
          )}
        </Row>
      </div>
    </div>
  );
}
