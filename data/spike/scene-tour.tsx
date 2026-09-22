import React from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";
import { springIn, staggerChild, compoundReveal } from "../motion";

export const fps = 30;
export const durationInFrames = 750;

// ─── SPIKE Prague — site tour ────────────────────────────────────────────────
// Every pixel of the page comes from a real capture of https://spikeprague.cz/
// (scripts/capture-spike.cjs, viewport 1080 CSS px @2x). The page is laid out in
// its own coordinate space and a camera moves over it; nothing is redrawn.
//
// Source density is 2x, so the camera never exceeds scale 2.0 — at that point a
// composition pixel is a source pixel and the image is exactly sharp.
//
// BEATS (30fps)
//   0–85    hero, settling out of a push
//   85–270  the scroll: bestsellers → badges → new arrivals
//   248–330 JORDAN builds itself, card by card as it enters frame
//   350–430 hold
//   430–510 push into the Travis Scott grail, the row dims back
//   510–575 hold on the product
//   575–620 pull back out
//   620–690 the carousel advances, three more pairs
//   690–750 end card, resolving on the same white the page sits on

const W = 1080;
const H = 1350;
const YELLOW = "#FFD60A";
const INK = "#111111";
const PAPER = "#FFFFFF";

const FOCUS_CARD = 1; // Jordan 1 Retro Low OG SP Travis Scott

// --- generated:data-start ---
const PAGE = { width: 1080, totalHeight: 7366 };

const SECTIONS: { slug: string; y: number; h: number; src: string }[] = [
  { slug: "hero", y: 110, h: 357, src: "assets/spike/sections/01-hero.webp" },
  { slug: "bestsellers", y: 467, h: 563, src: "assets/spike/sections/02-bestsellers.webp" },
  { slug: "badges", y: 1030, h: 231, src: "assets/spike/sections/03-badges.webp" },
  { slug: "new-arrivals", y: 1261, h: 518, src: "assets/spike/sections/04-new-arrivals.webp" },
  { slug: "nike", y: 2377, h: 518, src: "assets/spike/sections/06-nike.webp" },
];

const JORDAN = {
  y: 1819, h: 518,
  shell: "assets/spike/sections/05-jordan--empty.webp",
  cards: [
    { x: 15, y: 64, w: 240, h: 377, src: "assets/spike/elements/card-5-0.webp" },
    { x: 285, y: 64, w: 240, h: 378, src: "assets/spike/elements/card-5-1.webp" },
    { x: 555, y: 64, w: 240, h: 377, src: "assets/spike/elements/card-5-2.webp" },
    { x: 825, y: 64, w: 240, h: 377, src: "assets/spike/elements/card-5-3.webp" },
    { x: 1095, y: 64, w: 240, h: 378, src: "assets/spike/elements/card-5-4.webp" },
    { x: 1365, y: 64, w: 240, h: 377, src: "assets/spike/elements/card-5-5.webp" },
    { x: 1635, y: 64, w: 240, h: 378, src: "assets/spike/elements/card-5-6.webp" },
    { x: 1905, y: 64, w: 240, h: 377, src: "assets/spike/elements/card-5-7.webp" },
    { x: 2175, y: 64, w: 240, h: 377, src: "assets/spike/elements/card-5-8.webp" },
    { x: 2445, y: 64, w: 240, h: 378, src: "assets/spike/elements/card-5-9.webp" },
  ],
};

const ANNOUNCE = { y: 0, h: 42, src: "assets/spike/elements/announce.webp" };
const LOGO = { x: 475, y: 54, w: 130, h: 43, src: "assets/spike/elements/logo.webp" };
// --- generated:data-end ---

// ─── Camera ──────────────────────────────────────────────────────────────────
// (x, y) is the page point that sits at the centre of the frame; s is zoom.
// `ease` describes how the camera ARRIVES at that waypoint, so a cruise segment
// can stay linear instead of braking at every key.

type Wp = { f: number; x: number; y: number; s: number; ease?: "in" | "out" | "inout" | "linear" };

const CAM: Wp[] = [
  { f: 0,   x: 330, y: 348,  s: 1.95 },
  { f: 85,  x: 392, y: 336,  s: 1.78, ease: "out" },
  { f: 190, x: 540, y: 760,  s: 1.22, ease: "inout" },
  { f: 268, x: 540, y: 1520, s: 1.14, ease: "linear" },
  { f: 350, x: 540, y: 2060, s: 1.30, ease: "out" },
  { f: 430, x: 540, y: 2066, s: 1.32, ease: "linear" },
  { f: 510, x: 405, y: 2072, s: 2.00, ease: "inout" },
  { f: 575, x: 405, y: 2072, s: 2.00, ease: "linear" },
  { f: 620, x: 540, y: 2060, s: 1.30, ease: "inout" },
  { f: 690, x: 540, y: 2054, s: 1.28, ease: "linear" },
  { f: 750, x: 540, y: 2030, s: 1.25, ease: "linear" },
];

function easeWith(t: number, kind: Wp["ease"]) {
  if (kind === "linear") return t;
  if (kind === "in") return Easing.in(Easing.cubic)(t);
  if (kind === "out") return Easing.out(Easing.cubic)(t);
  return Easing.inOut(Easing.cubic)(t);
}

function camAt(frame: number) {
  let i = 0;
  while (i < CAM.length - 2 && frame >= CAM[i + 1].f) i++;
  const a = CAM[i];
  const b = CAM[i + 1];
  const span = Math.max(1, b.f - a.f);
  const raw = Math.min(1, Math.max(0, (frame - a.f) / span));
  const t = easeWith(raw, b.ease);
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    s: a.s + (b.s - a.s) * t,
  };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

