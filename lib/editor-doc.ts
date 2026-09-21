/**
 * The editor document — a structured representation of a video as tracks of
 * items, rather than a TSX file.
 *
 * This is the source of truth for projects made in the visual editor. Where the
 * legacy model kept Remotion code and edited it by patching bytes (see
 * lib/editable-timeline.ts), a document is editable by construction: there is no
 * parser to defeat and no composition shape to refuse. `remotion/EditorComposition.tsx`
 * turns a document into a rendered video, and the SAME component backs both the
 * preview player and the export, so what you see is what renders.
 *
 * Everything here is pure: `(doc, ...args) => doc`. No React, no I/O.
 *
 * ── Units ────────────────────────────────────────────────────────────────────
 * Timeline positions (`from`, `durationInFrames`) are COMPOSITION frames.
 * Media trims (`sourceIn`, `sourceOut`) are SECONDS into the source file.
 *
 * Seconds are deliberate. Remotion's `trimBefore`/`trimAfter` are composition
 * frames — they are applied as a `<Sequence from={-trimBefore}>` offset and the
 * media element then seeks to `frame / useVideoConfig().fps`, which never
 * consults the file's own frame rate. Storing seconds and converting at render
 * time means a project's fps can change without silently reinterpreting every
 * trim, and removes a whole class of source-vs-composition frame confusion.
 */

import type { AnimationSpec, Effect } from "./editor-effects";
import { itemEffects } from "./editor-effects";
import type { Keyframes, Keyframe } from "./editor-keys";
import { shiftAllChannels, keyframesAreValid, setKey, removeKey, valueAt, resolvedLayout, CHANNELS_BY_ID, type ChannelId } from "./editor-keys";

export const EDITOR_DOC_VERSION = 2;

/**
 * v1 -> v2 adds `item.effects`.
 *
 * Every addition is OPTIONAL and every default reproduces v1 behaviour, so a v1
 * document IS a valid v2 document — the migration is READING it, not rewriting
 * it. `migrateDoc` stamps the version and folds the two legacy animation slots
 * into the effect list; nothing on disk changes until the user edits something,
 * and an untouched v1 file still opens in a v1 build.
 *
 * Run it in exactly one place: where the editor loads a document.
 */
export function migrateDoc(doc: EditorDoc): EditorDoc {
  let touched = doc.version !== EDITOR_DOC_VERSION;
  const tracks = doc.tracks.map((t) => {
    const items = t.items.map((it) => {
      if (it.effects || (!it.animateIn && !it.animateOut)) return it;
      touched = true;
      const { animateIn: _in, animateOut: _out, ...rest } = it;
      return { ...rest, effects: itemEffects(it) } as EditorItem;
    });
    return items.some((x, i) => x !== t.items[i]) ? { ...t, items } : t;
  });
  if (!touched) return doc;
  return { ...doc, version: EDITOR_DOC_VERSION, tracks };
}

export interface DocSize {
  width: number;
  height: number;
  fps: number;
}

/** Where an item sits on the canvas, in composition pixels. */
export interface ItemLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Degrees, clockwise, about the item's centre. */
  rotation?: number;
  /** 0..1 */
  opacity?: number;
  cornerRadius?: number;
  /**
   * Uniform multiplier about the anchor. 1 = the layout box as authored.
   * A TRANSFORM, not a resize — animating width/height would re-lay out text
   * every frame; `transform: scale()` is composited.
   */
  scale?: number;
  /** Transform origin, 0..1 of the item's own box. Defaults to the centre. */
  anchorX?: number;
  anchorY?: number;
  /** CSS blend mode. NOT animatable — it gets no keyframe diamond. */
  blend?: string;
}

export type AssetKind = "video" | "audio" | "image" | "gif";

export interface Asset {
  id: string;
  kind: AssetKind;
  /**
   * Either a project-media URL ("/api/media/<projectId>/<rel>") or a path for
   * `staticFile()` ("assets/logos/foo.png"). Rendered as-is; the render route
   * rewrites project-media URLs to an absolute origin.
   */
  src: string;
  name: string;
  /** Source duration in seconds, from ffprobe. Undefined until probed. */
  durationSec?: number;
  width?: number;
  height?: number;
}

interface ItemBase {
  id: string;
  /**
   * What the timeline calls this block. Optional: without one the timeline
   * falls back to the snippet id, then the asset's filename, then the type —
   * which is how a document full of scenes came to show seventeen blocks all
   * labelled "scene".
   */
  name?: string;
  /** Composition frame this item starts at. */
  from: number;
  durationInFrames: number;
  layout: ItemLayout;
  /**
   * How the item arrives and leaves.
   *
   * @deprecated Superseded by `effects`, which is an ordered list and can be
   * bypassed without losing its values. These stay readable so an untouched v1
   * document still opens: `itemEffects()` synthesises the list from them when
   * `effects` is absent, and nothing is rewritten on disk until you edit one.
   */
  animateIn?: AnimationSpec;
  animateOut?: AnimationSpec;
  /**
   * The effect stack — ordered, each independently bypassable. Effects apply
   * top to bottom, and order is observable because transforms do not commute.
   */
  effects?: Effect[];
  /**
   * Animated properties, keyed on ITEM-RELATIVE frames.
   *
   * Item-relative because `useCurrentFrame()` inside a <Sequence> is already
   * item-relative, so the renderer does no offset arithmetic — the same reason
   * caption tokens are stored that way.
   */
  keys?: Keyframes;
  /**
   * Section ids that are switched OFF — "transform", "opacity".
   *
   * Bypass keeps the values: the section collapses, its title greys and it is
   * marked bypassed, and everything it holds survives. That is what makes a
   * switch an A/B rather than a delete, and it is why this is a list of what is
   * off rather than the values being cleared.
   */
  bypass?: string[];
}

/** Fields shared by anything with a soundtrack or a source file to trim. */
interface MediaFields {
  assetId: string;
  /** Seconds into the source where playback starts. */
  sourceIn?: number;
  /** Seconds into the source where playback stops. */
  sourceOut?: number;
  /** 0..1, linear. */
  volume?: number;
  fadeInFrames?: number;
  fadeOutFrames?: number;
  /** 1 = normal. */
  playbackRate?: number;
}

