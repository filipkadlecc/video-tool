// Mark — the rejection cross that, in the payoff, retracts and becomes a check.
//
// `xProgress`  0..1 : how much of the red X is drawn on. The caller drives this
//   to 0 (retract) in the payoff while raising `checkProgress`, so the same mark
//   that condemned the card redeems it.
// `checkProgress` 0..1 : how much of the teal check is drawn on.
import React from "react";
import { interpolate } from "remotion";
import { C } from "./constants";

const X1_LEN = 70.71; // (25,25)->(75,75)
const X2_LEN = 70.71; // (75,25)->(25,75)
const CHK_LEN = 70.0; // (24,52)->(44,70)->(76,30)

export const Mark: React.FC<{
  size: number;
  xProgress: number;
  checkProgress?: number;
  /** per-stroke draw skew so stroke 2 trails stroke 1 a touch */
  stroke2Lag?: number;
  /** subtle scale overshoot of the whole mark (1 = none) */
  punch?: number;
}> = ({ size, xProgress, checkProgress = 0, stroke2Lag = 0, punch = 1 }) => {
  const xVis = Math.max(0, Math.min(1, xProgress));
  const x1 = xVis;
  const x2 = Math.max(0, (xVis - stroke2Lag) / (1 - stroke2Lag || 1));
  const chk = Math.max(0, Math.min(1, checkProgress));

  const strokeW = size * 0.018;
  const xColor = C.red;
  const xGlow = xVis > 0.02 ? `drop-shadow(0 0 ${size * 0.05}px rgba(229,72,77,0.45))` : "none";
  const chkColor = C.teal;
  const chkGlow = chk > 0.02 ? `drop-shadow(0 0 ${size * 0.06}px rgba(126,224,196,0.55))` : "none";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ overflow: "visible", transform: `scale(${punch})` }}
    >
      {/* Red X — two diagonal strokes */}
      <g style={{ filter: xGlow, opacity: xVis > 0.001 ? 1 : 0 }}>
        <line
          x1={25} y1={25} x2={75} y2={75}
          stroke={xColor} strokeWidth={strokeW} strokeLinecap="round"
          strokeDasharray={X1_LEN}
          strokeDashoffset={interpolate(x1, [0, 1], [X1_LEN, 0])}
        />
        <line
          x1={75} y1={25} x2={25} y2={75}
          stroke={xColor} strokeWidth={strokeW} strokeLinecap="round"
          strokeDasharray={X2_LEN}
          strokeDashoffset={interpolate(x2, [0, 1], [X2_LEN, 0])}
        />
      </g>

      {/* Teal check — drawn as one polyline in the payoff */}
      <polyline
        points="24,52 44,70 76,30"
        fill="none"
        stroke={chkColor}
        strokeWidth={strokeW}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={CHK_LEN}
        strokeDashoffset={interpolate(chk, [0, 1], [CHK_LEN, 0])}
        style={{ filter: chkGlow, opacity: chk > 0.001 ? 1 : 0 }}
      />
    </svg>
  );
};
