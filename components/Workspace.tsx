"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import NewProjectModal from "@/components/NewProjectModal";
import StorageModal from "@/components/StorageModal";
import Button from "@/components/ui/Button";
import AppHeader from "@/components/AppHeader";
import Menu from "@/components/ui/Menu";
import AboutDialog from "@/components/AboutDialog";
import IconButton from "@/components/ui/IconButton";
import HomeScreen from "@/components/HomeScreen";
import ProjectsScreen from "@/components/ProjectsScreen";
import type { ProjectMeta, AnimationType, Collection } from "@/lib/types";
import { getAnimationTypeMeta, normalizeAnimationType } from "@/lib/animation-types";
import { useDialogs } from "@/components/ui/Dialogs";
import { useToast } from "@/components/ui/Toast";

/**
 * The whole workspace: the type picker, one type's projects, and a collection.
 *
 * Which of the three you see is decided by the URL rather than by state, so the
 * back button, a bookmark and a pasted link all work. The routes under app/ are
 * thin wrappers that pass what they matched; everything else lives here.
 */
export default function Workspace({
  type = null,
  collectionId = null,
}: {
  type?: AnimationType | null;
  collectionId?: string | null;
}) {
  const router = useRouter();
  const dialogs = useDialogs();
  const toast = useToast();
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const selectedType = type;
  // Resolved from the id in the URL once collections land, so a deep link to a
  // collection works before anything has been clicked.
  const selectedCollection = collectionId
    ? collections.find((c) => c.id === collectionId) ?? null
    : null;
  const setSelectedType = (t: AnimationType | null) => router.push(t ? `/${t}` : "/");
  const setSelectedCollection = (c: Collection | null) =>
    router.push(c ? `/collection/${c.id}` : "/");
  const [modalOpen, setModalOpen] = useState(false);
  const [storageOpen, setStorageOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetchProjects();
    fetch("/api/collections")
      .then((r) => r.json())
      .then(setCollections)
      .catch((err) => console.error("Failed to load collections:", err));
  }, []);

  // Cmd+N opens the modal (only meaningful once a type is chosen)
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "n" && selectedType) {
        e.preventDefault();
        setModalOpen(true);
      }
      if (e.key === "Escape" && selectedType && !modalOpen) {
        setSelectedType(null);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedType, modalOpen]);

  async function fetchProjects() {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      setProjects(data);
    } catch (err) {
      console.error("Failed to load projects:", err);
    }
  }

  // Prompts for a name and creates a collection; returns it (or null if cancelled).
  async function createCollection(): Promise<Collection | null> {
    const name = await dialogs.prompt({
      title: "New collection",
      label: "Name",
      placeholder: "e.g. Store promos",
      confirmLabel: "Create",
    });
    if (!name) return null;
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const col: Collection = await res.json();
      setCollections((prev) => [col, ...prev]);
      return col;
    } catch (err) {
      console.error("Failed to create collection:", err);
      toast.error("Couldn't create that collection", "Nothing was changed.",
        [{ label: "Retry", onClick: () => { void createCollection(); } }]);
      return null;
    }
  }

  async function assignToCollection(projectId: string, collectionId: string | null) {
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectionId }),
      });
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, collectionId: collectionId ?? undefined } : p))
      );
    } catch (err) {
      console.error("Failed to assign collection:", err);
    }
  }


  async function renameCollection(col: Collection) {
    const name = await dialogs.prompt({
      title: `Rename "${col.name}"`,
      label: "Name",
      value: col.name,
      confirmLabel: "Rename",
      consequence: (() => {
        const n = projects.filter((p) => p.collectionId === col.id).length;
        return `${n} ${n === 1 ? "project keeps" : "projects keep"} their assignment.`;
      })(),
    });
    if (!name || name === col.name) return;
    try {
      const res = await fetch(`/api/collections/${col.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated: Collection = await res.json();
      setCollections((prev) => prev.map((c) => (c.id === col.id ? updated : c)));
    } catch (err) {
      console.error("Failed to rename collection:", err);
      toast.error("Couldn't rename that collection", "It kept its old name.",
        [{ label: "Retry", onClick: () => { void renameCollection(col); } }]);
    }
  }

  async function deleteCollectionFlow(col: Collection) {
    const ok = await dialogs.confirm({
      title: `Delete "${col.name}"?`,
      body: "This can't be undone. The projects in it are kept — they just stop being grouped.",
      confirmLabel: "Delete collection",
      destructive: true,
    });
    if (!ok) return;
    try {
      await fetch(`/api/collections/${col.id}`, { method: "DELETE" });
      setCollections((prev) => prev.filter((c) => c.id !== col.id));
      router.push("/");
      fetchProjects(); // members lost their collectionId server-side
    } catch (err) {
      console.error("Failed to delete collection:", err);
    }
  }



  function handleCreated({
    projectId,
    autoAction,
  }: {
    projectId: string;
    autoAction?: "smarttrim" | "compose";
  }) {
    setModalOpen(false);
    const suffix = autoAction ? `?action=${autoAction}` : "";
    router.push(`/project/${projectId}${suffix}`);
  }



  // ───── Bulk actions (the selection bar) ─────

  async function deleteMany(ids: string[]) {
    const names = ids.map((id) => projects.find((p) => p.id === id)?.name).filter(Boolean);
    const ok = await dialogs.confirm({
      title: ids.length === 1 ? `Delete "${names[0]}"?` : `Delete ${ids.length} projects?`,
      body: "This can't be undone. Anything already exported stays on disk.",
      confirmLabel: ids.length === 1 ? "Delete project" : `Delete ${ids.length} projects`,
      destructive: true,
    });
    if (!ok) return;
    try {
      await Promise.all(ids.map((id) => fetch(`/api/projects/${id}`, { method: "DELETE" })));
      setProjects((prev) => prev.filter((p) => !ids.includes(p.id)));
      toast.success(`Deleted ${ids.length} ${ids.length === 1 ? "project" : "projects"}`);
    } catch (err) {
      console.error("Failed to delete projects:", err);
      toast.error("Couldn't delete everything", "Some projects are still there.",
        [{ label: "Retry", onClick: () => { void deleteMany(ids); } }]);
    }
  }

  async function duplicateMany(ids: string[]) {
    try {
      const made = await Promise.all(
        ids.map((id) => fetch(`/api/projects/${id}/duplicate`, { method: "POST" }).then((r) => r.json())),
      );
      fetchProjects();
      if (made.length === 1 && made[0]?.id) router.push(`/project/${made[0].id}`);
      else toast.success(`Duplicated ${made.length} projects`);
    } catch (err) {
      console.error("Failed to duplicate:", err);
      toast.error("Couldn't duplicate that", "Nothing was changed.",
        [{ label: "Retry", onClick: () => { void duplicateMany(ids); } }]);
    }
  }

  async function assignMany(ids: string[], cid: string | null) {
    try {
      await Promise.all(ids.map((id) => assignToCollection(id, cid)));
      const name = cid ? collections.find((c) => c.id === cid)?.name : null;
      toast.success(name ? `Moved to ${name}` : "Removed from collection");
    } catch {
      toast.error("Couldn't assign those projects", "They kept their old collection.",
        [{ label: "Retry", onClick: () => { void assignMany(ids, cid); } }]);
    }
  }

  async function assignManyNew(ids: string[]) {
    const col = await createCollection();
    if (col) await assignMany(ids, col.id);
  }

  const matchesQuery = (p: ProjectMeta) =>
    !query.trim() || p.name.toLowerCase().includes(query.trim().toLowerCase());

  const shell = (children: React.ReactNode, header: React.ReactNode) => (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--surface-void)" }}>
      {header}
      {children}
      <NewProjectModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        // Undefined on Home, so the wizard ASKS what you are making (4c). It
        // used to default to "animation" here, which locked the type and hid
        // the question that decides which workspace you land in.
        initialType={selectedType ?? undefined}
        onCreated={handleCreated}
      />
      <StorageModal
        open={storageOpen}
        onClose={() => setStorageOpen(false)}
        onProjectsDeleted={() => fetchProjects()}
      />
      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </div>
  );

  // ───── 4a — Home ─────
  if (selectedType === null && !selectedCollection) {
    return shell(
      <HomeScreen
        projects={projects.filter(matchesQuery)}
        collections={collections}
        onOpen={(id) => router.push(`/project/${id}`)}
        onOpenAll={() => setSelectedType("animation")}
        onOpenCollection={(c) => setSelectedCollection(c)}
        onNewProject={() => setModalOpen(true)}
        onImportFootage={() => setModalOpen(true)}
        onNewCollection={() => { void createCollection(); }}
        onBrowseCollections={() => setSelectedType("animation")}
      />,
      <AppHeader
        search={{ value: query, onChange: setQuery }}
        onSettings={undefined}
        settingsMenu={[
          { label: "Storage…", icon: "storage", onSelect: () => setStorageOpen(true) },
          { separator: true as const },
          { label: "About Video tool", icon: "info", onSelect: () => setAboutOpen(true) },
        ]}
      />,
    );
  }

  // ───── 4b — one collection ─────
  if (selectedCollection) {
    const inCollection = projects.filter((p) => p.collectionId === selectedCollection.id).filter(matchesQuery);
    return shell(
      <ProjectsScreen
        title={selectedCollection.name}
        projects={inCollection}
        collections={collections}
        activeCollectionId={selectedCollection.id}
        unfiledCount={projects.filter((p) => !p.collectionId).length}
        onOpen={(id) => router.push(`/project/${id}`)}
        onSelectCollection={(c) => setSelectedCollection(c)}
        onNewCollection={() => { void createCollection(); }}
        onNewProject={() => setModalOpen(true)}
        onAssign={assignMany}
        onAssignNew={assignManyNew}
        onDuplicate={duplicateMany}
        onDelete={deleteMany}
      />,
      <AppHeader
        back={{ label: "Home", onClick: () => setSelectedCollection(null) }}
        search={{ value: query, onChange: setQuery, placeholder: `Search ${selectedCollection.name}` }}
        onSettings={undefined}
        settingsMenu={[
          { label: "Storage…", icon: "storage", onSelect: () => setStorageOpen(true) },
          { separator: true as const },
          { label: "About Video tool", icon: "info", onSelect: () => setAboutOpen(true) },
        ]}
        actions={
          <>
            <Menu
              align="right"
              items={[
                { label: "Rename collection…", icon: "type", onSelect: () => { void renameCollection(selectedCollection); } },
                { separator: true },
                { label: "Delete collection…", icon: "trash", destructive: true, onSelect: () => { void deleteCollectionFlow(selectedCollection); } },
              ]}
            >
              <IconButton icon="dots" title="Collection actions" />
            </Menu>
            <Button size="form" variant="primary" icon="plus" onClick={() => setModalOpen(true)}>
              New project
            </Button>
          </>
        }
      />,
    );
  }

  // ───── 4b — one type ─────
  // Unreachable when null: the two branches above return first. TypeScript
  // can't narrow across a compound guard, so state it rather than assert.
  if (selectedType === null) return null;
  const meta = getAnimationTypeMeta(selectedType);
  const filtered = projects
    .filter((p) => normalizeAnimationType(p.animationType) === selectedType)
    .filter(matchesQuery);

  return shell(
    <ProjectsScreen
      title={`All ${meta.label.toLowerCase()}`}
      projects={filtered}
      collections={collections}
      activeCollectionId={null}
      unfiledCount={filtered.filter((p) => !p.collectionId).length}
      onOpen={(id) => router.push(`/project/${id}`)}
      onSelectCollection={(c) => setSelectedCollection(c)}
      onNewCollection={() => { void createCollection(); }}
      onNewProject={() => setModalOpen(true)}
      onAssign={assignMany}
      onAssignNew={assignManyNew}
      onDuplicate={duplicateMany}
      onDelete={deleteMany}
    />,
    <AppHeader
      back={{ label: "Home", onClick: () => setSelectedType(null) }}
      search={{ value: query, onChange: setQuery, placeholder: `Search ${meta.label.toLowerCase()}` }}
      onSettings={() => setStorageOpen(true)}
      actions={
        <Button size="form" variant="primary" icon="plus" onClick={() => setModalOpen(true)}>
          New project
        </Button>
      }
    />,
  );
}
