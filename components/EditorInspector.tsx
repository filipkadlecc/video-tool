"use client";

import React, { useState } from "react";
import ScrubNumber from "@/components/ui/ScrubNumber";
import Icon from "@/components/ui/Icon";
import IconButton from "@/components/ui/IconButton";
import Toggle from "@/components/ui/Toggle";
import Slider from "@/components/ui/Slider";
import Select from "@/components/ui/Select";
import Tabs from "@/components/ui/Tabs";
import Menu from "@/components/ui/Menu";
import {
  findItem, hasSource, setLayout, updateItem, docDuration,
  evenSpacing, evenSpacingGap, sameDuration, pasteEffects, itemLabel, renameItem,
  type AudioItem, type CaptionsItem, type EditorDoc, type EditorItem,
  type TextItem, type VideoItem,
} from "@/lib/editor-doc";
import {
  itemEffects, presetsFor, setEffectPreset,
  type AnimationPreset, type Effect,
} from "@/lib/editor-effects";
import { timecode, needsHours, frameCount } from "@/lib/timecode";
import {
  setItemKey, removeItemKey, enableChannel, disableChannel, itemLayoutAt,
} from "@/lib/editor-doc";
import {
  isAnimated, keyAt, valueAt, CHANNELS_BY_ID, channelsFor,
  type ChannelId, type Keyframe,
} from "@/lib/editor-keys";
import { usePlayheadFrame } from "@/hooks/usePlayhead";
import GradeSection from "@/components/inspector/GradeSection";
import AddEffectPopover from "@/components/inspector/AddEffectPopover";

/**
 * The inspector, as a STACK OF EFFECT SECTIONS.
 *
 * Every section is independently collapsible, switchable and resettable, and
 * every property row follows one grid:
 *
 *     72px  |  minmax(0,1fr)  |  20px  |  20px
 *     label |  the control    | keyframe | reset
 *
 * The reset slot is what makes "what have I touched" readable at a glance —
 * it is `ink-tertiary` and clickable when a value is off its default, and
 * `ink-faint` when it isn't.
 *
 * The keyframe slot is deliberately EMPTY for now. An empty slot means "not
 * animatable", which is honest while the document model has no keyframes; when
 * it does, these become diamonds. A dead diamond would be worse than none.
 *
 * Switching a section OFF collapses it, greys the title, marks it "bypassed"
 * and KEEPS all its values — that is how you A/B an effect.
 */

/* ───────────────────────── row primitives ───────────────────────── */

/**
 * The keyframe diamond — an 8x8 square rotated 45 degrees.
 *
 *   filled            this property is animated
 *   outline           animatable, not yet animated
 *   (no slot at all)  not animatable — a blend mode gets no diamond rather
 *                     than a dead one
 *
 * When the playhead sits exactly on a key the slot gets a faint rounded
 * background, so "there is a key here" is readable without counting pixels.
 *
 * A row can own several channels (Position is x AND y); one diamond keys them
 * together, which is what makes the row the unit you think in.
 */
function Diamond({
  doc, item, channels, localFrame, onChange,
}: {
  doc: EditorDoc;
  item: EditorItem;
  channels: ChannelId[];
  localFrame: number;
  onChange: (next: EditorDoc) => void;
}) {
  const animated = channels.some((c) => isAnimated(item, c));
  const onAKey = animated && channels.every((c) => keyAt(item.keys?.[c], localFrame));

  const click = () => {
    let next = doc;
    if (!animated) {
      // Key every channel in the row at its CURRENT value, so nothing moves.
      for (const c of channels) next = enableChannel(next, item.id, c, localFrame);
    } else if (onAKey) {
      for (const c of channels) next = removeItemKey(next, item.id, c, localFrame);
    } else {
      // Add a key at the interpolated value — visually a no-op, which is the
      // point: you are marking this moment, not changing it.
      for (const c of channels) {
        const cur = valueAt(item.keys?.[c], localFrame, itemLayoutAt(item, item.from + localFrame)[c as "opacity"] ?? 0, CHANNELS_BY_ID[c]);
        next = setItemKey(next, item.id, c, localFrame, cur);
      }
    }
    onChange(next);
  };

  return (
    <button
      onClick={click}
      title={animated ? (onAKey ? "Remove this keyframe" : "Add a keyframe here") : "Animate this property"}
      style={{
        width: 20, height: 20, display: "grid", placeItems: "center", padding: 0,
        background: onAKey ? "rgba(244,244,245,0.1)" : "transparent",
        border: "none", borderRadius: "var(--r-control)", cursor: "pointer",
      }}
    >
      <span
        style={{
          width: 8, height: 8, transform: "rotate(45deg)",
          background: animated ? "var(--ink-primary)" : "transparent",
          border: animated ? "none" : "1.5px solid var(--ink-disabled)",
        }}
      />
    </button>
  );
}

/**
 * The inline keyframe strip, shown under an animated row.
 *
 * Indented to line up under the CONTROL rather than the label, so the keys sit
 * beneath the value they belong to. This is the second of the three views onto
 * the same data — the diamonds say THAT a property is animated, this says WHERE.
 */
