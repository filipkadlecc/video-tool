/**
 * Render a voice-over from a script file.
 *
 *   npx tsx scripts/vo.ts scripts/vo/baguette.vo          # local Kokoro (default)
 *   npx tsx scripts/vo.ts scripts/vo/baguette.vo --backend openrouter
 *   npx tsx scripts/vo.ts --list-voices
 *
 * Two backends, same voice names, so a script can move between them without
 * being edited:
 *
 *   kokoro      Kokoro-82M on the local GPU via MLX. Free, offline, ~25x
 *               realtime once warm. The default, and what scratch VO should
 *               use — regenerating forty lines costs nothing but ten seconds.
 *   openrouter  The same model (or any other) over OpenRouter's speech API,
 *               for when a line needs a voice the local model doesn't have.
 *               Billed per character; `hexgrad/kokoro-82m` is $4/1M.
 *
 * Every line is cached by a hash of its text, voice, speed, model and backend,
 * so a re-run after editing one line regenerates only that line. That is the
 * point of the tool: the loop is edit-a-word, re-run, re-cut, and nothing else
 * should have to be re-synthesised for it.
 *
 * The output folder is self-contained and lives under public/, so a Remotion
 * composition can reach it with staticFile():
 *
 *   public/assets/vo/<name>/vo.wav        everything concatenated
 *   public/assets/vo/<name>/lines/001.wav one file per line, for per-line sync
 *   public/assets/vo/<name>/vo.json       manifest — see MANIFEST below
 *
 * The manifest carries frame offsets alongside seconds, tiled so that every
 * line's startFrame + durationInFrames equals the next line's startFrame. Drop
 * it into a Sequence list and there are no one-frame gaps to chase.
 *
 * ── Script format ────────────────────────────────────────────────────────────
 *
 *   ---                       optional frontmatter: defaults for the whole file
 *   voice: af_heart
 *   speed: 1.0
 *   ---
 *
 *   # a comment, ignored
 *   ## Cold open             a section label, attached to the lines below it
 *
 *   One line of speech becomes one audio file.
 *   [pause 0.6]              silence, in seconds
 *   [voice=am_michael] A line in a different voice.
 *   [speed=0.95] A line read slower.
 *
 * Blank lines are ignored — use [pause] when a gap should exist in the audio.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const ROOT = path.resolve(__dirname, "..");
const CACHE_DIR = path.join(ROOT, ".vo-cache");
const VENV_PYTHON = path.join(ROOT, ".venv-vo", "bin", "python");
const WORKER = path.join(ROOT, "scripts", "vo-kokoro.py");
const SAMPLE_RATE = 24000;

const DEFAULTS = {
  voice: "af_heart",
  speed: 1,
  fps: 25,
  kokoroModel: "mlx-community/Kokoro-82M-bf16",
  openrouterModel: "hexgrad/kokoro-82m",
};

/** Kokoro ships these; the prefix is language + gender (a=American, b=British, ...). */
const VOICES: Record<string, string[]> = {
  "American female": ["af_alloy", "af_aoede", "af_bella", "af_heart", "af_jessica", "af_kore", "af_nicole", "af_nova", "af_river", "af_sarah", "af_sky"],
  "American male": ["am_adam", "am_echo", "am_eric", "am_fenrir", "am_liam", "am_michael", "am_onyx", "am_puck", "am_santa"],
  "British female": ["bf_alice", "bf_emma", "bf_isabella", "bf_lily"],
  "British male": ["bm_daniel", "bm_fable", "bm_george", "bm_lewis"],
  "Spanish": ["ef_dora", "em_alex", "em_santa"],
  "French": ["ff_siwis"],
  "Hindi": ["hf_alpha", "hf_beta", "hm_omega", "hm_psi"],
  "Italian": ["if_sara", "im_nicola"],
  "Japanese": ["jf_alpha", "jf_gongitsune", "jf_nezumi", "jf_tebukuro", "jm_kumo"],
  "Portuguese": ["pf_dora", "pm_alex", "pm_santa"],
  "Chinese": ["zf_xiaobei", "zf_xiaoni", "zf_xiaoxiao", "zf_xiaoyi", "zm_yunjian", "zm_yunxi", "zm_yunxia", "zm_yunyang"],
};
const KNOWN_VOICES = new Set(Object.values(VOICES).flat());

type SpeechLine = {
  kind: "speech";
  index: number;
  section?: string;
  text: string;
  voice: string;
  speed: number;
};
type PauseLine = { kind: "pause"; index: number; section?: string; seconds: number };
type Line = SpeechLine | PauseLine;

type Rendered = Line & { file: string; durationSec: number; cached: boolean };