// ─── Scene ───────────────────────────────────────────────────────────────────

const Scene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps: f } = useVideoConfig();
  const cam = camAt(frame);

  // A slow breath on the zoom so held shots never look frozen.
  const breathe = Math.sin(frame / 41) * 0.004;
  const scale = cam.s * (1 + breathe);

  // How much the row has given itself over to the single product.
  const focus = interpolate(frame, [440, 505, 578, 618], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // The carousel advancing three pairs, exactly as the site's arrow does.
  const carouselX = interpolate(frame, [622, 690], [0, -810], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // The page hands over to the end card across the white it already sits on.
  const pageOpacity = interpolate(frame, [700, 734], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Only mount what the camera can actually see, plus a margin so an image is
  // always decoded before it is needed. Everything mounted at once is decode
  // work the Player must finish before it can paint anything -- the RENDERER
  // blocks on images via delayRender, the Player does not, which is why a heavy
  // scene renders correctly but previews as white for the first seconds.
  const halfH = H / 2 / scale;
  const viewTop = cam.y - halfH;
  const viewBottom = cam.y + halfH;
  const MARGIN = 900;
  const inView = (y: number, h: number) => y + h > viewTop - MARGIN && y < viewBottom + MARGIN;

  const pageTransform =
    "translate(" + W / 2 + "px, " + H / 2 + "px) scale(" + scale + ") translate(" + -cam.x + "px, " + -cam.y + "px)";

  return (
    <AbsoluteFill style={{ backgroundColor: PAPER }}>
      {/* ── the captured page, under a moving camera ── */}
      <AbsoluteFill style={{ opacity: pageOpacity }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0, transformOrigin: "0 0", transform: pageTransform }}>
          {/* the yellow free-shipping bar and the header the page opens with */}
          {inView(0, 110) && (
            <>
              <div style={{ position: "absolute", left: 0, top: ANNOUNCE.y, width: PAGE.width, height: 110, backgroundColor: PAPER }} />
              <Img src={staticFile(ANNOUNCE.src)} style={{ position: "absolute", left: 0, top: ANNOUNCE.y, width: PAGE.width, height: ANNOUNCE.h }} />
              <Img src={staticFile(LOGO.src)} style={{ position: "absolute", left: LOGO.x, top: LOGO.y, width: LOGO.w, height: LOGO.h }} />
            </>
          )}

          {SECTIONS.filter((s) => inView(s.y, s.h)).map((s) => (
            <Img key={s.slug} src={staticFile(s.src)} style={{ position: "absolute", left: 0, top: s.y, width: PAGE.width, height: s.h }} />
          ))}

          {/* ── JORDAN: the shell holds still while its cards arrive ── */}
          {inView(JORDAN.y, JORDAN.h) && (
          <div style={{ position: "absolute", left: 0, top: JORDAN.y, width: PAGE.width, height: JORDAN.h, overflow: "hidden" }}>
            <Img src={staticFile(JORDAN.shell)} style={{ position: "absolute", left: 0, top: 0, width: PAGE.width, height: JORDAN.h }} />
            <div style={{ position: "absolute", left: 0, top: 0, width: PAGE.width, height: JORDAN.h, transform: "translateX(" + carouselX + "px)" }}>
              {JORDAN.cards.map((c, i) => {
                const entrance = staggerChild(i, frame, f, {
                  baseDelay: 248,
                  perItem: 8,
                  preset: "SNAPPY",
                  fromY: 30,
                  fromScale: 0.9,
                });
                const isFocus = i === FOCUS_CARD;
                const recede = isFocus ? 0 : focus;
                return (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      left: c.x,
                      top: c.y,
                      width: c.w,
                      height: c.h,
                      opacity: clamp01(entrance.opacity * (1 - 0.82 * recede)),
                      transform: entrance.transform + " scale(" + (1 - 0.04 * recede) + ")",
                    }}
                  >
                    <Img src={staticFile(c.src)} style={{ width: "100%", height: "100%" }} />
                  </div>
                );
              })}
            </div>
          </div>
          )}
        </div>
      </AbsoluteFill>

      {/* ── end card, resolving on the same white ── */}
      <EndCard frame={frame} fps={f} />
    </AbsoluteFill>
  );
};

const EndCard: React.FC<{ frame: number; fps: number }> = ({ frame, fps: f }) => {
  const mark = compoundReveal(frame, f, { delay: 706, translateY: 26, scaleFrom: 0.9, preset: "SNAPPY" });
  const url = staggerChild(0, frame, f, { baseDelay: 716, perItem: 8, fromY: 18, fromScale: 0.96 });
  const pill = staggerChild(1, frame, f, { baseDelay: 716, perItem: 8, fromY: 18, fromScale: 0.96 });
  if (frame < 700) return null;

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        gap: 34,
        fontFamily: "Inter, -apple-system, Helvetica Neue, sans-serif",
      }}
    >
      <Img src={staticFile(LOGO.src)} style={{ width: 460, height: 152, opacity: mark.opacity, transform: mark.transform }} />
      <div style={{ fontSize: 58, fontWeight: 900, letterSpacing: -1.6, color: INK, opacity: url.opacity, transform: url.transform }}>
        spikeprague.cz
      </div>
      <div
        style={{
          backgroundColor: YELLOW,
          color: INK,
          fontSize: 27,
          fontWeight: 900,
          letterSpacing: 0.6,
          padding: "16px 30px",
          borderRadius: 999,
          opacity: pill.opacity,
          transform: pill.transform,
        }}
      >
        DOPRAVA ZDARMA NAD 5 000 KČ
      </div>
    </AbsoluteFill>
  );
};

export default Scene;
