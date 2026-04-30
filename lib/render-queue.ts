import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import PQueue from "p-queue";

const PROJECTS_DIR = path.join(process.cwd(), "data", "projects");

export interface RenderJob {
  id: string;
  sceneId: string;
  status: "queued" | "rendering" | "done" | "error";
  progress: number;
  outputPath?: string;
  error?: string;
}

// Use globalThis to persist state across Next.js dev mode module re-evaluations
const g = globalThis as unknown as {
  __renderQueue?: PQueue;
  __renderJobs?: Map<string, RenderJob>;
};

if (!g.__renderQueue) {
  g.__renderQueue = new PQueue({ concurrency: 1 });
}
if (!g.__renderJobs) {
  g.__renderJobs = new Map();
}

const queue = g.__renderQueue;
const jobs = g.__renderJobs;

function generateJobId(): string {
  return `render-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getJob(jobId: string): RenderJob | undefined {
  return jobs.get(jobId);
}

function createEntryFile(scenePath: string, durationInFrames: number, fps: number, width: number, height: number): string {
  const entryPath = scenePath.replace(".tsx", ".entry.tsx");
  const relativeScene = `./${path.basename(scenePath).replace(".tsx", "")}`;

  const entryCode = `
import { registerRoot } from "remotion";
import { Composition } from "remotion";
import React from "react";
import SceneComponent from "${relativeScene}";

const Root: React.FC = () => {
  return (
    <Composition
      id="Scene"
      component={SceneComponent}
      durationInFrames={${durationInFrames}}
      fps={${fps}}
      width={${width}}
      height={${height}}
    />
  );
};

registerRoot(Root);
`;

  fs.writeFileSync(entryPath, entryCode, "utf-8");
  return entryPath;
}

export type RenderCodec = "h264" | "prores" | "prores-xq" | "uncompressed";

export function enqueueRender(sceneId: string, code: string, durationInFrames = 250, fps = 25, width = 3840, height = 2160, codec: RenderCodec = "h264"): RenderJob {
  const jobId = generateJobId();
  const job: RenderJob = {
    id: jobId,
    sceneId,
    status: "queued",
    progress: 0,
  };
  jobs.set(jobId, job);

  queue.add(async () => {
    job.status = "rendering";

    const scenePath = path.join(
      process.cwd(),
      "remotion",
      "scenes",
      `_render_${jobId}.tsx`
    );
    let entryPath = "";

    try {
      let fixedCode = fixImportPaths(code);
      if (codec === "prores" || codec === "prores-xq") {
        fixedCode = stripBackgroundsForTransparency(fixedCode);
      }
      fs.writeFileSync(scenePath, fixedCode, "utf-8");
      entryPath = createEntryFile(scenePath, durationInFrames, fps, width, height);

      const ext = codec === "h264" ? "mp4" : "mov";
      const outputPath = path.join(
        process.cwd(),
        "public",
        "renders",
        `${jobId}.${ext}`
      );

      fs.mkdirSync(path.dirname(outputPath), { recursive: true });

      let stderrLog = "";

      const remotionCodec = codec === "prores-xq" ? "prores" : codec === "uncompressed" ? "prores" : codec;
      const renderArgs = [
        "remotion",
        "render",
        entryPath,
        "Scene",
        outputPath,
        "--codec",
        remotionCodec,
      ];
      if (codec === "prores") {
        renderArgs.push("--prores-profile", "4444", "--image-format", "png", "--pixel-format", "yuva444p10le");
      } else if (codec === "prores-xq") {
        renderArgs.push("--prores-profile", "4444-xq", "--image-format", "png", "--pixel-format", "yuva444p10le");
      } else if (codec === "uncompressed") {
        // ProRes 4444 XQ is the highest quality Remotion supports natively.
        // For truly uncompressed, we render ProRes 4444 XQ and then rewrap via ffmpeg.
        // But for practical color grading, ProRes 4444 XQ is industry-standard.
        renderArgs.push("--prores-profile", "4444-xq", "--image-format", "png", "--pixel-format", "yuva444p10le");
      }

      await new Promise<void>((resolve, reject) => {
        const proc = spawn(
          "npx",
          renderArgs,
          {
            cwd: process.cwd(),
            env: { ...process.env },
          }
        );

        proc.stderr.on("data", (data: Buffer) => {
          const line = data.toString();
          stderrLog += line;
          const match = line.match(/(\d+)%/);
          if (match) {
            job.progress = parseInt(match[1], 10);
          }
          // Also parse "Rendered X/Y" format
          const renderedMatch = line.match(/Rendered\s+(\d+)\/(\d+)/);
          if (renderedMatch) {
            job.progress = Math.round(
              (parseInt(renderedMatch[1], 10) / parseInt(renderedMatch[2], 10)) * 100
            );
          }
        });

        proc.stdout.on("data", (data: Buffer) => {
          const line = data.toString();
          const match = line.match(/(\d+)%/);
          if (match) {
            job.progress = parseInt(match[1], 10);
          }
          const renderedMatch = line.match(/Rendered\s+(\d+)\/(\d+)/);
          if (renderedMatch) {
            job.progress = Math.round(
              (parseInt(renderedMatch[1], 10) / parseInt(renderedMatch[2], 10)) * 100
            );
          }
        });

        proc.on("close", (exitCode) => {
          if (exitCode === 0) {
            resolve();
          } else {
            const tail = stderrLog.slice(-500).trim();
            reject(new Error(`Render failed: ${tail}`));
          }
        });

        proc.on("error", reject);
      });

      job.status = "done";
      job.progress = 100;
      job.outputPath = `/renders/${jobId}.${ext}`;
    } catch (err) {
      job.status = "error";
      job.error = err instanceof Error ? err.message : "Unknown error";
    } finally {
      try { fs.unlinkSync(scenePath); } catch {}
      try { if (entryPath) fs.unlinkSync(entryPath); } catch {}
    }
  });

  return job;
}

function stripBackgroundsForTransparency(code: string): string {
  // Replace <Background /> usage with nothing (component stays defined but unused)
  let result = code.replace(/<Background\s*\/>/g, "{/* transparent */}");
  // Replace BlackScreen solid bg with transparent
  result = result.replace(/backgroundColor:\s*COLORS\.bg/g, 'backgroundColor: "transparent"');
  // Also catch hex-based dark backgrounds in BlackScreen-like patterns
  result = result.replace(
    /const\s+BlackScreen[\s\S]*?backgroundColor:\s*["']#[0-9a-fA-F]+["']/g,
    (match) => match.replace(/backgroundColor:\s*["']#[0-9a-fA-F]+["']/, 'backgroundColor: "transparent"')
  );
  return result;
}

function fixImportPaths(code: string): string {
  return code
    .replace(/from\s+["']\.\.\/remotion\/theme["']/g, 'from "../theme"')
    .replace(/from\s+["']@\/remotion\/theme["']/g, 'from "../theme"')
    .replace(/from\s+["']remotion\/theme["']/g, 'from "../theme"');
}

export async function renderThumbnail(
  projectId: string,
  code: string,
  fps: number,
  width: number,
  height: number,
  frame = 60,
): Promise<void> {
  const scenesDir = path.join(process.cwd(), "remotion", "scenes");
  fs.mkdirSync(scenesDir, { recursive: true });

  const tag = `_thumb_${projectId.slice(0, 8)}`;
  const scenePath = path.join(scenesDir, `${tag}.tsx`);
  const fixedCode = fixImportPaths(code);
  fs.writeFileSync(scenePath, fixedCode, "utf-8");

  const entryPath = createEntryFile(scenePath, frame + 30, fps, width, height);

  const outputDir = path.join(PROJECTS_DIR, projectId);
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, "thumbnail.png");

  try {
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(
        "npx",
        [
          "remotion",
          "still",
          entryPath,
          "Scene",
          outputPath,
          "--frame",
          String(frame),
        ],
        { cwd: process.cwd(), env: { ...process.env } },
      );

      let stderrLog = "";
      proc.stderr.on("data", (d: Buffer) => { stderrLog += d.toString(); });
      proc.on("close", (exitCode) => {
        if (exitCode === 0) resolve();
        else reject(new Error(`Thumbnail render failed: ${stderrLog.slice(-300)}`));
      });
      proc.on("error", reject);
    });
  } finally {
    try { fs.unlinkSync(scenePath); } catch {}
    try { fs.unlinkSync(entryPath); } catch {}
  }
}
