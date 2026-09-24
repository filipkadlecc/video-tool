import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  staticFile,
} from "remotion";
import { BRAND, BRAND_FONT_FACE_CSS } from "../theme";
import {
  springIn,
  staggeredSpring,
  ambientDrift,
  drawPath,
  SPRINGS,
  TIMING,
} from "../motion";
import { cameraDrift } from "../transitions";
import FramedRecording, { BackgroundDots } from "./FramedRecording";
import voRaw from "../../public/assets/vo/grok-viral-dashboard/vo.json";

// =============================================================================
// GrokViralDashboard — VO-driven explainer. No presenter; screen recording
// carries the demo beats, branded motion graphics carry everything else.
// Every Sequence hangs off scripts/vo/grok-viral-dashboard.vo's manifest —
// nothing below is hand-timed against the audio.
// =============================================================================

interface VoLine {
  index: number;
  kind: "speech" | "pause";
  section?: string;
  text?: string;
  startFrame: number;
  durationInFrames: number;
  endFrame: number;
}
const vo = voRaw as unknown as { fps: number; durationInFrames: number; audio: string; lines: VoLine[] };

export const fps: number = vo.fps;
export const durationInFrames: number = vo.durationInFrames;

const C = BRAND.colors;
const F = BRAND.fonts;
const ACCENT = C.orange;
const MONO = "ui-monospace, 'SF Mono', Menlo, monospace";

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

function linesOf(section: string): VoLine[] {
  return vo.lines.filter((l) => l.section === section);
}

// No forced alignment exists for TTS lines (they're synthesised, not
// transcribed) — Kokoro reads at a roughly constant pace, so character offset
// inside a line is a fair proxy for "when in this line is X said."
function wordFrame(line: VoLine, needle: string): number {
  const idx = line.text ? line.text.indexOf(needle) : -1;
  const frac = idx < 0 || !line.text ? 0.5 : idx / line.text.length;
  return Math.round(line.startFrame + frac * line.durationInFrames);
}

// Remuxed from the raw capture: audio stream dropped (the source recording
// had its own mic track, which played underneath the VO) and -movflags
// +faststart applied (ffmpeg -c:v copy -an -movflags +faststart) — without
// faststart the moov atom sits at the END of a 100MB+ file, which is exactly
// the kind of file a browser <video> tag can stall or fail to load/seek in
// the live preview (an offline render never hits this — it extracts frames
// a different way). Renamed each time the file's bytes changed so no stale
// cached copy under an old URL can get served.
const FOOTAGE = staticFile("assets/footage/grok-02-720p.mp4");
const FOOTAGE_ASPECT = 16 / 9; // placeholder 720p capture; adjust if the 4K re-export differs

// Pre-extracted stills of each clip's last frame (ffmpeg -ss <t> -frames:v 1)
// for the long holds — see FramedRecording's heldImageSrc doc for why.
const HOLD_FILTERS = staticFile("assets/footage/holds/filters-hold.jpg");
const HOLD_TOPTHREE = staticFile("assets/footage/holds/topthree-hold.jpg");
const HOLD_STANDING = staticFile("assets/footage/holds/standing-hold.jpg");
const HOLD_TELEGRAM_GOTCHA = staticFile("assets/footage/holds/telegram-gotcha-hold.jpg");

// =============================================================================
// Section shell — hangs a scene off the manifest's [start,end) for a named
// section and fades its content in/out against the persistent root
// background (never against black — see BackgroundDots at the root).
// =============================================================================

const SECTION_FADE = 16;

