"use client";

import React, { useMemo, useRef, useState } from "react";
import { parseTimeline, getClipColor, type TimelineClip } from "@/lib/timeline-parser";
import Icon from "@/components/ui/Icon";

interface TimelineProps {
  code: string;
  fps: number;
  durationInFrames: number;
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

export default function Timeline({ code, fps, durationInFrames }: TimelineProps) {
  const clips = useMemo(() => parseTimeline(code, fps), [code, fps]);
  const trackRef = useRef<HTMLDivElement>(null);
  const [hoveredClip, setHoveredClip] = useState<number | null>(null);

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

  // Calculate total duration from clips or use the composition duration
  const totalFrames = Math.max(
    durationInFrames,
    ...clips.map((c) => c.from + c.durationInFrames)
  );
  const totalSeconds = totalFrames / fps;

  // Generate time markers
  const markerInterval = totalSeconds <= 10 ? 1 : totalSeconds <= 30 ? 2 : totalSeconds <= 60 ? 5 : 10;
  const markers: number[] = [];
  for (let t = 0; t <= totalSeconds; t += markerInterval) {
    markers.push(t);
  }

  // Group clips by track (video on track 0, audio on track 1, scenes on track 2)
  const tracks: { label: string; icon: string; clips: (TimelineClip & { index: number })[] }[] = [
    { label: "Video", icon: "film", clips: [] },
    { label: "Audio", icon: "monitor", clips: [] },
    { label: "Overlay", icon: "layers", clips: [] },
  ];

  clips.forEach((clip, i) => {
    const tagged = { ...clip, index: i };
    if (clip.type === "video") tracks[0].clips.push(tagged);
    else if (clip.type === "audio") tracks[1].clips.push(tagged);
    else tracks[2].clips.push(tagged);
  });

  // Filter out empty tracks
  const activeTracks = tracks.filter((t) => t.clips.length > 0);

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
          {activeTracks.map((track, ti) => (
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
                ref={ti === 0 ? trackRef : undefined}
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
                  const left = (clip.from / totalFrames) * 100;
                  const width = (clip.durationInFrames / totalFrames) * 100;
                  const color = getClipColor(clip.index);
                  const isHovered = hoveredClip === clip.index;

                  return (
                    <div
                      key={`${clip.index}-${clip.from}`}
                      onMouseEnter={() => setHoveredClip(clip.index)}
                      onMouseLeave={() => setHoveredClip(null)}
                      style={{
                        position: "absolute",
                        left: `${left}%`,
                        width: `${Math.max(width, 0.5)}%`,
                        top: 2,
                        bottom: 2,
                        background: `color-mix(in oklab, ${color} ${isHovered ? "30%" : "20%"}, transparent)`,
                        border: `0.5px solid color-mix(in oklab, ${color} ${isHovered ? "60%" : "40%"}, transparent)`,
                        borderRadius: 3,
                        overflow: "hidden",
                        cursor: "default",
                        transition: "background 100ms, border-color 100ms",
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

                      {/* Tooltip on hover */}
                      {isHovered && (
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
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
