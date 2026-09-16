"use client";

import React, { useMemo, useState } from "react";
import type { ProjectMeta, Collection } from "@/lib/types";
import { docDuration } from "@/lib/editor-doc";
import { getProjectSize } from "@/lib/types";
import { getAnimationTypeMeta } from "@/lib/animation-types";
import { relativeTime, shortDate, greeting } from "@/lib/format";
import { timecode, needsHours } from "@/lib/timecode";
import ParallaxCard, { Depth } from "@/components/ui/ParallaxCard";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Tag from "@/components/ui/Tag";
import Segmented from "@/components/ui/Segmented";

/**
 * 4a — Home. Get back into what you were doing, or start the next thing.
 *
 * One honest departure from the design: the EARLIER table's fourth column is
 * KIND, not Status. Nothing in the data model records whether a project has
 * been exported — renders on disk aren't linked back to a project — so a
 * Status column could only ever be decorative. Kind is real, and the column
 * geometry is unchanged, so this swaps back the moment export state exists.
 */

const RECENT_COUNT = 3;
const EARLIER_ROWS = 5;

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

export default function HomeScreen({
  projects, collections, onOpen, onOpenAll, onOpenCollection,
  onNewProject, onImportFootage, onNewCollection, onBrowseCollections,
}: {
  projects: ProjectMeta[];
  collections: Collection[];
  onOpen: (id: string) => void;
  onOpenAll: () => void;
  onOpenCollection: (c: Collection) => void;
  onNewProject: () => void;
  onImportFootage: () => void;
  onNewCollection: () => void;
  onBrowseCollections: () => void;
}) {
  const [filter, setFilter] = useState<string | number>("all");

  const sorted = useMemo(
    () => [...projects].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)),
    [projects],
  );
  const recent = sorted.slice(0, RECENT_COUNT);

  const earlier = useMemo(() => {
    const rest = sorted.slice(RECENT_COUNT);
    const matched = filter === "all"
      ? rest
      : rest.filter((p) => getAnimationTypeMeta(p.animationType).id === filter);
    return matched.slice(0, EARLIER_ROWS);
  }, [sorted, filter]);

  const countsByCollection = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of projects) if (p.collectionId) c[p.collectionId] = (c[p.collectionId] ?? 0) + 1;
    return c;
  }, [projects]);

  const newest = sorted[0];

  return (
    <div style={{ padding: "40px 48px", display: "flex", flexDirection: "column", gap: 32 }}>
      {/* Greeting */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 24 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="t-display" style={{ margin: 0, color: "var(--ink-primary)" }}>{greeting()}</h1>
          <p className="t-body" style={{ margin: "8px 0 0", color: "var(--ink-secondary)" }}>
            {projects.length} {projects.length === 1 ? "project" : "projects"}
            {newest ? `. Last edited ${relativeTime(newest.updatedAt).toLowerCase()}.` : "."}
            {" Everything is saved."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button size="dialog" variant="secondary" icon="upload" onClick={onImportFootage}>
            Import footage
          </Button>
          <Button size="dialog" variant="primary" icon="plus" onClick={onNewProject}>
            New project
          </Button>
        </div>
      </div>

      {/* Pick up where you left off */}
      <section>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
          <span className="t-section" style={{ color: "var(--ink-tertiary)" }}>Pick up where you left off</span>
          <div style={{ flex: 1 }} />
          <Button size="chrome" variant="secondary" onClick={onOpenAll}>
            Open all
            <span className="t-data-s" style={{ color: "var(--ink-tertiary)", marginLeft: 6 }}>{projects.length}</span>
          </Button>
        </div>

        {/* perspective lives on the CONTAINER — 1000px for three hero cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16, perspective: 1000 }}>
          {recent.map((p) => (
            <RecentCard key={p.id} project={p} onClick={() => onOpen(p.id)} />
          ))}
          {recent.length === 0 && (
            <div className="t-body" style={{ color: "var(--ink-tertiary)" }}>
              Nothing yet. Start with New project.
            </div>
          )}
        </div>
      </section>

      {/* Earlier + Collections */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", gap: 24 }}>
        <section>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
            <span className="t-section" style={{ color: "var(--ink-tertiary)" }}>Earlier</span>
            <div style={{ flex: 1 }} />
            <Segmented
              height={24}
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "All" },
                { value: "animation", label: "Animation" },
                { value: "video", label: "Footage" },
              ]}
            />
          </div>

          <div style={{ border: "1px solid var(--border-hairline)", borderRadius: "var(--r-panel)", overflow: "hidden" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0,1fr) 96px 104px 116px 32px",
                gap: 12,
                padding: "8px 14px",
                background: "var(--surface-chrome)",
              }}
            >
              {["Project", "Duration", "Edited", "Kind", ""].map((h, i) => (
                <span key={i} className="t-section" style={{ color: "var(--ink-tertiary)" }}>{h}</span>
              ))}
            </div>

            {earlier.map((p) => (
              <EarlierRow key={p.id} project={p} onClick={() => onOpen(p.id)} />
            ))}
            {earlier.length === 0 && (
              <div className="t-caption" style={{ color: "var(--ink-tertiary)", padding: "14px" }}>
                Nothing else here.
              </div>
            )}
          </div>
        </section>

        <section>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
            <span className="t-section" style={{ color: "var(--ink-tertiary)" }}>Collections</span>
            <div style={{ flex: 1 }} />
            <Button size="dense" variant="ghost" onClick={onBrowseCollections}>Browse all</Button>
            <Button size="dense" variant="ghost" icon="plus" onClick={onNewCollection}>New</Button>
          </div>

          <div style={{ border: "1px solid var(--border-hairline)", borderRadius: "var(--r-panel)", overflow: "hidden" }}>
            {collections.map((c, i) => (
              <button
                key={c.id}
                onClick={() => onOpenCollection(c)}
                className="focus-ring"
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%", height: 44,
                  padding: "0 14px", background: "transparent", border: "none",
                  borderBottom: i < collections.length - 1 ? "1px solid var(--border-hairline)" : undefined,
                  cursor: "pointer", textAlign: "left",
                }}
              >
                <Icon name="folder" size={16} style={{ color: "var(--ink-tertiary)" }} />
                <span className="t-control" style={{ flex: 1, color: "var(--ink-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.name}
                </span>
                <span className="t-data-m" style={{ color: "var(--ink-tertiary)" }}>{countsByCollection[c.id] ?? 0}</span>
                <Icon name="chevronRight" size={14} style={{ color: "var(--ink-disabled)" }} />
              </button>
            ))}
            {collections.length === 0 && (
              <div className="t-caption" style={{ color: "var(--ink-tertiary)", padding: 14 }}>
                Group projects from any type into one collection — handy when several clips make one video.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function RecentCard({ project, onClick }: { project: ProjectMeta; onClick: () => void }) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const meta = getAnimationTypeMeta(project.animationType);
  const dims = sizeLabel(project);

  return (
    <ParallaxCard max={2.5} glare={0.05}>
      <div
        onClick={onClick}
        className="focus-ring"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
        style={{
          background: "var(--surface-chrome)",
          border: "1px solid var(--border-edge)",
          borderRadius: "var(--r-panel)",
          overflow: "hidden",
          cursor: "pointer",
        }}
      >
        <Depth z={4} style={{ position: "relative", aspectRatio: "16 / 9", background: "var(--surface-void)" }}>
          {!thumbFailed && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/projects/${project.id}/thumbnail?t=${project.updatedAt}`}
              alt=""
              onError={() => setThumbFailed(true)}
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
            />
          )}
          <Depth z={6} style={{ position: "absolute", left: 10, bottom: 8 }}>
            <span className="t-data-s" style={{ color: "var(--ink-tertiary)" }}>
              {durationLabel(project)} · {dims}
            </span>
          </Depth>
        </Depth>

        <Depth z={8} style={{ padding: "14px 16px" }}>
          <div className="t-heading" style={{ color: "var(--ink-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {project.name}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <Tag>{meta.label}</Tag>
            <span className="t-caption" style={{ color: "var(--ink-tertiary)" }}>{relativeTime(project.updatedAt)}</span>
          </div>
        </Depth>
      </div>
    </ParallaxCard>
  );
}

function EarlierRow({ project, onClick }: { project: ProjectMeta; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  const meta = getAnimationTypeMeta(project.animationType);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0,1fr) 96px 104px 116px 32px",
        gap: 12,
        alignItems: "center",
        height: 44,
        padding: "0 14px",
        borderTop: "1px solid var(--border-hairline)",
        background: hover ? "var(--surface-chrome)" : "transparent",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <div style={{ width: 32, height: 20, borderRadius: 2, background: "var(--surface-raised)", flexShrink: 0 }} />
        <span className="t-control" style={{ color: "var(--ink-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {project.name}
        </span>
      </div>
      <span className="t-data-m" style={{ color: "var(--ink-secondary)" }}>{durationLabel(project)}</span>
      <span style={{ fontSize: 13, color: "var(--ink-tertiary)" }}>{shortDate(project.updatedAt)}</span>
      <span className="t-control" style={{ color: "var(--ink-secondary)" }}>{meta.label}</span>
      <Icon name="chevronRight" size={14} style={{ color: "var(--ink-disabled)" }} />
    </div>
  );
}
