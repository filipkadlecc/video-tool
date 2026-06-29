"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { parseTimeline, getClipColor, type TimelineClip } from "@/lib/timeline-parser";
import {
  docFromCode,
  codeFromDoc,
  moveClip,
  trimClipLeft,
  trimClipRight,
  splitClip,
  type EditableDoc,
} from "@/lib/editable-timeline";
import Icon from "@/components/ui/Icon";

interface TimelineProps {
  code: string;
  fps: number;
  durationInFrames: number;
  /**
   * When provided, the timeline becomes draggable. Each pointer-up commit
   * regenerates the composition code and calls this with the new source.
   * The parent is responsible for snapshotting (codeHistory) and persisting.
   *
   * Works for video-clip compositions and for scene-only compositions
   * (animation / broll / svg) — see lib/editable-timeline.ts.
   */
  onCodeChange?: (next: string) => void;
}

type DragMode = "move" | "trim-left" | "trim-right";

interface DragState {
  clipId: string;
  mode: DragMode;
  originalFrom: number;
  originalDuration: number;
  startX: number;
  pixelsPerFrame: number;
  deltaFrames: number;
}

function formatTime(frames: number, fps: number): string {
  const totalSeconds = frames / fps;
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (mins > 0) return `${mins}:${secs.toFixed(1).padStart(4, "0")}`;
  return `${secs.toFixed(1)}s`;
}

function formatFrames(frames: number): string {
  return `${frames}f`;
}

