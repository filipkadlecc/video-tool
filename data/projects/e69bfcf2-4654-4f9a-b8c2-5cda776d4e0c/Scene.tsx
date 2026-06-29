import React from "react";
import {
  AbsoluteFill,
  Sequence,
  Img,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  staticFile,
} from "remotion";

// MCP connectors announcement — 18 natively-animated scenes, 4K @ 25fps.
// Built from a Figma storyboard. Each scene actually animates: text reveals
// word-by-word, dashed lines rain in, grid draws column-by-column, cursor
// moves between UI states, table rows pop in, wireframe triangles drift in.

export const fps = 25;

// ---------- shared brand tokens (sourced from Figma frames) ----------
const BG = "#161718";
const ORANGE = "#F86606";
const ORANGE_DIM = "#7A3303";
const TEXT = "#FFFFFF";
const TEXT_MUTED = "#9AA0A6";
const CARD_BG = "#1D1E1F";
const CARD_BORDER = "#3D3F43";
const BLUE = "#4A7CFE";
const FONT_SANS = '"GT-Walsheim-Regular", Inter, ui-sans-serif, system-ui';

// Default scaling: design canvas is 1198×766 (Figma) → we scale into 3840×2160
// keeping content centered with extended dark backgrounds.

// ---------- shared motion helpers ----------
function fadeIO(frame: number, total: number, inLen = 8, outLen = 10) {
  const fin = interpolate(frame, [0, inLen], [0, 1], { extrapolateRight: "clamp" });
  const fout = interpolate(frame, [total - outLen, total], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return Math.min(fin, fout);
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

// ---------- reusable visual: dashed T-line (orange "MCP connector" motif) ----------
function DashedTLine({
  x,
  topY,
  length,
  reveal, // 0..1
  flipped = false, // true => T-cap on bottom (line rises from below)
  base, // canvas scale base
}: {
  x: number;
  topY: number;
  length: number;
  reveal: number;
  flipped?: boolean;
  base: number;
}) {
  const r = Math.max(0, Math.min(1, reveal));
  const visibleLen = length * r;
  const capW = 28 * (base / 2160);
  return (
    <div
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${topY}%`,
        transform: "translate(-50%, 0)",
      }}
    >
      {/* dashed line */}
      <div
        style={{
          position: "absolute",
          left: -1,
          top: flipped ? `${length - visibleLen}px` : 0,
          width: 2,
          height: visibleLen,
          backgroundImage: `repeating-linear-gradient(${
            flipped ? "0deg" : "180deg"
          }, ${ORANGE} 0 6px, transparent 6px 12px)`,
          opacity: 0.85,
        }}
      />
      {/* T-cap */}
      <div
        style={{
          position: "absolute",
          left: -capW / 2,
          top: flipped ? `${length - visibleLen - 2}px` : `${visibleLen - 2}px`,
          width: capW,
          height: 3,
          background: ORANGE,
          opacity: r,
        }}
      />
    </div>
  );
}

// Deterministic "random" so the lines pattern stays stable per render.
function pseudo(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

function LinesField({
  frame,
  total,
  side, // "top" | "bottom"
  count,
  start, // frame at which the first line begins falling
  duration, // frames over which all lines complete
  base,
}: {
  frame: number;
  total: number;
  side: "top" | "bottom";
  count: number;
  start: number;
  duration: number;
  base: number;
}) {
  const items = [];
  for (let i = 0; i < count; i++) {
    const seed = side === "top" ? i + 1 : i + 100;
    const x = 4 + (i / (count - 1)) * 92 + (pseudo(seed) - 0.5) * 4; // %
    const length = (140 + pseudo(seed + 7) * 200) * (base / 2160);
    const topY = side === "top" ? 0 : 100 - (length / (base * (9 / 16))) * 100;
    const delay = start + Math.floor(pseudo(seed + 3) * 30);
    const localT = (frame - delay) / Math.max(1, duration - delay + start);
    const reveal = easeOutCubic(Math.max(0, Math.min(1, localT)));
    items.push(
      <DashedTLine
        key={`${side}-${i}`}
        x={x}
        topY={topY}
        length={length}
        reveal={reveal}
        flipped={side === "bottom"}
        base={base}
      />,
    );
  }
  return <>{items}</>;
}

// ---------- reusable visual: word-by-word text reveal ----------
function WordReveal({
  text,
  startFrame,
  perWord = 4,
  riseFrom = 24,
  style,
}: {
  text: string;
  startFrame: number;
  perWord?: number;
  riseFrom?: number;
  style: React.CSSProperties;
}) {
  const frame = useCurrentFrame();
  const words = text.split(/\s+/);
  return (
    <div style={{ ...style, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0.35em" }}>
      {words.map((w, i) => {
        const delay = startFrame + i * perWord;
        const local = frame - delay;
        const opacity = interpolate(local, [0, 8], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const ty = interpolate(local, [0, 14], [riseFrom, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <span
            key={i}
            style={{
              opacity,
              transform: `translateY(${ty}px)`,
              display: "inline-block",
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
}

// ---------- reusable visual: cursor pointer SVG ----------
function Cursor({ x, y, scale = 1, opacity = 1 }: { x: number; y: number; scale?: number; opacity?: number }) {
  return (
    <svg
      width={64}
      height={64}
      viewBox="0 0 24 24"
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        transform: `translate(-30%, -30%) scale(${scale})`,
        filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.4))",
        opacity,
      }}
    >
      <path
        d="M5 3 L5 19 L9.5 14.5 L12 20 L14 19 L11.5 13.5 L18 13 Z"
        fill="white"
        stroke="black"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---------- reusable card frame ----------
function Card({
  children,
  style,
  border = ORANGE,
}: {
  children?: React.ReactNode;
  style?: React.CSSProperties;
  border?: string;
}) {
  return (
    <div
      style={{
        background: CARD_BG,
        border: `1.5px solid ${border}`,
        borderRadius: 14,
        boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// =============================================================
// SCENES — each scene is a self-contained component that lives
// inside a <Sequence>. SCENE_END passed in so fade-out works.
// =============================================================

interface SceneProps {
  total: number;
}

// SCENE 1 — "Actors used to read the public web"
function S01_Opening({ total }: SceneProps) {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const opacity = fadeIO(frame, total);
  return (
    <AbsoluteFill style={{ background: BG, opacity, alignItems: "center", justifyContent: "center" }}>
      <WordReveal
        text="Actors used to read the public web"
        startFrame={6}
        perWord={5}
        style={{
          fontFamily: FONT_SANS,
          fontWeight: 500,
          fontSize: height * 0.085,
          color: TEXT,
          letterSpacing: "-0.015em",
          lineHeight: 1.15,
          maxWidth: "70%",
          textAlign: "center",
        }}
      />
    </AbsoluteFill>
  );
}

// SCENE 2 — "Now they can also act on your tools" with orange underline draw
function S02_Pivot({ total }: SceneProps) {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const opacity = fadeIO(frame, total);
  const underlineProgress = interpolate(frame, [40, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ background: BG, opacity, alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "relative", maxWidth: "72%", textAlign: "center" }}>
        <WordReveal
          text="Now they can also"
          startFrame={4}
          perWord={5}
          style={{
            fontFamily: FONT_SANS,
            fontWeight: 500,
            fontSize: height * 0.085,
            color: TEXT,
            letterSpacing: "-0.015em",
            lineHeight: 1.15,
          }}
        />
        <div style={{ position: "relative", display: "inline-block", marginTop: height * 0.02 }}>
          <WordReveal
            text="act on your tools"
            startFrame={22}
            perWord={5}
            style={{
              fontFamily: FONT_SANS,
              fontWeight: 600,
              fontSize: height * 0.085,
              color: TEXT,
              letterSpacing: "-0.015em",
              lineHeight: 1.15,
            }}
          />
          {/* drawing orange underline */}
          <div
            style={{
              position: "absolute",
              left: 0,
              bottom: -8,
              height: 4,
              width: `${underlineProgress * 100}%`,
              background: ORANGE,
              borderRadius: 2,
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
}

// SCENE 3 — "Introducing" with dashed T-lines raining in
function S03_IntroducingLines({ total }: SceneProps) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const opacity = fadeIO(frame, total);
  const base = height;
  const introOpacity = interpolate(frame, [25, 45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ background: BG, opacity }}>
      <LinesField frame={frame} total={total} side="top" count={14} start={0} duration={45} base={base} />
      <LinesField frame={frame} total={total} side="bottom" count={14} start={10} duration={55} base={base} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: FONT_SANS,
          fontWeight: 400,
          fontSize: height * 0.07,
          color: TEXT,
          letterSpacing: "0.01em",
          opacity: introOpacity,
          transform: `translateY(${interpolate(introOpacity, [0, 1], [12, 0])}px)`,
        }}
      >
        Introducing
      </div>
    </AbsoluteFill>
  );
}

// SCENE 4 — "MCP connectors" headline drops in
function S04_MCPConnectorsTitle({ total }: SceneProps) {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const opacity = fadeIO(frame, total);
  const base = height;
  const mcpIn = spring({ frame: frame - 6, fps: 25, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ background: BG, opacity }}>
      <LinesField frame={frame + 45} total={total + 45} side="top" count={20} start={0} duration={1} base={base} />
      <LinesField frame={frame + 55} total={total + 55} side="bottom" count={20} start={0} duration={1} base={base} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: height * 0.025,
        }}
      >
        <div
          style={{
            fontFamily: FONT_SANS,
            fontWeight: 400,
            fontSize: height * 0.055,
            color: TEXT,
            opacity: 0.85,
          }}
        >
          Introducing
        </div>
        <div
          style={{
            fontFamily: FONT_SANS,
            fontWeight: 600,
            fontSize: height * 0.11,
            color: TEXT,
            letterSpacing: "-0.02em",
            opacity: mcpIn,
            transform: `translateY(${interpolate(mcpIn, [0, 1], [40, 0])}px) scale(${interpolate(
              mcpIn,
              [0, 1],
              [0.94, 1],
            )})`,
          }}
        >
          MCP connectors
        </div>
      </div>
    </AbsoluteFill>
  );
}

// SCENE 5 — Orange grid draws in, "Step 1 / Authorize once" card lands
function GridScene({
  total,
  stepNum,
  stepText,
}: SceneProps & { stepNum: string; stepText: string }) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const opacity = fadeIO(frame, total);
  // Grid: columns draw left-to-right, rows top-to-bottom over first 30 frames.
  const cols = 11;
  const rows = 7;
  const drawV = interpolate(frame, [0, 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const drawH = interpolate(frame, [6, 28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cardIn = spring({ frame: frame - 26, fps: 25, config: { damping: 220 } });

  return (
    <AbsoluteFill style={{ background: BG, opacity }}>
      {/* Vertical grid lines */}
      {Array.from({ length: cols }).map((_, i) => {
        const t = (i + 1) / (cols + 1);
        const lineReveal = Math.max(0, Math.min(1, (drawV - t * 0.5) * 2));
        const isMajor = i % 3 === 1;
        return (
          <div
            key={`v${i}`}
            style={{
              position: "absolute",
              left: `${t * 100}%`,
              top: 0,
              width: 1,
              height: `${lineReveal * 100}%`,
              background: isMajor ? ORANGE : "#2a2b2d",
              opacity: isMajor ? 0.55 : 0.7,
            }}
          />
        );
      })}
      {/* Horizontal grid lines */}
      {Array.from({ length: rows }).map((_, i) => {
        const t = (i + 1) / (rows + 1);
        const lineReveal = Math.max(0, Math.min(1, (drawH - t * 0.5) * 2));
        const isMajor = i % 2 === 1;
        return (
          <div
            key={`h${i}`}
            style={{
              position: "absolute",
              top: `${t * 100}%`,
              left: 0,
              height: 1,
              width: `${lineReveal * 100}%`,
              background: isMajor ? ORANGE : "#2a2b2d",
              opacity: isMajor ? 0.55 : 0.7,
            }}
          />
        );
      })}
      {/* Step card */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: cardIn,
          transform: `scale(${interpolate(cardIn, [0, 1], [0.85, 1])})`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            background: BG,
            border: `1.5px solid ${ORANGE}`,
            borderRadius: 6,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: `${height * 0.04}px ${height * 0.05}px`,
              fontFamily: FONT_SANS,
              fontWeight: 400,
              fontSize: height * 0.045,
              color: TEXT,
              borderRight: `1.5px solid ${ORANGE}`,
              minWidth: height * 0.22,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            Step {stepNum}
          </div>
          <div
            style={{
              padding: `${height * 0.04}px ${height * 0.06}px`,
              fontFamily: FONT_SANS,
              fontWeight: 500,
              fontSize: height * 0.055,
              color: TEXT,
              display: "flex",
              alignItems: "center",
            }}
          >
            {stepText}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

// SCENE 6 — MCP connectors panel builds horizontally
function S06_MCPBarBuilds({ total }: SceneProps) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const opacity = fadeIO(frame, total);
  const build = spring({ frame, fps: 25, config: { damping: 220, mass: 0.8 } });
  const textIn = interpolate(frame, [10, 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const btnIn = interpolate(frame, [18, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const barWidth = width * 0.72;
  const barHeight = height * 0.12;

  return (
    <AbsoluteFill style={{ background: BG, opacity }}>
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
            width: barWidth * build,
            height: barHeight,
            border: `1.5px solid ${ORANGE}`,
            borderRadius: 14,
            background: CARD_BG,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: `0 ${height * 0.03}px`,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              opacity: textIn,
              transform: `translateX(${interpolate(textIn, [0, 1], [-20, 0])}px)`,
            }}
          >
            <div
              style={{
                fontFamily: FONT_SANS,
                fontWeight: 600,
                fontSize: height * 0.032,
                color: TEXT,
                marginBottom: 6,
              }}
            >
              MCP connectors
            </div>
            <div style={{ fontFamily: FONT_SANS, fontSize: height * 0.022, color: TEXT_MUTED }}>
              These connectors allow you to use MCP servers in your Actors.
            </div>
          </div>
          <div
            style={{
              padding: `${height * 0.014}px ${height * 0.028}px`,
              background: BG,
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: 8,
              color: TEXT,
              fontFamily: FONT_SANS,
              fontSize: height * 0.024,
              opacity: btnIn,
              transform: `translateX(${interpolate(btnIn, [0, 1], [20, 0])}px)`,
            }}
          >
            Create new connection
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

// SCENE 7 — Zoom into the "Create new connection" button + cursor flies in
function S07_ZoomToButton({ total }: SceneProps) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const opacity = fadeIO(frame, total);
  // Camera zooms in: scale 1.0 -> 2.0, content translates so the button stays centered.
  const zoom = interpolate(frame, [0, 35], [1, 2.0], { extrapolateRight: "clamp" });
  // Cursor enters from bottom-right and lands on the button.
  const cursorT = interpolate(frame, [20, 45], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cursorX = interpolate(cursorT, [0, 1], [85, 56]);
  const cursorY = interpolate(cursorT, [0, 1], [80, 53]);
  // Button highlight when cursor lands
  const hover = interpolate(frame, [42, 55], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const buttonScale = 1 + hover * 0.04;

  return (
    <AbsoluteFill style={{ background: BG, opacity }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${zoom})`,
          transformOrigin: "60% 50%",
        }}
      >
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
              width: width * 0.72,
              height: height * 0.12,
              border: `1.5px solid ${ORANGE}`,
              borderRadius: 14,
              background: CARD_BG,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: `0 ${height * 0.03}px`,
              overflow: "hidden",
            }}
          >
            <div>
              <div style={{ fontFamily: FONT_SANS, fontWeight: 600, fontSize: height * 0.032, color: TEXT, marginBottom: 6 }}>
                MCP connectors
              </div>
              <div style={{ fontFamily: FONT_SANS, fontSize: height * 0.022, color: TEXT_MUTED }}>
                These connectors allow you to use MCP servers in your Actors.
              </div>
            </div>
            <div
              style={{
                padding: `${height * 0.014}px ${height * 0.028}px`,
                background: hover > 0.3 ? "#2a2b2d" : BG,
                border: `1px solid ${hover > 0.3 ? ORANGE : CARD_BORDER}`,
                borderRadius: 8,
                color: TEXT,
                fontFamily: FONT_SANS,
                fontSize: height * 0.024,
                transform: `scale(${buttonScale})`,
                transition: "background 0.2s",
              }}
            >
              Create new connection
            </div>
          </div>
        </div>
      </div>
      <Cursor x={cursorX} y={cursorY} opacity={cursorT > 0 ? 1 : 0} />
    </AbsoluteFill>
  );
}

