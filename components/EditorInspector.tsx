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
  type AudioItem, type CaptionsItem, type EditorDoc, type EditorItem,
  type TextItem, type VideoItem,
} from "@/lib/editor-doc";
import {
  itemEffects, presetsFor, reorderEffects, setEffectEnabled, setEffectOpen,
  setEffectPreset, type AnimationPreset, type Effect,
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
        <Header subject={ids.length > 1 ? `${ids.length} clips` : undefined} />
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
          <Section
            title="Transform"
            open={isOpen("transform")}
            onOpenChange={(v) => setOpen("transform", v)}
            onReset={() => patchLayout({ rotation: 0 })}
            canReset={Boolean(l.rotation)}
          >
            <Row
              label="Position"
              diamond={dia(["x", "y"])}
              animated={isAnimated(item, "x") || isAnimated(item, "y")}
              onReset={() => resetRow(["x", "y"], { x: 0, y: 0 })}
              isDefault={l.x === 0 && l.y === 0 && !isAnimated(item, "x") && !isAnimated(item, "y")}
            >
              <Vector
                x={l.x} y={l.y}
                onX={(n, o) => patchLayout({ x: n }, o)}
                onY={(n, o) => patchLayout({ y: n }, o)}
              />
            </Row>
            {strip(["x", "y"])}
            <Row label="Size">
              <Vector
                x={l.width} y={l.height}
                onX={(n, o) => patchLayout({ width: Math.max(8, n) }, o)}
                onY={(n, o) => patchLayout({ height: Math.max(8, n) }, o)}
              />
            </Row>
            <Row
              label="Scale"
              diamond={dia(["scale"])}
              animated={isAnimated(item, "scale")}
              onReset={() => {
                const width = doc.size.width;
                const height = Math.max(8, Math.round(width * (l.height / l.width)));
                patchLayout({ width, height });
              }}
              isDefault={Math.round((l.width / doc.size.width) * 100) === 100}
            >
              <Scalar
                value={Math.round((l.width / doc.size.width) * 100)}
                min={1} max={200} suffix="%"
                onChange={(pct, o) => {
                  // Scale about the centre, so resizing doesn't shove the item
                  // across the frame — which is what makes a percentage usable.
                  const ratio = l.height / l.width;
                  const width = Math.max(8, Math.round((pct / 100) * doc.size.width));
                  const height = Math.max(8, Math.round(width * ratio));
                  patchLayout({
                    width, height,
                    x: Math.round(l.x + (l.width - width) / 2),
                    y: Math.round(l.y + (l.height - height) / 2),
                  }, o);
                }}
              />
            </Row>
            {strip(["scale"])}
            <Row
              label={<span style={{ display: "inline-flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                <Icon name="link" size={11} /> W · H
              </span>}
              linked
            >
              {/* Visible, so you can see where the number came from. Dimmed,
                  because Scale governs it — the way Premiere dims Scale Width
                  under Uniform Scale. */}
              <div style={{ display: "flex", gap: 4 }}>
                <ReadOnly dim>{l.width}</ReadOnly>
                <ReadOnly dim>{l.height}</ReadOnly>
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
                value={l.rotation ?? 0} min={-180} max={180} suffix="°"
                onChange={(n, o) => patchLayout({ rotation: n }, o)}
              />
            </Row>
            {strip(["rotation"])}
          </Section>

          <Section
            title="Opacity"
            open={isOpen("opacity")}
            onOpenChange={(v) => setOpen("opacity", v)}
            onReset={() => patchLayout({ opacity: 1, cornerRadius: 0 })}
            canReset={(l.opacity ?? 1) !== 1 || Boolean(l.cornerRadius)}
          >
            <Row
              label="Opacity"
              diamond={dia(["opacity"])}
              animated={isAnimated(item, "opacity")}
              onReset={() => resetRow(["opacity"], { opacity: 1 })}
              isDefault={(l.opacity ?? 1) === 1 && !isAnimated(item, "opacity")}
            >
              <Scalar
                value={Math.round((l.opacity ?? 1) * 100)} min={0} max={100} suffix="%"
                onChange={(n, o) => patchLayout({ opacity: n / 100 }, o)}
              />
            </Row>
            {strip(["opacity"])}
            <Row label="Corner" onReset={() => patchLayout({ cornerRadius: 0 })} isDefault={!l.cornerRadius}>
              <Scalar
                value={l.cornerRadius ?? 0} min={0} max={200}
                onChange={(n, o) => patchLayout({ cornerRadius: n }, o)}
              />
            </Row>
          </Section>

          {/* ── the effect stack ── */}
          {effects.map((fx, i) => {
            const label = fx.kind === "animateIn" ? "Arrives" : "Leaves";
            const presets = presetsFor(item.type);
            return (
              <Section
                key={fx.id}
                title={label}
                open={isOpen(fx.id, fx.open ?? true) && fx.enabled}
                onOpenChange={(v) => writeEffects(setEffectOpen(effects, fx.id, v))}
                enabled={fx.enabled}
                onEnabledChange={(v) => writeEffects(setEffectEnabled(effects, fx.id, v))}
                subtitle={!fx.enabled
                  ? <span className="t-caption" style={{ color: "var(--ink-disabled)" }}>bypassed</span>
                  : <span className="t-data-s" style={{ color: "var(--ink-tertiary)" }}>{frameCount(fx.durationInFrames)}</span>}
                added={justAdded === fx.id}
                onReset={() => writeEffects(effects.filter((e) => e.id !== fx.id))}
                canReset
              >
                <Row label="Preset">
                  <Select
                    height={24}
                    value={fx.preset}
                    onChange={(v) => writeEffects(setEffectPreset({ ...item, effects }, fx.kind, v as AnimationPreset, fx.durationInFrames))}
                    options={presets.filter((p) => p.id !== "none").map((p) => ({ value: p.id, label: p.label }))}
                  />
                </Row>
                <Row label="Length">
                  <Scalar
                    value={fx.durationInFrames} min={1} max={120}
                    onChange={(n) => writeEffects(setEffectPreset({ ...item, effects }, fx.kind, fx.preset, Math.max(1, Math.round(n))))}
                  />
                </Row>
                {i > 0 && (
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      onClick={() => writeEffects(reorderEffects(effects, i, i - 1))}
                      className="t-caption"
                      style={{ background: "transparent", border: "none", color: "var(--ink-tertiary)", cursor: "pointer", padding: 0 }}
                    >
                      Move up
                    </button>
                  </div>
                )}
              </Section>
            );
          })}

          {item.type === "video" && projectId && (
            <GradeSection doc={doc} item={item as VideoItem} projectId={projectId} onChange={onChange} />
          )}

          {/* ── add effect ── */}
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
              Effects apply top to bottom. Switching one off keeps its values.
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
 * Multi-selection. Shared values edit normally; differing ones read "Mixed"
 * rather than lying about one clip's value standing for all of them.
 */
function MultiSelection({
  doc, ids, onChange,
}: {
  doc: EditorDoc; ids: string[];
  onChange: (next: EditorDoc, opts?: { transient?: boolean }) => void;
}) {
  const items = ids.map((id) => findItem(doc, id)?.item).filter(Boolean) as EditorItem[];
  const shared = <K extends keyof EditorItem["layout"]>(k: K): number | "mixed" => {
    const first = items[0]?.layout[k] ?? 0;
    return items.every((i) => (i.layout[k] ?? 0) === first) ? (first as number) : "mixed";
  };
  const setAll = (k: "x" | "y" | "opacity", v: number) => {
    let next = doc;
    for (const i of items) next = setLayout(next, i.id, { [k]: v });
    onChange(next);
  };

  const x = shared("x"), y = shared("y"), op = shared("opacity");
  return (
    <div style={{ padding: "8px 8px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
      <Row label="Position">
        {x === "mixed" || y === "mixed" ? <Mixed /> : (
          <Vector x={x} y={y} onX={(n) => setAll("x", n)} onY={(n) => setAll("y", n)} />
        )}
      </Row>
      <Row label="Opacity">
        {op === "mixed" ? <Mixed /> : (
          <Scalar value={Math.round((op ?? 1) * 100)} min={0} max={100} suffix="%" onChange={(n) => setAll("opacity", n / 100)} />
        )}
      </Row>
      <div style={{ height: 1, background: "var(--border-hairline)", margin: "6px 0" }} />
      <div className="t-caption" style={{ color: "var(--ink-tertiary)" }}>
        {items.length} clips selected. Shared values edit together.
      </div>
    </div>
  );
}

function Mixed() {
  return (
    <div className="t-caption" style={{ ...FIELD, display: "grid", placeItems: "center", color: "var(--ink-tertiary)" }}>
      Mixed
    </div>
  );
}
