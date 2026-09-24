import React from "react";
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  staticFile,
  useVideoConfig,
  useCurrentFrame,
  interpolate,
  Easing,
} from "remotion";
import { BRAND } from "../theme";

// --- Animated dot-grid background (ported from the "Background dots pop-in"
// project): dots scale up in a diagonal staggered wave, then hold. Exported so
// a multi-section composition can paint ONE persistent copy at its root
// (driven by the root frame, so it never resets) and pass
// `showBackground={false}` to FramedRecording instances embedded inside it. ---
const DOT_COLOR = "#F86606";
const VB_WIDTH = 3846;
const VB_HEIGHT = 2459;
const TILE_W = 269.64;
const TILE_H = 224.7;
const SCALE = 3.21;
const DOT_OFFSETS_PATTERN: Array<[number, number]> = [
  [7, 7], [7, 30], [7, 52],
  [36, 7], [36, 30], [36, 52],
  [65, 7], [65, 30], [65, 52],
];
const DOTS: Array<{ x: number; y: number }> = (() => {
  const out: Array<{ x: number; y: number }> = [];
  const cols = Math.ceil(VB_WIDTH / TILE_W) + 1;
  const rows = Math.ceil(VB_HEIGHT / TILE_H) + 1;
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      for (const [px, py] of DOT_OFFSETS_PATTERN) {
        const x = tx * TILE_W + px * SCALE;
        const y = ty * TILE_H + py * SCALE;
        if (x < 0 || x > VB_WIDTH || y < 0 || y > VB_HEIGHT) continue;
        out.push({ x, y });
      }
    }
  }
  return out;
})();
const DIAG_MAX = VB_WIDTH + VB_HEIGHT;
const STAGGER_FRAMES = 45;
const POP_FRAMES = 22;
const DECELERATE = Easing.out(Easing.exp);

