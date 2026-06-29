import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const FEEDBACK_DIR = path.join(process.cwd(), "data", "feedback");

export interface FeedbackEntry {
  id: string;
  message: string;
  /** JPEG data URL of the screen at submit time, if the user kept it. */
  screenshot?: string;
  /** Project id when the feedback was filed from inside a project. */
  projectId?: string;
  /** Pathname the feedback was filed from (e.g. "/project/abc"). */
  url?: string;
  createdAt: string;
}

export interface NewFeedback {
  message: string;
  screenshot?: string;
  projectId?: string;
  url?: string;
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function saveFeedback(input: NewFeedback): FeedbackEntry {
  ensureDir(FEEDBACK_DIR);
  const entry: FeedbackEntry = {
    id: randomUUID(),
    message: input.message,
    screenshot: input.screenshot,
    projectId: input.projectId,
    url: input.url,
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(FEEDBACK_DIR, `${entry.id}.json`),
    JSON.stringify(entry, null, 2),
    "utf-8"
  );
  return entry;
}

export function listFeedback(): FeedbackEntry[] {
  ensureDir(FEEDBACK_DIR);
  const entries: FeedbackEntry[] = [];
  for (const file of fs.readdirSync(FEEDBACK_DIR)) {
    if (!file.endsWith(".json")) continue;
    try {
      entries.push(JSON.parse(fs.readFileSync(path.join(FEEDBACK_DIR, file), "utf-8")) as FeedbackEntry);
    } catch {
      // skip corrupted files
    }
  }
  return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function deleteFeedback(id: string): boolean {
  const file = path.join(FEEDBACK_DIR, `${id}.json`);
  if (!fs.existsSync(file)) return false;
  fs.rmSync(file);
  return true;
}
