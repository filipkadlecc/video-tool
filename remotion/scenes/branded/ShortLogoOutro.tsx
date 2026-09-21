import React from "react";
import { AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { figmaPlane } from "../../theme";
import { springIn } from "../../motion";

// ===== Editable parameters (the snippet form fills these in) =====
const MARK: "colour" | "white" = "colour";
// =================================================================

export const fps = 25;
export const durationInFrames = 75;

/**
 * Short-form only. This is a 1:1 port of a fixed 1080x1920 Figma frame, so it
 * has no sensible landscape layout — the orientation gate hides it outside 9:16.
 */
export const orientation = "vertical";
export const designWidth = 1080;
export const designHeight = 1920;

/**
 * The frame the Figma fidelity harness diffs (scripts/figma-diff.ts).
 * Everything must have landed AND stopped by here — the harness renders
 * holdFrame and holdFrame+3 and requires them byte-identical.
 */
export const holdFrame = 45;

// Springs asymptote rather than arriving, so the entrance is explicitly clamped
// at SETTLE. Without that, "settled" is a judgement call and the settle probe
// fails on sub-pixel drift that no one can see but the harness can measure.
const SETTLE = 30;

// Figma: frame 2704:7902, group "Apify Logo" 2704:7940 at (273.294, 886.642),
// 532.706 x 146.563. The SVG is Figma's own export of that node, so the artwork
// is 1:1 by construction rather than by resemblance.
const LOGO = { x: 273.294, y: 886.642, w: 532.706, h: 146.563 };

/**
 * Isolated so `lib/transparent-bg.ts` can strip it: it rewrites `<SceneBg />`
 * to a comment for alpha exports. That only works with a hex LITERAL here —
 * a BRAND token or a `background:` shorthand silently survives the strip and
 * ruins the export.
 */
const SceneBg: React.FC = () => <AbsoluteFill style={{ backgroundColor: "#000000" }} />;

export default function ShortLogoOutro() {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();
  const plane = figmaPlane(width, height, "center");

  // Scale only — no opacity ramp. An element fading up from a black frame is
  // the one entrance this project bans outright, and a logo has no business
  // arriving soft anyway.
  const enter = frame >= SETTLE ? 1 : springIn(frame, vfps, 0, "SNAPPY");
  const scale = 0.94 + 0.06 * enter;

  return (
    <AbsoluteFill>
      <SceneBg />
      <div style={plane.outer}>
        <div style={plane.inner}>
          <img
            src={staticFile("assets/short-form/apify-lockup.svg")}
            alt=""
            style={{
              position: "absolute",
              left: LOGO.x,
              top: LOGO.y,
              width: LOGO.w,
              height: LOGO.h,
              transform: `scale(${scale})`,
              transformOrigin: "center",
              filter: MARK === "white" ? "grayscale(1) brightness(3)" : undefined,
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
}
