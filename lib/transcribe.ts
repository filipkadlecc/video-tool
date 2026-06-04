import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";

export interface TranscriptWord {
  text: string;
  start: number; // seconds
  end: number;   // seconds
  probability?: number;
}

export interface Transcript {
  text: string;
  language: string;
  words: TranscriptWord[];
  durationSeconds: number;
  model: string;
  generatedAt: string;
}

export interface TranscribeOptions {
  model?: string;            // default "small.en"
  outputDir?: string;        // defaults to dirname(mediaPath)
  language?: string;         // "en", auto-detected if undefined
  onProgress?: (line: string) => void;
}

interface RawWhisperWord {
  word: string;
  start: number;
  end: number;
  probability?: number;
}

interface RawWhisperSegment {
  start: number;
  end: number;
  text: string;
  words?: RawWhisperWord[];
}

interface RawWhisperOutput {
  text?: string;
  language?: string;
  segments?: RawWhisperSegment[];
}

function transcriptCachePath(mediaPath: string, outputDir?: string): string {
  const dir = outputDir ?? path.dirname(mediaPath);
  const base = path.basename(mediaPath, path.extname(mediaPath));
  return path.join(dir, `${base}.transcript.json`);
}

function flatten(raw: RawWhisperOutput, model: string): Transcript {
  const words: TranscriptWord[] = [];
  for (const seg of raw.segments ?? []) {
    for (const w of seg.words ?? []) {
      const text = w.word?.trim();
      if (!text) continue;
      // Whisper occasionally emits words with null/undefined/NaN timestamps
      // (unaligned tokens). Skip them — downstream cut-planning expects numeric
      // start/end and crashes if either is null.
      if (typeof w.start !== "number" || !Number.isFinite(w.start)) continue;
      if (typeof w.end !== "number" || !Number.isFinite(w.end)) continue;
      if (w.end < w.start) continue;
      words.push({
        text,
        start: w.start,
        end: w.end,
        probability: w.probability,
      });
    }
  }
  const lastSegEnd = raw.segments?.at(-1)?.end;
  const durationSeconds =
    words.length > 0
      ? words[words.length - 1].end
      : typeof lastSegEnd === "number" && Number.isFinite(lastSegEnd)
        ? lastSegEnd
        : 0;
  return {
    text: (raw.text ?? "").trim(),
    language: raw.language ?? "en",
    words,
    durationSeconds,
    model,
    generatedAt: new Date().toISOString(),
  };
}

export async function readCachedTranscript(
  mediaPath: string,
  outputDir?: string
): Promise<Transcript | null> {
  try {
    const raw = await fs.readFile(transcriptCachePath(mediaPath, outputDir), "utf-8");
    return JSON.parse(raw) as Transcript;
  } catch {
    return null;
  }
}

export async function transcribe(
  mediaPath: string,
  opts: TranscribeOptions = {}
): Promise<Transcript> {
  const model = opts.model ?? "small.en";
  const outputDir = opts.outputDir ?? path.dirname(mediaPath);

  // Whisper writes <basename>.json next to its --output_dir
  const base = path.basename(mediaPath, path.extname(mediaPath));
  const whisperJsonPath = path.join(outputDir, `${base}.json`);

  const args = [
    mediaPath,
    "--model", model,
    "--output_format", "json",
    "--word_timestamps", "True",
    "--output_dir", outputDir,
    "--verbose", "False",
    "--fp16", "False",
  ];
  if (opts.language) args.push("--language", opts.language);

  await new Promise<void>((resolve, reject) => {
    const proc = spawn("whisper", args);
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      const s = chunk.toString();
      if (opts.onProgress) opts.onProgress(s);
    });
    proc.stderr.on("data", (chunk) => {
      const s = chunk.toString();
      stderr += s;
      if (opts.onProgress) opts.onProgress(s);
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`whisper exited ${code}: ${stderr.slice(-1500)}`));
      } else {
        resolve();
      }
    });
  });

  const raw = JSON.parse(await fs.readFile(whisperJsonPath, "utf-8")) as RawWhisperOutput;
  const transcript = flatten(raw, model);

  // Cache + clean up the raw whisper json, keeping only the flattened transcript.
  const cachePath = transcriptCachePath(mediaPath, outputDir);
  await fs.writeFile(cachePath, JSON.stringify(transcript, null, 2), "utf-8");
  // Remove the auxiliary whisper file (and its sibling output formats if generated).
  await fs.unlink(whisperJsonPath).catch(() => {});

  return transcript;
}

export async function transcribeWithCache(
  mediaPath: string,
  opts: TranscribeOptions = {}
): Promise<Transcript> {
  const cached = await readCachedTranscript(mediaPath, opts.outputDir);
  if (cached) return cached;
  return transcribe(mediaPath, opts);
}
