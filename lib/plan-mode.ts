import type Anthropic from "@anthropic-ai/sdk";

/**
 * Plan mode: the chat answers with a plan instead of doing the work.
 *
 * Added to the LAST user message rather than the system prompt, so the big
 * cached system block stays byte-identical and a plan turn doesn't pay to
 * re-cache it. The routes also switch tools off, so nothing can change even if
 * the model ignores this.
 */
export const PLAN_INSTRUCTION = `=== PLAN MODE — do not build or change anything yet ===
Reply with a short plan the user can approve or adjust. Nothing is written or edited this turn.
- For a new video: the beat grid (time ranges in seconds) and a shot list — what is on screen in each beat, how it moves, and how each beat hands off to the next.
- For an edit: exactly what will change, and what stays as it is.
- Finish with the questions you need answered, if anything is unclear (at most 3).
No code blocks. Plain, scannable lines, under ~200 words.`;

/** The same instruction, appended to the final user turn of an API conversation. */
export function withPlanInstruction(messages: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user") return messages;
  const content: Anthropic.MessageParam["content"] =
    typeof last.content === "string"
      ? `${last.content}\n\n${PLAN_INSTRUCTION}`
      : [...last.content, { type: "text", text: PLAN_INSTRUCTION }];
  return [...messages.slice(0, -1), { ...last, content }];
}
