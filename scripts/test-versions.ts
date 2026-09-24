/**
 * Unit tests for the project version history (lib/versions.ts).
 *
 *   npx tsx scripts/test-versions.ts
 *
 * Runs against a throwaway directory: the module resolves data/projects from
 * the working directory, so the test moves into a temp dir BEFORE importing it.
 */
import fs from "fs";
import os from "os";
import path from "path";

let pass = 0, fail = 0;
const a = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log("  FAIL: " + m); } };
const head = (t: string) => console.log("\n--- " + t + " ---");

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vt-versions-"));
  process.chdir(tmp);
  const { recordVersion, listVersions, readVersion } = await import("../lib/versions");
  const { emptyDoc, addItem, renameItem } = await import("../lib/editor-doc");

  const pid = "p1";
  fs.mkdirSync(path.join(tmp, "data", "projects", pid), { recursive: true });
  const box = { x: 0, y: 0, width: 10, height: 10 };
  const d0 = emptyDoc({ width: 10, height: 10, fps: 30 });
  const t = d0.tracks[0].id;
  const doc1 = addItem(d0, t, { type: "scene", id: "s1", from: 0, durationInFrames: 30, layout: box, code: "x" });
  const doc2 = renameItem(doc1, "s1", "Intro");
  const doc3 = renameItem(doc1, "s1", "Opening");
  const at = (sec: number) => new Date(Date.UTC(2026, 8, 24, 12, 0, sec));

  head("recording");
  a(recordVersion(pid, { doc: doc1 }, { doc: doc1 }) === null, "a save that changes nothing records nothing");

  recordVersion(pid, { doc: doc1 }, { doc: doc2 }, { now: at(0) });
  let list = listVersions(pid);
  a(list.length === 2, "the first save also keeps the state from before it");
  a(list[1].label === "Before history began" && list[0].label === "Edit", "labelled so they read in order");
  a(list[0].summary.includes("Scene 1 renamed") || list[0].summary.some((l) => l.includes("renamed")), "the summary says what changed, in plain words");

  recordVersion(pid, { doc: doc2 }, { doc: doc3 }, { now: at(20) });
  list = listVersions(pid);
  a(list.length === 2, "saves within a minute of each other fold into one version");
  a(readVersion(pid, list[0].id)?.doc?.tracks[0].items[0].name === "Opening", "and the folded version holds the latest state");

  recordVersion(pid, { doc: doc3 }, { doc: doc2 }, { now: at(90) });
  a(listVersions(pid).length === 3, "a save a minute later starts a new version");

  recordVersion(pid, { doc: doc2 }, { doc: doc1 }, { now: at(95), label: "AI edit", checkpoint: true });
  recordVersion(pid, { doc: doc1 }, { doc: doc3 }, { now: at(97) });
  list = listVersions(pid);
  a(list.length === 5, "an AI edit stands alone, and the edit after it is not folded into it");
  a(list[1].label === "AI edit" && list[1].checkpoint, "the AI edit keeps its label");

  head("reading back");
  const base = list[list.length - 1];
  a(readVersion(pid, base.id)?.doc?.tracks[0].items[0].name === undefined, "the oldest version is the untouched original");
  a(readVersion(pid, "../../etc/passwd") === null, "an id that isn't one we issued is refused");
  a(readVersion(pid, "123-nope") === null, "an unknown id is refused");

  head("code-only projects");
  fs.mkdirSync(path.join(tmp, "data", "projects", "p2"), { recursive: true });
  a(recordVersion("p2", { code: "" }, { code: "const a = 1;" }, { now: at(0) }) !== null, "scene code is versioned too");
  a(listVersions("p2").length === 1, "an empty project has no 'before' worth keeping");
  a(listVersions("p2")[0].summary.includes("Scene code edited"), "and the change is described");

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n==== ${pass} passed, ${fail} failed ====`);
  if (fail) process.exit(1);
}

main();
