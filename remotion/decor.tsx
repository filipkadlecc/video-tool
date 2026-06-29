// Shared VISUAL primitives for branded snippets and LLM-generated scenes.
//
// Companion to remotion/motion.ts (which owns *motion* — springs, timing,
// ambient drift). This module owns *decorative line-art* lifted from the
// Apify "INSPO 2" marketing board: topographic contour fields, registration
// crop-mark framing, isometric wireframe geometry, dotted halftone, and tag
// pills. Everything here is ORANGE-ONLY, low-opacity line work — it never
// competes with the headline (the headline is always the hero).
//
// All snippets in remotion/scenes/branded/ may import from here, and the LLM
// is instructed (lib/prompts/apify-layout.ts + snippet-examples.ts) to import
// from here too. The DynamicScene.tsx Sucrase shim resolves "remotion/decor"
// + a few path variants to this module (mirrors how it resolves ../motion).
//
// These are DECORATION. Keep total decoration to a small fraction of the
// frame, and keep opacity low so the contour/halftone reads as texture.

import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND } from "./theme";
import { springIn, drawPath, ambientDrift, TIMING } from "./motion";

const ORANGE = BRAND.colors.orange;

// =============================================================================
// <DottedField> — low-opacity orange dot-grid halftone.
// =============================================================================
// The "subtle dotted texture" the layout grammar already calls for, packaged
// as a reusable SVG <pattern>. Defaults to a band at the bottom of the frame;
// pass `style` to place it anywhere (it also fills isometric wireframe faces).

export interface DottedFieldProps {
  /** 0–1 overall opacity. Keep faint. */
  opacity?: number;
  /** dot radius in px */
  dotR?: number;
  /** spacing between dot centers in px */
  gap?: number;
  /** override placement / size (defaults to a bottom band) */
  style?: React.CSSProperties;
}

