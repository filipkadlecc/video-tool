import { listProjects, createProject } from "@/lib/projects";

export async function GET() {
  const projects = listProjects();
  return Response.json(projects);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, animationType, settings, initialPrompt, initialCode, notionContent, scriptWithTimestamps, svgContents, styleMode } = body;

  if (!name || !animationType || !settings || (!initialPrompt && !initialCode)) {
    return Response.json({ error: "name, animationType, settings, and (initialPrompt or initialCode) are required" }, { status: 400 });
  }

  const project = createProject({
    name,
    animationType,
    settings,
    initialPrompt: initialPrompt ?? "",
    initialCode,
    notionContent,
    scriptWithTimestamps,
    svgContents,
    styleMode,
  });
  return Response.json(project);
}
