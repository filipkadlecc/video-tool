import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

// ============================================================================
// "AI running" — OUTRO. Starts exactly on the loop's first frame, then the line
// draws itself off: the arc retracts to nothing while still spinning. Cut into
// this straight from ApifyAIMinimal. Pure geometry, no fades.
// ============================================================================

export const fps = 25;
const DUR = 22; // ~0.9s draw-off
export const durationInFrames = DUR;

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

  // must match ApifyAIMinimal (the loop) so the cut is seamless
  const R = base * 0.16;
  const W0 = base * 0.011;
  const spanFull = (200 * Math.PI) / 180;
  const omega = (TAU * 2) / 100; // loop spins 2 turns per 100 frames

  const p = clamp(frame / DUR, 0, 1);
  const L = spanFull * (1 - smooth(p)); // arc length shrinks full → 0
  const head = -Math.PI / 2 + omega * frame; // starts at loop frame 0, keeps spinning

  const N = 90;
  const outer: string[] = [];
  const inner: string[] = [];
  for (let i = 0; i < N; i++) {
    const f = i / (N - 1);
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
  const capR = W0 * Math.min(1, L / (spanFull * 0.18));

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
