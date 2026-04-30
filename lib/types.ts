export type AnimationType = "broll" | "animation" | "svg" | "video";
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
