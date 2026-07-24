import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

// ============================================================================
// "AI running" — minimal. Just a single smooth, tapered arc sweeping in a
// circle (comet head → vanishing tail). Nothing in the center. Text-free,
// Apify orange on dark, seamless loop, transparent-ready.
// ============================================================================

export const fps = 25;
const LOOP = 100; // 4s seamless loop
export const durationInFrames = LOOP;

const C = { bg: "#161718", orange: "#F86606", hot: "#FFC08A", white: "#FFF4EA" };
const TAU = Math.PI * 2;

const Scene: React.FC = () => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const cx = W / 2;
  const cy = H / 2;
  const base = Math.min(W, H);
  const t = (frame % LOOP) / LOOP;

  // one smooth tapered arc sweeping around the center (2 turns per loop)
  const R = base * 0.16; // arc radius
  const W0 = base * 0.011; // head half-thickness (tapers to 0 at the tail)
  const head = -Math.PI / 2 + t * TAU * 2;
  const span = (200 * Math.PI) / 180;
  const N = 90;

  // sample the outer and inner edges of the ribbon along the arc
  const outer: string[] = [];
  const inner: string[] = [];
  for (let i = 0; i < N; i++) {
    const f = i / (N - 1); // 0 = head, 1 = tail
    const ang = head - f * span;
    const hw = W0 * Math.pow(1 - f, 0.6); // width taper → point at the tail
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    outer.push(`${cx + (R + hw) * ca},${cy + (R + hw) * sa}`);
    inner.push(`${cx + (R - hw) * ca},${cy + (R - hw) * sa}`);
  }
  // one closed path: out along the outer edge, back along the inner edge
  const ribbon = `M ${outer.join(" L ")} L ${inner.slice().reverse().join(" L ")} Z`;

  const hx = cx + R * Math.cos(head);
  const hy = cy + R * Math.sin(head);
  const tx = cx + R * Math.cos(head - span);
  const ty = cy + R * Math.sin(head - span);

  return (
    <AbsoluteFill style={{ backgroundColor: "#161718" }}>
      <svg width={W} height={H} style={{ display: "block" }}>
        <defs>
          {/* fade runs along the arc: white head → orange → transparent tail */}
          <linearGradient id="comet" gradientUnits="userSpaceOnUse" x1={hx} y1={hy} x2={tx} y2={ty}>
            <stop offset="0%" stopColor={C.white} />
            <stop offset="6%" stopColor={C.hot} />
            <stop offset="24%" stopColor={C.orange} />
            <stop offset="100%" stopColor="rgba(248,102,6,0)" />
          </linearGradient>
        </defs>

        {/* smooth tapered arc */}
        <path d={ribbon} fill="url(#comet)" shapeRendering="geometricPrecision" />
        {/* rounded bright head cap */}
        <circle cx={hx} cy={hy} r={W0} fill={C.white} />
      </svg>
    </AbsoluteFill>
  );
};

export default Scene;
