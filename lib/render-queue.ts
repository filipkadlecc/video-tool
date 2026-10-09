import { spawn, type ChildProcess } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import PQueue from "p-queue";
import { bundle } from "@remotion/bundler";
import { selectComposition, renderStill, openBrowser } from "@remotion/renderer";
import sharp from "sharp";
import { stripBackgroundsForTransparency } from "./transparent-bg";
import { leanPublicDir, sweepStaleBundles } from "./remotion-bundle";

const PROJECTS_DIR = path.join(process.cwd(), "data", "projects");

export interface RenderJob {
  id: string;
  sceneId: string;
  status: "queued" | "rendering" | "done" | "error" | "cancelled";
  progress: number;
  /**
   * Real frame counts, straight from the renderer's own "Rendered X/Y".
   *
   * Frames are what tell you a render isn't stuck — a percentage that sits on
   * 41% for a minute is indistinguishable from a hang, while 214 -> 215 is
   * obviously alive. These were already being parsed and thrown away; only the
   * rounded percentage survived, so the UI had to reconstruct a frame count by
   * multiplying the percentage back out, which is wrong by up to 1% of the
   * duration and only lands on the true total at 100%.
   */
  renderedFrames?: number;
  totalFrames?: number;
  /**
   * Which phase the renderer is in.
   *
   * Stitching is not a formality. On a long 4K export it runs for as long as
   * the frame render did, and it reports its own, separate frame count — so a
   * job that only tracks "Rendered X/Y" goes silent for hours at exactly the
   * moment the bar reads 100%, which is indistinguishable from a hang.
   *
   * "converting" covers the ffmpeg passes that run after the renderer exits
   * (a LUT bake, the qtrle and hevc-alpha transcodes). Those report no frames,
   * so that phase moves no numbers — it only stops the dialog asserting an
   * encode that is already over. Parsing ffmpeg's own `time=` would give it
   * real progress; `lib/scene-detect.ts` already has that helper.
   */
  phase?: "bundling" | "frames" | "encoding" | "converting";
  /**
   * Frames written into the file so far, from the renderer's own "Encoded X/Y".
   *
   * A separate pair from `renderedFrames`, because the count RESTARTS: the same
   * frames go through a second pass. Reusing the first pair would show a number
   * halving itself, which reads as "it threw the render away and started over".
   */
  encodedFrames?: number;
  encodedTotalFrames?: number;
  /** When the encode began, so its own "about N left" is not the render's. */
  encodeStartedAt?: number;
  /**
   * How many frames were already written when the encode began.
   *
   * Not zero. For h264 the renderer writes the file WHILE it renders, and only
   * starts printing "Encoded X/Y" once every frame is rendered — so the first
   * count can arrive at 30,000 of 45,664. Timing the remaining frames against
   * all 30,000 would say "1s left" with twenty minutes to go.
   */
  encodeStartedFrames?: number;
  /** When the render actually started, for an honest "about N left". */
  startedAt?: number;
  finishedAt?: number;
  /** Size of the finished file, so the result can state what it produced. */
  bytes?: number;
  outputPath?: string;
  error?: string;
  /**
   * The tail of the renderer's own output, kept for a failure.
   *
   * A failure has to say what happened, what it cost you, and what to do next.
   * The first two come from the error; the log is what makes the third
   * possible, and pasting it into a bug report beats describing it.
   */
  log?: string;
}

export interface RenderOptions {
  /** h264 only. Lower is better: Draft 28, Standard 23, Master 18. */
  crf?: number;
  /** Inclusive frame range, for exporting in-to-out rather than the whole thing. */
  frameRange?: [number, number];
}

