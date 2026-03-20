import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { Project, ProjectMeta, AnimationType, ProjectSettings } from "./types";

const PROJECTS_DIR = path.join(process.cwd(), "data", "projects");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function listProjects(): ProjectMeta[] {
  ensureDir(PROJECTS_DIR);
  const entries = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true });
  const projects: ProjectMeta[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const jsonPath = path.join(PROJECTS_DIR, entry.name, "project.json");
    if (!fs.existsSync(jsonPath)) continue;

    try {
      const raw = JSON.parse(fs.readFileSync(jsonPath, "utf-8")) as Project;
      projects.push({
        id: raw.id,
        name: raw.name,
        animationType: raw.animationType,
        settings: raw.settings,
        initialPrompt: raw.initialPrompt,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
      });
    } catch {
      // skip corrupted files
    }
  }

  return projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getProject(id: string): Project | null {
  const jsonPath = path.join(PROJECTS_DIR, id, "project.json");
  if (!fs.existsSync(jsonPath)) return null;

  try {
    return JSON.parse(fs.readFileSync(jsonPath, "utf-8")) as Project;
  } catch {
    return null;
  }
}

export interface CreateProjectData {
  name: string;
  animationType: AnimationType;
  settings: ProjectSettings;
  initialPrompt: string;
  notionContent?: string;
  scriptWithTimestamps?: string;
  svgContent?: string;
}

export function createProject(data: CreateProjectData): Project {
  const id = randomUUID();
  const now = new Date().toISOString();

  const project: Project = {
    id,
    name: data.name,
    animationType: data.animationType,
    settings: data.settings,
    code: "",
    chatHistory: [],
    initialPrompt: data.initialPrompt,
    notionContent: data.notionContent,
    scriptWithTimestamps: data.scriptWithTimestamps,
    svgContent: data.svgContent,
    createdAt: now,
    updatedAt: now,
  };

  const projectDir = path.join(PROJECTS_DIR, id);
  ensureDir(projectDir);
  fs.writeFileSync(path.join(projectDir, "project.json"), JSON.stringify(project, null, 2), "utf-8");

  return project;
}

export function updateProject(id: string, partial: Partial<Project>): Project | null {
  const existing = getProject(id);
  if (!existing) return null;

  const updated: Project = {
    ...existing,
    ...partial,
    id: existing.id, // prevent overwriting id
    updatedAt: new Date().toISOString(),
  };

  const jsonPath = path.join(PROJECTS_DIR, id, "project.json");
  fs.writeFileSync(jsonPath, JSON.stringify(updated, null, 2), "utf-8");

  return updated;
}

export function duplicateProject(id: string): Project | null {
  const source = getProject(id);
  if (!source) return null;

  const newId = randomUUID();
  const now = new Date().toISOString();

  const duplicate: Project = {
    ...source,
    id: newId,
    name: `${source.name} copy`,
    createdAt: now,
    updatedAt: now,
  };

  const projectDir = path.join(PROJECTS_DIR, newId);
  ensureDir(projectDir);
  fs.writeFileSync(path.join(projectDir, "project.json"), JSON.stringify(duplicate, null, 2), "utf-8");

  return duplicate;
}

export function deleteProject(id: string): boolean {
  const projectDir = path.join(PROJECTS_DIR, id);
  if (!fs.existsSync(projectDir)) return false;

  fs.rmSync(projectDir, { recursive: true, force: true });
  return true;
}
