import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { Collection } from "./types";
import { listProjects, updateProject } from "./projects";

const COLLECTIONS_FILE = path.join(process.cwd(), "data", "collections.json");

function readAll(): Collection[] {
  if (!fs.existsSync(COLLECTIONS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(COLLECTIONS_FILE, "utf-8")) as Collection[];
  } catch {
    return [];
  }
}

function writeAll(collections: Collection[]) {
  fs.mkdirSync(path.dirname(COLLECTIONS_FILE), { recursive: true });
  fs.writeFileSync(COLLECTIONS_FILE, JSON.stringify(collections, null, 2), "utf-8");
}

export function listCollections(): Collection[] {
  return readAll().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getCollection(id: string): Collection | null {
  return readAll().find((c) => c.id === id) ?? null;
}

export function createCollection(name: string): Collection {
  const now = new Date().toISOString();
  const collection: Collection = { id: randomUUID(), name, createdAt: now, updatedAt: now };
  const all = readAll();
  all.push(collection);
  writeAll(all);
  return collection;
}

export function updateCollection(id: string, partial: { name?: string }): Collection | null {
  const all = readAll();
  const idx = all.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...partial, id, updatedAt: new Date().toISOString() };
  writeAll(all);
  return all[idx];
}

export function deleteCollection(id: string): boolean {
  const all = readAll();
  const next = all.filter((c) => c.id !== id);
  if (next.length === all.length) return false;
  writeAll(next);
  // Clear the ref from member projects so nothing points at a dead collection.
  for (const p of listProjects()) {
    if (p.collectionId === id) updateProject(p.id, { collectionId: undefined });
  }
  return true;
}
