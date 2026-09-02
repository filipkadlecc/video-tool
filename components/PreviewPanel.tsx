"use client";

import React, { useMemo, Component, type ReactNode } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { evalSceneCode } from "@/remotion/DynamicScene";
import { SvgFramesProvider, type SvgFrameSlot } from "@/remotion/motion";
import { AbsoluteFill } from "remotion";

const Fallback: React.FC = () => (
  <AbsoluteFill
    style={{
      backgroundColor: "#040D12",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "var(--text-2)",
      fontSize: 48,
      fontFamily: "sans-serif",
    }}
  >
    No scene loaded
  </AbsoluteFill>
);

class PlayerErrorBoundary extends Component<
  { children: ReactNode; code: string },
  { error: string | null }
> {
  state = { error: null as string | null };

  static getDerivedStateFromError(err: Error) {
    return { error: err.message };
  }

  componentDidUpdate(prevProps: { code: string }) {
    if (prevProps.code !== this.props.code && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#000",
            color: "var(--red)",
            fontSize: 13,
            padding: 16,
            textAlign: "center",
          }}
        >
          <div>
            <p style={{ fontWeight: 600, marginBottom: 4 }}>Preview error</p>
            <p style={{ fontSize: 12, color: "var(--text-2)" }}>{this.state.error}</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

interface PreviewPanelProps {
  code: string;
  width?: number;
  height?: number;
  svgContents?: SvgFrameSlot[];
  /**
   * Handle onto the Remotion Player so the timeline can drive a synced playhead
   * (read the current frame, seek, play/pause). Passed as a ref-object prop
   * rather than via forwardRef because PreviewPanel is loaded through
   * next/dynamic({ ssr: false }), which does not forward React refs.
   */
  playerRef?: React.RefObject<PlayerRef | null>;
}

export default function PreviewPanel({ code, width = 3840, height = 2160, svgContents, playerRef }: PreviewPanelProps) {
  const aspectRatio = `${width}/${height}`;
  const { SceneComponent, durationInFrames, fps } = useMemo(() => {
    if (!code || !code.trim()) {
      return { SceneComponent: Fallback, durationInFrames: 250, fps: 25 };
    }
    const result = evalSceneCode(code);
    if (!result) {
      return { SceneComponent: Fallback, durationInFrames: 250, fps: 25 };
    }
    const Inner = result.component;
    const Wrapped: React.FC = () => (
      <SvgFramesProvider value={svgContents ?? []}>
        <Inner />
      </SvgFramesProvider>
    );
    return {
      SceneComponent: Wrapped,
      durationInFrames: result.durationInFrames,
      fps: result.fps,
    };
  }, [code, svgContents]);

  const seconds = (durationInFrames / fps).toFixed(1);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", position: "relative" }}>
      {/* Frame info overlays */}
      <div
        className="mono nums"
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          zIndex: 2,
          padding: "4px 8px",
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(8px)",
          fontSize: 10,
          color: "rgba(255,255,255,0.75)",
          borderRadius: 3,
          border: "0.5px solid rgba(255,255,255,0.1)",
        }}
      >
        {durationInFrames}F / {fps}FPS / {seconds}S
      </div>

      {/* Player */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#000", padding: 2, minHeight: 0 }}>
        <PlayerErrorBoundary code={code}>
          <Player
            ref={playerRef}
            component={SceneComponent}
            compositionWidth={width}
            compositionHeight={height}
            durationInFrames={durationInFrames}
            fps={fps}
            style={{
              width: "100%",
              maxHeight: "100%",
              aspectRatio,
            }}
            controls
            autoPlay
            loop
            errorFallback={({ error }) => (
              <AbsoluteFill
                style={{
                  backgroundColor: "#040D12",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 40,
                }}
              >
                <div style={{ color: "#f87171", fontSize: 28, textAlign: "center", fontFamily: "sans-serif" }}>
                  <div style={{ marginBottom: 12 }}>Scene error</div>
                  <div style={{ color: "var(--text-2)", fontSize: 20 }}>{error.message}</div>
                </div>
              </AbsoluteFill>
            )}
          />
        </PlayerErrorBoundary>
      </div>
    </div>
  );
}