// ── Script parsing ───────────────────────────────────────────────────────────

/** `[voice=am_michael speed=0.95] text` and `[pause 0.6]`. */
const DIRECTIVE_RE = /^\[([^\]]+)\]\s*/;
const PAUSE_RE = /^pause\s+([\d.]+)$/i;

function parseScript(source: string, cliVoice?: string, cliSpeed?: number) {
  const lines = source.split(/\r?\n/);
  let cursor = 0;

  // Frontmatter, if the file opens with a --- fence.
  const fileDefaults: { voice?: string; speed?: number } = {};
  if (lines[0]?.trim() === "---") {
    const close = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
    if (close === -1) throw new Error("frontmatter opened with --- but never closed");
    for (const raw of lines.slice(1, close)) {
      const m = raw.match(/^\s*([A-Za-z_]+)\s*:\s*(.+?)\s*$/);
      if (!m) continue;
      const [, key, value] = m;
      if (key === "voice") fileDefaults.voice = value;
      else if (key === "speed") fileDefaults.speed = Number(value);
      else throw new Error(`unknown frontmatter key "${key}" (expected voice or speed)`);
    }
    cursor = close + 1;
  }

  // The CLI wins over frontmatter, which wins over the built-in default.
  const baseVoice = cliVoice ?? fileDefaults.voice ?? DEFAULTS.voice;
  const baseSpeed = cliSpeed ?? fileDefaults.speed ?? DEFAULTS.speed;

  const out: Line[] = [];
  let section: string | undefined;

  for (let n = cursor; n < lines.length; n++) {
    const lineNo = n + 1;
    let text = lines[n].trim();
    if (!text) continue;
    if (text.startsWith("##")) {
      section = text.replace(/^#+\s*/, "").trim() || undefined;
      continue;
    }
    if (text.startsWith("#")) continue;

    let voice = baseVoice;
    let speed = baseSpeed;

    const directive = text.match(DIRECTIVE_RE);
    if (directive) {
      const body = directive[1].trim();
      text = text.slice(directive[0].length).trim();

      const pause = body.match(PAUSE_RE);
      if (pause) {
        const seconds = Number(pause[1]);
        if (!(seconds > 0)) throw new Error(`line ${lineNo}: pause must be a positive number`);
        if (text) throw new Error(`line ${lineNo}: [pause] must be alone on its line`);
        out.push({ kind: "pause", index: out.length, section, seconds });
        continue;
      }

      for (const pair of body.split(/\s+/)) {
        const [key, value] = pair.split("=");
        if (key === "voice") voice = value;
        else if (key === "speed") speed = Number(value);
        else throw new Error(`line ${lineNo}: unknown directive "${pair}" (expected voice=, speed= or pause)`);
      }
      if (!text) throw new Error(`line ${lineNo}: directive with no text after it`);
      if (!(speed > 0)) throw new Error(`line ${lineNo}: speed must be a positive number`);
    }

    out.push({ kind: "speech", index: out.length, section, text, voice, speed });
  }

  return out;
}

// ── Cache ────────────────────────────────────────────────────────────────────

/**
 * Cache entries are keyed on everything that changes the audio, so editing one
 * word invalidates exactly one line. The cache is shared across scripts — the
 * same sentence moved into a different file is still a hit.
 */
function cacheKey(line: SpeechLine, backend: string, model: string) {
  const material = [backend, model, line.voice, line.speed, line.text].join("\u0000");
  return createHash("sha256").update(material).digest("hex").slice(0, 16);
}

function readSidecar(key: string): { durationSec: number } | undefined {
  const meta = path.join(CACHE_DIR, `${key}.json`);
  const wav = path.join(CACHE_DIR, `${key}.wav`);
  if (!fs.existsSync(meta) || !fs.existsSync(wav)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(meta, "utf8"));
  } catch {
    return undefined; // a half-written sidecar just means a cache miss
  }
}

function writeSidecar(key: string, line: SpeechLine, backend: string, model: string, durationSec: number) {
  const payload = { text: line.text, voice: line.voice, speed: line.speed, backend, model, durationSec, createdAt: new Date().toISOString() };
  fs.writeFileSync(path.join(CACHE_DIR, `${key}.json`), JSON.stringify(payload, null, 2));
}

// ── Audio helpers ────────────────────────────────────────────────────────────