// SCENE 8 — Modal "Create new MCP connector" scales in from button
function S08_ModalOpens({ total }: SceneProps) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const opacity = fadeIO(frame, total);
  const modalIn = spring({ frame, fps: 25, config: { damping: 200 } });
  const fieldIn = interpolate(frame, [12, 28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: BG, opacity, alignItems: "center", justifyContent: "center" }}>
      <Card
        style={{
          width: width * 0.4,
          padding: height * 0.035,
          opacity: modalIn,
          transform: `scale(${interpolate(modalIn, [0, 1], [0.85, 1])})`,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: height * 0.025,
          }}
        >
          <div style={{ fontFamily: FONT_SANS, fontWeight: 600, fontSize: height * 0.03, color: TEXT }}>
            Create new MCP connector
          </div>
          <div style={{ color: TEXT_MUTED, fontSize: height * 0.025 }}>×</div>
        </div>
        <div style={{ opacity: fieldIn }}>
          <div
            style={{
              fontFamily: FONT_SANS,
              fontSize: height * 0.018,
              color: TEXT,
              marginBottom: height * 0.012,
            }}
          >
            Authentication method
          </div>
          <div style={{ display: "flex", gap: height * 0.025, marginBottom: height * 0.025 }}>
            <Radio label="API key" checked />
            <Radio label="OAuth" />
            <Radio label="Your own OAuth client" />
          </div>
          <div
            style={{
              fontFamily: FONT_SANS,
              fontSize: height * 0.018,
              color: TEXT,
              marginBottom: height * 0.008,
            }}
          >
            MCP server URL
          </div>
          <div
            style={{
              border: `1px solid ${CARD_BORDER}`,
              background: "#101011",
              borderRadius: 6,
              padding: `${height * 0.012}px ${height * 0.018}px`,
              color: TEXT_MUTED,
              fontFamily: FONT_SANS,
              fontSize: height * 0.018,
              marginBottom: height * 0.02,
            }}
          >
            Type in URL
          </div>
          <div
            style={{
              fontFamily: FONT_SANS,
              fontSize: height * 0.018,
              color: TEXT,
              marginBottom: height * 0.008,
            }}
          >
            API key
          </div>
          <div
            style={{
              border: `1px solid ${CARD_BORDER}`,
              background: "#101011",
              borderRadius: 6,
              padding: `${height * 0.012}px ${height * 0.018}px`,
              height: height * 0.04,
              marginBottom: height * 0.025,
            }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: height * 0.015 }}>
            <BtnSecondary label="Cancel" h={height} />
            <BtnPrimary label="Save" h={height} />
          </div>
        </div>
      </Card>
    </AbsoluteFill>
  );
}

