import type { TerminalAnnotations } from "./types";

export interface TerminalExportPlan {
  code: string;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
}

export function buildTerminalExportPlan(
  videoUrl: string,
  annotations: TerminalAnnotations,
  endCardFrames = 120,
): TerminalExportPlan {
  const freezeTotal = (annotations.freezes ?? []).reduce(
    (sum, f) => sum + f.durationFrames,
    0,
  );
  const videoPortion = annotations.videoDurationFrames + freezeTotal;
  const endCardStart = annotations.endCard?.startFrame ?? videoPortion;
  const total = annotations.endCard
    ? Math.max(videoPortion, endCardStart + endCardFrames)
    : videoPortion;

  const annotationsLiteral = JSON.stringify({
    videoDurationFrames: annotations.videoDurationFrames,
    zooms: annotations.zooms,
    freezes: annotations.freezes,
    banner: annotations.banner,
    endCard: annotations.endCard,
  });

  const code = `import React from "react";
import TerminalRecording from "./terminal/TerminalRecording";

const VIDEO_SRC = ${JSON.stringify(videoUrl)};
const ANNOTATIONS = ${annotationsLiteral};

export const fps = ${annotations.fps};
export const durationInFrames = ${total};

export default function Scene() {
  return React.createElement(TerminalRecording, { videoSrc: VIDEO_SRC, annotations: ANNOTATIONS });
}
`;

  return {
    code,
    durationInFrames: total,
    fps: annotations.fps,
    width: annotations.videoWidth,
    height: annotations.videoHeight,
  };
}