/** A 24kHz mono PCM-16 WAV of zeros — same format the worker writes, so concat is a straight join. */
function writeSilence(file: string, seconds: number) {
  const samples = Math.round(seconds * SAMPLE_RATE);
  const dataBytes = samples * 2;
  const buf = Buffer.alloc(44 + dataBytes); // Buffer.alloc zero-fills: the zeros are the silence
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write("data", 36);
  buf.writeUInt32LE(dataBytes, 40);
  fs.writeFileSync(file, buf);
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}\n${stderr.trim().split("\n").slice(-5).join("\n")}`)),
    );
  });
}

async function concat(files: string[], out: string) {
  const list = path.join(CACHE_DIR, `concat-${process.pid}.txt`);
  fs.writeFileSync(list, files.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n"));
  try {
    await run("ffmpeg", ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", out]);
  } finally {
    fs.rmSync(list, { force: true });
  }
}

// ── Backends ─────────────────────────────────────────────────────────────────

type Job = { key: string; line: SpeechLine };

/**
 * Feed every miss through one long-lived Python process. Model load plus the
 * first Metal compile is ~5s and each line after that ~0.2s, so the worker is
 * started only when there is at least one miss to justify it.
 */
async function synthKokoro(jobs: Job[], model: string, onDone: (key: string, durationSec: number) => void) {
  if (!fs.existsSync(VENV_PYTHON)) {
    throw new Error(
      `local TTS environment missing at .venv-vo\n\nSet it up with:\n  uv venv --python 3.12 .venv-vo\n  VIRTUAL_ENV=$PWD/.venv-vo uv pip install mlx-audio misaki soundfile num2words spacy phonemizer-fork espeakng-loader\n  VIRTUAL_ENV=$PWD/.venv-vo uv pip install "en_core_web_sm @ https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl"\n  brew install espeak-ng`,
    );
  }

  const child = spawn(VENV_PYTHON, [WORKER], { cwd: ROOT, stdio: ["pipe", "pipe", "inherit"] });
  const byId = new Map(jobs.map((j, i) => [i, j]));
  let settled = 0;

  await new Promise<void>((resolve, reject) => {
    const rl = readline.createInterface({ input: child.stdout });
    let failure: Error | undefined;

    child.on("error", reject);
    child.on("close", (code) => {
      if (failure) reject(failure);
      else if (settled < jobs.length) reject(new Error(`kokoro worker exited early (code ${code}) after ${settled}/${jobs.length} lines`));
      else resolve();
    });

    rl.on("line", (raw) => {
      let msg: any;
      try {
        msg = JSON.parse(raw);
      } catch {
        return; // stray output is not protocol; the worker sends chatter to stderr
      }

      if (msg.ready) {
        for (const [id, { key, line }] of byId) {
          child.stdin.write(
            JSON.stringify({ id, text: line.text, voice: line.voice, speed: line.speed, out: path.join(CACHE_DIR, `${key}.wav`) }) + "\n",
          );
        }
        child.stdin.end();
        return;
      }

      const job = byId.get(msg.id);
      if (!job) return;
      settled++;
      if (!msg.ok) {
        failure = new Error(`line ${job.line.index + 1} failed: ${msg.error}`);
        child.kill();
        return;
      }
      onDone(job.key, msg.durationSec);
      process.stderr.write(`\r  synthesised ${settled}/${jobs.length}`);
      if (settled === jobs.length) process.stderr.write("\n");
    });
  });
}

function loadEnvLocal(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  const file = path.join(ROOT, ".env.local");
  if (!fs.existsSync(file)) return undefined;
  const hit = fs
    .readFileSync(file, "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${name}=`));
  return hit?.slice(name.length + 1).trim().replace(/^["']|["']$/g, "");
}

/** OpenRouter's speech endpoint is OpenAI-shaped: text in, audio bytes out. */
async function synthOpenRouter(jobs: Job[], model: string, onDone: (key: string, durationSec: number) => void) {
  const apiKey = loadEnvLocal("OPENROUTER_API_KEY");
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set (put it in .env.local or the environment)");

  let settled = 0;
  const CONCURRENCY = 4;
  const queue = [...jobs];

  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const res = await fetch("https://openrouter.ai/api/v1/audio/speech", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, input: job.line.text, voice: job.line.voice, speed: job.line.speed, response_format: "mp3" }),
      });
      if (!res.ok) throw new Error(`OpenRouter ${res.status} on line ${job.line.index + 1}: ${(await res.text()).slice(0, 300)}`);

      // Normalise to the same 24kHz mono PCM-16 the local backend produces, so
      // both backends' files can sit in one concat list and one manifest.
      const mp3 = path.join(CACHE_DIR, `${job.key}.mp3`);
      fs.writeFileSync(mp3, Buffer.from(await res.arrayBuffer()));
      const wav = path.join(CACHE_DIR, `${job.key}.wav`);
      await run("ffmpeg", ["-y", "-v", "error", "-i", mp3, "-ac", "1", "-ar", String(SAMPLE_RATE), "-c:a", "pcm_s16le", wav]);
      fs.rmSync(mp3, { force: true });

      onDone(job.key, wavDuration(wav));
      settled++;
      process.stderr.write(`\r  synthesised ${settled}/${jobs.length}`);
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));
  process.stderr.write("\n");
}

