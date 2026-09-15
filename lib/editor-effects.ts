/**
 * In/out animations for editor items.
 *
 * Deliberately a small, closed set. Most of what a stock "transitions" panel
 * offers is banned in this project and the bans keep regressing, so they are
 * encoded here rather than left to judgement:
 *
 *  - No animated blur on an entrance — elements arrive SHARP.
 *    (lib/prompts/base.ts rule 15)
 *  - No fade from or to black — nothing ramps the whole frame to opacity 0.
 *    (rule 14)
 *  - Never opacity ALONE — every reveal combines 2–3 transforms. (rule 4)
 *  - No slide-only either. (rule 5)
 *  - A typewriter is per-character, never a mask sweep.
 *
 * `presetStyle` is pure so the rules above can be asserted in tests; the easing
 * lives in the renderer, which drives `progress` with the house springs from
 * remotion/motion.ts.
 */

export type AnimationPreset =
  | "none"
  | "rise"
  | "settle"
  | "drift"
  | "pop"
  | "type"
  | "words";

export interface AnimationSpec {
  preset: AnimationPreset;
  durationInFrames: number;
}

/* ────────────────────────── the effect stack ──────────────────────────
 *
 * An item's effects are an ORDERED LIST, not two named slots.
 *
 * The bug the list fixes: turning an animation off used to mean setting
 * `preset: "none"`, which threw `durationInFrames` away. `enabled: false` is
 * the off switch now, and it KEEPS every value — that is how you A/B an
 * effect, and it is what the design means by "bypassed".
 *
 * Order is observable, because transforms do not commute: translate-then-
 * rotate is not rotate-then-translate. That is what makes dragging a section
 * to reorder the stack a real edit rather than decoration.
 *
 * The preset vocabulary is UNCHANGED. The bans above still hold, and the AI
 * agent still writes through this same closed enum.
 */

export interface EffectBase {
  id: string;
  /** Off keeps every value. Never delete to disable. */
  enabled: boolean;
  /** Purely presentational — whether the section is expanded. Stored so it
   *  survives a reload. */
  open?: boolean;
}

export interface EdgeAnimationEffect extends EffectBase {
  kind: "animateIn" | "animateOut";
  preset: AnimationPreset;
  durationInFrames: number;
}

/** The union will grow; the array shape will not. */
export type Effect = EdgeAnimationEffect;

/** Enough of an item for the effect helpers — avoids importing editor-doc. */
interface EffectHost {
  id: string;
  effects?: Effect[];
  animateIn?: AnimationSpec;
  animateOut?: AnimationSpec;
}

/**
 * The effect list for an item, synthesised from the two legacy slots when that
 * is all there is.
 *
 * This is a LAZY migration: nothing on disk changes until the user edits an
 * effect, so an untouched v1 document still opens in a v1 build. Ids are
 * derived from the item id rather than generated, so React keys stay stable
 * across renders.
 */
export function itemEffects(item: EffectHost): Effect[] {
  if (item.effects) return item.effects;
  const out: Effect[] = [];
  if (item.animateIn) {
    out.push({ id: `${item.id}:in`, kind: "animateIn", enabled: true,
      preset: item.animateIn.preset, durationInFrames: item.animateIn.durationInFrames });
  }
  if (item.animateOut) {
    out.push({ id: `${item.id}:out`, kind: "animateOut", enabled: true,
      preset: item.animateOut.preset, durationInFrames: item.animateOut.durationInFrames });
  }
  return out;
}

/**
 * Fold a stack of styles into one.
 *
 * Opacity takes the MINIMUM rather than the product: two edge animations are
 * alternatives in time, not layers, and multiplying would change how every
 * existing render looks wherever an in and an out overlap. This matches what
 * the renderer already did with the two slots.
 */
export function composeEffects(styles: AnimationStyle[]): AnimationStyle {
  if (styles.length === 0) return { opacity: 1, transform: "none" };
  const transforms = styles.map((s) => s.transform).filter((t) => t !== "none");
  return {
    opacity: Math.min(...styles.map((s) => s.opacity)),
    transform: transforms.length > 0 ? transforms.join(" ") : "none",
  };
}

/** Set an edge's preset, creating the effect if the stack has none yet. */
export function setEffectPreset(
  item: EffectHost,
  kind: "animateIn" | "animateOut",
  preset: AnimationPreset,
  durationInFrames: number,
): Effect[] {
  const list = itemEffects(item);
  const at = list.findIndex((e) => e.kind === kind);
  if (at === -1) {
    return [...list, { id: `${item.id}:${kind === "animateIn" ? "in" : "out"}`, kind, enabled: true, preset, durationInFrames }];
  }
  const next = [...list];
  next[at] = { ...next[at], preset, durationInFrames, enabled: true };
  return next;
}

