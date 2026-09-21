/**
 * Evaluating a scene module OUTSIDE React.
 *
 * A scene is a TSX module with `export default`, `export const durationInFrames`
 * and `export const fps`. `remotion/DynamicScene.tsx` has always been able to
 * evaluate one, but that file is `"use client"` — so a route handler importing
 * `evalSceneCode` gets the RSC client-reference proxy, not the function.
 *
 * This module holds the part that has nothing to do with React: the sucrase
 * transform, the module shim the generated/branded code is resolved against, and
 * reading a scene's declared length. DynamicScene imports it rather than keeping
 * a second copy, so there is one list of what a scene is allowed to import.
 *
 * Nothing here RENDERS anything. `durationInFrames` and `fps` are module-scope
 * exports, evaluated when the module body runs, so they can be read without ever
 * mounting the component — which is what makes this safe on the server.
 *
 * ── Why motion/decor/transitions are NOT imported here ──────────────────────
 * `remotion/motion.ts` calls `createContext`, which Next refuses inside a server
 * module — importing it turned every route that touched this file into a 500.
 * They are not needed either: a scene's module scope only ever computes from its
 * own local consts (PromptBox from TYPING_SECONDS + HOLD_SECONDS, Years from two
 * frame counts, AiChat from a flag); the imported helpers are called inside the
 * component, which never runs here. So the server resolves them to inert stubs,
 * and DynamicScene — which is a client component and does render — passes the
 * real modules in.
 */

import * as React from "react";
import type { Orientation } from "./types";
import { transform } from "sucrase";
import { BRAND, BRAND_FONT_FACE_CSS, VERTICAL_DESIGN, figmaPlane } from "../remotion/theme";

const THEME_MODULE = { BRAND, BRAND_FONT_FACE_CSS, VERTICAL_DESIGN, figmaPlane };

/**
 * Stands in for a module a scene imports but never touches at module scope.
 * Any property, and any call, yields another stub rather than throwing — so a
 * stray `SPRINGS.SNAPPY` at the top of a file can't stop a length being read.
 */
function inertModule(): unknown {
  const stub: unknown = new Proxy(function () {} as unknown as object, {
    get: (_t, key) => (key === "__esModule" ? true : stub),
    apply: () => stub,
    construct: () => stub as object,
  });
  return stub;
}

/**
 * The modules a scene is resolved against. Anything omitted becomes an inert
 * stub, which is all that reading a declared length needs — a scene's module
 * scope computes from its own local consts and never touches these.
 */
export interface SceneModules {
  motion?: unknown;
  decor?: unknown;
  transitions?: unknown;
  /** Keyed by package name, e.g. "remotion", "@remotion/paths". */
  packages?: Record<string, unknown>;
}

/**
 * Package names a scene may import. The MODULES themselves are supplied by the
 * caller — importing `remotion` here would break every server route that touches
 * this file, because Remotion needs React.createContext at module load.
 */
export const KNOWN_PACKAGES = [
  "remotion",
  "@remotion/transitions",
  "@remotion/transitions/fade",
  "@remotion/transitions/slide",
  "@remotion/transitions/wipe",
  "@remotion/transitions/flip",
  "@remotion/transitions/clock-wipe",
  "@remotion/transitions/iris",
  "@remotion/animation-utils",
  "@remotion/paths",
  "@remotion/shapes",
  "@remotion/noise",
  "@remotion/motion-blur",
  "@remotion/layout-utils",
] as const;

// The same module reached by many spellings: a branded scene says "../../theme",
// a generated one says "@/lib/brand", the snippet library says "./theme".
const THEME_PATTERNS = [
  "../remotion/theme", "./theme", "@/remotion/theme", "remotion/theme", "../theme",
  // AI-generated scenes follow the system prompt and import BRAND from
  // "@/lib/brand". Resolve those to the same theme module the snippets use.
  "@/lib/brand", "lib/brand", "../lib/brand", "../../lib/brand",
];
const MOTION_PATTERNS = [
  "../remotion/motion", "./motion", "@/remotion/motion", "remotion/motion", "../motion", "../../motion",
];
const DECOR_PATTERNS = [
  "../remotion/decor", "./decor", "@/remotion/decor", "remotion/decor", "../decor", "../../decor",
];
const TRANSITIONS_PATTERNS = [
  "../remotion/transitions", "./transitions", "@/remotion/transitions", "remotion/transitions",
  "../transitions", "../../transitions",
];

/**
 * The `require` a scene module is evaluated against.
 *
 * `locals` lets a caller that CAN render — the client preview — supply the real
 * motion/decor/transitions modules. Omitted, they resolve to inert stubs, which
 * is all that reading a declared length requires.
 */
export function resolveModule(moduleName: string, locals: SceneModules = {}): unknown {
  if (moduleName === "react") return React;
  const pkg = locals.packages?.[moduleName];
  if (pkg) return pkg;
  if ((KNOWN_PACKAGES as readonly string[]).includes(moduleName)) return inertModule();

  const matches = (patterns: string[]) =>
    patterns.some((p) => moduleName.endsWith(p) || moduleName === p);

  if (matches(THEME_PATTERNS)) return THEME_MODULE;
  if (matches(MOTION_PATTERNS)) return locals.motion ?? inertModule();
  if (matches(DECOR_PATTERNS)) return locals.decor ?? inertModule();
  if (matches(TRANSITIONS_PATTERNS)) return locals.transitions ?? inertModule();

  for (const key of KNOWN_PACKAGES) {
    if (moduleName.startsWith(key + "/")) return locals.packages?.[key] ?? inertModule();
  }

  // Unknown module — return empty silently, as the preview always has.
  return {};
}

