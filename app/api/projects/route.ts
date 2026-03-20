import { listProjects, createProject } from "@/lib/projects";

export async function GET() {
  const projects = listProjects();
  return Response.json(projects);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, animationType, settings, initialPrompt, notionContent, scriptWithTimestamps, svgContent } = body;

  if (!name || !animationType || !settings || !initialPrompt) {
    return Response.json({ error: "name, animationType, settings, and initialPrompt are required" }, { status: 400 });
  }

  const project = createProject({ name, animationType, settings, initialPrompt, notionContent, scriptWithTimestamps, svgContent });
  return Response.json(project);
}
