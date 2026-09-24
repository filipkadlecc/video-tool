import crypto from "crypto";
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { summariseDocChange } from "./editor-agent";
import type { EditorDoc } from "./editor-doc";

/**
 * Every saved state of a project, kept for good.
 *
 * Undo (hooks/useDocHistory) lives in memory and dies with the tab. This is the
 * part that doesn't: each save that changes the timeline or the scene code
 * lands here, on disk beside project.json, so a version from last week is as
 * reachable as the one from a minute ago.
 *
 * Layout: `data/projects/<id>/versions/index.json` lists them (small, read on
 * every save), and each version's content is its own gzipped file — a document
 * embeds whole TSX scenes, so reading the list must never mean inflating them.
 *
 * Autosave fires every couple of seconds while someone works, so saves close
 * together are folded into one version: a new one starts when the latest is a
 * minute old, or when a save is a CHECKPOINT (an AI edit, a restore) — those are
 * the moments someone will want to step back past, so they always stand alone.
 */

const PROJECTS_DIR = path.join(process.cwd(), "data", "projects");
const FOLD_WINDOW_MS = 60_000;
const MAX_SUMMARY = 8;

export interface VersionContent {
  doc?: EditorDoc;
  code?: string;
}

export interface VersionMeta {
  id: string;
  createdAt: string;
  updatedAt: string;
  /** What kind of moment this was: "Edit", "AI edit", "Restored …", "Before history began". */
  label: string;
  /** Short lines saying what changed, e.g. "Scene 2 · in". */
  summary: string[];
  checkpoint: boolean;
  hash: string;
}

function dirOf(projectId: string): string {
  return path.join(PROJECTS_DIR, projectId, "versions");
}

function readIndex(projectId: string): VersionMeta[] {
  try {
    return JSON.parse(fs.readFileSync(path.join(dirOf(projectId), "index.json"), "utf-8")) as VersionMeta[];
  } catch {
    return [];
  }
}

function writeIndex(projectId: string, index: VersionMeta[]) {
  const file = path.join(dirOf(projectId), "index.json");
  // Written to a temp file and renamed, so a crash mid-write can't leave a
  // truncated index that hides every version behind it.
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(index, null, 1), "utf-8");
  fs.renameSync(`${file}.tmp`, file);
}

function writeContent(projectId: string, id: string, content: VersionContent) {
  fs.writeFileSync(path.join(dirOf(projectId), `${id}.json.gz`), zlib.gzipSync(JSON.stringify(content)));
}

function hashOf(content: VersionContent): string {
  return crypto.createHash("sha1").update(JSON.stringify({ doc: content.doc ?? null, code: content.code ?? "" })).digest("hex");
}

function isEmpty(content: VersionContent): boolean {
  const hasDoc = Boolean(content.doc?.tracks?.some((t) => t.items.length));
  return !hasDoc && !content.code?.trim();
}

/** The receipt's field names, as a person would say them. */
const FIELD_WORDS: Record<string, string> = {
  added: "added",
  removed: "removed",
  in: "moved or trimmed",
  out: "moved or trimmed",
  design: "redesigned",
  name: "renamed",
  text: "reworded",
  position: "moved on the canvas",
  size: "resized",
  scale: "rescaled",
  rotation: "rotated",
  opacity: "opacity changed",
  color: "recoloured",
  fit: "refitted",
  volume: "volume changed",
  track: "moved to another track",
  keys: "keyframes changed",
  arrives: "entrance changed",
  leaves: "exit changed",
};

/** What changed between two saved states, in the words the timeline uses. */
function describeChange(before: VersionContent, after: VersionContent): string[] {
  if (after.doc && !before.doc) return ["Opened in the timeline"];
  const lines: string[] = [];
  if (before.doc && after.doc) {
    try {
      for (const c of summariseDocChange(before.doc, after.doc)) {
        const line = `${c.label} ${FIELD_WORDS[c.field] ?? "changed"}`;
        if (!lines.includes(line)) lines.push(line);
      }
    } catch {
      // A summary is a courtesy; a document it can't read must not block the save.
    }
  }
  if ((before.code ?? "") !== (after.code ?? "") && !after.doc) lines.push("Scene code edited");
  return lines;
}

function merge(a: string[], b: string[]): string[] {
  const out = [...a];
  for (const line of b) if (!out.includes(line)) out.push(line);
  return out.slice(0, MAX_SUMMARY + 1);
}

/**
 * Record a save. `before` is what was on disk, `after` what is being written.
 * Returns the version it landed in, or null when nothing worth keeping changed.
 */
export function recordVersion(
  projectId: string,
  before: VersionContent,
  after: VersionContent,
  opts: { label?: string; checkpoint?: boolean; /** Tests only. */ now?: Date } = {},
): VersionMeta | null {
  const hash = hashOf(after);
  if (hash === hashOf(before)) return null;

  fs.mkdirSync(dirOf(projectId), { recursive: true });
  const index = readIndex(projectId);
  const now = opts.now ?? new Date();

  // The first save a project ever records also keeps what it looked like before
  // it — otherwise the state someone opened would be the one thing they could
  // never get back to.
  if (!index.length && !isEmpty(before)) {
    const id = `${now.getTime() - 1}-base`;
    writeContent(projectId, id, before);
    index.push({
      id,
      createdAt: new Date(now.getTime() - 1).toISOString(),
      updatedAt: new Date(now.getTime() - 1).toISOString(),
      label: "Before history began",
      summary: [],
      checkpoint: true,
      hash: hashOf(before),
    });
  }

  const latest = index[index.length - 1];
  if (latest?.hash === hash) return null;

  const summary = describeChange(before, after);
  const fold =
    latest &&
    !opts.checkpoint &&
    !latest.checkpoint &&
    now.getTime() - new Date(latest.createdAt).getTime() < FOLD_WINDOW_MS;

  if (fold) {
    writeContent(projectId, latest.id, after);
    latest.updatedAt = now.toISOString();
    latest.hash = hash;
    latest.summary = merge(latest.summary, summary);
    writeIndex(projectId, index);
    return latest;
  }

  const id = `${now.getTime()}-${crypto.randomBytes(3).toString("hex")}`;
  writeContent(projectId, id, after);
  const meta: VersionMeta = {
    id,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    label: opts.label?.trim().slice(0, 80) || "Edit",
    summary: summary.slice(0, MAX_SUMMARY + 1),
    checkpoint: Boolean(opts.checkpoint),
    hash,
  };
  index.push(meta);
  writeIndex(projectId, index);
  return meta;
}

/** Newest first. */
export function listVersions(projectId: string): VersionMeta[] {
  return readIndex(projectId).slice().reverse();
}

export function readVersion(projectId: string, versionId: string): (VersionMeta & VersionContent) | null {
  // The id is client data and becomes a filename: it has to be one we issued.
  if (!/^[0-9]+-[a-z0-9]+$/.test(versionId)) return null;
  const meta = readIndex(projectId).find((v) => v.id === versionId);
  if (!meta) return null;
  try {
    const raw = zlib.gunzipSync(fs.readFileSync(path.join(dirOf(projectId), `${versionId}.json.gz`)));
    return { ...meta, ...(JSON.parse(raw.toString("utf-8")) as VersionContent) };
  } catch {
    return null;
  }
}