function KeyStrip({
  keys, durationInFrames, localFrame, fps,
}: {
  keys: Keyframe[];
  durationInFrames: number;
  localFrame: number;
  fps: number;
}) {
  const span = Math.max(1, durationInFrames);
  const pct = (f: number) => (Math.max(0, Math.min(span, f)) / span) * 100;
  const first = keys[0];
  const last = keys[keys.length - 1];
  // Keys can sit outside the clip after a split; they are real and recoverable,
  // so say how many rather than silently dropping them off the end.
  const hidden = keys.filter((k) => k.frame < 0 || k.frame > span).length;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 78 }}>
      <div
        style={{
          position: "relative", flex: 1, height: 26,
          background: "var(--surface-void)",
          border: "1px solid var(--border-hairline)",
          borderRadius: "var(--r-item)",
          overflow: "hidden",
        }}
      >
        {/* the line joining consecutive keys */}
        {keys.length > 1 && (
          <div
            style={{
              position: "absolute", top: "50%", height: 1,
              left: `${pct(first.frame)}%`, width: `${pct(last.frame) - pct(first.frame)}%`,
              background: "var(--surface-active)",
            }}
          />
        )}
        {keys.map((k) => (
          <span
            key={k.frame}
            title={`${frameCount(k.frame)}`}
            style={{
              position: "absolute", top: "50%", left: `${pct(k.frame)}%`,
              width: 7, height: 7, marginLeft: -3.5, marginTop: -3.5,
              transform: "rotate(45deg)", background: "var(--ink-primary)",
            }}
          />
        ))}
        {/* the playhead is the only live thing in here */}
        {localFrame >= 0 && localFrame <= span && (
          <div
            style={{
              position: "absolute", top: 0, bottom: 0, width: 1,
              left: `${pct(localFrame)}%`, background: "var(--live)",
            }}
          />
        )}
      </div>
      <span className="t-data-s" style={{ color: "var(--ink-tertiary)", flexShrink: 0 }}>
        {hidden > 0
          ? `${hidden} off-clip`
          : `${timecode(Math.max(0, first.frame), fps)} → ${timecode(Math.max(0, last.frame), fps)}`}
      </span>
    </div>
  );
}

const ROW_GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "72px minmax(0,1fr) 20px 20px",
  gap: 6,
  alignItems: "center",
};