/**
 * Pull progress out of a CHUNK of the renderer's output.
 *
 * Not a line: these arrive from a stream `data` event and routinely carry
 * several lines, so every branch takes the LAST match in the chunk — the most
 * recent state, not the first one still sitting in the buffer.
 *
 * Every phase maps into its own band of `progress` rather than clamping one
 * branch, so the bar only ever moves forward:
 *
 *   bundling 0-10   frames 10-90   encoding 90-99   finished file 100
 *
 * That also closes a backward jump that predates this: "Bundling 100%" set 95,
 * and the first "Rendered 0/600" immediately dropped it to 0.
 */
export function readProgress(job: RenderJob, chunk: string): void {
  /*
   * The encode, checked FIRST because it is the later phase: a stale
   * "Rendered X/Y" further down the same chunk must not drag the job back.
   *
   * Captured from the real CLI with no TTY, which is how this spawns it:
   *
   *   Rendered 24/25, time remaining: 0s
   *   Rendered 25/25
   *   Encoded 17/25
   *   Encoded 25/25
   *
   * so the muxer reports "Encoded X/Y" — past tense, no media type. The padded
   * "Encoded video <bar> X/Y" form is what a TTY gets; both are accepted. An
   * "Encoded audio N/M" pass still matches the pattern; it is the `ours` check
   * below, a total that must equal the frame total, that keeps its counts out.
   *
   * The gap and the digit runs are both bounded. Scene `console.log` output is
   * forwarded verbatim into this stream, so a huge digit-heavy chunk is
   * reachable rather than theoretical, and this runs on the server's event
   * loop — an unbounded `\d+` walking 64KB looking for a delimiter that is not
   * there costs over a second of it. No frame count has ten digits.
   */
  const encoded = [...chunk.matchAll(/(?:Encoded|Encoding|Muxed|Muxing)(?:\s+video)?[^\n]{0,40}?(\d{1,9})\s*\/\s*(\d{1,9})/g)].pop();
  if (encoded) {
    const done = parseInt(encoded[1], 10);
    const total = parseInt(encoded[2], 10);
    /*
     * Two plausibility guards, because this matches prose as readily as
     * progress: a path like ".../2026/04/clip.mov" parses as 2026/4, and a
     * count larger than its own total is never real.
     */
    const sane = Number.isFinite(done) && Number.isFinite(total) && total > 0 && done <= total;
    const ours = job.totalFrames === undefined || total === job.totalFrames;
    if (sane && ours) {
      if (job.phase !== "encoding") {
        job.phase = "encoding";
        job.encodeStartedAt = Date.now();
        job.encodeStartedFrames = done;
      }
      job.encodedFrames = done;
      job.encodedTotalFrames = total;
      job.progress = 90 + Math.round((done / total) * 9);
      return;
    }
  }

  // Once the encode has started, the job never goes back to counting frames.
  // The ordering above only settles one chunk; this settles the sequence.
  if (job.phase === "encoding" || job.phase === "converting") return;

  const rendered = [...chunk.matchAll(/Rendered\s+(\d{1,9})\/(\d{1,9})/g)].pop();
  if (rendered) {
    const done = parseInt(rendered[1], 10);
    const total = parseInt(rendered[2], 10);
    if (Number.isFinite(done) && Number.isFinite(total) && total > 0) {
      job.phase = "frames";
      job.renderedFrames = done;
      job.totalFrames = total;
      /*
       * Stops at 90, not 100. Every frame being rendered is not the end of the
       * job — the encode still has to run, and on a 30-minute 4K export that
       * ran ~20 further minutes. Claiming 100 there is what made a healthy
       * render read as a hang.
       */
      job.progress = 10 + Math.round((done / total) * 80);
      return;
    }
  }
  /*
   * The fallback, for the phase that reports no frames — bundling.
   *
   * It is deliberately NOT allowed to overwrite a frame-derived number, and
   * never to leave its own band: "Bundling 100%" arrives before a single frame
   * exists, and the dialog was showing a full green bar beside "0 / 600
   * frames". A progress bar that claims to be finished while nothing has been
   * written is worse than one that moves slowly.
   */
  if (job.renderedFrames !== undefined) return;
  if (/Bundling/.test(chunk)) job.phase = "bundling";
  // Bounded: `(\d+)%` walks every digit of a long digit run looking for a `%`
  // that is not there, which on a 64KB chunk is ~1.4s of blocking event loop.
  // No percentage has four digits.
  const pct = chunk.match(/(\d{1,3})%/);
  if (pct) {
    const value = parseInt(pct[1], 10);
    if (Number.isFinite(value)) job.progress = Math.min(10, Math.round(value / 10));
  }
}