const SectionFade: React.FC<{ duration: number; noExitFade?: boolean; children: React.ReactNode }> = ({
  duration,
  noExitFade,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps: vfps } = useVideoConfig();
  const inProg = springIn(frame, vfps, 0, "LIQUID");
  const outProg = noExitFade
    ? 1
    : interpolate(frame, [duration - SECTION_FADE, duration], [1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
  return <AbsoluteFill style={{ opacity: Math.min(inProg, outProg) }}>{children}</AbsoluteFill>;
};

const Section: React.FC<{
  name: string;
  noExitFade?: boolean;
  children: (lines: VoLine[], start: number, duration: number) => React.ReactNode;
}> = ({ name, noExitFade, children }) => {
  const lines = linesOf(name);
  const start = Math.min(...lines.map((l) => l.startFrame));
  const end = Math.max(...lines.map((l) => l.endFrame));
  const duration = end - start;
  return (
    <Sequence from={start} durationInFrames={duration}>
      <SectionFade duration={duration} noExitFade={noExitFade}>
        {children(lines, start, duration)}
      </SectionFade>
    </Sequence>
  );
};

// =============================================================================
// Shared primitives
// =============================================================================

function useCountUp(frame: number, vfps: number, target: number, delay: number, preset: keyof typeof SPRINGS = "LIQUID") {
  const p = springIn(frame, vfps, delay, preset);
  return Math.round(interpolate(p, [0, 1], [0, target]));
}

const Tag: React.FC<{ label: string; base: number; accent?: boolean; style?: React.CSSProperties }> = ({
  label,
  base,
  accent,
  style,
}) => (
  <div
    style={{
      background: accent ? C.orangeTint : C.card,
      border: `${Math.max(1.5, base * 0.0018)}px solid ${accent ? ACCENT : C.border}`,
      borderRadius: base * 0.01,
      padding: `${base * 0.011}px ${base * 0.018}px`,
      fontFamily: MONO,
      fontWeight: 400,
      fontSize: base * 0.018,
      color: accent ? ACCENT : C.text,
      whiteSpace: "nowrap",
      ...style,
    }}
  >
    {label}
  </div>
);

const FieldPill: React.FC<{ label?: string; base: number; accent?: boolean; empty?: boolean; progress: number }> = ({
  label,
  base,
  accent,
  empty,
  progress,
}) => (
  <div
    style={{
      flex: 1,
      textAlign: "center",
      padding: `${base * 0.014}px ${base * 0.012}px`,
      borderRadius: base * 0.009,
      fontFamily: empty ? F.primary : MONO,
      fontWeight: empty ? 400 : 500,
      fontSize: empty ? base * 0.016 : base * 0.019,
      letterSpacing: empty ? "0.02em" : "0",
      color: empty ? C.textSubtle : accent ? ACCENT : C.text,
      background: accent ? C.orangeTint : "transparent",
      border: empty ? `${Math.max(1.5, base * 0.0016)}px dashed ${C.border}` : "none",
      opacity: progress,
      transform: `translateY(${interpolate(progress, [0, 1], [10, 0])}px) scale(${interpolate(progress, [0, 1], [0.9, 1])})`,
    }}
  >
    {empty ? "— none —" : label}
  </div>
);

const CaptionStrip: React.FC<{ text: string; base: number; width: number; progress: number; bottom?: number }> = ({
  text,
  base,
  width,
  progress,
  bottom,
}) => (
  <div
    style={{
      position: "absolute",
      left: width * 0.08,
      right: width * 0.08,
      bottom: bottom ?? base * 0.07,
      textAlign: "center",
      fontFamily: F.primary,
      fontWeight: 500,
      fontSize: base * 0.026,
      color: C.textMuted,
      opacity: progress,
      transform: `translateY(${interpolate(progress, [0, 1], [12, 0])}px)`,
    }}
  >
    {text}
  </div>
);

const CornerCard: React.FC<{
  align: "left" | "right";
  base: number;
  progress: number;
  children: React.ReactNode;
}> = ({ align, base, progress, children }) => (
  <div
    style={{
      position: "absolute",
      bottom: base * 0.07,
      ...(align === "left" ? { left: base * 0.05 } : { right: base * 0.05 }),
      display: "flex",
      flexDirection: "column",
      gap: base * 0.014,
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: base * 0.014,
      padding: `${base * 0.022}px ${base * 0.028}px`,
      boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
      opacity: progress,
      transform: `translateY(${interpolate(progress, [0, 1], [22, 0])}px)`,
    }}
  >
    {children}
  </div>
);

// =============================================================================
// HOOK — cold open on the stat.
// =============================================================================

const HookScene: React.FC<{ lines: VoLine[]; start: number }> = ({ lines, start }) => {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();
  const base = Math.min(width, height);
  const [l0, l1, l2, l3] = lines;
  const local = (l: VoLine) => l.startFrame - start;

  const likesIn = springIn(frame, vfps, local(l0) + Math.round(l0.durationInFrames * 0.32), "SNAPPY");
  const savesIn = springIn(frame, vfps, local(l0) + Math.round(l0.durationInFrames * 0.7), "ELASTIC");
  const captionIn = springIn(frame, vfps, local(l1), "GENTLE");
  const chipsBase = local(l2);
  const cueIn = springIn(frame, vfps, local(l3), "SNAPPY");

  const likes = useCountUp(frame, vfps, 2158, local(l0) + Math.round(l0.durationInFrames * 0.32));
  const saves = useCountUp(frame, vfps, 5834, local(l0) + Math.round(l0.durationInFrames * 0.7), "ELASTIC");
  const drift = ambientDrift(frame, 4, 90, "hook");

  return (
    <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: base * 0.032 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: base * 0.024,
            transform: `translateY(${drift}px)`,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              opacity: likesIn,
              transform: `translateY(${interpolate(likesIn, [0, 1], [16, 0])}px)`,
            }}
          >
            <div
              style={{
                fontFamily: F.marketing,
                fontWeight: 500,
                fontSize: base * 0.09,
                color: C.textMuted,
                letterSpacing: "-0.03em",
                fontVariantNumeric: "tabular-nums",
                lineHeight: 0.95,
              }}
            >
              {fmt(likes)}
            </div>
            <div style={{ fontFamily: F.primary, fontWeight: 500, fontSize: base * 0.024, color: C.textSubtle }}>
              likes
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              opacity: savesIn,
              transform: `translateY(${interpolate(savesIn, [0, 1], [26, 0])}px) scale(${interpolate(savesIn, [0, 1], [0.82, 1])})`,
            }}
          >
            <div
              style={{
                fontFamily: F.marketing,
                fontWeight: 500,
                fontSize: base * 0.2,
                color: C.text,
                letterSpacing: "-0.04em",
                fontVariantNumeric: "tabular-nums",
                lineHeight: 0.9,
              }}
            >
              {fmt(saves)}
            </div>
            <div
              style={{
                fontFamily: F.primary,
                fontWeight: 500,
                fontSize: base * 0.032,
                color: ACCENT,
                background: C.orangeTint,
                borderBottom: `${Math.max(3, base * 0.004)}px solid ${ACCENT}`,
                padding: `${base * 0.004}px ${base * 0.016}px`,
                borderRadius: base * 0.008,
                marginTop: base * 0.01,
              }}
            >
              saves
            </div>
          </div>
        </div>

        <div
          style={{
            fontFamily: F.primary,
            fontWeight: 500,
            fontSize: base * 0.028,
            color: C.textMuted,
            textAlign: "center",
            maxWidth: width * 0.6,
            opacity: captionIn,
            transform: `translateY(${interpolate(captionIn, [0, 1], [12, 0])}px)`,
          }}
        >
          You never saw it. Analytics only cover your own posts.
        </div>

        <div style={{ display: "flex", gap: base * 0.016, marginTop: base * 0.006 }}>
          {["X", "TikTok", "Instagram"].map((p, i) => {
            const chipIn = staggeredSpring(frame, vfps, i, chipsBase, 8, "SNAPPY");
            return (
              <div
                key={p}
                style={{
                  opacity: chipIn,
                  transform: `translateY(${interpolate(chipIn, [0, 1], [14, 0])}px)`,
                }}
              >
                <Tag label={p} base={base} style={{ fontFamily: F.primary, fontSize: base * 0.02 }} />
              </div>
            );
          })}
        </div>

        <div
          style={{
            fontFamily: F.marketing,
            fontWeight: 500,
            fontSize: base * 0.03,
            color: C.text,
            opacity: cueIn,
            marginTop: base * 0.01,
          }}
        >
          Here&rsquo;s how.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// =============================================================================