export const DottedField: React.FC<DottedFieldProps> = ({
  opacity = 0.16,
  dotR = 2,
  gap = 24,
  style,
}) => {
  // Unique, CSS-url()-safe pattern id per instance so fields don't collide.
  const id = `dots-${React.useId().replace(/:/g, "")}`;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: "16%",
        pointerEvents: "none",
        opacity,
        ...style,
      }}
    >
      <svg width="100%" height="100%" style={{ display: "block" }}>
        <defs>
          <pattern id={id} width={gap} height={gap} patternUnits="userSpaceOnUse">
            <circle cx={gap / 2} cy={gap / 2} r={dotR} fill={ORANGE} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id})`} />
      </svg>
    </div>
  );
};

// =============================================================================
// <ContourField> — topographic concentric contour line-art.
// =============================================================================
// The Rooftop-Afterparty motif: a few nested, tilted orange contour ellipses
// that draw on from the center out and breathe with ambient drift. A faint
// BACKGROUND layer — sits behind content, never on top of the headline.

export interface ContourFieldProps {
  /** where the contour clusters */
  position?: "bottom" | "center" | "topRight" | "bottomLeft";
  /** number of nested rings */
  lines?: number;
  /** 0–1 overall opacity */
  opacity?: number;
  /** frames to wait before the rings start drawing on */
  delay?: number;
}

export const ContourField: React.FC<ContourFieldProps> = ({
  position = "bottom",
  lines = 4,
  opacity = 0.5,
  delay = TIMING.entrance,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const base = Math.min(width, height);

  // Anchor point for the ring cluster (in px on the canvas).
  const anchors: Record<string, { cx: number; cy: number }> = {
    bottom: { cx: width * 0.5, cy: height * 0.82 },
    center: { cx: width * 0.5, cy: height * 0.5 },
    topRight: { cx: width * 0.82, cy: height * 0.2 },
    bottomLeft: { cx: width * 0.2, cy: height * 0.82 },
  };
  const { cx, cy } = anchors[position] ?? anchors.bottom;

  // Outermost ring radius; inner rings step down from it.
  const rxOuter = base * 0.46;
  const ryOuter = base * 0.22;

  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity }}>
      <svg width={width} height={height} style={{ display: "block" }}>
        {Array.from({ length: lines }).map((_, i) => {
          const t = (i + 1) / lines; // 0→1 outermost..adjust
          const rx = rxOuter * t;
          const ry = ryOuter * t;
          // Approximate ellipse perimeter for the stroke draw-on length.
          const perimeter = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
          const draw = drawPath(frame, fps, perimeter, {
            delay: delay + (lines - 1 - i) * 6, // outer rings draw first
            preset: "LIQUID",
          });
          const wobble = ambientDrift(frame, base * 0.004, 130, `contour-${i}`);
          return (
            <ellipse
              key={i}
              cx={cx}
              cy={cy + wobble}
              rx={rx}
              ry={ry}
              fill="none"
              stroke={ORANGE}
              strokeWidth={Math.max(1, base * 0.0016)}
              transform={`rotate(-8 ${cx} ${cy})`}
              {...draw}
            />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

// =============================================================================
// <RegistrationFrame> — corner "+" crop marks + dashed margin guides.
// =============================================================================
// The blueprint/editorial signature across the board: thin orange crosshair
// marks at the inner-margin corners with a dashed alignment rectangle. An
// OPT-IN overlay laid on top of a scene. Marks pop in (SNAPPY) then drift ≤2px.

export interface RegistrationFrameProps {
  /** inner margin as a % of the smaller canvas edge */
  inset?: number;
  /** draw the dashed alignment rectangle between the marks */
  showGuides?: boolean;
  /** 0–1 overall opacity */
  opacity?: number;
  /** frames before the marks appear */
  delay?: number;
}

export const RegistrationFrame: React.FC<RegistrationFrameProps> = ({
  inset = 6,
  showGuides = true,
  opacity = 0.8,
  delay = TIMING.entrance,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const base = Math.min(width, height);

  const mx = (inset / 100) * base; // margin in px
  const stroke = Math.max(1, base * 0.0014);
  const arm = base * 0.018; // half-length of each crosshair arm

  const corners = [
    { x: mx, y: mx },
    { x: width - mx, y: mx },
    { x: mx, y: height - mx },
    { x: width - mx, y: height - mx },
  ];

  const guideIn = springIn(frame, fps, delay, "LIQUID");
  const drift = ambientDrift(frame, 1.5, 150, "regframe");

  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity }}>
      <svg width={width} height={height} style={{ display: "block" }}>
        {showGuides && (
          <rect
            x={mx}
            y={mx}
            width={width - mx * 2}
            height={height - mx * 2}
            fill="none"
            stroke={ORANGE}
            strokeOpacity={0.35}
            strokeWidth={stroke}
            strokeDasharray={`${base * 0.012} ${base * 0.012}`}
            opacity={guideIn}
          />
        )}
        {corners.map((c, i) => {
          const pop = springIn(frame, fps, delay + i * 3, "SNAPPY");
          return (
            <g
              key={i}
              opacity={pop}
              transform={`translate(${drift} ${drift})`}
              stroke={ORANGE}
              strokeWidth={stroke}
            >
              <line x1={c.x - arm} y1={c.y} x2={c.x + arm} y2={c.y} />
              <line x1={c.x} y1={c.y - arm} x2={c.x} y2={c.y + arm} />
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

// =============================================================================
// <IsoWireframe> — isometric orange wireframe geometry ("cute visual pieces").
// =============================================================================
// The decorative iso primitives from the board: an extruded cube, a flat slab
// with an ellipse cut, and a tetrahedron — orange edges that draw on, with one
// face optionally filled with the dotted halftone. Decorative CORNER hero art;
// position/size it with `style` (like <SvgFrame>).

export type IsoShape = "cube" | "slab" | "tetra";

export interface IsoWireframeProps {
  shape?: IsoShape;
  /** edge size in px (the svg is square at this size) */
  size?: number;
  /** fill one face with the dotted halftone */
  filled?: boolean;
  /** 0–1 overall opacity */
  opacity?: number;
  /** frames before the edges draw on */
  delay?: number;
  /** placement (position:absolute recommended) */
  style?: React.CSSProperties;
}

// Polygon edge sets per shape, in a 0..100 viewBox. `faces` lists polygons to
// fill with the dotted halftone when `filled`.
const ISO_GEOMETRY: Record<
  IsoShape,
  { edges: [number, number, number, number][]; faces: string[] }
> = {
  // Classic 3-face iso cube (hexagon outline + 3 spokes to the center vertex).
  cube: {
    edges: [
      [50, 8, 92, 32], [92, 32, 92, 68], [92, 68, 50, 92],
      [50, 92, 8, 68], [8, 68, 8, 32], [8, 32, 50, 8],
      [50, 50, 50, 8], [50, 50, 92, 68], [50, 50, 8, 68],
    ],
    faces: ["50,50 92,68 50,92 8,68"], // front-bottom rhombus
  },
  // Flat extruded slab (top rhombus + two side quads); ellipse cut sits on top.
  slab: {
    edges: [
      [50, 20, 88, 42], [88, 42, 50, 64], [50, 64, 12, 42], [12, 42, 50, 20],
      [12, 42, 12, 60], [12, 60, 50, 82], [50, 82, 50, 64],
      [50, 82, 88, 60], [88, 60, 88, 42],
    ],
    faces: ["12,42 50,64 50,82 12,60", "50,64 88,42 88,60 50,82"],
  },
  // Tetrahedron — base triangle + apex spokes; one face dotted.
  tetra: {
    edges: [
      [12, 78, 78, 90], [78, 90, 60, 30], [60, 30, 12, 78],
      [12, 78, 60, 30],
    ],
    faces: ["12,78 78,90 60,30"],
  },
};

export const IsoWireframe: React.FC<IsoWireframeProps> = ({
  shape = "cube",
  size = 220,
  filled = true,
  opacity = 0.9,
  delay = TIMING.entrance,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const id = `iso-dots-${React.useId().replace(/:/g, "")}`;
  const geo = ISO_GEOMETRY[shape] ?? ISO_GEOMETRY.cube;
  const float = ambientDrift(frame, 4, 120, `iso-${shape}`);

  return (
    <div
      style={{
        position: "absolute",
        width: size,
        height: size,
        pointerEvents: "none",
        opacity,
        transform: `translateY(${float}px)`,
        ...style,
      }}
    >
      <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ display: "block", overflow: "visible" }}>
        <defs>
          <pattern id={id} width="5" height="5" patternUnits="userSpaceOnUse">
            <circle cx="2.5" cy="2.5" r="0.9" fill={ORANGE} />
          </pattern>
        </defs>

        {filled &&
          geo.faces.map((pts, i) => (
            <polygon key={`f${i}`} points={pts} fill={`url(#${id})`} opacity={0.5} />
          ))}

        {/* Ellipse cut on top of the slab. */}
        {shape === "slab" && (
          <ellipse cx="50" cy="42" rx="20" ry="11" fill="none" stroke={ORANGE} strokeWidth={1} />
        )}

        {geo.edges.map((e, i) => {
          const len = Math.hypot(e[2] - e[0], e[3] - e[1]);
          const draw = drawPath(frame, fps, len, { delay: delay + i * 2, preset: "LIQUID" });
          return (
            <line
              key={`e${i}`}
              x1={e[0]}
              y1={e[1]}
              x2={e[2]}
              y2={e[3]}
              stroke={ORANGE}
              strokeWidth={1.2}
              strokeLinecap="round"
              {...draw}
            />
          );
        })}
      </svg>
    </div>
  );
};

// =============================================================================
// <TagPill> — small outlined orange category pill ("Engineering", "GTM").
// =============================================================================
// Presentational leaf (no internal animation) so callers can stagger a row of
// them with staggerChild/staggeredSpring. Opaque card fill + 1px orange border
// + orange label — the opaque pill recipe from the color system.

export interface TagPillProps {
  label: string;
  /** label font size in px */
  fontSize?: number;
  style?: React.CSSProperties;
}

export const TagPill: React.FC<TagPillProps> = ({ label, fontSize = 22, style }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      background: BRAND.colors.card,
      border: `1px solid ${ORANGE}`,
      borderRadius: 6,
      padding: `${Math.round(fontSize * 0.28)}px ${Math.round(fontSize * 0.7)}px`,
      fontFamily: BRAND.fonts.primary,
      fontWeight: 500,
      fontSize,
      lineHeight: 1,
      color: ORANGE,
      letterSpacing: "0.01em",
      whiteSpace: "nowrap",
      ...style,
    }}
  >
    {label}
  </span>
);