export function looksLikeCode(code: string): boolean {
  const trimmed = code.trim();
  if (trimmed.length < 20) return false;
  return /(?:import |export |function |const |=>)/.test(trimmed);
}

/**
 * Run a scene module's body and hand back its exports. The component is NOT
 * rendered — only module scope runs.
 */
export function evalSceneModule(
  code: string,
  req: (name: string) => unknown = resolveModule,
): Record<string, unknown> | null {
  if (!code || !code.trim() || !looksLikeCode(code)) return null;
  const transformed = transform(code, {
    transforms: ["typescript", "jsx", "imports"],
    jsxRuntime: "classic",
    production: true,
  }).code;

  const exports: Record<string, unknown> = {};
  const mod = { exports };
  const fn = new Function("require", "module", "exports", "React", transformed);
  fn(req, mod, exports, React);
  return mod.exports as Record<string, unknown>;
}

export interface SceneMeta {
  durationInFrames: number;
  fps: number;
  /**
   * Canvas shapes this scene is authored for. Absent in the source means all
   * three, so every scene that predates the short-form kit is unaffected.
   *
   * This lives on the scene rather than in a lookup table deliberately. The
   * table would be a fourth place the library is described — see the note at
   * the top of lib/snippet-catalog.ts about the three that already disagreed —
   * and it would disagree DANGEROUSLY: a scene pixel-authored against a
   * 1080x1920 plane whose table row says "any" gets offered for a 1920x1080
   * project and renders broken. The export also survives renderSnippet(), so a
   * scene stored in project.json still declares what it is.
   */
  orientations: Orientation[];
  /** Frame at which everything has settled; what the Figma harness diffs. */
  holdFrame?: number;
}

const ALL_ORIENTATIONS: Orientation[] = ["horizontal", "vertical", "square"];

function normaliseOrientations(v: unknown): Orientation[] | undefined {
  const one = (x: unknown): Orientation | null =>
    x === "horizontal" || x === "vertical" || x === "square" ? x : null;
  if (typeof v === "string") {
    if (v === "any") return ALL_ORIENTATIONS;
    const o = one(v);
    return o ? [o] : undefined;
  }
  if (Array.isArray(v)) {
    const out = v.map(one).filter((o): o is Orientation => o !== null);
    return out.length ? out : undefined;
  }
  return undefined;
}

/** Regex fallback for code that won't evaluate — matches a literal only. */
function metaByRegex(code: string): Partial<SceneMeta> {
  const dur = code.match(/export\s+const\s+durationInFrames\s*=\s*(\d+)/);
  const f = code.match(/export\s+const\s+fps\s*=\s*(\d+)/);
  const hold = code.match(/export\s+const\s+holdFrame\s*=\s*(\d+)/);
  const orient = code.match(/export\s+const\s+orientation\s*(?::[^=]+)?=\s*(\[[^\]]*\]|"[a-z]+"|'[a-z]+')/);
  let orientations: Orientation[] | undefined;
  if (orient) {
    const raw = orient[1].replace(/'/g, '"');
    try {
      orientations = normaliseOrientations(raw.startsWith("[") ? JSON.parse(raw) : JSON.parse(raw));
    } catch {
      orientations = undefined;
    }
  }
  return {
    durationInFrames: dur ? parseInt(dur[1], 10) : undefined,
    fps: f ? parseInt(f[1], 10) : undefined,
    holdFrame: hold ? parseInt(hold[1], 10) : undefined,
    orientations,
  };
}

/**
 * How long a scene runs and at what rate, read from the module itself.
 *
 * Evaluating rather than pattern-matching is the whole point: three library
 * scenes compute their length (`AiChat` from a flag, `PromptBox` from typing +
 * hold seconds, `Years` from two constants), and those constants are exposed as
 * snippet PARAMETERS — so any static table or regex is wrong the moment a value
 * is changed. A regex is kept only as the fallback for code that throws.
 */
export function sceneMeta(code: string, fallbackFps = 30): SceneMeta {
  let evaluated: Record<string, unknown> | null = null;
  try {
    evaluated = evalSceneModule(code);
  } catch {
    evaluated = null;
  }
  const regex = metaByRegex(code);

  const num = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : undefined;

  return {
    durationInFrames:
      num(evaluated?.durationInFrames) ?? num(regex.durationInFrames) ?? 250,
    fps: num(evaluated?.fps) ?? num(regex.fps) ?? fallbackFps,
    // Absent => every orientation, so the 29 scenes that predate this are
    // untouched and there is no table to backfill.
    orientations:
      normaliseOrientations(evaluated?.orientation) ?? regex.orientations ?? ALL_ORIENTATIONS,
    holdFrame: num(evaluated?.holdFrame) ?? regex.holdFrame,
  };
}

/**
 * How many frames a scene occupies on a timeline running at `docFps`.
 *
 * The library mixes 25fps and 30fps scenes and a document can be 24/25/30/50.
 * Inside EditorComposition the embedded scene is driven by the DOCUMENT's fps,
 * so a 25fps scene dropped into a 30fps document needs 20% more frames to play
 * to its end — without this it is cut short.
 */
export function sceneFramesAtFps(
  meta: Pick<SceneMeta, "durationInFrames" | "fps">,
  docFps: number,
): number {
  if (!meta.fps || !Number.isFinite(meta.fps)) return meta.durationInFrames;
  return Math.max(1, Math.round((meta.durationInFrames / meta.fps) * docFps));
}
