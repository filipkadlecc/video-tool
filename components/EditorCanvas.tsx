"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  itemLayoutAt, itemsAtFrame, resizeLayout, setItemKey, setLayout, snapBox, updateItem,
  type EditorDoc, type EditorItem, type ItemLayout, type ResizeHandle, type TextItem,
} from "@/lib/editor-doc";
import { isAnimated } from "@/lib/editor-keys";

/**
 * Direct manipulation over the preview: click to select, drag to move, handles
 * to resize.
 *
 * The overlay is laid out in SCREEN pixels but every value it writes is in
 * COMPOSITION pixels, so an edit means the same thing whatever size the preview
 * happens to be. The pointer handling follows the pattern already proven by the
 * terminal zoom tool (components/TerminalPreview.tsx): listeners are attached in
 * the capture phase and swallow click/dragstart, otherwise the Player's own
 * control bar eats the gesture.
 *
 * Only items visible at the current frame are interactive — you can't drag
 * something that isn't on screen.
 */

type Handle = ResizeHandle;

interface DragState {
  itemId: string;
  handle: Handle | null; // null = move
  startX: number;
  startY: number;
  origin: ItemLayout;
  scale: number; // screen px per composition px
}

const HANDLES: { id: Handle; x: number; y: number; cursor: string }[] = [
  { id: "nw", x: 0, y: 0, cursor: "nwse-resize" },
  { id: "n", x: 0.5, y: 0, cursor: "ns-resize" },
  { id: "ne", x: 1, y: 0, cursor: "nesw-resize" },
  { id: "e", x: 1, y: 0.5, cursor: "ew-resize" },
  { id: "se", x: 1, y: 1, cursor: "nwse-resize" },
  { id: "s", x: 0.5, y: 1, cursor: "ns-resize" },
  { id: "sw", x: 0, y: 1, cursor: "nesw-resize" },
  { id: "w", x: 0, y: 0.5, cursor: "ew-resize" },
];

