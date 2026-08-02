import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import PQueue from "p-queue";
import { stripBackgroundsForTransparency } from "./transparent-bg";

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
  __rendersCleanupDone?: boolean;
};

if (!g.__renderQueue) {
  g.__renderQueue = new PQueue({ concurrency: 1 });
}
if (!g.__renderJobs) {
  g.__renderJobs = new Map();
}

// Auto-cleanup: on first boot, remove rendered files older than 7 days.
// Renders are a cache of past exports — not surfaced in the UI — so they're safe to expire.
if (!g.__rendersCleanupDone) {
  g.__rendersCleanupDone = true;
  const dir = path.join(process.cwd(), "public", "renders");
  if (fs.existsSync(dir)) {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const f of fs.readdirSync(dir)) {
      const full = path.join(dir, f);
      try {
        const s = fs.statSync(full);
        if (s.isFile() && s.mtimeMs < cutoff) fs.unlinkSync(full);
      } catch {}
    }
  }
}

const queue = g.__renderQueue;
const jobs = g.__renderJobs;

function generateJobId(): string {
  return `render-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getJob(jobId: string): RenderJob | undefined {
  return jobs.get(jobId);
}

function createEntryFile(scenePath: string, durationInFrames: number, fps: number, width: number, height: number, svgContents?: { filename: string; content: string }[]): string {
  const entryPath = scenePath.replace(".tsx", ".entry.tsx");
  const relativeScene = `./${path.basename(scenePath).replace(".tsx", "")}`;
  // SVG frames inline as JSON so the renderer doesn't need a side-channel
  const svgFramesJson = JSON.stringify(svgContents ?? []);

  const entryCode = `
import { registerRoot } from "remotion";
import { Composition } from "remotion";
import React from "react";
import { SvgFramesProvider } from "../motion";
import SceneInner from "${relativeScene}";

const __SVG_FRAMES__ = ${svgFramesJson};
const SceneComponent: React.FC = () => (
  <SvgFramesProvider value={__SVG_FRAMES__}>
    <SceneInner />
  </SvgFramesProvider>
);

// Block the renderer until Inter loads. Without this, Chromium falls back to
// serif/Times for the first frame and the export looks nothing like the preview.
// @remotion/google-fonts integrates with delayRender/continueRender so frames
// are not captured until weights are available.
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
loadInter("normal", { weights: ["400", "500", "600", "700", "900"] });

// GT Walsheim is local-licensed; load via the standard FontFace API behind
// delayRender so the renderer waits for it too.
import { delayRender, continueRender, staticFile } from "remotion";
const __gtWeights = [
  { weight: "400", file: "GT-Walsheim-Regular.ttf" },
  { weight: "500", file: "GT-Walsheim-Medium.ttf" },
  { weight: "700", file: "GT-Walsheim-Bold.ttf" },
  { weight: "900", file: "GT-Walsheim-Black.ttf" },
];
const __gtHandle = delayRender("Loading GT Walsheim");
Promise.all(
  __gtWeights.map(async ({ weight, file }) => {
    const f = new FontFace("GT Walsheim", \`url(\${staticFile("fonts/" + file)})\`, {
      weight,
      style: "normal",
      display: "block" as FontDisplay,
    });
    await f.load();
    (document.fonts as FontFaceSet).add(f);
  }),
).finally(() => continueRender(__gtHandle));

// Default the entire rendered document to Inter. Without this, any text in
// the LLM-generated scene that forgets fontFamily inherits Chromium's serif
// default (Times) — fonts load correctly but nothing uses them by name.
// Injected as a constructable stylesheet so it covers every frame.
if (typeof document !== "undefined") {
  const __style = document.createElement("style");
  __style.textContent = \`
    html, body, #root, * {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
  \`;
  document.head.appendChild(__style);
}

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

export type RenderCodec = "h264" | "prores" | "prores-xq" | "uncompressed" | "qtrle" | "hevc-alpha";

// Escape an absolute path for use inside an ffmpeg filtergraph value (e.g. lut3d).
// Single-quote so spaces/colons are literal; escape embedded backslashes and quotes.
function escapeForFiltergraph(p: string): string {
  return `'${p.replace(/\\/g, "\\\\").replace(/'/g, "'\\''")}'`;
}

// `lut` is an absolute path to a .cube file (already resolved + traversal-guarded by
// the caller), or undefined for no grade. Applied only to the opaque h264 export.
export function enqueueRender(sceneId: string, code: string, durationInFrames = 250, fps = 25, width = 3840, height = 2160, codec: RenderCodec = "h264", svgContents?: { filename: string; content: string }[], lut?: string): RenderJob {
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
      if (codec === "prores" || codec === "prores-xq" || codec === "qtrle" || codec === "hevc-alpha") {
        fixedCode = stripBackgroundsForTransparency(fixedCode);
      }
      fs.writeFileSync(scenePath, fixedCode, "utf-8");
      entryPath = createEntryFile(scenePath, durationInFrames, fps, width, height, svgContents);

      const ext = codec === "h264" ? "mp4" : "mov";
      const outputPath = path.join(
        process.cwd(),
        "public",
        "renders",
        `${jobId}.${ext}`
      );

      // Apply a color-grade LUT (ffmpeg lut3d) only on the opaque h264 path in v1.
      const applyLut = codec === "h264" && !!lut;

      // qtrle and hevc-alpha aren't supported natively by Remotion: render
      // ProRes 4444 (with alpha) to a temp file, then transcode via ffmpeg.
      // When grading h264, likewise render to a temp .mp4, then run the LUT pass.
      const remotionOutputPath = (codec === "qtrle" || codec === "hevc-alpha")
        ? path.join(process.cwd(), "public", "renders", `${jobId}.prores.mov`)
        : applyLut
          ? path.join(process.cwd(), "public", "renders", `${jobId}.src.mp4`)
          : outputPath;

      fs.mkdirSync(path.dirname(outputPath), { recursive: true });

      let stderrLog = "";

      const remotionCodec =
        codec === "prores-xq" ? "prores" :
        codec === "uncompressed" ? "prores" :
        codec === "qtrle" ? "prores" :
        codec === "hevc-alpha" ? "prores" :
        codec;
      const renderArgs = [
        "remotion",
        "render",
        entryPath,
        "Scene",
        remotionOutputPath,
        "--codec",
        remotionCodec,
      ];
      if (codec === "prores") {
        renderArgs.push("--prores-profile", "4444", "--image-format", "png", "--pixel-format", "yuva444p10le");
      } else if (codec === "prores-xq") {
        renderArgs.push("--prores-profile", "4444-xq", "--image-format", "png", "--pixel-format", "yuva444p10le");
      } else if (codec === "qtrle") {
        renderArgs.push("--prores-profile", "4444", "--image-format", "png", "--pixel-format", "yuva444p10le");
      } else if (codec === "hevc-alpha") {
        renderArgs.push("--prores-profile", "4444", "--image-format", "png", "--pixel-format", "yuva444p10le");
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
            // Pull the real error line (e.g. "Module not found", "SyntaxError")
            // out of the stderr stream — it's usually buried above the stack.
            const lines = stderrLog.split("\n").map((l) => l.trim()).filter(Boolean);
            const signal = lines.find((l) => /error|cannot find|module not found|syntaxerror|failed to compile|unexpected token/i.test(l) && !l.startsWith("at "));
            const tail = signal ? `${signal}\n${stderrLog.slice(-300).trim()}` : stderrLog.slice(-1200).trim();
            console.error("[render] full stderr for job", jobId, "\n", stderrLog);
            reject(new Error(`Render failed: ${tail}`));
          }
        });

        proc.on("error", reject);
      });

      // Color-grade pass: bake the selected .cube LUT into the h264 export via
      // lut3d, re-encoding the temp master to the final .mp4 (CRF 18 to match
      // Remotion's h264), preserving any audio track.
      if (applyLut && lut) {
        await new Promise<void>((resolve, reject) => {
          const ff = spawn(
            "ffmpeg",
            [
              "-y", "-i", remotionOutputPath,
              "-vf", `lut3d=${escapeForFiltergraph(lut)}`,
              "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p",
              "-c:a", "copy",
              "-movflags", "+faststart",
              outputPath,
            ],
            { cwd: process.cwd(), env: { ...process.env } }
          );
          let ffErr = "";
          ff.stderr.on("data", (d: Buffer) => { ffErr += d.toString(); });
          ff.on("close", (code) => {
            if (code === 0) resolve();
            else reject(new Error(`ffmpeg LUT pass failed: ${ffErr.slice(-500).trim()}`));
          });
          ff.on("error", reject);
        });
        try { fs.unlinkSync(remotionOutputPath); } catch {}
      }

      if (codec === "qtrle") {
        await new Promise<void>((resolve, reject) => {
          const ff = spawn(
            "ffmpeg",
            ["-y", "-i", remotionOutputPath, "-c:v", "qtrle", "-pix_fmt", "argb", outputPath],
            { cwd: process.cwd(), env: { ...process.env } }
          );
          let ffErr = "";
          ff.stderr.on("data", (d: Buffer) => { ffErr += d.toString(); });
          ff.on("close", (code) => {
            if (code === 0) resolve();
            else reject(new Error(`ffmpeg qtrle transcode failed: ${ffErr.slice(-500).trim()}`));
          });
          ff.on("error", reject);
        });
        try { fs.unlinkSync(remotionOutputPath); } catch {}
      }

      // HEVC-with-alpha: Apple's native transparent-video format. Decoded by
      // AVFoundation on macOS, so CapCut Mac / FCP / Motion / Safari handle
      // it without the color-management games that break ProRes 4444 and
      // QT-RLE imports. Encoder is macOS-only (hevc_videotoolbox). The alpha
      // is stored as a sidecar HEVC layer inside the hvc1 track; ffprobe
      // reports the main pix_fmt as yuv420p but decoded output is RGBA.
      if (codec === "hevc-alpha") {
        await new Promise<void>((resolve, reject) => {
          const ff = spawn(
            "ffmpeg",
            [
              "-y", "-i", remotionOutputPath,
              "-c:v", "hevc_videotoolbox",
              "-allow_sw", "1",
              "-alpha_quality", "0.75",
              "-tag:v", "hvc1",
              "-pix_fmt", "yuva420p",
              "-color_primaries", "bt709",
              "-color_trc", "bt709",
              "-colorspace", "bt709",
              "-bsf:v", "hevc_metadata=video_full_range_flag=0:colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1",
              "-movflags", "+faststart",
              outputPath,
            ],
            { cwd: process.cwd(), env: { ...process.env } }
          );
          let ffErr = "";
          ff.stderr.on("data", (d: Buffer) => { ffErr += d.toString(); });
          ff.on("close", (code) => {
            if (code === 0) resolve();
            else reject(new Error(`ffmpeg hevc-alpha transcode failed: ${ffErr.slice(-500).trim()}`));
          });
          ff.on("error", reject);
        });
        try { fs.unlinkSync(remotionOutputPath); } catch {}
      }

      // Remotion's ProRes export writes pixels with `color_range=tv` but leaves
      // color matrix/transfer/primaries unset. NLEs that don't see the matrix
      // tag (CapCut, some Premiere setups) guess BT.601 or treat the file as
      // full-range, which shifts saturated colors (Apify orange goes yellowy)
      // and causes per-frame YUV→RGB rounding flicker. Re-tag in place via
      // the prores_metadata bitstream filter — no re-encode, ~200ms.
      if (codec === "prores" || codec === "prores-xq" || codec === "uncompressed") {
        const tagged = outputPath.replace(/\.mov$/, ".tagged.mov");
        await new Promise<void>((resolve, reject) => {
          const ff = spawn(
            "ffmpeg",
            [
              "-y", "-i", outputPath,
              "-c", "copy",
              "-bsf:v", "prores_metadata=color_primaries=bt709:color_trc=bt709:colorspace=bt709",
              tagged,
            ],
            { cwd: process.cwd(), env: { ...process.env } },
          );
          let ffErr = "";
          ff.stderr.on("data", (d: Buffer) => { ffErr += d.toString(); });
          ff.on("close", (code) => {
            if (code === 0) resolve();
            else reject(new Error(`ffmpeg prores re-tag failed: ${ffErr.slice(-500).trim()}`));
          });
          ff.on("error", reject);
        });
        fs.renameSync(tagged, outputPath);
      }

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

