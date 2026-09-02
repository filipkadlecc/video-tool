import { Config } from "@remotion/cli/config";
import fs from "node:fs";
import path from "node:path";

// Make REMOTION_* variables from .env.local available while this config file is
// evaluated, so both `npm run studio` and every export the app spawns pick up the
// license key below. (Next.js already loads .env.local for app-spawned renders;
// this covers running the Remotion CLI directly, e.g. the studio.)
try {
  const envFile = path.resolve(process.cwd(), ".env.local");
  for (const line of fs.readFileSync(envFile, "utf-8").split("\n")) {
    const match = line.match(/^\s*(REMOTION_[A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2];
    }
  }
} catch {
  // No .env.local present — the key may come from the real environment instead.
}

Config.setVideoImageFormat("jpeg");

// Remotion company license: report each render to remotion.pro for seat tracking.
// Uses the PUBLIC key (safe to expose). Get it from remotion.pro -> License keys.
const publicLicenseKey = process.env.REMOTION_PUBLIC_LICENSE_KEY;
if (publicLicenseKey && publicLicenseKey.startsWith("rm_pub_")) {
  Config.setPublicLicenseKey(publicLicenseKey);
}