function Row({
  label, children, animated, onReset, isDefault = true, linked, diamond,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  /** The row's keyframe diamond. Omit for a property that cannot be animated. */
  diamond?: React.ReactNode;
  /** Drives the label colour — an animated property reads ink-primary. */
  animated?: boolean;
  onReset?: () => void;
  isDefault?: boolean;
  /** A value governed by a link (Scale -> W·H): visible, but dimmed. */
  linked?: boolean;
}) {
  return (
    <div style={ROW_GRID}>
      <span
        className="t-control"
        style={{
          textAlign: "right",
          color: linked ? "var(--ink-disabled)" : animated ? "var(--ink-primary)" : "var(--ink-secondary)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      <div style={{ minWidth: 0 }}>{children}</div>
      <span style={{ display: "grid", placeItems: "center" }}>{diamond}</span>
      <span style={{ display: "grid", placeItems: "center" }}>
        {onReset && (
          <button
            onClick={isDefault ? undefined : onReset}
            title={isDefault ? "Already default" : "Reset to default"}
            disabled={isDefault}
            style={{
              width: 20, height: 20, display: "grid", placeItems: "center", padding: 0,
              background: "transparent", border: "none",
              borderRadius: "var(--r-control)",
              color: isDefault ? "var(--ink-faint)" : "var(--ink-tertiary)",
              cursor: isDefault ? "default" : "pointer",
            }}
          >
            <Icon name="reset" size={12} />
          </button>
        )}
      </span>
    </div>
  );
}

const FIELD: React.CSSProperties = {
  height: 24,
  background: "var(--surface-raised)",
  border: "1px solid var(--border-hairline)",
  borderRadius: "var(--r-control)",
  color: "var(--ink-primary)",
  padding: "0 6px",
  width: "100%",
  minWidth: 0,
};

/** X/Y pair — two equal fields with the axis letter inside. */
function Vector({
  x, y, onX, onY,
}: {
  x: number; y: number;
  onX: (n: number, o?: { transient?: boolean }) => void;
  onY: (n: number, o?: { transient?: boolean }) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      <ScrubNumber value={x} onChange={onX} prefix="X" />
      <ScrubNumber value={y} onChange={onY} prefix="Y" />
    </div>
  );
}

/** Slider plus a fixed 52px number field, per the spec. */
function Scalar({
  value, min = 0, max = 100, step = 1, suffix, onChange,
}: {
  value: number; min?: number; max?: number; step?: number; suffix?: string;
  onChange: (n: number, o?: { transient?: boolean }) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Slider value={value} min={min} max={max} step={step} onChange={onChange} />
      <div style={{ width: 52, flexShrink: 0 }}>
        <ScrubNumber value={value} onChange={onChange} min={min} max={max} step={step} suffix={suffix} />
      </div>
    </div>
  );
}

/* ───────────────────────── section ───────────────────────── */

function Section({
  title, children, subtitle, open, onOpenChange,
  enabled, onEnabledChange, onReset, canReset, added,
}: {
  title: string;
  children: React.ReactNode;
  /** Right-hand meta — a key count, or "bypassed". */
  subtitle?: React.ReactNode;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Omit for a section that cannot be switched off (Transform). */
  enabled?: boolean;
  onEnabledChange?: (v: boolean) => void;
  onReset?: () => void;
  canReset?: boolean;
  /** A just-added effect gets a brand left edge that fades. */
  added?: boolean;
}) {
  const off = enabled === false;
  return (
    <div style={{ borderBottom: "1px solid var(--border-hairline)" }}>
      <div
        style={{
          display: "flex", alignItems: "center", gap: 8, height: 32,
          padding: "0 8px 0 10px", background: "var(--surface-raised)",
          animation: added ? "vt-effect-added 1.2s var(--ease) forwards" : undefined,
        }}
      >
        <button
          onClick={() => onOpenChange(!open)}
          aria-label={open ? "Collapse" : "Expand"}
          style={{
            width: 13, height: 13, display: "grid", placeItems: "center", padding: 0,
            background: "transparent", border: "none", cursor: "pointer",
            color: off ? "var(--ink-disabled)" : "var(--ink-secondary)",
          }}
        >
          <Icon name={open ? "chevronDown" : "chevronRight"} size={13} />
        </button>
        <span className="t-section" style={{ flex: 1, color: off ? "var(--ink-disabled)" : "var(--ink-primary)" }}>
          {title}
        </span>
        {subtitle}
        {onEnabledChange && (
          <Toggle size="inspector" checked={enabled !== false} onChange={onEnabledChange} label={`${title} on`} />
        )}
        <span style={{ width: 20, display: "grid", placeItems: "center" }}>
          {onReset && (
            <button
              onClick={canReset ? onReset : undefined}
              disabled={!canReset}
              title={canReset ? `Reset ${title.toLowerCase()}` : "Nothing to reset"}
              style={{
                width: 20, height: 20, display: "grid", placeItems: "center", padding: 0,
                background: "transparent", border: "none", borderRadius: "var(--r-control)",
                color: canReset ? "var(--ink-tertiary)" : "var(--ink-faint)",
                cursor: canReset ? "pointer" : "default",
              }}
            >
              <Icon name="reset" size={12} />
            </button>
          )}
        </span>
      </div>
      {open && !off && (
        <div style={{ padding: "8px 8px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
          {children}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── the panel ───────────────────────── */

type Category = "video" | "text" | "audio";

export default function EditorInspector({
  doc, selectedIds, onChange, onEditSnippet, projectId,
}: {
  doc: EditorDoc;
  selectedIds: Set<string>;
  projectId?: string;
  /** `transient` values come from a drag in progress and must not be recorded for undo. */
  onChange: (next: EditorDoc, opts?: { transient?: boolean }) => void;
  onEditSnippet?: (itemId: string) => void;
}) {
  // Subscribes: once a property is animated, its VALUE depends on the playhead.
  const playheadFrame = usePlayheadFrame();
  const [category, setCategory] = useState<Category>("video");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [addOpen, setAddOpen] = useState(false);
  /** The effect just added, for its fading brand edge. */
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const ids = [...selectedIds];
  const found = ids.length === 1 ? findItem(doc, ids[0]) : null;
  const item = found?.item;

  const isOpen = (k: string, dflt = true) => openSections[k] ?? dflt;
  const setOpen = (k: string, v: boolean) => setOpenSections((p) => ({ ...p, [k]: v }));

  /* ── nothing selected: show the project, not an empty state ── */
  if (!item) {
    const total = docDuration(doc);
    const hours = needsHours(total, doc.size.fps);
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
        <Header
          subject={ids.length > 1
            ? `${ids.length} clips${findItem(doc, ids[0])?.track.name ? ` · ${findItem(doc, ids[0])!.track.name}` : ""}`
            : undefined}
        />
        {ids.length > 1 ? (
          <MultiSelection doc={doc} ids={ids} onChange={onChange} />
        ) : (
          <div style={{ padding: "8px 8px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
            <Row label="Frame"><ReadOnly>{doc.size.width} × {doc.size.height}</ReadOnly></Row>
            <Row label="Rate"><ReadOnly>{doc.size.fps} fps</ReadOnly></Row>
            <Row label="Duration"><ReadOnly>{timecode(total, doc.size.fps, hours)}</ReadOnly></Row>
            <div style={{ height: 1, background: "var(--border-hairline)", margin: "6px 0" }} />
            <div className="t-caption" style={{ color: "var(--ink-tertiary)", padding: "0 2px" }}>
              Select a clip to edit it.
            </div>
          </div>
        )}
      </div>
    );
  }

  const l = item.layout;
  const patchLayout = (p: Parameters<typeof setLayout>[2], opts?: { transient?: boolean }) =>
    onChange(setLayout(doc, item.id, p), opts);

  const rawLocal = playheadFrame - item.from;
  /**
   * Keys are written at the playhead — CLAMPED to the clip.
   *
   * Negative and past-the-end keys are legal in the model (a split relies on
   * it), but one created by clicking a diamond while the playhead sits off the
   * clip is just a key you can neither see nor reach. Clamping puts it at the
   * nearest end, which is what you meant.
   */
  const localFrame = Math.max(0, Math.min(item.durationInFrames - 1, rawLocal));
  const canAnimate = channelsFor(item.type).length > 0;
  const dia = (channels: ChannelId[]) =>
    canAnimate ? <Diamond doc={doc} item={item} channels={channels} localFrame={localFrame} onChange={onChange} /> : undefined;

  /** The strip under an animated row — one per row, using its first keyed channel. */
  const strip = (channels: ChannelId[]) => {
    const ch = channels.find((c) => isAnimated(item, c));
    if (!ch) return null;
    return (
      <KeyStrip
        keys={item.keys![ch]!}
        durationInFrames={item.durationInFrames}
        localFrame={rawLocal}
        fps={doc.size.fps}
      />
    );
  };

  /** The value a channel actually has at the playhead. */
  const valueNow = (ch: ChannelId, fallback: number) =>
    valueAt(item.keys?.[ch], localFrame, fallback, CHANNELS_BY_ID[ch]);

  /**
   * Write a channel.
   *
   * The same branch the canvas makes: if the property is animated its scalar is
   * dormant, so typing in the field has to set a KEY at the playhead or the
   * edit would silently do nothing.
   */
  const writeChannel = (ch: ChannelId, value: number, opts?: { transient?: boolean }) => {
    if (isAnimated(item, ch)) onChange(setItemKey(doc, item.id, ch, localFrame, value), opts);
    else onChange(setLayout(doc, item.id, { [ch]: value }), opts);
  };

  const bypassed = (section: string) => item.bypass?.includes(section) ?? false;
  const setBypass = (section: string, off: boolean) => {
    const cur = item.bypass ?? [];
    const next = off ? [...new Set([...cur, section])] : cur.filter((x) => x !== section);
    onChange(updateItem(doc, item.id, { bypass: next.length ? next : undefined } as Partial<EditorItem>));
  };

  /** "2 keys" on a section header — the count is what you check at a glance. */
  const keyCount = (channels: ChannelId[]) => {
    const n = channels.reduce((acc, c) => acc + (item.keys?.[c]?.length ?? 0), 0);
    if (n === 0) return undefined;
    return (
      <span
        className="t-data-s"
        style={{
          display: "inline-flex", alignItems: "center", height: 16, padding: "0 6px",
          background: "var(--surface-void)", borderRadius: "var(--r-pill)",
          color: "var(--ink-tertiary)",
        }}
      >
        {n} {n === 1 ? "key" : "keys"}
      </span>
    );
  };

  /**
   * Reset a row.
   *
   * If the row is ANIMATED, stop animating it first — otherwise reset would
   * write the dormant scalar while the keys keep driving the render, and the
   * button would appear to do nothing.
   */
  const resetRow = (channels: ChannelId[], patch: Parameters<typeof setLayout>[2]) => {
    let next = doc;
    for (const c of channels) {
      if (isAnimated(item, c)) next = disableChannel(next, item.id, c, localFrame);
    }
    onChange(setLayout(next, item.id, patch));
  };

  const effects = itemEffects(item);
  const writeEffects = (next: Effect[]) =>
    onChange(updateItem(doc, item.id, { effects: next } as Partial<EditorItem>));

  const isText = item.type === "text" || item.type === "captions";
  const hasAudio = hasSource(item);

  /* which sections belong to the active category */
  const showVideo = category === "video";
  const showText = category === "text" && isText;
  const showAudio = category === "audio" && hasAudio;

  return (
    <div className="vt-scroll" style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, overflowY: "auto" }}>
      <Header subject={`${item.type} · ${frameCount(item.durationInFrames)}`} />

      {/* Keyed on the stored name so an undo, or a rename on the timeline,
          resets what the field shows instead of leaving a stale draft in it. */}
      <div style={{ padding: "8px 10px 4px", flexShrink: 0 }}>
        <Row label="Name">
          <input
            key={`${item.id}:${item.name ?? ""}`}
            aria-label="Clip name"
            defaultValue={item.name ?? ""}
            placeholder={itemLabel(doc, { ...item, name: undefined })}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                e.currentTarget.value = item.name ?? "";
                e.currentTarget.blur();
              }
            }}
            onBlur={(e) => {
              if (e.currentTarget.value.trim() !== (item.name ?? "")) onChange(renameItem(doc, item.id, e.currentTarget.value));
            }}
            className="t-data-m"
            style={FIELD}
          />
        </Row>
      </div>

      <Tabs
        value={category}
        onChange={(v) => setCategory(v as Category)}
        options={[
          { value: "video", label: "Video" },
          { value: "text", label: "Text", disabled: !isText },
          { value: "audio", label: "Audio", disabled: !hasAudio },
        ]}
        style={{ padding: "0 10px", flexShrink: 0 }}
      />

      {showVideo && (
        <>
          {/* TRANSFORM — switchable, resettable, every row keyframable.
              Bypass keeps the values; it just stops them applying. */}
          <Section
            title="Transform"
            open={isOpen("transform")}
            onOpenChange={(v) => setOpen("transform", v)}
            enabled={!bypassed("transform")}
            onEnabledChange={(v) => setBypass("transform", !v)}
            subtitle={keyCount(["x", "y", "scale", "rotation", "anchorX", "anchorY"])}
            onReset={() => resetRow(["x", "y", "scale", "rotation", "anchorX", "anchorY"], { x: 0, y: 0, scale: 1, rotation: 0, anchorX: 0.5, anchorY: 0.5 })}
            canReset={Boolean(l.x || l.y || l.rotation || (l.scale ?? 1) !== 1)}
          >
            <Row
              label="Position"
              diamond={dia(["x", "y"])}
              animated={isAnimated(item, "x") || isAnimated(item, "y")}
              onReset={() => resetRow(["x", "y"], { x: 0, y: 0 })}
              isDefault={l.x === 0 && l.y === 0 && !isAnimated(item, "x") && !isAnimated(item, "y")}
            >
              <Vector
                x={valueNow("x", l.x)} y={valueNow("y", l.y)}
                onX={(n, o) => writeChannel("x", n, o)}
                onY={(n, o) => writeChannel("y", n, o)}
              />
            </Row>

            <Row
              label="Scale"
              diamond={dia(["scale"])}
              animated={isAnimated(item, "scale")}
              onReset={() => resetRow(["scale"], { scale: 1 })}
              isDefault={(l.scale ?? 1) === 1 && !isAnimated(item, "scale")}
            >
              <Scalar
                value={Math.round(valueNow("scale", l.scale ?? 1) * 100)}
                min={1} max={400}
                onChange={(pct, o) => writeChannel("scale", pct / 100, o)}
              />
            </Row>

            {/* The linked sub-row: visible so you know where the numbers came
                from, dimmed because Scale governs them — the way Premiere dims
                Scale Width under Uniform Scale. No diamond: not animatable. */}
            <Row
              label={<span style={{ display: "inline-flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                <Icon name="link" size={11} /> W · H
              </span>}
              linked
            >
              <div style={{ display: "flex", gap: 4 }}>
                <ReadOnly dim>{Math.round(l.width * valueNow("scale", l.scale ?? 1))}</ReadOnly>
                <ReadOnly dim>{Math.round(l.height * valueNow("scale", l.scale ?? 1))}</ReadOnly>
              </div>
            </Row>

            <Row
              label="Rotation"
              diamond={dia(["rotation"])}
              animated={isAnimated(item, "rotation")}
              onReset={() => resetRow(["rotation"], { rotation: 0 })}
              isDefault={!l.rotation && !isAnimated(item, "rotation")}
            >
              <Scalar
                value={valueNow("rotation", l.rotation ?? 0)} min={-180} max={180} suffix="°"
                onChange={(n, o) => writeChannel("rotation", n, o)}
              />
            </Row>

            <Row
              label="Anchor"
              diamond={dia(["anchorX", "anchorY"])}
              animated={isAnimated(item, "anchorX") || isAnimated(item, "anchorY")}
              onReset={() => resetRow(["anchorX", "anchorY"], { anchorX: 0.5, anchorY: 0.5 })}
              isDefault={(l.anchorX ?? 0.5) === 0.5 && (l.anchorY ?? 0.5) === 0.5}
            >
              <Vector
                x={Math.round(valueNow("anchorX", l.anchorX ?? 0.5) * l.width)}
                y={Math.round(valueNow("anchorY", l.anchorY ?? 0.5) * l.height)}
                onX={(n, o) => writeChannel("anchorX", l.width ? n / l.width : 0.5, o)}
                onY={(n, o) => writeChannel("anchorY", l.height ? n / l.height : 0.5, o)}
              />
            </Row>

            <Row label="Corner" onReset={() => patchLayout({ cornerRadius: 0 })} isDefault={!l.cornerRadius}>
              <Scalar value={l.cornerRadius ?? 0} min={0} max={200} onChange={(n, o) => patchLayout({ cornerRadius: n }, o)} />
            </Row>
          </Section>

          {/* OPACITY — carries the key count, because opacity is the property
              most often animated and the count is the thing you check. */}
          <Section
            title="Opacity"
            open={isOpen("opacity")}
            onOpenChange={(v) => setOpen("opacity", v)}
            enabled={!bypassed("opacity")}
            onEnabledChange={(v) => setBypass("opacity", !v)}
            subtitle={keyCount(["opacity"])}
            onReset={() => resetRow(["opacity"], { opacity: 1, blend: undefined })}
            canReset={(l.opacity ?? 1) !== 1 || Boolean(l.blend)}
          >
            <Row
              label="Opacity"
              diamond={dia(["opacity"])}
              animated={isAnimated(item, "opacity")}
              onReset={() => resetRow(["opacity"], { opacity: 1 })}
              isDefault={(l.opacity ?? 1) === 1 && !isAnimated(item, "opacity")}
            >
              <Scalar
                value={Math.round(valueNow("opacity", l.opacity ?? 1) * 100)} min={0} max={100}
                onChange={(n, o) => writeChannel("opacity", n / 100, o)}
              />
            </Row>

            {/* Blend gets NO diamond rather than a dead one — it cannot be
                animated, and an inert diamond would say it could. */}
            <Row
              label="Blend"
              onReset={() => patchLayout({ blend: undefined })}
              isDefault={!l.blend || l.blend === "normal"}
            >
              <Select
                height={24}
                value={l.blend ?? "normal"}
                onChange={(v) => patchLayout({ blend: v === "normal" ? undefined : v })}
                options={[
                  { value: "normal", label: "Normal" },
                  { value: "screen", label: "Screen" },
                  { value: "multiply", label: "Multiply" },
                  { value: "overlay", label: "Overlay" },
                  { value: "lighten", label: "Lighten" },
                  { value: "darken", label: "Darken" },
                ]}
              />
            </Row>

            {strip(["opacity"])}
          </Section>

          {/* ARRIVES · LEAVES — ONE section with a row per edge, not two
              sections. They are two ends of the same idea. */}
          {effects.length > 0 && (
            <Section
              title="Arrives · Leaves"
              open={isOpen("edges")}
              onOpenChange={(v) => setOpen("edges", v)}
              enabled={effects.some((e) => e.enabled)}
              onEnabledChange={(v) => writeEffects(effects.map((e) => ({ ...e, enabled: v })))}
              subtitle={effects.every((e) => e.enabled) ? undefined
                : <span className="t-caption" style={{ color: "var(--ink-disabled)" }}>bypassed</span>}
              added={effects.some((e) => e.id === justAdded)}
              onReset={() => writeEffects([])}
              canReset
            >
              {effects.map((fx) => (
                <Row
                  key={fx.id}
                  label={fx.kind === "animateIn" ? "Arrives" : "Leaves"}
                  onReset={() => writeEffects(effects.filter((e) => e.id !== fx.id))}
                  isDefault={false}
                >
                  <div style={{ display: "flex", gap: 4 }}>
                    <div style={{ width: 64, flexShrink: 0 }}>
                      <ScrubNumber
                        value={fx.durationInFrames}
                        min={1}
                        suffix="f"
                        onChange={(n) => writeEffects(setEffectPreset({ ...item, effects }, fx.kind, fx.preset, Math.max(1, Math.round(n))))}
                      />
                    </div>
                    <Select
                      height={24}
                      value={fx.preset}
                      onChange={(v) => writeEffects(setEffectPreset({ ...item, effects }, fx.kind, v as AnimationPreset, fx.durationInFrames))}
                      options={presetsFor(item.type).filter((pp) => pp.id !== "none").map((pp) => ({ value: pp.id, label: pp.label }))}
                    />
                  </div>
                </Row>
              ))}
            </Section>
          )}

          {item.type === "video" && projectId && (
            <GradeSection doc={doc} item={item as VideoItem} projectId={projectId} onChange={onChange} />
          )}

          <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setAddOpen((v) => !v)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  height: 28, width: "100%",
                  background: "var(--surface-raised)",
                  border: "1px dashed var(--border-edge)",
                  borderRadius: "var(--r-control)",
                  color: "var(--ink-secondary)",
                  fontSize: "var(--t-control-size)", fontWeight: 500, cursor: "pointer",
                }}
              >
                <Icon name="plus" size={13} /> Add effect
              </button>
              {addOpen && (
                <div style={{ position: "absolute", right: 0, bottom: 32, zIndex: 40 }}>
                  <AddEffectPopover
                    itemType={item.type}
                    existing={effects.map((e) => e.kind)}
                    onClose={() => setAddOpen(false)}
                    onPick={({ kind, preset }) => {
                      setAddOpen(false);
                      const next = setEffectPreset({ ...item, effects }, kind, preset, 12);
                      const added = next.find((e) => e.kind === kind);
                      if (added) setJustAdded(added.id);
                      writeEffects(next);
                    }}
                  />
                </div>
              )}
            </div>
            <div className="t-caption" style={{ color: "var(--ink-tertiary)" }}>
              Drag a section by its header to reorder the stack — effects apply top to bottom.
            </div>
          </div>
        </>
      )}

      {showText && item.type === "text" && (
        <Section title="Text" open={isOpen("text")} onOpenChange={(v) => setOpen("text", v)}>
          <Row label="Content">
            <textarea
              value={(item as TextItem).text}
              onChange={(e) => onChange(updateItem<TextItem>(doc, item.id, { text: e.target.value }))}
              rows={3}
              className="t-body"
              style={{ ...FIELD, height: "auto", padding: 8, resize: "vertical", fontFamily: "inherit", border: "1px solid var(--border-edge)" }}
            />
          </Row>
          <Row label="Size">
            <Scalar
              value={(item as TextItem).style.fontSize} min={4} max={400}
              onChange={(n, o) => onChange(updateItem<TextItem>(doc, item.id, { style: { ...(item as TextItem).style, fontSize: Math.max(4, n) } }), o)}
            />
          </Row>
          <Row label="Fill">
            <ColourField
              value={(item as TextItem).style.color}
              onChange={(v) => onChange(updateItem<TextItem>(doc, item.id, { style: { ...(item as TextItem).style, color: v } }))}
            />
          </Row>
          <Row label="Align">
            <Select
              height={24}
              value={(item as TextItem).style.align ?? "left"}
              onChange={(v) => onChange(updateItem<TextItem>(doc, item.id, { style: { ...(item as TextItem).style, align: v as "left" | "center" | "right" } }))}
              options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]}
            />
          </Row>
        </Section>
      )}

      {showText && item.type === "captions" && (
        <Section title="Captions" open={isOpen("captions")} onOpenChange={(v) => setOpen("captions", v)}>
          <Row label="Words"><ReadOnly>{(item as CaptionsItem).tokens.length} transcribed</ReadOnly></Row>
          <Row label="Size">
            <Scalar
              value={(item as CaptionsItem).style.fontSize} min={4} max={400}
              onChange={(n, o) => onChange(updateItem<CaptionsItem>(doc, item.id, { style: { ...(item as CaptionsItem).style, fontSize: Math.max(4, n) } }), o)}
            />
          </Row>
          <Row label="Fill">
            <ColourField
              value={(item as CaptionsItem).style.color}
              onChange={(v) => onChange(updateItem<CaptionsItem>(doc, item.id, { style: { ...(item as CaptionsItem).style, color: v } }))}
            />
          </Row>
          <Row label="Spoken">
            <ColourField
              value={(item as CaptionsItem).highlightColor ?? "#F86606"}
              onChange={(v) => onChange(updateItem<CaptionsItem>(doc, item.id, { highlightColor: v }))}
            />
          </Row>
          <Row label="Page ms">
            <Scalar
              value={(item as CaptionsItem).pageDurationMs ?? 1200} min={200} max={5000} step={100}
              onChange={(n, o) => onChange(updateItem<CaptionsItem>(doc, item.id, { pageDurationMs: Math.max(200, n) }), o)}
            />
          </Row>
          <Row label="Per page">
            <Scalar
              value={(item as CaptionsItem).maxWordsPerPage ?? 6} min={1} max={12}
              onChange={(n, o) => onChange(updateItem<CaptionsItem>(doc, item.id, { maxWordsPerPage: Math.max(1, Math.round(n)) }), o)}
            />
          </Row>
        </Section>
      )}

      {showAudio && (
        <Section title="Sound" open={isOpen("sound")} onOpenChange={(v) => setOpen("sound", v)}>
          <Row label="Volume" onReset={() => onChange(updateItem<AudioItem>(doc, item.id, { volume: 1 }))} isDefault={((item as VideoItem).volume ?? 1) === 1}>
            <Scalar
              value={Math.round(((item as VideoItem).volume ?? 1) * 100)} min={0} max={100} suffix="%"
              onChange={(n, o) => onChange(updateItem<AudioItem>(doc, item.id, { volume: n / 100 }), o)}
            />
          </Row>
          <Row label="Fade in">
            <Scalar
              value={(item as VideoItem).fadeInFrames ?? 0} min={0} max={120}
              onChange={(n, o) => onChange(updateItem<AudioItem>(doc, item.id, { fadeInFrames: Math.max(0, Math.round(n)) }), o)}
            />
          </Row>
          <Row label="Fade out">
            <Scalar
              value={(item as VideoItem).fadeOutFrames ?? 0} min={0} max={120}
              onChange={(n, o) => onChange(updateItem<AudioItem>(doc, item.id, { fadeOutFrames: Math.max(0, Math.round(n)) }), o)}
            />
          </Row>
          <Row label="Speed" onReset={() => onChange(updateItem<AudioItem>(doc, item.id, { playbackRate: 1 }))} isDefault={((item as VideoItem).playbackRate ?? 1) === 1}>
            <Scalar
              value={(item as VideoItem).playbackRate ?? 1} min={0.25} max={5} step={0.05} suffix="×"
              onChange={(n, o) => onChange(updateItem<AudioItem>(doc, item.id, { playbackRate: Math.max(0.25, Math.min(5, n)) }), o)}
            />
          </Row>
          <Row label="Source">
            <ReadOnly dim>
              {((item as VideoItem).sourceIn ?? 0).toFixed(2)}s – {((item as VideoItem).sourceOut ?? 0).toFixed(2)}s
            </ReadOnly>
          </Row>
        </Section>
      )}

      {showVideo && item.type === "scene" && "snippet" in item && item.snippet && onEditSnippet && (
        <div style={{ padding: 8 }}>
          <button
            onClick={() => onEditSnippet(item.id)}
            style={{ ...FIELD, height: 28, cursor: "pointer", textAlign: "left", fontSize: "var(--t-control-size)" }}
          >
            Edit {item.snippet.id} texts…
          </button>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── bits ───────────────────────── */

function Header({ subject }: { subject?: string }) {
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 8, height: 32, flexShrink: 0,
        padding: "0 8px 0 12px", borderBottom: "1px solid var(--border-hairline)",
      }}
    >
      <span className="t-section" style={{ color: "var(--ink-primary)" }}>Properties</span>
      {subject && <span className="t-data-s" style={{ color: "var(--ink-tertiary)" }}>{subject}</span>}
      <div style={{ flex: 1 }} />
      <Menu align="right" items={[{ label: "Nothing here yet", disabled: true }]}>
        <IconButton icon="dots" size={24} title="More" />
      </Menu>
    </div>
  );
}

function ReadOnly({ children, dim }: { children: React.ReactNode; dim?: boolean }) {
  return (
    <div
      className="t-data-m"
      style={{
        ...FIELD,
        display: "flex", alignItems: "center", justifyContent: "flex-end",
        color: dim ? "var(--ink-disabled)" : "var(--ink-primary)",
        background: "var(--surface-raised)",
      }}
    >
      {children}
    </div>
  );
}

function ColourField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ ...FIELD, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
      <span style={{ width: 12, height: 12, borderRadius: 3, background: value, flexShrink: 0, border: "1px solid var(--border-hairline)" }} />
      <span className="t-data-s" style={{ color: "var(--ink-primary)", textTransform: "uppercase" }}>{value}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
      />
    </label>
  );
}

/**
 * Multi-selection — the SAME stack, not a reduced one.
 *
 * The design is explicit that selecting three clips shouldn't drop you into a
 * different, poorer panel: the sections are the same, shared values edit
 * together, and a value that differs across the selection reads "Mixed" rather
 * than one clip's number quietly standing in for all of them.
 *
 * Then one group the single-clip panel has no use for: the things you can only
 * mean about several clips at once.
 */
function MultiSelection({
  doc, ids, onChange,
}: {
  doc: EditorDoc; ids: string[];
  onChange: (next: EditorDoc, opts?: { transient?: boolean }) => void;
}) {
  const [open, setOpenState] = useState<Record<string, boolean>>({});
  const isOpen = (k: string, d = true) => open[k] ?? d;
  const setOpen = (k: string, v: boolean) => setOpenState((p) => ({ ...p, [k]: v }));

  const items = ids.map((id) => findItem(doc, id)?.item).filter(Boolean) as EditorItem[];
  if (items.length === 0) return null;

  const track = findItem(doc, ids[0])?.track;

  /** A value, or "mixed" when the selection disagrees about it. */
  const shared = (read: (i: EditorItem) => number): number | "mixed" => {
    const first = read(items[0]);
    return items.every((i) => Math.abs(read(i) - first) < 1e-9) ? first : "mixed";
  };

  const setAll = (patch: Parameters<typeof setLayout>[2], opts?: { transient?: boolean }) => {
    let next = doc;
    for (const i of items) next = setLayout(next, i.id, patch);
    onChange(next, opts);
  };

  const bypassedAll = (section: string) => items.every((i) => i.bypass?.includes(section));
  const setBypassAll = (section: string, off: boolean) => {
    let next = doc;
    for (const i of items) {
      const cur = i.bypass ?? [];
      const b = off ? [...new Set([...cur, section])] : cur.filter((x) => x !== section);
      next = updateItem(next, i.id, { bypass: b.length ? b : undefined } as Partial<EditorItem>);
    }
    onChange(next);
  };

  /** "on all 3" — only when every selected clip actually has it. */
  const onAll = (present: (i: EditorItem) => boolean) =>
    items.every(present)
      ? <span className="t-caption" style={{ color: "var(--ink-tertiary)" }}>on all {items.length}</span>
      : undefined;

  const x = shared((i) => i.layout.x);
  const y = shared((i) => i.layout.y);
  const rot = shared((i) => i.layout.rotation ?? 0);
  const op = shared((i) => i.layout.opacity ?? 1);

  const gap = evenSpacingGap(doc, ids);
  const firstDuration = [...items].sort((p, q) => p.from - q.from)[0].durationInFrames;
  const fx = itemEffects([...items].sort((p, q) => p.from - q.from)[0]);

  return (
    <div className="vt-scroll" style={{ overflowY: "auto", minHeight: 0 }}>
      <Section
        title="Transform"
        open={isOpen("transform")}
        onOpenChange={(v) => setOpen("transform", v)}
        enabled={!bypassedAll("transform")}
        onEnabledChange={(v) => setBypassAll("transform", !v)}
        subtitle={onAll((i) => !i.bypass?.includes("transform"))}
      >
        <Row label="Position">
          {x === "mixed" || y === "mixed" ? <Mixed /> : (
            <Vector
              x={x} y={y}
              onX={(n, o) => setAll({ x: n }, o)}
              onY={(n, o) => setAll({ y: n }, o)}
            />
          )}
        </Row>
        <Row label="Rotation">
          {rot === "mixed" ? <Mixed /> : (
            <Scalar value={rot} min={-180} max={180} suffix="°" onChange={(n, o) => setAll({ rotation: n }, o)} />
          )}
        </Row>
      </Section>

      <Section
        title="Opacity"
        open={isOpen("opacity")}
        onOpenChange={(v) => setOpen("opacity", v)}
        enabled={!bypassedAll("opacity")}
        onEnabledChange={(v) => setBypassAll("opacity", !v)}
        subtitle={onAll((i) => !i.bypass?.includes("opacity"))}
      >
        <Row label="Opacity">
          {op === "mixed" ? <Mixed /> : (
            <Scalar
              value={Math.round(op * 100)} min={0} max={100}
              onChange={(n, o) => setAll({ opacity: n / 100 }, o)}
            />
          )}
        </Row>
      </Section>

      {/* The things you can only mean about several clips at once. */}
      <div style={{ padding: "10px 8px", display: "flex", flexDirection: "column", gap: 6 }}>
        <span className="t-section" style={{ color: "var(--ink-tertiary)", paddingLeft: 2 }}>
          Across the selection
        </span>

        <SelectionAction
          label="Even spacing"
          meta={gap === null ? undefined : `${gap}f gaps`}
          disabled={gap === null}
          onClick={() => onChange(evenSpacing(doc, ids))}
        />
        <SelectionAction
          label="Same duration"
          meta={`${firstDuration}f`}
          onClick={() => onChange(sameDuration(doc, ids, doc.size.fps))}
        />
        <SelectionAction
          label={`Paste effects to all ${items.length}`}
          meta={fx.length ? `${fx.length} on the first` : undefined}
          disabled={fx.length === 0}
          onClick={() => onChange(pasteEffects(doc, [...items].sort((p, q) => p.from - q.from)[0].id, ids))}
        />

        <span className="t-caption" style={{ color: "var(--ink-tertiary)", paddingLeft: 2, marginTop: 4 }}>
          {items.length} clips{track ? ` on ${track.name}` : ""}. Shared values edit together.
        </span>
      </div>
    </div>
  );
}

/** A 28px row: what it does on the left, what it will produce on the right. */
function SelectionAction({
  label, meta, disabled, onClick,
}: { label: string; meta?: string; disabled?: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 8, height: 28, width: "100%",
        padding: "0 10px", textAlign: "left", cursor: disabled ? "default" : "pointer",
        background: disabled ? "transparent" : hover ? "var(--surface-hover)" : "var(--surface-raised)",
        border: `1px solid ${disabled ? "var(--border-hairline)" : "var(--border-edge)"}`,
        borderRadius: "var(--r-control)",
        color: disabled ? "var(--ink-disabled)" : "var(--ink-primary)",
        fontSize: "var(--t-control-size)", fontWeight: 500,
      }}
    >
      <span style={{ flex: 1 }}>{label}</span>
      {meta && <span className="t-data-s" style={{ color: "var(--ink-tertiary)" }}>{meta}</span>}
    </button>
  );
}



/** A value the selection disagrees about. Centred, so it reads as "no single
 *  answer" rather than as a value you could edit. */
function Mixed() {
  return (
    <div className="t-caption" style={{ ...FIELD, display: "grid", placeItems: "center", color: "var(--ink-tertiary)" }}>
      Mixed
    </div>
  );
}
