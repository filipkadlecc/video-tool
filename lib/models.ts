/**
 * The three speeds the chat offers, and what each one actually runs.
 *
 * One map, read by every route that writes or edits a scene, so "Fast" can't
 * mean one model in the chat and another in the timeline agent.
 * Balanced is what everything ran before the switch existed.
 */
export type ModelLevel = "fast" | "balanced" | "best";

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export const MODEL_LEVELS: { id: ModelLevel; label: string; hint: string }[] = [
  { id: "fast", label: "Fast", hint: "Sonnet 5 — quick drafts and small fixes" },
  { id: "balanced", label: "Balanced", hint: "Opus 5.5 — the default" },
  { id: "best", label: "Best", hint: "Opus 5.5 at max effort — slow, for showcase pieces" },
];

const LEVELS: Record<ModelLevel, { model: string; effort: Effort }> = {
  fast: { model: "claude-sonnet-5", effort: "medium" },
  balanced: { model: "claude-opus-5-5", effort: "high" },
  best: { model: "claude-opus-5-5", effort: "max" },
};

export function isModelLevel(v: unknown): v is ModelLevel {
  return v === "fast" || v === "balanced" || v === "best";
}

/** Anything unrecognised — including no level at all — is Balanced. */
export function resolveLevel(level: unknown): { level: ModelLevel; model: string; effort: Effort } {
  const l = isModelLevel(level) ? level : "balanced";
  return { level: l, ...LEVELS[l] };
}

// The choice is per browser, like a remembered tab: the chat sets it, and the
// timeline's "add animation" reads the same value.
const STORAGE_KEY = "vt-model-level";

export function readStoredLevel(): ModelLevel {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return isModelLevel(v) ? v : "balanced";
  } catch {
    return "balanced";
  }
}

export function storeLevel(level: ModelLevel): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, level);
  } catch { /* private window — the choice just won't be remembered */ }
}
