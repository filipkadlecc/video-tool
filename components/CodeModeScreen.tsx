"use client";

import React, { useMemo } from "react";
import Icon from "@/components/ui/Icon";
import CodeEditor from "@/components/CodeEditor";
import { sceneJsonText, sceneProblems } from "@/lib/scene-json";
import { findItem, updateItem, type EditorDoc, type SceneItem } from "@/lib/editor-doc";
import { timecode, needsHours } from "@/lib/timecode";

/**
 * `6a` — the composition as `scene.json`, beside the thing it describes.
 *
 * Code mode used to drop the scene into the panel the timeline normally
 * occupies and leave the rest of the editor standing. Two consequences, one
 * cosmetic and one a real bug: the code got a third of the screen while the
 * preview kept two-thirds of it doing nothing, and the preview — gated on the
 * document being visible — fell through to the legacy scene-code path, which
 * for a project born as a timeline is empty. Opening code mode BLANKED the
 * preview.
 *
 * So code mode is its own screen: the text on the left with the problems it
 * has underneath, the picture and the selection on the right, the timeline as a
 * strip along the bottom.
 *
 * ── One selection, three views ───────────────────────────────────────────────
 *
 * The selected clip is highlighted in the code, in the strip and in the
 * preview, and clicking any one of them moves the other two. That is the whole
 * argument for a code view living inside an editor rather than beside it: the
 * clip in the text and the clip on the timeline have to be obviously the same
 * clip, or the text is just a report.
 */

interface Props {
  doc: EditorDoc;
  selectedIds: Set<string>;
  onSelectionChange: (next: Set<string>) => void;
  /** Editing a scene's source changes the document, so the page commits it. */
  onChange: (doc: EditorDoc) => void;
  /** The live preview — passed in so the page keeps its player wiring. */
  preview: React.ReactNode;
  /** The collapsed timeline along the bottom. */
  strip: React.ReactNode;
  /** "Saved" / "Saving…" — the same state the toolbar badge reports. */
  saveLabel?: string;
}

