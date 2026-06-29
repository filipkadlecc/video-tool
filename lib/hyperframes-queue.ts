import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import PQueue from "p-queue";
import { buildCompositionHtml, parseSceneMeta } from "./hyperframes/template";
import type { RenderJob } from "./render-queue";

// HyperFrames render path — the engine sibling of render-queue.ts. Writes a
// throwaway HyperFrames project (the shared composition template + fonts),
// renders it to MP4 with the HyperFrames CLI, and copies the result into
// public/renders. It shares the SAME global job map as render-queue so the
// existing /api/render/[jobId] status route and ExportDialog polling work
// unchanged.

const HF_VERSION = "0.6.110";

// HyperFrames requires Node >= 22; the Next dev server may run on Node 20.
// Spawn the CLI with an explicit Node-22 binary (configurable).
const NODE_BIN = process.env.HYPERFRAMES_NODE || "/usr/local/bin/node";

// Reuse the render-queue globals so jobs are visible to the shared status route.
const g = globalThis as unknown as {
  __renderQueue?: PQueue;
  __renderJobs?: Map<string, RenderJob>;
};
if (!g.__renderQueue) g.__renderQueue = new PQueue({ concurrency: 1 });
if (!g.__renderJobs) g.__renderJobs = new Map();
const queue = g.__renderQueue;
const jobs = g.__renderJobs;

