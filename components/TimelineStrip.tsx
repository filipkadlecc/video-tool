"use client";

import React, { useCallback, useRef } from "react";
import Icon from "@/components/ui/Icon";
import IconButton from "@/components/ui/IconButton";
import { usePlayheadFrame } from "@/hooks/usePlayhead";
import { docDuration, getAsset, type EditorDoc, type EditorItem, type Track } from "@/lib/editor-doc";

/**
 * The timeline as a MAP rather than as an editor — the collapsed strip that
 * Direct and code mode sit on top of.
 *
 * Both of those used to show the full Cut timeline squeezed into 152px: track
 * heads eating the first 168px, a ruler, hover controls, a zoom slider and
 * eight tools, all for a band two clips tall. Everything that makes the full
 * timeline good to edit in makes it useless at this height.
 *
 * So this is a different thing, not a smaller one. No ruler, no track heads, no
 * zoom: clips fill the width, carry their names, and tell you where the
 * playhead is. You can seek and you can select. Anything more — trimming,
 * dragging, keyframes — is what **Expand** is for, and that is one click away.
 */

/** Video and title rows 26px, audio 20px, 5px between them. */
const ROW_H_VIDEO = 26;
const ROW_H_AUDIO = 20;
const ROW_GAP = 5;

const isAudioTrack = (t: Track) => t.items.length > 0 && t.items.every((i) => i.type === "audio");

interface Props {
  doc: EditorDoc;
  selectedIds: Set<string>;
  onSelectionChange: (next: Set<string>) => void;
  onSeek?: (frame: number) => void;
  onScrubStart?: () => void;
  /** Open the full timeline. Owned by the page: it also resizes the panel. */
  onExpand: () => void;
  /** Split the selected clip at the playhead — the strip's one edit. */
  onSplit?: () => void;
}

export default function TimelineStrip({
  doc, selectedIds, onSelectionChange, onSeek, onScrubStart, onExpand, onSplit,
}: Props) {
  const frame = usePlayheadFrame();
  const total = Math.max(1, docDuration(doc));
  const laneRef = useRef<HTMLDivElement>(null);

  const frameFromClientX = useCallback((clientX: number) => {
    const el = laneRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return Math.max(0, Math.min(total - 1, Math.round(((clientX - r.left) / r.width) * total)));
  }, [total]);

  const startScrub = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    onScrubStart?.();
    onSeek?.(frameFromClientX(e.clientX));
    const move = (ev: PointerEvent) => onSeek?.(frameFromClientX(ev.clientX));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, [frameFromClientX, onSeek, onScrubStart]);

  const label = (item: EditorItem): string => {
    if (item.type === "text") return (item as { text: string }).text;
    if (item.type === "scene" && "snippet" in item && item.snippet) return String(item.snippet.id);
    const assetId = (item as { assetId?: string }).assetId;
    const asset = assetId ? getAsset(doc, assetId) : undefined;
    return asset?.name ?? item.type;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, background: "var(--surface-chrome)" }}>
      {/* 32px header: what you are looking at, and the way out of it. */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 8, height: 32, flexShrink: 0,
          padding: "0 8px", borderBottom: "1px solid var(--border-hairline)",
        }}
      >
        <span className="t-section" style={{ color: "var(--ink-tertiary)" }}>Timeline</span>
        <span className="t-data-s" style={{ color: "var(--ink-disabled)" }}>
          {doc.tracks.length} {doc.tracks.length === 1 ? "track" : "tracks"} · {total}f
        </span>
        <div style={{ flex: 1 }} />
        {onSplit && (
          <IconButton
            icon="scissors" size={24} title="Split at playhead" shortcut="S"
            disabled={selectedIds.size !== 1} onClick={onSplit}
          />
        )}
        <button
          onClick={onExpand}
          className="focus-ring"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6, height: 24, padding: "0 8px",
            background: "var(--surface-raised)", border: "1px solid var(--border-edge)",
            borderRadius: "var(--r-control)", color: "var(--ink-secondary)", cursor: "pointer",
            fontSize: 11,
          }}
          title="Open the full timeline"
        >
          <Icon name="expand" size={12} />
          Expand
        </button>
      </div>

      {/* The clips. One row per track, positioned by frame across the width. */}
      <div
        onPointerDown={startScrub}
        className="vt-scroll"
        style={{
          flex: 1, minHeight: 0, overflowY: "auto",
          padding: "6px 0", cursor: "ew-resize", userSelect: "none",
        }}
      >
        {/*
          The inner box is what the frames map onto, so it is also what the
          scrub reads. Padding on the scroller instead would put the clips and
          the playhead on two different coordinate systems — the clip at frame 0
          would start 8px right of where the playhead says frame 0 is.
        */}
        <div ref={laneRef} style={{ position: "relative", margin: "0 8px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: ROW_GAP }}>
          {doc.tracks.map((track) => {
            const h = isAudioTrack(track) ? ROW_H_AUDIO : ROW_H_VIDEO;
            return (
              <div key={track.id} style={{ position: "relative", height: h }}>
                {track.items.map((item) => {
                  const selected = selectedIds.has(item.id);
                  const left = (item.from / total) * 100;
                  const width = (item.durationInFrames / total) * 100;
                  return (
                    <div
                      key={item.id}
                      onPointerDown={(e) => {
                        // Selecting must not also scrub — the lane below would
                        // move the playhead out from under the click.
                        e.stopPropagation();
                        onSelectionChange(
                          e.shiftKey || e.metaKey || e.ctrlKey
                            ? new Set(selectedIds.has(item.id)
                                ? [...selectedIds].filter((id) => id !== item.id)
                                : [...selectedIds, item.id])
                            : new Set([item.id]),
                        );
                      }}
                      title={label(item)}
                      style={{
                        position: "absolute", top: 0, bottom: 0,
                        left: `${left}%`, width: `${width}%`, minWidth: 2,
                        display: "flex", alignItems: "center", padding: "0 6px",
                        background: item.type === "video" || item.type === "image" || item.type === "gif"
                          ? "var(--surface-hover)"
                          : "var(--surface-raised)",
                        border: `1px solid ${selected ? "var(--ink-primary)" : "var(--border-edge)"}`,
                        borderRadius: "var(--r-item)",
                        opacity: track.hidden ? 0.35 : 1,
                        overflow: "hidden", cursor: "pointer",
                      }}
                    >
                      <span
                        className="t-control"
                        style={{
                          color: "var(--ink-primary)", whiteSpace: "nowrap",
                          overflow: "hidden", textOverflow: "ellipsis",
                        }}
                      >
                        {label(item)}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* The playhead, full height, so the strip answers "where am I?". */}
        <div
          style={{
            position: "absolute", top: -6, bottom: -6, left: `${(frame / total) * 100}%`,
            width: 1, background: "var(--live)", pointerEvents: "none",
          }}
        >
          <span
            style={{
              position: "absolute", top: 0, left: -4, width: 9, height: 9,
              background: "var(--live)", borderRadius: 1,
            }}
          />
        </div>
        </div>
      </div>
    </div>
  );
}
