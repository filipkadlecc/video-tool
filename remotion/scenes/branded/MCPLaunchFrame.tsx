import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from "remotion";
import { BRAND } from "../../theme";

export const fps = 25;
export const durationInFrames = 84;

// Schematic frame — animated line-draw over the source MCP launch SVG.
// Outer rectangle (verticals + horizontals) traces corner-to-corner, then the
// two dashed inner guides reveal, then four "+" registration marks pop at the
// corners. Holds, then reverses in 23 frames.

const ORANGE = BRAND.colors.orange;
const STROKE_THIN = 3.20534;
const STROKE_PLUS = 9.61603;

const EASE = Easing.bezier(0.4, 0, 0.2, 1);

// Path lengths (matched to the source SVG so the clip rects cover the full
// bleed past the viewBox edges).
const VERT_LEN = 2455.38;
const HORIZ_LEN = 3861.36;
const DASH_LEN = 3411.87;

// Entry phase windows (within the 22-frame appear).
const ENTRY_VERT = [0, 7] as const;
const ENTRY_HORIZ = [7, 14] as const;
const ENTRY_DASH = [14, 22] as const;

// Exit phase windows (reverse order, scaled to fit 23 frames).
const EXIT_DASH = [61, 69] as const;
const EXIT_HORIZ = [69, 76] as const;
const EXIT_VERT = [76, 84] as const;

// "+" markers pop when their corner completes, fade just before that corner's
// dominant line starts retracting on exit.
const POP_V_CORNERS = 7;
const POP_H_CORNERS = 14;
const FADE_H_CORNERS = 66;
const FADE_V_CORNERS = 73;
const POP_DUR = 3;
const FADE_DUR = 3;

function reveal(
  frame: number,
  entry: readonly [number, number],
  exit: readonly [number, number],
  length: number,
): number {
  if (frame >= exit[0]) {
    return interpolate(frame, [exit[0], exit[1]], [length, 0], {
      easing: EASE,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }
  return interpolate(frame, [entry[0], entry[1]], [0, length], {
    easing: EASE,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

function plusVis(frame: number, popAt: number, fadeAt: number): number {
  if (frame >= fadeAt) {
    return interpolate(frame, [fadeAt, fadeAt + FADE_DUR], [1, 0], {
      easing: EASE,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }
  return interpolate(frame, [popAt, popAt + POP_DUR], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

export default function MCPLaunchFrame() {
  const frame = useCurrentFrame();

  const leftVertH = reveal(frame, ENTRY_VERT, EXIT_VERT, VERT_LEN);
  const rightVertH = reveal(frame, ENTRY_VERT, EXIT_VERT, VERT_LEN);
  const topHorizW = reveal(frame, ENTRY_HORIZ, EXIT_HORIZ, HORIZ_LEN);
  const bottomHorizW = reveal(frame, ENTRY_HORIZ, EXIT_HORIZ, HORIZ_LEN);
  const topDashW = reveal(frame, ENTRY_DASH, EXIT_DASH, DASH_LEN);
  const bottomDashW = reveal(frame, ENTRY_DASH, EXIT_DASH, DASH_LEN);

  const plusBL = plusVis(frame, POP_V_CORNERS, FADE_V_CORNERS);
  const plusTR = plusVis(frame, POP_V_CORNERS, FADE_V_CORNERS);
  const plusTL = plusVis(frame, POP_H_CORNERS, FADE_H_CORNERS);
  const plusBR = plusVis(frame, POP_H_CORNERS, FADE_H_CORNERS);

  return (
    <AbsoluteFill style={{ background: BRAND.colors.bg }}>
      <svg
        viewBox="0 0 3840 2160"
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <clipPath id="mcp-clip-left-vert">
            <rect x={212} y={0} width={6} height={leftVertH} />
          </clipPath>
          <clipPath id="mcp-clip-right-vert">
            <rect x={3626} y={VERT_LEN - rightVertH} width={6} height={rightVertH} />
          </clipPath>
          <clipPath id="mcp-clip-top-horiz">
            <rect x={3839.99 - topHorizW} y={180} width={topHorizW} height={6} />
          </clipPath>
          <clipPath id="mcp-clip-bottom-horiz">
            <rect x={-22} y={1972} width={bottomHorizW} height={6} />
          </clipPath>
          <clipPath id="mcp-clip-top-dash">
            <rect x={214.766} y={648} width={topDashW} height={6} />
          </clipPath>
          <clipPath id="mcp-clip-bottom-dash">
            <rect x={3626.64 - bottomDashW} y={1507} width={bottomDashW} height={6} />
          </clipPath>
        </defs>

        <path
          d="M214.758 0.0891113L214.758 2455.38"
          stroke={ORANGE}
          strokeWidth={STROKE_THIN}
          fill="none"
          clipPath="url(#mcp-clip-left-vert)"
        />
        <path
          d="M3628.45 0.0891113L3628.45 2455.38"
          stroke={ORANGE}
          strokeWidth={STROKE_THIN}
          fill="none"
          clipPath="url(#mcp-clip-right-vert)"
        />
        <path
          d="M-21.3613 182.704L3839.99 182.705"
          stroke={ORANGE}
          strokeWidth={STROKE_THIN}
          fill="none"
          clipPath="url(#mcp-clip-top-horiz)"
        />
        <path
          d="M-22 1974.85L3839.35 1974.85"
          stroke={ORANGE}
          strokeWidth={STROKE_THIN}
          fill="none"
          clipPath="url(#mcp-clip-bottom-horiz)"
        />

        <path
          d="M3626.64 650.13L214.766 650.13"
          stroke={ORANGE}
          strokeWidth={STROKE_THIN}
          strokeDasharray="20.5 20.5"
          fill="none"
          clipPath="url(#mcp-clip-top-dash)"
        />
        <path
          d="M3626.64 1509.16L214.766 1509.16"
          stroke={ORANGE}
          strokeWidth={STROKE_THIN}
          strokeDasharray="20.5 20.5"
          fill="none"
          clipPath="url(#mcp-clip-bottom-dash)"
        />

        <g
          opacity={plusTL}
          transform={`translate(215.749 183.696) scale(${plusTL}) translate(-215.749 -183.696)`}
        >
          <path
            d="M215.749 153.856V213.568M245.622 183.696L185.91 183.696"
            stroke={ORANGE}
            strokeWidth={STROKE_PLUS}
            fill="none"
          />
        </g>
        <g
          opacity={plusTR}
          transform={`translate(3629.44 183.696) scale(${plusTR}) translate(-3629.44 -183.696)`}
        >
          <path
            d="M3629.44 153.856V213.568M3659.31 183.696L3599.6 183.696"
            stroke={ORANGE}
            strokeWidth={STROKE_PLUS}
            fill="none"
          />
        </g>
        <g
          opacity={plusBL}
          transform={`translate(215.111 1975.84) scale(${plusBL}) translate(-215.111 -1975.84)`}
        >
          <path
            d="M215.111 1946V2005.71M244.983 1975.84L185.271 1975.84"
            stroke={ORANGE}
            strokeWidth={STROKE_PLUS}
            fill="none"
          />
        </g>
        <g
          opacity={plusBR}
          transform={`translate(3628.8 1975.84) scale(${plusBR}) translate(-3628.8 -1975.84)`}
        >
          <path
            d="M3628.8 1946V2005.71M3658.67 1975.84L3598.96 1975.84"
            stroke={ORANGE}
            strokeWidth={STROKE_PLUS}
            fill="none"
          />
        </g>
      </svg>
    </AbsoluteFill>
  );
}
