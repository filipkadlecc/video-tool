import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { getProject } from "@/lib/projects";
import { normalizeTapeQuotes } from "@/lib/tape-parser";

const PROJECTS_DIR = path.join(process.cwd(), "data", "projects");

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const project = getProject(projectId);
  if (!project) return new Response("Project not found", { status: 404 });
  if (project.animationType !== "terminal") {
    return new Response("Not a terminal project", { status: 400 });
  }

  const { tape } = (await request.json()) as { tape: string };
  if (typeof tape !== "string") {
    return new Response("Missing tape source", { status: 400 });
  }

  const projectDir = path.join(PROJECTS_DIR, projectId);
  if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir, { recursive: true });

  // Force the output path: strip whatever Output lines the user wrote and
  // prepend a single `Output out.mp4`. We spawn vhs with cwd=projectDir so a
  // relative path lands the .mp4 next to project.json. We also normalize
  // backslash-escaped quotes in Type lines — VHS doesn't accept them — so
  // legacy or hand-edited scripts auto-fix instead of erroring.
  const normalized = normalizeTapeQuotes(tape);
  const stripped = normalized.replace(/^[ \t]*Output[ \t]+\S+.*$/gim, "").trimStart();
  const wrappedTape = `Output out.mp4\n${stripped}`;
  const tapePath = path.join(projectDir, "tape.tape");
  const outPath = path.join(projectDir, "out.mp4");
  fs.writeFileSync(tapePath, wrappedTape, "utf-8");

  return await new Promise<Response>((resolve) => {
    const proc = spawn("vhs", [tapePath], { cwd: projectDir });
    let stderr = "";
    let stdout = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proc.on("error", (err) => {
      resolve(
        NextResponse.json(
          {
            ok: false,
            error: `Failed to spawn vhs: ${err.message}. Is vhs installed? (brew install vhs ttyd ffmpeg)`,
          },
          { status: 500 }
        )
      );
    });

    proc.on("close", async (code) => {
      if (code !== 0 || !fs.existsSync(outPath)) {
        resolve(
          NextResponse.json(
            { ok: false, error: stderr || stdout || `vhs exited with code ${code}` },
            { status: 500 }
          )
        );
        return;
      }
      const stat = fs.statSync(outPath);
      const probe = await probeVideo(outPath).catch(() => null);
      resolve(
        NextResponse.json({
          ok: true,
          outPath: `/api/vhs/${projectId}/output?ts=${stat.mtimeMs}`,
          bytes: stat.size,
          stderr,
          probe,
        })
      );
    });
  });
}

interface ProbeResult {
  width: number;
  height: number;
  durationSeconds: number;
  frameRate: number;
}

function probeVideo(file: string): Promise<ProbeResult> {
  return new Promise((resolve, reject) => {
    const args = [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height,r_frame_rate,duration,nb_frames:format=duration",
      "-of",
      "json",
      file,
    ];
    const proc = spawn("ffprobe", args);
    let out = "";
    let err = "";
    proc.stdout.on("data", (d) => { out += d.toString(); });
    proc.stderr.on("data", (d) => { err += d.toString(); });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0) return reject(new Error(err || `ffprobe exited ${code}`));
      try {
        const parsed = JSON.parse(out) as {
          streams?: Array<{ width?: number; height?: number; r_frame_rate?: string; duration?: string; nb_frames?: string }>;
          format?: { duration?: string };
        };
        const s = parsed.streams?.[0] ?? {};
        const [num, den] = (s.r_frame_rate ?? "30/1").split("/").map(Number);
        const frameRate = den ? num / den : 30;
        const durationSeconds = Number(s.duration ?? parsed.format?.duration ?? 0);
        resolve({
          width: Number(s.width ?? 0),
          height: Number(s.height ?? 0),
          durationSeconds,
          frameRate,
        });
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const project = getProject(projectId);
  if (!project) return new Response("Project not found", { status: 404 });

  const outPath = path.join(PROJECTS_DIR, projectId, "out.mp4");
  if (!fs.existsSync(outPath)) {
    return NextResponse.json({ exists: false });
  }
  const stat = fs.statSync(outPath);
  const probe = await probeVideo(outPath).catch(() => null);
  return NextResponse.json({
    exists: true,
    bytes: stat.size,
    mtimeMs: stat.mtimeMs,
    probe,
  });
}
