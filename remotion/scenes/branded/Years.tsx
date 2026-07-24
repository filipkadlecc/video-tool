// Years — a quick number slide. White "2004" parks on screen, then the strip
// slides LEFT through every year (2004..2014), decelerating to land cleanly on
// 2014, which then lingers.
//
// Transparent root (no Background, no opaque fill) so the alpha render drops
// straight onto separate footage. Nothing but the number: white text, no bg,
// no fades (opens on 2004, closes holding 2014).
import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";
import { BRAND_FONT_FACE_CSS } from "../../theme";

export const fps = 25;

const SLIDE_FRAMES = 25; // ~1s: the whole slide 2004 -> 2014
const LINGER_FRAMES = 250; // ~10s: hold on 2014
export const durationInFrames = SLIDE_FRAMES + LINGER_FRAMES; // 275

const START_YEAR = 2004;
const END_YEAR = 2014;
const YEARS = Array.from(
  { length: END_YEAR - START_YEAR + 1 },
  (_, i) => START_YEAR + i,
);

export default function Years() {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // Ease-in-out S-curve: a brief beat on 2004, a whoosh through the middle
  // years, a gentle settle onto 2014.
  const p = interpolate(frame, [0, SLIDE_FRAMES], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  const steps = YEARS.length - 1; // 10 transitions
  const cell = width; // one year fully centered at a time
  // At p=0 the first year (2004) is centered; at p=1 the last (2014) is.
  const shift = -p * steps * cell;

  return (
    <>
      <style>{BRAND_FONT_FACE_CSS}</style>
      <AbsoluteFill style={{ background: "transparent" }}>
        {YEARS.map((year, i) => {
          const offset = i * cell + shift; // center of this year vs screen center
          return (
            <div
              key={year}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: `translate(calc(-50% + ${offset}px), -50%)`,
                whiteSpace: "nowrap",
                fontFamily: "'GT Walsheim', sans-serif",
                fontWeight: 700,
                fontSize: height * 0.28,
                lineHeight: 1,
                color: "#FFFFFF",
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "0.01em",
              }}
            >
              {year}
            </div>
          );
        })}
      </AbsoluteFill>
    </>
  );
}
