import fs from "fs";
import path from "path";

export function listAssetPaths(): string[] {
  const assetsDir = path.join(process.cwd(), "public", "assets");
  if (!fs.existsSync(assetsDir)) return [];

  const paths: string[] = [];

  function walk(dir: string, prefix: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), `${prefix}${entry.name}/`);
      } else {
        paths.push(`${prefix}${entry.name}`);
      }
    }
  }

  walk(assetsDir, "assets/");
  return paths;
}
