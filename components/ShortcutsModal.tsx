"use client";

import React from "react";
import Modal from "@/components/ui/Modal";
import Kbd from "@/components/ui/Kbd";

/**
 * One shortcut sheet for both timelines.
 *
 * There used to be two, written months apart and drifting: the code timeline's
 * list never mentioned ⌘C/⌘V/⌘D or anything on the canvas, the visual editor's
 * never mentioned Alt-click split, and neither listed the app-level keys (save,
 * export, undo) that work in both. Whichever editor you happened to open taught
 * you a different subset of the app.
 *
 * Everything listed is something the app actually implements — an aspirational
 * shortcut sheet is worse than none. Rows that only exist in one editor carry
 * `only`, so this stays truthful rather than becoming a superset nobody can act
 * on.
 */

export type TimelineKind = "doc" | "code";

/** A leading "~" marks prose (a mouse gesture) rather than a key to press. */
type Row = { label: string; keys: string[]; only?: TimelineKind };
type Group = { title: string; rows: Row[] };

/*
 * Three groups, named for the three questions you arrive with: how do I move
 * around, how do I change the cut, how do I move around the app.
 *
 * They used to be five — Playback, Editing, Selection & view, Canvas & panels,
 * Anywhere in a project — which is a taxonomy of where the code lives rather
 * than of what you are trying to do.
 */
const GROUPS: Group[] = [
  {
    title: "Transport",
    rows: [
      { label: "Play / pause", keys: ["Space"] },
      { label: "Step one frame", keys: ["←", "→"] },
      { label: "Step ten frames", keys: ["Shift", "~+", "←", "→"] },
      { label: "Jump to start / end", keys: ["Home", "End"] },
      // Implemented since v0.1.100, used by the export dialog's own copy, and
      // listed nowhere until now.
      { label: "Set in / out", keys: ["I", "O"], only: "doc" },
      { label: "Clear in / out", keys: ["⇧X"], only: "doc" },
      { label: "Scrub", keys: ["~click / drag the ruler"] },
      { label: "Fit preview", keys: ["F"] },
    ],
  },
  {
    title: "Editing",
    rows: [
      { label: "Split at playhead", keys: ["S", "~or", "⌘K"] },
      { label: "Split where the cursor is", keys: ["Alt", "~+ click a clip"], only: "code" },
      { label: "Delete clip + close gap", keys: ["Delete"] },
      { label: "Copy / paste at playhead", keys: ["⌘C", "⌘V"], only: "doc" },
      { label: "Duplicate clip", keys: ["⌘D"], only: "doc" },
      { label: "Trim / move", keys: ["~drag a clip's edges or body"] },
      { label: "Move to another track", keys: ["~drag a clip up or down"], only: "doc" },
      { label: "Select several clips", keys: ["Shift", "~or", "⌘", "~+ click"] },
      { label: "Deselect", keys: ["Esc"] },
      { label: "Edit a text layer in place", keys: ["~double-click it on the canvas"], only: "doc" },
      { label: "Set an entrance / exit", keys: ["~drag an effect onto a clip's left / right half"], only: "doc" },
      { label: "More actions", keys: ["~right-click a clip"], only: "code" },
      { label: "Undo / redo", keys: ["⌘Z", "⌘⇧Z"] },
    ],
  },
  {
    title: "Workspace",
    rows: [
      { label: "Cut / Direct", keys: ["⌥1", "⌥2"], only: "doc" },
      { label: "Code view", keys: ["⌥⌘C"], only: "doc" },
      { label: "Zoom the timeline", keys: ["⌘", "~+ scroll"] },
      { label: "Snap on / off", keys: ["~the Snap toggle, above"] },
      { label: "Import footage", keys: ["~drop files on a track, or ⌘I in Footage"], only: "doc" },
      { label: "Save now", keys: ["⌘S"] },
      { label: "Export", keys: ["⌘E"] },
      { label: "This sheet", keys: ["⌘/"] },
    ],
  },
];

export default function ShortcutsModal({
  open,
  onClose,
  kind,
}: {
  open: boolean;
  onClose: () => void;
  kind: TimelineKind;
}) {
  const groups = GROUPS.map((g) => ({
    ...g,
    rows: g.rows.filter((r) => !r.only || r.only === kind),
  })).filter((g) => g.rows.length > 0);

  /*
   * Three columns, because the sheet is a reference you scan rather than read:
   * you already know whether you want a transport key, an editing key or a
   * workspace key, so the column IS the first filter. A single list makes you
   * read all of it every time.
   *
   * Groups are packed into whichever column is shortest so the three end up
   * roughly level, rather than one running long and leaving the others empty.
   */
  const columns: typeof groups[] = [[], [], []];
  const heights = [0, 0, 0];
  for (const g of groups) {
    const shortest = heights.indexOf(Math.min(...heights));
    columns[shortest].push(g);
    heights[shortest] += g.rows.length + 1;
  }

  return (
    <Modal open={open} onClose={onClose} padded title="Keyboard shortcuts" width={700}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 24 }}>
        {columns.map((col, ci) => (
          <div key={ci} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {col.map((group) => (
              <div key={group.title} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span className="t-section" style={{ color: "var(--ink-tertiary)" }}>{group.title}</span>
                {group.rows.map((row, i) => {
                  /*
                   * A row whose "keys" are a sentence — a mouse gesture — puts
                   * that sentence on its own line. Side by side in a 210px
                   * column, a long label and a long sentence fought each other
                   * down to one word per line.
                   */
                  const prose = row.keys.length === 1 && row.keys[0].startsWith("~");
                  return (
                    <div
                      key={i}
                      style={{
                        display: "flex", gap: prose ? 2 : 10,
                        flexDirection: prose ? "column" : "row",
                        alignItems: prose ? "stretch" : "baseline",
                      }}
                    >
                      <span style={{ fontSize: 13, color: "var(--ink-secondary)", flex: prose ? undefined : 1, minWidth: 0 }}>
                        {row.label}
                      </span>
                      <span style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0, flexWrap: "wrap" }}>
                        {row.keys.map((k, j) =>
                          k.startsWith("~") ? (
                            <span className="t-caption" key={j} style={{ color: "var(--ink-disabled)" }}>
                              {k.slice(1)}
                            </span>
                          ) : (
                            <Kbd key={j}>{k}</Kbd>
                          ),
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
    </Modal>
  );
}
