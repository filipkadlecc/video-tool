import { docDuration, type EditorDoc, type EditorItem, type Track } from "./editor-doc";
import { itemEffects } from "./editor-effects";

/**
 * The composition as `scene.json` — a READABLE projection of the document.
 *
 * Not the document itself. The internal shape is right for the editor and
 * wrong for reading: ids like `solid_mu19qxsk`, `durationInFrames` beside
 * `from`, a `layout` object per item, assets referenced by generated id. Dumped
 * into an editor it is technically the composition and practically unreadable,
 * which defeats the point of having a code view at all.
 *
 * So this projects it into the shape the design shows: a frame, a duration, and
 * tracks of clips with in/out points and the handful of fields that describe
 * what you are actually looking at.
 *
 * Read-only by design. Round-tripping edited JSON back into a document is a
 * real feature with real failure modes — a malformed edit has to fail
 * somewhere, and "somewhere" would be the user's work.
 */

export interface SceneJson {
  frame: { w: number; h: number; fps: number };
  duration: number;
  tracks: {
    id: string;
    kind: string;
    clips: Record<string, unknown>[];
  }[];
}

/** "V2" / "A1" — the same convention the track heads use. */
function trackId(doc: EditorDoc, track: Track): string {
  const audio = (t: Track) => t.items.length > 0 && t.items.every((i) => i.type === "audio");
  const kind = audio(track) ? "A" : "V";
  const peers = doc.tracks.filter((t) => (audio(t) ? "A" : "V") === kind);
  return `${kind}${peers.length - peers.indexOf(track)}`;
}

function trackKind(track: Track): string {
  if (track.items.length === 0) return "empty";
  const types = new Set(track.items.map((i) => i.type));
  if (types.size === 1) {
    const only = [...types][0];
    return only === "video" ? "footage" : only === "text" ? "titles" : only;
  }
  return "mixed";
}

function clipOf(doc: EditorDoc, item: EditorItem): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  // Name it by what it is, not by its id.
  if (item.type === "text") out.name = "text";
  const asset = (item as { assetId?: string }).assetId
    ? doc.assets.find((a) => a.id === (item as { assetId?: string }).assetId)
    : undefined;
  if (asset) out.src = asset.name ?? asset.src;
  if (item.type === "scene" && "snippet" in item && item.snippet) out.snippet = item.snippet.id;

  out.in = item.from;
  out.out = item.from + item.durationInFrames;

  if (item.type === "text") {
    const t = item as { text: string; style: { fontFamily?: string; fontSize?: number; color?: string } };
    out.text = t.text;
    if (t.style.fontFamily) out.face = t.style.fontFamily;
    if (t.style.fontSize) out.size = t.style.fontSize;
    if (t.style.color) out.fill = t.style.color;
  }

  const l = item.layout;
  out.at = [Math.round(l.x), Math.round(l.y)];
  out.box = [Math.round(l.width), Math.round(l.height)];
  if (l.rotation) out.rotation = l.rotation;
  if (l.opacity !== undefined && l.opacity !== 1) out.opacity = l.opacity;

  for (const fx of itemEffects(item)) {
    if (!fx.enabled) continue;
    const key = fx.kind === "animateIn" ? "arrives" : "leaves";
    out[key] = { frames: fx.durationInFrames, preset: fx.preset };
  }

  if (item.keys) {
    const keys: Record<string, number> = {};
    for (const [ch, list] of Object.entries(item.keys)) {
      if (list?.length) keys[ch] = list.length;
    }
    if (Object.keys(keys).length) out.keys = keys;
  }

  return out;
}

export function toSceneJson(doc: EditorDoc): SceneJson {
  return {
    frame: { w: doc.size.width, h: doc.size.height, fps: doc.size.fps },
    duration: docDuration(doc),
    // Later tracks render in front, so list them front-first — which is how the
    // timeline stacks them, top to bottom.
    tracks: [...doc.tracks].reverse().map((t) => ({
      id: trackId(doc, t),
      kind: trackKind(t),
      clips: t.items.map((i) => clipOf(doc, i)),
    })),
  };
}

/** The rendered text, plus where each clip lives in it. */
export interface SceneJsonText {
  text: string;
  /** itemId -> [first line, last line], 1-based and inclusive. */
  lines: Record<string, [number, number]>;
}

