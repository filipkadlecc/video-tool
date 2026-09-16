/**
 * Keyframes — a property's value OVER TIME.
 *
 * The governing rule:
 *
 *   `ItemLayout` holds each animatable property AT REST.
 *   `item.keys` holds it OVER TIME.
 *   A channel with keys makes its static scalar dormant; a channel without
 *   keys IS its scalar.
 *
 * Exactly one source of truth per property per frame, read through
 * `resolvedLayout()` by all three views — the renderer, the canvas overlay and
 * the inspector. That is what "one data source, three views" means in code.
 *
 * Why a parallel channel map rather than widening each layout property to
 * `T | Animated<T>`: `resizeLayout` and `snapBox` are frame-agnostic pure
 * geometry and are asserted as such in the tests. Widening would force a frame
 * argument through both, through `fullFrameLayout` and `setLayout`, and through
 * every `l.x` read in the canvas and the inspector. A parallel map costs none
 * of that, and keeps project.json readable — heterogeneous layout fields
 * (`"x": 120` beside `"y": {"keys":[…]}`) diff badly and read worse.
 *
 * ── On the bans ──
 * The bans in editor-effects.ts govern the VOCABULARY THE PRODUCT OFFERS: a
 * preset is a one-click recommendation the tool makes, and those kept
 * regressing in generated output. A keyframe is a human drawing motion by hand,
 * one property at a time — and forbidding "opacity alone" here would make
 * keyframes unusable, since you cannot key `x` without also keying `opacity`.
 *
 * So the bans hold structurally instead: THE CHANNEL SET IS THE BAN. There is
 * no `blur` channel and there never will be — absent by type, not forbidden by
 * rule, which is stronger than a lint. The agent gains no keyframe vocabulary.
 */

/** The curve from a key to the NEXT one. A closed, named set — never handles. */
export type EaseId = "linear" | "in" | "out" | "inOut";

/**
 * Cubic ease-out, not linear.
 *
 * Linear keyframes are the single biggest reason hand-keyed motion looks
 * cheap, and this project's motion identity is springs. Ease-out is the
 * closest non-overshooting analogue — and non-overshooting matters, because an
 * overshoot between two keys can push opacity past 1 or scale below 0.
 */
export const DEFAULT_EASE: EaseId = "out";

export interface Keyframe {
  /**
   * Frames from the ITEM's own start. Integer.
   *
   * MAY BE NEGATIVE — see `shiftKeys`. A split shifts the tail's keys backwards
   * past its own start, and keeping them is what stops the tail jumping.
   */
  frame: number;
  value: number;
  /** The curve on the segment STARTING here. Omitted means DEFAULT_EASE. */
  ease?: EaseId;
  /** Hold flat until the next key — a step, not a ramp. */
  hold?: boolean;
}

export type ChannelId =
  | "x" | "y"              // composition px, pre-transform (left/top)
  | "scale"                // uniform multiplier about the anchor; 1 = as authored
  | "rotation"             // degrees
  | "anchorX" | "anchorY"  // 0..1 of the item's own box — the transform origin
  | "opacity";             // 0..1

/** Absent when nothing on the item is animated. */
export type Keyframes = Partial<Record<ChannelId, Keyframe[]>>;

export interface ChannelInfo {
  id: ChannelId;
  label: string;
  /** Which inspector row owns it. A row with two channels gets ONE diamond. */
  row: "position" | "scale" | "rotation" | "anchor" | "opacity";
  unit: "px" | "deg" | "pct" | "x" | "norm";
  min?: number;
  max?: number;
  step: number;
  precision: number;
  /** Value when neither a key nor an explicit layout scalar exists. */
  default: number;
}

/**
 * Every animatable channel, in one table. All three views iterate THIS —
 * that is what "build the model before the UIs" buys.
 *
 * Note what is absent and why: width/height are not here. Animating
 * `layout.width` re-lays out text on every frame — the exact failure TextLayer
 * already documents — whereas `transform: scale()` is composited. So the Scale
 * row carries the diamond and the W·H row is a dimmed readout, which is
 * precisely what the design's "Scale (with a linked W·H)" describes. Corner
 * radius and blend mode get no diamond either.
 */
