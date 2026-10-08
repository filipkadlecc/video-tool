import Anthropic from "@anthropic-ai/sdk";
import { resolveLevel, isModelLevel } from "@/lib/models";
import { withPlanInstruction } from "@/lib/plan-mode";
import fs from "fs";
import path from "path";
import { buildSystemPrompt, buildUserMessage } from "@/lib/prompts";
import { listSfx } from "@/lib/sfx";
import { getApifyReferenceImages, APIFY_REFERENCE_INTRO, framesToContentBlocks, contactSheetToContentBlocks, userReferenceBlocks, USER_REFERENCE_INTRO } from "@/lib/prompts/reference-images";
import { renderReviewFrames, sampleFrameNumbers } from "@/lib/render-queue";
import { shapeOf, shapeSize, type FrameShape } from "@/lib/editor-doc";
import { motionStyleGuidance } from "@/lib/prompts/motion-style";
import { listAssetPaths } from "@/lib/assets";
import { getProject } from "@/lib/projects";
import { buildEnrichedMediaFiles, type EnrichedMediaFile } from "@/lib/media-analysis";
import { isReframedFilename } from "@/lib/reframe";
import { isGradedFilename } from "@/lib/grade";
import { getProjectSize } from "@/lib/types";
import { analyzeSvgs, manifestForPrompt, diffForPrompt } from "@/lib/svg-analyzer";
import { parseTape } from "@/lib/tape-parser";
import type { AnimationType, ProjectSettings, ChatMessage, SvgFile, StyleMode, TopicCardStyle, TransitionStyle } from "@/lib/types";

const anthropic = new Anthropic();

export const maxDuration = 300;

const VIDEO_EXTS = new Set([".mp4", ".mov", ".webm", ".mkv", ".avi", ".m4v"]);
const AUDIO_EXTS = new Set([".mp3", ".wav", ".m4a", ".aac"]);
const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"]);

