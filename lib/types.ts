export type AnimationType = "broll" | "animation" | "svg" | "video" | "terminal";
export type StyleMode = "default" | "kinetic" | "editorial" | "cinematic";
export type Resolution = "1080p" | "4k";
export type Orientation = "horizontal" | "vertical" | "square";
export type FPS = 24 | 25 | 30 | 50;

export interface ProjectSettings {
  resolution: Resolution;
  orientation: Orientation;
  fps: FPS;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface SvgFile {
  filename: string;
  content: string;
}

export interface TerminalZoomRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type TerminalZoomEasing = "snap" | "smooth" | "linear";

export interface TerminalZoom {
  id: string;
  startFrame: number;
  endFrame: number;
  rect: TerminalZoomRect;
  // Optional per-zoom timing overrides. Defaults live in
  // remotion/scenes/terminal/TerminalRecording.tsx (RAMP_IN_FRAMES,
  // RAMP_OUT_FRAMES, and "snap" easing).
  rampInFrames?: number;
  rampOutFrames?: number;
  easing?: TerminalZoomEasing;
}

export interface TerminalEndCard {
  title: string;
  subtitle?: string;
  url?: string;
  startFrame?: number;
}

export interface TerminalBanner {
  text: string;
  subtitle?: string;
  startFrame: number;
  endFrame: number;
}

export interface TerminalFreeze {
  id: string;
  atCompFrame: number;
  durationFrames: number;
}

export interface TerminalAnnotations {
  videoDurationFrames: number;
  videoWidth: number;
  videoHeight: number;
  fps: number;
  zooms: TerminalZoom[];
  freezes?: TerminalFreeze[];
  banner?: TerminalBanner;
  endCard?: TerminalEndCard;
}

export interface Project {
  id: string;
  name: string;
  animationType: AnimationType;
  settings: ProjectSettings;
  code: string;
  chatHistory: ChatMessage[];
  initialPrompt: string;
  notionContent?: string;
  scriptWithTimestamps?: string;
  svgContents?: SvgFile[];
  mediaFolder?: string;
  terminalAnnotations?: TerminalAnnotations;
  // Terminal projects only: when true, the AI is told to preserve any user-set
  // `Set Theme {...}` line instead of forcing the Apify default.
  customTheme?: boolean;
  styleMode?: StyleMode;
  createdAt: string;
  updatedAt: string;
}

export type ProjectMeta = Omit<Project, "chatHistory" | "code" | "notionContent" | "scriptWithTimestamps" | "svgContents">;

const RESOLUTION_MAP: Record<`${Orientation}-${Resolution}`, { width: number; height: number }> = {
  "horizontal-4k": { width: 3840, height: 2160 },
  "horizontal-1080p": { width: 1920, height: 1080 },
  "vertical-4k": { width: 2160, height: 3840 },
  "vertical-1080p": { width: 1080, height: 1920 },
  "square-4k": { width: 2160, height: 2160 },
  "square-1080p": { width: 1080, height: 1080 },
};

export function getResolution(orientation: Orientation, resolution: Resolution): { width: number; height: number } {
  return RESOLUTION_MAP[`${orientation}-${resolution}`];
}
