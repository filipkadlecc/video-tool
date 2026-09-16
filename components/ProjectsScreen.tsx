"use client";

import React, { useMemo, useState } from "react";
import type { ProjectMeta, Collection } from "@/lib/types";
import { docDuration } from "@/lib/editor-doc";
import { getProjectSize } from "@/lib/types";
import { relativeTime, shortDate } from "@/lib/format";
import { timecode, needsHours } from "@/lib/timecode";
import ParallaxCard from "@/components/ui/ParallaxCard";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import IconButton from "@/components/ui/IconButton";
import Select from "@/components/ui/Select";
import Segmented from "@/components/ui/Segmented";
import Menu from "@/components/ui/Menu";

/**
 * 4b — the project grid, with a collections rail and a selection bar.
 *
 * The selection bar is the point: the old app could only act on ONE project at
 * a time, from a row menu, which made bulk collection work impossible.
 */

type SortKey = "edited" | "created" | "name";

function durationLabel(p: ProjectMeta): string {
  const fps = p.settings.fps || 25;
  // The document knows exactly; otherwise listProjects has already read the
  // duration out of the legacy code, so a list never has to evaluate anything.
  const total = p.doc ? docDuration(p.doc) : p.durationInFrames ?? 0;
  if (!total) return "—";
  return timecode(total, fps, needsHours(total, fps));
}

/** Real pixels. settings.width/height are a bespoke override and are almost
 *  never set — the size comes from the resolution/orientation pair. */
function sizeLabel(p: ProjectMeta): string {
  const { width, height } = getProjectSize(p.settings);
  return `${width}×${height}`;
}