function getMediaFileType(ext: string): "video" | "audio" | "image" | "other" {
  if (VIDEO_EXTS.has(ext)) return "video";
  if (AUDIO_EXTS.has(ext)) return "audio";
  if (IMAGE_EXTS.has(ext)) return "image";
  return "other";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`;
}

function listMediaFiles(dir: string, baseDir: string): { name: string; path: string; type: string; sizeFormatted: string }[] {
  const files: { name: string; path: string; type: string; sizeFormatted: string }[] = [];
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listMediaFiles(fullPath, baseDir));
    } else if (entry.isFile()) {
      // Skip derived auto-reframe outputs — they're not user uploads.
      if (isReframedFilename(entry.name)) continue;
      if (isGradedFilename(entry.name)) continue;
      const ext = path.extname(entry.name).toLowerCase();
      const type = getMediaFileType(ext);
      if (type === "other") continue;
      const stat = fs.statSync(fullPath);
      files.push({
        name: entry.name,
        path: path.relative(baseDir, fullPath),
        type,
        sizeFormatted: formatSize(stat.size),
      });
    }
  }
  return files;
}

// Pull the LAST fenced code block out of streamed assistant text — this is the
// candidate scene the model wants rendered when it calls render_frames.
function extractLastCodeBlock(text: string): string | null {
  const matches = [...text.matchAll(/```(?:tsx|jsx|typescript|ts)?\n([\s\S]*?)```/g)];
  if (!matches.length) return null;
  const last = matches[matches.length - 1][1];
  return last.trim().length > 50 ? last : null;
}

// Read the full source of a branded example scene or a helper library so the
// model can look up how something is really implemented (like grepping the repo).
function readSnippetSource(name: string): string {
  const clean = path.basename(name).replace(/\.(tsx?|jsx?)$/i, "");
  const candidates: string[] = [];
  const lower = clean.toLowerCase();
  if (lower === "motion") candidates.push(path.join(process.cwd(), "remotion", "motion.ts"));
  else if (lower === "decor") candidates.push(path.join(process.cwd(), "remotion", "decor.tsx"));
  else if (lower === "transitions") candidates.push(path.join(process.cwd(), "remotion", "transitions.tsx"));
  else candidates.push(path.join(process.cwd(), "remotion", "scenes", "branded", `${clean}.tsx`));
  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) return fs.readFileSync(file, "utf-8");
    } catch { /* fall through */ }
  }
  const available = fs
    .readdirSync(path.join(process.cwd(), "remotion", "scenes", "branded"))
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => f.replace(/\.tsx$/, ""));
  return `No snippet named "${name}". Available branded scenes: ${available.join(", ")}. Helper libraries: motion, decor, transitions.`;
}

// Regex-extract the declared duration/fps so we can render sample frames without
// evaluating the scene server-side. Falls back to sensible defaults for scenes
// whose durationInFrames is a computed expression.
function extractSceneMeta(code: string, fallbackFps: number): { durationInFrames: number; fps: number } {
  const dur = code.match(/export\s+const\s+durationInFrames\s*=\s*(\d+)/);
  const f = code.match(/export\s+const\s+fps\s*=\s*(\d+)/);
  return {
    durationInFrames: dur ? parseInt(dur[1], 10) : 250,
    fps: f ? parseInt(f[1], 10) : fallbackFps,
  };
}

// Tools the model drives itself — the render→look→fix loop, exactly how a coding
// agent works: write the scene, render a few frames, SEE it, fix what's wrong.
const AGENTIC_TOOLS: Anthropic.Tool[] = [
  {
    name: "render_frames",
    description:
      "Render a few still frames of the scene you just wrote so you can SEE how it actually looks, then fix any problems before finalizing. Write the COMPLETE scene as a ```tsx code block in the SAME message (or pass it as `code`), then call this tool. Frames come back as images. When you don't ask for specific frames, a contact sheet of 24 frames across the whole video comes first, so you can judge pacing, variety and flow at a glance: in a promo something new should happen every 1–3 seconds (up to 4–5 s only where the viewer is reading), never one idea stretched over the runtime, and each scene should visibly come out of the one before. Compare it with your SHOT LIST. Inspect the frames for: text overflow / clipping past the canvas edges, overlapping text, empty or frozen/dead frames, off-brand colour (background must read as the brand black #020202 with a single orange accent — no other accent colours, no pure white), poor contrast or illegible text, everything-centred or broken layout, invented facts or numbers, and pacing (content revealing too early or too late, a final frame that isn't held long enough to read). Then score what you see with submit_review; if anything is below the bar, return the COMPLETE corrected file in one ```tsx block and render again. Skip it for a tiny edit.",
    input_schema: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description:
            "The COMPLETE scene source to render. Optional if you wrote it as a ```tsx block in this message; pass it here when you'd rather not.",
        },
        frames: {
          type: "array",
          items: { type: "integer" },
          description:
            "Optional specific frame numbers to render. Omit to auto-sample a spread across the whole duration.",
        },
      },
    },
  },
  {
    name: "submit_review",
    description:
      "Score the frames you just rendered, honestly, like a demanding creative director — BEFORE deciding whether you're done. The bar is 8 on every score; below that, fix the problems you list, render again and re-score. A 6 you fix beats an 8 you invented. Call it after every render_frames pass on a substantial scene.",
    input_schema: {
      type: "object",
      properties: {
        scores: {
          type: "object",
          description: "1–10 each. 8 means a senior motion designer would ship it.",
          properties: {
            hook: { type: "integer", description: "Do the first 2 seconds grab attention and make you want to keep watching?" },
            readability: { type: "integer", description: "Is every word legible, on screen long enough to read, with nothing clipped or overlapping?" },
            motion: { type: "integer", description: "Does motion feel deliberate and weighted — springs with mass, compound moves — rather than linear or floaty?" },
            variety: { type: "integer", description: "From the contact sheet: does something new happen every 1–3 s (4–5 s only where the viewer reads), as the shot list planned — or is it one idea stretched out?" },
            flow: { type: "integer", description: "Does each scene come out of the one before — a shared element, a match cut, a carried object, a shape that becomes the next container — or does it read as slides replacing slides? Does anything look like a template?" },
            composition: { type: "integer", description: "Balanced, intentional layout; not everything dead centre; good use of the canvas. Would each key frame work as a still ad?" },
            brand: { type: "integer", description: "Brand black background, a single orange accent, right fonts and weights, no banned effects — and nothing on screen the brief didn't give (no invented stats, names or claims)." },
          },
          required: ["hook", "readability", "motion", "variety", "flow", "composition", "brand"],
        },
        problems: {
          type: "array",
          items: { type: "string" },
          description: "The three biggest problems, most important first, each with WHERE it happens (a time or frame), e.g. \"0:04 — the subtitle clips the right edge\". Empty only if nothing is below 8.",
        },
      },
      required: ["scores", "problems"],
    },
  },
  {
    name: "read_snippet_source",
    description:
      "Read the full source of one of the branded example scenes (e.g. EndCard, LowerThird, ChartReveal, StatCallout) or a helper library (motion, decor, transitions) to see exactly how it's implemented before you use it. Like opening the real file in the codebase.",
    input_schema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "A branded scene name (e.g. \"EndCard\") or a helper library: \"motion\", \"decor\", or \"transitions\".",
        },
      },
      required: ["name"],
    },
  },
];