// SETUP — Grok Bot marketplace tile → Apify plugin → signed in.
// =============================================================================

const SetupTile: React.FC<{ label: string; sub: string; base: number; progress: number; badge?: string }> = ({
  label,
  sub,
  base,
  progress,
  badge,
}) => (
  <div
    style={{
      position: "relative",
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: base * 0.018,
      padding: `${base * 0.03}px ${base * 0.034}px`,
      minWidth: base * 0.24,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: base * 0.01,
      opacity: progress,
      transform: `translateY(${interpolate(progress, [0, 1], [26, 0])}px) scale(${interpolate(progress, [0, 1], [0.9, 1])})`,
    }}
  >
    <div style={{ fontFamily: F.marketing, fontWeight: 500, fontSize: base * 0.032, color: C.text }}>{label}</div>
    <div style={{ fontFamily: F.primary, fontWeight: 400, fontSize: base * 0.018, color: C.textMuted, textAlign: "center" }}>
      {sub}
    </div>
    {badge && (
      <div
        style={{
          position: "absolute",
          top: -base * 0.014,
          right: -base * 0.014,
          background: ACCENT,
          color: C.bg,
          fontFamily: F.primary,
          fontWeight: 500,
          fontSize: base * 0.015,
          padding: `${base * 0.006}px ${base * 0.012}px`,
          borderRadius: 999,
        }}
      >
        {badge}
      </div>
    )}
  </div>
);

const Connector: React.FC<{ base: number; frame: number; vfps: number; delay: number }> = ({ base, frame, vfps, delay }) => {
  const d = drawPath(frame, vfps, 260, { delay, preset: "LIQUID" });
  const w = base * 0.06;
  return (
    <svg width={w} height={base * 0.01} viewBox="0 0 100 16" style={{ overflow: "visible" }}>
      <path d="M 2 8 L 98 8" stroke={ACCENT} strokeWidth={3} strokeLinecap="round" fill="none" {...d} />
      <path
        d="M 88 2 L 98 8 L 88 14"
        stroke={ACCENT}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={d.opacity}
      />
    </svg>
  );
};

const SetupScene: React.FC<{ lines: VoLine[]; start: number }> = ({ lines, start }) => {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();
  const base = Math.min(width, height);
  const [l0, l1, l2] = lines;
  const local = (l: VoLine) => l.startFrame - start;

  const headIn = springIn(frame, vfps, TIMING.entrance, "SNAPPY");
  const t1 = springIn(frame, vfps, local(l0) + 10, "LIQUID");
  const t2 = springIn(frame, vfps, local(l1) + 10, "LIQUID");
  const t3 = springIn(frame, vfps, local(l2) + 10, "LIQUID");

  return (
    <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: base * 0.05 }}>
        <div
          style={{
            fontFamily: F.marketing,
            fontWeight: 500,
            fontSize: base * 0.05,
            color: C.text,
            textAlign: "center",
            letterSpacing: "-0.02em",
            opacity: headIn,
            transform: `translateY(${interpolate(headIn, [0, 1], [18, 0])}px)`,
          }}
        >
          Grok Bot — xAI&rsquo;s <span style={{ color: ACCENT }}>always-on agent</span>
        </div>

        <div style={{ display: "flex", alignItems: "center" }}>
          <SetupTile label="Grok Bot" sub="marketplace" base={base} progress={t1} />
          <Connector base={base} frame={frame} vfps={vfps} delay={local(l1)} />
          <SetupTile label="Apify plugin" sub="installed" base={base} progress={t2} badge="✓ signed in" />
          <Connector base={base} frame={frame} vfps={vfps} delay={local(l2)} />
          <SetupTile label="MCP + skills" sub="run any Actor by asking" base={base} progress={t3} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// =============================================================================
// THE PROMPT — typing out the three Actor calls, highlighted as spoken.
// =============================================================================

const PROMPT_ROWS: { pre: string; actor: string; post: string }[] = [
  { pre: "Run ", actor: "apidojo/tweet-scraper", post: " sorted by Top." },
  { pre: "Run ", actor: "clockworks/tiktok-scraper", post: " on the video section." },
  { pre: "Run ", actor: "apify/instagram-scraper", post: " on my tag pages." },
];

