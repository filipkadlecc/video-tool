"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ProjectCard from "@/components/ProjectCard";
import NewProjectModal from "@/components/NewProjectModal";
import Logo from "@/components/ui/Logo";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Modal from "@/components/ui/Modal";
import type { ProjectMeta } from "@/lib/types";

export default function Home() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<ProjectMeta | null>(null);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        setModalOpen(true);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    fetchProjects();
  }, []);

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
      if (res.ok) {
        fetchProjects();
      }
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

  async function handleCreate(data: {
    name: string;
    animationType: string;
    settings: { resolution: string; orientation: string; fps: number };
    initialPrompt: string;
    notionContent?: string;
    scriptWithTimestamps?: string;
    mediaFolder?: string;
  }) {
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const project = await res.json();
        setModalOpen(false);
        router.push(`/project/${project.id}`);
      }
    } catch (err) {
      console.error("Failed to create project:", err);
    }
  }

  // Empty state
  if (projects.length === 0) {
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
          <Button variant="primary" icon="plus" onClick={() => setModalOpen(true)}>
            New project
          </Button>
        </header>
        <div
          style={{
            height: "calc(100vh - 65px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 40,
            gap: 20,
          }}
        >
          {/* Stacked card illustration */}
          <div style={{ position: "relative", width: 220, height: 140 }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: `${i * 30}px`,
                  top: `${i * 15}px`,
                  width: 140,
                  height: 80,
                  borderRadius: 8,
                  background:
                    i === 2
                      ? "linear-gradient(135deg, oklch(0.88 0.22 124 / 0.2), oklch(0.72 0.26 340 / 0.1))"
                      : "var(--bg-2)",
                  border: `0.5px solid ${i === 2 ? "var(--accent-line)" : "var(--line-2)"}`,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                  transform: `rotate(${(i - 1) * 4}deg)`,
                }}
              >
                {i === 2 && (
                  <div style={{ padding: 14 }}>
                    <div style={{ fontSize: 22, color: "var(--accent)" }}>&#9889;</div>
                    <div className="mono" style={{ fontSize: 9, color: "var(--text-2)", marginTop: 6 }}>
                      NEW.tsx
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center", maxWidth: 380 }}>
            <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: -0.3, marginBottom: 8 }}>
              Nothing here yet.
            </div>
            <div style={{ fontSize: 13, color: "var(--text-1)", lineHeight: 1.5 }}>
              Describe a video, get Remotion code you can preview, tweak, and export. Start with your first project.
            </div>
          </div>
          <Button variant="primary" size="lg" icon="sparkle" onClick={() => setModalOpen(true)}>
            Create your first project
          </Button>
        </div>
        <NewProjectModal open={modalOpen} onClose={() => setModalOpen(false)} onCreate={handleCreate} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-1)" }}>
      {/* Top bar */}
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
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="mono" style={{ fontSize: 11, color: "var(--text-2)", marginRight: 8 }}>
            {projects.length} projects
          </div>
          <Button variant="primary" icon="plus" onClick={() => setModalOpen(true)}>
            New project
          </Button>
        </div>
      </header>

      {/* Hero strip */}
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
          <div className="mono cap" style={{ color: "var(--text-2)", marginBottom: 8 }}>
            Workspace
          </div>
          <h1 style={{ margin: 0, fontSize: 32, letterSpacing: -0.8, fontWeight: 600 }}>Your projects</h1>
          <p style={{ margin: "6px 0 0", color: "var(--text-1)", fontSize: 14, maxWidth: 520 }}>
            Describe a video, get Remotion code. Preview, edit, export.
          </p>
        </div>
      </div>

      {/* Grid */}
      <div
        style={{
          padding: 28,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 20,
        }}
      >
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            onClick={() => router.push(`/project/${project.id}`)}
            onDelete={() => setDeleteConfirm(project)}
            onDuplicate={() => handleDuplicate(project.id)}
          />
        ))}

        {/* New project slot */}
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
            e.currentTarget.style.borderColor = "var(--accent)";
            e.currentTarget.style.color = "var(--accent)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--line-2)";
            e.currentTarget.style.color = "var(--text-2)";
          }}
        >
          <Icon name="plus" size={22} />
          <span style={{ fontSize: 12 }}>New project</span>
        </button>
      </div>

      <NewProjectModal open={modalOpen} onClose={() => setModalOpen(false)} onCreate={handleCreate} />

      {/* Delete confirm */}
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
