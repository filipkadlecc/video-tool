import { runPreflight } from "@/lib/render-queue";
import { getProject } from "@/lib/projects";
import { sceneCodeFromDoc } from "@/lib/editor-render";
import { docDuration, type EditorDoc } from "@/lib/editor-doc";
import { describeFinding } from "@/lib/scene-checks";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * The export dialog's checks: measure the composition about to be exported and
 * say what is wrong with it, before a long render bakes it into a file.
 *
 * Prepared exactly as /api/render prepares an export — the document the
 * dialog sends (it can be ahead of the saved one), media URLs made absolute
 * for the bundle's own server — so the checks look at what will be rendered.
 * A closed dialog aborts the request, and the abort stops the check.
 */
export async function POST(request: Request) {
  const body = await request.json();
  const { projectId } = body as { projectId?: string };
  const doc: EditorDoc | undefined = body.doc ?? (projectId ? getProject(projectId)?.doc : undefined);
  let code: string | undefined = body.code;
  let { durationInFrames, fps, width, height } = body as { durationInFrames?: number; fps?: number; width?: number; height?: number };
  if (doc) {
    code = sceneCodeFromDoc(doc);
    durationInFrames = docDuration(doc);
    fps = doc.size.fps;
    width = doc.size.width;
    height = doc.size.height;
  }
  if (!code || !durationInFrames || !fps || !width || !height) {
    return Response.json({ error: "code or doc, with its size, is required" }, { status: 400 });
  }
  const origin = new URL(request.url).origin;
  code = code.replace(/(["'`])\/api\/media\//g, `$1${origin}/api/media/`);

  try {
    const report = await runPreflight(
      projectId ?? "export",
      code,
      durationInFrames,
      fps,
      width,
      height,
      projectId ? getProject(projectId)?.svgContents : undefined,
      { motionStyle: doc?.motionStyle, signal: request.signal },
    );
    return Response.json({
      ...report,
      fps,
      lines: report.findings.map((f) => ({ kind: f.kind, frame: f.frame, text: describeFinding(f, fps!) })),
    });
  } catch (e) {
    if (request.signal.aborted) return new Response(null, { status: 499 });
    return Response.json({ error: e instanceof Error ? e.message.slice(0, 400) : "The checks failed" }, { status: 500 });
  }
}
