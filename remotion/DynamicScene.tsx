"use client";

import React, { useMemo } from "react";
import * as RemotionLib from "remotion";
import * as RemotionTransitions from "@remotion/transitions";
import * as RemotionFade from "@remotion/transitions/fade";
import * as RemotionSlide from "@remotion/transitions/slide";
import * as RemotionWipe from "@remotion/transitions/wipe";
import * as RemotionFlip from "@remotion/transitions/flip";
import * as RemotionClockWipe from "@remotion/transitions/clock-wipe";
import * as RemotionIris from "@remotion/transitions/iris";
import * as RemotionAnimationUtils from "@remotion/animation-utils";
import * as RemotionPaths from "@remotion/paths";
import * as RemotionShapes from "@remotion/shapes";
import * as RemotionNoise from "@remotion/noise";
import * as RemotionMotionBlur from "@remotion/motion-blur";
import * as RemotionLayoutUtils from "@remotion/layout-utils";
import { transform } from "sucrase";
import { BRAND, BRAND_FONT_FACE_CSS } from "./theme";
import * as Motion from "./motion";
import * as Decor from "./decor";
import * as Transitions from "./transitions";
import { SvgFramesProvider, type SvgFrameSlot } from "./motion";
import type { MediaCapture } from "@/lib/timeline-extract";

const { AbsoluteFill } = RemotionLib;

/**
 * Build a remotion module whose media leaves (OffthreadVideo/Video/Audio/Img)
 * report the sequence they render inside + their src/trim, without changing what
 * they render. Used only by the hidden timeline extractor (not the live preview),
 * so recording during render is acceptable — callers dedupe.
 */
function makeInstrumentedRemotion(onMedia: (m: MediaCapture) => void): typeof RemotionLib {
  const Internals = RemotionLib.Internals;
  const wrap = (Comp: React.ComponentType<Record<string, unknown>>, kind: MediaCapture["kind"]) => {
    const Wrapped: React.FC<Record<string, unknown>> = (props) => {
      const seq = React.useContext(Internals.SequenceContext) as { id?: string } | null;
      onMedia({
        enclosingId: seq?.id ?? null,
        kind,
        src: props.src as string | undefined,
        startFrom: (props.startFrom ?? props.trimBefore) as number | undefined,
        endAt: (props.endAt ?? props.trimAfter) as number | undefined,
      });
      return React.createElement(Comp, props);
    };
    return Wrapped;
  };
  const C = (x: unknown) => x as React.ComponentType<Record<string, unknown>>;
  return {
    ...RemotionLib,
    OffthreadVideo: wrap(C(RemotionLib.OffthreadVideo), "video"),
    Video: wrap(C(RemotionLib.Video), "video"),
    Audio: wrap(C(RemotionLib.Audio), "audio"),
    Img: wrap(C(RemotionLib.Img), "image"),
  } as unknown as typeof RemotionLib;
}

const THEME_MODULE = { BRAND, BRAND_FONT_FACE_CSS };

const MODULE_MAP: Record<string, unknown> = {
  remotion: RemotionLib,
  react: React,
  "@remotion/transitions": RemotionTransitions,
  "@remotion/transitions/fade": RemotionFade,
  "@remotion/transitions/slide": RemotionSlide,
  "@remotion/transitions/wipe": RemotionWipe,
  "@remotion/transitions/flip": RemotionFlip,
  "@remotion/transitions/clock-wipe": RemotionClockWipe,
  "@remotion/transitions/iris": RemotionIris,
  "@remotion/animation-utils": RemotionAnimationUtils,
  "@remotion/paths": RemotionPaths,
  "@remotion/shapes": RemotionShapes,
  "@remotion/noise": RemotionNoise,
  "@remotion/motion-blur": RemotionMotionBlur,
  "@remotion/layout-utils": RemotionLayoutUtils,
};

const THEME_PATTERNS = [
  "../remotion/theme",
  "./theme",
  "@/remotion/theme",
  "remotion/theme",
  "../theme",
  // AI-generated scenes follow the system prompt and import BRAND from
  // "@/lib/brand". Resolve those to the same theme module the snippets use.
  "@/lib/brand",
  "lib/brand",
  "../lib/brand",
  "../../lib/brand",
];

const MOTION_PATTERNS = [
  "../remotion/motion",
  "./motion",
  "@/remotion/motion",
  "remotion/motion",
  "../motion",
  "../../motion",
];

const DECOR_PATTERNS = [
  "../remotion/decor",
  "./decor",
  "@/remotion/decor",
  "remotion/decor",
  "../decor",
  "../../decor",
];

const TRANSITIONS_PATTERNS = [
  "../remotion/transitions",
  "./transitions",
  "@/remotion/transitions",
  "remotion/transitions",
  "../transitions",
  "../../transitions",
];

