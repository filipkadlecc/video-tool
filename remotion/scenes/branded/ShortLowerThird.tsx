import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { BRAND_FONT_FACE_CSS, figmaPlane, figmaBaselineNudge } from "../../theme";

// ===== Editable parameters (the snippet form fills these in) =====
const STYLE: "boxed" | "plain" = "boxed";
const MODE: "person" | "place" = "person";
const ACCENT: "green" | "blue" | "orange" = "green";
const NAME = "Name";
const SURNAME = "Surname";
const POSITION = "Position";
const PLACE = "Place/event";
// "shared" is where the designer put it for both platforms. "shorts-low" is the
// alternative drawn for videos adapted to YouTube Shorts' specific safe zone,
// which sits lower and further left.
const PLACEMENT: "shared" | "shorts-low" = "shared";
// 0,0 keeps Figma's own placement for the chosen style/mode/placement.
const X = 0;
const Y = 0;
// =================================================================

export const fps = 25;
export const durationInFrames = 100;

/** Short-form only: a 1:1 port of a fixed 1080x1920 Figma frame. */
export const orientation = "vertical";
export const designWidth = 1080;
export const designHeight = 1920;
export const holdFrame = 45;

const SETTLE = 30;
const REVEAL_FRAMES = 10;
const STAGGER = 4;

// --- Figma: Text treatment, section 2545:335 -------------------------------
// This is the one family where TikTok and Shorts genuinely differ. For titles
// and CTAs the two platform frames sit at identical coordinates, but here the
// designer drew a third, lower variant (annotated "or", note 2546:1011:
// "alternative version in case every video will be adapted to specific safe
// zones"). Hence PLACEMENT rather than a platform switch.
//
//   boxed person  2545:571  469x324   shared (169, 929)   shorts-low (125, 1168)
//   boxed place   2545:620  418x74    shared (173, 1169)  shorts-low (94, 1435)
//   plain person  2545:547  428x296   shared (187, 929)   shorts-low (153, 1171)
//   plain place   2545:670  378x72    shared (187, 1153)  shorts-low (120, 1428)
const FIGMA_AT = {
  "boxed-person": { shared: [169, 929], "shorts-low": [125, 1168] },
  "boxed-place": { shared: [173, 1169], "shorts-low": [94, 1435] },
  "plain-person": { shared: [187, 929], "shorts-low": [153, 1171] },
  "plain-place": { shared: [187, 1153], "shorts-low": [120, 1428] },
} as const;

const NAME_SIZE = 106.982;
const POSITION_SIZE = 58.295;
const PLACE_SIZE_BOXED = 74.283;
const PLACE_SIZE_PLAIN = 72;
const INK = "#1f2123";
const WHITE = "#ffffff";
const ACCENTS = { green: "#20a34e", blue: "#246dff", orange: "#f86606" };

const SceneBg: React.FC = () => <AbsoluteFill style={{ backgroundColor: "#000000" }} />;

function reveal(frame: number, index: number): string {
  const p = frame >= SETTLE
    ? 1
    : interpolate(frame, [index * STAGGER, index * STAGGER + REVEAL_FRAMES], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: (t) => 1 - Math.pow(1 - t, 3),
      });
  return `inset(0 ${(1 - p) * 100}% 0 0)`;
}

export default function ShortLowerThird() {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const plane = figmaPlane(width, height, "center");

  const key = `${STYLE}-${MODE}` as keyof typeof FIGMA_AT;
  const [fx, fy] = FIGMA_AT[key][PLACEMENT];
  const accent = ACCENTS[ACCENT];

  const type = (size: number, weight: number, color: string): React.CSSProperties => ({
    fontFamily: "'GT Walsheim'", fontWeight: weight, fontSize: size,
    lineHeight: 1, color, whiteSpace: "nowrap",
  });

  // Only plain runs need it — boxed text is centred by flex inside its padding.
  const plainType = (size: number, weight: number, color: string): React.CSSProperties => ({
    ...type(size, weight, color),
    transform: `translateY(${figmaBaselineNudge(size)}px)`,
  });

  let gap = 12;
  const rows: React.ReactNode[] = [];
  let i = 0;

  if (STYLE === "boxed" && MODE === "person") {
    // Name and Surname boxes have horizontal padding only — their height IS the
    // 106.982px line box, which is what makes each 107 tall in Figma.
    for (const line of [NAME, SURNAME]) {
      if (!line) continue;
      rows.push(
        <div key={`n${i}`} style={{
          backgroundColor: accent, padding: "0 20px",
          display: "flex", alignItems: "center", clipPath: reveal(frame, i++),
        }}>
          <div style={type(NAME_SIZE, 500, WHITE)}>{line}</div>
        </div>,
      );
    }
    if (POSITION) {
      rows.push(
        <div key="pos" style={{
          backgroundColor: WHITE, padding: "14px 20px",
          display: "flex", alignItems: "center", clipPath: reveal(frame, i++),
        }}>
          <div style={type(POSITION_SIZE, 400, INK)}>{POSITION}</div>
        </div>,
      );
    }
  } else if (STYLE === "boxed") {
    rows.push(
      <div key="place" style={{
        backgroundColor: accent, padding: "0 13.887px",
        display: "flex", alignItems: "center", clipPath: reveal(frame, i++),
      }}>
        <div style={type(PLACE_SIZE_BOXED, 500, WHITE)}>{PLACE}</div>
      </div>,
    );
  } else if (MODE === "person") {
    // Plain person is ONE text block of two lines, not two blocks — so the
    // 24px gap sits between the name block and the position, not between the
    // name and the surname.
    gap = 24;
    rows.push(
      <div key="name" style={{ ...plainType(NAME_SIZE, 500, WHITE), clipPath: reveal(frame, i++) }}>
        {NAME}
        <br />
        {SURNAME}
      </div>,
    );
    if (POSITION) {
      rows.push(
        <div key="pos" style={{ ...plainType(POSITION_SIZE, 400, WHITE), clipPath: reveal(frame, i++) }}>
          {POSITION}
        </div>,
      );
    }
  } else {
    rows.push(
      <div key="place" style={{ ...plainType(PLACE_SIZE_PLAIN, 500, WHITE), clipPath: reveal(frame, i++) }}>
        {PLACE}
      </div>,
    );
  }

  return (
    <AbsoluteFill>
      <style>{BRAND_FONT_FACE_CSS}</style>
      <SceneBg />
      <div style={plane.outer}>
        <div style={plane.inner}>
          <div style={{
            position: "absolute", left: X || fx, top: Y || fy,
            display: "flex", flexDirection: "column", alignItems: "flex-start", gap,
          }}>{rows}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
}
