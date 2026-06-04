"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import ProjectCard from "@/components/ProjectCard";
import NewProjectModal from "@/components/NewProjectModal";
import StorageModal from "@/components/StorageModal";
import TypeTile from "@/components/TypeTile";
import Logo from "@/components/ui/Logo";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Modal from "@/components/ui/Modal";
import type { ProjectMeta, AnimationType } from "@/lib/types";
import { ANIMATION_TYPES, getAnimationTypeMeta } from "@/lib/animation-types";

export default function Home() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [selectedType, setSelectedType] = useState<AnimationType | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<ProjectMeta | null>(null);
  const [storageOpen, setStorageOpen] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  // Cmd+N opens the modal (only meaningful once a type is chosen)
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "n" && selectedType) {
        e.preventDefault();
        setModalOpen(true);
      }
      if (e.key === "Escape" && selectedType && !modalOpen && !deleteConfirm) {
        setSelectedType(null);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedType, modalOpen, deleteConfirm]);

  async function fetchProjects() {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      setProjects(data);
    } catch (err) {
      console.error("Failed to load projects:", err);
    }
  }

  async function handleDuplicate(id: string) {
    try {
      const res = await fetch(`/api/projects/${id}/duplicate`, { method: "POST" });
      if (!res.ok) return;
      const newProject = await res.json();
      router.push(`/project/${newProject.id}`);
    } catch (err) {
      console.error("Failed to duplicate project:", err);
    }
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/projects/${id}`, { method: "DELETE" });
      setProjects((prev) => prev.filter((p) => p.id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      console.error("Failed to delete project:", err);
    }
  }

  function handleCreated({
    projectId,
    autoAction,
  }: {
    projectId: string;
    autoAction?: "smartTrim";
  }) {
    setModalOpen(false);
    const suffix = autoAction ? `?action=${autoAction}` : "";
    router.push(`/project/${projectId}${suffix}`);
  }

  const countsByType = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of projects) {
      counts[p.animationType] = (counts[p.animationType] ?? 0) + 1;
    }
    return counts;
  }, [projects]);

  // ───── Opening screen: type picker ─────
  if (selectedType === null) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg-1)" }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            padding: "16px 28px",
            borderBottom: "0.5px solid var(--line-1)",
          }}
        >
          <Logo />
          <div style={{ flex: 1 }} />
          <div className="mono" style={{ fontSize: 11, color: "var(--text-2)", marginRight: 10 }}>
            {projects.length} {projects.length === 1 ? "project" : "projects"}
          </div>
          <Button variant="ghost" size="sm" icon="folder" onClick={() => setStorageOpen(true)}>
            Storage
          </Button>
        </header>

        <StorageModal
          open={storageOpen}
          onClose={() => setStorageOpen(false)}
          onProjectsDeleted={() => fetchProjects()}
        />

        <div
          style={{
            maxWidth: 980,
            margin: "0 auto",
            padding: "64px 28px 40px",
            display: "flex",
            flexDirection: "column",
            gap: 32,
          }}
        >
          <div>
            <div className="mono cap" style={{ color: "var(--text-2)", marginBottom: 10 }}>
              Workspace
            </div>
            <h1 style={{ margin: 0, fontSize: 36, letterSpacing: -0.8, fontWeight: 600 }}>
              What are you making?
            </h1>
            <p style={{ margin: "10px 0 0", color: "var(--text-1)", fontSize: 14, maxWidth: 560 }}>
              Pick a style to see past projects or start a new one.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14,
            }}
          >
            {ANIMATION_TYPES.map((t) => (
              <TypeTile
                key={t.id}
                type={t.id}
                size="lg"
                count={countsByType[t.id] ?? 0}
                onClick={() => setSelectedType(t.id)}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ───── Per-type screen: filtered projects + new-project tile ─────
  const meta = getAnimationTypeMeta(selectedType);
  const filtered = projects.filter((p) => p.animationType === selectedType);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-1)" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          padding: "16px 28px",
          background: "color-mix(in oklab, var(--bg-1) 85%, transparent)",
          backdropFilter: "blur(12px)",
          borderBottom: "0.5px solid var(--line-1)",
        }}
      >
        <Logo />
        <button
          onClick={() => setSelectedType(null)}
          className="mono"
          style={{
            marginLeft: 18,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 10px",
            background: "transparent",
            border: "0.5px solid var(--line-2)",
            borderRadius: 4,
            color: "var(--text-1)",
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          <Icon name="arrowLeft" size={11} />
          All types
        </button>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="mono" style={{ fontSize: 11, color: "var(--text-2)", marginRight: 8 }}>
            {filtered.length} {filtered.length === 1 ? "project" : "projects"}
          </div>
          <Button variant="ghost" size="sm" icon="folder" onClick={() => setStorageOpen(true)}>
            Storage
          </Button>
          <Button variant="primary" icon="plus" onClick={() => setModalOpen(true)}>
            New {meta.label} project
          </Button>
        </div>
      </header>

      <div
        style={{
          padding: "36px 28px 20px",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          borderBottom: "0.5px solid var(--line-1)",
        }}
      >
        <div>
          <div
            className="mono cap"
            style={{ color: meta.color, marginBottom: 8 }}
          >
            {meta.badgeLabel}
          </div>
          <h1 style={{ margin: 0, fontSize: 32, letterSpacing: -0.8, fontWeight: 600 }}>
            {meta.label} projects
          </h1>
          <p style={{ margin: "6px 0 0", color: "var(--text-1)", fontSize: 14, maxWidth: 520 }}>
            {meta.subtitle}.
          </p>
        </div>
      </div>

      <div
        style={{
          padding: 28,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 20,
        }}
      >
        {filtered.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            onClick={() => router.push(`/project/${project.id}`)}
            onDelete={() => setDeleteConfirm(project)}
            onDuplicate={() => handleDuplicate(project.id)}
          />
        ))}

        <button
          onClick={() => setModalOpen(true)}
          style={{
            aspectRatio: "1 / 1.15",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            background: "transparent",
            border: "1px dashed var(--line-2)",
            borderRadius: "var(--r-md)",
            cursor: "pointer",
            color: "var(--text-2)",
            transition: "border-color 120ms, color 120ms",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = meta.color;
            e.currentTarget.style.color = meta.color;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--line-2)";
            e.currentTarget.style.color = "var(--text-2)";
          }}
        >
          <Icon name="plus" size={22} />
          <span style={{ fontSize: 12 }}>New {meta.label} project</span>
        </button>
      </div>

      <NewProjectModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialType={selectedType}
        onCreated={handleCreated}
      />

      <StorageModal
        open={storageOpen}
        onClose={() => setStorageOpen(false)}
        onProjectsDeleted={() => fetchProjects()}
      />

      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} width={380}>
        <div style={{ padding: 24 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              background: "var(--red-soft)",
              display: "grid",
              placeItems: "center",
              color: "var(--red)",
              marginBottom: 14,
            }}
          >
            <Icon name="trash" size={16} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Delete this project?</div>
          <div style={{ fontSize: 12.5, color: "var(--text-1)", lineHeight: 1.5, marginBottom: 18 }}>
            <span style={{ color: "var(--text-0)", fontWeight: 500 }}>{deleteConfirm?.name}</span> and its chat
            history will be permanently removed. This cannot be undone.
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => deleteConfirm && handleDelete(deleteConfirm.id)}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
