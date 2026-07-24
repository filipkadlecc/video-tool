import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

// ============================================================================
// "AI running" — a seamless-looping, text-free processing animation on Apify's
// dark/orange palette. A breathing core (the model) sits inside tilted orbits
// whose nodes stream data signals inward; heartbeat rings pulse out on each
// beat and a slow scanner ring sweeps a faint dot field. Everything is periodic
// over LOOP frames so it tiles perfectly for a loading/"thinking" state.
// ============================================================================

export const fps = 25;
const LOOP = 120; // 4.8s seamless loop
export const durationInFrames = LOOP;

const C = {
  bg: "#161718",
  orange: "#F86606",
  deep: "#FF4800",
  hot: "#FFC08A",
  white: "#FFF4EA",
};

const TAU = Math.PI * 2;
const frac = (x: number) => x - Math.floor(x);
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);
const rand = (i: number) => frac(Math.sin(i * 127.1 + 311.7) * 43758.5453);

type OrbitDef = { nodes: number; dir: number; turns: number; tiltDeg: number; phase: number };
const ORBITS: OrbitDef[] = [
  { nodes: 2, dir: 1, turns: 1, tiltDeg: 12, phase: 0.0 },
  { nodes: 3, dir: -1, turns: 1, tiltDeg: 74, phase: 0.33 },
  { nodes: 2, dir: 1, turns: 2, tiltDeg: 132, phase: 0.6 },
];

