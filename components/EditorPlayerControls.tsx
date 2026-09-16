"use client";

import React from "react";
import type { PlayerRef } from "@remotion/player";
import Icon from "@/components/ui/Icon";
import Tooltip from "@/components/ui/Tooltip";
import { needsHours, timecode } from "@/lib/timecode";

/** Re-exported: this used to own a second, four-field timecode. There is one now. */
export { timecode };

/**
 * Transport bar for the editor's viewer.
 *
 * Replaces Remotion's built-in controls, which sat INSIDE the video box —
 * underneath the selection overlay, so clicking play hit the overlay instead and
 * appeared to do nothing. Living outside the video box, these can't be
 * intercepted, and they can show a proper timecode and frame stepping.
 */


interface Props {
  playerRef?: React.RefObject<PlayerRef | null>;
  currentFrame: number;
  durationInFrames: number;
  fps: number;
  isPlaying?: boolean;
  onSeek?: (frame: number) => void;
  onTogglePlay?: () => void;
  loop: boolean;
  onLoopChange: (next: boolean) => void;
  /** In / out points, when set. Read-only here — I and O set them. */
  range?: { in: number | null; out: number | null };
}

export default function EditorPlayerControls({
  playerRef, currentFrame, durationInFrames, fps, isPlaying,
  onSeek, onTogglePlay, loop, onLoopChange,
  range,
}: Props) {
  const last = Math.max(0, durationInFrames - 1);
  const progress = last > 0 ? (Math.min(currentFrame, last) / last) * 100 : 0;
  const step = (by: number) => onSeek?.(Math.max(0, Math.min(last, currentFrame + by)));

  return (
    <div style={{ display: "flex", flexDirection: "column", background: "var(--surface-chrome)", borderTop: "1px solid var(--border-hairline)", padding: "4px 0 0" }}>
      {/*
        A native range input needs its appearance reset before it can be this
        thin. Left as `accentColor` on a 3px-tall control, the browser draws its
        full-size thumb and crops it — which looked like a green blob cut in half
        rather than a playhead. The track is drawn as a gradient so the played
        portion is filled, and the input is given a taller transparent hit area
        than the visible track so it stays easy to grab.
      */}
      <style>{`
        .vt-scrub {
          -webkit-appearance: none; appearance: none;
          width: 100%; height: 14px; margin: 0; padding: 0;
          background: transparent; outline: none; cursor: pointer; display: block;
        }
        .vt-scrub::-webkit-slider-runnable-track {
          height: 3px; border-radius: 2px;
        }
        .vt-scrub::-moz-range-track {
          height: 3px; border-radius: 2px; background: var(--border-hairline);
        }
        .vt-scrub::-moz-range-progress {
          height: 3px; border-radius: 2px; background: var(--live);
        }
        .vt-scrub::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 9px; height: 9px; border-radius: 50%;
          background: var(--live); border: none;
          /* Centre the thumb on a 3px track. */
          margin-top: -3px;
        }
        .vt-scrub::-moz-range-thumb {
          width: 9px; height: 9px; border-radius: 50%;
          background: var(--live); border: none;
        }
        .vt-scrub:focus-visible::-webkit-slider-thumb {
          box-shadow: 0 0 0 3px var(--brand-tint-bg);
        }
      `}</style>
      <input
        className="vt-scrub"
        type="range"
        min={0}
        max={last}
        step={1}
        value={Math.min(currentFrame, last)}
        onChange={(e) => onSeek?.(parseInt(e.target.value, 10))}
        aria-label="Playhead"
        style={{
          // WebKit has no ::-moz-range-progress equivalent, so the filled part
          // is painted as a gradient stop at the current position.
          background: `linear-gradient(to right, var(--live) 0 ${progress}%, var(--border-hairline) ${progress}% 100%)`,
          backgroundSize: "100% 3px",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 8px 6px" }}>
        <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
          <span className="t-data-l" style={{ color: "var(--ink-primary)", fontVariantNumeric: "tabular-nums" }}>
            {timecode(currentFrame, fps, needsHours(last, fps))}
          </span>
          <span className="t-data-m" style={{ color: "var(--ink-tertiary)" }}>
            / {timecode(last, fps, needsHours(last, fps))}
          </span>
        </span>

        {(range?.in !== null && range?.in !== undefined) || (range?.out !== null && range?.out !== undefined) ? (
          <span className="t-data-s" style={{ color: "var(--ink-tertiary)", marginLeft: 12 }}>
            {range?.in !== null && range?.in !== undefined ? `in ${timecode(range.in, fps, needsHours(last, fps))}` : ""}
            {range?.in !== null && range?.in !== undefined && range?.out !== null && range?.out !== undefined ? " · " : ""}
            {range?.out !== null && range?.out !== undefined ? `out ${timecode(range.out, fps, needsHours(last, fps))}` : ""}
          </span>
        ) : null}

        <div style={{ flex: 1 }} />

        <Btn title="Go to start" shortcut="Home" onClick={() => onSeek?.(0)} icon="skipBack" />
        <Btn title="Back one frame" shortcut="←" onClick={() => step(-1)} icon="chevronLeft" />
        <Btn
          title={isPlaying ? "Pause (Space)" : "Play (Space)"}
          shortcut="Space"
          onClick={() => onTogglePlay?.()}
          icon={isPlaying ? "pause" : "play"}
          emphasis
        />
        <Btn title="Forward one frame" shortcut="→" onClick={() => step(1)} icon="chevronRight" />
        <Btn title="Go to end" shortcut="End" onClick={() => onSeek?.(last)} icon="skipForward" />
        <Btn
          title={loop ? "Looping — click to play once" : "Play once — click to loop"}
          onClick={() => onLoopChange(!loop)}
          icon="loop"
          active={loop}
        />

        <div style={{ flex: 1 }} />

        <span className="mono nums" style={{ fontSize: 10, color: "var(--ink-disabled)", minWidth: 86, textAlign: "right" }}>
          {timecode(last, fps)}
        </span>
        <Btn
          title="Fullscreen"
          onClick={() => { try { playerRef?.current?.requestFullscreen(); } catch { /* not available */ } }}
          icon="maximize"
        />
      </div>
    </div>
  );
}

/**
 * A transport button. Icon-only, so it gets a real tooltip rather than a
 * native `title` — the shortcut string shown here is the same string the
 * shortcuts sheet advertises, by contract.
 */
function Btn({
  icon, title, shortcut, onClick, active, emphasis,
}: {
  icon: string;
  title: string;
  shortcut?: string;
  onClick: () => void;
  active?: boolean;
  emphasis?: boolean;
}) {
  return (
    <Tooltip label={title} shortcut={shortcut} placement="top">
    <button
      aria-label={title}
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: emphasis ? 28 : 24, height: emphasis ? 28 : 24,
        background: emphasis ? "var(--surface-hover)" : "transparent",
        border: emphasis ? "1px solid var(--border-hairline)" : "none",
        borderRadius: 4, cursor: "pointer", padding: 0,
      }}
    >
      <Icon
        name={icon}
        size={emphasis ? 14 : 12}
        style={{ color: active ? "var(--ink-primary)" : "var(--ink-secondary)" }}
      />
    </button>
    </Tooltip>
  );
}
