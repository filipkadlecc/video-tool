"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Icon from "@/components/ui/Icon";
import IconButton from "@/components/ui/IconButton";
import { useToast } from "@/components/ui/Toast";
import { usePlayheadFrame } from "@/hooks/usePlayhead";
import { timecode, needsHours } from "@/lib/timecode";
import { CHANNELS_BY_ID, type ChannelId } from "@/lib/editor-keys";
import Tooltip from "@/components/ui/Tooltip";
import Toggle from "@/components/ui/Toggle";
import { snapFrame } from "@/lib/editor-doc";
import type { AnimationPreset } from "@/lib/editor-effects";
import {
  addItem, addTrack, cloneItem, docDuration, duplicateItem, findItem, getAsset, hasRoomAt,
  makeId, moveItem, moveItemToTrack, removeItem, removeTrack, rippleRemoveItem,
  snapTargets, splitItem, trackWithRoomAt, trimItem, updateItem,
  type Asset, type EditorDoc, type EditorItem, type Track,
} from "@/lib/editor-doc";

/**
 * Timeline for a document-based project.
 *
 * Geometry, zoom, snapping and the keyboard map deliberately mirror
 * components/Timeline.tsx so the two editors feel the same. What differs is the
 * edit layer: every change here is a pure function over the document, so there
 * is no code to parse, no shape to refuse, and no read-only state to fall into.
 */

const LABEL_W = 168;
const RULER_H = 26;
/**
 * Track heights. The spec gives video 52 and audio 44.
 *
 * A Track in this model has no `kind` — it is just a list of items — so the
 * kind is inferred from what is on it. An audio-only track is the short one;
 * anything else gets the tall one, because a filmstrip needs the room.
 */
const TRACK_H_VIDEO = 52;
const TRACK_H_AUDIO = 44;
/** Clips sit 6px inside their lane, top and bottom. */
const CLIP_INSET = 6;
const SNAP_PX = 8;
const MAX_PX_PER_FRAME = 16;

type DragMode = "move" | "trim-left" | "trim-right";

interface DragState {
  itemId: string;
  mode: DragMode;
  originalFrom: number;
  originalDuration: number;
  startX: number;
  pxPerFrame: number;
  deltaFrames: number;
  targets: number[];
  snap: boolean;
}

export interface MediaFile {
  name: string;
  path: string;
  type: string;
}

interface Props {
  doc: EditorDoc;
  onChange: (next: EditorDoc) => void;
  onSeek?: (frame: number) => void;
  onScrubStart?: () => void;
  onTogglePlay?: () => void;
  /** Files in the project's media folder, offered by the insert picker. */
  mediaFiles?: MediaFile[];
  /** Source durations in seconds, keyed by the same `path` as mediaFiles. */
  mediaDurations?: Record<string, number>;
  projectId?: string;
  /** Selection is shared with the canvas, so it lives above both of them. */
  selectedIds: Set<string>;
  onSelectionChange: (next: Set<string>) => void;
  /**
   * Opens the "prompt an animation" dialog. Owned by the page, which has the
   * project's settings and commits the result; the rail only asks for it.
   */
  onPromptAnimation?: () => void;
  /** The shortcuts sheet is owned by the page, so Cmd+/ works without a timeline. */
  onShowShortcuts: () => void;
}

/**
 * Clips are NEUTRAL.
 *
 * They used to be saturated per-type hues, which made the timeline the
 * loudest thing on screen and left the footage — the actual content — reading
 * as background. In the handoff a footage clip is `surface-hover` and a title
 * clip is `surface-raised`, both with an edge; what tells them apart is the
 * filmstrip, the waveform and the label, which is information rather than
 * decoration.
 */
const ITEM_SURFACE: Record<string, string> = {
  video: "var(--surface-hover)",
  gif: "var(--surface-hover)",
  image: "var(--surface-hover)",
  audio: "var(--surface-raised)",
  text: "var(--surface-raised)",
  scene: "var(--surface-raised)",
  solid: "var(--surface-raised)",
  captions: "var(--surface-raised)",
};

const ITEM_ICONS: Record<string, string> = {
  video: "film", audio: "monitor", image: "layers", gif: "layers",
  text: "layers", solid: "layers", captions: "layers", scene: "layers",
};

