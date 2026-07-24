import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

// ============================================================================
// "AI running" — just a spinning wheel. A faint full track ring with a bright
// tapered arc (comet head → fading tail) sweeping around it at a steady pace.
// Text-free, Apify orange on dark, seamless loop, transparent-ready.
// ============================================================================

export const fps = 25;
const LOOP = 50; // 2s seamless loop
export const durationInFrames = LOOP;

const C = { bg: "#161718", orange: "#F86606", deep: "#FF4800", hot: "#FFC08A", white: "#FFF4EA" };
const TAU = Math.PI * 2;

const Scene: React.FC = () => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const cx = W / 2;
  const cy = H / 2;
  const base = Math.min(W, H);
  const t = (frame % LOOP) / LOOP;

  const R = base * 0.24; // wheel radius
  const headR = base * 0.016; // arc thickness (~2*headR)
  const TURNS = 2; // revolutions per loop (integer → seamless)
  const head = -Math.PI / 2 + TURNS * TAU * t; // starts at top, spins clockwise
  const span = (300 * Math.PI) / 180; // arc sweep; the ~60° gap fades to nothing
  const N = 90;

  const dots = Array.from({ length: N }, (_, i) => {
    const f = i / (N - 1); // 0 = head, 1 = tail
    const ang = head - f * span;
    return {
      x: cx + R * Math.cos(ang),
      y: cy + R * Math.sin(ang),
      r: headR * (1 - f * 0.82),
      op: Math.pow(1 - f, 1.1),
      fill: f < 0.04 ? C.white : f < 0.12 ? C.hot : C.orange,
    };
  });

  const hx = cx + R * Math.cos(head);
  const hy = cy + R * Math.sin(head);

  return (
    <AbsoluteFill style={{ backgroundColor: "#161718" }}>
      <svg width={W} height={H} style={{ display: "block" }}>
        <defs>
          <radialGradient id="spinHead" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,244,234,0.9)" />
            <stop offset="35%" stopColor="rgba(248,102,6,0.45)" />
            <stop offset="100%" stopColor="rgba(248,102,6,0)" />
          </radialGradient>
        </defs>

        {/* faint full track — the wheel */}
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(248,102,6,0.10)" strokeWidth={headR * 0.5} />

        {/* soft glow behind the head */}
        <circle cx={hx} cy={hy} r={headR * 3.2} fill="url(#spinHead)" />

        {/* tapered spinning arc */}
        {dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={d.fill} opacity={d.op} />
        ))}
      </svg>
    </AbsoluteFill>
  );
};

export default Scene;