const PromptScene: React.FC<{ lines: VoLine[]; start: number }> = ({ lines, start }) => {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();
  const base = Math.min(width, height);
  const [l0, l1, l2] = lines;
  const local = (l: VoLine) => l.startFrame - start;

  const boxIn = springIn(frame, vfps, TIMING.entrance, "LIQUID");

  const typeStart = local(l0);
  const typeEnd = local(l1) + Math.round(l1.durationInFrames * 0.55);
  const fullText = PROMPT_ROWS.map((r) => r.pre + r.actor + r.post).join("\n");
  const typedChars = Math.floor(
    interpolate(frame, [typeStart, typeEnd], [0, fullText.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

  const highlightFrames = [
    wordFrame(l1, "Tweet Scraper"),
    wordFrame(l1, "TikTok Scraper"),
    wordFrame(l1, "Instagram Scraper"),
  ];

  const followUpIn = springIn(frame, vfps, local(l2), "GENTLE");

  // Precompute each row's character offsets into fullText (rows joined by
  // "\n") so the typed-character reveal below can stay a pure map.
  const rowOffsets: { rowStart: number; preEnd: number; actorEnd: number; postEnd: number }[] = [];
  for (const row of PROMPT_ROWS) {
    const rowStart = rowOffsets.length === 0 ? 0 : rowOffsets[rowOffsets.length - 1].postEnd + 1; // +1 for the newline
    const preEnd = rowStart + row.pre.length;
    const actorEnd = preEnd + row.actor.length;
    const postEnd = actorEnd + row.post.length;
    rowOffsets.push({ rowStart, preEnd, actorEnd, postEnd });
  }

  return (
    <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          width: width * 0.6,
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: base * 0.018,
          padding: `${base * 0.03}px ${base * 0.036}px`,
          display: "flex",
          flexDirection: "column",
          gap: base * 0.018,
          opacity: boxIn,
          transform: `translateY(${interpolate(boxIn, [0, 1], [24, 0])}px)`,
          boxShadow: "0 30px 90px rgba(0,0,0,0.5)",
        }}
      >
        {PROMPT_ROWS.map((row, i) => {
          const { rowStart, preEnd, actorEnd } = rowOffsets[i];

          const preShown = row.pre.slice(0, Math.max(0, Math.min(row.pre.length, typedChars - rowStart)));
          const actorShown = row.actor.slice(0, Math.max(0, Math.min(row.actor.length, typedChars - preEnd)));
          const postShown = row.post.slice(0, Math.max(0, Math.min(row.post.length, typedChars - actorEnd)));

          const glowP = springIn(frame, vfps, highlightFrames[i], "ELASTIC");

          return (
            <div
              key={row.actor}
              style={{
                fontFamily: F.primary,
                fontWeight: 400,
                fontSize: base * 0.021,
                color: C.text,
                lineHeight: 1.5,
                minHeight: base * 0.032,
              }}
            >
              {preShown}
              {actorShown && (
                <span
                  style={{
                    fontFamily: MONO,
                    fontWeight: 500,
                    color: ACCENT,
                    background: `rgba(248,102,6,${0.1 + 0.22 * glowP})`,
                    borderRadius: base * 0.006,
                    padding: `${base * 0.002}px ${base * 0.008}px`,
                    boxShadow: glowP > 0.05 ? `0 0 ${base * 0.012 * glowP}px rgba(248,102,6,${0.5 * glowP})` : "none",
                  }}
                >
                  {actorShown}
                </span>
              )}
              {postShown}
            </div>
          );
        })}
      </div>

      <div
        style={{
          position: "absolute",
          bottom: base * 0.09,
          fontFamily: F.primary,
          fontWeight: 500,
          fontSize: base * 0.022,
          color: C.textMuted,
          opacity: followUpIn,
          transform: `translateY(${interpolate(followUpIn, [0, 1], [10, 0])}px)`,
        }}
      >
        → show which fields each Actor returned
      </div>
    </AbsoluteFill>
  );
};

// =============================================================================
// FIELD MAPPING — the most important graphic. Three-column reveal landing in
// sync with the VO lines; the saves row is the payload.
// =============================================================================

type PlatformCol = { name: string; likes: string; saves?: string; views?: string; note?: string };
const PLATFORMS: PlatformCol[] = [
  { name: "X", likes: "likeCount", saves: "bookmarkCount", views: "viewCount" },
  { name: "TikTok", likes: "diggCount", saves: "collectCount", views: "playCount" },
  { name: "Instagram", likes: "likesCount", note: "commentsCount also returned" },
];

const FieldMappingScene: React.FC<{ lines: VoLine[]; start: number }> = ({ lines, start }) => {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();
  const base = Math.min(width, height);
  const [l0, l1, l2, l3, l4, l5, l6] = lines;
  const local = (l: VoLine) => l.startFrame - start;

  const tableIn = springIn(frame, vfps, local(l0), "LIQUID");
  const likesRowIn = springIn(frame, vfps, local(l1), "SNAPPY");
  const savesRowIn = springIn(frame, vfps, local(l2), "LIQUID");
  const xSaveIn = springIn(frame, vfps, local(l2) + 6, "ELASTIC");
  const ttSaveIn = springIn(frame, vfps, local(l3) + 6, "ELASTIC");
  const igSaveIn = springIn(frame, vfps, local(l4) + 6, "ELASTIC");
  const noteIn = springIn(frame, vfps, local(l4) + 16, "GENTLE");
  const pulseP = springIn(frame, vfps, local(l5), "GENTLE");
  const pulse = 1 + 0.35 * pulseP * Math.max(0, Math.sin(frame / 5));
  const cautionIn = springIn(frame, vfps, local(l6), "GENTLE");

  const legendW = base * 0.1;
  const tableW = width * 0.8;
  const rowGap = base * 0.014;

  const ROWS: { key: "likes" | "saves" | "views"; label: string; accent?: boolean; progress: number }[] = [
    { key: "likes", label: "Likes", progress: likesRowIn },
    { key: "saves", label: "Saves", accent: true, progress: savesRowIn },
    { key: "views", label: "Views", progress: likesRowIn },
  ];

  return (
    <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: tableW, display: "flex", flexDirection: "column", gap: rowGap }}>
        {/* Header row */}
        <div
          style={{
            display: "flex",
            gap: base * 0.016,
            opacity: tableIn,
            transform: `translateY(${interpolate(tableIn, [0, 1], [-14, 0])}px)`,
          }}
        >
          <div style={{ width: legendW, flexShrink: 0 }} />
          {PLATFORMS.map((p) => (
            <div
              key={p.name}
              style={{
                flex: 1,
                textAlign: "center",
                fontFamily: F.marketing,
                fontWeight: 500,
                fontSize: base * 0.034,
                color: C.text,
                letterSpacing: "-0.015em",
              }}
            >
              {p.name}
            </div>
          ))}
        </div>

        {ROWS.map((row) => {
          const cellOf = (p: PlatformCol) => p[row.key];
          const perCellProgress = (i: number) =>
            row.key === "saves" ? [xSaveIn, ttSaveIn, igSaveIn][i] : row.progress;
          const bandGlow =
            row.key === "saves"
              ? `0 0 ${base * 0.03 * pulse - base * 0.03}px rgba(248,102,6,${0.25 * pulseP})`
              : "none";

          return (
            <div
              key={row.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: base * 0.016,
                borderRadius: base * 0.012,
                padding: `${base * 0.01}px ${base * 0.008}px`,
                background: row.accent ? `rgba(248,102,6,${0.07 * row.progress})` : "transparent",
                border: row.accent ? `1px solid rgba(248,102,6,${0.35 * row.progress})` : "1px solid transparent",
                boxShadow: bandGlow,
                opacity: row.progress,
                transform: `translateY(${interpolate(row.progress, [0, 1], [12, 0])}px)`,
              }}
            >
              <div
                style={{
                  width: legendW,
                  flexShrink: 0,
                  fontFamily: F.primary,
                  fontWeight: 500,
                  fontSize: base * 0.02,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: row.accent ? ACCENT : C.textSubtle,
                }}
              >
                {row.label}
              </div>
              {PLATFORMS.map((p, i) => {
                const val = cellOf(p);
                return (
                  <FieldPill
                    key={p.name + row.key}
                    base={base}
                    label={val}
                    empty={!val}
                    accent={row.accent && !!val}
                    progress={perCellProgress(i)}
                  />
                );
              })}
            </div>
          );
        })}

        <div style={{ display: "flex", gap: base * 0.016 }}>
          <div style={{ width: legendW, flexShrink: 0 }} />
          {PLATFORMS.map((p) => (
            <div
              key={p.name + "-note"}
              style={{
                flex: 1,
                textAlign: "center",
                fontFamily: F.primary,
                fontWeight: 400,
                fontSize: base * 0.015,
                color: C.textSubtle,
                opacity: p.note ? noteIn : 0,
              }}
            >
              {p.note ?? ""}
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: base * 0.06,
          left: width * 0.1,
          right: width * 0.1,
          textAlign: "center",
          fontFamily: F.primary,
          fontWeight: 500,
          fontSize: base * 0.022,
          color: C.textMuted,
          opacity: cautionIn,
          transform: `translateY(${interpolate(cautionIn, [0, 1], [10, 0])}px)`,
        }}
      >
        Skip this, and the ranking guesses — plays counted as impressions.
      </div>
    </AbsoluteFill>
  );
};

