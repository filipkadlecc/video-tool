import os from "os";
import { listProjects, getProject } from "@/lib/projects";
import { listVersions } from "@/lib/versions";

/**
 * Everything this person has asked the AI for, as one download.
 *
 * Projects live only on each person's own machine, so this is how their prompts
 * reach whoever is working out what people keep fixing: they click "Export my
 * prompts" and send the file. Only what the user wrote (and a short slice of
 * each reply, for context) — no scene code, no footage.
 */
const REPLY_CHARS = 600;
const NOTES_CHARS = 4000;

export async function GET() {
  const projects = listProjects()
    .map((meta) => getProject(meta.id))
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .map((p) => {
      const initialPrompt = p.initialPrompt?.trim() ?? "";
      const chat = (p.chatHistory ?? []).map((m) => ({
        role: m.role,
        ...(m.ts ? { at: new Date(m.ts).toISOString() } : {}),
        ...(m.plan ? { plan: true } : {}),
        text: m.role === "user" ? m.content : m.content.slice(0, REPLY_CHARS),
      }));
      return {
        id: p.id,
        name: p.name,
        type: p.animationType,
        style: p.styleMode,
        transition: p.transitionStyle,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        initialPrompt,
        notes: p.notionContent?.trim() ? p.notionContent.trim().slice(0, NOTES_CHARS) : undefined,
        chat,
        timelinePrompts: p.promptLog ?? [],
        // Which edits stuck: every saved version's label and what it changed.
        versions: listVersions(p.id).map((v) => ({ at: v.createdAt, label: v.label, summary: v.summary })),
      };
    })
    .filter((p) => p.initialPrompt || p.chat.some((m) => m.role === "user") || p.timelinePrompts.length)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));

  const who = os.userInfo().username.replace(/[^a-z0-9_-]/gi, "") || "user";
  const date = new Date().toISOString().slice(0, 10);
  const body = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      exportedBy: who,
      projectCount: projects.length,
      userMessageCount: projects.reduce((n, p) => n + p.chat.filter((m) => m.role === "user").length, 0),
      projects,
    },
    null,
    2,
  );
  return new Response(body, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="prompts-${who}-${date}.json"`,
    },
  });
}