function fakeRequire(moduleName: string) {
  const mod = MODULE_MAP[moduleName];
  if (mod) return mod;

  if (THEME_PATTERNS.some((p) => moduleName.endsWith(p) || moduleName === p)) {
    return THEME_MODULE;
  }

  if (MOTION_PATTERNS.some((p) => moduleName.endsWith(p) || moduleName === p)) {
    return Motion;
  }

  if (DECOR_PATTERNS.some((p) => moduleName.endsWith(p) || moduleName === p)) {
    return Decor;
  }

  if (TRANSITIONS_PATTERNS.some((p) => moduleName.endsWith(p) || moduleName === p)) {
    return Transitions;
  }

  for (const key of Object.keys(MODULE_MAP)) {
    if (moduleName.startsWith(key + "/")) return MODULE_MAP[key];
  }

  // Unknown module — return empty silently
  return {};
}

function looksLikeCode(code: string): boolean {
  const trimmed = code.trim();
  if (trimmed.length < 20) return false;
  return /(?:import |export |function |const |=>)/.test(trimmed);
}

export interface EvalResult {
  component: React.ComponentType<Record<string, unknown>>;
  durationInFrames: number;
  fps: number;
  error?: string;
}

function makeErrorComponent(msg: string): React.ComponentType<Record<string, unknown>> {
  const ErrorComponent: React.FC<Record<string, unknown>> = () =>
    React.createElement(
      AbsoluteFill,
      {
        style: {
          backgroundColor: "#040D12",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 80,
          fontFamily: "sans-serif",
        },
      },
      React.createElement(
        "div",
        { style: { textAlign: "center", maxWidth: "80%" } },
        React.createElement("div", { style: { color: "#f87171", fontSize: 48, marginBottom: 20 } }, "Scene Error"),
        React.createElement("div", { style: { color: "#93B1A6", fontSize: 28, wordBreak: "break-word" } }, msg)
      )
    );
  return ErrorComponent;
}

export function evalSceneCode(
  code: string,
  opts?: { onMedia?: (m: MediaCapture) => void },
): EvalResult | null {
  if (!code || !code.trim() || !looksLikeCode(code)) return null;

  try {
    const transformed = transform(code, {
      transforms: ["typescript", "jsx", "imports"],
      jsxRuntime: "classic",
      production: true,
    }).code;

    const exports: Record<string, unknown> = {};
    const mod = { exports };

    // The extractor passes onMedia to instrument media leaves; the live preview
    // does not, so it uses the real remotion module untouched.
    const instrumented = opts?.onMedia ? makeInstrumentedRemotion(opts.onMedia) : null;
    const req = instrumented ? (name: string) => (name === "remotion" ? instrumented : fakeRequire(name)) : fakeRequire;

    const fn = new Function(
      "require",
      "module",
      "exports",
      "React",
      transformed
    );
    fn(req, mod, exports, React);

    const result = mod.exports as Record<string, unknown>;

    // Find component
    let component: React.ComponentType<Record<string, unknown>> | null = null;
    if (result.default && typeof result.default === "function") {
      component = result.default as React.ComponentType<Record<string, unknown>>;
    } else {
      for (const key of Object.keys(result)) {
        if (typeof result[key] === "function" && key !== "default") {
          component = result[key] as React.ComponentType<Record<string, unknown>>;
          break;
        }
      }
    }

    if (!component) {
      // No component found — error shown in preview UI
      return {
        component: makeErrorComponent("No component found — make sure the code has a default export"),
        durationInFrames: 250,
        fps: 25,
        error: "No component export found",
      };
    }

    // Wrap in a safe component that catches render errors
    const Inner = component;
    const SafeComponent: React.FC<Record<string, unknown>> = () => {
      try {
        return React.createElement(Inner);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Render error";
        return React.createElement(makeErrorComponent(msg));
      }
    };

    const durationInFrames =
      typeof result.durationInFrames === "number" ? result.durationInFrames : 250;
    const fps = typeof result.fps === "number" ? result.fps : 25;

    return { component: SafeComponent, durationInFrames, fps };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown eval error";
    // Silenced — errors are shown in the preview UI via makeErrorComponent
    return {
      component: makeErrorComponent(msg),
      durationInFrames: 250,
      fps: 25,
      error: msg,
    };
  }
}

export const DynamicScene: React.FC<{ code?: string; svgContents?: SvgFrameSlot[] }> = ({ code, svgContents }) => {
  const Component = useMemo(() => {
    if (!code) return null;
    const result = evalSceneCode(code);
    return result?.component || null;
  }, [code]);

  if (!Component) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: "#040D12",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#93B1A6",
          fontSize: 48,
          fontFamily: "sans-serif",
        }}
      >
        No scene loaded
      </AbsoluteFill>
    );
  }

  return (
    <SvgFramesProvider value={svgContents ?? []}>
      <Component />
    </SvgFramesProvider>
  );
};