function generateJobId(): string {
  return `render-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// The HyperFrames CLI only captures at 24/30/60 fps (hard-validated). To deliver
// other rates (e.g. 25 — Filip's default) we CAPTURE at the smallest supported
// rate >= the target, then conform the file to the exact target with ffmpeg.
// Motion is driven by real time in the harness, so both the capture and the
// conform preserve the authored timing/duration — only the file's frame rate
// changes.
function captureFpsFor(targetFps: number): number {
  if (targetFps <= 24) return 24;
  if (targetFps <= 30) return 30;
  return 60;
}

// Output formats. mp4 = opaque (H.264). webm/mov carry an alpha channel — the
// CLI captures them with transparency when the page background is transparent.
// `conform` are the ffmpeg encoder args used ONLY when the fps must be conformed
// (e.g. 25fps): they re-encode while preserving the format's pixel format/alpha.
// `decode` are INPUT options applied before -i: VP9 alpha is only decoded by the
// libvpx-vp9 decoder, so without this the conform would silently drop WebM alpha.
export type HfFormat = "mp4" | "webm" | "mov";
const FORMATS: Record<HfFormat, { ext: string; transparent: boolean; decode: string[]; conform: string[] }> = {
  mp4: { ext: "mp4", transparent: false, decode: [], conform: ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-movflags", "+faststart"] },
  webm: { ext: "webm", transparent: true, decode: ["-c:v", "libvpx-vp9"], conform: ["-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "0", "-crf", "24", "-row-mt", "1"] },
  mov: { ext: "mov", transparent: true, decode: [], conform: ["-c:v", "prores_ks", "-profile:v", "4", "-pix_fmt", "yuva444p10le"] },
};

const FONT_COPIES: { from: string; to: string }[] = [
  { from: "public/fonts/GT-Walsheim-Regular.ttf", to: "GT-Walsheim-Regular.ttf" },
  { from: "public/fonts/GT-Walsheim-Medium.ttf", to: "GT-Walsheim-Medium.ttf" },
  { from: "public/fonts/GT-Walsheim-Bold.ttf", to: "GT-Walsheim-Bold.ttf" },
  { from: "public/fonts/GT-Walsheim-Black.ttf", to: "GT-Walsheim-Black.ttf" },
  { from: "public/assets/fonts/Inter_24pt-SemiBold.ttf", to: "Inter-SemiBold.ttf" },
];

export function enqueueHyperframesRender(
  sceneId: string,
  code: string,
  fps: number,
  width: number,
  height: number,
  format: HfFormat = "mp4",
  // When provided, this fully-formed composition HTML is rendered as-is and the
  // authored-scene path (buildCompositionHtml) is skipped. Used by the Claude
  // Design import bridge, which produces its own React/GSAP composition.
  prebuiltHtml?: string,
): RenderJob {
  const jobId = generateJobId();
  const job: RenderJob = { id: jobId, sceneId, status: "queued", progress: 0 };
  jobs.set(jobId, job);

  queue.add(async () => {
    job.status = "rendering";
    const fmt = FORMATS[format] ?? FORMATS.mp4;
    const meta = prebuiltHtml ? { durationInFrames: 0, fps } : parseSceneMeta(code);
    const sceneFps = meta.fps || fps || 30;
    const captureFps = captureFpsFor(sceneFps); // what the CLI captures at (24/30/60)
    const outputFps = sceneFps;                 // the exact rate of the delivered file
    const needsConform = captureFps !== outputFps;

    const tmpDir = path.join(os.tmpdir(), `hf-render-${jobId}`);
    const fontsDir = path.join(tmpDir, "fonts");
    const outDir = path.join(process.cwd(), "public", "renders");
    const outAbs = path.join(outDir, `${jobId}.${fmt.ext}`);
    // When conforming, capture to a temp file first, then ffmpeg → final output.
    const capturedPath = needsConform ? path.join(tmpDir, `captured.${fmt.ext}`) : outAbs;

    try {
      fs.mkdirSync(fontsDir, { recursive: true });
      fs.mkdirSync(outDir, { recursive: true });

      // Composition HTML (render mode → paused timeline HyperFrames seeks).
      // Transparent page bg for alpha formats so the alpha channel is captured.
      // A prebuilt composition (Claude Design import) is used verbatim.
      const html =
        prebuiltHtml ??
        buildCompositionHtml(code, {
          width,
          height,
          mode: "render",
          transparent: fmt.transparent,
          meta: { durationInFrames: meta.durationInFrames, fps: sceneFps },
        });
      fs.writeFileSync(path.join(tmpDir, "index.html"), html, "utf-8");

      // Minimal project metadata files (mirror `hyperframes init`).
      fs.writeFileSync(
        path.join(tmpDir, "hyperframes.json"),
        JSON.stringify({ $schema: "https://hyperframes.heygen.com/schema/hyperframes.json", paths: { blocks: "compositions", components: "compositions/components", assets: "assets" } }, null, 2),
        "utf-8",
      );
      fs.writeFileSync(
        path.join(tmpDir, "meta.json"),
        JSON.stringify({ id: jobId, name: sceneId }, null, 2),
        "utf-8",
      );

      // Copy brand fonts in (composition references them with relative paths).
      for (const f of FONT_COPIES) {
        const src = path.join(process.cwd(), f.from);
        if (fs.existsSync(src)) fs.copyFileSync(src, path.join(fontsDir, f.to));
      }

      const nodeDir = path.dirname(NODE_BIN);
      const env = { ...process.env, PATH: `${nodeDir}:${process.env.PATH ?? ""}` };

      await new Promise<void>((resolve, reject) => {
        const args = ["--yes", `hyperframes@${HF_VERSION}`, "render", "--format", format, "-f", String(captureFps), "-o", capturedPath];
        const proc = spawn("npx", args, { cwd: tmpDir, env });

        let stderrTail = "";
        const onData = (buf: Buffer) => {
          const s = buf.toString();
          stderrTail = (stderrTail + s).slice(-4000);
          // "Capturing frame 30/252" → percent of capture phase (cap at 95 so
          // encode/assemble can finish the bar).
          const cap = s.match(/Capturing frame\s+(\d+)\/(\d+)/);
          if (cap) {
            const pct = Math.round((parseInt(cap[1], 10) / parseInt(cap[2], 10)) * 90);
            job.progress = Math.min(95, Math.max(job.progress, pct));
          } else {
            const pm = s.match(/(\d+)%/);
            if (pm) job.progress = Math.min(95, Math.max(job.progress, parseInt(pm[1], 10)));
          }
        };
        proc.stdout.on("data", onData);
        proc.stderr.on("data", onData);
        proc.on("error", (err) => reject(err));
        proc.on("close", (codeNum) => {
          if (codeNum === 0 && fs.existsSync(capturedPath)) resolve();
          else reject(new Error(stderrTail.trim() || `HyperFrames render exited with code ${codeNum}. Ensure Node >= 22 is available (set HYPERFRAMES_NODE).`));
        });
      });

      // Conform to the exact target fps (e.g. captured 30 → true 25fps file),
      // re-encoding with the format's alpha-preserving codec/pixel format.
      if (needsConform) {
        job.progress = 96;
        await new Promise<void>((resolve, reject) => {
          const fp = spawn("ffmpeg", ["-y", ...fmt.decode, "-i", capturedPath, "-vf", `fps=${outputFps}`, ...fmt.conform, outAbs]);
          let tail = "";
          fp.stderr.on("data", (b: Buffer) => { tail = (tail + b.toString()).slice(-2000); });
          fp.on("error", (err) => reject(err));
          fp.on("close", (c) => (c === 0 && fs.existsSync(outAbs)) ? resolve() : reject(new Error(tail.trim() || `ffmpeg conform to ${outputFps}fps failed (code ${c})`)));
        });
      }

      job.status = "done";
      job.progress = 100;
      job.outputPath = `/renders/${jobId}.${fmt.ext}`;
    } catch (err) {
      job.status = "error";
      job.error = err instanceof Error ? err.message : "HyperFrames render failed";
    } finally {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    }
  });

  return job;
}