export const BackgroundDots: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: BRAND.colors.bg }}>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${VB_WIDTH} ${VB_HEIGHT}`}
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        {DOTS.map((d, i) => {
          const delay = ((d.x + d.y) / DIAG_MAX) * STAGGER_FRAMES;
          const scale = interpolate(frame - delay, [0, POP_FRAMES], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: DECELERATE,
          });
          return <circle key={i} cx={d.x} cy={d.y} r={SCALE * scale} fill={DOT_COLOR} />;
        })}
      </svg>
    </AbsoluteFill>
  );
};

// Channel-ready framing for the Brand Deal Spy screen recording: the raw
// capture sits in a rounded, shadowed panel over the animated dot-grid
// background — filling a clean 16:9 frame, recording pixels untouched.
export type FramedRecordingProps = {
  videoSrc: string; // staticFile() path to the recording
  aspect: number; // recording width / height
  heightFraction?: number; // panel height as a fraction of canvas height
  showLogo?: boolean;
  /** Paint the dot-grid bg + bg fill. Set false when embedding inside a
   *  composition that already paints ONE persistent background — otherwise
   *  the dot pop-in replays (and resets) every time this scene mounts. */
  showBackground?: boolean;
  /** Trim the SOURCE recording, in seconds. Omit sourceOutSec to play to the
   *  natural end of the display window. */
  sourceInSec?: number;
  sourceOutSec?: number;
  /** Frames this instance is on screen for (its enclosing Sequence's
   *  duration). Required to trim/hold correctly; ignored otherwise. */
  displayDurationInFrames?: number;
  /** When the trimmed clip is shorter than displayDurationInFrames, hold on
   *  its last frame for the remainder instead of letting playback continue
   *  past the intended source window. Default true. */
  holdLastFrame?: boolean;
  /** Mute the recording's own embedded audio. Set true whenever the
   *  composition plays its own VO/audio track over this footage — otherwise
   *  the source recording's captured sound plays underneath and clashes with
   *  it. Default false (preserves standalone playback, e.g. BrandDealSpyFrame,
   *  where the recording's own audio IS the soundtrack). */
  muted?: boolean;
  /** staticFile() path to a still image of the exact frame at sourceOutSec —
   *  a pre-extracted PNG/JPG (e.g. via `ffmpeg -ss <t> -frames:v 1`). When the
   *  clip is shorter than the display window and holdLastFrame is on, the
   *  hold renders THIS instead of continuing to decode video: interactively
   *  scrubbing/playing a long hold by re-seeking OffthreadVideo every frame
   *  is what actually caused stutter/buffering in the Player — a static
   *  image has none of that cost. Falls back to the (heavier) video-based
   *  hold when omitted. */
  heldImageSrc?: string;
};

// Plays [sourceInSec, sourceOutSec] of `videoSrc` for up to `displayFrames`
// composition frames, then holds the last decoded frame for whatever display
// time remains — so a short source cut never has to drift past its intended
// timecode to fill a longer VO line.
//
// This recomputes a single-frame `trimBefore` every frame rather than using
// <Freeze>: OffthreadVideo's seek is (local frame + trimBefore) / fps, and
// <Freeze> only overrides "local frame" correctly when the frozen element
// sits directly under the composition root — nested two or more <Sequence>s
// deep (as any per-beat mount inside a scene is), it silently seeks to frame
// 0 instead. Recomputing trimBefore to CANCEL the local frame's own advance
// (trimBefore = target − frame) holds on the same source instant regardless
// of nesting depth, using only the plain trimBefore behavior that already
// works correctly at any depth.
const TrimmedVideo: React.FC<{
  videoSrc: string;
  sourceInSec: number;
  sourceOutSec?: number;
  displayFrames: number;
  holdLastFrame: boolean;
  muted: boolean;
  heldImageSrc?: string;
  style: React.CSSProperties;
}> = ({ videoSrc, sourceInSec, sourceOutSec, displayFrames, holdLastFrame, muted, heldImageSrc, style }) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const trimBeforeBase = Math.round(sourceInSec * fps);
  const clipFrames =
    sourceOutSec != null
      ? Math.max(1, Math.round((sourceOutSec - sourceInSec) * fps))
      : displayFrames;
  const playFrames = Math.min(clipFrames, displayFrames);
  const isHolding = holdLastFrame && frame >= playFrames;

  if (isHolding && heldImageSrc) {
    return <Img src={heldImageSrc} style={style} />;
  }

  const heldFrame = holdLastFrame ? Math.min(frame, playFrames - 1) : frame;
  return (
    <OffthreadVideo
      src={videoSrc}
      trimBefore={trimBeforeBase + heldFrame - frame}
      muted={muted}
      volume={muted ? 0 : 1}
      style={style}
    />
  );
};

const FramedRecording: React.FC<FramedRecordingProps> = ({
  videoSrc,
  aspect,
  heightFraction = 0.9,
  showLogo = false,
  showBackground = true,
  sourceInSec,
  sourceOutSec,
  displayDurationInFrames,
  holdLastFrame = true,
  muted = false,
  heldImageSrc,
}) => {
  const { width, height, durationInFrames: ownDuration } = useVideoConfig();
  const base = Math.min(width, height);

  const panelH = height * heightFraction;
  const panelW = panelH * aspect;
  const radius = base * 0.018;
  const videoStyle: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover" };

  return (
    <AbsoluteFill style={{ backgroundColor: showBackground ? BRAND.colors.bg : "transparent" }}>
      {showBackground && <BackgroundDots />}

      {/* Soft orange glow for depth */}
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            width: panelW * 1.15,
            height: panelH * 1.15,
            background: `radial-gradient(ellipse at center, ${BRAND.colors.orange}26 0%, rgba(0,0,0,0) 68%)`,
            filter: `blur(${base * 0.03}px)`,
          }}
        />
      </AbsoluteFill>

      {/* Recording in a rounded, shadowed panel */}
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            width: panelW,
            height: panelH,
            borderRadius: radius,
            overflow: "hidden",
            backgroundColor: BRAND.colors.card,
            border: `1px solid rgba(255,255,255,0.08)`,
            boxShadow: `0 ${base * 0.038}px ${base * 0.11}px rgba(0,0,0,0.65), 0 ${base * 0.008}px ${base * 0.022}px rgba(0,0,0,0.45)`,
          }}
        >
          {sourceInSec != null ? (
            <TrimmedVideo
              videoSrc={videoSrc}
              sourceInSec={sourceInSec}
              sourceOutSec={sourceOutSec}
              displayFrames={displayDurationInFrames ?? ownDuration}
              holdLastFrame={holdLastFrame}
              muted={muted}
              heldImageSrc={heldImageSrc}
              style={videoStyle}
            />
          ) : (
            <OffthreadVideo src={videoSrc} muted={muted} volume={muted ? 0 : 1} style={videoStyle} />
          )}
        </div>
      </AbsoluteFill>

      {showLogo && (
        <Img
          src={staticFile("assets/logos/Brand.svg")}
          style={{
            position: "absolute",
            bottom: base * 0.04,
            left: base * 0.045,
            height: base * 0.03,
            opacity: 0.85,
          }}
        />
      )}
    </AbsoluteFill>
  );
};

export default FramedRecording;