// Use globalThis to persist state across Next.js dev mode module re-evaluations
const g = globalThis as unknown as {
  __renderQueue?: PQueue;
  __renderJobs?: Map<string, RenderJob>;
  /** The process behind each running job, so a render can actually be stopped. */
  __renderProcs?: Map<string, ChildProcess>;
  __rendersCleanupDone?: boolean;
};

if (!g.__renderQueue) {
  g.__renderQueue = new PQueue({ concurrency: 1 });
}
if (!g.__renderJobs) {
  g.__renderJobs = new Map();
}
if (!g.__renderProcs) {
  g.__renderProcs = new Map();
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
const procs = g.__renderProcs;

function generateJobId(): string {
  return `render-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getJob(jobId: string): RenderJob | undefined {
  return jobs.get(jobId);
}

/**
 * Stop a render.
 *
 * "Stop render" used to close the dialog and leave the render going: there was
 * no cancel path at all, so the button was a lie that also cost you a CPU for
 * the next few minutes. A queued job is marked and skipped; a running one has
 * its renderer killed and its half-written file removed, because a truncated
 * mp4 that looks like an export is worse than no file.
 */
export function cancelRender(jobId: string): boolean {
  const job = jobs.get(jobId);
  if (!job || job.status === "done" || job.status === "error" || job.status === "cancelled") return false;

  job.status = "cancelled";
  job.finishedAt = Date.now();

  const proc = procs.get(jobId);
  if (proc) {
    proc.kill("SIGTERM");
    // Remotion spawns a browser; if the polite signal doesn't land, insist.
    const hard = setTimeout(() => { try { proc.kill("SIGKILL"); } catch {} }, 4000);
    proc.once("close", () => clearTimeout(hard));
    procs.delete(jobId);
  }
  return true;
}

/** Whether this job has been asked to stop. Checked between phases. */
function cancelled(job: RenderJob): boolean {
  return job.status === "cancelled";
}

function createEntryFile(scenePath: string, durationInFrames: number, fps: number, width: number, height: number, svgContents?: { filename: string; content: string }[], motionStyle?: "classic" | "new"): string {
  const entryPath = scenePath.replace(".tsx", ".entry.tsx");
  const relativeScene = `./${path.basename(scenePath).replace(".tsx", "")}`;
  // SVG frames inline as JSON so the renderer doesn't need a side-channel
  const svgFramesJson = JSON.stringify(svgContents ?? []);

  const entryCode = `
import { registerRoot } from "remotion";
import { Composition } from "remotion";
import React from "react";
import { SvgFramesProvider, setMotionStyle } from "../motion";
import SceneInner from "${relativeScene}";

// The project's spring set, before anything renders. A document sets its own in
// EditorComposition; this covers a bare scene.
setMotionStyle(${JSON.stringify(motionStyle ?? "classic")});

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
// Light, Regular and Medium only. 600-900 resolve to Medium so scene code
// stored in older projects renders a real allowed weight rather than a
// synthesised faux-bold — see the note in remotion/theme.ts.
const __gtWeights = [
  { weight: "300", file: "GT-Walsheim-Light.ttf" },
  { weight: "400", file: "GT-Walsheim-Regular.ttf" },
  { weight: "500", file: "GT-Walsheim-Medium.ttf" },
  { weight: "600 900", file: "GT-Walsheim-Medium.ttf" },
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

/**
 * Codecs exported with an alpha channel, and so the ones whose render has to
 * have its opaque backgrounds taken out first. Named because the render and the
 * caller that prepares a document both have to agree on the same list.
 */
export function codecCarriesAlpha(codec: RenderCodec): boolean {
  return codec === "prores" || codec === "prores-xq" || codec === "qtrle" || codec === "hevc-alpha";
}

// Escape an absolute path for use inside an ffmpeg filtergraph value (e.g. lut3d).
// Single-quote so spaces/colons are literal; escape embedded backslashes and quotes.
function escapeForFiltergraph(p: string): string {
  return `'${p.replace(/\\/g, "\\\\").replace(/'/g, "'\\''")}'`;
}

// `lut` is an absolute path to a .cube file (already resolved + traversal-guarded by
// the caller), or undefined for no grade. Applied only to the opaque h264 export.
export function enqueueRender(sceneId: string, code: string, durationInFrames = 250, fps = 25, width = 3840, height = 2160, codec: RenderCodec = "h264", svgContents?: { filename: string; content: string }[], lut?: string, opts: RenderOptions = {}): RenderJob {
  const jobId = generateJobId();
  const job: RenderJob = {
    id: jobId,
    sceneId,
    status: "queued",
    progress: 0,
  };
  jobs.set(jobId, job);

  queue.add(async () => {
    // Cancelled while it was still waiting its turn — never start it.
    if (cancelled(job)) return;
    job.status = "rendering";
    job.startedAt = Date.now();

    const scenePath = path.join(
      process.cwd(),
      "remotion",
      "scenes",
      `_render_${jobId}.tsx`
    );
    let entryPath = "";
    // Declared outside the try so a failure's handler can still read it.
    let stderrLog = "";

    try {
      let fixedCode = fixImportPaths(code);
      if (codecCarriesAlpha(codec)) {
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
        // Bundle against a public folder that leaves `renders` out, so an export
        // doesn't copy every previously exported video into its temp bundle.
        "--public-dir",
        leanPublicDir(),
      ];
      // Quality, for the codec that has a quality knob.
      if (codec === "h264" && typeof opts.crf === "number") {
        renderArgs.push("--crf", String(opts.crf));
      }
      // Export in-to-out rather than the whole composition.
      if (opts.frameRange) {
        const [a, b] = opts.frameRange;
        renderArgs.push("--frames", `${Math.max(0, Math.round(a))}-${Math.max(0, Math.round(b))}`);
      }
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
        // Registered before any output arrives: a Stop pressed one tick after
        // Export has to find something to kill.
        procs.set(jobId, proc);

        proc.stderr.on("data", (data: Buffer) => {
          const line = data.toString();
          stderrLog += line;
          readProgress(job, line);
        });

        proc.stdout.on("data", (data: Buffer) => {
          const line = data.toString();
          readProgress(job, line);
        });

        proc.on("close", (exitCode) => {
          procs.delete(jobId);
          if (cancelled(job)) {
            // A killed renderer exits non-zero. That is not a failure to
            // report — it is the thing the user just asked for.
            resolve();
            return;
          }
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
        // Converting: the renderer has exited and ffmpeg is re-encoding the file.
        // Nothing here reports frames, so the dialog says what is happening instead
        // of freezing on the encode's last count.
        job.phase = "converting";
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
        // Converting: the renderer has exited and ffmpeg is re-encoding the file.
        // Nothing here reports frames, so the dialog says what is happening instead
        // of freezing on the encode's last count.
        job.phase = "converting";
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
        // Converting: the renderer has exited and ffmpeg is re-encoding the file.
        // Nothing here reports frames, so the dialog says what is happening instead
        // of freezing on the encode's last count.
        job.phase = "converting";
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
        // Converting: the renderer has exited and ffmpeg is re-encoding the file.
        // Nothing here reports frames, so the dialog says what is happening instead
        // of freezing on the encode's last count.
        job.phase = "converting";
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

      /*
       * Stopped part-way. The file on disk is a truncated mp4 — it opens, it
       * plays, and it ends in the middle, which is the most misleading thing
       * an export can leave behind. Remove it and report nothing finished.
       */
      if (cancelled(job)) {
        try { fs.unlinkSync(outputPath); } catch { /* may not exist yet */ }
        return;
      }

      job.status = "done";
      job.progress = 100;
      job.outputPath = `/renders/${jobId}.${ext}`;
      job.finishedAt = Date.now();
      // What it actually produced, so the result can say so rather than
      // pointing at a file and leaving you to go and look.
      try { job.bytes = fs.statSync(outputPath).size; } catch { /* size is a nicety */ }
    } catch (err) {
      // A cancel unwinds through here when the kill lands mid-phase. It is not
      // a failure and must not be reported as one.
      if (cancelled(job)) {
        for (const e of ["mp4", "mov"]) {
          try { fs.unlinkSync(path.join(process.cwd(), "public", "renders", `${jobId}.${e}`)); } catch {}
        }
        return;
      }
      job.status = "error";
      job.error = err instanceof Error ? err.message : "Unknown error";
      job.finishedAt = Date.now();
      // The last of the renderer's output — the thing worth pasting into a bug
      // report, and the only way the dialog can say what to do next.
      job.log = stderrLog.trim().split("\n").slice(-12).join("\n");
    } finally {
      try { fs.unlinkSync(scenePath); } catch {}
      try { if (entryPath) fs.unlinkSync(entryPath); } catch {}
      // The CLI leaves its own bundle behind. Clear up the ones old enough to
      // be certain no render is still reading from them.
      try { sweepStaleBundles(); } catch {}
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
          // This still is only ever shown as a project card — a 16:9 tile a few
          // hundred pixels wide. Rendered at full project size a 4K timeline
          // produced a 5.5MB PNG per card, so the workspace pulled megabytes per
          // project just to draw thumbnails. 640px long edge is ~345KB.
          "--scale",
          String(Math.min(1, 640 / Math.max(1, width))),
          "--public-dir",
          leanPublicDir(),
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

export interface SampleFrame {
  frame: number;
  pngBase64: string;
}

/**
 * Render a handful of still frames of a generated scene, FAST — so the AI can
 * SEE its own output and fix it. Uses the programmatic Remotion API to bundle
 * ONCE and render many stills (cold bundle ≈ 15s, then each still ≈ 1–2s),
 * instead of a cold `remotion still` CLI spawn per frame (~10–30s each).
 *
 * Frames are downscaled so the long edge is ~1280px — enough for the model to
 * judge layout, legibility, contrast, and colour without spending image tokens
 * on 4K detail. Runs OUTSIDE the export queue (its own lightweight lane) so a
 * refine pass isn't starved behind a long video export. Returns base64 PNGs.
 */
export async function renderSampleFrames(
  projectId: string,
  code: string,
  durationInFrames: number,
  fps: number,
  width: number,
  height: number,
  frames: number[],
  svgContents?: { filename: string; content: string }[],
): Promise<SampleFrame[]> {
  const { frames: out } = await renderReviewFrames(projectId, code, durationInFrames, fps, width, height, frames, svgContents, { contactSheet: false });
  return out;
}

export interface ReviewRender {
  frames: SampleFrame[];
  /** One PNG tiling a spread of small frames across the whole scene, or null. */
  contactSheet: string | null;
  /** The same scene rendered at each other requested shape, one strip each. */
  shapeStrips: { label: string; png: string }[];
}

/** Frames per strip when a scene is checked at its other shapes. */
const STRIP_FRAMES = 6;

// The contact sheet: the whole scene at a glance, the way an editor scrubs a
// cut. 6×4 tiles with a long edge of 310px keep the sheet under 2000px in every
// orientation (6×310 plus gaps is 1890), which Opus 5.5 needs in a many-image
// request.
const SHEET_COLS = 6;
const SHEET_ROWS = 4;
const SHEET_TILE_LONG_EDGE = 310;
const SHEET_GAP = 6;

/**
 * `renderSampleFrames`, plus an optional contact sheet, from ONE bundle and ONE
 * browser. The bundle is the slow part and the browser the next slowest, so the
 * sheet's 24 tiny stills cost seconds, not another cold start.
 */
export async function renderReviewFrames(
  projectId: string,
  code: string,
  durationInFrames: number,
  fps: number,
  width: number,
  height: number,
  frames: number[],
  svgContents?: { filename: string; content: string }[],
  opts: {
    contactSheet?: boolean;
    /** Other sizes to check the same scene at — its 9:16 and 1:1 cuts. */
    shapes?: { label: string; width: number; height: number }[];
    /** The spring set the scene will play with. */
    motionStyle?: "classic" | "new";
  } = {},
): Promise<ReviewRender> {
  const scenesDir = path.join(process.cwd(), "remotion", "scenes");
  fs.mkdirSync(scenesDir, { recursive: true });

  const tag = `_frames_${projectId.slice(0, 8)}_${Date.now().toString(36)}`;
  const scenePath = path.join(scenesDir, `${tag}.tsx`);
  fs.writeFileSync(scenePath, fixImportPaths(code), "utf-8");
  const entryPath = createEntryFile(scenePath, durationInFrames, fps, width, height, svgContents, opts.motionStyle);

  // Downscale the long edge to ~1280px to cap image-token cost.
  const longEdge = Math.max(width, height);
  const scale = longEdge > 1280 ? 1280 / longEdge : 1;

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vt-frames-"));
  /*
   * Name the bundle ourselves rather than letting Remotion mkdtemp one. Left to
   * itself it scatters `remotion-webpack-bundle-*` folders through $TMPDIR and
   * never clears them; a refine pass runs often enough that they stack up into
   * tens of gigabytes within a day.
   */
  const bundleDir = fs.mkdtempSync(path.join(os.tmpdir(), "vt-frames-bundle-"));
  let browser: Awaited<ReturnType<typeof openBrowser>> | null = null;
  try {
    // Bundle once — the cold bundle dominates; each still after it is cheap.
    const serveUrl = await bundle({
      entryPoint: entryPath,
      outDir: bundleDir,
      publicDir: leanPublicDir(),
    });
    browser = await openBrowser("chrome");
    const puppeteerInstance = browser;
    const composition = await selectComposition({ serveUrl, id: "Scene", puppeteerInstance });

    const still = async (frame: number, s: number, size?: { width: number; height: number }): Promise<string> => {
      const outPath = path.join(tmpDir, `frame_${frame}_${s.toFixed(3)}_${size ? `${size.width}x${size.height}` : "base"}.png`);
      // Another shape is the same bundle with the composition's size swapped:
      // the scene reads it from useVideoConfig(), so nothing is rebuilt.
      const comp = size ? { ...composition, width: size.width, height: size.height } : composition;
      await renderStill({ composition: comp, serveUrl, output: outPath, frame, scale: s, imageFormat: "png", puppeteerInstance });
      const data = fs.readFileSync(outPath);
      try { fs.unlinkSync(outPath); } catch {}
      return data.toString("base64");
    };
    const clamp = (raw: number) => Math.max(0, Math.min(durationInFrames - 1, Math.round(raw)));

    const out: SampleFrame[] = [];
    for (const raw of frames) {
      const frame = clamp(raw);
      out.push({ frame, pngBase64: await still(frame, scale) });
    }

    let contactSheet: string | null = null;
    if (opts.contactSheet) {
      const tileScale = Math.min(1, SHEET_TILE_LONG_EDGE / longEdge);
      const tileW = Math.round(width * tileScale);
      const tileH = Math.round(height * tileScale);
      const count = SHEET_COLS * SHEET_ROWS;
      const tiles: { frame: number; png: Buffer }[] = [];
      for (const frame of contactSheetFrameNumbers(durationInFrames, count)) {
        tiles.push({ frame, png: Buffer.from(await still(frame, tileScale), "base64") });
      }
      contactSheet = await tileContactSheet(tiles, tileW, tileH, fps, SHEET_COLS, SHEET_ROWS);
    }

    const shapeStrips: { label: string; png: string }[] = [];
    for (const shape of opts.shapes ?? []) {
      const tileScale = Math.min(1, SHEET_TILE_LONG_EDGE / Math.max(shape.width, shape.height));
      const tileW = Math.round(shape.width * tileScale);
      const tileH = Math.round(shape.height * tileScale);
      const tiles: { frame: number; png: Buffer }[] = [];
      for (const frame of contactSheetFrameNumbers(durationInFrames, STRIP_FRAMES)) {
        tiles.push({ frame, png: Buffer.from(await still(frame, tileScale, shape), "base64") });
      }
      shapeStrips.push({ label: shape.label, png: await tileContactSheet(tiles, tileW, tileH, fps, STRIP_FRAMES, 1) });
    }
    return { frames: out, contactSheet, shapeStrips };
  } finally {
    if (browser) { try { await browser.close({ silent: true }); } catch {} }
    try { fs.unlinkSync(scenePath); } catch {}
    try { fs.unlinkSync(entryPath); } catch {}
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    try { fs.rmSync(bundleDir, { recursive: true, force: true }); } catch {}
  }
}

/** `count` evenly spaced frames from the first to the last, inclusive. */
export function contactSheetFrameNumbers(durationInFrames: number, count: number): number[] {
  const last = Math.max(0, durationInFrames - 1);
  if (count <= 1) return [0];
  return Array.from({ length: count }, (_, i) => Math.round((i * last) / (count - 1)));
}

/**
 * Lay the tiles out left to right, top to bottom, each stamped with its
 * timestamp so the model can say "the title clips at 0:04" rather than "tile 9".
 */
async function tileContactSheet(
  tiles: { frame: number; png: Buffer }[],
  tileW: number,
  tileH: number,
  fps: number,
  cols: number,
  rows: number,
): Promise<string> {
  const sheetW = cols * tileW + (cols + 1) * SHEET_GAP;
  const sheetH = rows * tileH + (rows + 1) * SHEET_GAP;
  const parts: sharp.OverlayOptions[] = [];
  tiles.forEach((t, i) => {
    const left = SHEET_GAP + (i % cols) * (tileW + SHEET_GAP);
    const top = SHEET_GAP + Math.floor(i / cols) * (tileH + SHEET_GAP);
    parts.push({ input: t.png, left, top });
    const secs = t.frame / fps;
    const label = `${Math.floor(secs / 60)}:${(secs % 60).toFixed(1).padStart(4, "0")} · f${t.frame}`;
    const labelW = 8 + label.length * 7;
    parts.push({
      input: Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${labelW}" height="18">` +
          `<rect width="100%" height="100%" rx="3" fill="#000" fill-opacity="0.72"/>` +
          `<text x="4" y="13" font-family="Helvetica, Arial, sans-serif" font-size="11" fill="#fff">${label}</text>` +
          `</svg>`,
      ),
      left: left + 4,
      top: top + 4,
    });
  });
  const png = await sharp({
    create: { width: sheetW, height: sheetH, channels: 3, background: "#3a3a3a" },
  })
    .composite(parts)
    .png()
    .toBuffer();
  return png.toString("base64");
}

/**
 * Evenly-spaced sample frames across a scene's duration, skipping the dead
 * opening/closing beats: [0.08, 0.28, 0.5, 0.72, 0.92] × durationInFrames.
 */
export function sampleFrameNumbers(durationInFrames: number): number[] {
  const fracs = [0.08, 0.28, 0.5, 0.72, 0.92];
  return fracs.map((f) => Math.max(0, Math.min(durationInFrames - 1, Math.round(f * durationInFrames))));
}
