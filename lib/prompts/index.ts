import { buildBasePrompt } from "./base";
import { BROLL_DARK_PROMPT } from "./broll-dark";
import { COLOR_SYSTEM_PROMPT } from "./colors";
import { buildVideoEditingPrompt } from "./video-editing";
import type { AnimationType, ProjectSettings } from "../types";
import { getResolution } from "../types";

interface MediaFileInfo {
  name: string;
  path: string;
  type: string;
  sizeFormatted: string;
}

export function buildSystemPrompt(
  animationType: AnimationType,
  settings: ProjectSettings,
  assetPaths?: string[],
  videoContext?: { projectId: string; mediaFiles: MediaFileInfo[] },
): string {
  const { width, height } = getResolution(settings.orientation, settings.resolution);
  const base = buildBasePrompt(width, height, settings.fps);

  let prompt = base + "\n\n" + COLOR_SYSTEM_PROMPT + "\n\n" + BROLL_DARK_PROMPT;

  if (animationType === "video" && videoContext) {
    prompt += "\n\n" + buildVideoEditingPrompt(videoContext.projectId, videoContext.mediaFiles);
  }

  if (assetPaths && assetPaths.length > 0) {
    prompt += `\n\n=== AVAILABLE ASSETS ===\nUse staticFile() from remotion to reference these. Use the EXACT paths below — do not guess filenames.\n\n${assetPaths.map((p) => `- ${p}`).join("\n")}`;
  }

  return prompt;
}

export function buildUserMessage(
  prompt: string,
  code?: string,
  notionContent?: string,
  scriptWithTimestamps?: string,
): string {
  const parts: string[] = [];

  if (notionContent) {
    parts.push(`=== REFERENCE CONTENT (from Notion) ===\n${notionContent}\n`);
  }

  if (scriptWithTimestamps) {
    parts.push(`=== VIDEO SCRIPT WITH TIMESTAMPS ===\n${scriptWithTimestamps}\n`);
  }

  if (code) {
    parts.push(`Current scene code:\n\`\`\`tsx\n${code}\n\`\`\``);
  }

  parts.push(prompt);

  return parts.join("\n\n");
}
