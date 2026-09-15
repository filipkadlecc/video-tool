"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { presetsFor, type AnimationPreset } from "@/lib/editor-effects";

/**
 * 7b — the add-effect palette. Search-first, because by the time a list is long
 * enough to need categories it is long enough to be worth typing into.
 *
 * The spec's Look / Motion / Time grouping doesn't map onto this app's
 * vocabulary — every effect it has is an entrance or an exit — so results are
 * grouped by EDGE, which is the distinction that actually exists here. Each
 * result carries the preset's own hint as the line saying what it will do; that
 * text already existed and was only being shown in a dropdown nobody read.
 *
 * An effect already on the clip says so rather than silently duplicating.
 */
export interface EffectChoice {
  kind: "animateIn" | "animateOut";
  preset: AnimationPreset;
}

export default function AddEffectPopover({
  itemType, existing, onPick, onClose,
}: {
  itemType: string;
  /** Edges already on the clip. */
  existing: ("animateIn" | "animateOut")[];
  onPick: (choice: EffectChoice) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  /**
   * The highlighted row, derived rather than reset in an effect — resetting
   * state from an effect on every keystroke is a cascading render, and the
   * answer is simply "if the query changed, the selection is 0".
   */
  const [activeState, setActiveState] = useState({ q: "", i: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows: { key: string; kind: "animateIn" | "animateOut"; preset: AnimationPreset; label: string; hint: string; taken: boolean }[] = [];
    for (const kind of ["animateIn", "animateOut"] as const) {
      for (const p of presetsFor(itemType)) {
        if (p.id === "none") continue;
        const label = `${p.label} ${kind === "animateIn" ? "arrives" : "leaves"}`;
        if (q && !label.toLowerCase().includes(q) && !p.hint.toLowerCase().includes(q)) continue;
        rows.push({ key: `${kind}:${p.id}`, kind, preset: p.id, label, hint: p.hint, taken: existing.includes(kind) });
      }
    }
    return rows;
  }, [query, itemType, existing]);


  const active = activeState.q === query ? activeState.i : 0;
  const setActive = (i: number | ((p: number) => number)) =>
    setActiveState((p) => ({ q: query, i: typeof i === "function" ? i(p.q === query ? p.i : 0) : i }));

  const grouped = useMemo(() => ({
    Arrives: results.filter((r) => r.kind === "animateIn"),
    Leaves: results.filter((r) => r.kind === "animateOut"),
  }), [results]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(results.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const r = results[active];
      if (r) onPick({ kind: r.kind, preset: r.preset });
    }
  };

  let index = -1;

  return (
    <div
      onKeyDown={onKeyDown}
      style={{
        width: 360, padding: 4,
        background: "var(--surface-raised)",
        border: "1px solid var(--border-edge)",
        borderRadius: "var(--r-panel)",
        boxShadow: "var(--shadow-float)",
      }}
    >
      <div
        style={{
          display: "flex", alignItems: "center", gap: 8, height: 30,
          padding: "0 8px", marginBottom: 4,
          background: "var(--surface-void)",
          border: "1px solid var(--border-hairline)",
          borderRadius: "var(--r-control)",
        }}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search effects"
          className="t-control"
          style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: "var(--ink-primary)" }}
        />
        <span className="t-data-s" style={{ color: "var(--ink-disabled)" }}>esc</span>
      </div>

      <div className="vt-scroll" style={{ maxHeight: 280, overflowY: "auto" }}>
        {results.length === 0 && (
          <div className="t-caption" style={{ color: "var(--ink-tertiary)", padding: 8 }}>
            Nothing matches “{query}”.
          </div>
        )}
        {(Object.entries(grouped) as [string, typeof results][]).map(([group, rows]) =>
          rows.length === 0 ? null : (
            <div key={group}>
              <div className="t-section" style={{ color: "var(--ink-tertiary)", padding: "8px 8px 4px" }}>{group}</div>
              {rows.map((r) => {
                index += 1;
                const isActive = index === active;
                return (
                  <button
                    key={r.key}
                    onMouseEnter={() => setActive(results.indexOf(r))}
                    onClick={() => onPick({ kind: r.kind, preset: r.preset })}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, width: "100%",
                      padding: "7px 8px", textAlign: "left", cursor: "pointer",
                      background: isActive ? "var(--surface-hover)" : "transparent",
                      border: "none", borderRadius: "var(--r-item)",
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="t-control" style={{ color: "var(--ink-primary)", display: "block" }}>
                        <Highlight text={r.label} query={query} />
                      </span>
                      <span className="t-caption" style={{ color: "var(--ink-tertiary)", display: "block", marginTop: 2 }}>
                        {r.taken ? "Already on this clip — this replaces it." : r.hint}
                      </span>
                    </span>
                    {isActive && <span className="t-data-s" style={{ color: "var(--ink-tertiary)" }}>↵</span>}
                  </button>
                );
              })}
            </div>
          ),
        )}
      </div>

      <div
        style={{
          display: "flex", alignItems: "center", height: 28, padding: "0 8px", marginTop: 4,
          background: "var(--surface-chrome)", borderTop: "1px solid var(--border-hairline)",
        }}
      >
        <span className="t-data-s" style={{ color: "var(--ink-tertiary)" }}>↑↓ move · ↵ add</span>
        <div style={{ flex: 1 }} />
        <span className="t-data-s" style={{ color: "var(--ink-disabled)" }}>{results.length} effects</span>
      </div>
    </div>
  );
}

/** The matched substring, marked in brand tint. */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const at = text.toLowerCase().indexOf(q.toLowerCase());
  if (at === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <span style={{ background: "rgba(248,102,6,0.28)", borderRadius: 2 }}>{text.slice(at, at + q.length)}</span>
      {text.slice(at + q.length)}
    </>
  );
}