export default function EditorCanvas({
  doc, currentFrame, selectedIds, onSelectionChange, onChange, boxW, boxH,
}: {
  doc: EditorDoc;
  currentFrame: number;
  selectedIds: Set<string>;
  onSelectionChange: (next: Set<string>) => void;
  onChange: (next: EditorDoc) => void;
  /** Size of the rendered video box, in screen pixels. */
  boxW: number;
  boxH: number;
}) {
  const [drag, setDrag] = useState<DragState | null>(null);
  /** Text item being edited in place, and its working value. */
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [preview, setPreview] = useState<ItemLayout | null>(null);
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const rootRef = useRef<HTMLDivElement>(null);
  const latest = useRef<{ layout: ItemLayout | null; itemId: string | null }>({ layout: null, itemId: null });

  const scale = boxW / doc.size.width;
  const visible = useMemo(() => itemsAtFrame(doc, currentFrame), [doc, currentFrame]);

  const begin = useCallback((e: React.PointerEvent, item: EditorItem, handle: Handle | null) => {
    if (editing?.id === item.id) return; // let the caret take the pointer
    e.preventDefault();
    e.stopPropagation();
    onSelectionChange(e.shiftKey || e.metaKey || e.ctrlKey
      ? new Set([...selectedIds, item.id])
      : new Set([item.id]));
    // Start from where the item ACTUALLY is at this frame. On a keyframed clip
    // the static layout is dormant, so dragging from it would jump.
    const at = itemLayoutAt(item, currentFrame);
    latest.current = { layout: at, itemId: item.id };
    setPreview(at);
    setDrag({ itemId: item.id, handle, startX: e.clientX, startY: e.clientY, origin: at, scale });
  }, [scale, selectedIds, onSelectionChange, editing, currentFrame]);

  useEffect(() => {
    if (!drag) return;
    const s = drag;

    function onMove(e: PointerEvent) {
      const dxComp = (e.clientX - s.startX) / s.scale;
      const dyComp = (e.clientY - s.startY) / s.scale;
      const tol = 8 / s.scale;
      let next: ItemLayout = { ...s.origin };
      let gx: number | null = null;
      let gy: number | null = null;

      if (s.handle === null) {
        // Shift locks movement to whichever axis you have moved furthest along.
        let dx = dxComp;
        let dy = dyComp;
        if (e.shiftKey) {
          if (Math.abs(dxComp) > Math.abs(dyComp)) dy = 0; else dx = 0;
        }
        const snapped = snapBox(
          s.origin.x + dx, s.origin.y + dy, s.origin.width, s.origin.height, doc.size, tol,
        );
        gx = snapped.guideX;
        gy = snapped.guideY;
        next = { ...s.origin, x: Math.round(snapped.x), y: Math.round(snapped.y) };
      } else {
        next = resizeLayout(s.origin, s.handle, dxComp, dyComp);
      }

      latest.current = { layout: next, itemId: s.itemId };
      setPreview(next);
      setGuides({ x: gx, y: gy });
    }

    function onUp() {
      const { layout, itemId } = latest.current;
      setDrag(null);
      setPreview(null);
      setGuides({ x: null, y: null });
      if (!layout || !itemId) return;

      const item = doc.tracks.flatMap((t) => t.items).find((i) => i.id === itemId);
      if (!item) return;

      /*
       * Where the drag lands depends on whether the property is animated.
       *
       * If x or y has keys, its static scalar is DORMANT — writing there would
       * look like the drag did nothing. So a move on an animated channel writes
       * a KEY at the playhead instead, which is what you meant by dragging.
       *
       * Width and height are never keyable (scale is the animated property, and
       * animating width would re-lay out text every frame), so they always go
       * to the layout.
       */
      const localFrame = currentFrame - item.from;
      let next = doc;
      const patch: Partial<ItemLayout> = {};
      for (const k of ["x", "y", "width", "height"] as const) {
        const v = layout[k];
        if (v === undefined) continue;
        if ((k === "x" || k === "y") && isAnimated(item, k)) {
          next = setItemKey(next, itemId, k, localFrame, v);
        } else {
          patch[k] = v;
        }
      }
      if (Object.keys(patch).length > 0) next = setLayout(next, itemId, patch);
      onChange(next);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag, doc, onChange, currentFrame]);

  // The Player's controls sit under this overlay and would otherwise claim the
  // gesture; swallow the events it reacts to while a drag is in progress.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const swallow = (e: Event) => { if (drag) { e.preventDefault(); e.stopPropagation(); } };
    el.addEventListener("click", swallow, true);
    el.addEventListener("dragstart", swallow, true);
    return () => {
      el.removeEventListener("click", swallow, true);
      el.removeEventListener("dragstart", swallow, true);
    };
  }, [drag]);

  const toScreen = (l: ItemLayout) => {
    // The selection box has to sit on the item as RENDERED, so it turns AND
    // scales with it. Un-rotated handles on rotated content are unusable — you
    // can't tell which corner you're grabbing — and a box that ignores scale
    // detaches from a keyframed clip entirely.
    //
    // Note left/top are applied before the transform, so a drag delta is 1:1
    // with the cursor regardless of the item's scale; there is nothing to
    // divide by here.
    const sc = l.scale ?? 1;
    const t = [sc !== 1 ? `scale(${sc})` : null, l.rotation ? `rotate(${l.rotation}deg)` : null]
      .filter(Boolean).join(" ");
    return {
      left: l.x * scale,
      top: l.y * scale,
      width: l.width * scale,
      height: l.height * scale,
      transform: t || undefined,
      transformOrigin: `${(l.anchorX ?? 0.5) * 100}% ${(l.anchorY ?? 0.5) * 100}%`,
    };
  };

  return (
    <div
      ref={rootRef}
      onPointerDown={() => onSelectionChange(new Set())}
      style={{ position: "absolute", left: 0, top: 0, width: boxW, height: boxH, zIndex: 3 }}
    >
      {visible.map((item) => {
        const selected = selectedIds.has(item.id);
        const layout = drag?.itemId === item.id && preview ? preview : itemLayoutAt(item, currentFrame);
        const box = toScreen(layout);
        return (
          <div
            key={item.id}
            onPointerDown={(e) => begin(e, item, null)}
            onDoubleClick={(e) => {
              // Editing the words where you can see them beats hunting for a
              // field in a side panel.
              if (item.type !== "text") return;
              e.stopPropagation();
              setEditing({ id: item.id, text: (item as TextItem).text });
            }}
            style={{
              position: "absolute", ...box, cursor: item.type === "text" ? "text" : "move",
              outline: selected ? "1.5px solid var(--brand)" : "1px dashed rgba(255,255,255,0.25)",
              outlineOffset: 0,
              background: "transparent",
            }}
          >
            {editing?.id === item.id && (
              <textarea
                autoFocus
                value={editing.text}
                onChange={(ev) => setEditing({ id: item.id, text: ev.target.value })}
                onPointerDown={(ev) => ev.stopPropagation()}
                onBlur={() => {
                  onChange(updateItem<TextItem>(doc, item.id, { text: editing.text }));
                  setEditing(null);
                }}
                onKeyDown={(ev) => {
                  // Enter commits; Shift+Enter is a new line, as in every editor.
                  if (ev.key === "Enter" && !ev.shiftKey) {
                    ev.preventDefault();
                    onChange(updateItem<TextItem>(doc, item.id, { text: editing.text }));
                    setEditing(null);
                  } else if (ev.key === "Escape") {
                    ev.preventDefault();
                    setEditing(null);
                  }
                  ev.stopPropagation();
                }}
                style={{
                  position: "absolute", inset: 0, width: "100%", height: "100%",
                  // Match the rendered text so editing looks like the result.
                  background: "rgba(0,0,0,0.45)",
                  border: "1.5px solid var(--brand)",
                  color: (item as TextItem).style.color,
                  fontFamily: (item as TextItem).style.fontFamily,
                  fontSize: (item as TextItem).style.fontSize * scale,
                  fontWeight: (item as TextItem).style.fontWeight ?? 400,
                  lineHeight: (item as TextItem).style.lineHeight ?? 1.2,
                  textAlign: (item as TextItem).style.align ?? "left",
                  padding: 0, margin: 0, resize: "none", outline: "none",
                  overflow: "hidden", boxSizing: "border-box",
                }}
              />
            )}
            {selected && !editing && HANDLES.map((h) => (
              <div
                key={h.id}
                onPointerDown={(e) => begin(e, item, h.id)}
                style={{
                  position: "absolute",
                  left: `calc(${h.x * 100}% - 4px)`,
                  top: `calc(${h.y * 100}% - 4px)`,
                  width: 8, height: 8, borderRadius: 2,
                  background: "var(--brand)", border: "1px solid #fff",
                  cursor: h.cursor,
                }}
              />
            ))}
          </div>
        );
      })}

      {guides.x != null && (
        <div style={{ position: "absolute", left: guides.x * scale, top: 0, bottom: 0, width: 1, background: "var(--brand)", opacity: 0.8, pointerEvents: "none" }} />
      )}
      {guides.y != null && (
        <div style={{ position: "absolute", top: guides.y * scale, left: 0, right: 0, height: 1, background: "var(--brand)", opacity: 0.8, pointerEvents: "none" }} />
      )}
    </div>
  );
}