const Scene: React.FC = () => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const cx = W / 2;
  const cy = H / 2;
  const base = Math.min(W, H);
  const t = (frame % LOOP) / LOOP; // 0..1 loop phase

  // static background dot field (deterministic)
  const dots = useMemo(() => {
    const step = base * 0.046;
    const out: { x: number; y: number; r: number; seed: number }[] = [];
    let i = 0;
    for (let y = step / 2; y < H; y += step) {
      for (let x = step / 2; x < W; x += step) {
        const jx = (rand(i * 2) - 0.5) * step * 0.5;
        const jy = (rand(i * 2 + 1) - 0.5) * step * 0.5;
        out.push({ x: x + jx, y: y + jy, r: base * 0.0016, seed: rand(i * 3) });
        i++;
      }
    }
    return out;
  }, [W, H, base]);

  // core breathing (2 beats per loop)
  const beat = (Math.sin(t * TAU * 2 - Math.PI / 2) + 1) / 2; // 0..1
  const coreR = base * 0.06 * (0.92 + 0.14 * beat);
  const glowR = base * 0.34 * (0.9 + 0.16 * beat);

  // orbit geometry (spherical: shared radii, different tilts)
  const rx = base * 0.36;
  const ry = base * 0.125;

  const nodePos = (o: OrbitDef, k: number) => {
    const a = o.phase * TAU + o.dir * o.turns * TAU * t + (k * TAU) / o.nodes;
    const lx = rx * Math.cos(a);
    const ly = ry * Math.sin(a);
    const tr = (o.tiltDeg * Math.PI) / 180;
    const x = cx + lx * Math.cos(tr) - ly * Math.sin(tr);
    const y = cy + lx * Math.sin(tr) + ly * Math.cos(tr);
    const depth = Math.sin(a); // -1 (back) .. 1 (front)
    return { x, y, depth };
  };

  // heartbeat rings: 2 pulses per loop, 3 rings phased
  const rings = [0, 1, 2].map((i) => {
    const p = frac(t * 2 + i / 3);
    const r = lerp(coreR * 1.1, base * 0.46, smooth(p));
    const op = (1 - p) * (1 - p) * 0.75;
    return { r, op };
  });

  // scanner ticks
  const ticks = 72;
  const scanRot = t * TAU; // one slow turn per loop
  const scanR = base * 0.47;

  return (
    <AbsoluteFill style={{ backgroundColor: "#161718" }}>
      <svg width={W} height={H} style={{ display: "block" }}>
        <defs>
          <radialGradient id="glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(248,102,6,0.55)" />
            <stop offset="35%" stopColor="rgba(248,102,6,0.22)" />
            <stop offset="100%" stopColor="rgba(248,102,6,0)" />
          </radialGradient>
          <radialGradient id="core" cx="42%" cy="40%" r="62%">
            <stop offset="0%" stopColor={C.white} />
            <stop offset="30%" stopColor={C.hot} />
            <stop offset="62%" stopColor={C.orange} />
            <stop offset="100%" stopColor={C.deep} />
          </radialGradient>
          <radialGradient id="node" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={C.white} />
            <stop offset="45%" stopColor={C.orange} />
            <stop offset="100%" stopColor="rgba(255,72,0,0)" />
          </radialGradient>
        </defs>

        {/* dot field */}
        <g>
          {dots.map((d, i) => {
            const dist = Math.hypot(d.x - cx, d.y - cy);
            const fade =
              clamp((dist - base * 0.16) / (base * 0.2), 0, 1) *
              clamp((base * 0.72 - dist) / (base * 0.25), 0, 1);
            const tw = 0.6 + 0.4 * Math.sin(t * TAU * 2 + d.seed * TAU);
            const op = 0.09 * fade * tw;
            if (op < 0.004) return null;
            return <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={C.hot} opacity={op} />;
          })}
        </g>

        {/* scanner ring + ticks */}
        <g transform={`rotate(${(scanRot * 180) / Math.PI} ${cx} ${cy})`}>
          <circle cx={cx} cy={cy} r={scanR} fill="none" stroke="rgba(248,102,6,0.10)" strokeWidth={base * 0.001} />
          {Array.from({ length: ticks }).map((_, i) => {
            const a = (i / ticks) * TAU;
            const r1 = scanR - base * 0.009;
            const r2 = scanR + base * 0.009;
            const lead = smooth(clamp(1 - ((i / ticks) % 1) * 2.6, 0, 1)); // brighter near the sweep head
            const op = 0.1 + 0.75 * lead;
            return (
              <line
                key={i}
                x1={cx + r1 * Math.cos(a)}
                y1={cy + r1 * Math.sin(a)}
                x2={cx + r2 * Math.cos(a)}
                y2={cy + r2 * Math.sin(a)}
                stroke={C.orange}
                strokeWidth={base * 0.0012}
                opacity={op}
              />
            );
          })}
        </g>

        {/* heartbeat rings */}
        {rings.map((rg, i) => (
          <circle key={i} cx={cx} cy={cy} r={rg.r} fill="none" stroke={C.orange} strokeWidth={base * 0.0018} opacity={rg.op} />
        ))}

        {/* ambient core glow */}
        <circle cx={cx} cy={cy} r={glowR} fill="url(#glow)" />

        {/* orbit paths */}
        {ORBITS.map((o, i) => (
          <ellipse
            key={`op-${i}`}
            cx={cx}
            cy={cy}
            rx={rx}
            ry={ry}
            fill="none"
            stroke="rgba(255,140,60,0.14)"
            strokeWidth={base * 0.0012}
            transform={`rotate(${o.tiltDeg} ${cx} ${cy})`}
          />
        ))}

        {/* connection lines + traveling signals + nodes */}
        {ORBITS.map((o, oi) =>
          Array.from({ length: o.nodes }).map((_, k) => {
            const { x, y, depth } = nodePos(o, k);
            const df = 0.55 + 0.45 * ((depth + 1) / 2); // front brighter
            const nr = base * 0.014 * (0.7 + 0.5 * ((depth + 1) / 2));
            // signals: 2 per loop per node, staggered — data streaming into the core
            const sp = frac(t * 2 + (oi * 0.37 + k * 0.21));
            const sEnv = Math.sin(sp * Math.PI); // 0..1..0 along the trip
            const lineOp = (0.08 + 0.26 * sEnv) * df;
            const trail = [0, 0.05, 0.1, 0.16].map((d, ti) => {
              const p = clamp(sp - d, 0, 1);
              return {
                x: lerp(x, cx, smooth(p)),
                y: lerp(y, cy, smooth(p)),
                r: base * 0.007 * (1 - ti * 0.2),
                op: sEnv * df * (1 - ti * 0.28),
              };
            });
            return (
              <g key={`n-${oi}-${k}`}>
                <line x1={x} y1={y} x2={cx} y2={cy} stroke={C.orange} strokeWidth={base * 0.0012} opacity={lineOp} />
                {trail.map((s, ti) => (
                  <circle key={ti} cx={s.x} cy={s.y} r={s.r} fill={ti === 0 ? C.white : C.hot} opacity={s.op} />
                ))}
                <circle cx={x} cy={y} r={nr * 2.4} fill="url(#node)" opacity={0.6 * df} />
                <circle cx={x} cy={y} r={nr} fill={C.white} opacity={df} />
              </g>
            );
          })
        )}

        {/* core */}
        <circle cx={cx} cy={cy} r={coreR} fill="url(#core)" />
        <circle cx={cx - coreR * 0.18} cy={cy - coreR * 0.22} r={coreR * 0.4} fill={C.white} opacity={0.5 + 0.3 * beat} />
      </svg>
    </AbsoluteFill>
  );
};

export default Scene;