export interface VideoItem extends ItemBase, MediaFields {
  type: "video";
  /**
   * A colour grade applied to THIS clip, as a LUT id from the picker.
   *
   * Export grades the whole finished video in one ffmpeg pass, which cannot say
   * "this shot and not that one". So a graded clip points at a graded COPY of
   * its footage instead — the look is in the file, which is why it shows in the
   * preview and needs nothing from the renderer.
   */
  lut?: string;
  /** The ungraded asset, kept so the look can be taken back off. */
  baseAssetId?: string;
}
export interface AudioItem extends ItemBase, MediaFields {
  type: "audio";
}
export interface ImageItem extends ItemBase {
  type: "image";
  assetId: string;
  /** "cover" crops to fill the layout box, "contain" fits inside it. */
  fit?: "cover" | "contain" | "fill";
}
export interface GifItem extends ItemBase {
  type: "gif";
  assetId: string;
  fit?: "cover" | "contain" | "fill";
}

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight?: number;
  color: string;
  align?: "left" | "center" | "right";
  lineHeight?: number;
  letterSpacing?: number;
  backgroundColor?: string;
  padding?: number;
  backgroundRadius?: number;
  /** CSS text-shadow, e.g. "0px 4px 3px rgba(0,0,0,0.25)". */
  textShadow?: string;
  /**
   * Outline drawn around the glyphs, for text over busy footage. Painted
   * behind the fill, so it thickens the letterform rather than eating it.
   */
  stroke?: { width: number; color: string };
}

export interface TextItem extends ItemBase {
  type: "text";
  text: string;
  style: TextStyle;
}

export interface SolidItem extends ItemBase {
  type: "solid";
  color: string;
}

/**
 * One spoken word, timed in seconds FROM THE START OF ITS ITEM — not from the
 * start of the composition.
 *
 * That choice is deliberate: item-relative times move and trim with the item, so
 * dragging captions along the timeline keeps them in sync with the words. Times
 * anchored to the composition would silently desync the moment anything moved,
 * which is exactly how the full-length audio bed caught us out.
 */
export interface CaptionToken {
  text: string;
  startSec: number;
  endSec: number;
}

export interface CaptionsItem extends ItemBase {
  type: "captions";
  tokens: CaptionToken[];
  style: TextStyle;
  /** Colour of the word currently being spoken. */
  highlightColor?: string;
  /** How long one page of words stays on screen, in milliseconds. */
  pageDurationMs?: number;
  /** Most words shown at once before the page breaks. */
  maxWordsPerPage?: number;
}

/**
 * An AI-generated Remotion scene, placed as an item. This is the bridge between
 * the generator and the editor: the AI keeps writing TSX exactly as it does now,
 * and its output becomes a block you can position, trim and layer. It is also
 * how an existing code-first project enters the editor — wrapped whole, with
 * nothing parsed.
 */
export interface SceneItem extends ItemBase {
  type: "scene";
  code: string;
  /**
   * Where this block came from, when it was inserted from the snippet library.
   * Kept so the parameter form can be reopened and its texts changed — the
   * substitution in lib/snippet-template.ts only runs one way, so the values
   * cannot be recovered from the rendered code reliably.
   */
  snippet?: { id: string; values: Record<string, unknown> };
  /**
   * Which frame of the embedded composition this item starts at — a trim, for a
   * scene instead of a file.
   *
   * This is what lets a generated composition be split into blocks without
   * losing anything: each block embeds the WHOLE original and shows only its own
   * stretch of it, so branded animated title cards keep rendering exactly as they
   * were authored. Nothing is parsed out of the source; it is windowed, the same
   * way `trimBefore` windows a video.
   */
  sourceOffsetFrames?: number;
  /**
   * What resizing this item means.
   *
   * "window" (the default for imported cards) keeps the embedded composition at
   * its authored timing and slides `sourceOffsetFrames` — dragging an edge moves
   * which stretch you see.
   *
   * "retime" makes the animation span the item: its entrance sits at the item's
   * start and its exit at the item's end, so stretching the block stretches the
   * animation. A placed snippet or a generated animation is a whole piece rather
   * than a window onto a longer one, so that is what it gets.
   *
   * Absent, `sceneFit` infers it — anything carrying snippet provenance retimes.
   */
  fit?: "window" | "retime";
}

export type EditorItem =
  | VideoItem
  | AudioItem
  | ImageItem
  | GifItem
  | TextItem
  | SolidItem
  | CaptionsItem
  | SceneItem;

export type ItemType = EditorItem["type"];

export interface Track {
  id: string;
  name: string;
  hidden?: boolean;
  muted?: boolean;
  /** Kept sorted by `from`, and non-overlapping. */
  items: EditorItem[];
}

export interface EditorDoc {
  version: number;
  size: DocSize;
  /** Later tracks render in FRONT of earlier ones. */
  tracks: Track[];
  assets: Asset[];
  /**
   * What shows through where nothing is drawn. Hex, e.g. "#0A0A0B".
   *
   * Optional, and absent means black — which is what the renderer hardcoded
   * before this existed, so every stored document keeps rendering exactly as it
   * did. A transparent export ignores it.
   */
  background?: string;
}

// ── construction ────────────────────────────────────────────────────────────

