#!/usr/bin/env node
/**
 * One-time generator for the Style-preview clips shown in the New Project modal.
 *
 * For each of the four style modes it:
 *   1. POSTs the canonical demo prompt to /api/generate (which branches on styleMode)
 *   2. extracts the TSX code from the streamed response
 *   3. renders a short h264 clip via /api/render
 *   4. copies the result into public/style-previews/<style>.mp4
 *
 * Run with the dev server up:
 *   npm run dev          # in one terminal
 *   node scripts/gen-style-previews.mjs   # in another
 *
 * Override the prompt:  PROMPT="..." node scripts/gen-style-previews.mjs
 * Override one style:   STYLES=kinetic node scripts/gen-style-previews.mjs
 */

import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const PROMPT =
  process.env.PROMPT || "Reveal the headline: Apify ships hundreds of Actors.";
const ALL_STYLES = ["default", "kinetic", "editorial", "cinematic"];
const STYLES = process.env.STYLES ? process.env.STYLES.split(",") : ALL_STYLES;

// Must match the canvas size declared to the AI at generate time
// (projectSettings 1080p horizontal -> 1920x1080). The generated code lays
// elements out in absolute px against that canvas, so rendering smaller pushes
// them out of frame. The modal scales the clip down with object-fit anyway.
const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 25;
const DURATION_FRAMES = 75; // ~3s

const OUT_DIR = path.join(process.cwd(), "public", "style-previews");
const RENDERS_DIR = path.join(process.cwd(), "public", "renders");

// Mirror of extractCodeFromResponse() in components/ChatPanel.tsx — pull the
// first fenced code block, falling back to an unterminated fence.
function extractCode(text) {
  const fenceMatch = text.match(/```(?:tsx|typescript|jsx)?\s*\n([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const openFence = text.match(/```(?:tsx|typescript|jsx)?\s*\n([\s\S]*)/);
  if (openFence) return openFence[1].trim();
  return "";
}

async function generateCode(styleMode) {
  const res = await fetch(`${BASE}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: PROMPT }],
      projectSettings: { resolution: "1080p", orientation: "horizontal", fps: FPS },
      animationType: "animation",
      styleMode,
    }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`generate failed: ${res.status} ${await res.text()}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") continue;
      try {
        const obj = JSON.parse(payload);
        if (obj.text) full += obj.text;
        if (obj.error) throw new Error(`generate stream error: ${obj.error}`);
      } catch (e) {
        if (e.message?.startsWith("generate stream error")) throw e;
        // ignore non-JSON keepalive lines
      }
    }
  }
  const code = extractCode(full);
  if (!code) throw new Error("no code extracted from generate response");
  return code;
}

async function render(styleMode, code) {
  const res = await fetch(`${BASE}/api/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sceneId: `style-preview-${styleMode}`,
      code,
      durationInFrames: DURATION_FRAMES,
      fps: FPS,
      width: WIDTH,
      height: HEIGHT,
      codec: "h264",
    }),
  });
  if (!res.ok) throw new Error(`render enqueue failed: ${res.status} ${await res.text()}`);
  const job = await res.json();

  // Poll until done.
  for (;;) {
    await new Promise((r) => setTimeout(r, 2000));
    const s = await fetch(`${BASE}/api/render/${job.id}`);
    if (!s.ok) throw new Error(`render status failed: ${s.status}`);
    const j = await s.json();
    process.stdout.write(`\r  ${styleMode}: ${j.status} ${Math.round(j.progress ?? 0)}%   `);
    if (j.status === "done") {
      process.stdout.write("\n");
      return j.outputPath; // e.g. /renders/<jobId>.mp4
    }
    if (j.status === "error") throw new Error(`render error: ${j.error}`);
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Prompt: "${PROMPT}"`);
  console.log(`Styles: ${STYLES.join(", ")}\n`);

  for (const styleMode of STYLES) {
    if (!ALL_STYLES.includes(styleMode)) {
      console.warn(`! skipping unknown style "${styleMode}"`);
      continue;
    }
    console.log(`[${styleMode}] generating…`);
    const code = await generateCode(styleMode);
    console.log(`[${styleMode}] rendering…`);
    const webPath = await render(styleMode, code);
    const srcFile = path.join(RENDERS_DIR, path.basename(webPath));
    const destFile = path.join(OUT_DIR, `${styleMode}.mp4`);
    fs.copyFileSync(srcFile, destFile);
    console.log(`[${styleMode}] -> ${path.relative(process.cwd(), destFile)}\n`);
  }
  console.log("Done. Commit public/style-previews/*.mp4");
}

main().catch((err) => {
  console.error("\nFAILED:", err.message);
  process.exit(1);
});
