import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { BRAND, BRAND_FONT_FACE_CSS } from "../../theme";
import { springIn } from "../../motion";

export const fps = 25;

// === EDIT THESE for a name tag ===
const NAME = "Speaker Name";
const TITLE = "Speaker Role";
const ALIGN: "left" | "right" = "left";

// === Optional: enable dual-speaker mode ===
// Set DUAL = true and fill in PARTNER_NAME / PARTNER_TITLE to render two cards.
const DUAL = false;
const PARTNER_NAME = "Partner Name";
const PARTNER_TITLE = "Partner Role";

const TRANSITION = 15;
const SCENE_FRAMES = 750; // 30s of hold time at 25fps

// 10 (intro black) + 10 (transition) + 750 + 15 (transition) + 25 (outro black)
// nets to 775 because the intro fade overlaps the BlackScreen 10 + Sequence 750+15.
export const durationInFrames = 775;

const ACCENT = BRAND.colors.orange;

interface PersonCardProps {
  name: string;
  title: string;
  align: "left" | "right";
  entranceDelay: number;
}

const PersonCard: React.FC<PersonCardProps> = ({ name, title, align, entranceDelay }) => {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();
  const base = Math.min(width, height);

  // Card slides in LIQUID (smooth panel feel), inner elements pop with
  // SNAPPY/ELASTIC for personality.
  const containerProgress = springIn(frame, vfps, entranceDelay, "LIQUID");
  const nameProgress = springIn(frame, vfps, entranceDelay + 28, "SNAPPY");
  const lineProgress = springIn(frame, vfps, entranceDelay + 36, "ELASTIC");
  const titleProgress = springIn(frame, vfps, entranceDelay + 43, "GENTLE");

  const exitStart = SCENE_FRAMES - 40;
  const exitEnd = SCENE_FRAMES - 5;
  const exitProgress = interpolate(frame, [exitStart, exitEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const offsetIn = interpolate(containerProgress, [0, 1], [base * 0.055, 0]);
  const offsetOut = interpolate(exitProgress, [0, 1], [0, base * 0.055]);
  const containerY = offsetIn + offsetOut;
  const containerOpacity = Math.min(
    containerProgress,
    interpolate(exitProgress, [0, 1], [1, 0])
  );

  const nameOpacity = Math.min(
    nameProgress,
    interpolate(exitProgress, [0, 1], [1, 0])
  );
  const nameX = interpolate(
    nameProgress,
    [0, 1],
    [align === "left" ? base * 0.018 : -base * 0.018, 0]
  );

  const titleOpacity = Math.min(
    titleProgress,
    interpolate(exitProgress, [0, 1], [1, 0])
  );
  const titleX = interpolate(
    titleProgress,
    [0, 1],
    [align === "left" ? base * 0.018 : -base * 0.018, 0]
  );

  const lineWidth = interpolate(lineProgress, [0, 1], [0, 100]);

  return (
    <div
      style={{
        opacity: containerOpacity,
        transform: `translateY(${containerY}px)`,
        display: "flex",
        flexDirection: "row",
        alignItems: "stretch",
      }}
    >
      <div
        style={{
          backgroundColor: BRAND.colors.card,
          border: `1px solid ${BRAND.colors.border}`,
          borderRadius: base * 0.007,
          padding: `${base * 0.022}px ${base * 0.037}px ${base * 0.022}px ${base * 0.030}px`,
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: base * 0.030,
          boxShadow: `0 ${base * 0.006}px ${base * 0.028}px rgba(0,0,0,0.6), 0 ${base * 0.002}px ${base * 0.006}px rgba(0,0,0,0.4)`,
          whiteSpace: "nowrap",
        }}
      >
        {/* Name + accent line + title */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: base * 0.005,
          }}
        >
          <div
            style={{
              opacity: nameOpacity,
              transform: `translateX(${nameX}px)`,
              fontSize: base * 0.030,
              fontWeight: 700,
              color: BRAND.colors.text,
              letterSpacing: "0.01em",
              lineHeight: 1,
              whiteSpace: "nowrap",
              fontFamily: BRAND.fonts.marketing,
            }}
          >
            {name}
          </div>

          <div
            style={{
              width: `${lineWidth}%`,
              height: Math.max(2, base * 0.0015),
              backgroundColor: ACCENT,
              borderRadius: 2,
              opacity: titleOpacity,
            }}
          />

          <div
            style={{
              opacity: titleOpacity,
              transform: `translateX(${titleX}px)`,
              fontSize: base * 0.022,
              fontWeight: 500,
              color: ACCENT,
              letterSpacing: "0.01em",
              lineHeight: 1,
              whiteSpace: "nowrap",
              fontFamily: BRAND.fonts.primary,
            }}
          >
            {title}
          </div>
        </div>
      </div>
    </div>
  );
};

const SingleLowerThird: React.FC = () => {
  const { width, height } = useVideoConfig();
  const base = Math.min(width, height);
  // Anchor to the chosen lower corner — name tags don't sit centered.
  const anchorStyle: React.CSSProperties =
    ALIGN === "left"
      ? { left: base * 0.046, bottom: base * 0.075 }
      : { right: base * 0.046, bottom: base * 0.075 };
  return (
    <AbsoluteFill style={{ fontFamily: BRAND.fonts.primary }}>
      <div style={{ position: "absolute", ...anchorStyle }}>
        <PersonCard name={NAME} title={TITLE} entranceDelay={5} align={ALIGN} />
      </div>
    </AbsoluteFill>
  );
};

const DualLowerThird: React.FC = () => {
  const { width, height } = useVideoConfig();
  const base = Math.min(width, height);
  return (
    <AbsoluteFill style={{ fontFamily: BRAND.fonts.primary }}>
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
          padding: `0 ${base * 0.046}px ${base * 0.075}px ${base * 0.046}px`,
        }}
      >
        <PersonCard name={NAME} title={TITLE} entranceDelay={5} align="left" />
        <PersonCard
          name={PARTNER_NAME}
          title={PARTNER_TITLE}
          entranceDelay={5}
          align="right"
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const BlackScreen: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "transparent" }} />
);

const Composition: React.FC = () => (
  <>
    <style>{BRAND_FONT_FACE_CSS}</style>
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={10}>
        <BlackScreen />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 10 })}
      />

      <TransitionSeries.Sequence durationInFrames={SCENE_FRAMES + TRANSITION}>
        {DUAL ? <DualLowerThird /> : <SingleLowerThird />}
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: TRANSITION })}
      />

      <TransitionSeries.Sequence durationInFrames={25}>
        <BlackScreen />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  </>
);

export default Composition;
