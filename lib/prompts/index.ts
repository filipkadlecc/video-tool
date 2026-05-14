import { buildBasePrompt } from "./base";
import { BROLL_DARK_PROMPT } from "./broll-dark";
import { COLOR_SYSTEM_PROMPT } from "./colors";
import { buildVideoEditingPrompt } from "./video-editing";
import { getStylePrompt } from "./styles";
import type { AnimationType, ProjectSettings, StyleMode } from "../types";
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
  styleMode?: StyleMode,
): string {
  const { width, height } = getResolution(settings.orientation, settings.resolution);
  const base = buildBasePrompt(width, height, settings.fps);

  if (animationType === "terminal") {
    return `You are a VHS tape script assistant. VHS (https://github.com/charmbracelet/vhs) records terminal sessions as code.

The user's code is a .tape file. You MUST output ONLY valid VHS tape syntax — never TypeScript, never Remotion, never React.

IMPORTANT: This project's canvas is ${width}×${height} px. You MUST set:
  Set Width ${width}
  Set Height ${height}
Do NOT use any other dimensions — the output must exactly match the project canvas.

Font size rule: Set FontSize ${Math.round(width / 120)} — this keeps text readable without filling the screen. Never go above ${Math.round(width / 80)}.

Background color rule: ALWAYS use a custom theme with background #333538. Use this exact line (you may adjust foreground/cursor/other colors but NEVER change the background):
  Set Theme { "background": "#333538", "foreground": "#FFFFFF", "cursor": "#FFFFFF", "selection": "#4A4D50", "black": "#333538", "white": "#FFFFFF" }

Key VHS commands:
  Output <file>         Set output filename (keep as "out.mp4")
  Set FontSize <n>      Terminal font size — use ~${Math.round(width / 120)} for this canvas
  Set Width <n>         Terminal width in pixels (MUST be ${width})
  Set Height <n>        Terminal height in pixels (MUST be ${height})
  Set Theme { ... }     Custom theme JSON — always set background to #333538 (see above)
  Set TypingSpeed <ms>ms  Typing speed per character
  Set Margin <n>        Outer margin
  Set Padding <n>       Inner padding
  Type "<text>"         Type text character by character
  Enter                 Press Enter
  Sleep <n>s / <n>ms   Wait
  Backspace [n]         Press backspace n times
  Ctrl+C                Send Ctrl-C
  Ctrl+D                Send Ctrl-D

Output only the complete .tape file. No markdown, no code fences, no explanation.`;
  }

  let prompt = base + "\n\n" + COLOR_SYSTEM_PROMPT + "\n\n" + BROLL_DARK_PROMPT;

  // Append style preset (defaults to "default" if not provided).
  prompt += "\n\n" + getStylePrompt(styleMode);

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
  animationType?: AnimationType,
): string {
  const parts: string[] = [];

  if (notionContent) {
    parts.push(`=== REFERENCE CONTENT (from Notion) ===\n${notionContent}\n`);
  }

  if (scriptWithTimestamps) {
    parts.push(`=== VIDEO SCRIPT WITH TIMESTAMPS ===\n${scriptWithTimestamps}\n`);
  }

  if (code) {
    const lang = animationType === "terminal" ? "tape" : "tsx";
    const label = animationType === "terminal" ? "Current .tape script" : "Current scene code";
    parts.push(`${label}:\n\`\`\`${lang}\n${code}\n\`\`\``);
  }

  parts.push(prompt);

  return parts.join("\n\n");
}
