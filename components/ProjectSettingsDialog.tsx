"use client";

import React, { useEffect, useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { docDuration, resizeDoc, retimeDoc, type EditorDoc } from "@/lib/editor-doc";
import { timecode, needsHours } from "@/lib/timecode";

/**
 * `5h` — project settings: the frame, the rate, the length and the ground.
 *
 * None of these could be changed after a project was created. The frame and
 * rate were picked in the new-project wizard and then fixed for good, and the
 * only thing resembling a way out — "Convert ratio" — creates a NEW project
 * rather than changing this one.
 *
 * Two of the four fields do real work to the composition, so they say so:
 *
 * - **Frame** re-lays everything out (`resizeDoc`). Positions are composition
 *   pixels, so a title centred in 2560×1440 is off to the left in 1080×1920
 *   unless it moves. It cannot be perfect — a layout composed for one shape is
 *   not automatically right in another — hence the warning and a preview you
 *   can look at before you commit.
 * - **Frame rate** re-times everything (`retimeDoc`), so the video lasts the
 *   same number of SECONDS. Changing fps without re-timing silently halves or
 *   doubles every duration, which is the sort of thing you discover in an
 *   export.
 *
 * **Duration is read-only** and says why: it is the end of the last clip. An
 * explicit duration would be a second source of truth for the same fact, and
 * the two would disagree the first time you trimmed something.
 */

/** The rates the project format knows (lib/types.ts FPS). Not a free number. */
const RATES = [24, 25, 30, 50];

export default function ProjectSettingsDialog({
  open, onClose, doc, projectName, onPreview, onApply,
}: {
  open: boolean;
  onClose: () => void;
  doc: EditorDoc;
  projectName: string;
  /** Show a change without committing it — reverted if you cancel. */
  onPreview: (doc: EditorDoc) => void;
  /** Commit, with the settings the project should also store. */
  onApply: (doc: EditorDoc, settings: { width: number; height: number; fps: number }) => void;
}) {
  // The document as it was when the dialog opened, so Cancel can put it back
  // even after a preview has been applied.
  const [original, setOriginal] = useState(doc);
  const [width, setWidth] = useState(String(doc.size.width));
  const [height, setHeight] = useState(String(doc.size.height));
  const [fps, setFps] = useState(doc.size.fps);
  const [background, setBackground] = useState(doc.background ?? "#000000");
  const [previewed, setPreviewed] = useState(false);

  useEffect(() => {
    if (!open) return;
    setOriginal(doc);
    setWidth(String(doc.size.width));
    setHeight(String(doc.size.height));
    setFps(doc.size.fps);
    setBackground(doc.background ?? "#000000");
    setPreviewed(false);
    // Only when the dialog opens: re-syncing while a preview is showing would
    // overwrite what you are looking at.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const w = Math.round(Number(width));
  const h = Math.round(Number(height));
  const valid = Number.isFinite(w) && Number.isFinite(h) && w >= 16 && h >= 16 && w <= 8192 && h <= 8192;

  const frameChanged = valid && (w !== original.size.width || h !== original.size.height);
  const rateChanged = fps !== original.size.fps;
  const bgChanged = (background || "#000000") !== (original.background ?? "#000000");
  const dirty = frameChanged || rateChanged || bgChanged;

  /** What the document becomes. Built the same way for preview and for apply. */
  const next = useMemo(() => {
    let out = original;
    if (valid && (w !== original.size.width || h !== original.size.height)) out = resizeDoc(out, w, h);
    if (fps !== original.size.fps) out = retimeDoc(out, fps);
    if ((background || "#000000") !== (original.background ?? "#000000")) out = { ...out, background };
    return out;
  }, [original, valid, w, h, fps, background]);

  /** Everything with a position is affected by a frame change — count it. */
  const positioned = original.tracks.reduce((n, t) => n + t.items.length, 0);

  const total = docDuration(next);
  const hours = needsHours(total, next.size.fps);

  const cancel = () => {
    if (previewed) onPreview(original);
    onClose();
  };

  return (
    <Modal
      open={open}
      padded
      width={560}
      onClose={cancel}
      title="Project settings"
      subtitle={projectName}
      footer={
        <>
          <div style={{ flex: 1 }} />
          <Button size="dialog" variant="ghost" onClick={cancel}>Cancel</Button>
          <Button
            size="dialog"
            variant="primary"
            disabled={!dirty || !valid}
            onClick={() => { onApply(next, { width: next.size.width, height: next.size.height, fps: next.size.fps }); onClose(); }}
          >
            Apply
          </Button>
        </>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Field label="Frame">
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Input value={width} onChange={setWidth} mono style={{ flex: 1, minWidth: 0 }} />
            <span className="t-data-s" style={{ color: "var(--ink-disabled)", flexShrink: 0 }}>×</span>
            <Input value={height} onChange={setHeight} mono style={{ flex: 1, minWidth: 0 }} />
          </div>
        </Field>

        <Field label="Frame rate">
          <Select
            value={String(fps)}
            onChange={(v) => setFps(Number(v))}
            options={RATES.map((r) => ({ value: String(r), label: `${r} fps` }))}
          />
        </Field>

        <Field label="Duration" hint="Set by the last clip on the timeline.">
          <Input value={timecode(total, next.size.fps, hours)} onChange={() => {}} disabled mono suffix={`${total}f`} />
        </Field>

        <Field label="Background" hint="Shows wherever nothing is drawn.">
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <label
              style={{
                width: 28, height: 28, borderRadius: "var(--r-control)", flexShrink: 0,
                border: "1px solid var(--border-edge)", background: background || "#000000",
                cursor: "pointer", position: "relative", overflow: "hidden",
              }}
            >
              <input
                type="color"
                value={/^#[0-9a-f]{6}$/i.test(background) ? background : "#000000"}
                onChange={(e) => setBackground(e.target.value)}
                style={{ position: "absolute", inset: -4, opacity: 0, cursor: "pointer" }}
              />
            </label>
            <Input value={background} onChange={setBackground} />
          </div>
        </Field>
      </div>

      {frameChanged && (
        <div
          style={{
            display: "flex", gap: 10, marginTop: 16, padding: 12,
            background: "var(--surface-raised)", border: "1px solid var(--warning-tint-line)",
            borderRadius: "var(--r-panel)",
          }}
        >
          <Icon name="warn" size={16} style={{ color: "var(--warning)", flexShrink: 0, marginTop: 1 }} />
          <div className="t-body" style={{ color: "var(--ink-primary)", lineHeight: 1.5 }}>
            Changing the frame re-lays out {positioned} positioned{" "}
            {positioned === 1 ? "element" : "elements"}.{" "}
            <button
              onClick={() => { onPreview(next); setPreviewed(true); }}
              style={{
                background: "none", border: "none", padding: 0, cursor: "pointer",
                color: "var(--ink-primary)", fontWeight: 600, textDecoration: "underline",
                font: "inherit",
              }}
            >
              {previewed ? "Preview again" : "Preview the change"}
            </button>{" "}
            before you apply it.
          </div>
        </div>
      )}

      {rateChanged && (
        <div className="t-caption" style={{ color: "var(--ink-tertiary)", marginTop: 12, lineHeight: 1.5 }}>
          Every clip and keyframe is re-timed to {fps} fps, so the video still runs{" "}
          {timecode(total, next.size.fps, hours)}.
        </div>
      )}
    </Modal>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <span className="t-control" style={{ color: "var(--ink-secondary)" }}>{label}</span>
      {children}
      {hint && <span className="t-caption" style={{ color: "var(--ink-disabled)" }}>{hint}</span>}
    </div>
  );
}
