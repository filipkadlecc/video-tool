import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND_FONT_FACE_CSS, figmaPlane } from "../../theme";
import { springIn } from "../../motion";

// ===== Editable parameters (the snippet form fills these in) =====
const ACCENT: "orange" | "blue" = "orange";
const SIZE = 143.145;
// Each word is hand-placed in Figma — there is no rule behind the angles and
// offsets, so they travel with the words rather than being generated. cx/cy are
// the centre of the word's bounding box in 1080x1920 design units.
//
// Listed TOP-MOST FIRST, the way Figma's layer list reads. The boxes overlap,
// so this is not cosmetic: painted the other way round, "there's" covers the
// "n" of "When".
//
// The centres come from get_design_context's own left/top, NOT from
// get_metadata's x/y, which for these rotated instances are up to 75px out.
// Both were checked against the rendered frame export; the design context wins.
const WORDS: { value: string; cx: number; cy: number; rot: number }[] = [
  { value: "More", cx: 432.2, cy: 680.1875, rot: -11.62 },
  { value: "funky", cx: 628.18, cy: 849.2085, rot: 7.88 },
  { value: "titles", cx: 520.03, cy: 1019.8125, rot: -8.26 },
];
// =================================================================

export const fps = 25;
export const durationInFrames = 100;

export const orientation = "vertical";
export const designWidth = 1080;
export const designHeight = 1920;
export const holdFrame = 45;

const SETTLE = 30;
const STAGGER = 5;
// Scale each word springs up FROM. ELASTIC peaks at p=1.2346, so this range
// overshoots to 0.6 + 0.4 * 1.2346 = 1.094 — a ~9% pop — before settling to 1.
const POP_FROM = 0.6;

// Figma: Titles 4 and 5 (2546:726 orange at 143.145px, 2546:774 blue at
// 112.763px). The box padding is proportional to type size in both —
// 24/143.145 === 18.906/112.763 and 15/143.145 === 11.816/112.763 — so it is
// derived rather than being a second pair of parameters that could disagree.
const PAD_X_RATIO = 24 / 143.145;
const PAD_Y_RATIO = 15 / 143.145;
const ACCENTS = { orange: "#f86606", blue: "#246dff" };
const WHITE = "#ffffff";

const SceneBg: React.FC = () => <AbsoluteFill style={{ backgroundColor: "#000000" }} />;

export default function ShortFunkyTitle() {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();
  const plane = figmaPlane(width, height, "center");
  const accent = ACCENTS[ACCENT];

  return (
    <AbsoluteFill>
      <style>{BRAND_FONT_FACE_CSS}</style>
      <SceneBg />
      <div style={plane.outer}>
        <div style={plane.inner}>
          {WORDS.map((w, i) => {
            // Words POP in one after another, overshooting past full size and
            // settling back. Still no fade and no blur — they arrive sharp, the
            // scale is the whole effect. SNAPPY was doing this too, but its
            // p=1.0598 peak over a 0.9..1 range came to a 0.6% overshoot, which
            // is not visible; ELASTIC over 0.6..1 reads as an actual pop.
            //
            // The last word is delayed 2*STAGGER=10 and ELASTIC takes ~25
            // frames to land, i.e. frame 35, past SETTLE. Harmless: by its own
            // frame 20 the spring is within 0.5% of 1, so the clamp is a <0.2%
            // step on scale. The clamp has to STAY, though — scripts/figma-diff.ts
            // renders holdFrame and holdFrame+3 and requires the two PNGs to be
            // byte-identical to prove the entrance has settled.
            const p = frame >= SETTLE ? 1 : springIn(frame, vfps, i * STAGGER, "ELASTIC");
            const scale = POP_FROM + (1 - POP_FROM) * p;
            return (
              <div
                key={`${w.value}-${i}`}
                style={{
                  position: "absolute", left: w.cx, top: w.cy,
                  // Earlier in the list paints on top, matching Figma, while
                  // the DOM order keeps the entrance stagger reading naturally.
                  zIndex: WORDS.length - i,
                  transform: `translate(-50%, -50%) rotate(${w.rot}deg) scale(${scale})`,
                  transformOrigin: "center",
                  backgroundColor: accent,
                  padding: `${SIZE * PAD_Y_RATIO}px ${SIZE * PAD_X_RATIO}px`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <div style={{
                  fontFamily: "'GT Walsheim'", fontWeight: 500, fontSize: SIZE,
                  lineHeight: 1, color: WHITE, textAlign: "center", whiteSpace: "nowrap",
                }}>{w.value}</div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
}