function fixImportPaths(code: string): string {
  return code
    .replace(/from\s+["']\.\.\/remotion\/theme["']/g, 'from "../theme"')
    .replace(/from\s+["']@\/remotion\/theme["']/g, 'from "../theme"')
    .replace(/from\s+["']remotion\/theme["']/g, 'from "../theme"')
    .replace(/from\s+["']\.\.\/\.\.\/theme["']/g, 'from "../theme"')
    .replace(/from\s+["']\.\.\/remotion\/motion["']/g, 'from "../motion"')
    .replace(/from\s+["']@\/remotion\/motion["']/g, 'from "../motion"')
    .replace(/from\s+["']remotion\/motion["']/g, 'from "../motion"')
    .replace(/from\s+["']\.\.\/\.\.\/motion["']/g, 'from "../motion"')
    .replace(/from\s+["']@\/lib\/brand["']/g, 'from "../../lib/brand"');
}

export async function renderThumbnail(
  projectId: string,
  code: string,
  fps: number,
  width: number,
  height: number,
  frame = 60,
  svgContents?: { filename: string; content: string }[],
): Promise<void> {
  const scenesDir = path.join(process.cwd(), "remotion", "scenes");
  fs.mkdirSync(scenesDir, { recursive: true });

  const tag = `_thumb_${projectId.slice(0, 8)}`;
  const scenePath = path.join(scenesDir, `${tag}.tsx`);
  const fixedCode = fixImportPaths(code);
  fs.writeFileSync(scenePath, fixedCode, "utf-8");

  const entryPath = createEntryFile(scenePath, frame + 30, fps, width, height, svgContents);

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
