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

const GROUPS: Group[] = [
  {
    title: "Playback",
    rows: [
      { label: "Play / pause", keys: ["Space"] },
      { label: "Move playhead 1 frame", keys: ["←", "→"] },
      { label: "Jump 10 frames", keys: ["Shift", "~+", "←", "→"] },
      { label: "Jump to start / end", keys: ["Home", "End"] },
      { label: "Scrub", keys: ["~click / drag the ruler"] },
    ],
  },
  {
    title: "Editing",
    rows: [
      { label: "Split clip at playhead", keys: ["S", "~or", "⌘K"] },
      { label: "Split where the cursor is", keys: ["Alt", "~+ click a clip"], only: "code" },
      { label: "Delete clip + close gap", keys: ["Delete"] },
      { label: "Copy / paste at playhead", keys: ["⌘C", "⌘V"], only: "doc" },
      { label: "Duplicate", keys: ["⌘D"], only: "doc" },
      { label: "Trim / move", keys: ["~drag a clip's edges or body"] },
      { label: "Move to another track", keys: ["~drag a clip up or down"], only: "doc" },
      { label: "More actions", keys: ["~right-click a clip"], only: "code" },
    ],
  },
  {
    title: "Selection & view",
    rows: [
      { label: "Select several clips", keys: ["Shift", "~or", "⌘", "~+ click"] },
      { label: "Deselect", keys: ["Esc"] },
      { label: "Zoom", keys: ["⌘", "~+ scroll"] },
      { label: "Fit to window", keys: ["F"] },
      { label: "Snap on / off", keys: ["~the SNAP button, above"] },
    ],
  },
  {
    title: "Canvas & panels",
    rows: [
      { label: "Edit a text layer in place", keys: ["~double-click it on the canvas"], only: "doc" },
      { label: "Set an entrance / exit", keys: ["~drag an effect onto a clip's left / right half"], only: "doc" },
      { label: "Import footage", keys: ["~drop files on a track, or ⌘I in Footage"], only: "doc" },
    ],
  },
  {
    // Registered on the project page, so they work in both editors — and were
    // documented in neither sheet before.
    title: "Anywhere in a project",
    rows: [
      { label: "Save now", keys: ["⌘S"] },
      { label: "Export", keys: ["⌘E"] },
      { label: "Undo / redo", keys: ["⌘Z", "⌘⇧Z"] },
      { label: "Cut / Direct workspace", keys: ["⌥1", "⌥2"], only: "doc" },
      { label: "Code view", keys: ["⌥⌘C"], only: "doc" },
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
                {group.rows.map((row, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                    <span style={{ fontSize: 13, color: "var(--ink-secondary)", flex: 1, minWidth: 0 }}>
                      {row.label}
                    </span>
                    <span style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
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
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </Modal>
  );
}
