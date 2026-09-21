/**
 * Build a review reel: every scene in the short-form kit, in one 9:16 project.
 *
 *   npx tsx scripts/build-short-form-reel.ts [baseUrl]
 *
 * Each block uses the Figma sample text on purpose, so the project can be put
 * side by side with the "Vertical format assets 9:16" page and compared
 * directly — which is the only way to check a 1:1 port by eye. Every block
 * keeps its snippet provenance, so its text and options can be reopened from
 * the inspector ("Edit … texts").
 *
 * Re-runnable: it makes a NEW project each time rather than editing one, so a
 * review in progress is never overwritten.
 */
import { SNIPPET_SCHEMAS } from "../lib/snippet-schemas";
import { renderSnippet } from "../lib/snippet-template";
import { loadSnippetCatalog } from "../lib/snippet-catalog";
import { sceneFramesAtFps } from "../lib/scene-eval";
import { emptyDoc, fullFrameLayout, makeId, type EditorDoc, type EditorItem } from "../lib/editor-doc";
import { captionItem } from "../lib/captions-preset";

const base = process.argv[2] ?? "http://localhost:3000";
const SIZE = { width: 1080, height: 1920, fps: 25 };

/** label is what the timeline block is called; values override the defaults. */
const BLOCKS: { scene: string; label: string; values: Record<string, unknown> }[] = [
  // ── Titles ───────────────────────────────────────────────────────────────
  { scene: "ShortTitle", label: "Title 1 — plain", values: { STYLE: "plain" } },
  { scene: "ShortTitle", label: "Title 2 — orange boxes", values: {} },
  { scene: "ShortTitle", label: "Title 3 — blue, two lines", values: { ACCENT: "blue", HEADLINE_LINE2: "Two lines" } },
  { scene: "ShortFunkyTitle", label: "Title 4 — funky orange", values: {} },
  {
    scene: "ShortFunkyTitle", label: "Title 5 — funky blue",
    values: {
      ACCENT: "blue", SIZE: 112.763,
      WORDS: [
        { value: "When", cx: 367.4878, cy: 749.9365, rot: -11.62 },
        { value: "there’s", cx: 671.8456, cy: 777.3281, rot: 7.04 },
        { value: "lots", cx: 377.4359, cy: 1007.9106, rot: -17.65 },
        { value: "of", cx: 563.5451, cy: 993.5411, rot: 7.04 },
        { value: "text", cx: 671.7576, cy: 1157.9729, rot: 7.04 },
      ],
    },
  },
  { scene: "ShortStatement", label: "Title 6 — statement box", values: {} },

  // ── Lower thirds ─────────────────────────────────────────────────────────
  { scene: "ShortLowerThird", label: "Lower third 1 — name, boxed", values: {} },
  { scene: "ShortLowerThird", label: "Lower third 2 — place, boxed", values: { MODE: "place", ACCENT: "blue" } },
  { scene: "ShortLowerThird", label: "Lower third 3 — name, plain", values: { STYLE: "plain" } },
  { scene: "ShortLowerThird", label: "Lower third 4 — place, plain", values: { STYLE: "plain", MODE: "place" } },
  { scene: "ShortLowerThird", label: "Lower third — Shorts-safe placement", values: { PLACEMENT: "shorts-low" } },

  // ── End cards ────────────────────────────────────────────────────────────
  { scene: "ShortEndCard", label: "Final CTA", values: {} },
  { scene: "ShortEndCard", label: "Final CTA — with shapes", values: { SHAPES: true } },
  {
    scene: "ShortEndCard", label: "Final CTA — claim",
    values: { LEAD: "Your AI needs tools. ", HEADLINE: "We’ve got thousands.", SIZE: 87.251 },
  },
  { scene: "ShortCollabCard", label: "Collab + case study", values: {} },
  { scene: "ShortWatchFull", label: "Watch the full video", values: {} },
  { scene: "ShortLogoOutro", label: "Logo outro", values: {} },
];

const catalog = loadSnippetCatalog();
const doc: EditorDoc = emptyDoc(SIZE);
doc.background = "#000000";
doc.tracks[0].name = "Short-form kit";
doc.tracks.push({ id: makeId("track"), name: "Subtitles", items: [] });

let at = 0;
for (const b of BLOCKS) {
  const entry = catalog.find((e) => e.id === b.scene);
  if (!entry) throw new Error(`no such scene: ${b.scene}`);
  const schema = SNIPPET_SCHEMAS[b.scene];
  const code = schema ? renderSnippet(entry.code, schema, b.values) : entry.code;
  const durationInFrames = sceneFramesAtFps(entry, SIZE.fps);
  doc.tracks[0].items.push({
    type: "scene",
    id: makeId("scene"),
    name: b.label,
    from: at,
    durationInFrames,
    layout: fullFrameLayout(SIZE),
    code,
    // Provenance is what makes each block re-editable from the inspector
    // instead of being a wall of frozen TSX.
    snippet: { id: b.scene, values: b.values },
    fit: "retime",
  } as EditorItem);
  at += durationInFrames;
}

// The subtitle treatment is a caption style rather than a scene, so it is shown
// the way it is actually used: as a captions item, on its own track, over black.
const sub = "titles will here, two lines max".split(" ");
const tokens = sub.map((text, i) => ({ text, startSec: i * 0.42, endSec: (i + 1) * 0.42 }));
const captions = captionItem(SIZE, at, SIZE.fps, tokens, sub.length * 0.42);
captions.durationInFrames = Math.round(4 * SIZE.fps);
captions.name = "Subtitles — short-form preset";
doc.tracks[1].items.push(captions as EditorItem);
at += captions.durationInFrames;

async function main() {
  const res = await fetch(`${base}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Short-form kit — review reel (9:16)",
      animationType: "animation",
      engine: "remotion",
      settings: { resolution: "1080p", orientation: "vertical", fps: 25 },
      initialPrompt: "Every scene in the short-form (9:16) kit, ported 1:1 from Figma, for review.",
      doc,
    }),
  });
  if (!res.ok) {
    console.error("failed:", res.status, await res.text());
    process.exit(1);
  }
  const { id } = (await res.json()) as { id: string };
  console.log(`\n${BLOCKS.length} blocks + a subtitle demo, ${(at / SIZE.fps).toFixed(1)}s\n`);
  console.log(`${base}/project/${id}\n`);
}

void main();