// =============================================================================
// INSTAGRAM — the substitution, shown as a swap.
// =============================================================================

const InstagramScene: React.FC<{ lines: VoLine[]; start: number }> = ({ lines, start }) => {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();
  const base = Math.min(width, height);
  const [l0, l1] = lines;
  const local = (l: VoLine) => l.startFrame - start;

  const headIn = springIn(frame, vfps, local(l0), "SNAPPY");
  const emptyIn = springIn(frame, vfps, local(l0) + 10, "LIQUID");
  const swapP = springIn(frame, vfps, local(l1) + Math.round(l1.durationInFrames * 0.25), "ELASTIC");
  const formulaIn = springIn(frame, vfps, local(l1) + Math.round(l1.durationInFrames * 0.55), "GENTLE");

  const flip = interpolate(swapP, [0, 1], [0, 180]);
  const showBack = flip > 90;

  return (
    <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: base * 0.04 }}>
        <div
          style={{
            fontFamily: F.marketing,
            fontWeight: 500,
            fontSize: base * 0.044,
            color: C.text,
            textAlign: "center",
            opacity: headIn,
            transform: `translateY(${interpolate(headIn, [0, 1], [18, 0])}px)`,
          }}
        >
          Instagram &mdash; <span style={{ color: ACCENT }}>saves needs a decision</span>
        </div>

        <div
          style={{
            perspective: 1200,
            opacity: emptyIn,
          }}
        >
          <div
            style={{
              minWidth: base * 0.3,
              textAlign: "center",
              transformStyle: "preserve-3d",
              transform: `rotateY(${flip}deg)`,
            }}
          >
            {/* Only one face is ever laid out at a time (the other is
                display:none) — at the 90deg midpoint both are edge-on and
                invisible via backfaceVisibility, so there's no moment that
                needs them to share a box; each is free to size to its own
                content. */}
            <div
              style={{
                boxSizing: "border-box",
                backfaceVisibility: "hidden",
                border: `${Math.max(2, base * 0.002)}px dashed ${C.border}`,
                borderRadius: base * 0.016,
                padding: `${base * 0.026}px ${base * 0.04}px`,
                fontFamily: F.primary,
                fontWeight: 400,
                fontSize: base * 0.022,
                color: C.textSubtle,
                whiteSpace: "nowrap",
                display: showBack ? "none" : "block",
              }}
            >
              — no save count —
            </div>
            <div
              style={{
                boxSizing: "border-box",
                backfaceVisibility: "hidden",
                transform: "rotateY(180deg)",
                border: `${Math.max(2, base * 0.002)}px solid ${ACCENT}`,
                background: C.orangeTint,
                borderRadius: base * 0.016,
                padding: `${base * 0.026}px ${base * 0.04}px`,
                fontFamily: MONO,
                fontWeight: 500,
                fontSize: base * 0.024,
                color: ACCENT,
                whiteSpace: "nowrap",
                display: showBack ? "block" : "none",
              }}
            >
              ig_comment_like_ratio
            </div>
          </div>
        </div>

        <div
          style={{
            fontFamily: F.primary,
            fontWeight: 500,
            fontSize: base * 0.022,
            color: C.textMuted,
            opacity: formulaIn,
            transform: `translateY(${interpolate(formulaIn, [0, 1], [10, 0])}px)`,
          }}
        >
          commentsCount ÷ likesCount &mdash; labelled separately, never read as a save
        </div>
      </div>
    </AbsoluteFill>
  );
};

