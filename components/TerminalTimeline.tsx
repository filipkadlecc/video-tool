"use client";

import React, { useMemo, useRef } from "react";
import type {
  TerminalAnnotations,
  TerminalZoom,
  TerminalFreeze,
  TerminalEndCard,
} from "@/lib/types";
import { END_CARD_FRAMES } from "@/remotion/scenes/terminal/TerminalRecording";
import { parseTape, type TapeEvent } from "@/lib/tape-parser";

interface TerminalTimelineProps {
  code: string;
  annotations: TerminalAnnotations;
  currentFrame: number;
  onSeek: (frame: number) => void;
  onUpdateZoom: (id: string, partial: Partial<TerminalZoom>) => void;
  onUpdateFreeze: (id: string, partial: Partial<TerminalFreeze>) => void;
  onUpdateEndCard: (partial: Partial<TerminalEndCard>) => void;
}

const TRACK_HEIGHT = 32;
const EVENTS_HEIGHT = 22;

export default function TerminalTimeline({
  code,
  annotations,
  currentFrame,
  onSeek,
  onUpdateZoom,
  onUpdateFreeze,
  onUpdateEndCard,
}: TerminalTimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const freezes = annotations.freezes ?? [];
  const freezeTotalFrames = freezes.reduce((sum, f) => sum + f.durationFrames, 0);
  const { videoDurationFrames, fps } = annotations;
  const videoPortion = videoDurationFrames + freezeTotalFrames;
  const total = videoPortion + (annotations.endCard ? END_CARD_FRAMES : 0);

  // Parse the .tape source and map events from ms into composition frames.
  // The mapping assumes 1:1 alignment with the recorded video portion (before
  // freezes). It's close enough to be useful as a navigation aid — not a
  // frame-perfect overlay.
  const tapeEvents = useMemo(() => {
    if (!code) return [] as Array<TapeEvent & { startFrame: number; durationFrames: number }>;
    const parsed = parseTape(code);
    const msPerFrame = 1000 / Math.max(1, fps);
    return parsed.events
      .filter((ev) => ev.kind === "type" || ev.kind === "sleep" || ev.kind === "key")
      .map((ev) => ({
        ...ev,
        startFrame: Math.round(ev.startMs / msPerFrame),
        durationFrames: Math.max(1, Math.round(ev.durationMs / msPerFrame)),
      }));
  }, [code, fps]);

  const handleTrackMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only treat clicks on the empty track background as seek requests; chips
    // stopPropagation so they're unaffected.
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, px / rect.width));
    onSeek(Math.round(ratio * total));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {/* Lane: Tape events */}
      <div
        title="Tape events parsed from your .tape script"
        style={{
          position: "relative",
          height: EVENTS_HEIGHT,
          background: "var(--bg-3)",
          border: "0.5px solid var(--line-2)",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        {total > 0 &&
          tapeEvents.map((ev, i) => {
            const left = (ev.startFrame / total) * 100;
            const width = Math.max(0.4, (ev.durationFrames / total) * 100);
            const palette: Record<TapeEvent["kind"], { bg: string; bd: string; tx: string }> = {
              type: { bg: "rgba(255,140,80,0.55)", bd: "#ff8c50", tx: "#fff" },
              sleep: { bg: "rgba(150,150,160,0.35)", bd: "rgba(180,180,190,0.6)", tx: "var(--text-1)" },
              key: { bg: "rgba(100,200,255,0.45)", bd: "#64c8ff", tx: "#fff" },
              set: { bg: "transparent", bd: "transparent", tx: "var(--text-3)" },
              comment: { bg: "transparent", bd: "transparent", tx: "var(--text-3)" },
              unknown: { bg: "transparent", bd: "transparent", tx: "var(--text-3)" },
            };
            const c = palette[ev.kind];
            const label =
              ev.kind === "type" && ev.text
                ? ev.text.length > 18
                  ? ev.text.slice(0, 17) + "…"
                  : ev.text
                : ev.kind === "sleep"
                  ? `${(ev.durationMs / 1000).toFixed(2)}s`
                  : ev.key ?? "";
            return (
              <div
                key={i}
                title={ev.raw}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onSeek(ev.startFrame);
                }}
                className="mono"
                style={{
                  position: "absolute",
                  top: 2,
                  bottom: 2,
                  left: `${left}%`,
                  width: `${width}%`,
                  minWidth: 2,
                  background: c.bg,
                  border: `0.5px solid ${c.bd}`,
                  borderRadius: 2,
                  color: c.tx,
                  fontSize: 9,
                  lineHeight: 1,
                  padding: "0 3px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {label}
              </div>
            );
          })}
        {/* Playhead */}
        {total > 0 && (
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `${(currentFrame / total) * 100}%`,
              width: 1,
              background: "var(--text-1)",
              pointerEvents: "none",
            }}
          />
        )}
      </div>

      {/* Lane: Video region + annotation chips. Click empty space to seek. */}
      <div
        ref={trackRef}
        onMouseDown={handleTrackMouseDown}
        style={{
          position: "relative",
          height: TRACK_HEIGHT,
          background: "var(--bg-3)",
          border: "0.5px solid var(--line-2)",
          borderRadius: 4,
          overflow: "hidden",
          cursor: "pointer",
        }}
      >
        {/* video region marker */}
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: `${(videoPortion / Math.max(1, total)) * 100}%`,
            background: "rgba(255,255,255,0.04)",
          }}
        />
        {freezes.map((f) => (
          <FreezeChip
            key={f.id}
            freeze={f}
            total={total}
            trackRef={trackRef}
            videoPortion={videoPortion}
            onUpdate={(partial) => onUpdateFreeze(f.id, partial)}
            onSeek={() => onSeek(f.atCompFrame)}
          />
        ))}
        {annotations.zooms.map((z) => (
          <ZoomChip
            key={z.id}
            zoom={z}
            total={total}
            videoDurationFrames={videoPortion}
            trackRef={trackRef}
            onUpdate={(partial) => onUpdateZoom(z.id, partial)}
            onSeek={() => onSeek(z.startFrame)}
          />
        ))}
        {annotations.banner && (
          <div
            title={`Banner ${annotations.banner.startFrame}–${annotations.banner.endFrame}`}
            onMouseDown={(e) => {
              e.stopPropagation();
              onSeek(annotations.banner!.startFrame);
            }}
            style={{
              position: "absolute",
              top: 4,
              bottom: 4,
              left: `${(annotations.banner.startFrame / Math.max(1, total)) * 100}%`,
              width: `${((annotations.banner.endFrame - annotations.banner.startFrame) / Math.max(1, total)) * 100}%`,
              background: "rgba(100,180,255,0.35)",
              border: "1px solid #5aa8ff",
              borderRadius: 2,
              cursor: "pointer",
            }}
          />
        )}
        {annotations.endCard && (
          <EndCardChip
            endCard={annotations.endCard}
            total={total}
            videoPortion={videoPortion}
            trackRef={trackRef}
            onUpdate={onUpdateEndCard}
            onSeek={() => onSeek(annotations.endCard?.startFrame ?? videoPortion)}
          />
        )}
        {/* Playhead */}
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${(currentFrame / Math.max(1, total)) * 100}%`,
            width: 1,
            background: "var(--text-1)",
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
}

/* ---------- Chip components (lifted from TerminalPreview's strip) ---------- */

interface ZoomChipProps {
  zoom: TerminalZoom;
  total: number;
  videoDurationFrames: number;
  trackRef: React.RefObject<HTMLDivElement | null>;
  onUpdate: (partial: Partial<TerminalZoom>) => void;
  onSeek: () => void;
}

function ZoomChip({ zoom, total, videoDurationFrames, trackRef, onUpdate, onSeek }: ZoomChipProps) {
  const dragRef = useRef<{
    mode: "move" | "left" | "right";
    startX: number;
    pxPerFrame: number;
    origStart: number;
    origEnd: number;
    moved: boolean;
  } | null>(null);

  const beginDrag = (mode: "move" | "left" | "right") => (e: React.MouseEvent) => {
    if (!trackRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = trackRef.current.getBoundingClientRect();
    const pxPerFrame = rect.width / total;
    dragRef.current = {
      mode,
      startX: e.clientX,
      pxPerFrame,
      origStart: zoom.startFrame,
      origEnd: zoom.endFrame,
      moved: false,
    };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const d = dragRef.current;
      const deltaFrames = Math.round((ev.clientX - d.startX) / d.pxPerFrame);
      if (Math.abs(deltaFrames) >= 1) d.moved = true;
      const cap = videoDurationFrames - 1;
      if (d.mode === "move") {
        const len = d.origEnd - d.origStart;
        const nextStart = Math.max(0, Math.min(cap - len, d.origStart + deltaFrames));
        onUpdate({ startFrame: nextStart, endFrame: nextStart + len });
      } else if (d.mode === "left") {
        const nextStart = Math.max(0, Math.min(d.origEnd - 1, d.origStart + deltaFrames));
        onUpdate({ startFrame: nextStart });
      } else {
        const nextEnd = Math.max(d.origStart + 1, Math.min(cap, d.origEnd + deltaFrames));
        onUpdate({ endFrame: nextEnd });
      }
    };
    const onUp = () => {
      const didMove = dragRef.current?.moved ?? false;
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (!didMove) onSeek();
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div
      title={`Zoom ${zoom.startFrame}–${zoom.endFrame}`}
      onMouseDown={beginDrag("move")}
      style={{
        position: "absolute",
        top: 4,
        bottom: 4,
        left: `${(zoom.startFrame / total) * 100}%`,
        width: `${((zoom.endFrame - zoom.startFrame) / total) * 100}%`,
        background: "rgba(255,100,184,0.45)",
        border: "1px solid var(--accent)",
        borderRadius: 2,
        cursor: "grab",
      }}
    >
      <div
        onMouseDown={beginDrag("left")}
        style={{
          position: "absolute",
          left: -2,
          top: -1,
          bottom: -1,
          width: 6,
          cursor: "ew-resize",
          background: "var(--accent)",
          borderRadius: 1,
        }}
      />
      <div
        onMouseDown={beginDrag("right")}
        style={{
          position: "absolute",
          right: -2,
          top: -1,
          bottom: -1,
          width: 6,
          cursor: "ew-resize",
          background: "var(--accent)",
          borderRadius: 1,
        }}
      />
    </div>
  );
}

interface EndCardChipProps {
  endCard: TerminalEndCard;
  total: number;
  videoPortion: number;
  trackRef: React.RefObject<HTMLDivElement | null>;
  onUpdate: (partial: Partial<TerminalEndCard>) => void;
  onSeek: () => void;
}

function EndCardChip({ endCard, total, videoPortion, trackRef, onUpdate, onSeek }: EndCardChipProps) {
  const start = endCard.startFrame ?? videoPortion;
  const dragRef = useRef<{ startX: number; pxPerFrame: number; origStart: number; moved: boolean } | null>(null);

  const onMouseDown = (e: React.MouseEvent) => {
    if (!trackRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = trackRef.current.getBoundingClientRect();
    dragRef.current = { startX: e.clientX, pxPerFrame: rect.width / total, origStart: start, moved: false };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const d = dragRef.current;
      const delta = Math.round((ev.clientX - d.startX) / d.pxPerFrame);
      if (Math.abs(delta) >= 1) d.moved = true;
      const next = Math.max(0, d.origStart + delta);
      onUpdate({ startFrame: next });
    };
    const onUp = () => {
      const didMove = dragRef.current?.moved ?? false;
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (!didMove) onSeek();
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div
      title="End card (drag to reposition)"
      onMouseDown={onMouseDown}
      style={{
        position: "absolute",
        top: 4,
        bottom: 4,
        left: `${(start / total) * 100}%`,
        width: `${(END_CARD_FRAMES / total) * 100}%`,
        background: "rgba(150,255,180,0.35)",
        border: "1px solid #6cd99a",
        borderRadius: 2,
        cursor: "grab",
      }}
    />
  );
}

interface FreezeChipProps {
  freeze: TerminalFreeze;
  total: number;
  videoPortion: number;
  trackRef: React.RefObject<HTMLDivElement | null>;
  onUpdate: (partial: Partial<TerminalFreeze>) => void;
  onSeek: () => void;
}

function FreezeChip({ freeze, total, videoPortion, trackRef, onUpdate, onSeek }: FreezeChipProps) {
  const dragRef = useRef<{
    mode: "move" | "right";
    startX: number;
    pxPerFrame: number;
    origAt: number;
    origDur: number;
    moved: boolean;
  } | null>(null);

  const beginDrag = (mode: "move" | "right") => (e: React.MouseEvent) => {
    if (!trackRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = trackRef.current.getBoundingClientRect();
    const pxPerFrame = rect.width / total;
    dragRef.current = {
      mode,
      startX: e.clientX,
      pxPerFrame,
      origAt: freeze.atCompFrame,
      origDur: freeze.durationFrames,
      moved: false,
    };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const d = dragRef.current;
      const deltaFrames = Math.round((ev.clientX - d.startX) / d.pxPerFrame);
      if (Math.abs(deltaFrames) >= 1) d.moved = true;
      if (d.mode === "move") {
        const nextAt = Math.max(0, Math.min(videoPortion - d.origDur, d.origAt + deltaFrames));
        onUpdate({ atCompFrame: nextAt });
      } else {
        const nextDur = Math.max(2, d.origDur + deltaFrames);
        onUpdate({ durationFrames: nextDur });
      }
    };
    const onUp = () => {
      const didMove = dragRef.current?.moved ?? false;
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (!didMove) onSeek();
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div
      title={`Freeze at ${freeze.atCompFrame} for ${freeze.durationFrames}`}
      onMouseDown={beginDrag("move")}
      style={{
        position: "absolute",
        top: 4,
        bottom: 4,
        left: `${(freeze.atCompFrame / total) * 100}%`,
        width: `${(freeze.durationFrames / total) * 100}%`,
        background: "rgba(230,196,92,0.45)",
        border: "1px solid #e6c45c",
        borderRadius: 2,
        cursor: "grab",
      }}
    >
      <div
        onMouseDown={beginDrag("right")}
        style={{
          position: "absolute",
          right: -2,
          top: -1,
          bottom: -1,
          width: 6,
          cursor: "ew-resize",
          background: "#e6c45c",
          borderRadius: 1,
        }}
      />
    </div>
  );
}