/** Bypass without forgetting. */
export function setEffectEnabled(list: Effect[], id: string, enabled: boolean): Effect[] {
  return list.map((e) => (e.id === id ? { ...e, enabled } : e));
}

export function setEffectOpen(list: Effect[], id: string, open: boolean): Effect[] {
  return list.map((e) => (e.id === id ? { ...e, open } : e));
}

/** Move an effect within the stack. Effects apply top to bottom. */
export function reorderEffects(list: Effect[], from: number, to: number): Effect[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export interface PresetInfo {
  id: AnimationPreset;
  label: string;
  hint: string;
  /** Presets that decompose text can't apply to a clip or an image. */
  textOnly?: boolean;
}

export const ANIMATION_PRESETS: PresetInfo[] = [
  { id: "rise", label: "Rise", hint: "Lifts up as it arrives" },
  { id: "settle", label: "Settle", hint: "Eases down from slightly large" },
  { id: "drift", label: "Drift", hint: "Comes in from the side" },
  { id: "pop", label: "Pop", hint: "Springs up with a little rotation" },
  { id: "type", label: "Type", hint: "One character at a time", textOnly: true },
  { id: "words", label: "Word cascade", hint: "Word by word", textOnly: true },
  { id: "none", label: "Cut", hint: "No animation — simply there" },
];

export interface AnimationStyle {
  opacity: number;
  transform: string;
}

const NEUTRAL: AnimationStyle = { opacity: 1, transform: "none" };

/**
 * Style for a preset at `progress`, where 0 is fully animated-out and 1 is
 * settled. `direction` mirrors the travel so an exit leaves the way it came —
 * the idiom the branded scenes already use (`offsetIn + offsetOut`).
 *
 * Travel distances follow the house numbers: 20–60px for a hero, less for
 * secondary elements, scale within 0.9–1.08.
 */
export function presetStyle(
  preset: AnimationPreset,
  progress: number,
  direction: "in" | "out" = "in",
): AnimationStyle {
  const p = Math.max(0, Math.min(1, progress));
  const away = 1 - p;
  // An exit travels the opposite way to an entrance.
  const sign = direction === "in" ? 1 : -1;

  switch (preset) {
    case "rise":
      return {
        opacity: p,
        transform: `translateY(${sign * away * 28}px) scale(${0.98 + p * 0.02})`,
      };
    case "settle":
      return {
        opacity: p,
        transform: `translateY(${-sign * away * 10}px) scale(${1.06 - p * 0.06})`,
      };
    case "drift":
      return {
        opacity: p,
        transform: `translateX(${-sign * away * 24}px) scale(${0.99 + p * 0.01})`,
      };
    case "pop":
      return {
        opacity: p,
        transform: `scale(${0.9 + p * 0.1}) rotate(${-sign * away * 2}deg)`,
      };
    // Per-character and per-word reveals decompose the text itself, so the
    // wrapper stays neutral and the text layer does the work.
    case "type":
    case "words":
    case "none":
    default:
      return NEUTRAL;
  }
}

/** How many characters of `text` are visible at `progress`. */
export function visibleCharacters(text: string, progress: number): number {
  return Math.round(Math.max(0, Math.min(1, progress)) * text.length);
}

/**
 * Per-word progress for a cascade. Each word gets its own ramp, offset by its
 * index, so words arrive in sequence rather than together.
 */
export function wordProgress(index: number, count: number, progress: number): number {
  if (count <= 1) return Math.max(0, Math.min(1, progress));
  const p = Math.max(0, Math.min(1, progress));
  // Overlap the ramps so the cascade reads as one movement, not a queue.
  const span = 1 / count;
  const start = index * span * 0.7;
  const end = start + span + 0.15;
  if (p <= start) return 0;
  if (p >= end) return 1;
  return (p - start) / (end - start);
}

/** Presets available for an item of this type. */
export function presetsFor(itemType: string): PresetInfo[] {
  return ANIMATION_PRESETS.filter((p) => !p.textOnly || itemType === "text" || itemType === "captions");
}

/**
 * A usable frame count for an animation, whatever the document holds.
 *
 * `Math.max(1, x)` is NOT a sufficient guard: `Math.max(1, undefined)` is NaN,
 * and Remotion throws on a NaN spring duration — which takes down the whole
 * preview, not just the animation. Anything missing, zero, negative or not a
 * number falls back instead.
 */
export function animationFrames(spec: AnimationSpec | undefined, fallback = 12): number {
  const n = spec?.durationInFrames;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
}
