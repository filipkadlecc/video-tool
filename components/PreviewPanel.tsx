"use client";

import React, { useMemo, Component, type ReactNode } from "react";
import { Player } from "@remotion/player";
import { evalSceneCode } from "@/remotion/DynamicScene";
import { AbsoluteFill } from "remotion";

const Fallback: React.FC = () => (
  <AbsoluteFill
    style={{
      backgroundColor: "#040D12",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#93B1A6",
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
        <div className="flex-1 flex items-center justify-center bg-black text-red-400 text-sm p-4 text-center">
          <div>
            <p className="font-medium mb-1">Preview error</p>
            <p className="text-xs text-muted">{this.state.error}</p>
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
}

export default function PreviewPanel({ code, width = 3840, height = 2160 }: PreviewPanelProps) {
  const aspectRatio = `${width}/${height}`;
  const { SceneComponent, durationInFrames, fps } = useMemo(() => {
    if (!code || !code.trim()) {
      return { SceneComponent: Fallback, durationInFrames: 250, fps: 25 };
    }
    const result = evalSceneCode(code);
    if (!result) {
      return { SceneComponent: Fallback, durationInFrames: 250, fps: 25 };
    }
    return {
      SceneComponent: result.component,
      durationInFrames: result.durationInFrames,
      fps: result.fps,
    };
  }, [code]);

  const seconds = (durationInFrames / fps).toFixed(1);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-sm font-medium text-muted">Preview</span>
        <span className="text-xs text-muted">
          {durationInFrames}f / {fps}fps / {seconds}s
        </span>
      </div>
      <div className="flex-1 flex items-center justify-center bg-black p-2 min-h-0">
        <PlayerErrorBoundary code={code}>
          <Player
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
                  <div style={{ color: "#93B1A6", fontSize: 20 }}>{error.message}</div>
                </div>
              </AbsoluteFill>
            )}
          />
        </PlayerErrorBoundary>
      </div>
    </div>
  );
}