// =============================================================================
// BUILD, FILTERS, TOP THREE, STANDING, TELEGRAM — recording-carried sections.
// =============================================================================

const BuildScene: React.FC<{ lines: VoLine[]; start: number; duration: number }> = ({ lines, start, duration }) => {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();
  const base = Math.min(width, height);
  const [, l1] = lines;
  const local = (l: VoLine) => l.startFrame - start;
  const tagIn = springIn(frame, vfps, local(l1), "SNAPPY");

  return (
    <AbsoluteFill>
      <FramedRecording
        videoSrc={FOOTAGE}
        aspect={FOOTAGE_ASPECT}
        showBackground={false}
        muted
        sourceInSec={100}
        sourceOutSec={116}
        displayDurationInFrames={duration}
      />
      <CornerCard align="left" base={base} progress={tagIn}>
        <div style={{ fontFamily: F.marketing, fontWeight: 500, fontSize: base * 0.024, color: C.text }}>
          Scrapers running <span style={{ color: ACCENT }}>in parallel</span>
        </div>
      </CornerCard>
    </AbsoluteFill>
  );
};

const FiltersScene: React.FC<{ lines: VoLine[]; start: number; duration: number }> = ({ lines, start, duration }) => {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();
  const base = Math.min(width, height);
  const [, l1, l2] = lines;
  const local = (l: VoLine) => l.startFrame - start;

  const keptIn = springIn(frame, vfps, local(l1) + 10, "ELASTIC");
  const kept = useCountUp(frame, vfps, 128, local(l1) + 10, "ELASTIC");
  const dropAIn = springIn(frame, vfps, local(l2) + 10, "SNAPPY");
  const dropBIn = springIn(frame, vfps, local(l2) + 26, "SNAPPY");

  return (
    <AbsoluteFill>
      <FramedRecording
        videoSrc={FOOTAGE}
        aspect={FOOTAGE_ASPECT}
        showBackground={false}
        muted
        sourceInSec={115.5}
        sourceOutSec={119}
        displayDurationInFrames={duration}
        heldImageSrc={HOLD_FILTERS}
      />
      <div
        style={{
          position: "absolute",
          left: base * 0.05,
          top: base * 0.08,
          display: "flex",
          flexDirection: "column",
          gap: base * 0.018,
        }}
      >
        <div
          style={{
            background: C.card,
            border: `1px solid ${ACCENT}`,
            borderRadius: base * 0.014,
            padding: `${base * 0.02}px ${base * 0.03}px`,
            opacity: keptIn,
            transform: `translateY(${interpolate(keptIn, [0, 1], [16, 0])}px)`,
          }}
        >
          <div style={{ fontFamily: F.marketing, fontWeight: 500, fontSize: base * 0.05, color: ACCENT, fontVariantNumeric: "tabular-nums" }}>
            {fmt(kept)}
          </div>
          <div style={{ fontFamily: F.primary, fontWeight: 500, fontSize: base * 0.018, color: C.textMuted }}>kept</div>
        </div>
        {[
          { p: dropAIn, v: "4", l: "dropped · under 24h" },
          { p: dropBIn, v: "18", l: "dropped · no save rate" },
        ].map((d) => (
          <div
            key={d.l}
            style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: base * 0.014,
              padding: `${base * 0.014}px ${base * 0.024}px`,
              opacity: d.p,
              transform: `translateY(${interpolate(d.p, [0, 1], [14, 0])}px)`,
              display: "flex",
              alignItems: "baseline",
              gap: base * 0.012,
            }}
          >
            <span style={{ fontFamily: F.marketing, fontWeight: 500, fontSize: base * 0.03, color: C.text }}>{d.v}</span>
            <span style={{ fontFamily: F.primary, fontWeight: 400, fontSize: base * 0.016, color: C.textMuted }}>{d.l}</span>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

const TopThreeScene: React.FC<{ lines: VoLine[]; start: number; duration: number }> = ({ lines, start, duration }) => {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();
  const base = Math.min(width, height);
  const [, l1, l2, l3, l4, l5] = lines;
  const local = (l: VoLine) => l.startFrame - start;

  const ranks = [
    { rank: 1, likes: 2158, saves: 5834, rate: "2.70×", delay: local(l1) + 20 },
    { rank: 2, likes: 1104, saves: 2841, rate: undefined, delay: local(l2) + 10 },
    { rank: 3, likes: 593, saves: 1488, rate: undefined, delay: local(l3) + 10 },
  ];
  const captionIn = springIn(frame, vfps, local(l4), "GENTLE");
  const caption2In = springIn(frame, vfps, local(l5), "GENTLE");

  return (
    <AbsoluteFill>
      <FramedRecording
        videoSrc={FOOTAGE}
        aspect={FOOTAGE_ASPECT}
        showBackground={false}
        muted
        sourceInSec={119}
        sourceOutSec={122.5}
        displayDurationInFrames={duration}
        heldImageSrc={HOLD_TOPTHREE}
      />
      <div
        style={{
          position: "absolute",
          right: base * 0.05,
          top: base * 0.08,
          display: "flex",
          flexDirection: "column",
          gap: base * 0.014,
        }}
      >
        {ranks.map((r) => {
          const p = springIn(frame, vfps, r.delay, "ELASTIC");
          return (
            <div
              key={r.rank}
              style={{
                display: "flex",
                alignItems: "center",
                gap: base * 0.016,
                background: C.card,
                border: `1px solid ${r.rank === 1 ? ACCENT : C.border}`,
                borderRadius: base * 0.014,
                padding: `${base * 0.014}px ${base * 0.022}px`,
                opacity: p,
                transform: `translateX(${interpolate(p, [0, 1], [30, 0])}px)`,
              }}
            >
              <div
                style={{
                  width: base * 0.03,
                  height: base * 0.03,
                  borderRadius: "50%",
                  background: r.rank === 1 ? ACCENT : C.bg,
                  border: `1px solid ${r.rank === 1 ? ACCENT : C.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: F.marketing,
                  fontWeight: 500,
                  fontSize: base * 0.017,
                  color: r.rank === 1 ? C.bg : C.textMuted,
                  flexShrink: 0,
                }}
              >
                {r.rank}
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontFamily: F.primary, fontWeight: 500, fontSize: base * 0.016, color: C.textMuted }}>
                  {fmt(r.likes)} likes · <span style={{ color: r.rank === 1 ? ACCENT : C.text }}>{fmt(r.saves)} saves</span>
                  {r.rate ? ` · ${r.rate}` : ""}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ opacity: Math.min(captionIn, 1) }}>
        <CaptionStrip text="Likes tell you a post was enjoyed." base={base} width={width} progress={captionIn} bottom={base * 0.12} />
        <CaptionStrip
          text="Saves tell you someone intends to come back and do the thing."
          base={base}
          width={width}
          progress={caption2In}
          bottom={base * 0.06}
        />
      </div>
    </AbsoluteFill>
  );
};

const StandingScene: React.FC<{ lines: VoLine[]; start: number; duration: number }> = ({ lines, start, duration }) => {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();
  const base = Math.min(width, height);
  const [, l1] = lines;
  const local = (l: VoLine) => l.startFrame - start;
  const badgeIn = springIn(frame, vfps, local(l1) + 8, "LIQUID");
  const breathe = 1 + ambientDrift(frame, 0.01, 100, "digest");

  return (
    <AbsoluteFill>
      <FramedRecording
        videoSrc={FOOTAGE}
        aspect={FOOTAGE_ASPECT}
        showBackground={false}
        muted
        sourceInSec={128}
        sourceOutSec={131.5}
        displayDurationInFrames={duration}
        heldImageSrc={HOLD_STANDING}
      />
      <CornerCard align="left" base={base} progress={badgeIn}>
        <div style={{ display: "flex", alignItems: "center", gap: base * 0.014 }}>
          <div style={{ width: base * 0.012, height: base * 0.012, borderRadius: "50%", background: ACCENT, transform: `scale(${breathe})` }} />
          <div style={{ fontFamily: F.marketing, fontWeight: 500, fontSize: base * 0.024, color: C.text }}>
            Weekday · 8:00 AM PT · digest <span style={{ color: ACCENT }}>on</span>
          </div>
        </div>
      </CornerCard>
    </AbsoluteFill>
  );
};

const TelegramScene: React.FC<{ lines: VoLine[]; start: number }> = ({ lines, start }) => {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();
  const base = Math.min(width, height);
  const [, tg1, , tg3, tg4, , tgPause] = lines;
  const local = (l: VoLine) => l.startFrame - start;

  // tg0+tg1 ("...BotFather, copy the token, install the Composio plugin...
  // and connect it") covers two separate on-screen moments — split its span
  // between the BotFather token reveal and the Composio connect page.
  const tg1End = tg1.endFrame - start;
  const mBotFrom = 0;
  const mBotDur = Math.round(tg1End * 0.48);
  const mComposioFrom = mBotDur;
  const mComposioDur = tg1End - mBotDur;

  // tg2 ("can't message you first...") is the ONLY line with a literal
  // on-screen match (the agent's own chat explains the same gotcha in text);
  // its clip is short, so it plays once and holds through tg3+tg4 — no
  // footage was shot for those guidance lines, so holding is the honest cut.
  const mGotchaFrom = tg1End;
  const mGotchaDur = tg4.endFrame - start - mGotchaFrom;

  // tg5 + trailing pause: the report actually arriving in Telegram.
  const mArriveFrom = mGotchaFrom + mGotchaDur;
  const mArriveDur = tgPause.endFrame - start - mArriveFrom;

  const guardIn = springIn(frame, vfps, local(tg3), "SNAPPY");

  return (
    <AbsoluteFill>
      <Sequence from={mBotFrom} durationInFrames={mBotDur}>
        <FramedRecording
          videoSrc={FOOTAGE}
          aspect={FOOTAGE_ASPECT}
          showBackground={false}
        muted
          sourceInSec={49}
          sourceOutSec={55}
          displayDurationInFrames={mBotDur}
        />
      </Sequence>
      <Sequence from={mComposioFrom} durationInFrames={mComposioDur}>
        <FramedRecording
          videoSrc={FOOTAGE}
          aspect={FOOTAGE_ASPECT}
          showBackground={false}
        muted
          sourceInSec={69}
          sourceOutSec={76}
          displayDurationInFrames={mComposioDur}
        />
      </Sequence>
      <Sequence from={mGotchaFrom} durationInFrames={mGotchaDur}>
        <FramedRecording
          videoSrc={FOOTAGE}
          aspect={FOOTAGE_ASPECT}
          showBackground={false}
        muted
          sourceInSec={406}
          sourceOutSec={414}
          displayDurationInFrames={mGotchaDur}
          heldImageSrc={HOLD_TELEGRAM_GOTCHA}
        />
      </Sequence>
      <Sequence from={mArriveFrom} durationInFrames={mArriveDur}>
        <FramedRecording
          videoSrc={FOOTAGE}
          aspect={FOOTAGE_ASPECT}
          showBackground={false}
        muted
          sourceInSec={380}
          sourceOutSec={383}
          displayDurationInFrames={mArriveDur}
        />
      </Sequence>

      <CornerCard align="right" base={base} progress={guardIn}>
        <div style={{ display: "flex", flexDirection: "column", gap: base * 0.006 }}>
          <div style={{ fontFamily: F.marketing, fontWeight: 500, fontSize: base * 0.024, color: ACCENT }}>Top 3 only</div>
          <div style={{ fontFamily: F.primary, fontWeight: 400, fontSize: base * 0.016, color: C.textMuted }}>
            save rate + link, nothing else
          </div>
        </div>
      </CornerCard>
    </AbsoluteFill>
  );
};

// =============================================================================
// OUTRO — EndCard / AccountCTA.
// =============================================================================

const OutroScene: React.FC<{ lines: VoLine[]; start: number }> = ({ lines, start }) => {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();
  const base = Math.min(width, height);
  const [ot0, ot1, , ot2, ot3, ot4] = lines;
  const local = (l: VoLine) => l.startFrame - start;

  const kickerIn = springIn(frame, vfps, local(ot0), "SNAPPY");
  const headIn = springIn(frame, vfps, local(ot1), "SNAPPY");
  const bodyIn = springIn(frame, vfps, local(ot2), "GENTLE");
  const body2In = springIn(frame, vfps, local(ot3), "GENTLE");
  const ctaIn = springIn(frame, vfps, local(ot4), "LIQUID");
  const breathe = 1 + ambientDrift(frame, 0.008, 100, "outro-cta");

  return (
    <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: base * 0.026,
          padding: `0 ${base * 0.08}px`,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: F.primary,
            fontWeight: 500,
            fontSize: base * 0.024,
            color: C.textMuted,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            opacity: kickerIn,
          }}
        >
          That&rsquo;s the real shift
        </div>

        <div
          style={{
            fontFamily: F.marketing,
            fontWeight: 500,
            fontSize: base * 0.062,
            color: C.text,
            letterSpacing: "-0.025em",
            lineHeight: 1.08,
            maxWidth: width * 0.66,
            opacity: headIn,
            transform: `translateY(${interpolate(headIn, [0, 1], [22, 0])}px)`,
          }}
        >
          Not a dashboard —{" "}
          <span style={{ color: ACCENT, background: C.orangeTint, padding: `0 ${base * 0.012}px`, borderRadius: base * 0.008 }}>
            a teammate who&rsquo;s already awake
          </span>
          .
        </div>

        <div
          style={{
            fontFamily: F.primary,
            fontWeight: 500,
            fontSize: base * 0.026,
            color: C.textMuted,
            maxWidth: width * 0.56,
            lineHeight: 1.35,
            opacity: bodyIn,
            transform: `translateY(${interpolate(bodyIn, [0, 1], [14, 0])}px)`,
          }}
        >
          The next post that pulls 3× more saves than likes — you don&rsquo;t miss it.
        </div>
        <div
          style={{
            fontFamily: F.primary,
            fontWeight: 500,
            fontSize: base * 0.026,
            color: C.textMuted,
            maxWidth: width * 0.5,
            opacity: body2In,
            transform: `translateY(${interpolate(body2In, [0, 1], [12, 0])}px)`,
          }}
        >
          It&rsquo;s in your messages before you&rsquo;re awake.
        </div>

        <div
          style={{
            marginTop: base * 0.02,
            display: "flex",
            alignItems: "center",
            gap: base * 0.024,
            opacity: ctaIn,
            transform: `translateY(${interpolate(ctaIn, [0, 1], [20, 0])}px) scale(${breathe})`,
          }}
        >
          <div
            style={{
              border: `${Math.max(2, base * 0.0025)}px solid ${ACCENT}`,
              borderRadius: 999,
              padding: `${base * 0.018}px ${base * 0.038}px`,
              fontFamily: F.primary,
              fontWeight: 500,
              fontSize: base * 0.026,
              color: ACCENT,
            }}
          >
            Create a free Apify account
          </div>
          <div style={{ fontFamily: F.primary, fontWeight: 500, fontSize: base * 0.022, color: C.text }}>apify.com</div>
        </div>
        <div
          style={{
            fontFamily: F.primary,
            fontWeight: 400,
            fontSize: base * 0.018,
            color: C.textSubtle,
            opacity: ctaIn,
          }}
        >
          Start with Tweet Scraper.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// =============================================================================
// ROOT
// =============================================================================

export default function GrokViralDashboard() {
  const frame = useCurrentFrame();
  const { durationInFrames: total } = useVideoConfig();
  const camera = cameraDrift(frame, total, { zoom: 0.035, panY: -0.008 });

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <style>{BRAND_FONT_FACE_CSS}</style>
      <Audio src={staticFile(vo.audio)} />

      <AbsoluteFill style={{ transform: camera.transform, transformOrigin: "50% 50%" }}>
        <BackgroundDots />

        <Section name="Hook">{(lines, start) => <HookScene lines={lines} start={start} />}</Section>
        <Section name="Setup">{(lines, start) => <SetupScene lines={lines} start={start} />}</Section>
        <Section name="The prompt">{(lines, start) => <PromptScene lines={lines} start={start} />}</Section>
        <Section name="Field mapping">{(lines, start) => <FieldMappingScene lines={lines} start={start} />}</Section>
        <Section name="Instagram">{(lines, start) => <InstagramScene lines={lines} start={start} />}</Section>
        <Section name="Build">{(lines, start, duration) => <BuildScene lines={lines} start={start} duration={duration} />}</Section>
        <Section name="Filters">{(lines, start, duration) => <FiltersScene lines={lines} start={start} duration={duration} />}</Section>
        <Section name="Top three">{(lines, start, duration) => <TopThreeScene lines={lines} start={start} duration={duration} />}</Section>
        <Section name="Standing">{(lines, start, duration) => <StandingScene lines={lines} start={start} duration={duration} />}</Section>
        <Section name="Telegram">{(lines, start) => <TelegramScene lines={lines} start={start} />}</Section>
        <Section name="Outro" noExitFade>{(lines, start) => <OutroScene lines={lines} start={start} />}</Section>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