export default function DocTimeline({
  doc, onChange, onSeek, onScrubStart, onTogglePlay,
  mediaFiles, mediaDurations, projectId, selectedIds, onSelectionChange,
  onPromptAnimation, onShowShortcuts,
}: Props) {
  const [zoom, setZoom] = useState(1);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [snapLine, setSnapLine] = useState<number | null>(null);
  const [snapOn, setSnapOn] = useState(true);
  const [containerWidth, setContainerWidth] = useState(900);
  const [pickerOpen, setPickerOpen] = useState(false);
  const toast = useToast();
  // Subscribes: the playhead line and the ruler repaint every frame.
  const currentFrame = usePlayheadFrame();
  const [captionsBusy, setCaptionsBusy] = useState<string | null>(null);
  // The same file list serves two jobs: dropping a clip on a track, and turning
  // a clip's speech into subtitles. Captions used to be reachable only as a
  // secondary button inside "Add media", which is not where anyone looks for
  // subtitles — so the rail asks for them directly and the list follows.
  const [pickerMode, setPickerMode] = useState<"insert" | "captions">("insert");
  const [clipboard, setClipboard] = useState<EditorItem | null>(null);
  /** Tool the pointer is over, so the rail can name it without a delay. */
  const [hoveredTool, setHoveredTool] = useState<string | null>(null);
  /** Track lane the pointer is over mid-drag, so a clip can be dropped onto another. */
  const [hoverTrack, setHoverTrack] = useState<number | null>(null);
  const hoverRef = useRef<number | null>(null);
  const tracksRef = useRef<HTMLDivElement>(null);
  /** Audio peaks per media path, fetched lazily and cached server-side too. */
  const [peaks, setPeaks] = useState<Record<string, number[]>>({});
  const [dropping, setDropping] = useState<number | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const deltaRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const { fps } = doc.size;
  const total = Math.max(1, docDuration(doc));

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setContainerWidth(el.clientWidth));
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const trackW = Math.max(120, containerWidth - LABEL_W - 8);
  const fitPx = trackW / total;
  const maxZoom = Math.max(2, Math.min(300, MAX_PX_PER_FRAME / Math.max(fitPx, 0.0001)));
  const pxPerFrame = fitPx * Math.min(zoom, maxZoom);
  const contentW = total * pxPerFrame;

  const commit = useCallback((next: EditorDoc) => onChange(next), [onChange]);

  // ── selection ─────────────────────────────────────────────────────────────
  const selectItem = useCallback((id: string, additive: boolean) => {
    if (!additive) { onSelectionChange(new Set([id])); return; }
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    onSelectionChange(next);
  }, [selectedIds, onSelectionChange]);
  const deselect = useCallback(() => onSelectionChange(new Set()), [onSelectionChange]);

  // ── scrubbing ─────────────────────────────────────────────────────────────
  const frameFromClientX = useCallback((clientX: number) => {
    const el = rulerRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left + (scrollRef.current?.scrollLeft ?? 0);
    return Math.max(0, Math.min(total - 1, Math.round(x / pxPerFrame)));
  }, [pxPerFrame, total]);

  const startScrub = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    onScrubStart?.();
    onSeek?.(frameFromClientX(e.clientX));
    const move = (ev: PointerEvent) => onSeek?.(frameFromClientX(ev.clientX));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, [frameFromClientX, onSeek, onScrubStart]);

  // ── dragging items ────────────────────────────────────────────────────────
  const beginDrag = useCallback((e: React.PointerEvent, item: EditorItem, mode: DragMode) => {
    e.stopPropagation();
    e.preventDefault();
    selectItem(item.id, e.shiftKey || e.metaKey || e.ctrlKey);
    deltaRef.current = 0;
    setDragState({
      itemId: item.id,
      mode,
      originalFrom: item.from,
      originalDuration: item.durationInFrames,
      startX: e.clientX,
      pxPerFrame,
      deltaFrames: 0,
      targets: snapTargets(doc, { excludeItemId: item.id, playhead: currentFrame }),
      snap: snapOn,
    });
  }, [doc, currentFrame, pxPerFrame, snapOn, selectItem]);

  useEffect(() => {
    if (!dragState) return;
    const s = dragState;
    function onMove(e: PointerEvent) {
      // Which lane is the pointer over? Lanes are a fixed height, stacked.
      if (s.mode === "move" && tracksRef.current) {
        const r = tracksRef.current.getBoundingClientRect();
        const idx = laneAt(e.clientY - r.top);
        const valid = idx !== null && idx < doc.tracks.length ? idx : null;
        hoverRef.current = valid;
        setHoverTrack(valid);
      }
      const raw = Math.round((e.clientX - s.startX) / s.pxPerFrame);
      let delta = raw;
      let snapped: number | null = null;
      if (s.snap) {
        const threshold = SNAP_PX / s.pxPerFrame;
        const edge = s.mode === "trim-right" ? s.originalFrom + s.originalDuration : s.originalFrom;
        const hit = snapFrame(edge + raw, s.targets, threshold);
        delta = hit.frame - edge;
        snapped = hit.snapped;
      }
      deltaRef.current = delta;
      setSnapLine(snapped);
      setDragState((prev) => (prev ? { ...prev, deltaFrames: delta } : prev));
    }
    function onUp() {
      const delta = deltaRef.current;
      const lane = hoverRef.current;
      setSnapLine(null);
      setDragState(null);
      setHoverTrack(null);
      hoverRef.current = null;

      if (s.mode === "move") {
        const current = findItem(doc, s.itemId);
        const target = lane != null ? doc.tracks[lane] : null;
        if (target && current && target.id !== current.track.id) {
          commit(moveItemToTrack(doc, s.itemId, target.id, s.originalFrom + delta));
          return;
        }
        if (delta !== 0) commit(moveItem(doc, s.itemId, delta));
        return;
      }
      if (delta !== 0) {
        commit(trimItem(doc, s.itemId, s.mode === "trim-left" ? "left" : "right", delta, fps));
      }
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragState, doc, fps, commit]);

  // ── actions ───────────────────────────────────────────────────────────────
  const splitAtPlayhead = useCallback(() => {
    const id = [...selectedIds][0];
    if (!id) return;
    commit(splitItem(doc, id, currentFrame, fps));
  }, [selectedIds, doc, currentFrame, fps, commit]);

  const deleteSelected = useCallback((ripple: boolean) => {
    if (selectedIds.size === 0) return;
    let next = doc;
    for (const id of selectedIds) next = ripple ? rippleRemoveItem(next, id) : removeItem(next, id);
    commit(next);
    deselect();
  }, [selectedIds, doc, commit, deselect]);

  // Keyboard map mirrors components/Timeline.tsx. Cmd/Ctrl combos are left alone
  // so the page-level undo/redo still reaches its handler.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.closest(".monaco-editor"))) return;
      // Cmd/Ctrl combos: handle the clipboard here, and let everything else
      // (notably undo/redo) fall through to the page.
      if (e.metaKey || e.ctrlKey) {
        const id = [...selectedIds][0];
        if (e.key === "c" && id) {
          const found = findItem(doc, id);
          if (found) { e.preventDefault(); setClipboard(found.item); }
        } else if (e.key === "d" && id) {
          e.preventDefault();
          commit(duplicateItem(doc, id));
        } else if (e.key === "v" && clipboard) {
          e.preventDefault();
          const home = findItem(doc, clipboard.id);
          const trackId = home?.track.id ?? doc.tracks[0]?.id;
          if (trackId) {
            const copy = cloneItem(clipboard, currentFrame);
            commit(addItem(doc, trackId, copy));
            onSelectionChange(new Set([copy.id]));
          }
        }
        return;
      }
      if (e.altKey) return;
      if (e.key === " ") { e.preventDefault(); onTogglePlay?.(); }
      else if (e.key === "f" || e.key === "F") { e.preventDefault(); setZoom(1); }
      else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteSelected(true); }
      else if (e.key === "s" || e.key === "S") { e.preventDefault(); splitAtPlayhead(); }
      else if (e.key === "Escape") deselect();
      else if (e.key === "ArrowLeft") { e.preventDefault(); onSeek?.(Math.max(0, currentFrame - (e.shiftKey ? 10 : 1))); }
      else if (e.key === "ArrowRight") { e.preventDefault(); onSeek?.(Math.min(total - 1, currentFrame + (e.shiftKey ? 10 : 1))); }
      else if (e.key === "Home") { e.preventDefault(); onSeek?.(0); }
      else if (e.key === "End") { e.preventDefault(); onSeek?.(total - 1); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentFrame, total, onSeek, onTogglePlay, deleteSelected, splitAtPlayhead, deselect,
      doc, selectedIds, clipboard, commit, onSelectionChange]);

  // ⌘/Ctrl-scroll to zoom, matching the other timeline.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      setZoom((z) => Math.max(1, Math.min(maxZoom, z * (e.deltaY < 0 ? 1.12 : 0.89))));
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [maxZoom]);

  /** Add a media file to a track at the playhead, registering its asset once. */
  const insertMedia = useCallback((file: MediaFile, trackId: string, atFrame?: number) => {
    const src = `/api/media/${projectId}/${file.path}`;
    const existing = doc.assets.find((a) => a.src === src);
    const kind: Asset["kind"] = file.type === "audio" ? "audio" : file.type === "image" ? "image" : "video";
    const durationSec = mediaDurations?.[file.path];
    const asset: Asset = existing ?? {
      id: makeId("asset"), kind, src, name: file.name, durationSec,
    };
    const frames = Math.max(1, Math.round((durationSec ?? 5) * fps));
    const item = {
      type: kind === "audio" ? "audio" : kind === "image" ? "image" : "video",
      id: makeId(kind),
      from: atFrame ?? currentFrame,
      durationInFrames: frames,
      layout: { x: 0, y: 0, width: doc.size.width, height: doc.size.height },
      assetId: asset.id,
      ...(kind === "video" || kind === "audio" ? { sourceIn: 0, sourceOut: durationSec } : {}),
    } as EditorItem;
    const withAsset = existing ? doc : { ...doc, assets: [...doc.assets, asset] };
    const at = atFrame ?? currentFrame;
    // Prefer the track asked for, but don't shunt the clip to the end of the
    // video just because that track is busy where the playhead is.
    const host = hasRoomAt(withAsset.tracks.find((t) => t.id === trackId)!, at, frames)
      ? { doc: withAsset, trackId }
      : trackWithRoomAt(withAsset, at, frames);
    commit(addItem(host.doc, host.trackId, item));
    setPickerOpen(false);
  }, [doc, projectId, mediaDurations, fps, currentFrame, commit]);

  /**
   * Add a text or solid layer on the first track, two seconds long, at the
   * playhead. Text defaults to Inter — the only licensed face besides GT
   * Walsheim, so the font picker must not widen beyond those plus Google Fonts.
   */
  const addLayer = useCallback((kind: "text" | "solid") => {
    const w = Math.round(doc.size.width * 0.6);
    const h = Math.round(doc.size.height * 0.18);
    const layout = {
      x: Math.round((doc.size.width - w) / 2),
      y: Math.round((doc.size.height - h) / 2),
      width: w,
      height: h,
    };
    const common = { id: makeId(kind), from: currentFrame, durationInFrames: fps * 2, layout };
    const item = kind === "text"
      ? { ...common, type: "text" as const, text: "New text", style: { fontFamily: "Inter, sans-serif", fontSize: Math.round(doc.size.height * 0.09), fontWeight: 700, color: "#F4F4F5", align: "center" as const } }
      : { ...common, type: "solid" as const, color: "#F86606" };
    // Land under the playhead, adding a track if every existing one is busy there.
    const { doc: host, trackId } = trackWithRoomAt(doc, currentFrame, fps * 2);
    commit(addItem(host, trackId, item as EditorItem));
    onSelectionChange(new Set([common.id]));
  }, [doc, currentFrame, fps, commit, onSelectionChange]);

  /**
   * Transcribe a media file and drop its words in as a captions layer.
   *
   * Token times come back relative to the FILE, and a captions item stores times
   * relative to ITSELF, so they are rebased to the first spoken word. That is
   * what lets the finished layer be dragged anywhere on the timeline without the
   * words drifting out of sync.
   */
  const addCaptions = useCallback(async (file: MediaFile) => {
    setCaptionsBusy(file.path);
    try {
      const res = await fetch(`/api/captions/${projectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: file.path }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Transcription failed");
      const { tokens } = (await res.json()) as { tokens: { text: string; startSec: number; endSec: number }[] };
      if (!tokens?.length) throw new Error("No speech found");

      const base = tokens[0].startSec;
      const rebased = tokens.map((t) => ({ ...t, startSec: t.startSec - base, endSec: t.endSec - base }));
      const spanSec = rebased[rebased.length - 1].endSec;
      const trackId = doc.tracks[doc.tracks.length - 1].id;
      const height = Math.round(doc.size.height * 0.22);
      const item = {
        type: "captions" as const,
        id: makeId("captions"),
        from: currentFrame,
        durationInFrames: Math.max(1, Math.round(spanSec * fps)),
        layout: {
          x: Math.round(doc.size.width * 0.08),
          y: Math.round(doc.size.height - height - doc.size.height * 0.08),
          width: Math.round(doc.size.width * 0.84),
          height,
        },
        tokens: rebased,
        style: {
          fontFamily: "Inter, sans-serif",
          fontSize: Math.round(doc.size.height * 0.058),
          fontWeight: 700,
          color: "#F4F4F5",
          align: "center" as const,
        },
        highlightColor: "#F86606",
        pageDurationMs: 1200,
        maxWordsPerPage: 6,
      };
      commit(addItem(doc, trackId, item as EditorItem));
      onSelectionChange(new Set([item.id]));
      setPickerOpen(false);
    } catch (e) {
      // What happened, what it cost, what to do next.
      toast.error(
        "Couldn't transcribe that clip",
        e instanceof Error ? e.message : "No subtitles were added.",
        [{ label: "Try again", onClick: () => { void addCaptions(file); } }],
      );
    } finally {
      setCaptionsBusy(null);
    }
  }, [doc, projectId, currentFrame, fps, commit, onSelectionChange]);

  /**
   * Read a media file's length in the browser. Newly uploaded files aren't in the
   * ffprobe cache yet, and a hidden media element answers this in milliseconds
   * without troubling the server.
   */
  const readDuration = useCallback((src: string, kind: "video" | "audio") => {
    return new Promise<number | undefined>((resolve) => {
      const el = document.createElement(kind === "audio" ? "audio" : "video");
      const done = (v: number | undefined) => { el.removeAttribute("src"); resolve(v); };
      el.preload = "metadata";
      el.onloadedmetadata = () => done(Number.isFinite(el.duration) ? el.duration : undefined);
      el.onerror = () => done(undefined);
      window.setTimeout(() => done(undefined), 8000);
      el.src = src;
    });
  }, []);

  /**
   * Drop files from the desktop straight onto a track: upload into the project's
   * media folder, then place them where they landed.
   */
  const handleDrop = useCallback(async (files: File[], trackId: string, atFrame: number) => {
    if (!projectId || files.length === 0) return;
    let next = doc;
    let cursor = atFrame;
    for (const file of files) {
      setUploading(file.name);
      try {
        const res = await fetch(
          `/api/media/${projectId}/upload?name=${encodeURIComponent(file.name)}`,
          { method: "POST", body: file },
        );
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Upload failed");

        const src = `/api/media/${projectId}/${file.name}`;
        const kind: Asset["kind"] = file.type.startsWith("audio")
          ? "audio"
          : file.type.startsWith("image")
            ? "image"
            : "video";
        const durationSec = kind === "image" ? undefined : await readDuration(src, kind);
        const asset: Asset = { id: makeId("asset"), kind, src, name: file.name, durationSec };
        const frames = Math.max(1, Math.round((durationSec ?? 3) * fps));
        const item = {
          type: kind === "audio" ? "audio" : kind === "image" ? "image" : "video",
          id: makeId(kind),
          from: cursor,
          durationInFrames: frames,
          layout: { x: 0, y: 0, width: doc.size.width, height: doc.size.height },
          assetId: asset.id,
          ...(kind === "video" || kind === "audio" ? { sourceIn: 0, sourceOut: durationSec } : {}),
        } as EditorItem;
        next = addItem({ ...next, assets: [...next.assets, asset] }, trackId, item);
        cursor += frames;
      } catch (e) {
        toast.error(
          `Couldn't import ${file.name}`,
          e instanceof Error ? e.message : "It wasn't added to the timeline.",
        );
      }
    }
    setUploading(null);
    if (next !== doc) commit(next);
  }, [doc, projectId, fps, commit, readDuration]);

  /** Media path relative to the project's media folder, as the API expects. */
  const relPath = useCallback(
    (src: string) => src.replace(`/api/media/${projectId}/`, ""),
    [projectId],
  );

  // Pull peaks for every audio clip on screen. The server caches them beside the
  // media, so this is a one-off cost per file and instant afterwards.
  useEffect(() => {
    if (!projectId) return;
    const wanted = new Set<string>();
    for (const track of doc.tracks) {
      for (const item of track.items) {
        if (item.type !== "audio") continue;
        const asset = getAsset(doc, item.assetId);
        if (asset?.src.startsWith(`/api/media/${projectId}/`)) wanted.add(relPath(asset.src));
      }
    }
    for (const file of wanted) {
      if (peaks[file]) continue;
      fetch(`/api/media/${projectId}/peaks?file=${encodeURIComponent(file)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (Array.isArray(d?.peaks)) setPeaks((prev) => ({ ...prev, [file]: d.peaks }));
        })
        .catch(() => {});
    }
  }, [doc, projectId, peaks, relPath]);

  // ── rendering ─────────────────────────────────────────────────────────────
  /**
   * Ruler ticks every 50 frames — 2s at 25fps — per the spec.
   *
   * Multiplied up when zoomed out, or a long project draws thousands of ticks
   * into a few hundred pixels and the labels become a grey smear.
   */
  const hoursNeeded = needsHours(total, fps);

  const ticks = useMemo(() => {
    let step = 50;
    while (step * pxPerFrame < 60) step *= 2;
    const out: number[] = [];
    for (let f = 0; f <= total; f += step) out.push(f);
    return out;
  }, [pxPerFrame, total]);

  /**
   * The selected clip's animated channels, as timeline lanes.
   *
   * This is the third view onto the keyframe model — the diamonds say a
   * property is animated, the inspector strip says where its keys are within
   * the clip, and these put them on the same ruler as everything else, so you
   * can see a key land against a cut.
   */
  const keyLanes = useMemo(() => {
    if (selectedIds.size !== 1) return null;
    const id = [...selectedIds][0];
    const found = findItem(doc, id);
    if (!found?.item.keys) return null;
    const channels = (Object.keys(found.item.keys) as ChannelId[])
      .filter((c) => (found.item.keys?.[c]?.length ?? 0) > 0);
    if (channels.length === 0) return null;
    return { trackId: found.track.id, item: found.item, channels };
  }, [doc, selectedIds]);

  const LANE_H = 28;

  /**
   * "V2" / "A1" — the editor convention. Video tracks count UP from the bottom
   * because later tracks render in front, which is the order the eye reads a
   * stack in.
   */
  const trackKindLabel = useCallback((t: Track, index: number) => {
    const audio = t.items.length > 0 && t.items.every((i) => i.type === "audio");
    const kind = audio ? "A" : "V";
    const peers = doc.tracks.filter((x) => {
      const a = x.items.length > 0 && x.items.every((i) => i.type === "audio");
      return (a ? "A" : "V") === kind;
    });
    return `${kind}${peers.length - peers.indexOf(t)}`;
  }, [doc.tracks]);

  /** A track's height, from what is on it. */
  const trackHeight = useCallback((t: Track) =>
    t.items.length > 0 && t.items.every((i) => i.type === "audio") ? TRACK_H_AUDIO : TRACK_H_VIDEO,
  []);

  /**
   * Cumulative lane offsets, for hit-testing a drag.
   *
   * This used to be `floor(y / TRACK_H)`, which only works while every lane is
   * the same height. With per-kind heights that divide silently drops clips on
   * the wrong track, so the offsets are computed instead.
   */
  const laneTops = useMemo(() => {
    const out: number[] = [];
    let y = 0;
    for (const t of doc.tracks) {
      out.push(y);
      y += trackHeight(t);
      // Property lanes push everything below them down; leaving them out of
      // this is the same class of bug as dividing by a fixed track height.
      if (keyLanes && keyLanes.trackId === t.id) y += keyLanes.channels.length * LANE_H;
    }
    out.push(y);
    return out;
  }, [doc.tracks, trackHeight, keyLanes]);

  const laneAt = useCallback((y: number) => {
    for (let i = 0; i < laneTops.length - 1; i++) {
      if (y >= laneTops[i] && y < laneTops[i + 1]) return i;
    }
    return null;
  }, [laneTops]);

  const previewGeom = (item: EditorItem) => {
    if (!dragState || dragState.itemId !== item.id) return { from: item.from, dur: item.durationInFrames };
    const d = dragState.deltaFrames;
    if (dragState.mode === "move") return { from: Math.max(0, dragState.originalFrom + d), dur: dragState.originalDuration };
    if (dragState.mode === "trim-right") return { from: dragState.originalFrom, dur: Math.max(1, dragState.originalDuration + d) };
    return { from: dragState.originalFrom + d, dur: Math.max(1, dragState.originalDuration - d) };
  };

  const renderTrack = (track: Track, laneIndex: number) => (
    <React.Fragment key={track.id}>
    <div
      style={{
        display: "flex", height: trackHeight(track), borderBottom: "1px solid var(--border-hairline)",
        background: hoverTrack === laneIndex && dragState?.mode === "move" ? "var(--surface-raised)" : undefined,
      }}
    >
      <div
        style={{
          width: LABEL_W, flexShrink: 0, display: "flex", alignItems: "center", gap: 5,
          padding: "0 6px", borderRight: "1px solid var(--border-hairline)", background: "var(--surface-chrome)",
        }}
      >
        {/* Kind then name — "V2  Footage" — so a glance down the column tells
            you the stack order and what is on each layer. The kind is derived:
            tracks render back to front, and an audio-only track is A. */}
        <span className="t-section" style={{ color: "var(--ink-tertiary)", flexShrink: 0 }}>
          {trackKindLabel(track, laneIndex)}
        </span>
        <span className="t-control" style={{ color: "var(--ink-secondary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {track.name}
        </span>
        <button
          aria-label={track.hidden ? "Show track" : "Hide track"}
          onClick={() => commit({ ...doc, tracks: doc.tracks.map((t) => (t.id === track.id ? { ...t, hidden: !t.hidden } : t)) })}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 1 }}
        >
          <Icon
            name={track.hidden ? "eyeOff" : "eye"}
            size={12}
            style={{ color: track.hidden ? "var(--ink-disabled)" : "var(--ink-secondary)" }}
          />
        </button>
        <button
          aria-label={track.muted ? "Unmute track" : "Mute track"}
          onClick={() => commit({ ...doc, tracks: doc.tracks.map((t) => (t.id === track.id ? { ...t, muted: !t.muted } : t)) })}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 1 }}
        >
          <Icon
            name={track.muted ? "speakerOff" : "speaker"}
            size={12}
            style={{ color: track.muted ? "var(--ink-disabled)" : "var(--ink-secondary)" }}
          />
        </button>
        {doc.tracks.length > 1 && (
          <button
            aria-label="Remove track"
            onClick={() => commit(removeTrack(doc, track.id))}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 1 }}
          >
            <Icon name="trash" size={11} style={{ color: "var(--ink-disabled)" }} />
          </button>
        )}
      </div>

      <div
        style={{
          position: "relative", width: contentW, flexShrink: 0,
          outline: dropping === laneIndex ? "1px dashed var(--brand-tint-line)" : undefined,
          outlineOffset: -2,
        }}
        onPointerDown={deselect}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("application/x-vt-effect")) return;
          e.preventDefault();
          setDropping(laneIndex);
        }}
        onDragLeave={() => setDropping((d) => (d === laneIndex ? null : d))}
        onDrop={(e) => {
          e.preventDefault();
          setDropping(null);
          const rect = e.currentTarget.getBoundingClientRect();
          const frame = Math.max(0, Math.round((e.clientX - rect.left) / pxPerFrame));

          // A tile dragged out of the footage browser is already uploaded.
          const tile = e.dataTransfer?.getData("application/x-vt-media");
          if (tile) {
            try { insertMedia(JSON.parse(tile) as MediaFile, track.id, frame); } catch {}
            return;
          }
          const files = Array.from(e.dataTransfer?.files ?? []);
          if (files.length === 0) return;
          void handleDrop(files, track.id, frame);
        }}
      >
        {track.items.map((item) => {
          const g = previewGeom(item);
          const selected = selectedIds.has(item.id);
          const asset = "assetId" in item ? getAsset(doc, (item as { assetId: string }).assetId) : undefined;
          const label = item.type === "text" ? (item as { text: string }).text : asset?.name ?? item.type;
          const clipW = Math.max(2, g.dur * pxPerFrame);

          // Filmstrip: map the clip's source window onto the strip image.
          let strip: { url: string; widthPx: number; offsetPx: number } | null = null;
          if (item.type === "video" && asset?.durationSec && projectId && asset.src.startsWith(`/api/media/${projectId}/`)) {
            const inSec = (item as { sourceIn?: number }).sourceIn ?? 0;
            const outSec = (item as { sourceOut?: number }).sourceOut ?? asset.durationSec;
            const frac = Math.max(0.0001, (outSec - inSec) / asset.durationSec);
            const widthPx = clipW / frac;
            strip = {
              url: `/api/media/${projectId}/filmstrip?file=${encodeURIComponent(relPath(asset.src))}`,
              widthPx,
              offsetPx: (inSec / asset.durationSec) * widthPx,
            };
          }

          // Waveform: slice the peaks to the same source window.
          let wave: number[] | null = null;
          if (item.type === "audio" && asset?.durationSec && projectId) {
            const all = peaks[relPath(asset.src)];
            if (all?.length) {
              const inSec = (item as { sourceIn?: number }).sourceIn ?? 0;
              const outSec = (item as { sourceOut?: number }).sourceOut ?? asset.durationSec;
              const a0 = Math.floor((inSec / asset.durationSec) * all.length);
              const a1 = Math.ceil((outSec / asset.durationSec) * all.length);
              wave = all.slice(Math.max(0, a0), Math.min(all.length, Math.max(a0 + 2, a1)));
            }
          }
          return (
            <div
              key={item.id}
              onPointerDown={(e) => beginDrag(e, item, "move")}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes("application/x-vt-effect")) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
              onDrop={(e) => {
                const preset = e.dataTransfer.getData("application/x-vt-effect") as AnimationPreset;
                if (!preset) return;
                e.preventDefault();
                e.stopPropagation();
                // Dropping on the left half sets the entrance, the right half the exit.
                const rect = e.currentTarget.getBoundingClientRect();
                const edge = e.clientX - rect.left < rect.width / 2 ? "animateIn" : "animateOut";
                const spec = preset === "none" ? undefined : { preset, durationInFrames: Math.min(12, item.durationInFrames) };
                commit(updateItem(doc, item.id, { [edge]: spec }));
                onSelectionChange(new Set([item.id]));
              }}
              style={{
                position: "absolute", left: g.from * pxPerFrame, width: clipW,
                top: CLIP_INSET, height: trackHeight(track) - CLIP_INSET * 2, borderRadius: "var(--r-item)", cursor: "grab",
                background: ITEM_SURFACE[item.type] ?? "var(--surface-raised)",
                border: "1px solid var(--border-edge)",
                opacity: track.hidden ? 0.35 : 0.9,
                outline: selected ? "1px solid var(--ink-primary)" : "none",
                display: "flex", alignItems: "center", gap: 4, padding: "0 6px", overflow: "hidden",
              }}
            >
              {strip && (
                <div
                  aria-hidden
                  style={{
                    position: "absolute", inset: 0, borderRadius: 3, opacity: 0.8,
                    backgroundImage: `url(${strip.url})`,
                    backgroundRepeat: "no-repeat",
                    // The strip covers the WHOLE source file; show only the window
                    // this clip is trimmed to, so the thumbnails under a trimmed
                    // clip are the frames it actually plays.
                    backgroundSize: `${strip.widthPx}px 100%`,
                    backgroundPosition: `${-strip.offsetPx}px center`,
                  }}
                />
              )}
              {wave && (
                /*
                 * Bars, not an outline. Two mirrored polylines read as a shape
                 * with a hole in it at clip size; discrete bars read as level.
                 *
                 * Amplitude is capped to the lane's inner box so a loud passage
                 * crops flat instead of bleeding past the clip's rounded edge.
                 */
                <div
                  aria-hidden
                  style={{
                    position: "absolute", inset: 0, display: "flex", alignItems: "center",
                    gap: 2, padding: "0 2px", opacity: 0.55, pointerEvents: "none",
                  }}
                >
                  {wave.map((v, i) => (
                    <span
                      key={i}
                      style={{
                        flex: "1 1 2px", maxWidth: 3, borderRadius: 1,
                        height: `${Math.min(100, Math.max(12, v * 100))}%`,
                        background: "var(--ink-tertiary)",
                      }}
                    />
                  ))}
                </div>
              )}
              <Icon name={ITEM_ICONS[item.type] ?? "layers"} size={11} style={{ color: "var(--ink-tertiary)", flexShrink: 0, position: "relative" }} />
              <span className="t-control" style={{ color: "var(--ink-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", position: "relative" }}>
                {label}
              </span>
              <div
                onPointerDown={(e) => beginDrag(e, item, "trim-left")}
                style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 6, cursor: "ew-resize" }}
              />
              <div
                onPointerDown={(e) => beginDrag(e, item, "trim-right")}
                style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 6, cursor: "ew-resize" }}
              />
            </div>
          );
        })}
      </div>
    </div>

    {/* Property lanes for the selected clip — the keyframe model's third view,
        on the same ruler as the cuts. */}
    {keyLanes && keyLanes.trackId === track.id && keyLanes.channels.map((ch) => {
      const keys = keyLanes.item.keys![ch] ?? [];
      const info = CHANNELS_BY_ID[ch];
      return (
        <div key={ch} style={{ display: "flex", height: LANE_H, borderBottom: "1px solid var(--border-hairline)" }}>
          <div
            style={{
              width: LABEL_W, flexShrink: 0, display: "flex", alignItems: "center",
              paddingLeft: 26, borderRight: "1px solid var(--border-hairline)",
              background: "var(--surface-chrome)",
            }}
          >
            <span className="t-caption" style={{ color: "var(--ink-secondary)" }}>{info?.label ?? ch}</span>
          </div>
          <div style={{ position: "relative", width: contentW, background: "rgba(244,244,245,0.02)" }}>
            {keys.length > 1 && (
              <div
                style={{
                  position: "absolute", top: "50%", height: 1,
                  left: (keyLanes.item.from + keys[0].frame) * pxPerFrame,
                  width: Math.max(0, (keys[keys.length - 1].frame - keys[0].frame) * pxPerFrame),
                  background: "var(--surface-active)",
                }}
              />
            )}
            {keys.map((k) => (
              <span
                key={k.frame}
                title={`${info?.label ?? ch} · ${k.value}`}
                style={{
                  position: "absolute", top: "50%", marginTop: -4.5, marginLeft: -4.5,
                  left: (keyLanes.item.from + k.frame) * pxPerFrame,
                  width: 9, height: 9, transform: "rotate(45deg)",
                  background: "var(--ink-primary)",
                }}
              />
            ))}
          </div>
        </div>
      );
    })}
    </React.Fragment>
  );

  // `shortcut` strings here must match the shortcuts sheet exactly — same
  // strings by contract, so the sheet can never advertise something untrue.
  const tools: { id: string; icon: string; label: string; shortcut?: string; onClick: () => void; disabled?: boolean }[] = [
    { id: "media", icon: "folder", label: "Add media", onClick: () => { setPickerMode("insert"); setPickerOpen((v) => (pickerMode === "insert" ? !v : true)); } },
    { id: "captions", icon: "subtitles", label: "Add subtitles from speech", onClick: () => { setPickerMode("captions"); setPickerOpen((v) => (pickerMode === "captions" ? !v : true)); } },
    ...(onPromptAnimation
      ? [{ id: "prompt", icon: "sparkle", label: "Prompt an animation", onClick: onPromptAnimation }]
      : []),
    { id: "text", icon: "type", label: "Add text", onClick: () => addLayer("text") },
    { id: "solid", icon: "square", label: "Add solid", onClick: () => addLayer("solid") },
    { id: "track", icon: "rows", label: "Add track", onClick: () => commit(addTrack(doc)) },
    { id: "split", icon: "scissors", label: "Split at playhead", shortcut: "S", onClick: splitAtPlayhead, disabled: selectedIds.size !== 1 },
    { id: "delete", icon: "trash", label: "Delete selected", shortcut: "⌫", onClick: () => deleteSelected(true), disabled: selectedIds.size === 0 },
  ];

  const rail = (
    // Tools down the left, as in Premiere: icon only, named on hover. Keeping
    // them out of the timeline's own header means the header can be about the
    // timeline's state (snap, zoom, playhead) rather than a row of buttons.
    //
    // The naming uses the shared Tooltip; this used to be a fourth hand-rolled
    // hover label, which is three too many.
    <div
      style={{
        width: 34, flexShrink: 0, display: "flex", flexDirection: "column",
        alignItems: "center", gap: 2, padding: "6px 0",
        borderRight: "1px solid var(--border-hairline)", background: "var(--surface-chrome)",
        position: "relative", zIndex: 6,
      }}
      onPointerLeave={() => setHoveredTool(null)}
    >
      {tools.map((t) => (
        <Tooltip key={t.id} label={t.label} shortcut={t.shortcut} placement="bottom">
          <button
            onClick={t.onClick}
            disabled={t.disabled}
            aria-label={t.label}
            onPointerEnter={() => setHoveredTool(t.id)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 26, height: 26, borderRadius: "var(--r-control)", padding: 0,
              background: hoveredTool === t.id && !t.disabled ? "var(--surface-hover)" : "transparent",
              border: "none", cursor: t.disabled ? "default" : "pointer",
            }}
          >
            <Icon
              name={t.icon}
              size={14}
              style={{ color: t.disabled ? "var(--ink-disabled)" : "var(--ink-secondary)" }}
            />
          </button>
        </Tooltip>
      ))}
    </div>
  );

  return (
    // `user-select: none` matters here: the ruler's tick labels are ordinary
    // text, so dragging the playhead across them selected them — and since
    // globals.css paints ::selection with the accent colour, that read as the
    // timeline lighting up green rather than as a stray selection.
    <div style={{ display: "flex", height: "100%", minHeight: 0, background: "var(--surface-void)", userSelect: "none" }}>
      {rail}
      <div
        ref={wrapRef}
        style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}
      >
      {/* Status strip — the tools themselves live in the rail on the left. */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderBottom: "1px solid var(--border-hairline)" }}>
        <span className="t-section" style={{ color: "var(--ink-tertiary)" }}>Timeline</span>
        {uploading && (
          <span className="mono" style={{ fontSize: 9, color: "var(--live)" }}>
            uploading {uploading}…
          </span>
        )}
        <div style={{ flex: 1 }} />
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Toggle size="chrome" checked={snapOn} onChange={setSnapOn} label="Snap to frames" />
          <span className="t-control" style={{ color: snapOn ? "var(--ink-primary)" : "var(--ink-tertiary)" }}>Snap</span>
        </span>
        <button onClick={() => setZoom(1)} style={toolBtn}>Fit</button>
        <IconButton icon="help" size={22} title="Keyboard shortcuts" shortcut="⌘/" onClick={onShowShortcuts} />
        <span className="mono nums" style={{ fontSize: 9, color: "var(--ink-disabled)" }}>
          {Math.floor(currentFrame / fps / 60).toString().padStart(2, "0")}:
          {Math.floor((currentFrame / fps) % 60).toString().padStart(2, "0")}.
          {Math.floor(currentFrame % fps).toString().padStart(2, "0")}
        </span>
      </div>

      {pickerOpen && (
        <div style={{ padding: 8, borderBottom: "1px solid var(--border-hairline)", background: "var(--surface-chrome)", maxHeight: 140, overflowY: "auto" }}>
          {pickerMode === "captions" && (
            <div style={{ fontSize: 10, color: "var(--ink-disabled)", marginBottom: 6 }}>
              Pick a clip to transcribe. Its words land as an editable subtitle layer at the playhead.
            </div>
          )}
          {(() => {
            const shown = (mediaFiles ?? []).filter(
              (f) => pickerMode === "insert" || f.type === "video" || f.type === "audio",
            );
            return shown.length === 0 ? (
            <div style={{ fontSize: 11, color: "var(--ink-disabled)" }}>
              {pickerMode === "captions" ? "No video or audio in this project to transcribe." : "No media in this project yet."}
            </div>
          ) : (
            shown.map((f) => (
              <div key={f.path} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>
                <span className="mono" style={{ fontSize: 10, color: "var(--ink-secondary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {f.name}
                </span>
                {pickerMode === "insert" && doc.tracks.map((t) => (
                  <button key={t.id} onClick={() => insertMedia(f, t.id)} style={toolBtn}>
                    → {t.name}
                  </button>
                ))}
                {(f.type === "video" || f.type === "audio") && (
                  <button
                    onClick={() => addCaptions(f)}
                    disabled={captionsBusy !== null}
                    style={{ ...toolBtn, color: "var(--ink-secondary)" }}
                  >
                    {captionsBusy === f.path ? "transcribing…" : pickerMode === "captions" ? "add subtitles" : "subtitles"}
                  </button>
                )}
              </div>
            ))
          );
          })()}
        </div>
      )}

      <div ref={scrollRef} style={{ flex: 1, overflowX: "auto", overflowY: "auto", minHeight: 0, position: "relative" }}>
        <div style={{ display: "flex", width: LABEL_W + contentW }}>
          <div style={{ width: LABEL_W, flexShrink: 0, height: RULER_H, borderRight: "1px solid var(--border-hairline)", borderBottom: "1px solid var(--border-hairline)", background: "var(--surface-chrome)" }} />
          <div
            ref={rulerRef}
            onPointerDown={startScrub}
            style={{ position: "relative", width: contentW, height: RULER_H, borderBottom: "1px solid var(--border-hairline)", cursor: "ew-resize", background: "var(--surface-chrome)" }}
          >
            {ticks.map((f) => (
              <div key={f} style={{ position: "absolute", left: f * pxPerFrame, top: 0, bottom: 0, borderLeft: "1px solid var(--border-hairline)", paddingLeft: 3 }}>
                <span className="t-data-s" style={{ color: "var(--ink-disabled)" }}>{timecode(f, fps, hoursNeeded)}</span>
              </div>
            ))}
          </div>
        </div>

        <div ref={tracksRef} style={{ width: LABEL_W + contentW }}>
          {doc.tracks.map((t, i) => renderTrack(t, i))}
        </div>

        {/* playhead + snap guide, spanning ruler and tracks */}
        {/* The playhead: 1px live line, with a 9x9 square head on the ruler.
            The head is what you aim at when scrubbing — a bare 1px line is
            almost impossible to grab. */}
        <div style={{ position: "absolute", left: LABEL_W + currentFrame * pxPerFrame, top: 0, bottom: 0, width: 1, background: "var(--live)", pointerEvents: "none", zIndex: 5 }}>
          <span
            style={{
              position: "absolute", top: 0, left: -4, width: 9, height: 9,
              background: "var(--live)", borderRadius: 1,
            }}
          />
        </div>
        {snapLine != null && (
          <div style={{ position: "absolute", left: LABEL_W + snapLine * pxPerFrame, top: 0, bottom: 0, width: 1, background: "var(--ink-primary)", opacity: 0.5, pointerEvents: "none", zIndex: 4 }} />
        )}
        </div>
      </div>

    </div>
  );
}


const toolBtn: React.CSSProperties = {
  background: "var(--surface-raised)",
  border: "1px solid var(--border-hairline)",
  borderRadius: 3,
  color: "var(--ink-secondary)",
  fontSize: 10,
  padding: "2px 7px",
  cursor: "pointer",
};