/** Read the data chunk length straight out of the header — every file here is PCM-16 mono 24k. */
function wavDuration(file: string) {
  const fd = fs.openSync(file, "r");
  try {
    const head = Buffer.alloc(4096);
    const read = fs.readSync(fd, head, 0, head.length, 0);
    for (let i = 12; i < read - 8; i += 2) {
      if (head.toString("ascii", i, i + 4) === "data") {
        return head.readUInt32LE(i + 4) / (SAMPLE_RATE * 2);
      }
    }
    throw new Error(`no data chunk in ${file}`);
  } finally {
    fs.closeSync(fd);
  }
}

// ── Manifest ─────────────────────────────────────────────────────────────────

/**
 * Seconds are the truth; frames are derived by rounding each line's *start* and
 * taking the duration as the gap to the next start. Rounding durations
 * independently would let rounding error accumulate, and the lines would drift
 * out of the concatenated file they are supposed to describe.
 */
function withFrames(rendered: Rendered[], fps: number) {
  const starts: number[] = [];
  let clock = 0;
  for (const line of rendered) {
    starts.push(clock);
    clock += line.durationSec;
  }
  const totalFrames = Math.round(clock * fps);
  const startFrames = starts.map((s) => Math.round(s * fps));

  return {
    totalSec: clock,
    totalFrames,
    lines: rendered.map((line, i) => {
      const startFrame = startFrames[i];
      const endFrame = i + 1 < startFrames.length ? startFrames[i + 1] : totalFrames;
      return {
        index: line.index,
        kind: line.kind,
        ...(line.section ? { section: line.section } : {}),
        ...(line.kind === "speech" ? { text: line.text, voice: line.voice, speed: line.speed } : {}),
        file: line.file,
        startSec: Number(starts[i].toFixed(4)),
        durationSec: Number(line.durationSec.toFixed(4)),
        endSec: Number((starts[i] + line.durationSec).toFixed(4)),
        startFrame,
        durationInFrames: endFrame - startFrame,
        endFrame,
        cached: line.cached,
      };
    }),
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]) {
  const opts: Record<string, string | boolean> = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      opts[key] = next;
      i++;
    } else {
      opts[key] = true;
    }
  }
  return { opts, positional };
}

const USAGE = `Render a voice-over from a script file.

  npx tsx scripts/vo.ts <script> [options]

Options
  --backend <kokoro|openrouter>  where to synthesise        (default kokoro)
  --model <id>                   override the backend model
  --voice <name>                 default voice for the file (default ${DEFAULTS.voice})
  --speed <n>                    default speed              (default ${DEFAULTS.speed})
  --fps <n>                      frame rate for the manifest (default ${DEFAULTS.fps})
  --name <slug>                  output folder name         (default: script basename)
  --out <dir>                    output dir (default public/assets/vo/<name>)
  --force                        ignore the cache and re-synthesise everything
  --play                         play the result when it is done
  --list-voices                  print the Kokoro voice list and exit
  --help`;