export default function Timeline({
  code,
  fps,
  durationInFrames,
  onCodeChange,
}: TimelineProps) {
  const clips = useMemo(() => parseTimeline(code, fps), [code, fps]);
  const editableDoc = useMemo<EditableDoc | null>(
    () => (onCodeChange ? docFromCode(code, fps) : null),
    [code, fps, onCodeChange]
  );
  const isEditable = editableDoc != null;

  const trackRef = useRef<HTMLDivElement>(null);
  const [hoveredClip, setHoveredClip] = useState<number | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);

  // Window-level pointer move/up while dragging, so a fast drag that leaves
  // the clip's hit area still tracks correctly.
  useEffect(() => {
    if (!dragState) return;
    function handleMove(e: PointerEvent) {
      setDragState((prev) => {
        if (!prev) return prev;
        const deltaPx = e.clientX - prev.startX;
        const deltaFrames = Math.round(deltaPx / prev.pixelsPerFrame);
        return { ...prev, deltaFrames };
      });
    }
    function handleUp() {
      setDragState((prev) => {
        if (!prev || !editableDoc || !onCodeChange) return null;
        if (prev.deltaFrames !== 0) {
          let updated: EditableDoc;
          if (prev.mode === "trim-right") {
            updated = trimClipRight(editableDoc, prev.clipId, prev.deltaFrames);
          } else if (prev.mode === "trim-left") {
            updated = trimClipLeft(editableDoc, prev.clipId, prev.deltaFrames);
          } else {
            updated = moveClip(editableDoc, prev.clipId, prev.deltaFrames);
          }
          onCodeChange(codeFromDoc(updated));
        }
        return null;
      });
    }
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [dragState, editableDoc, onCodeChange]);

  if (clips.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "var(--text-3)",
          fontSize: 11,
          gap: 6,
        }}
      >
        <Icon name="film" size={13} />
        No timeline data — generate or edit code to see clips
      </div>
    );
  }

  // Calculate total duration. While dragging we may be moving a clip past the
  // current end — extend the ruler so it doesn't fall off-screen.
  const baseTotalFrames = Math.max(
    durationInFrames,
    ...clips.map((c) => c.from + c.durationInFrames)
  );
  let totalFrames = baseTotalFrames;
  if (dragState && editableDoc) {
    const drag = editableDoc.clips.find((c) => c.id === dragState.clipId);
    if (drag) {
      let pendingEnd: number;
      if (dragState.mode === "trim-right") {
        pendingEnd = drag.from + Math.max(1, drag.durationInFrames + dragState.deltaFrames);
      } else if (dragState.mode === "trim-left") {
        pendingEnd = drag.from + drag.durationInFrames;
      } else {
        pendingEnd = Math.max(0, drag.from + dragState.deltaFrames) + drag.durationInFrames;
      }
      totalFrames = Math.max(totalFrames, pendingEnd);
    }
  }
  const totalSeconds = totalFrames / fps;

  const markerInterval = totalSeconds <= 10 ? 1 : totalSeconds <= 30 ? 2 : totalSeconds <= 60 ? 5 : 10;
  const markers: number[] = [];
  for (let t = 0; t <= totalSeconds; t += markerInterval) {
    markers.push(t);
  }

  // Group clips by track. When editable, walk editableDoc.clips in parallel so
  // each parsed clip gets the matching stable id for drag handles.
  const tracks: { label: string; icon: string; clips: (TimelineClip & { index: number; editableId?: string })[] }[] = [
    { label: "Video", icon: "film", clips: [] },
    { label: "Scenes", icon: "layers", clips: [] },
    { label: "Audio", icon: "monitor", clips: [] },
    { label: "Overlay", icon: "layers", clips: [] },
  ];

  let videoIdx = 0;
  let sceneIdx = 0;
  clips.forEach((clip, i) => {
    const tagged: TimelineClip & { index: number; editableId?: string } = { ...clip, index: i };
    if (clip.type === "video") {
      if (isEditable && editableDoc?.mode === "video") {
        const eid = editableDoc.clips[videoIdx]?.id;
        if (eid) tagged.editableId = eid;
      }
      videoIdx++;
      tracks[0].clips.push(tagged);
    } else if (clip.type === "audio") {
      tracks[2].clips.push(tagged);
    } else if (clip.type === "scene") {
      if (isEditable && editableDoc?.mode === "scene") {
        const eid = editableDoc.clips[sceneIdx]?.id;
        if (eid) tagged.editableId = eid;
      }
      sceneIdx++;
      tracks[1].clips.push(tagged);
    } else {
      tracks[3].clips.push(tagged);
    }
  });

  const activeTracks = tracks.filter((t) => t.clips.length > 0);

  function startDrag(
    e: React.PointerEvent<HTMLDivElement>,
    editableId: string,
    originalFrom: number,
    originalDuration: number,
    mode: DragMode,
  ) {
    if (!isEditable || !trackRef.current) return;
    const trackWidth = trackRef.current.clientWidth;
    if (trackWidth <= 0 || totalFrames <= 0) return;
    e.preventDefault();
    e.stopPropagation();
    setDragState({
      clipId: editableId,
      mode,
      originalFrom,
      originalDuration,
      startX: e.clientX,
      pixelsPerFrame: trackWidth / totalFrames,
      deltaFrames: 0,
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 14px",
          borderBottom: "0.5px solid var(--line-1)",
          flexShrink: 0,
        }}
      >
        <Icon name="film" size={13} style={{ color: "var(--text-2)" }} />
        <span className="mono cap" style={{ color: "var(--text-1)" }}>
          Timeline
        </span>
        {isEditable && (
          <span
            className="mono"
            style={{
              fontSize: 9,
              padding: "1px 6px",
              borderRadius: 3,
              background: "var(--accent-soft)",
              color: "var(--accent)",
              border: "0.5px solid var(--accent-line)",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
            title="Drag clips to reposition · drag edges to trim · alt-click to split"
          >
            Editable
          </span>
        )}
        <div style={{ flex: 1 }} />
        <span className="mono nums" style={{ fontSize: 10, color: "var(--text-3)" }}>
          {clips.length} clips &middot; {formatTime(totalFrames, fps)}
        </span>
      </div>

      {/* Timeline area */}
      <div
        className="vt-scroll"
        style={{ flex: 1, minHeight: 0, overflowX: "auto", overflowY: "auto" }}
      >
        <div style={{ minWidth: 500, padding: "8px 0" }}>
          {/* Time ruler */}
          <div
            style={{
              position: "relative",
              height: 20,
              marginLeft: 72,
              marginRight: 14,
              borderBottom: "0.5px solid var(--line-2)",
            }}
          >
            {markers.map((t) => {
              const pct = (t / totalSeconds) * 100;
              return (
                <div
                  key={t}
                  style={{
                    position: "absolute",
                    left: `${pct}%`,
                    top: 0,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                  }}
                >
                  <span
                    className="mono nums"
                    style={{ fontSize: 9, color: "var(--text-3)", whiteSpace: "nowrap" }}
                  >
                    {t >= 60
                      ? `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`
                      : `${t}s`}
                  </span>
                  <div
                    style={{
                      width: 1,
                      flex: 1,
                      background: "var(--line-1)",
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Tracks */}
          {activeTracks.map((track, ti) => {
            const isEditableTrack = track.label === "Video" || track.label === "Scenes";
            return (
              <div key={ti} style={{ display: "flex", alignItems: "stretch", minHeight: 36 }}>
                {/* Track label */}
                <div
                  style={{
                    width: 72,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "0 10px",
                    borderRight: "0.5px solid var(--line-1)",
                  }}
                >
                  <Icon name={track.icon} size={11} style={{ color: "var(--text-3)" }} />
                  <span className="mono cap" style={{ color: "var(--text-3)", fontSize: 9 }}>
                    {track.label}
                  </span>
                </div>

                {/* Track content */}
                <div
                  ref={isEditableTrack ? trackRef : undefined}
                  style={{
                    flex: 1,
                    position: "relative",
                    height: 32,
                    margin: "2px 14px 2px 0",
                    background: "var(--bg-inset)",
                    borderRadius: "var(--r-xs)",
                    border: "0.5px solid var(--line-1)",
                  }}
                >
                  {track.clips.map((clip) => {
                    const isDragging =
                      dragState != null && clip.editableId === dragState.clipId;
                    let renderFrom = clip.from;
                    let renderDuration = clip.durationInFrames;
                    if (isDragging && dragState) {
                      if (dragState.mode === "move") {
                        renderFrom = Math.max(0, dragState.originalFrom + dragState.deltaFrames);
                      } else if (dragState.mode === "trim-right") {
                        renderDuration = Math.max(1, dragState.originalDuration + dragState.deltaFrames);
                      } else if (dragState.mode === "trim-left") {
                        const maxDelta = dragState.originalDuration - 1;
                        const minDelta = -dragState.originalFrom;
                        const clamped = Math.max(minDelta, Math.min(maxDelta, dragState.deltaFrames));
                        renderFrom = dragState.originalFrom + clamped;
                        renderDuration = dragState.originalDuration - clamped;
                      }
                    }
                    const left = (renderFrom / totalFrames) * 100;
                    const width = (renderDuration / totalFrames) * 100;
                    const color = getClipColor(clip.index);
                    const isHovered = hoveredClip === clip.index;
                    const draggable =
                      isEditable && isEditableTrack && clip.editableId != null;

                    return (
                      <div
                        key={`${clip.editableId ?? clip.index}`}
                        onMouseEnter={() => !isDragging && setHoveredClip(clip.index)}
                        onMouseLeave={() => setHoveredClip(null)}
                        onPointerDown={(e) => {
                          if (!draggable || !clip.editableId) return;
                          // Alt-click splits the clip at the cursor X.
                          if (e.altKey && editableDoc && onCodeChange && trackRef.current) {
                            const rect = trackRef.current.getBoundingClientRect();
                            const localX = e.clientX - rect.left;
                            const frame = Math.round(
                              (localX / rect.width) * totalFrames,
                            );
                            const next = splitClip(editableDoc, clip.editableId, frame);
                            if (next !== editableDoc) {
                              onCodeChange(codeFromDoc(next));
                            }
                            e.preventDefault();
                            e.stopPropagation();
                            return;
                          }
                          startDrag(e, clip.editableId, clip.from, clip.durationInFrames, "move");
                        }}
                        style={{
                          position: "absolute",
                          left: `${left}%`,
                          width: `${Math.max(width, 0.5)}%`,
                          top: 2,
                          bottom: 2,
                          background: `color-mix(in oklab, ${color} ${
                            isDragging ? "40%" : isHovered ? "30%" : "20%"
                          }, transparent)`,
                          border: `0.5px solid color-mix(in oklab, ${color} ${
                            isDragging ? "80%" : isHovered ? "60%" : "40%"
                          }, transparent)`,
                          borderRadius: 3,
                          overflow: "hidden",
                          cursor: draggable ? (isDragging ? "grabbing" : "grab") : "default",
                          transition: isDragging
                            ? "none"
                            : "background 100ms, border-color 100ms",
                          zIndex: isDragging ? 5 : 1,
                          boxShadow: isDragging
                            ? `0 4px 12px rgba(0,0,0,0.4)`
                            : "none",
                          touchAction: draggable ? "none" : undefined,
                          userSelect: "none",
                        }}
                      >
                        {/* Clip label */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "0 6px",
                            height: "100%",
                            overflow: "hidden",
                            pointerEvents: "none",
                          }}
                        >
                          <span
                            className="mono"
                            style={{
                              fontSize: 9,
                              fontWeight: 600,
                              color,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {clip.name}
                          </span>
                          {width > 8 && (
                            <span
                              className="mono nums"
                              style={{ fontSize: 8, color: "var(--text-3)", whiteSpace: "nowrap" }}
                            >
                              {formatTime(clip.durationInFrames, fps)}
                            </span>
                          )}
                        </div>

                        {/* Trim handles (edges) — only on editable video clips */}
                        {draggable && clip.editableId && (isHovered || isDragging) && (
                          <>
                            <div
                              onPointerDown={(e) => {
                                if (clip.editableId) {
                                  startDrag(e, clip.editableId, clip.from, clip.durationInFrames, "trim-left");
                                }
                              }}
                              style={{
                                position: "absolute",
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: 6,
                                cursor: "ew-resize",
                                background:
                                  isDragging && dragState?.mode === "trim-left"
                                    ? color
                                    : `color-mix(in oklab, ${color} 60%, transparent)`,
                                borderTopLeftRadius: 3,
                                borderBottomLeftRadius: 3,
                                touchAction: "none",
                                zIndex: 2,
                              }}
                            />
                            <div
                              onPointerDown={(e) => {
                                if (clip.editableId) {
                                  startDrag(e, clip.editableId, clip.from, clip.durationInFrames, "trim-right");
                                }
                              }}
                              style={{
                                position: "absolute",
                                right: 0,
                                top: 0,
                                bottom: 0,
                                width: 6,
                                cursor: "ew-resize",
                                background:
                                  isDragging && dragState?.mode === "trim-right"
                                    ? color
                                    : `color-mix(in oklab, ${color} 60%, transparent)`,
                                borderTopRightRadius: 3,
                                borderBottomRightRadius: 3,
                                touchAction: "none",
                                zIndex: 2,
                              }}
                            />
                          </>
                        )}

                        {/* Tooltip on hover (suppressed during drag) */}
                        {isHovered && !isDragging && (
                          <div
                            style={{
                              position: "absolute",
                              bottom: "calc(100% + 6px)",
                              left: 0,
                              padding: "6px 10px",
                              background: "var(--bg-3)",
                              border: "0.5px solid var(--line-2)",
                              borderRadius: "var(--r-sm)",
                              boxShadow: "var(--sh-float)",
                              zIndex: 20,
                              whiteSpace: "nowrap",
                              pointerEvents: "none",
                            }}
                          >
                            <div className="mono" style={{ fontSize: 11, fontWeight: 600, color, marginBottom: 2 }}>
                              {clip.name}
                            </div>
                            <div className="mono nums" style={{ fontSize: 10, color: "var(--text-2)" }}>
                              {formatTime(clip.from, fps)} &rarr; {formatTime(clip.from + clip.durationInFrames, fps)}
                              &nbsp;&middot;&nbsp;{formatFrames(clip.durationInFrames)}
                            </div>
                            {clip.startFrom !== undefined && (
                              <div className="mono nums" style={{ fontSize: 10, color: "var(--text-3)" }}>
                                Source trim: from {formatFrames(clip.startFrom)}
                                {clip.endAt !== undefined && ` to ${formatFrames(clip.endAt)}`}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Live drag indicator: per-mode readout */}
                        {isDragging && dragState && (
                          <div
                            style={{
                              position: "absolute",
                              top: -22,
                              left: 0,
                              padding: "2px 6px",
                              fontSize: 10,
                              fontFamily: "var(--mono)",
                              color: "var(--accent)",
                              background: "rgba(0,0,0,0.7)",
                              border: "0.5px solid var(--accent)",
                              borderRadius: 3,
                              whiteSpace: "nowrap",
                              pointerEvents: "none",
                            }}
                          >
                            {dragState.mode === "move"
                              ? formatTime(renderFrom, fps)
                              : `${formatTime(renderDuration, fps)} (${formatFrames(renderDuration)})`}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
