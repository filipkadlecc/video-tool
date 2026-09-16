import fs from "fs";
import os from "os";
import path from "path";

/**
 * Keeping Remotion's temp bundles from eating the disk.
 *
 * Remotion copies the whole `publicDir` into every bundle it builds, and it
 * builds one per export, per thumbnail, and per refine pass of the agentic
 * loop. Pointed at our real `public/`, each of those copies drags along
 * `public/renders` — every video ever exported, 1.2 GB and climbing — into a
 * throwaway folder in $TMPDIR. One day of rendering left 107 abandoned bundles
 * totalling 168 GB, and filled the drive to 100%.
 *
 * Two things fix it: hand Remotion a public folder that leaves `renders` out,
 * and clear up the bundles once they have served their render.
 */

const BUNDLE_PREFIX = "remotion-webpack-bundle-";
const MIRROR_DIR = path.join(os.tmpdir(), "vt-public-lean");

/**
 * A stand-in for `public/` that leaves out `renders`.
 *
 * Nothing a scene draws ever reads from `public/renders`; it exists so Next can
 * serve finished exports over HTTP. Dropping it takes what Remotion copies into
 * each bundle from 1.6 GB down to ~390 MB.
 *
 * The mirror is built from hard links, so it occupies no disk of its own and
 * costs a few milliseconds to assemble. Symlinks would be tidier but do not
 * work: the renderer's static server stats files with `lstat` and serves only
 * what reports as a regular file or a directory, so a symlinked asset 404s
 * midway through a render.
 *
 * Rebuilt on each call — cheap at this size, and it means an asset added while
 * the server is up is picked up by the next render rather than going missing
 * until a restart.
 */
export function leanPublicDir(): string {
  const realPublic = path.join(process.cwd(), "public");
  mirror(realPublic, MIRROR_DIR, (name, depth) => !(depth === 0 && name === "renders") && name !== ".DS_Store");
  return MIRROR_DIR;
}

function mirror(src: string, dest: string, keep: (name: string, depth: number) => boolean, depth = 0): void {
  fs.mkdirSync(dest, { recursive: true });

  const wanted = fs
    .readdirSync(src, { withFileTypes: true })
    .filter((entry) => keep(entry.name, depth));
  const wantedNames = new Set(wanted.map((entry) => entry.name));

  // Drop anything the real folder no longer has, so a deleted asset doesn't
  // linger in the mirror and get bundled forever.
  for (const stale of fs.readdirSync(dest)) {
    if (wantedNames.has(stale)) continue;
    try { fs.rmSync(path.join(dest, stale), { recursive: true, force: true }); } catch { /* already gone */ }
  }

  for (const entry of wanted) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      mirror(from, to, keep, depth + 1);
      continue;
    }
    if (!entry.isFile()) continue;

    /*
     * A hard link is the same inode as the original, so a file that was
     * replaced rather than edited in place leaves the mirror pointing at the
     * old contents. Comparing inodes catches that; nothing else has to change
     * when an asset is overwritten.
     */
    try {
      if (fs.statSync(to).ino === fs.statSync(from).ino) continue;
      fs.unlinkSync(to);
    } catch { /* not mirrored yet */ }

    try {
      fs.linkSync(from, to);
    } catch {
      // Different filesystem, or a racing render got there first. A real copy
      // still produces a correct bundle.
      try { fs.copyFileSync(from, to); } catch { /* leave it out rather than fail the render */ }
    }
  }
}

/**
 * Delete bundles the Remotion CLI left behind.
 *
 * The programmatic path names its own bundle and removes it when the render
 * ends, but `npx remotion render` and `npx remotion still` each mint a
 * `remotion-webpack-bundle-*` folder in $TMPDIR and never clear it up. macOS is
 * meant to sweep $TMPDIR eventually; it does not keep pace with a busy day.
 *
 * Only touches bundles older than `maxAgeMs`, so a render still reading from
 * one is never pulled out from under itself.
 */
export function sweepStaleBundles(maxAgeMs = 30 * 60 * 1000): number {
  const cutoff = Date.now() - maxAgeMs;
  let removed = 0;

  let entries: string[];
  try {
    entries = fs.readdirSync(os.tmpdir());
  } catch {
    return 0;
  }

  for (const name of entries) {
    if (!name.startsWith(BUNDLE_PREFIX)) continue;
    const full = path.join(os.tmpdir(), name);
    try {
      const stat = fs.lstatSync(full);
      if (!stat.isDirectory() || stat.mtimeMs > cutoff) continue;
      fs.rmSync(full, { recursive: true, force: true });
      removed += 1;
    } catch { /* in use, or vanished under us */ }
  }

  return removed;
}
