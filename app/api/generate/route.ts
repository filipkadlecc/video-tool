import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt, buildUserMessage } from "@/lib/prompts";
import { listAssetPaths } from "@/lib/assets";
import type { AnimationType, ProjectSettings, ChatMessage } from "@/lib/types";

const anthropic = new Anthropic();

export const maxDuration = 300;

export async function POST(request: Request) {
  const body = await request.json();
  const {
    messages,
    projectSettings,
    animationType,
    notionContent,
    scriptWithTimestamps,
    currentCode,
    svgContent,
  } = body as {
    messages: ChatMessage[];
    projectSettings: ProjectSettings;
    animationType: AnimationType;
    notionContent?: string;
    scriptWithTimestamps?: string;
    currentCode?: string;
    svgContent?: string;
  };

  if (!messages || !messages.length) {
    return Response.json({ error: "messages are required" }, { status: 400 });
  }

  const assetPaths = listAssetPaths();
  const systemPrompt = buildSystemPrompt(animationType, projectSettings, assetPaths);

  // Build Anthropic messages from chat history
  // Enhance the last user message with context
  const anthropicMessages: Anthropic.MessageParam[] = messages.map((msg, i) => {
    if (msg.role === "user" && i === messages.length - 1) {
      let userContent = buildUserMessage(msg.content, currentCode, notionContent, scriptWithTimestamps);
      if (svgContent) {
        userContent = `[SVG TO ANIMATE]\n${svgContent}\n[END SVG]\n\n${userContent}`;
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

  const stream = anthropic.messages.stream({
    model: "claude-sonnet-4-6",
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