export default function ProjectsScreen({
  title, projects, collections, activeCollectionId, unfiledCount,
  onOpen, onSelectCollection, onNewCollection, onNewProject,
  onAssign, onAssignNew, onDuplicate, onDelete,
}: {
  title: string;
  projects: ProjectMeta[];
  collections: Collection[];
  activeCollectionId: string | null;
  unfiledCount: number;
  onOpen: (id: string) => void;
  onSelectCollection: (c: Collection | null) => void;
  onNewCollection: () => void;
  onNewProject: () => void;
  onAssign: (ids: string[], collectionId: string | null) => void;
  onAssignNew: (ids: string[]) => void;
  onDuplicate: (ids: string[]) => void;
  onDelete: (ids: string[]) => void;
}) {
  const [sort, setSort] = useState<SortKey>("edited");
  const [view, setView] = useState<string | number>("cards");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const sorted = useMemo(() => {
    const list = [...projects];
    if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "created") list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    else list.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
    return list;
  }, [projects, sort]);

  const countsByCollection = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of projects) if (p.collectionId) c[p.collectionId] = (c[p.collectionId] ?? 0) + 1;
    return c;
  }, [projects]);

  const toggle = (id: string, additive: boolean) => {
    setSelected((prev) => {
      const next = additive ? new Set(prev) : new Set<string>();
      if (prev.has(id) && additive) next.delete(id); else next.add(id);
      return next;
    });
  };

  const ids = [...selected];

  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
      {/* Collections rail */}
      <aside
        style={{
          width: 248, flexShrink: 0, display: "flex", flexDirection: "column",
          background: "var(--surface-chrome)", borderRight: "1px solid var(--border-hairline)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", height: 40, padding: "0 8px 0 16px" }}>
          <span className="t-section" style={{ color: "var(--ink-tertiary)", flex: 1 }}>Collections</span>
          <IconButton icon="plus" size={24} onClick={onNewCollection} title="New collection" />
        </div>

        <div className="vt-scroll" style={{ overflowY: "auto", flex: 1 }}>
          <RailRow
            label={title}
            count={projects.length}
            active={activeCollectionId === null}
            onClick={() => onSelectCollection(null)}
          />
          {collections.map((c) => (
            <RailRow
              key={c.id}
              label={c.name}
              count={countsByCollection[c.id] ?? 0}
              active={activeCollectionId === c.id}
              onClick={() => onSelectCollection(c)}
            />
          ))}
          <div style={{ height: 1, background: "var(--border-hairline)", margin: "8px 0" }} />
          <RailRow label="Unfiled" count={unfiledCount} active={false} onClick={() => onSelectCollection(null)} />
        </div>
      </aside>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* Content header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, height: 52, padding: "0 32px", flexShrink: 0 }}>
          <span className="t-display" style={{ fontSize: 20, lineHeight: 1.2, color: "var(--ink-primary)" }}>{title}</span>
          <span className="t-data-m" style={{ color: "var(--ink-tertiary)" }}>{projects.length}</span>
          <div style={{ flex: 1 }} />
          <Select
            height={28}
            value={sort}
            onChange={(v) => setSort(v as SortKey)}
            options={[
              { value: "edited", label: "Last edited" },
              { value: "created", label: "Newest" },
              { value: "name", label: "Name" },
            ]}
            style={{ width: 140 }}
          />
          <Segmented
            height={24}
            value={view}
            onChange={setView}
            options={[{ value: "cards", label: "Cards" }, { value: "rows", label: "Rows" }]}
          />
        </div>

        {/* Selection bar — only when something is selected */}
        {selected.size > 0 && (
          <div
            style={{
              display: "flex", alignItems: "center", gap: 12, height: 40, padding: "0 32px",
              background: "var(--surface-chrome)", borderTop: "1px solid var(--border-hairline)",
              borderBottom: "1px solid var(--border-hairline)", flexShrink: 0,
            }}
          >
            <span className="t-control" style={{ color: "var(--ink-primary)" }}>{selected.size} selected</span>
            <div style={{ width: 1, height: 20, background: "var(--border-hairline)" }} />
            <Menu
              items={[
                ...collections.map((c) => ({
                  label: c.name,
                  onSelect: () => { onAssign(ids, c.id); setSelected(new Set()); },
                })),
                ...(collections.length ? [{ separator: true as const }] : []),
                { label: "New collection…", icon: "plus", onSelect: () => { onAssignNew(ids); setSelected(new Set()); } },
                { label: "Remove from collection", onSelect: () => { onAssign(ids, null); setSelected(new Set()); } },
              ]}
            >
              <Button size="dense" variant="ghost">Assign to collection…</Button>
            </Menu>
            <Button size="dense" variant="ghost" onClick={() => { onDuplicate(ids); setSelected(new Set()); }}>
              Duplicate
            </Button>
            <Button size="dense" variant="ghost" style={{ color: "var(--danger)" }}
              onClick={() => { onDelete(ids); setSelected(new Set()); }}>
              Delete…
            </Button>
            <div style={{ flex: 1 }} />
            <Button size="dense" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        )}

        {/* Grid */}
        <div className="vt-scroll" style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
          {sorted.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 12, paddingTop: 24 }}>
              <Icon name="film" size={22} style={{ color: "var(--ink-disabled)" }} />
              <div className="t-title" style={{ color: "var(--ink-primary)" }}>Nothing here yet</div>
              <div className="t-body" style={{ color: "var(--ink-secondary)" }}>
                Start one and it will show up here.
              </div>
              <Button size="form" variant="primary" icon="plus" onClick={onNewProject}>New project</Button>
            </div>
          ) : view === "cards" ? (
            // A wall of cards needs a deeper vanishing point, or each one looks
            // independently warped.
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 16, perspective: 1400 }}>
              {sorted.map((p) => (
                <GridCard
                  key={p.id}
                  project={p}
                  selected={selected.has(p.id)}
                  onOpen={() => onOpen(p.id)}
                  onToggle={(additive) => toggle(p.id, additive)}
                />
              ))}
            </div>
          ) : (
            <div style={{ border: "1px solid var(--border-hairline)", borderRadius: "var(--r-panel)", overflow: "hidden" }}>
              {sorted.map((p, i) => (
                <div
                  key={p.id}
                  onClick={() => onOpen(p.id)}
                  style={{
                    display: "grid", gridTemplateColumns: "minmax(0,1fr) 96px 120px 32px", gap: 12,
                    alignItems: "center", height: 44, padding: "0 14px", cursor: "pointer",
                    borderTop: i === 0 ? undefined : "1px solid var(--border-hairline)",
                  }}
                >
                  <span className="t-control" style={{ color: "var(--ink-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                  <span className="t-data-m" style={{ color: "var(--ink-secondary)" }}>{durationLabel(p)}</span>
                  <span style={{ fontSize: 13, color: "var(--ink-tertiary)" }}>{shortDate(p.updatedAt)}</span>
                  <Icon name="chevronRight" size={14} style={{ color: "var(--ink-disabled)" }} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RailRow({ label, count, active, onClick }: {
  label: string; count: number; active: boolean; onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="focus-ring"
      style={{
        display: "flex", alignItems: "center", gap: 8, width: "100%", height: 32,
        padding: "0 16px", border: "none", cursor: "pointer", textAlign: "left",
        background: active ? "var(--surface-hover)" : hover ? "var(--surface-raised)" : "transparent",
        color: active ? "var(--ink-primary)" : "var(--ink-secondary)",
        fontSize: "var(--t-control-size)", fontWeight: 500,
      }}
    >
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      <span className="t-data-m" style={{ color: "var(--ink-tertiary)" }}>{count}</span>
    </button>
  );
}

function GridCard({ project, selected, onOpen, onToggle }: {
  project: ProjectMeta; selected: boolean; onOpen: () => void; onToggle: (additive: boolean) => void;
}) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const [hover, setHover] = useState(false);

  return (
    <ParallaxCard max={0} glare={0.03}>
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={(e) => {
          if (e.metaKey || e.shiftKey) { onToggle(true); return; }
          onOpen();
        }}
        style={{
          background: hover ? "var(--surface-raised)" : "var(--surface-chrome)",
          border: `1px solid ${selected ? "var(--ink-primary)" : hover ? "var(--surface-active)" : "var(--border-edge)"}`,
          borderRadius: "var(--r-panel)",
          overflow: "hidden",
          cursor: "pointer",
          transition: "background var(--dur-state) var(--ease), border-color var(--dur-state) var(--ease)",
        }}
      >
        <div style={{ position: "relative", aspectRatio: "16 / 9", background: "var(--surface-void)" }}>
          {!thumbFailed && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/projects/${project.id}/thumbnail?t=${project.updatedAt}`}
              alt=""
              onError={() => setThumbFailed(true)}
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
            />
          )}

          {(hover || selected) && (
            <div style={{ position: "absolute", top: 8, left: 8 }}>
              <button
                aria-label={selected ? "Deselect" : "Select"}
                onClick={(e) => { e.stopPropagation(); onToggle(true); }}
                style={{
                  width: 16, height: 16, padding: 0, display: "grid", placeItems: "center",
                  borderRadius: 3, cursor: "pointer",
                  background: selected ? "var(--ink-primary)" : "rgba(10,10,11,0.7)",
                  border: `1px solid ${selected ? "var(--ink-primary)" : "var(--border-edge)"}`,
                }}
              >
                {selected && <Icon name="check" size={11} style={{ color: "var(--surface-void)" }} />}
              </button>
            </div>
          )}

          <div style={{ position: "absolute", left: 8, bottom: 6 }}>
            <span className="t-data-s" style={{ color: "var(--ink-tertiary)" }}>{durationLabel(project)}</span>
          </div>
        </div>

        <div style={{ padding: "10px 12px" }}>
          <div className="t-control" style={{ color: "var(--ink-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {project.name}
          </div>
          <div>
            <div className="t-caption" style={{ color: "var(--ink-tertiary)", marginTop: 4 }}>
              {relativeTime(project.updatedAt)}
            </div>
          </div>
        </div>
      </div>
    </ParallaxCard>
  );
}
