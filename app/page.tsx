"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ProjectCard from "@/components/ProjectCard";
import NewProjectModal from "@/components/NewProjectModal";
import type { ProjectMeta } from "@/lib/types";

export default function Home() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface">
        <h1 className="text-sm font-semibold tracking-tight">Video Tool</h1>
        <button
          onClick={() => setModalOpen(true)}
          className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
        >
          + New Project
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {projects.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted text-sm mb-4">No projects yet</p>
            <button
              onClick={() => setModalOpen(true)}
              className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
            >
              Create your first project
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => router.push(`/project/${project.id}`)}
                onDelete={() => setDeleteConfirm(project.id)}
                onDuplicate={() => handleDuplicate(project.id)}
              />
            ))}
          </div>
        )}
      </main>

      <NewProjectModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={handleCreate}
      />

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
          <div className="bg-surface border border-border rounded-xl p-5 w-[360px]">
            <p className="text-sm text-foreground mb-4">Delete this project? This cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-3 py-1.5 text-xs text-muted border border-border rounded-lg hover:bg-surface-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-3 py-1.5 text-xs text-white bg-red-600 rounded-lg hover:opacity-90 transition-opacity"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