function Radio({ label, checked }: { label: string; checked?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          width: 14,
          height: 14,
          borderRadius: "50%",
          border: `1.5px solid ${checked ? BLUE : CARD_BORDER}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {checked && <div style={{ width: 7, height: 7, borderRadius: "50%", background: BLUE }} />}
      </div>
      <div style={{ fontFamily: FONT_SANS, fontSize: "0.9em", color: TEXT }}>{label}</div>
    </div>
  );
}

function BtnPrimary({ label, h }: { label: string; h: number }) {
  return (
    <div
      style={{
        padding: `${h * 0.012}px ${h * 0.025}px`,
        background: BLUE,
        borderRadius: 6,
        color: "#0a0a0a",
        fontFamily: FONT_SANS,
        fontWeight: 600,
        fontSize: h * 0.02,
      }}
    >
      {label}
    </div>
  );
}

function BtnSecondary({ label, h }: { label: string; h: number }) {
  return (
    <div
      style={{
        padding: `${h * 0.012}px ${h * 0.025}px`,
        background: "transparent",
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 6,
        color: TEXT,
        fontFamily: FONT_SANS,
        fontSize: h * 0.02,
      }}
    >
      {label}
    </div>
  );
}

// SCENE 9 — Dropdown appears with Notion option, cursor moves to it
function S09_DropdownNotion({ total }: SceneProps) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const opacity = fadeIO(frame, total);
  const dropIn = spring({ frame: frame - 4, fps: 25, config: { damping: 200 } });
  // Cursor sweeps from right (URL field area) down to the Notion item.
  const cursorT = interpolate(frame, [18, 42], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cursorX = interpolate(cursorT, [0, 1], [62, 42]);
  const cursorY = interpolate(cursorT, [0, 1], [42, 62]);
  const notionHover = interpolate(frame, [38, 55], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: BG, opacity, alignItems: "center", justifyContent: "center" }}>
      <Card
        style={{
          width: width * 0.4,
          padding: height * 0.035,
        }}
      >
        <div style={{ fontFamily: FONT_SANS, fontWeight: 600, fontSize: height * 0.03, color: TEXT, marginBottom: height * 0.025 }}>
          Create new MCP connector
        </div>
        <div
          style={{
            fontFamily: FONT_SANS,
            fontSize: height * 0.018,
            color: TEXT,
            marginBottom: height * 0.008,
          }}
        >
          MCP server URL
        </div>
        <div
          style={{
            border: `1px solid ${ORANGE}`,
            background: "#101011",
            borderRadius: 6,
            padding: `${height * 0.012}px ${height * 0.018}px`,
            color: TEXT_MUTED,
            fontFamily: FONT_SANS,
            fontSize: height * 0.018,
            position: "relative",
          }}
        >
          Type in URL
          {/* Dropdown */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: "110%",
              width: "100%",
              background: CARD_BG,
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: 6,
              boxShadow: "0 12px 32px rgba(0,0,0,0.55)",
              padding: height * 0.008,
              opacity: dropIn,
              transform: `translateY(${interpolate(dropIn, [0, 1], [-8, 0])}px)`,
              zIndex: 5,
            }}
          >
            {["Slack MCP", "Notion MCP", "Google Drive MCP", "GitHub MCP"].map((name, i) => {
              const isNotion = name === "Notion MCP";
              const bg = isNotion && notionHover > 0.3 ? "#2a2b2d" : "transparent";
              return (
                <div
                  key={name}
                  style={{
                    padding: `${height * 0.012}px ${height * 0.016}px`,
                    color: TEXT,
                    fontSize: height * 0.02,
                    background: bg,
                    borderRadius: 4,
                    borderLeft: isNotion && notionHover > 0.3 ? `2px solid ${ORANGE}` : "2px solid transparent",
                  }}
                >
                  {name}
                </div>
              );
            })}
          </div>
        </div>
      </Card>
      <Cursor x={cursorX} y={cursorY} opacity={cursorT > 0 ? 1 : 0} />
    </AbsoluteFill>
  );
}

// SCENE 10 — Expanded modal with Notion selected; cursor moves to Save (Authorize)
function S10_AuthorizeClick({ total }: SceneProps) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const opacity = fadeIO(frame, total);
  const cursorT = interpolate(frame, [4, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cursorX = interpolate(cursorT, [0, 1], [42, 64]);
  const cursorY = interpolate(cursorT, [0, 1], [62, 68]);
  const click = interpolate(frame, [28, 34, 40], [1, 0.92, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: BG, opacity, alignItems: "center", justifyContent: "center" }}>
      <Card style={{ width: width * 0.4, padding: height * 0.035 }}>
        <div style={{ fontFamily: FONT_SANS, fontWeight: 600, fontSize: height * 0.03, color: TEXT, marginBottom: height * 0.025 }}>
          Create new MCP connector
        </div>
        <div style={{ fontFamily: FONT_SANS, fontSize: height * 0.018, color: TEXT, marginBottom: height * 0.008 }}>
          MCP server URL
        </div>
        <div
          style={{
            border: `1px solid ${CARD_BORDER}`,
            background: "#101011",
            borderRadius: 6,
            padding: `${height * 0.012}px ${height * 0.018}px`,
            color: TEXT,
            fontFamily: FONT_SANS,
            fontSize: height * 0.018,
            marginBottom: height * 0.02,
          }}
        >
          Notion MCP
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: height * 0.015 }}>
          <BtnSecondary label="Cancel" h={height} />
          <div style={{ transform: `scale(${click})` }}>
            <BtnPrimary label="Authorize" h={height} />
          </div>
        </div>
      </Card>
      <Cursor x={cursorX} y={cursorY} opacity={cursorT > 0 ? 1 : 0} scale={click < 1 ? 0.9 : 1} />
    </AbsoluteFill>
  );
}

// SCENE 11 — Connection successful + wireframe triangles drift in
function S11_ConnectionSuccess({ total }: SceneProps) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const opacity = fadeIO(frame, total);
  const successIn = spring({ frame, fps: 25, config: { damping: 200 } });

  // Wireframe triangles drift slowly in/around.
  const tris = [
    { x: 12, y: 18, size: 320, rot: -20, delay: 4 },
    { x: 80, y: 75, size: 280, rot: 35, delay: 12 },
    { x: 22, y: 78, size: 220, rot: 65, delay: 18 },
    { x: 85, y: 20, size: 200, rot: -45, delay: 24 },
  ];

  return (
    <AbsoluteFill style={{ background: BG, opacity }}>
      {tris.map((t, i) => {
        const local = frame - t.delay;
        const op = interpolate(local, [0, 28], [0, 0.65], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const drift = Math.sin((frame + t.delay * 4) / 30) * 6;
        return (
          <svg
            key={i}
            width={t.size * (height / 2160)}
            height={t.size * (height / 2160)}
            viewBox="0 0 100 100"
            style={{
              position: "absolute",
              left: `${t.x}%`,
              top: `${t.y}%`,
              transform: `translate(-50%, -50%) rotate(${t.rot + drift * 0.4}deg) translateY(${drift}px)`,
              opacity: op,
            }}
          >
            <polygon
              points="20,80 80,90 50,15"
              fill="none"
              stroke={ORANGE}
              strokeWidth="0.7"
            />
          </svg>
        );
      })}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: successIn,
          transform: `scale(${interpolate(successIn, [0, 1], [0.9, 1])})`,
        }}
      >
        <Card style={{ width: width * 0.36, padding: height * 0.035 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: height * 0.02,
            }}
          >
            <div style={{ fontFamily: FONT_SANS, fontWeight: 600, fontSize: height * 0.03, color: TEXT }}>
              Connection successful
            </div>
            <div style={{ color: TEXT_MUTED, fontSize: height * 0.025 }}>×</div>
          </div>
          <div
            style={{
              fontFamily: FONT_SANS,
              fontSize: height * 0.02,
              color: TEXT_MUTED,
              lineHeight: 1.4,
              marginBottom: height * 0.022,
            }}
          >
            You can manage connected tools and revoke access anytime from Apify Console &rarr; Settings &rarr; Integrations.
          </div>
          <div
            style={{
              border: `1px solid ${CARD_BORDER}`,
              background: "#101011",
              borderRadius: 6,
              height: height * 0.045,
              marginBottom: height * 0.025,
            }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: height * 0.015 }}>
            <BtnSecondary label="Cancel" h={height} />
            <BtnPrimary label="Understood" h={height} />
          </div>
        </Card>
      </div>
    </AbsoluteFill>
  );
}

// SCENE 12+13 — Step 2 / Step 3 cards on grid (reuse GridScene)

// SCENE 14 — My Cafe Reviews table, rows pop in
function S14_CafeTable({ total }: SceneProps) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const opacity = fadeIO(frame, total);
  const tableIn = spring({ frame, fps: 25, config: { damping: 220 } });

  const rows = [
    ["Bondi Café", "4.7", "Sydney", "Friendly staff, great flat white"],
    ["Aurora Roasters", "4.6", "Melbourne", "Beans roasted on-site daily"],
    ["Foglio", "4.4", "Brisbane", "Cozy spot, oat milk on tap"],
    ["Black Velvet", "4.8", "Perth", "Best espresso in WA, hands down"],
    ["Heron's Lair", "4.5", "Adelaide", "Quiet, fast wifi, nice pastries"],
  ];

  return (
    <AbsoluteFill style={{ background: BG, opacity, alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          width: width * 0.7,
          background: CARD_BG,
          border: `1px solid ${CARD_BORDER}`,
          borderRadius: 14,
          overflow: "hidden",
          opacity: tableIn,
          transform: `translateY(${interpolate(tableIn, [0, 1], [40, 0])}px)`,
        }}
      >
        {/* Header bar */}
        <div
          style={{
            height: height * 0.055,
            background: ORANGE,
            display: "flex",
            alignItems: "center",
            padding: `0 ${height * 0.028}px`,
            fontFamily: FONT_SANS,
            fontWeight: 600,
            fontSize: height * 0.026,
            color: "#0a0a0a",
          }}
        >
          My Cafe Reviews
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.6fr 0.7fr 1fr 3fr",
            fontFamily: FONT_SANS,
            fontSize: height * 0.022,
          }}
        >
          {/* Column headers */}
          <Cell h={height} mutedHead>
            Name
          </Cell>
          <Cell h={height} mutedHead>
            Rating
          </Cell>
          <Cell h={height} mutedHead>
            City
          </Cell>
          <Cell h={height} mutedHead last>
            Review
          </Cell>
          {/* Rows */}
          {rows.map((row, ri) => {
            const delay = 12 + ri * 8;
            const rowIn = interpolate(frame, [delay, delay + 14], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return row.map((v, ci) => (
              <Cell
                key={`${ri}-${ci}`}
                h={height}
                last={ci === row.length - 1}
                style={{
                  opacity: rowIn,
                  transform: `translateY(${interpolate(rowIn, [0, 1], [12, 0])}px)`,
                }}
              >
                {v}
              </Cell>
            ));
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
}

function Cell({
  children,
  h,
  mutedHead,
  last,
  style,
}: {
  children: React.ReactNode;
  h: number;
  mutedHead?: boolean;
  last?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        padding: `${h * 0.018}px ${h * 0.025}px`,
        color: mutedHead ? TEXT_MUTED : TEXT,
        borderBottom: `1px solid ${CARD_BORDER}`,
        borderRight: last ? "none" : `1px solid ${CARD_BORDER}`,
        fontWeight: mutedHead ? 500 : 400,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// SCENE 15 — "Your credentials. Not the Actor's" + actor card slides up
function S15_YourCredentials({ total }: SceneProps) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const opacity = fadeIO(frame, total);
  const cardIn = spring({ frame: frame - 18, fps: 25, config: { damping: 220 } });
  return (
    <AbsoluteFill style={{ background: BG, opacity }}>
      <div
        style={{
          position: "absolute",
          top: "20%",
          left: 0,
          right: 0,
          textAlign: "center",
        }}
      >
        <WordReveal
          text="Your credentials."
          startFrame={4}
          perWord={4}
          style={{
            fontFamily: FONT_SANS,
            fontWeight: 700,
            fontSize: height * 0.11,
            color: TEXT,
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
          }}
        />
        <WordReveal
          text="Not the Actor's"
          startFrame={14}
          perWord={4}
          style={{
            fontFamily: FONT_SANS,
            fontWeight: 700,
            fontSize: height * 0.11,
            color: TEXT,
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
            marginTop: height * 0.005,
          }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: "12%",
          bottom: "16%",
          width: width * 0.22,
          opacity: cardIn,
          transform: `translateY(${interpolate(cardIn, [0, 1], [30, 0])}px)`,
        }}
      >
        <Card style={{ padding: height * 0.022 }}>
          <div style={{ display: "flex", alignItems: "center", gap: height * 0.018, marginBottom: height * 0.014 }}>
            <div
              style={{
                width: height * 0.05,
                height: height * 0.05,
                borderRadius: 10,
                background: CARD_BORDER,
              }}
            />
            <div>
              <div style={{ fontFamily: FONT_SANS, fontWeight: 600, fontSize: height * 0.022, color: TEXT }}>
                E-Commerce Price Monitor
              </div>
              <div
                style={{
                  fontFamily: "ui-monospace, Menlo, monospace",
                  fontSize: height * 0.016,
                  color: TEXT_MUTED,
                }}
              >
                apify/web-scraper
              </div>
            </div>
          </div>
          <div style={{ fontFamily: FONT_SANS, fontSize: height * 0.018, color: TEXT_MUTED, lineHeight: 1.4 }}>
            Crawls arbitrary websites using the Chrome browser and extracts data from pages using a…
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: height * 0.018,
              paddingTop: height * 0.012,
              borderTop: `1px solid ${CARD_BORDER}`,
            }}
          >
            <div style={{ fontFamily: FONT_SANS, fontSize: height * 0.017, color: TEXT }}>Apify</div>
            <div style={{ fontFamily: FONT_SANS, fontSize: height * 0.017, color: TEXT_MUTED }}>
              ★ 4.6 (679) · 164k
            </div>
          </div>
        </Card>
      </div>
    </AbsoluteFill>
  );
}

// SCENE 16 — "30,000 Actors. Now in your stack." with counting number + dashed frame
function S16_30kActors({ total }: SceneProps) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const opacity = fadeIO(frame, total);

  // Animated count-up 0 -> 30000
  const countT = spring({ frame, fps: 25, config: { damping: 200, mass: 1 } });
  const value = Math.round(countT * 30000);
  const valueStr = value.toLocaleString("en-US");
  const lineDraw = interpolate(frame, [4, 28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const subIn = interpolate(frame, [22, 36], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: BG, opacity }}>
      {/* Dashed frame top */}
      <div
        style={{
          position: "absolute",
          left: "5%",
          top: "5%",
          width: `${90 * lineDraw}%`,
          height: 1,
          borderTop: `2px dashed ${ORANGE}`,
          opacity: 0.7,
        }}
      />
      {/* Dashed frame bottom */}
      <div
        style={{
          position: "absolute",
          left: "5%",
          bottom: "5%",
          width: `${90 * lineDraw}%`,
          height: 1,
          borderBottom: `2px dashed ${ORANGE}`,
          opacity: 0.7,
        }}
      />
      {/* Inner horizontal rules */}
      <div
        style={{
          position: "absolute",
          left: "5%",
          top: "35%",
          width: `${90 * lineDraw}%`,
          height: 1,
          borderTop: `1px dashed ${ORANGE_DIM}`,
          opacity: 0.6,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "5%",
          top: "65%",
          width: `${90 * lineDraw}%`,
          height: 1,
          borderBottom: `1px dashed ${ORANGE_DIM}`,
          opacity: 0.6,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontFamily: FONT_SANS,
            fontWeight: 700,
            fontSize: height * 0.13,
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
            textAlign: "center",
          }}
        >
          <span style={{ color: ORANGE }}>{valueStr}</span>{" "}
          <span style={{ color: TEXT }}>Actors.</span>
        </div>
        <div
          style={{
            fontFamily: FONT_SANS,
            fontWeight: 700,
            fontSize: height * 0.11,
            letterSpacing: "-0.02em",
            color: TEXT,
            opacity: subIn,
            transform: `translateY(${interpolate(subIn, [0, 1], [16, 0])}px)`,
            marginTop: height * 0.008,
          }}
        >
          Now in your stack.
        </div>
      </div>
    </AbsoluteFill>
  );
}

// SCENE 17 — Apify logo: triangles assemble + wordmark slides in
function S17_ApifyLogo({ total }: SceneProps) {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const opacity = fadeIO(frame, total);
  const orange = spring({ frame: frame - 4, fps: 25, config: { damping: 220 } });
  const green = spring({ frame: frame - 12, fps: 25, config: { damping: 220 } });
  const blue = spring({ frame: frame - 18, fps: 25, config: { damping: 220 } });
  const word = spring({ frame: frame - 28, fps: 25, config: { damping: 200 } });

  const logoSize = height * 0.18;

  return (
    <AbsoluteFill style={{ background: BG, opacity, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: height * 0.025 }}>
        {/* Logo (svg path approximation: orange triangle big + green + blue caps) */}
        <svg width={logoSize} height={logoSize} viewBox="0 0 100 100">
          {/* Orange upward triangle (base) */}
          <polygon
            points="20,90 80,90 50,30"
            fill="#F86606"
            opacity={orange}
            transform={`translate(0 ${(1 - orange) * 30})`}
          />
          {/* Green triangle (left top) */}
          <polygon
            points="20,18 50,18 35,55"
            fill="#20A34E"
            opacity={green}
            transform={`translate(${(1 - green) * -20} 0)`}
          />
          {/* Blue triangle (right top) */}
          <polygon
            points="50,18 80,18 65,55"
            fill="#246DFF"
            opacity={blue}
            transform={`translate(${(1 - blue) * 20} 0)`}
          />
        </svg>
        <div
          style={{
            fontFamily: FONT_SANS,
            fontWeight: 700,
            fontSize: logoSize * 0.85,
            color: TEXT,
            letterSpacing: "-0.04em",
            opacity: word,
            transform: `translateX(${interpolate(word, [0, 1], [-40, 0])}px)`,
          }}
        >
          apify
        </div>
      </div>
    </AbsoluteFill>
  );
}

// =============================================================
// Composition: sequence the scenes
// =============================================================

interface SceneEntry {
  Component: React.ComponentType<SceneProps & { stepNum?: string; stepText?: string }>;
  dur: number; // frames
  props?: Record<string, string>;
}

const SCENES: SceneEntry[] = [
  { Component: S01_Opening, dur: 100 },                                                // 4.0s
  { Component: S02_Pivot, dur: 100 },                                                   // 4.0s
  { Component: S03_IntroducingLines, dur: 95 },                                         // 3.8s
  { Component: S04_MCPConnectorsTitle, dur: 85 },                                       // 3.4s
  { Component: GridScene, dur: 75, props: { stepNum: "1", stepText: "Authorize once" } },// 3.0s
  { Component: S06_MCPBarBuilds, dur: 80 },                                             // 3.2s
  { Component: S07_ZoomToButton, dur: 75 },                                             // 3.0s
  { Component: S08_ModalOpens, dur: 85 },                                               // 3.4s
  { Component: S09_DropdownNotion, dur: 95 },                                           // 3.8s
  { Component: S10_AuthorizeClick, dur: 70 },                                           // 2.8s
  { Component: S11_ConnectionSuccess, dur: 110 },                                       // 4.4s
  { Component: GridScene, dur: 65, props: { stepNum: "2", stepText: "Pick your connection" } }, // 2.6s
  { Component: GridScene, dur: 65, props: { stepNum: "3", stepText: "Run it" } },       // 2.6s
  { Component: S14_CafeTable, dur: 130 },                                               // 5.2s
  { Component: S15_YourCredentials, dur: 110 },                                         // 4.4s
  { Component: S16_30kActors, dur: 115 },                                               // 4.6s
  { Component: S17_ApifyLogo, dur: 100 },                                               // 4.0s
];

const OVERLAP = 8;
const STARTS: number[] = (() => {
  const out: number[] = [];
  let t = 0;
  for (let i = 0; i < SCENES.length; i++) {
    out.push(t);
    t += SCENES[i].dur - OVERLAP;
  }
  return out;
})();
export const durationInFrames =
  STARTS[STARTS.length - 1] + SCENES[SCENES.length - 1].dur;

const Composition: React.FC = () => (
  <AbsoluteFill style={{ background: "#0a0a0a" }}>
    {SCENES.map((s, i) => {
      const { Component, dur, props } = s;
      return (
        <Sequence key={i} from={STARTS[i]} durationInFrames={dur}>
          <Component total={dur} {...(props || {})} />
        </Sequence>
      );
    })}
  </AbsoluteFill>
);

export default Composition;