export const ANIMATABLE_CHANNELS: ChannelInfo[] = [
  { id: "x",        label: "X",        row: "position", unit: "px",   step: 1,    precision: 0, default: 0 },
  { id: "y",        label: "Y",        row: "position", unit: "px",   step: 1,    precision: 0, default: 0 },
  { id: "scale",    label: "Scale",    row: "scale",    unit: "x",    step: 0.01, precision: 2, default: 1, min: 0 },
  { id: "rotation", label: "Rotation", row: "rotation", unit: "deg",  step: 1,    precision: 0, default: 0 },
  { id: "anchorX",  label: "Anchor X", row: "anchor",   unit: "norm", step: 0.01, precision: 2, default: 0.5, min: 0, max: 1 },
  { id: "anchorY",  label: "Anchor Y", row: "anchor",   unit: "norm", step: 0.01, precision: 2, default: 0.5, min: 0, max: 1 },
  { id: "opacity",  label: "Opacity",  row: "opacity",  unit: "pct",  step: 0.01, precision: 2, default: 1, min: 0, max: 1 },
];

export const CHANNELS_BY_ID: Record<ChannelId, ChannelInfo> =
  Object.fromEntries(ANIMATABLE_CHANNELS.map((c) => [c.id, c])) as Record<ChannelId, ChannelInfo>;

/** Channels available for an item of this type. Audio has no visual layout. */
export function channelsFor(itemType: string): ChannelInfo[] {
  if (itemType === "audio") return [];
  return ANIMATABLE_CHANNELS;
}

/* ───────────────────────── the curve ───────────────────────── */

function easeT(t: number, ease: EaseId): number {
  const p = t < 0 ? 0 : t > 1 ? 1 : t;
  switch (ease) {
    case "linear": return p;
    case "in":     return p * p * p;
    case "out":    return 1 - Math.pow(1 - p, 3);
    case "inOut":  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    default:       return p;
  }
}

/* ───────────────────────── channel algebra ───────────────────────── */

/**
 * The value of a channel at an item-relative frame.
 *
 * Before the first key it holds the first value; after the last it holds the
 * last. An empty or absent channel returns `fallback` — which is how a channel
 * without keys stays its static scalar.
 *
 * Written allocation-free (an index loop, no find/map/filter) because this runs
 * at render rate inside the Player.
 */
export function valueAt(
  keys: Keyframe[] | undefined,
  frame: number,
  fallback: number,
  clamp?: { min?: number; max?: number },
): number {
  let out: number;
  if (!keys || keys.length === 0) {
    out = fallback;
  } else if (keys.length === 1 || frame <= keys[0].frame) {
    out = keys[0].value;
  } else if (frame >= keys[keys.length - 1].frame) {
    out = keys[keys.length - 1].value;
  } else {
    out = keys[keys.length - 1].value;
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i];
      const b = keys[i + 1];
      if (frame >= a.frame && frame <= b.frame) {
        if (a.hold) { out = a.value; break; }
        const span = b.frame - a.frame;
        const t = span === 0 ? 1 : (frame - a.frame) / span;
        out = a.value + (b.value - a.value) * easeT(t, a.ease ?? DEFAULT_EASE);
        break;
      }
    }
  }
  // The safety net that makes the curve set safe: no easing can push a value
  // out of its channel's legal range.
  if (clamp) {
    if (clamp.min !== undefined && out < clamp.min) out = clamp.min;
    if (clamp.max !== undefined && out > clamp.max) out = clamp.max;
  }
  return out;
}

/** The key exactly at this frame, if there is one. */
export function keyAt(keys: Keyframe[] | undefined, frame: number): Keyframe | undefined {
  if (!keys) return undefined;
  for (let i = 0; i < keys.length; i++) if (keys[i].frame === frame) return keys[i];
  return undefined;
}

/** Write a key, replacing any key already at that frame. Stays sorted. */
export function setKey(
  keys: Keyframe[] | undefined,
  frame: number,
  value: number,
  ease?: EaseId,
): Keyframe[] {
  const f = Math.round(frame);
  const next = (keys ?? []).filter((k) => k.frame !== f);
  next.push(ease ? { frame: f, value, ease } : { frame: f, value });
  next.sort((a, b) => a.frame - b.frame);
  return next;
}

export function removeKey(keys: Keyframe[], frame: number): Keyframe[] {
  return keys.filter((k) => k.frame !== Math.round(frame));
}

/**
 * Move every key by `delta`.
 *
 * Keys are allowed to go NEGATIVE. The alternatives are worse: dropping them
 * empties the channel, which snaps the item back to its static scalar and makes
 * every split jump visibly; clamping to 0 collapses distinct keys onto one
 * frame, which is lossy and irreversible. The evaluator already holds the first
 * value below the first key, so a tail with negative keys correctly holds the
 * state its head ended in — and dragging the edge back brings the motion back.
 */