let idCounter = 0;
/** Ids only need to be unique within a document. */
export function makeId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}`;
}

export function emptyDoc(size: DocSize): EditorDoc {
  return {
    version: EDITOR_DOC_VERSION,
    size,
    tracks: [{ id: makeId("track"), name: "Track 1", items: [] }],
    assets: [],
  };
}

/** A layout filling the whole frame — the sensible default for footage. */
export function fullFrameLayout(size: DocSize): ItemLayout {
  return { x: 0, y: 0, width: size.width, height: size.height };
}

// ── reading ─────────────────────────────────────────────────────────────────

export function docDuration(doc: EditorDoc): number {
  let max = 0;
  for (const track of doc.tracks) {
    for (const item of track.items) {
      max = Math.max(max, item.from + item.durationInFrames);
    }
  }
  return Math.max(1, max);
}

export function findItem(
  doc: EditorDoc,
  itemId: string,
): { track: Track; item: EditorItem; index: number } | null {
  for (const track of doc.tracks) {
    const index = track.items.findIndex((i) => i.id === itemId);
    if (index !== -1) return { track, item: track.items[index], index };
  }
  return null;
}

export function getAsset(doc: EditorDoc, assetId: string): Asset | undefined {
  return doc.assets.find((a) => a.id === assetId);
}

/** Items that are on screen at `frame`, front-most last. */
export function itemsAtFrame(doc: EditorDoc, frame: number): EditorItem[] {
  const out: EditorItem[] = [];
  for (const track of doc.tracks) {
    if (track.hidden) continue;
    for (const item of track.items) {
      if (frame >= item.from && frame < item.from + item.durationInFrames) out.push(item);
    }
  }
  return out;
}

// ── invariants ──────────────────────────────────────────────────────────────

/**
 * The position closest to `wanted` where an item of `duration` frames fits on
 * this track without overlapping anything else.
 *
 * Dragging is not allowed to be blocked by a neighbour. Clamping to the gap
 * between the two items either side means a clip wedged against both is stuck
 * where it is — which is what happened to a snippet dropped between two title
 * cards. Searching every gap instead means dragging past a neighbour lands the
 * clip after it, the way an editor should behave, while the no-overlap invariant
 * still holds.
 */
export function findFreeSlot(
  track: Track,
  excludeId: string,
  wanted: number,
  duration: number,
): number {
  const others = track.items
    .filter((i) => i.id !== excludeId)
    .sort((a, b) => a.from - b.from);
  const target = Math.max(0, wanted);

  // Free gaps, in order: before the first item, between each pair, after the last.
  const gaps: { start: number; end: number }[] = [];
  let cursor = 0;
  for (const other of others) {
    if (other.from > cursor) gaps.push({ start: cursor, end: other.from });
    cursor = Math.max(cursor, other.from + other.durationInFrames);
  }
  gaps.push({ start: cursor, end: Number.POSITIVE_INFINITY });

  let best: number | null = null;
  for (const gap of gaps) {
    if (gap.end - gap.start < duration) continue;
    const placed = Math.max(gap.start, Math.min(gap.end - duration, target));
    if (best === null || Math.abs(placed - target) < Math.abs(best - target)) best = placed;
  }
  return best ?? target;
}

/**
 * Items in a track may not overlap — that is what keeps trim and ripple
 * unambiguous. Layering is what tracks are for. Returns the room an item has to
 * grow into, bounded by its neighbours.
 */
function bounds(track: Track, itemId: string): { min: number; max: number } {
  const sorted = [...track.items].sort((a, b) => a.from - b.from);
  const i = sorted.findIndex((it) => it.id === itemId);
  if (i === -1) return { min: 0, max: Number.POSITIVE_INFINITY };
  const prev = sorted[i - 1];
  const next = sorted[i + 1];
  return {
    min: prev ? prev.from + prev.durationInFrames : 0,
    max: next ? next.from : Number.POSITIVE_INFINITY,
  };
}

function sortItems(track: Track): Track {
  return { ...track, items: [...track.items].sort((a, b) => a.from - b.from) };
}

function withTrack(doc: EditorDoc, trackId: string, fn: (t: Track) => Track): EditorDoc {
  return { ...doc, tracks: doc.tracks.map((t) => (t.id === trackId ? sortItems(fn(t)) : t)) };
}

function replaceItem(doc: EditorDoc, itemId: string, fn: (i: EditorItem) => EditorItem): EditorDoc {
  const found = findItem(doc, itemId);
  if (!found) return doc;
  return withTrack(doc, found.track.id, (t) => ({
    ...t,
    items: t.items.map((i) => (i.id === itemId ? fn(i) : i)),
  }));
}

/** True when no track has overlapping items. Used by tests and by validation. */
export function isValidDoc(doc: EditorDoc): boolean {
  for (const track of doc.tracks) {
    const sorted = [...track.items].sort((a, b) => a.from - b.from);
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].from < 0 || sorted[i].durationInFrames < 1) return false;
      // Keyframes: sorted, unique, finite integers. Deliberately NOT
      // `frame >= 0` — a split shifts a tail's keys negative on purpose.
      if (!keyframesAreValid(sorted[i].keys)) return false;
      const next = sorted[i + 1];
      if (next && sorted[i].from + sorted[i].durationInFrames > next.from) return false;
    }
  }
  return true;
}

// ── operations ──────────────────────────────────────────────────────────────

export function addTrack(doc: EditorDoc, name?: string): EditorDoc {
  const track: Track = {
    id: makeId("track"),
    name: name ?? `Track ${doc.tracks.length + 1}`,
    items: [],
  };
  return { ...doc, tracks: [...doc.tracks, track] };
}

export function removeTrack(doc: EditorDoc, trackId: string): EditorDoc {
  if (doc.tracks.length <= 1) return doc;
  return { ...doc, tracks: doc.tracks.filter((t) => t.id !== trackId) };
}

/** Move a track in the stacking order. Higher index renders in front. */
export function reorderTrack(doc: EditorDoc, trackId: string, targetIndex: number): EditorDoc {
  const from = doc.tracks.findIndex((t) => t.id === trackId);
  if (from === -1) return doc;
  const tracks = [...doc.tracks];
  const [moved] = tracks.splice(from, 1);
  tracks.splice(Math.max(0, Math.min(tracks.length, targetIndex)), 0, moved);
  return { ...doc, tracks };
}

export function addAsset(doc: EditorDoc, asset: Asset): EditorDoc {
  if (doc.assets.some((a) => a.id === asset.id)) return doc;
  return { ...doc, assets: [...doc.assets, asset] };
}

/* ───────────────────── changing the frame, and the rate ───────────────────── */

/**
 * Re-lay out the whole composition for a different frame size.
 *
 * Positions are in composition pixels, so changing the frame without moving
 * anything would leave every element in the wrong place — a title centred in
 * 2560×1440 sits off to the left in 1080×1920. Horizontal values scale by the
 * width ratio, vertical by the height ratio, and font size and corner radius by
 * the SMALLER of the two, which is the same convention the aspect-ratio
 * conversion already uses for code projects.
 *
 * Keyframed x and y scale with their axis, or an animation would drift back to
 * where it was drawn.
 *
 * It cannot be perfect — a layout composed for one shape is not automatically
 * right in another — which is why the dialog says so before you apply it.
 */
export function resizeDoc(doc: EditorDoc, width: number, height: number): EditorDoc {
  if (width <= 0 || height <= 0) return doc;
  if (width === doc.size.width && height === doc.size.height) return doc;

  const sx = width / doc.size.width;
  const sy = height / doc.size.height;
  const sf = Math.min(sx, sy);
  const r = (n: number) => Math.round(n * 100) / 100;

  const scaleKeys = (keys: Keyframes | undefined): Keyframes | undefined => {
    if (!keys) return keys;
    const next: Keyframes = { ...keys };
    for (const ch of ["x", "y"] as const) {
      const list = keys[ch];
      if (list?.length) next[ch] = list.map((k) => ({ ...k, value: r(k.value * (ch === "x" ? sx : sy)) }));
    }
    return next;
  };

  return {
    ...doc,
    size: { ...doc.size, width, height },
    tracks: doc.tracks.map((t) => ({
      ...t,
      items: t.items.map((item) => {
        const l = item.layout;
        const next = {
          ...item,
          layout: {
            ...l,
            x: r(l.x * sx),
            y: r(l.y * sy),
            width: r(l.width * sx),
            height: r(l.height * sy),
            ...(l.cornerRadius !== undefined ? { cornerRadius: r(l.cornerRadius * sf) } : {}),
          },
          ...(item.keys ? { keys: scaleKeys(item.keys) } : {}),
        } as EditorItem;
        // Type scales with the frame too, or a headline built for 4K turns
        // into a caption at 1080.
        if (next.type === "text") {
          const t2 = next as TextItem;
          if (t2.style?.fontSize) {
            return { ...t2, style: { ...t2.style, fontSize: Math.max(1, Math.round(t2.style.fontSize * sf)) } };
          }
        }
        return next;
      }),
    })),
  };
}

/**
 * Change the frame rate and re-time everything to keep the same WALL CLOCK.
 *
 * Frames are the document's only unit of time, so changing fps without
 * re-timing silently changes how long everything lasts: at 25 -> 50 a
 * two-second title becomes a one-second title. Every `from`, duration,
 * keyframe and effect length scales by the ratio.
 *
 * Boundaries are rounded from the same numbers on both sides — a clip's end and
 * the next clip's start are one value — so clips that were adjacent stay
 * adjacent, with no overlap opened by rounding and no one-frame gap.
 */
export function retimeDoc(doc: EditorDoc, fps: number): EditorDoc {
  if (!Number.isFinite(fps) || fps <= 0 || fps === doc.size.fps) return doc;
  const ratio = fps / doc.size.fps;
  const at = (frame: number) => Math.round(frame * ratio);

  return {
    ...doc,
    size: { ...doc.size, fps },
    tracks: doc.tracks.map((t) => ({
      ...t,
      items: t.items.map((item) => {
        const from = at(item.from);
        const end = at(item.from + item.durationInFrames);
        const next: EditorItem = {
          ...item,
          from,
          durationInFrames: Math.max(1, end - from),
        };

        if (item.keys) {
          const keys: Keyframes = {};
          for (const [ch, list] of Object.entries(item.keys) as [ChannelId, Keyframe[] | undefined][]) {
            if (!list?.length) continue;
            // Two keys can land on the same frame when slowing down; the later
            // one wins, because keys must stay sorted and unique.
            const seen = new Map<number, Keyframe>();
            for (const k of list) seen.set(at(k.frame), { ...k, frame: at(k.frame) });
            keys[ch] = [...seen.values()].sort((a, b) => a.frame - b.frame);
          }
          next.keys = keys;
        }

        if (item.effects?.length) {
          next.effects = item.effects.map((fx) =>
            "durationInFrames" in fx
              ? { ...fx, durationInFrames: Math.max(1, Math.round(fx.durationInFrames * ratio)) }
              : fx);
        }
        return next;
      }),
    })),
  };
}

/**
 * Point an asset at a different file, keeping every clip that uses it.
 *
 * This is what "Locate…" does when a source has been moved or renamed. It
 * deliberately changes the asset rather than the clips: the clips' trims,
 * effects and keyframes are about the footage, not about where the footage
 * happens to live, and re-importing to fix a moved file loses all of it.
 *
 * A clip whose source is gone renders as black, silently, and the only place
 * that shows up today is the finished export.
 */
export function relinkAsset(doc: EditorDoc, assetId: string, src: string, name?: string): EditorDoc {
  const asset = doc.assets.find((a) => a.id === assetId);
  if (!asset) return doc;
  if (asset.src === src && (name === undefined || asset.name === name)) return doc;
  return {
    ...doc,
    assets: doc.assets.map((a) =>
      a.id === assetId ? { ...a, src, ...(name !== undefined ? { name } : {}) } : a),
  };
}

/**
 * Place an item on a track. If it would overlap something, it is pushed to the
 * first free slot at or after its requested position rather than rejected —
 * dropping a clip roughly where you want it should work.
 */
export function addItem(doc: EditorDoc, trackId: string, item: EditorItem): EditorDoc {
  const track = doc.tracks.find((t) => t.id === trackId);
  if (!track) return doc;
  let from = Math.max(0, item.from);
  const sorted = [...track.items].sort((a, b) => a.from - b.from);
  for (const other of sorted) {
    const otherEnd = other.from + other.durationInFrames;
    if (from < otherEnd && from + item.durationInFrames > other.from) from = otherEnd;
  }
  return withTrack(doc, trackId, (t) => ({ ...t, items: [...t.items, { ...item, from }] }));
}

export function removeItem(doc: EditorDoc, itemId: string): EditorDoc {
  const found = findItem(doc, itemId);
  if (!found) return doc;
  return withTrack(doc, found.track.id, (t) => ({
    ...t,
    items: t.items.filter((i) => i.id !== itemId),
  }));
}

/** Remove an item and slide everything after it on the SAME track left. */
export function rippleRemoveItem(doc: EditorDoc, itemId: string): EditorDoc {
  const found = findItem(doc, itemId);
  if (!found) return doc;
  const shift = found.item.durationInFrames;
  return withTrack(doc, found.track.id, (t) => ({
    ...t,
    items: t.items
      .filter((i) => i.id !== itemId)
      .map((i) => (i.from > found.item.from ? { ...i, from: Math.max(0, i.from - shift) } : i)),
  }));
}

/** Slide an item along its track, clamped to the gap between its neighbours. */
export function moveItem(doc: EditorDoc, itemId: string, deltaFrames: number): EditorDoc {
  const found = findItem(doc, itemId);
  if (!found) return doc;
  const from = findFreeSlot(
    found.track,
    itemId,
    found.item.from + deltaFrames,
    found.item.durationInFrames,
  );
  return replaceItem(doc, itemId, (i) => ({ ...i, from }));
}

/**
 * How this scene should behave when its item is resized. A block placed from the
 * snippet library (or generated as a whole) is a piece in its own right and
 * retimes; anything else is a window onto a longer composition.
 */
export function sceneFit(item: SceneItem): "window" | "retime" {
  return item.fit ?? (item.snippet ? "retime" : "window");
}

/**
 * Rewrite a scene's declared length so it matches the frames it will actually
 * receive.
 *
 * A scene times its own exit against its module-scope `durationInFrames` — e.g.
 * `inOutEnvelope(frame, fps, durationInFrames)` starts the outro at
 * `durationInFrames - exitTail`. Placed unchanged, a 150-frame 30fps card inside
 * a 125-frame 25fps slot only ever sees frames 0..124, so that outro is never
 * reached and the card cuts hard. Both consts move to composition units, which
 * also makes the rewrite idempotent: reading the meta back gives the same length
 * instead of converting a second time.
 *
 * Only the module-scope `export const` declarations are touched, matched at the
 * start of a line the way the snippet substitution does.
 */
export function retimeSceneCode(code: string, durationInFrames: number, fps: number): string {
  if (!code) return code;
  const frames = Math.max(1, Math.round(durationInFrames));
  const rate = Math.max(1, Math.round(fps));
  let out = code.replace(
    /^(\s*export\s+const\s+durationInFrames\s*(?::\s*number\s*)?=\s*)[\d.]+(\s*;?)/m,
    (_m, head, tail) => `${head}${frames}${tail}`,
  );
  out = out.replace(
    /^(\s*export\s+const\s+fps\s*(?::\s*number\s*)?=\s*)[\d.]+(\s*;?)/m,
    (_m, head, tail) => `${head}${rate}${tail}`,
  );
  return out;
}

/** Apply `retimeSceneCode` to an item when, and only when, it retimes. */
export function fitSceneItem(item: SceneItem, fps: number): SceneItem {
  if (sceneFit(item) !== "retime") return item;
  const code = retimeSceneCode(item.code, item.durationInFrames, fps);
  return code === item.code ? item : { ...item, code };
}

/**
 * Drag one edge. The opposite edge stays put, and for media the source trim
 * moves with it so the same footage keeps playing under the cursor.
 */
export function trimItem(
  doc: EditorDoc,
  itemId: string,
  edge: "left" | "right",
  deltaFrames: number,
  fps: number,
): EditorDoc {
  const found = findItem(doc, itemId);
  if (!found) return doc;
  const item = found.item;
  const { min, max } = bounds(found.track, itemId);

  if (edge === "right") {
    const maxDuration = max - item.from;
    const duration = Math.max(1, Math.min(maxDuration, item.durationInFrames + deltaFrames));
    const applied = duration - item.durationInFrames;
    return replaceItem(doc, itemId, (i) => {
      if (hasSource(i) && i.sourceOut != null) {
        return { ...i, durationInFrames: duration, sourceOut: i.sourceOut + applied / fps };
      }
      const next = { ...i, durationInFrames: duration };
      // A retiming scene spans its item, so a longer block is a longer animation
      // and its exit follows the new end instead of staying at the authored one.
      return next.type === "scene" ? fitSceneItem(next, fps) : next;
    });
  }

  // Left edge: `from` moves, the right edge is fixed.
  const maxLeft = item.from - min;
  const maxRight = item.durationInFrames - 1;
  const applied = Math.max(-maxLeft, Math.min(maxRight, deltaFrames));
  return replaceItem(doc, itemId, (i) => {
    const next = {
      ...i,
      from: i.from + applied,
      durationInFrames: i.durationInFrames - applied,
    };
    // Dragging the left edge moves the window, so whatever the item plays from
    // has to move with it — seconds into a file, or frames into an embedded
    // composition. Without this a trimmed scene restarts from its old frame.
    if (i.type === "scene") {
      // Only a window slides — a retiming scene replays in full over whatever
      // length it now has, so moving its start must not skip into its middle.
      if (sceneFit(i) === "retime") return fitSceneItem(next as SceneItem, fps);
      return { ...next, sourceOffsetFrames: Math.max(0, (i.sourceOffsetFrames ?? 0) + applied) };
    }
    // Keys are item-relative, so dragging the left edge cuts into the motion
    // exactly as it cuts into the footage. Same one-line rule as sourceIn.
    //
    // The two-layer story worth keeping straight: PRESETS are anchored to the
    // clip's EDGES (an entrance plays at the start however you trim), while
    // KEYFRAMES are anchored to the clip's CONTENT.
    const shifted = { ...next, keys: shiftAllChannels(i.keys, -applied) };
    if (!hasSource(i)) return shifted;
    return { ...shifted, sourceIn: (i.sourceIn ?? 0) + applied / fps };
  });
}

/** Cut an item in two at an absolute composition frame. */
export function splitItem(doc: EditorDoc, itemId: string, atFrame: number, fps: number): EditorDoc {
  const found = findItem(doc, itemId);
  if (!found) return doc;
  const item = found.item;
  const local = atFrame - item.from;
  if (local <= 0 || local >= item.durationInFrames) return doc;

  const head: EditorItem = { ...item, durationInFrames: local };
  const tail: EditorItem = {
    ...item,
    id: makeId(item.type),
    from: item.from + local,
    durationInFrames: item.durationInFrames - local,
    // The tail's keys shift back by the cut point — the mirror of the
    // sourceOffsetFrames rule below. Keys that land before frame 0 are KEPT,
    // not dropped: the evaluator holds the first value below the first key, so
    // the tail correctly holds the state the head ended in. Dropping them would
    // snap the tail back to its static value and make every split jump.
    keys: shiftAllChannels(item.keys, -local),
  };
  if (hasSource(item)) {
    const cutSec = (item.sourceIn ?? 0) + local / fps;
    if (item.sourceOut != null) (head as VideoItem).sourceOut = cutSec;
    (tail as VideoItem).sourceIn = cutSec;
  } else if (item.type === "scene") {
    // A scene is windowed onto an embedded composition by `sourceOffsetFrames`,
    // which is the same idea as a media trim and needs the same treatment. Copy
    // it to the tail unchanged and the second half REPLAYS the first — which is
    // what cutRange (splitting at both edges of a cut) does to a branded card.
    (tail as SceneItem).sourceOffsetFrames = (item.sourceOffsetFrames ?? 0) + local;
  }
  return withTrack(doc, found.track.id, (t) => ({
    ...t,
    items: t.items.flatMap((i) => (i.id === itemId ? [head, tail] : [i])),
  }));
}

/**
 * Keyframe operations.
 *
 * The corollaries that make the inspector fall out for free:
 *   - turning a diamond ON writes the current static value as the first key,
 *     so nothing moves;
 *   - turning it OFF bakes the value at the playhead back into the scalar, so
 *     nothing moves;
 *   - removing the LAST key restores the scalar from that key, so nothing
 *     moves.
 *
 * `localFrame` is always item-relative — composition frame minus `item.from`.
 */

/** The static ItemLayout field a channel falls back to. 1:1 by construction. */
function channelFallback(l: ItemLayout, ch: ChannelId): number {
  switch (ch) {
    case "x": return l.x;
    case "y": return l.y;
    case "scale": return l.scale ?? 1;
    case "rotation": return l.rotation ?? 0;
    case "anchorX": return l.anchorX ?? 0.5;
    case "anchorY": return l.anchorY ?? 0.5;
    case "opacity": return l.opacity ?? 1;
  }
}

function withKeys(item: EditorItem, ch: ChannelId, next: Keyframe[] | undefined): EditorItem {
  const keys = { ...(item.keys ?? {}) };
  if (!next || next.length === 0) delete keys[ch];
  else keys[ch] = next;
  const empty = Object.keys(keys).length === 0;
  const out = { ...item, keys: empty ? undefined : keys } as EditorItem;
  if (empty) delete (out as { keys?: unknown }).keys;
  return out;
}

export function setItemKey(
  doc: EditorDoc, itemId: string, ch: ChannelId, localFrame: number, value: number,
): EditorDoc {
  return replaceItem(doc, itemId, (i) =>
    withKeys(i, ch, setKey(i.keys?.[ch], localFrame, value)));
}

export function removeItemKey(
  doc: EditorDoc, itemId: string, ch: ChannelId, localFrame: number,
): EditorDoc {
  return replaceItem(doc, itemId, (i) => {
    const cur = i.keys?.[ch];
    if (!cur) return i;
    const next = removeKey(cur, localFrame);
    if (next.length > 0) return withKeys(i, ch, next);
    // That was the last key — bake its value back into the scalar so the item
    // stays exactly where the animation left it.
    const dying = cur.find((k) => k.frame === Math.round(localFrame)) ?? cur[0];
    const cleared = withKeys(i, ch, undefined);
    return { ...cleared, layout: { ...cleared.layout, [ch]: dying.value } } as EditorItem;
  });
}

/** Diamond on: the current value becomes the first key. Nothing moves. */
export function enableChannel(
  doc: EditorDoc, itemId: string, ch: ChannelId, localFrame: number,
): EditorDoc {
  return replaceItem(doc, itemId, (i) => {
    if (i.keys?.[ch]?.length) return i;
    const now = channelFallback(i.layout, ch);
    return withKeys(i, ch, setKey(undefined, localFrame, now));
  });
}

/** Diamond off: bake the value at the playhead into the scalar. Nothing moves. */
export function disableChannel(
  doc: EditorDoc, itemId: string, ch: ChannelId, localFrame: number,
): EditorDoc {
  return replaceItem(doc, itemId, (i) => {
    const cur = i.keys?.[ch];
    if (!cur || cur.length === 0) return i;
    const baked = valueAt(cur, localFrame, channelFallback(i.layout, ch), CHANNELS_BY_ID[ch]);
    const cleared = withKeys(i, ch, undefined);
    return { ...cleared, layout: { ...cleared.layout, [ch]: baked } } as EditorItem;
  });
}

/** The item's layout at a COMPOSITION frame — the three views' shared read. */
export function itemLayoutAt(item: EditorItem, compositionFrame: number) {
  return resolvedLayout(item, compositionFrame - item.from);
}

/* ─────────────────── acting on a whole selection ─────────────────── */

/** The selected items on one track, in time order. Other tracks are ignored. */
function selectionOnTracks(doc: EditorDoc, ids: string[]): { track: Track; items: EditorItem[] }[] {
  const wanted = new Set(ids);
  return doc.tracks
    .map((track) => ({ track, items: track.items.filter((i) => wanted.has(i.id)).sort((a, b) => a.from - b.from) }))
    .filter((g) => g.items.length > 1);
}

/**
 * The gap `evenSpacing` would produce, so the button can say what it will do
 * before you press it.
 *
 * Returns null when there is nothing to space — fewer than two clips on any one
 * track, or they already fill their own span with no room between them.
 */
export function evenSpacingGap(doc: EditorDoc, ids: string[]): number | null {
  const groups = selectionOnTracks(doc, ids);
  if (groups.length === 0) return null;
  const g = groups[0];
  const first = g.items[0];
  const last = g.items[g.items.length - 1];
  const span = last.from + last.durationInFrames - first.from;
  const used = g.items.reduce((n, i) => n + i.durationInFrames, 0);
  const gap = Math.floor((span - used) / (g.items.length - 1));
  return gap >= 0 ? gap : 0;
}

/**
 * Distribute the selection evenly between its own first and last clip.
 *
 * The outer two do not move — they define the span you already chose by
 * placing them. Everything between them gets an equal gap. Clips on different
 * tracks are spaced within their own track, since a gap only means anything
 * against neighbours you can actually see.
 */
export function evenSpacing(doc: EditorDoc, ids: string[]): EditorDoc {
  let next = doc;
  for (const g of selectionOnTracks(doc, ids)) {
    const gap = evenSpacingGap(doc, g.items.map((i) => i.id)) ?? 0;
    let cursor = g.items[0].from;
    for (const item of g.items) {
      if (item.from !== cursor) next = replaceItem(next, item.id, (i) => ({ ...i, from: cursor }));
      cursor += item.durationInFrames + gap;
    }
  }
  return next;
}

/**
 * Give every selected clip the length of the first one.
 *
 * The first in TIME, not the first you happened to click — the one you can see
 * at the left of the run is the one you are matching to.
 */
export function sameDuration(doc: EditorDoc, ids: string[], fps: number): EditorDoc {
  const groups = selectionOnTracks(doc, ids);
  if (groups.length === 0) return doc;
  const target = groups[0].items[0].durationInFrames;
  let next = doc;
  for (const g of groups) {
    for (const item of g.items) {
      if (item.durationInFrames === target) continue;
      next = trimItem(next, item.id, "right", target - item.durationInFrames, fps);
    }
  }
  return next;
}

/** Copy one clip's effect stack onto every other clip in the selection. */
export function pasteEffects(doc: EditorDoc, fromId: string, toIds: string[]): EditorDoc {
  const source = findItem(doc, fromId);
  if (!source) return doc;
  const effects = itemEffects(source.item);
  let next = doc;
  for (const id of toIds) {
    if (id === fromId) continue;
    // Ids are derived from the item, so each copy gets its own — otherwise two
    // clips would share a React key and a section would toggle both.
    next = replaceItem(next, id, (i) => ({
      ...i,
      effects: effects.map((e) => ({ ...e, id: `${i.id}:${e.kind === "animateIn" ? "in" : "out"}` })),
    }));
  }
  return next;
}

export function setLayout(doc: EditorDoc, itemId: string, patch: Partial<ItemLayout>): EditorDoc {
  return replaceItem(doc, itemId, (i) => ({ ...i, layout: { ...i.layout, ...patch } }));
}

/** Patch arbitrary fields of one item (text content, colour, volume, …). */
export function updateItem<T extends EditorItem>(
  doc: EditorDoc,
  itemId: string,
  patch: Partial<T>,
): EditorDoc {
  return replaceItem(doc, itemId, (i) => ({ ...i, ...patch }) as EditorItem);
}

/** Does this item play a source file that can be trimmed? */
export function hasSource(item: EditorItem): item is VideoItem | AudioItem {
  return item.type === "video" || item.type === "audio";
}

/**
 * Frames worth snapping to while dragging: every other item's edges, zero, the
 * end of the composition, and optionally the playhead. Pair with `snapFrame`
 * from lib/editable-timeline.ts, which is model-agnostic.
 */
export function snapTargets(
  doc: EditorDoc,
  opts: { excludeItemId?: string; playhead?: number } = {},
): number[] {
  const targets = new Set<number>([0, docDuration(doc)]);
  for (const track of doc.tracks) {
    for (const item of track.items) {
      if (item.id === opts.excludeItemId) continue;
      targets.add(item.from);
      targets.add(item.from + item.durationInFrames);
    }
  }
  if (opts.playhead != null) targets.add(Math.round(opts.playhead));
  return [...targets].sort((a, b) => a - b);
}

/**
 * Wrap an existing code-first project as a single scene item — how a legacy
 * project enters the editor without anything being parsed.
 */
export function docFromScene(
  size: DocSize,
  code: string,
  durationInFrames: number,
  name = "Scene",
): EditorDoc {
  const doc = emptyDoc(size);
  const item: SceneItem = {
    type: "scene",
    id: makeId("scene"),
    from: 0,
    durationInFrames: Math.max(1, durationInFrames),
    layout: fullFrameLayout(size),
    code,
  };
  return {
    ...doc,
    tracks: [{ ...doc.tracks[0], name, items: [item] }],
  };
}

export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

/**
 * Apply a resize-handle drag to a layout box, in composition pixels.
 *
 * The west and north handles move the box's origin as well as its size, which is
 * the part that goes wrong quietly. The box is never allowed to invert: at the
 * minimum size the moving edge stops rather than crossing the fixed one.
 */
export function resizeLayout(
  origin: ItemLayout,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  minSize = 8,
): ItemLayout {
  let { x, y, width, height } = origin;

  if (handle.includes("w")) {
    x = origin.x + dx;
    width = origin.width - dx;
  }
  if (handle.includes("e")) width = origin.width + dx;
  if (handle.includes("n")) {
    y = origin.y + dy;
    height = origin.height - dy;
  }
  if (handle.includes("s")) height = origin.height + dy;

  if (width < minSize) {
    width = minSize;
    if (handle.includes("w")) x = origin.x + origin.width - minSize;
  }
  if (height < minSize) {
    height = minSize;
    if (handle.includes("n")) y = origin.y + origin.height - minSize;
  }

  return { ...origin, x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
}

/**
 * Snap a moving box to the frame's edges and centre lines. Checks the box's
 * leading edge, trailing edge and centre against each guide, so a box lines up
 * whichever part of it you are aiming with.
 */
export function snapBox(
  x: number,
  y: number,
  width: number,
  height: number,
  size: DocSize,
  tolerance: number,
): { x: number; y: number; guideX: number | null; guideY: number | null } {
  const axis = (pos: number, extent: number, guides: number[]) => {
    for (const offset of [0, extent, extent / 2]) {
      for (const g of guides) {
        if (Math.abs(pos + offset - g) <= tolerance) return { pos: g - offset, guide: g };
      }
    }
    return { pos, guide: null as number | null };
  };
  const gx = axis(x, width, [0, size.width / 2, size.width]);
  const gy = axis(y, height, [0, size.height / 2, size.height]);
  return { x: gx.pos, y: gy.pos, guideX: gx.guide, guideY: gy.guide };
}

/** A group of caption words shown together. */
export interface CaptionPage {
  startSec: number;
  endSec: number;
  tokens: CaptionToken[];
}

/**
 * Group caption words into pages that fit on screen.
 *
 * A page closes when it has run for `pageDurationMs`, when it reaches
 * `maxWords`, or when there is a real pause in the speech — a gap longer than
 * `gapSec` means a new thought, and breaking there reads far better than
 * breaking mid-phrase on a timer.
 *
 * Kept here as a pure function rather than pulled in from @remotion/captions so
 * the behaviour is ours to test and tune; that package's
 * `createTikTokStyleCaptions` is the alternative if this ever needs to do more.
 */
export function paginateCaptions(
  tokens: CaptionToken[],
  pageDurationMs = 1200,
  maxWords = 6,
  gapSec = 0.6,
): CaptionPage[] {
  const pages: CaptionPage[] = [];
  let current: CaptionToken[] = [];
  const flush = () => {
    if (current.length === 0) return;
    pages.push({
      startSec: current[0].startSec,
      endSec: current[current.length - 1].endSec,
      tokens: current,
    });
    current = [];
  };

  for (const token of tokens) {
    if (current.length > 0) {
      const pageStart = current[0].startSec;
      const prevEnd = current[current.length - 1].endSec;
      const tooLong = (token.endSec - pageStart) * 1000 > pageDurationMs;
      const tooMany = current.length >= maxWords;
      const pause = token.startSec - prevEnd > gapSec;
      if (tooLong || tooMany || pause) flush();
    }
    current.push(token);
  }
  flush();
  return pages;
}

/** The page showing at `sec` (item-relative), or null between pages. */
export function captionPageAt(pages: CaptionPage[], sec: number): CaptionPage | null {
  for (const page of pages) {
    if (sec >= page.startSec && sec < page.endSec) return page;
  }
  return null;
}

/**
 * Move an item to another track, landing at `from`. Uses the same placement rule
 * as `addItem`, so dropping a clip roughly where you want it on a busy track
 * slides it to the first free slot rather than refusing the move.
 */
export function moveItemToTrack(
  doc: EditorDoc,
  itemId: string,
  targetTrackId: string,
  from: number,
): EditorDoc {
  const found = findItem(doc, itemId);
  if (!found) return doc;
  if (found.track.id === targetTrackId) return moveItem(doc, itemId, from - found.item.from);
  if (!doc.tracks.some((t) => t.id === targetTrackId)) return doc;
  const without = removeItem(doc, itemId);
  const target = without.tracks.find((t) => t.id === targetTrackId)!;
  const landing = findFreeSlot(target, itemId, Math.max(0, from), found.item.durationInFrames);
  return addItem(without, targetTrackId, { ...found.item, from: landing });
}

/** A copy of an item with a fresh id, so it can be pasted without colliding. */
export function cloneItem(item: EditorItem, from?: number): EditorItem {
  return { ...item, id: makeId(item.type), from: from ?? item.from };
}

/** Duplicate an item onto its own track, immediately after itself. */
export function duplicateItem(doc: EditorDoc, itemId: string): EditorDoc {
  const found = findItem(doc, itemId);
  if (!found) return doc;
  const copy = cloneItem(found.item, found.item.from + found.item.durationInFrames);
  return addItem(doc, found.track.id, copy);
}

/** Is there room for an item of `duration` frames starting exactly at `from`? */
export function hasRoomAt(track: Track, from: number, duration: number): boolean {
  return track.items.every(
    (i) => from + duration <= i.from || from >= i.from + i.durationInFrames,
  );
}

/**
 * A track with room at `from`, creating one if every existing track is busy
 * there.
 *
 * Clicking "+ Text" should put the text under the playhead — that is where you
 * are looking. Placing it on a busy track slid it to the first free slot
 * instead, which is usually the end of the video, so it appeared to go nowhere.
 */
export function trackWithRoomAt(
  doc: EditorDoc,
  from: number,
  duration: number,
): { doc: EditorDoc; trackId: string } {
  const existing = doc.tracks.find((t) => hasRoomAt(t, from, duration));
  if (existing) return { doc, trackId: existing.id };
  const grown = addTrack(doc);
  return { doc: grown, trackId: grown.tracks[grown.tracks.length - 1].id };
}

/**
 * Nearest target within a threshold, or the frame unchanged.
 *
 * Moved here from the retired code timeline, which is where it used to live —
 * the visual timeline was the only thing still calling it.
 */
export function snapFrame(
  frame: number,
  targets: number[],
  threshold: number,
): { frame: number; snapped: number | null } {
  let best: number | null = null;
  let bestDist = threshold + 1;
  for (const tg of targets) {
    const d = Math.abs(tg - frame);
    if (d <= threshold && d < bestDist) {
      best = tg;
      bestDist = d;
    }
  }
  return best != null ? { frame: best, snapped: best } : { frame, snapped: null };
}