export default function CodeModeScreen({
  doc, selectedIds, onSelectionChange, onChange, preview, strip, saveLabel,
}: Props) {
  /*
   * WHICH code you are looking at.
   *
   * An animation in this editor is a `scene` block holding its own TSX, and for
   * most projects the whole composition IS one such block. Showing those the
   * composition JSON meant showing a wrapper — "one clip, 0 to 529" — and
   * hiding the only thing you would open a code view to change. So: if the
   * selection (or the document) comes down to a single scene, this is that
   * scene's source, and it is editable. That is the point of a code view.
   *
   * A real cut — footage, titles, several tracks — has no hand-written source
   * to show, and the composition remains the honest readout.
   */
  const scenes = useMemo(
    () => doc.tracks.flatMap((t) => t.items.filter((i): i is SceneItem => i.type === "scene")),
    [doc],
  );
  const selectedScene = useMemo(() => {
    if (selectedIds.size === 1) {
      const found = findItem(doc, [...selectedIds][0]);
      if (found?.item.type === "scene") return found.item as SceneItem;
    }
    return scenes.length === 1 ? scenes[0] : null;
  }, [doc, selectedIds, scenes]);

  const { text, lines } = useMemo(() => sceneJsonText(doc), [doc]);
  const problems = useMemo(() => sceneProblems(doc, lines), [doc, lines]);

  const selectedId = selectedIds.size === 1 ? [...selectedIds][0] : null;
  const selected = selectedId ? findItem(doc, selectedId) : null;
  const highlight = selectedId ? lines[selectedId] ?? null : null;

  /** A line number back to the clip whose block contains it. */
  const clipAtLine = (line: number): string | null => {
    for (const [id, [from, to]] of Object.entries(lines)) {
      if (line >= from && line <= to) return id;
    }
    return null;
  };

  const fps = doc.size.fps;
  const hours = selected ? needsHours(selected.item.from + selected.item.durationInFrames, fps) : false;

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", background: "var(--surface-void)" }}>
      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
        {/* Left: the composition, and what is wrong with it. */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", borderRight: "1px solid var(--border-hairline)" }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            <CodeEditor
              code={selectedScene ? selectedScene.code : text}
              onChange={(next) => {
                if (!selectedScene) return;
                onChange(updateItem<SceneItem>(doc, selectedScene.id, { code: next }));
              }}
              language={selectedScene ? "typescript" : "json"}
              filename={selectedScene ? "scene.tsx" : "scene.json"}
              readOnly={!selectedScene}
              highlight={selectedScene ? null : highlight}
              warnLines={selectedScene ? [] : problems.map((p) => p.line)}
              onLineClick={selectedScene ? undefined : (line) => {
                const id = clipAtLine(line);
                onSelectionChange(id ? new Set([id]) : new Set());
              }}
              header={
                <div
                  style={{
                    display: "flex", alignItems: "center", gap: 8, height: 36, flexShrink: 0,
                    padding: "0 12px", borderBottom: "1px solid var(--border-hairline)",
                    background: "var(--surface-chrome)",
                  }}
                >
                  <span className="t-section" style={{ color: "var(--ink-tertiary)" }}>
                    {selectedScene ? "Scene" : "Composition"}
                  </span>
                  <span className="t-data-s" style={{ color: "var(--ink-secondary)" }}>
                    {selectedScene ? "scene.tsx" : "scene.json"}
                  </span>
                  {!selectedScene && (
                    <span className="t-caption" style={{ color: "var(--ink-disabled)" }}>read-only</span>
                  )}
                  {selectedScene && scenes.length > 1 && (
                    <span className="t-caption" style={{ color: "var(--ink-disabled)" }}>
                      the selected block
                    </span>
                  )}
                  <div style={{ flex: 1 }} />
                  {problems.length > 0 && (
                    <span
                      className="t-data-s"
                      style={{
                        display: "inline-flex", alignItems: "center", height: 20, padding: "0 8px",
                        borderRadius: "var(--r-pill)", color: "var(--warning)",
                        background: "rgba(233,169,58,0.12)",
                      }}
                    >
                      {problems.length} {problems.length === 1 ? "warning" : "warnings"}
                    </span>
                  )}
                  <span className="t-data-s" style={{ color: "var(--ink-disabled)" }}>{saveLabel ?? "saved"}</span>
                </div>
              }
            />
          </div>

          {/*
            The problems strip. Every row is clickable, because a problem you
            can read but not get to is only half a report.
          */}
          <div
            style={{
              flexShrink: 0, height: 88, overflowY: "auto",
              background: "var(--surface-chrome)", borderTop: "1px solid var(--border-hairline)",
            }}
            className="vt-scroll"
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, height: 28, padding: "0 12px" }}>
              <span className="t-section" style={{ color: "var(--ink-tertiary)" }}>Problems</span>
              <span className="t-data-s" style={{ color: problems.length ? "var(--warning)" : "var(--ink-disabled)" }}>
                {problems.length}
              </span>
            </div>
            {problems.length === 0 ? (
              <div className="t-caption" style={{ padding: "0 12px 8px", color: "var(--ink-disabled)" }}>
                Nothing wrong with this composition.
              </div>
            ) : (
              problems.map((p, i) => (
                <button
                  key={i}
                  onClick={() => onSelectionChange(p.itemId ? new Set([p.itemId]) : new Set())}
                  style={{
                    display: "flex", gap: 8, width: "100%", textAlign: "left",
                    padding: "0 12px 8px", background: "none", border: "none", cursor: "pointer",
                  }}
                >
                  <Icon name="warn" size={14} style={{ color: "var(--warning)", flexShrink: 0, marginTop: 2 }} />
                  <span>
                    <span className="t-body" style={{ color: "var(--ink-primary)", display: "block" }}>
                      Line {p.line} · {p.message}
                    </span>
                    <span className="t-caption" style={{ color: "var(--ink-tertiary)" }}>{p.remedy}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right, 560px: the picture, then what you have selected in the text. */}
        <div style={{ width: 560, flexShrink: 0, display: "flex", flexDirection: "column", background: "var(--surface-chrome)" }}>
          <div style={{ padding: 20, background: "var(--surface-void)", minHeight: 0, flexShrink: 0, height: 360 }}>
            <div style={{ height: "100%", position: "relative", overflow: "hidden" }}>{preview}</div>
          </div>

          <div
            style={{
              display: "flex", alignItems: "center", gap: 8, height: 36, flexShrink: 0,
              padding: "0 12px", borderTop: "1px solid var(--border-hairline)",
              borderBottom: "1px solid var(--border-hairline)",
            }}
          >
            <span className="t-section" style={{ color: "var(--ink-tertiary)" }}>Selected in code</span>
            <div style={{ flex: 1 }} />
            {highlight && (
              <span className="t-data-s" style={{ color: "var(--ink-disabled)" }}>
                {highlight[0] === highlight[1] ? `line ${highlight[0]}` : `lines ${highlight[0]}–${highlight[1]}`}
              </span>
            )}
          </div>

          <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {selected ? (
              <>
                <Row label="Clip" value={clipName(doc, selected.item)} />
                <Row
                  label="Timing"
                  value={`${timecode(selected.item.from, fps, hours)} → ${timecode(selected.item.from + selected.item.durationInFrames, fps, hours)}`}
                  meta={`${selected.item.durationInFrames}f`}
                />
                <Row label="Track" value={selected.track.name} />
              </>
            ) : (
              <span className="t-caption" style={{ color: "var(--ink-disabled)" }}>
                {selectedIds.size > 1 ? `${selectedIds.size} clips selected.` : "Nothing selected."}
              </span>
            )}
            <span className="t-caption" style={{ color: "var(--ink-disabled)", lineHeight: 1.5 }}>
              {selectedScene
                ? "This is the animation's own source. Edit it and the preview follows — it is the same file the assistant writes, so anything you change here survives the next thing it does."
                : "Selecting a clip in the timeline scrolls the code to it, and clicking a line selects the clip — one selection, two views. A cut has no hand-written source, so the composition is a readout: edits happen on the timeline."}
            </span>
          </div>
        </div>
      </div>

      <div style={{ height: 152, flexShrink: 0, borderTop: "1px solid var(--border-edge)" }}>{strip}</div>
    </div>
  );
}

function clipName(doc: EditorDoc, item: { type: string; id: string }): string {
  if (item.type === "text") return (item as unknown as { text: string }).text;
  const assetId = (item as unknown as { assetId?: string }).assetId;
  const asset = assetId ? doc.assets.find((a) => a.id === assetId) : undefined;
  return asset?.name ?? item.type;
}

function Row({ label, value, meta }: { label: string; value: string; meta?: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "72px minmax(0,1fr)", alignItems: "center", gap: 8 }}>
      <span className="t-control" style={{ color: "var(--ink-tertiary)" }}>{label}</span>
      <span
        style={{
          display: "flex", alignItems: "center", gap: 8, height: 28, padding: "0 10px",
          background: "var(--surface-raised)", border: "1px solid var(--border-hairline)",
          borderRadius: "var(--r-control)", minWidth: 0,
        }}
      >
        <span
          className="t-data-m"
          style={{ color: "var(--ink-primary)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          {value}
        </span>
        {meta && <span className="t-data-s" style={{ color: "var(--ink-tertiary)" }}>{meta}</span>}
      </span>
    </div>
  );
}
