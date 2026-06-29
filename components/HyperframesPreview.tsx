"use client";

import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { buildCompositionHtml, parseSceneMeta } from "@/lib/hyperframes/template";

interface HyperframesPreviewProps {
  code: string;
  width?: number;
  height?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GsapTimeline = any;

// Live preview for HyperFrames scenes. Renders the SAME composition HTML the
// render path uses into an iframe, then drives that composition's GSAP timeline
// (window.__timelines.main, autoplaying + looping) through a transport bar:
// play/pause, scrub, and a frame readout — the HyperFrames equivalent of the
// Remotion Player controls.
export default function HyperframesPreview({ code, width = 1920, height = 1080 }: HyperframesPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const rafRef = useRef<number | undefined>(undefined);
  const [scale, setScale] = useState(0);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [frame, setFrame] = useState(0);
  // Transparency check: render the composition with a transparent page bg over a
  // checkerboard, so you can see what will be transparent on a WebM/MOV export.
  const [checker, setChecker] = useState(false);

  const { html, durationInFrames, fps } = useMemo(() => {
    if (!code || !code.trim()) return { html: "", durationInFrames: 0, fps: 30 };
    const meta = parseSceneMeta(code);
    return {
      html: buildCompositionHtml(code, { width, height, mode: "preview", transparent: checker }),
      durationInFrames: meta.durationInFrames,
      fps: meta.fps,
    };
  }, [code, width, height, checker]);

  const checkerStyle: React.CSSProperties = checker
    ? {
        backgroundColor: "#262626",
        backgroundImage:
          "linear-gradient(45deg,#3a3a3a 25%,transparent 25%),linear-gradient(-45deg,#3a3a3a 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#3a3a3a 75%),linear-gradient(-45deg,transparent 75%,#3a3a3a 75%)",
        backgroundSize: "24px 24px",
        backgroundPosition: "0 0,0 12px,12px -12px,-12px 0",
      }
    : { background: "#000" };

  // The composition's seekable GSAP timeline (same-origin srcDoc iframe).
  const getTl = useCallback((): GsapTimeline | null => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (iframeRef.current?.contentWindow as any)?.__timelines?.main ?? null;
    } catch {
      return null;
    }
  }, []);

  // Fit-to-panel scaling.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const cw = el.clientWidth, ch = el.clientHeight;
      if (cw > 0 && ch > 0) setScale(Math.min(cw / width, ch / height));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, height]);

  const stopRaf = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = undefined;
  }, []);

  // While playing, mirror the timeline's playhead into the scrubber. GSAP drives
  // playback (its own ticker + repeat:-1 loop); we only read its position.
  const startRaf = useCallback(() => {
    stopRaf();
    const loop = () => {
      const tl = getTl();
      if (tl && fps > 0) setFrame(Math.min(durationInFrames, Math.round(tl.time() * fps)));
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [getTl, fps, durationInFrames, stopRaf]);

  // (Re)bind when the iframe (re)loads.
  const handleLoad = useCallback(() => {
    // The timeline is registered synchronously at end of body; retry briefly in
    // case the load event fires a tick early.
    let tries = 0;
    const grab = () => {
      const tl = getTl();
      if (tl) {
        setReady(true);
        setPlaying(true);
        setFrame(0);
        tl.play();
        startRaf();
      } else if (tries++ < 30) {
        setTimeout(grab, 50);
      } else {
        setReady(false);
      }
    };
    grab();
  }, [getTl, startRaf]);

  useEffect(() => stopRaf, [stopRaf]);

  const togglePlay = useCallback(() => {
    const tl = getTl();
    if (!tl) return;
    if (playing) {
      tl.pause();
      setPlaying(false);
      stopRaf();
    } else {
      // If parked at the end, restart from 0.
      if (Math.round(tl.time() * fps) >= durationInFrames - 1) tl.time(0);
      tl.play();
      setPlaying(true);
      startRaf();
    }
  }, [getTl, playing, fps, durationInFrames, startRaf, stopRaf]);

  const onScrub = useCallback((value: number) => {
    const tl = getTl();
    if (!tl) return;
    tl.pause();
    tl.time(value / fps);
    setPlaying(false);
    stopRaf();
    setFrame(value);
  }, [getTl, fps, stopRaf]);

  const seconds = fps > 0 ? (durationInFrames / fps).toFixed(1) : "0.0";
  const curSeconds = fps > 0 ? (frame / fps).toFixed(1) : "0.0";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", position: "relative" }}>
      <style>{`
        .hf-scrub { -webkit-appearance: none; appearance: none; height: 4px; border-radius: 2px; background: var(--line-2, #3d3f43); outline: none; cursor: pointer; }
        .hf-scrub::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 12px; height: 12px; border-radius: 50%; background: var(--accent, #F86606); cursor: pointer; border: none; }
        .hf-scrub::-moz-range-thumb { width: 12px; height: 12px; border-radius: 50%; background: var(--accent, #F86606); cursor: pointer; border: none; }
      `}</style>

      <div
        className="mono nums"
        style={{
          position: "absolute", top: 12, left: 12, zIndex: 2, padding: "4px 8px",
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", fontSize: 10,
          color: "rgba(255,255,255,0.75)", borderRadius: 3, border: "0.5px solid rgba(255,255,255,0.1)",
        }}
      >
        {durationInFrames}F / {fps}FPS / {seconds}S · HyperFrames
      </div>

      <div
        ref={containerRef}
        style={{ flex: 1, position: "relative", padding: 2, minHeight: 0, overflow: "hidden", ...checkerStyle }}
      >
        {html ? (
          <iframe
            ref={iframeRef}
            key={`${width}x${height}`}
            title="HyperFrames preview"
            srcDoc={html}
            scrolling="no"
            onLoad={handleLoad}
            style={{
              position: "absolute", left: "50%", top: "50%", width, height, border: 0,
              transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: "center center",
              background: checker ? "transparent" : "#161718",
            }}
          />
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-2)", fontSize: 13 }}>
            No scene loaded
          </div>
        )}
      </div>

      {/* Transport */}
      {html && (
        <div
          style={{
            display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
            background: "var(--bg-2, #1d1e1f)", borderTop: "0.5px solid var(--line-2, #3d3f43)",
          }}
        >
          <button
            onClick={togglePlay}
            disabled={!ready}
            aria-label={playing ? "Pause" : "Play"}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 26, height: 26, borderRadius: 5, border: "none", cursor: ready ? "pointer" : "default",
              background: "var(--bg-4, #2a2c2e)", color: "var(--text-0, #f4f4f5)", flexShrink: 0,
              opacity: ready ? 1 : 0.5,
            }}
          >
            {playing ? (
              <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor"><rect x="2" y="1.5" width="3" height="9" rx="1" /><rect x="7" y="1.5" width="3" height="9" rx="1" /></svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor"><path d="M3 1.8 L10 6 L3 10.2 Z" /></svg>
            )}
          </button>

          <input
            className="hf-scrub"
            type="range"
            min={0}
            max={Math.max(0, durationInFrames - 1)}
            step={1}
            value={frame}
            disabled={!ready}
            onChange={(e) => onScrub(parseInt(e.target.value, 10))}
            style={{ flex: 1 }}
          />

          <button
            onClick={() => setChecker((v) => !v)}
            aria-label="Toggle transparency checkerboard"
            title="Preview on transparency (checkerboard) — see what a WebM/MOV export will keep transparent"
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 26, height: 26, borderRadius: 5, cursor: "pointer", flexShrink: 0,
              background: checker ? "var(--accent, #F86606)" : "var(--bg-4, #2a2c2e)",
              color: checker ? "#161718" : "var(--text-2, #bfc1c5)", border: "none",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <rect x="0" y="0" width="3" height="3" /><rect x="6" y="0" width="3" height="3" />
              <rect x="3" y="3" width="3" height="3" /><rect x="9" y="3" width="3" height="3" />
              <rect x="0" y="6" width="3" height="3" /><rect x="6" y="6" width="3" height="3" />
              <rect x="3" y="9" width="3" height="3" /><rect x="9" y="9" width="3" height="3" />
            </svg>
          </button>

          <span className="mono nums" style={{ fontSize: 11, color: "var(--text-2, #bfc1c5)", flexShrink: 0, minWidth: 92, textAlign: "right" }}>
            {frame}/{Math.max(0, durationInFrames - 1)} · {curSeconds}s
          </span>
        </div>
      )}
    </div>
  );
}
