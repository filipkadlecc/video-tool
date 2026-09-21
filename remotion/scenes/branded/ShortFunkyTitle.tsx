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
const WORDS: { value: string; cx: number; cy: number; rot: number }[] = [
  { value: "More", cx: 432.1998, cy: 755.107, rot: -11.62 },
  { value: "funky", cx: 651.9169, cy: 849.2112, rot: 7.88 },
  { value: "titles", cx: 520.0254, cy: 1072.2304, rot: -8.26 },
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
            // Words land one after another, each arriving sharp at full size
            // rather than fading or blurring up.
            const p = frame >= SETTLE ? 1 : springIn(frame, vfps, i * STAGGER, "SNAPPY");
            const scale = 0.9 + 0.1 * p;
            return (
              <div
                key={`${w.value}-${i}`}
                style={{
                  position: "absolute", left: w.cx, top: w.cy,
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
