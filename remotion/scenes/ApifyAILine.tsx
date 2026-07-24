import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

// ============================================================================
// "AI running" — one continuous animation. The line grows on from nothing,
// spins for a while (the agent working), then draws itself off to nothing.
// One timeline, no cuts, no fades — pure geometry. Apify orange on dark,
// transparent-ready.
// ============================================================================

export const fps = 25;
const GROW = 22; // draw-on
const SPIN = 100; // steady spin (2 revolutions)
const SHRINK = 22; // draw-off
export const durationInFrames = GROW + SPIN + SHRINK; // 144 (~5.8s)

const C = { orange: "#F86606", hot: "#FFC08A", white: "#FFF4EA" };
const TAU = Math.PI * 2;
const smooth = (p: number) => p * p * (3 - 2 * p);
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

const Scene: React.FC = () => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const cx = W / 2;
  const cy = H / 2;
  const base = Math.min(W, H);

  const R = base * 0.16;
  const W0 = base * 0.011;
  const spanFull = (200 * Math.PI) / 180;
  const omega = (TAU * 2) / 100; // 2 turns per 100 frames

  // continuous head angle across all three phases
  const head = -Math.PI / 2 + omega * (frame - GROW);

  // arc length: grow → hold full → shrink
  let L: number;
  if (frame < GROW) {
    L = spanFull * smooth(clamp(frame / GROW, 0, 1));
  } else if (frame < GROW + SPIN) {
    L = spanFull;
  } else {
    L = spanFull * (1 - smooth(clamp((frame - GROW - SPIN) / SHRINK, 0, 1)));
  }

  const N = 90;
  const outer: string[] = [];
  const inner: string[] = [];
  for (let i = 0; i < N; i++) {
    const f = i / (N - 1); // 0 = head, 1 = tail
    const ang = head - f * L;
    const hw = W0 * Math.pow(1 - f, 0.6);
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    outer.push(`${cx + (R + hw) * ca},${cy + (R + hw) * sa}`);
    inner.push(`${cx + (R - hw) * ca},${cy + (R - hw) * sa}`);
  }
  const ribbon = `M ${outer.join(" L ")} L ${inner.slice().reverse().join(" L ")} Z`;
  const hx = cx + R * Math.cos(head);
  const hy = cy + R * Math.sin(head);
  const tx = cx + R * Math.cos(head - L);
  const ty = cy + R * Math.sin(head - L);
  const capR = W0 * Math.min(1, L / (spanFull * 0.18)); // vanishes at both ends

  return (
    <AbsoluteFill style={{ backgroundColor: "#161718" }}>
      <svg width={W} height={H} style={{ display: "block" }}>
        <defs>
          <linearGradient id="comet" gradientUnits="userSpaceOnUse" x1={hx} y1={hy} x2={tx} y2={ty}>
            <stop offset="0%" stopColor={C.white} />
            <stop offset="6%" stopColor={C.hot} />
            <stop offset="24%" stopColor={C.orange} />
            <stop offset="100%" stopColor="rgba(248,102,6,0)" />
          </linearGradient>
        </defs>
        {L > 0.001 && <path d={ribbon} fill="url(#comet)" shapeRendering="geometricPrecision" />}
        {capR > 0.001 && <circle cx={hx} cy={hy} r={capR} fill={C.white} />}
      </svg>
    </AbsoluteFill>
  );
};

export default Scene;
