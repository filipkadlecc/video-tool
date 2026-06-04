import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BRAND } from "../../theme";
import { springIn, drawPath, ambientDrift, inOutEnvelope } from "../../motion";

export const fps = 25;
export const durationInFrames = 200;

const ACCENT = BRAND.colors.orange;
const VB = { w: 1198, h: 766 };

type Preset = "SNAPPY" | "LIQUID" | "GENTLE" | "ELASTIC" | "OVERDAMPED";

type Elem = {
  id: string;
  d: string;
  pathLength: number;
  sw: number;
  color: string;
  // Static stroke-dasharray that stays in place the entire animation; the
  // reveal is driven by a same-shape mask, not by mutating this value.
  dash: string | null;
  delay: number;
  preset: Preset;
};

const PHASE_1: Elem[] = [
  { id: "left-axis",   d: "M 202 383 L 0 383",                                                   pathLength: 202,  sw: 1.3, color: ACCENT, dash: "6 6",       delay: 15, preset: "LIQUID" },
  { id: "right-axis",  d: "M 1000 383 L 1198 383",                                               pathLength: 198,  sw: 1.3, color: ACCENT, dash: "6 6",       delay: 20, preset: "LIQUID" },
  { id: "left-cross",  d: "M 188 383 L 201.992 383 M 201.992 369 L 201.992 397",                 pathLength: 42,   sw: 3,   color: ACCENT, dash: null,        delay: 25, preset: "SNAPPY" },
  { id: "right-cross", d: "M 1009.99 383 L 996 383 M 996 397 L 996 369",                         pathLength: 42,   sw: 3,   color: ACCENT, dash: null,        delay: 30, preset: "SNAPPY" },
  { id: "center-rect", d: "M 202 262 H 996 V 504 H 202 Z",                                       pathLength: 2072, sw: 1.3, color: ACCENT, dash: "6 6",       delay: 35, preset: "LIQUID" },
];

const PHASE_2: Elem[] = [
  { id: "top-axis",     d: "M 599 258 L 599 0",                                                  pathLength: 258,  sw: 1.3, color: ACCENT, dash: "6 6",       delay: 66,  preset: "LIQUID" },
  { id: "bottom-axis",  d: "M 599 504 L 599 766",                                                pathLength: 262,  sw: 1.3, color: ACCENT, dash: "6 6",       delay: 73,  preset: "LIQUID" },
  { id: "top-cross",    d: "M 599 248 L 599 262 M 585 262 L 613 262",                            pathLength: 42,   sw: 3,   color: ACCENT, dash: null,        delay: 80,  preset: "SNAPPY" },
  { id: "bottom-cross", d: "M 599 518 L 599 504 M 585 504 L 613 504",                            pathLength: 42,   sw: 3,   color: ACCENT, dash: null,        delay: 87,  preset: "SNAPPY" },
  { id: "middle-rect",  d: "M 99 181 H 1099 V 585 H 99 Z",                                       pathLength: 2808, sw: 1.3, color: ACCENT, dash: "7.71 7.71", delay: 94,  preset: "LIQUID" },
  { id: "outer-rect",   d: "M -102 99 H 1300 V 667 H -102 Z",                                    pathLength: 3940, sw: 1.3, color: ACCENT, dash: "7.71 7.71", delay: 101, preset: "LIQUID" },
];

const ALL_ELEMS: Elem[] = [...PHASE_1, ...PHASE_2];

export default function SvgGuideReveal() {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();

  const envelope = inOutEnvelope(frame, vfps, durationInFrames, {
    inDelay: 0,
    inPreset: "GENTLE",
    exitFrames: 12,
  });

  const containerScale = springIn(frame, vfps, 6, "SNAPPY");
  const driftX = ambientDrift(frame, 1.5, 110, "card-x");
  const driftY = ambientDrift(frame, 1.5, 130, "card-y");

  const margin = 0.08;
  const maxW = width * (1 - 2 * margin);
  const maxH = height * (1 - 2 * margin);
  const aspect = VB.w / VB.h;
  let cardW = maxW;
  let cardH = cardW / aspect;
  if (cardH > maxH) {
    cardH = maxH;
    cardW = cardH * aspect;
  }

  const draws = ALL_ELEMS.map((el) => ({
    el,
    draw: drawPath(frame, vfps, el.pathLength, { delay: el.delay, preset: el.preset }),
  }));

  return (
    <AbsoluteFill style={{ background: BRAND.colors.bg, opacity: envelope }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: cardW,
            height: cardH,
            transform: `translate(${driftX}px, ${driftY}px) scale(${containerScale})`,
            transformOrigin: "center center",
          }}
        >
          <svg
            viewBox={`0 0 ${VB.w} ${VB.h}`}
            width="100%"
            height="100%"
            preserveAspectRatio="xMidYMid meet"
            style={{ overflow: "hidden" }}
          >
            <defs>
              {draws.map(({ el, draw }) => (
                <mask
                  key={el.id}
                  id={`reveal-${el.id}`}
                  maskUnits="userSpaceOnUse"
                  x={-500}
                  y={-500}
                  width={2500}
                  height={1500}
                >
                  <path
                    d={el.d}
                    stroke="white"
                    strokeWidth={el.sw * 4}
                    fill="none"
                    strokeDasharray={draw.strokeDasharray}
                    strokeDashoffset={draw.strokeDashoffset}
                  />
                </mask>
              ))}
            </defs>
            {draws.map(({ el, draw }) => (
              <path
                key={el.id}
                d={el.d}
                stroke={el.color}
                strokeWidth={el.sw}
                strokeDasharray={el.dash ?? undefined}
                fill="none"
                mask={`url(#reveal-${el.id})`}
                opacity={draw.opacity}
              />
            ))}
          </svg>
        </div>
      </div>
    </AbsoluteFill>
  );
}
