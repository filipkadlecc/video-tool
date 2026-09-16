"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { AbsoluteFill } from "remotion";
import { EditorComposition } from "@/remotion/EditorComposition";
import EditorCanvas from "@/components/EditorCanvas";
import EditorPlayerControls from "@/components/EditorPlayerControls";
import { docDuration, type EditorDoc } from "@/lib/editor-doc";
import { usePlayheadFrame, usePlayheadPlaying } from "@/hooks/usePlayhead";

/**
 * Preview for a document-based project. Mounts the SAME component the export
 * uses (`EditorComposition`), so the preview is the render rather than an
 * approximation of it.
 *
 * `playerRef` is a prop, not a forwarded ref: this component is loaded with
 * `next/dynamic({ ssr: false })` and a forwarded ref would be lost — the same
 * reason PreviewPanel takes it as a prop.
 */
export default function EditorPreview({
  doc,
  playerRef,
  selectedIds,
  onSelectionChange,
  onChange,
  onSeek,
  onTogglePlay,
  range,
}: {
  doc: EditorDoc;
  playerRef?: React.RefObject<PlayerRef | null>;
  selectedIds?: Set<string>;
  onSelectionChange?: (next: Set<string>) => void;
  onChange?: (next: EditorDoc, opts?: { transient?: boolean }) => void;
  onSeek?: (frame: number) => void;
  onTogglePlay?: () => void;
  range?: { in: number | null; out: number | null };
}) {
  // Subscribes: the selection box must sit on the item as RENDERED, and the
  // transport's timecode ticks. Both genuinely change every frame.
  const currentFrame = usePlayheadFrame();
  const isPlaying = usePlayheadPlaying();
  const durationInFrames = useMemo(() => docDuration(doc), [doc]);
  const inputProps = useMemo(() => ({ doc }), [doc]);
  const { width, height, fps } = doc.size;
  const isEmpty = doc.tracks.every((t) => t.items.length === 0);

  // The overlay has to sit exactly on the rendered video, so measure the largest
  // rect that keeps the composition's aspect ratio and fits the available area.
  // CSS `aspect-ratio` alone doesn't do this reliably when both dimensions are
  // constrained — the same reason TerminalPreview measures it by hand.
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ratio = width / height;
    const update = () => {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      setBox(r.width / r.height > ratio
        ? { w: Math.round(r.height * ratio), h: Math.round(r.height) }
        : { w: Math.round(r.width), h: Math.round(r.width / ratio) });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, height]);

  const canEdit = Boolean(onChange && onSelectionChange && selectedIds);
  const [loop, setLoop] = useState(true);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", position: "relative" }}>
      <div
        className="mono nums"
        style={{
          position: "absolute", top: 12, left: 12, zIndex: 2, padding: "4px 8px",
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", fontSize: 10,
          color: "rgba(255,255,255,0.75)", borderRadius: 3, border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        {durationInFrames}F / {fps}FPS / {(durationInFrames / fps).toFixed(1)}S
      </div>

      <div ref={boxRef} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#000", padding: 2, minHeight: 0, position: "relative" }}>
        <div style={{ position: "relative", width: box.w || "100%", height: box.h || undefined }}>
        <Player
          ref={playerRef}
          component={EditorComposition}
          inputProps={inputProps}
          compositionWidth={width}
          compositionHeight={height}
          durationInFrames={durationInFrames}
          fps={fps}
          style={{ width: "100%", height: "100%" }}
          loop={loop}
          errorFallback={({ error }) => (
            <AbsoluteFill style={{ backgroundColor: "#040D12", display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
              <div style={{ color: "#f87171", fontSize: 28, textAlign: "center", fontFamily: "sans-serif" }}>
                <div style={{ marginBottom: 12 }}>Render error</div>
                <div style={{ color: "var(--ink-tertiary)", fontSize: 20 }}>{error.message}</div>
              </div>
            </AbsoluteFill>
          )}
        />
        {/* Rule-of-thirds, under the interaction layer so it never eats a click.
            Barely there on purpose — a guide you notice is a guide in the way. */}
        {box.w > 0 && (
          <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }}>
            {[33.333, 66.667].map((pc) => (
              <React.Fragment key={pc}>
                <div style={{ position: "absolute", left: `${pc}%`, top: 0, bottom: 0, width: 1, background: "rgba(244,244,245,0.05)" }} />
                <div style={{ position: "absolute", top: `${pc}%`, left: 0, right: 0, height: 1, background: "rgba(244,244,245,0.05)" }} />
              </React.Fragment>
            ))}
          </div>
        )}

        {canEdit && box.w > 0 && (
          <EditorCanvas
            doc={doc}
            currentFrame={currentFrame}
            selectedIds={selectedIds!}
            onSelectionChange={onSelectionChange!}
            onChange={onChange!}
            boxW={box.w}
            boxH={box.h}
          />
        )}
        {box.w > 0 && (
          <div
            className="t-data-s"
            style={{
              position: "absolute", right: 8, bottom: 8, zIndex: 4, pointerEvents: "none",
              padding: "2px 6px", borderRadius: "var(--r-item)",
              background: "rgba(10,10,11,0.7)", color: "var(--ink-tertiary)",
            }}
          >
            {width} × {height} · {Math.round((box.w / width) * 100)}%
          </div>
        )}

        </div>
      </div>

      <EditorPlayerControls
        playerRef={playerRef}
        currentFrame={currentFrame}
        durationInFrames={durationInFrames}
        fps={fps}
        isPlaying={isPlaying}
        onSeek={onSeek}
        onTogglePlay={onTogglePlay}
        range={range}
        loop={loop}
        onLoopChange={setLoop}
      />

      {isEmpty && (
        <div
          style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            pointerEvents: "none", color: "var(--ink-tertiary)", fontSize: 13,
          }}
        >
          Drop a clip onto a track to start
        </div>
      )}
    </div>
  );
}