const ORIENTATION_SHAPE: Record<string, FrameShape> = { horizontal: "16:9", vertical: "9:16", square: "1:1" };

/**
 * The shapes a scene declares (`export const orientation = [...]`) other than
 * the one it's being built at. Absent means a scene from before shapes existed,
 * which is only ever checked at its own size.
 */
function otherDeclaredShapes(code: string, width: number, height: number): { label: string; width: number; height: number }[] {
  const m = code.match(/export\s+const\s+orientation\s*(?::[^=]+)?=\s*\[([^\]]*)\]/);
  if (!m) return [];
  const own = shapeOf(width, height);
  const shapes = [...m[1].matchAll(/["'](horizontal|vertical|square)["']/g)]
    .map((x) => ORIENTATION_SHAPE[x[1]])
    .filter((shape, i, all) => shape !== own && all.indexOf(shape) === i);
  return shapes.map((shape) => ({ label: shape, ...shapeSize(width, height, shape) }));
}

const REVIEW_AXES = ["hook", "readability", "motion", "variety", "flow", "composition", "brand"] as const;

/**
 * Check a `submit_review` call against the pass bar. Scores are clamped to
 * 1–10 so a stray 11 can't carry a weak axis.
 */
function judgeReview(
  input: unknown,
  bar: number,
):
  | { error: string }
  | { passed: boolean; failing: string[]; line: (n: number) => string } {
  const raw = (input ?? {}) as { scores?: Record<string, unknown>; problems?: unknown };
  const scores: Record<string, number> = {};
  for (const axis of REVIEW_AXES) {
    const v = Number(raw.scores?.[axis]);
    if (!Number.isFinite(v)) return { error: `Missing score for "${axis}". Score all ${REVIEW_AXES.length}: ${REVIEW_AXES.join(", ")}.` };
    scores[axis] = Math.max(1, Math.min(10, Math.round(v)));
  }
  const problems = Array.isArray(raw.problems) ? raw.problems.map(String).filter(Boolean) : [];
  const failing = REVIEW_AXES.filter((a) => scores[a] < bar);
  const passed = failing.length === 0;
  const summary = REVIEW_AXES.map((a) => `${a} ${scores[a]}`).join(" · ");
  return {
    passed,
    failing: [...failing],
    line: (n) =>
      `_Review ${n}: ${summary}${passed ? " — passed." : problems.length ? ` — fixing: ${problems[0]}` : ""}_`,
  };
}

// Extra system guidance appended when the render tool is available, so the model
// knows it can (and should) look at its own work.
const AGENTIC_GUIDANCE =
  "\n\n=== SELF-REVIEW (you can SEE your own output) ===\n" +
  "You have a `render_frames` tool that renders still frames of the scene you write and returns them as images. For any substantial scene, USE IT: write the complete scene (opening with its SHOT LIST), call render_frames, look at the contact sheet and the frames, and fix any problems you see (overflow, overlapping text, empty/dead frames, off-brand colour, weak contrast, broken layout, bad timing, one idea stretched over the whole runtime, dead stretches, scenes that swap like slides instead of handing off, anything the brief didn't give). Check the render delivers the shot list. After each render, call `submit_review` to score it honestly on hook, readability, motion, variety, flow, composition and brand. The bar is 8 on every score: if anything is below it, fix the problems you listed, render again and re-score, until it passes or you run out of renders. Iteration is the method, not a failure. For a trivial edit you can skip rendering and reviewing. You also have `read_snippet_source` to read the real source of any branded example or helper library when you need to see how something is done. Always end with the COMPLETE final scene in a single ```tsx block.";

// The scene being edited, as the text editor tool sees it. It only ever
// exists in memory here — nothing is written to disk.
const SCENE_PATH = "scene.tsx";

// Retyping a 23k-character scene to change one number took ~95 s; a patch is a
// few hundred tokens. So when there IS a scene, the model gets the built-in
// text editor tool (the find-and-replace editing it is trained on) and uses it
// for targeted changes, writing the whole file only for a real redesign.
const TEXT_EDITOR_TOOL: Anthropic.ToolTextEditor20250728 = {
  type: "text_editor_20250728",
  name: "str_replace_based_edit_tool",
};

const EDITING_GUIDANCE =
  "\n\n=== EDITING AN EXISTING SCENE ===\n" +
  `The current scene is also open as the file \`${SCENE_PATH}\` in your \`str_replace_based_edit_tool\`. For a targeted change (a size, a colour, a word, a timing, one element), EDIT that file with \`str_replace\` instead of rewriting the scene — it is far faster. Each \`old_str\` must match the file exactly once, so include enough surrounding lines to make it unique. Rewrite the complete file in a \`\`\`tsx block only for a redesign or a large restructure. When you edit with the tool, do NOT paste the scene or any code block in your reply — the final file is handed back for you; just say in a sentence what you changed. \`render_frames\` renders the file as edited. This replaces the Error Handling rule about always outputting the complete file: fixing an error with the tool is fine.`;

/**
 * Run one text editor command against the in-memory scene.
 * Returns the new code (unchanged for `view`) or an error for the model.
 */
function applyTextEditorCommand(
  code: string,
  input: Record<string, unknown>,
): { code: string; result: string; edited: boolean } | { error: string } {
  const command = String(input.command ?? "");
  const path = String(input.path ?? "").replace(/^\/+/, "");
  if (path !== SCENE_PATH) return { error: `Only ${SCENE_PATH} exists. Use path "${SCENE_PATH}".` };

  if (command === "view") {
    const lines = code.split("\n");
    const range = Array.isArray(input.view_range) ? (input.view_range as number[]) : null;
    const start = range ? Math.max(1, range[0]) : 1;
    const end = range && range[1] !== -1 ? Math.min(lines.length, range[1]) : lines.length;
    const out = lines.slice(start - 1, end).map((l, i) => `${start + i}\t${l}`).join("\n");
    return { code, result: out, edited: false };
  }
  if (command === "str_replace") {
    const oldStr = typeof input.old_str === "string" ? input.old_str : "";
    const newStr = typeof input.new_str === "string" ? input.new_str : "";
    if (!oldStr) return { error: "old_str is required." };
    const count = code.split(oldStr).length - 1;
    if (count === 0) {
      return { error: "No match for old_str — the text must match the file exactly, whitespace included. View the file and try again, or rewrite the complete file." };
    }
    if (count > 1) {
      return { error: `old_str matches ${count} places. Include more surrounding lines so it matches exactly one.` };
    }
    const idx = code.indexOf(oldStr);
    return { code: code.slice(0, idx) + newStr + code.slice(idx + oldStr.length), result: "Edited.", edited: true };
  }
  if (command === "insert") {
    const text = typeof input.insert_text === "string" ? input.insert_text : typeof input.new_str === "string" ? input.new_str : "";
    const line = Number(input.insert_line);
    const lines = code.split("\n");
    if (!Number.isInteger(line) || line < 0 || line > lines.length) {
      return { error: `insert_line must be between 0 and ${lines.length}.` };
    }
    lines.splice(line, 0, ...text.split("\n"));
    return { code: lines.join("\n"), result: "Inserted.", edited: true };
  }
  if (command === "create") {
    const text = typeof input.file_text === "string" ? input.file_text : "";
    if (text.trim().length < 50) return { error: "file_text must be the complete scene." };
    return { code: text, result: "File written.", edited: true };
  }
  return { error: `Unsupported command "${command}". Use view, str_replace, insert or create.` };
}

export async function POST(request: Request) {
  const body = await request.json();
  const {
    messages,
    projectSettings,
    animationType,
    notionContent,
    scriptWithTimestamps,
    currentCode,
    svgContents,
    projectId,
    styleMode,
    topicCardStyle,
    transitionStyle,
    useSfx,
    effort: requestedEffort,
    level: requestedLevel,
    plan,
    images,
    motionStyle: requestedMotionStyle,
  } = body as {
    messages: ChatMessage[];
    projectSettings: ProjectSettings;
    animationType: AnimationType;
    notionContent?: string;
    scriptWithTimestamps?: string;
    currentCode?: string;
    svgContents?: SvgFile[];
    projectId?: string;
    styleMode?: StyleMode;
    topicCardStyle?: TopicCardStyle;
    transitionStyle?: TransitionStyle;
    useSfx?: boolean;
    effort?: string;
    level?: string;
    plan?: boolean;
    /** Reference images attached to THIS message, as data URIs. */
    images?: string[];
    /** The document's spring set (see SPRINGS in remotion/motion.ts). */
    motionStyle?: "classic" | "new";
  };
  // A timeline sends its document's style; a code-first project (a brand-new
  // one's first pass) has only the choice made when it was created.
  const motionStyle = (requestedMotionStyle ?? projectSettings?.motionStyle) === "new" ? "new" : "classic";

  // The chat's Fast / Balanced / Best switch (lib/models.ts). Balanced is Opus
  // 5.5 at "high"; Best is "max" — noticeably better, but a run can take half
  // an hour. A bare `effort` of "max"/"xhigh" (older callers) still works.
  const resolved = resolveLevel(requestedLevel);
  const model = resolved.model;
  const effort =
    !isModelLevel(requestedLevel) && (requestedEffort === "max" || requestedEffort === "xhigh")
      ? requestedEffort
      : resolved.effort;

  if (!messages || !messages.length) {
    return Response.json({ error: "messages are required" }, { status: 400 });
  }

  const assetPaths = listAssetPaths();

  // For video projects, gather media file info enriched with analysis (probe +
  // transcript segments + scene cuts) so the AI can edit with real understanding
  // instead of just a filename list. Reads caches; only ffprobe may run inline.
  // The model only ever sees `notionContent` (injected as "REFERENCE CONTENT
  // (from Notion)"). Editing notes can land in the notes box (notionContent) OR
  // the prompt box (initialPrompt) — so for video, fall back to initialPrompt
  // when notionContent is empty, so the notes reach the model either way.
  let effectiveNotionContent = notionContent;
  let videoContext:
    | { projectId: string; mediaFiles: EnrichedMediaFile[]; compFps: number; topicCardStyle: TopicCardStyle }
    | undefined;
  if (animationType === "video" && projectId) {
    const project = getProject(projectId);
    if (!effectiveNotionContent?.trim() && project) {
      const init = project.initialPrompt?.trim();
      effectiveNotionContent =
        project.notionContent?.trim() ||
        (init && init !== "Edit uploaded footage" ? init : undefined);
    }
    if (project?.mediaFolder && fs.existsSync(project.mediaFolder)) {
      const mediaFiles = listMediaFiles(project.mediaFolder, project.mediaFolder);
      const target = getProjectSize(projectSettings);
      const enriched = await buildEnrichedMediaFiles(project, mediaFiles, target);
      videoContext = {
        projectId,
        mediaFiles: enriched,
        compFps: projectSettings.fps,
        topicCardStyle: topicCardStyle ?? project.topicCardStyle ?? "cards",
      };
    }
  }

  // For terminal projects, read the customTheme flag so the prompt can either
  // force the Apify default (when false/unset) or preserve the user's theme.
  // Also pre-compute the current tape duration server-side so the model can
  // do real math when the user says "extend" / "make it 10s" / etc.
  let customTheme: boolean | undefined;
  let currentTapeDurationMs: number | undefined;
  if (animationType === "terminal") {
    if (projectId) customTheme = getProject(projectId)?.customTheme;
    if (currentCode && currentCode.trim()) {
      currentTapeDurationMs = parseTape(currentCode).totalDurationMs;
    }
  }

  // SFX are only relevant for non-terminal compositions (terminal is VHS .tape).
  const sfx = animationType !== "terminal" ? listSfx() : [];
  const systemPrompt = buildSystemPrompt(animationType, projectSettings, assetPaths, videoContext, styleMode, customTheme, useSfx, sfx, transitionStyle);

  // Attach Apify style reference images on the FIRST user turn only — keeps
  // follow-up edits cheap (the visual grammar is also encoded in the system prompt).
  const isTerminal = animationType === "terminal";
  const firstUserTurnIndex = messages.findIndex((m) => m.role === "user");
  const referenceImages = !isTerminal ? await getApifyReferenceImages() : [];
  const userImages = !isTerminal ? await userReferenceBlocks(images) : [];

  // Build Anthropic messages from chat history
  // Enhance the last user message with context
  const conversation: Anthropic.MessageParam[] = messages.map((msg, i) => {
    const isLastUser = msg.role === "user" && i === messages.length - 1;
    const isFirstUser = msg.role === "user" && i === firstUserTurnIndex;
    const attachReferences = isFirstUser && referenceImages.length > 0;

    if (isLastUser) {
      let userContent = buildUserMessage(msg.content, currentCode, effectiveNotionContent, scriptWithTimestamps, animationType, currentTapeDurationMs);
      if (svgContents && svgContents.length > 0) {
        const { manifests, sequenceDiff } = analyzeSvgs(svgContents);
        const parts: string[] = [];
        svgContents.forEach((svg, i) => {
          const m = manifests[i];
          if (m) {
            parts.push(
              `[SVG ${i + 1} MANIFEST]\n${JSON.stringify(manifestForPrompt(m), null, 2)}\n[END MANIFEST ${i + 1}]`
            );
          }
          parts.push(`[SVG ${i + 1}: ${svg.filename}]\n${svg.content}\n[END SVG ${i + 1}]`);
        });
        if (sequenceDiff) {
          parts.push(
            `[SEQUENCE DIFF — these SVGs share a viewBox and form a UI flow. Animate the deltas, not whole-frame crossfades.]\n${JSON.stringify(diffForPrompt(sequenceDiff), null, 2)}\n[END SEQUENCE DIFF]`
          );
        }
        userContent = `${parts.join("\n\n")}\n\n${userContent}`;
      }
      if (attachReferences || userImages.length > 0) {
        return {
          role: "user" as const,
          content: [
            ...(attachReferences ? [{ type: "text" as const, text: APIFY_REFERENCE_INTRO }, ...referenceImages] : []),
            ...(userImages.length > 0 ? [{ type: "text" as const, text: USER_REFERENCE_INTRO }, ...userImages] : []),
            { type: "text", text: userContent },
          ],
        };
      }
      return { role: "user" as const, content: userContent };
    }
    if (attachReferences) {
      return {
        role: "user" as const,
        content: [
          { type: "text", text: APIFY_REFERENCE_INTRO },
          ...referenceImages,
          { type: "text", text: msg.content },
        ],
      };
    }
    return {
      role: msg.role as "user" | "assistant",
      content: msg.content,
    };
  });

  // Enable the render→look→fix tool loop for standard Remotion scenes only:
  // not terminal .tape, and not footage-overlay video projects (those can't be
  // still-rendered from code alone in this path). When enabled, the model drives
  // its own vision loop.
  // Plan mode answers in words only, so the loop's tools are off too.
  const anthropicMessages = plan ? withPlanInstruction(conversation) : conversation;
  const toolsEnabled = !isTerminal && animationType !== "video" && !plan;
  const { width: renderWidth, height: renderHeight } = getProjectSize(projectSettings);

  // Cache the big (~25K-token) system prompt so follow-up edits, error retries,
  // and every render→fix round re-pay ~0.1x on it instead of full price. The
  // dynamic tail (asset list / SFX / agentic guidance) is stable within a
  // session, so the cached prefix holds.
  const editingEnabled = toolsEnabled && !!currentCode?.trim();
  const motionNote = isTerminal ? "" : motionStyleGuidance(motionStyle);
  const systemText = toolsEnabled
    ? systemPrompt + motionNote + AGENTIC_GUIDANCE + (editingEnabled ? EDITING_GUIDANCE : "")
    : systemPrompt + motionNote;
  const tools: Anthropic.ToolUnion[] = editingEnabled ? [...AGENTIC_TOOLS, TEXT_EDITOR_TOOL] : AGENTIC_TOOLS;
  const systemBlocks: Anthropic.TextBlockParam[] = [
    { type: "text", text: systemText, cache_control: { type: "ephemeral" } },
  ];

  // Hard safety caps so a model-driven loop can never run away: at most a few
  // tool rounds and a few renders per request.
  const MAX_TOOL_TURNS = 10;
  const MAX_RENDERS = 8;
  // Every score has to reach this for the self-review to pass.
  const REVIEW_PASS = 8;

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      // Opus 5.5 can think silently for minutes before its first word. An SSE
      // comment now gets the response headers out, and one every 15s keeps the
      // connection from being dropped as idle by anything in between.
      const heartbeat = () => {
        try {
          controller.enqueue(encoder.encode(": keep-alive\n\n"));
        } catch { /* the client has gone; the loop's own error path cleans up */ }
      };
      heartbeat();
      const heartbeatTimer = setInterval(heartbeat, 15000);
      try {
        // The agentic loop: stream a turn and forward its text; if the model
        // asked to use tools (render_frames / read_snippet_source), run them
        // server-side, feed the results back, and repeat — until the model
        // produces a final answer or we hit the safety caps. Terminal projects
        // use cheap Sonnet with no tools and simply run one turn.
        const messages: Anthropic.MessageParam[] = [...anthropicMessages];
        let latestCode: string | null = currentCode ?? null;
        let toolTurns = 0;
        let renderCount = 0;
        let editCount = 0;
        let reviewCount = 0;
        let rendersAtLastReview = 0;
        // Whether the scene's latest version came from the edit tool rather
        // than a ```tsx block the model wrote — then we hand the file back.
        let codeFromEdits = false;
        let lastStopReason: string | null = null;
        const usage = { input: 0, cacheRead: 0, cacheWrite: 0, output: 0 };

        for (;;) {
          const forceFinal = toolTurns >= MAX_TOOL_TURNS || renderCount >= MAX_RENDERS;
          const stream = isTerminal
            ? anthropic.messages.stream({
                model: "claude-sonnet-4-6",
                max_tokens: 32000,
                system: systemBlocks,
                messages,
              })
            : anthropic.messages.stream({
                model,
                max_tokens: 128000,
                thinking: { type: "adaptive" },
                output_config: { effort },
                system: systemBlocks,
                messages,
                ...(toolsEnabled
                  ? { tools, tool_choice: forceFinal ? { type: "none" as const } : { type: "auto" as const } }
                  : {}),
              });

          for await (const event of stream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              send({ text: event.delta.text });
            }
          }
          const finalMessage = await stream.finalMessage();
          const u = finalMessage.usage;
          usage.input += u.input_tokens;
          usage.cacheRead += u.cache_read_input_tokens ?? 0;
          usage.cacheWrite += u.cache_creation_input_tokens ?? 0;
          usage.output += u.output_tokens;
          lastStopReason = finalMessage.stop_reason;

          // Track the latest scene code the model wrote — that's what
          // render_frames renders.
          const turnText = finalMessage.content
            .filter((b): b is Anthropic.TextBlock => b.type === "text")
            .map((b) => b.text)
            .join("\n");
          const codeInTurn = extractLastCodeBlock(turnText);
          if (codeInTurn) {
            latestCode = codeInTurn;
            codeFromEdits = false;
          }
          // Opus 5.5 may put its between-tool-call text in thinking blocks, so
          // it can also hand the scene over as the render tool's `code` input.
          for (const block of finalMessage.content) {
            if (block.type !== "tool_use" || block.name !== "render_frames") continue;
            const codeArg = (block.input as { code?: string } | null)?.code;
            if (codeArg && codeArg.trim().length > 50) {
              latestCode = codeArg;
              codeFromEdits = false;
            }
          }

          if (finalMessage.stop_reason !== "tool_use") break;

          // Preserve the assistant turn verbatim (thinking + tool_use blocks
          // must be echoed back unchanged when continuing on the same model).
          messages.push({ role: "assistant", content: finalMessage.content });

          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const block of finalMessage.content) {
            if (block.type !== "tool_use") continue;
            if (block.name === "render_frames") {
              renderCount++;
              const framesArg = (block.input as { frames?: number[] } | null)?.frames;
              if (!latestCode) {
                toolResults.push({
                  type: "tool_result",
                  tool_use_id: block.id,
                  is_error: true,
                  content:
                    "No scene code found yet. Write the COMPLETE scene as a ```tsx block in your message, then call render_frames.",
                });
                continue;
              }
              const meta = extractSceneMeta(latestCode, projectSettings.fps);
              const frames = framesArg?.length ? framesArg : sampleFrameNumbers(meta.durationInFrames);
              try {
                // The sheet only when the model didn't ask for specific frames:
                // then it wants a closer look, not the overview again.
                const review = await renderReviewFrames(
                  projectId ?? "preview",
                  latestCode,
                  meta.durationInFrames,
                  meta.fps,
                  renderWidth,
                  renderHeight,
                  frames,
                  svgContents?.map((s) => ({ filename: s.filename, content: s.content })),
                  {
                    contactSheet: !framesArg?.length,
                    // A scene that says it works in other shapes is checked in them.
                    shapes: framesArg?.length ? [] : otherDeclaredShapes(latestCode, renderWidth, renderHeight),
                    motionStyle,
                  },
                );
                toolResults.push({
                  type: "tool_result",
                  tool_use_id: block.id,
                  content: [
                    {
                      type: "text",
                      text: "Rendered frames of your current scene — review them for overflow, empty/dead frames, off-brand colour, weak contrast, broken layout, and pacing, then score them with submit_review.",
                    },
                    ...contactSheetToContentBlocks(review.contactSheet),
                    ...review.shapeStrips.flatMap((strip) => [
                      {
                        type: "text" as const,
                        text: `The same scene rendered at ${strip.label} — 6 frames across the video. It will be exported in this shape too: check nothing clips, crowds or leaves the safe area, and fix it with useLayout()'s u / safe / pick, never by special-casing pixel numbers. Score the review on the worst shape.`,
                      },
                      { type: "image" as const, source: { type: "base64" as const, media_type: "image/png" as const, data: strip.png } },
                    ]),
                    ...framesToContentBlocks(review.frames, meta.durationInFrames),
                  ],
                });
              } catch (e) {
                const msg = e instanceof Error ? e.message : "render failed";
                toolResults.push({
                  type: "tool_result",
                  tool_use_id: block.id,
                  is_error: true,
                  content: `Render failed: ${msg.slice(-400)}. This usually means the scene has a compile or runtime error — fix it and return the corrected complete file.`,
                });
              }
            } else if (block.name === TEXT_EDITOR_TOOL.name) {
              const outcome = latestCode
                ? applyTextEditorCommand(latestCode, (block.input ?? {}) as Record<string, unknown>)
                : { error: "There is no scene yet. Write the complete scene as a ```tsx block." };
              if ("error" in outcome) {
                toolResults.push({ type: "tool_result", tool_use_id: block.id, is_error: true, content: outcome.error });
              } else {
                if (outcome.edited) {
                  latestCode = outcome.code;
                  codeFromEdits = true;
                  editCount++;
                }
                toolResults.push({ type: "tool_result", tool_use_id: block.id, content: outcome.result });
              }
            } else if (block.name === "submit_review") {
              const outcome = judgeReview(block.input, REVIEW_PASS);
              if ("error" in outcome) {
                toolResults.push({ type: "tool_result", tool_use_id: block.id, is_error: true, content: outcome.error });
                continue;
              }
              if (renderCount === rendersAtLastReview) {
                toolResults.push({
                  type: "tool_result",
                  tool_use_id: block.id,
                  is_error: true,
                  content: "Nothing new to review — render the scene first (render_frames), then score what you see.",
                });
                continue;
              }
              reviewCount++;
              rendersAtLastReview = renderCount;
              // One line per pass in the chat, so the person can watch it improve.
              send({ text: `\n\n${outcome.line(reviewCount)}\n\n` });
              const rendersLeft = MAX_RENDERS - renderCount;
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: outcome.passed
                  ? `Passed — every score is ${REVIEW_PASS} or above. Return the COMPLETE final scene in one \`\`\`tsx block now; no more renders.`
                  : rendersLeft > 0
                    ? `Not there yet: ${outcome.failing.join(", ")} below ${REVIEW_PASS}. Fix the problems you listed (most important first), write the COMPLETE corrected scene, call render_frames, then submit_review again. ${rendersLeft} render${rendersLeft === 1 ? "" : "s"} left.`
                    : `Below the bar (${outcome.failing.join(", ")}) and out of renders. Fix what you can from your list without rendering again, and return the COMPLETE final scene in one \`\`\`tsx block.`,
              });
            } else if (block.name === "read_snippet_source") {
              const name = String((block.input as { name?: string } | null)?.name ?? "");
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: readSnippetSource(name),
              });
            } else {
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                is_error: true,
                content: `Unknown tool: ${block.name}`,
              });
            }
          }
          messages.push({ role: "user", content: toolResults });
          toolTurns++;
        }

        // The callers take the last ```tsx block in the stream as the scene, so
        // a scene that was patched rather than rewritten is handed back whole.
        if (codeFromEdits && latestCode) {
          send({ text: `\n\n\`\`\`tsx\n${latestCode}\n\`\`\`\n` });
        }

        console.log(
          `[generate] ${isTerminal ? "claude-sonnet-4-6" : `${model}@${effort}`} agentic turns=${toolTurns} renders=${renderCount} reviews=${reviewCount} edits=${editCount} stop=${lastStopReason} usage: in=${usage.input} cacheRead=${usage.cacheRead} cacheWrite=${usage.cacheWrite} out=${usage.output}`,
        );
        if (lastStopReason === "refusal") {
          send({ error: "The model declined this request. Try rewording it." });
        }
        send({ done: true, stopReason: lastStopReason });
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        send({ error: message });
        controller.close();
      } finally {
        clearInterval(heartbeatTimer);
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
