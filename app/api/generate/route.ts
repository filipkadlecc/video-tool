import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { buildSystemPrompt, buildUserMessage } from "@/lib/prompts";
import { listAssetPaths } from "@/lib/assets";
import { getProject } from "@/lib/projects";
import type { AnimationType, ProjectSettings, ChatMessage, SvgFile, StyleMode } from "@/lib/types";

const anthropic = new Anthropic();

export const maxDuration = 300;

const VIDEO_EXTS = new Set([".mp4", ".mov", ".webm", ".mkv", ".avi", ".m4v"]);
const AUDIO_EXTS = new Set([".mp3", ".wav", ".m4a", ".aac"]);
const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"]);

function getMediaFileType(ext: string): "video" | "audio" | "image" | "other" {
  if (VIDEO_EXTS.has(ext)) return "video";
  if (AUDIO_EXTS.has(ext)) return "audio";
  if (IMAGE_EXTS.has(ext)) return "image";
  return "other";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`;
}

function listMediaFiles(dir: string, baseDir: string): { name: string; path: string; type: string; sizeFormatted: string }[] {
  const files: { name: string; path: string; type: string; sizeFormatted: string }[] = [];
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listMediaFiles(fullPath, baseDir));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      const type = getMediaFileType(ext);
      if (type === "other") continue;
      const stat = fs.statSync(fullPath);
      files.push({
        name: entry.name,
        path: path.relative(baseDir, fullPath),
        type,
        sizeFormatted: formatSize(stat.size),
      });
    }
  }
  return files;
}

export async function POST(request: Request) {
  const body = await request.json();
  const {
    messages,
    projectSettings,
    animationType,
    notionContent,
    scriptWithTimestamps,
    currentCode,
    svgContents,
    projectId,
    styleMode,
  } = body as {
    messages: ChatMessage[];
    projectSettings: ProjectSettings;
    animationType: AnimationType;
    notionContent?: string;
    scriptWithTimestamps?: string;
    currentCode?: string;
    svgContents?: SvgFile[];
    projectId?: string;
    styleMode?: StyleMode;
  };

  if (!messages || !messages.length) {
    return Response.json({ error: "messages are required" }, { status: 400 });
  }

  const assetPaths = listAssetPaths();

  // For video projects, gather media file info
  let videoContext: { projectId: string; mediaFiles: { name: string; path: string; type: string; sizeFormatted: string }[] } | undefined;
  if (animationType === "video" && projectId) {
    const project = getProject(projectId);
    if (project?.mediaFolder && fs.existsSync(project.mediaFolder)) {
      const mediaFiles = listMediaFiles(project.mediaFolder, project.mediaFolder);
      videoContext = { projectId, mediaFiles };
    }
  }

  const systemPrompt = buildSystemPrompt(animationType, projectSettings, assetPaths, videoContext, styleMode);

  // Build Anthropic messages from chat history
  // Enhance the last user message with context
  const anthropicMessages: Anthropic.MessageParam[] = messages.map((msg, i) => {
    if (msg.role === "user" && i === messages.length - 1) {
      let userContent = buildUserMessage(msg.content, currentCode, notionContent, scriptWithTimestamps, animationType);
      if (svgContents && svgContents.length > 0) {
        const svgBlock = svgContents
          .map((svg, i) => `[SVG ${i + 1}: ${svg.filename}]\n${svg.content}\n[END SVG ${i + 1}]`)
          .join("\n\n");
        userContent = `${svgBlock}\n\n${userContent}`;
      }
      return {
        role: "user" as const,
        content: userContent,
      };
    }
    return {
      role: msg.role as "user" | "assistant",
      content: msg.content,
    };
  });

  // Terminal projects use cheap Sonnet — the .tape prompt is simple.
  // Everything else gets Opus 4.7 with extended thinking for design-grade code.
  const isTerminal = animationType === "terminal";
  const stream = isTerminal
    ? anthropic.messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: 32000,
        system: systemPrompt,
        messages: anthropicMessages,
      })
    : anthropic.messages.stream({
        model: "claude-opus-4-7",
        max_tokens: 32000,
        system: systemPrompt,
        messages: anthropicMessages,
      });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
            );
          }
        }
        const finalMessage = await stream.finalMessage();
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ done: true, stopReason: finalMessage.stop_reason })}\n\n`)
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