/**
 * The composition as text, WITH a line map.
 *
 * Written out by hand rather than with `JSON.stringify` because the whole
 * point of code mode is that a clip in the timeline and a clip in the text are
 * the same clip: click one, the other highlights. That needs to know which
 * lines belong to which item.
 *
 * The line numbers used to be recovered afterwards by searching the text for
 * `"in": <frame>`, which is wrong the moment two clips start on the same frame
 * — and two clips starting on the same frame is not an edge case, it is what
 * a cut between two tracks looks like.
 */
export function sceneJsonText(doc: EditorDoc): SceneJsonText {
  const scene = toSceneJson(doc);
  const lines: Record<string, [number, number]> = {};
  const out: string[] = [];
  const push = (text: string) => out.push(text);

  // Ids in document order, matched to the clips as they are written out.
  const idsByTrack = [...doc.tracks].reverse().map((t) => t.items.map((i) => i.id));

  push("{");
  push(`  "frame": { "w": ${scene.frame.w}, "h": ${scene.frame.h}, "fps": ${scene.frame.fps} },`);
  push(`  "duration": ${scene.duration},`);
  push('  "tracks": [');
  scene.tracks.forEach((track, ti) => {
    push(`    { "id": ${JSON.stringify(track.id)}, "kind": ${JSON.stringify(track.kind)}, "clips": [`);
    track.clips.forEach((clip, ci) => {
      const id = idsByTrack[ti]?.[ci];
      const start = out.length + 1;
      const comma = ci === track.clips.length - 1 ? "" : ",";
      const fields = Object.entries(clip)
        .map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`);
      const oneLine = `      { ${fields.join(", ")} }${comma}`;
      // A cut is one line; a title with a face, a size, a fill and two
      // effects is not. Wrapping at the point it stops being scannable keeps
      // both readable, which is the entire job of this projection.
      if (oneLine.length <= 96) {
        push(oneLine);
      } else {
        push("      {");
        fields.forEach((f, fi) => push(`        ${f}${fi === fields.length - 1 ? "" : ","}`));
        push(`      }${comma}`);
      }
      if (id) lines[id] = [start, out.length];
    });
    push(`    ]}${ti === scene.tracks.length - 1 ? "" : ","}`);
  });
  push("  ]");
  push("}");

  return { text: out.join("\n"), lines };
}

export interface SceneProblem {
  line: number;
  itemId?: string;
  message: string;
  remedy: string;
}

/**
 * What is wrong with the composition, in the order you would read it.
 *
 * Missing sources are the whole point: a clip whose file is gone renders as
 * black, and today nothing says so until the export is already finished.
 */
export function sceneProblems(doc: EditorDoc, lineMap: Record<string, [number, number]>): SceneProblem[] {
  const out: SceneProblem[] = [];
  const known = new Set(doc.assets.map((a) => a.id));

  for (const track of doc.tracks) {
    for (const item of track.items) {
      // Point at the line the clip is on, so the problem and the thing it is
      // about are in the same place.
      const line = lineMap[item.id]?.[0] ?? 1;

      const assetId = (item as { assetId?: string }).assetId;
      if (assetId && !known.has(assetId)) {
        out.push({
          line,
          itemId: item.id,
          message: `${assetId} isn't on disk — this clip will render black.`,
          remedy: "Locate the file, or delete the clip.",
        });
        continue;
      }

      // A clip nothing can be seen through is almost always a mistake left
      // behind by an experiment, and it renders as an invisible gap.
      if (item.layout.opacity === 0) {
        out.push({
          line,
          itemId: item.id,
          message: "This clip is fully transparent — nothing of it will appear.",
          remedy: "Raise its opacity, or delete it.",
        });
        continue;
      }

      // A clip entirely outside the frame is the same class of problem: it
      // still costs render time and shows nothing.
      const l = item.layout;
      const offScreen = l.x + l.width <= 0 || l.y + l.height <= 0
        || l.x >= doc.size.width || l.y >= doc.size.height;
      if (offScreen) {
        out.push({
          line,
          itemId: item.id,
          message: "This clip sits entirely outside the frame.",
          remedy: "Move it back into shot, or delete it.",
        });
      }
    }
  }
  return out;
}
