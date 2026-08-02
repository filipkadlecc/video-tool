import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { buildSystemPrompt, buildUserMessage } from "@/lib/prompts";
import { listSfx } from "@/lib/sfx";
import { getApifyReferenceImages, APIFY_REFERENCE_INTRO } from "@/lib/prompts/reference-images";
import { listAssetPaths } from "@/lib/assets";
import { getProject } from "@/lib/projects";
import { buildEnrichedMediaFiles, type EnrichedMediaFile } from "@/lib/media-analysis";
import { isReframedFilename } from "@/lib/reframe";
import { getResolution } from "@/lib/types";
import { analyzeSvgs, manifestForPrompt, diffForPrompt } from "@/lib/svg-analyzer";
import { parseTape } from "@/lib/tape-parser";
import type { AnimationType, Engine, ProjectSettings, ChatMessage, SvgFile, StyleMode, TopicCardStyle, TransitionStyle } from "@/lib/types";

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
      // Skip derived auto-reframe outputs — they're not user uploads.
      if (isReframedFilename(entry.name)) continue;
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
    topicCardStyle,
    transitionStyle,
    useSfx,
    engine,
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
    topicCardStyle?: TopicCardStyle;
    transitionStyle?: TransitionStyle;
    useSfx?: boolean;
    engine?: Engine;
  };

  if (!messages || !messages.length) {
    return Response.json({ error: "messages are required" }, { status: 400 });
  }

  const assetPaths = listAssetPaths();

  // For video projects, gather media file info enriched with analysis (probe +
  // transcript segments + scene cuts) so the AI can edit with real understanding
  // instead of just a filename list. Reads caches; only ffprobe may run inline.
  // The model only ever sees `notionContent` (injected as "REFERENCE CONTENT
  // (from Notion)"). Editing notes can land in the notes box (notionContent) OR
  // the prompt box (initialPrompt) — so for video, fall back to initialPrompt
  // when notionContent is empty, so the notes reach the model either way.
  let effectiveNotionContent = notionContent;
  let videoContext:
    | { projectId: string; mediaFiles: EnrichedMediaFile[]; compFps: number; topicCardStyle: TopicCardStyle }
    | undefined;
  if (animationType === "video" && projectId) {
    const project = getProject(projectId);
    if (!effectiveNotionContent?.trim() && project) {
      const init = project.initialPrompt?.trim();
      effectiveNotionContent =
        project.notionContent?.trim() ||
        (init && init !== "Edit uploaded footage" ? init : undefined);
    }
    if (project?.mediaFolder && fs.existsSync(project.mediaFolder)) {
      const mediaFiles = listMediaFiles(project.mediaFolder, project.mediaFolder);
      const target = getResolution(projectSettings.orientation, projectSettings.resolution);
      const enriched = await buildEnrichedMediaFiles(project, mediaFiles, target);
      videoContext = {
        projectId,
        mediaFiles: enriched,
        compFps: projectSettings.fps,
        topicCardStyle: topicCardStyle ?? project.topicCardStyle ?? "cards",
      };
    }
  }

  // For terminal projects, read the customTheme flag so the prompt can either
  // force the Apify default (when false/unset) or preserve the user's theme.
  // Also pre-compute the current tape duration server-side so the model can
  // do real math when the user says "extend" / "make it 10s" / etc.
  let customTheme: boolean | undefined;
  let currentTapeDurationMs: number | undefined;
  if (animationType === "terminal") {
    if (projectId) customTheme = getProject(projectId)?.customTheme;
    if (currentCode && currentCode.trim()) {
      currentTapeDurationMs = parseTape(currentCode).totalDurationMs;
    }
  }

  // SFX are only relevant for non-terminal compositions (terminal is VHS .tape).
  const sfx = animationType !== "terminal" ? listSfx() : [];
  const systemPrompt = buildSystemPrompt(animationType, projectSettings, assetPaths, videoContext, styleMode, customTheme, useSfx, sfx, engine, transitionStyle);

  // Attach Apify style reference images on the FIRST user turn only — keeps
  // follow-up edits cheap (the visual grammar is also encoded in the system prompt).
  const isTerminal = animationType === "terminal";
  const firstUserTurnIndex = messages.findIndex((m) => m.role === "user");
  const referenceImages = !isTerminal ? getApifyReferenceImages() : [];

  // Build Anthropic messages from chat history
  // Enhance the last user message with context
  const anthropicMessages: Anthropic.MessageParam[] = messages.map((msg, i) => {
    const isLastUser = msg.role === "user" && i === messages.length - 1;
    const isFirstUser = msg.role === "user" && i === firstUserTurnIndex;
    const attachReferences = isFirstUser && referenceImages.length > 0;

    if (isLastUser) {
      let userContent = buildUserMessage(msg.content, currentCode, effectiveNotionContent, scriptWithTimestamps, animationType, currentTapeDurationMs, engine);
      if (svgContents && svgContents.length > 0) {
        const { manifests, sequenceDiff } = analyzeSvgs(svgContents);
        const parts: string[] = [];
        svgContents.forEach((svg, i) => {
          const m = manifests[i];
          if (m) {
            parts.push(
              `[SVG ${i + 1} MANIFEST]\n${JSON.stringify(manifestForPrompt(m), null, 2)}\n[END MANIFEST ${i + 1}]`
            );
          }
          parts.push(`[SVG ${i + 1}: ${svg.filename}]\n${svg.content}\n[END SVG ${i + 1}]`);
        });
        if (sequenceDiff) {
          parts.push(
            `[SEQUENCE DIFF — these SVGs share a viewBox and form a UI flow. Animate the deltas, not whole-frame crossfades.]\n${JSON.stringify(diffForPrompt(sequenceDiff), null, 2)}\n[END SEQUENCE DIFF]`
          );
        }
        userContent = `${parts.join("\n\n")}\n\n${userContent}`;
      }
      if (attachReferences) {
        return {
          role: "user" as const,
          content: [
            { type: "text", text: APIFY_REFERENCE_INTRO },
            ...referenceImages,
            { type: "text", text: userContent },
          ],
        };
      }
      return { role: "user" as const, content: userContent };
    }
    if (attachReferences) {
      return {
        role: "user" as const,
        content: [
          { type: "text", text: APIFY_REFERENCE_INTRO },
          ...referenceImages,
          { type: "text", text: msg.content },
        ],
      };
    }
    return {
      role: msg.role as "user" | "assistant",
      content: msg.content,
    };
  });

  // Terminal projects use cheap Sonnet — the .tape prompt is simple.
  // Everything else gets Opus 4.8 with extended thinking for design-grade code.
  const stream = isTerminal
    ? anthropic.messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: 32000,
        system: systemPrompt,
        messages: anthropicMessages,
      })
    : anthropic.messages.stream({
        model: "claude-opus-4-8",
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
