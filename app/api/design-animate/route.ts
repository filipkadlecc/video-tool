// =============================================================================
// /api/design-animate  (isolated, experimental "Design Lab" feature)
// =============================================================================
// Own streaming endpoint that turns a pasted Claude Design layout into an
// animated Remotion scene, using the standalone preserve-styling prompt. The
// normal /api/generate route is untouched; this endpoint shares nothing with it
// beyond the Anthropic SDK and the SSE wire format (so the client parser is the
// same shape used elsewhere).

import Anthropic from "@anthropic-ai/sdk";
import { buildDesignAnimatePrompt } from "@/lib/prompts/design-animate";

const anthropic = new Anthropic();

export const maxDuration = 300;

export async function POST(request: Request) {
  const body = await request.json();
  const {
    designHtml,
    instructions,
    currentCode,
    width = 1920,
    height = 1080,
    fps = 30,
  } = body as {
    designHtml?: string;
    instructions?: string;
    currentCode?: string;
    width?: number;
    height?: number;
    fps?: number;
  };

  if (!designHtml || !designHtml.trim()) {
    return Response.json({ error: "designHtml is required" }, { status: 400 });
  }

  const systemPrompt = buildDesignAnimatePrompt(width, height, fps);

  const parts: string[] = [];
  parts.push(`[DESIGN HTML — reproduce this exactly, then animate it]\n${designHtml}\n[END DESIGN HTML]`);
  if (currentCode && currentCode.trim()) {
    parts.push(
      `Current scene code (you are editing this — keep the design faithful while applying the change below):\n\`\`\`tsx\n${currentCode}\n\`\`\``,
    );
  }
  parts.push(
    instructions && instructions.trim()
      ? instructions
      : "Reproduce this design exactly as a Remotion scene and animate it to life.",
  );

  const stream = anthropic.messages.stream({
    model: "claude-opus-4-8",
    max_tokens: 32000,
    system: systemPrompt,
    messages: [{ role: "user", content: parts.join("\n\n") }],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`));
          }
        }
        const finalMessage = await stream.finalMessage();
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ done: true, stopReason: finalMessage.stop_reason })}\n\n`),
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`));
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