async function main() {
  const { opts, positional } = parseArgs(process.argv.slice(2));

  if (opts.help) {
    console.log(USAGE);
    return;
  }
  if (opts["list-voices"]) {
    for (const [group, voices] of Object.entries(VOICES)) console.log(`${group.padEnd(16)} ${voices.join(" ")}`);
    return;
  }

  const scriptPath = positional[0];
  if (!scriptPath) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }
  if (!fs.existsSync(scriptPath)) throw new Error(`no such script: ${scriptPath}`);

  const backend = String(opts.backend ?? "kokoro");
  if (backend !== "kokoro" && backend !== "openrouter") throw new Error(`unknown backend "${backend}" (expected kokoro or openrouter)`);

  const model = String(opts.model ?? (backend === "kokoro" ? DEFAULTS.kokoroModel : DEFAULTS.openrouterModel));
  const fps = Number(opts.fps ?? DEFAULTS.fps);
  const name = String(opts.name ?? path.basename(scriptPath).replace(/\.[^.]+$/, ""));
  const outDir = path.resolve(String(opts.out ?? path.join(ROOT, "public", "assets", "vo", name)));

  const lines = parseScript(
    fs.readFileSync(scriptPath, "utf8"),
    opts.voice ? String(opts.voice) : undefined,
    opts.speed ? Number(opts.speed) : undefined,
  );
  if (!lines.length) throw new Error("script has no lines");

  // Catch voice typos before spending time on synthesis. Only the local backend
  // has a known roster; OpenRouter models each define their own.
  if (backend === "kokoro") {
    for (const line of lines) {
      if (line.kind === "speech" && !KNOWN_VOICES.has(line.voice)) {
        throw new Error(`unknown voice "${line.voice}" on line ${line.index + 1} — run with --list-voices`);
      }
    }
  }

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.rmSync(path.join(outDir, "lines"), { recursive: true, force: true });
  fs.mkdirSync(path.join(outDir, "lines"), { recursive: true });

  const speech = lines.filter((l): l is SpeechLine => l.kind === "speech");
  const keys = new Map(speech.map((l) => [l.index, cacheKey(l, backend, model)]));
  const durations = new Map<string, number>();

  const misses: Job[] = [];
  for (const line of speech) {
    const key = keys.get(line.index)!;
    const hit = opts.force ? undefined : readSidecar(key);
    if (hit) durations.set(key, hit.durationSec);
    else if (!misses.some((m) => m.key === key)) misses.push({ key, line }); // identical lines synthesise once
  }

  const reused = speech.length - misses.length;
  console.log(`${name}: ${lines.length} lines (${speech.length} spoken, ${lines.length - speech.length} pauses)`);
  console.log(`  backend ${backend} · ${model}`);
  console.log(`  ${reused} cached, ${misses.length} to synthesise`);

  if (misses.length) {
    const record = (key: string, durationSec: number) => {
      durations.set(key, durationSec);
      const line = misses.find((m) => m.key === key)!.line;
      writeSidecar(key, line, backend, model, durationSec);
    };
    const started = Date.now();
    if (backend === "kokoro") await synthKokoro(misses, model, record);
    else await synthOpenRouter(misses, model, record);
    console.log(`  synthesis took ${((Date.now() - started) / 1000).toFixed(1)}s`);
  }

  // Copy each line out of the cache into the output folder, so the folder can be
  // moved or shipped without dragging the cache along.
  const rendered: Rendered[] = lines.map((line) => {
    const slot = String(line.index + 1).padStart(3, "0");
    const dest = path.join(outDir, "lines", `${slot}.wav`);
    if (line.kind === "pause") {
      writeSilence(dest, line.seconds);
      return { ...line, file: dest, durationSec: line.seconds, cached: false };
    }
    const key = keys.get(line.index)!;
    fs.copyFileSync(path.join(CACHE_DIR, `${key}.wav`), dest);
    return { ...line, file: dest, durationSec: durations.get(key)!, cached: !misses.some((m) => m.key === key) };
  });

  const full = path.join(outDir, "vo.wav");
  await concat(rendered.map((r) => r.file), full);

  const timed = withFrames(rendered, fps);

  // Paths in the manifest are relative to public/, which is exactly what
  // staticFile() wants: staticFile(manifest.audio).
  const publicDir = path.join(ROOT, "public");
  const asStatic = (p: string) => path.relative(publicDir, p).split(path.sep).join("/");
  const underPublic = !path.relative(publicDir, outDir).startsWith("..");

  const manifest = {
    name,
    source: path.relative(ROOT, path.resolve(scriptPath)),
    backend,
    model,
    fps,
    sampleRate: SAMPLE_RATE,
    generatedAt: new Date().toISOString(),
    durationSec: Number(timed.totalSec.toFixed(4)),
    durationInFrames: timed.totalFrames,
    audio: underPublic ? asStatic(full) : full,
    lines: timed.lines.map((l) => ({ ...l, file: underPublic ? asStatic(l.file) : l.file })),
  };
  fs.writeFileSync(path.join(outDir, "vo.json"), JSON.stringify(manifest, null, 2));

  const mins = Math.floor(timed.totalSec / 60);
  const secs = (timed.totalSec % 60).toFixed(1);
  console.log(`\n  ${mins}m${secs.padStart(4, "0")}s · ${timed.totalFrames} frames @ ${fps}fps`);
  console.log(`  ${path.relative(ROOT, full)}`);
  console.log(`  ${path.relative(ROOT, path.join(outDir, "vo.json"))}`);
  if (underPublic) console.log(`\n  In Remotion:  <Audio src={staticFile(${JSON.stringify(manifest.audio)})} />`);

  if (opts.play) await run("afplay", [full]);
}

main().catch((err) => {
  console.error(`\nvo: ${err.message}`);
  process.exitCode = 1;
});