export function shiftKeys(keys: Keyframe[], delta: number): Keyframe[] {
  if (delta === 0) return keys;
  return keys.map((k) => ({ ...k, frame: k.frame + delta }));
}

export function shiftAllChannels(keys: Keyframes | undefined, delta: number): Keyframes | undefined {
  if (!keys || delta === 0) return keys;
  const out: Keyframes = {};
  for (const id of Object.keys(keys) as ChannelId[]) {
    const ch = keys[id];
    if (ch && ch.length) out[id] = shiftKeys(ch, delta);
  }
  return out;
}

/** Sorted strictly ascending, unique, finite integers. NOT `frame >= 0`. */
export function keysAreValid(keys: Keyframe[]): boolean {
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (!Number.isFinite(k.frame) || !Number.isInteger(k.frame)) return false;
    if (!Number.isFinite(k.value)) return false;
    if (i > 0 && k.frame <= keys[i - 1].frame) return false;
  }
  return true;
}

export function keyframesAreValid(keys: Keyframes | undefined): boolean {
  if (!keys) return true;
  for (const id of Object.keys(keys) as ChannelId[]) {
    const ch = keys[id];
    if (ch && !keysAreValid(ch)) return false;
  }
  return true;
}

/* ───────────────────────── resolving an item ───────────────────────── */

/** Structural, so this file never imports editor-doc (which imports this). */
export interface KeyHostLayout {
  x: number; y: number; width: number; height: number;
  rotation?: number; opacity?: number; cornerRadius?: number;
  scale?: number; anchorX?: number; anchorY?: number; blend?: string;
}
export interface KeyHost {
  layout: KeyHostLayout;
  keys?: Keyframes;
  /** Section ids switched off. Their values survive; they just stop applying. */
  bypass?: string[];
}

/** Every animatable property, settled for one frame. No optionals. */
export interface ResolvedLayout {
  x: number; y: number; width: number; height: number;
  rotation: number; opacity: number; scale: number;
  anchorX: number; anchorY: number;
  cornerRadius?: number;
  blend?: string;
}

/** Whether a channel is animated (has at least one key). */
export function isAnimated(item: KeyHost, ch: ChannelId): boolean {
  const k = item.keys?.[ch];
  return Boolean(k && k.length > 0);
}

/**
 * The item's layout at an ITEM-RELATIVE frame.
 *
 * Called from exactly three places — the renderer, the canvas overlay and the
 * inspector — so those three can never disagree about where something is.
 *
 * A v1 item resolves identically to how it rendered before: scale defaults to
 * 1 (so no `scale()` is emitted), anchor to 0.5/0.5 (which is what
 * `transform-origin` already was), and with no keys every channel falls back
 * to its own static scalar.
 */
export function resolvedLayout(item: KeyHost, localFrame: number): ResolvedLayout {
  const l = item.layout;
  const k = item.keys;
  const at = (ch: ChannelId, fallback: number) =>
    valueAt(k?.[ch], localFrame, fallback, CHANNELS_BY_ID[ch]);

  // A bypassed section stops APPLYING without losing anything: its values are
  // still on the item, they just resolve to their defaults for this frame.
  const off = (section: string) => item.bypass?.includes(section) ?? false;
  const transformOff = off("transform");
  const opacityOff = off("opacity");

  if (transformOff || opacityOff) {
    return {
      x: transformOff ? 0 : at("x", l.x),
      y: transformOff ? 0 : at("y", l.y),
      width: l.width,
      height: l.height,
      rotation: transformOff ? 0 : at("rotation", l.rotation ?? 0),
      opacity: opacityOff ? 1 : at("opacity", l.opacity ?? 1),
      scale: transformOff ? 1 : at("scale", l.scale ?? 1),
      anchorX: transformOff ? 0.5 : at("anchorX", l.anchorX ?? 0.5),
      anchorY: transformOff ? 0.5 : at("anchorY", l.anchorY ?? 0.5),
      cornerRadius: l.cornerRadius,
      blend: opacityOff ? undefined : l.blend,
    };
  }

  return {
    x: at("x", l.x),
    y: at("y", l.y),
    width: l.width,
    height: l.height,
    rotation: at("rotation", l.rotation ?? 0),
    opacity: at("opacity", l.opacity ?? 1),
    scale: at("scale", l.scale ?? 1),
    anchorX: at("anchorX", l.anchorX ?? 0.5),
    anchorY: at("anchorY", l.anchorY ?? 0.5),
    cornerRadius: l.cornerRadius,
    blend: l.blend,
  };
}
