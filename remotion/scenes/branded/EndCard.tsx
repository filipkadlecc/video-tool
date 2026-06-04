import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { BRAND, BRAND_FONT_FACE_CSS } from "../../theme";
import { springIn, ambientDrift, TIMING, inOutEnvelope } from "../../motion";

export const fps = 30;
export const durationInFrames = 150;

// Apify CTA closer — outlined orange pill button + QR placeholder + promo line.
// Big "Try Apify for free" headline, CTA pill with destination,
// QR code on the right, promo code below. Flat bg, no gradients.

const CTA_HEADLINE = "Try Apify for free";
const CTA_URL = "apify.com/store";
const PROMO_LINE = "Get $100 prepaid usage";
const PROMO_CODE = "PLGTM25";

const ACCENT = BRAND.colors.orange;

// QR placeholder — 9×9 grid of dimmed dots with 3 corner markers.
// Real generation lives on the server; for the snippet we render a static
// pattern that reads as "QR code" without claiming to be one.
function QRPlaceholder({ size }: { size: number }) {
  const cells = 9;
  const cell = size / cells;
  const dots: React.ReactNode[] = [];
  // Hash-driven pseudo-pattern so the same layout renders every time.
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      const isCornerArea =
        (r < 3 && c < 3) || (r < 3 && c > cells - 4) || (r > cells - 4 && c < 3);
      if (isCornerArea) continue;
      const fill = (r * 7 + c * 5 + r * c) % 3 === 0;
      if (!fill) continue;
      dots.push(
        <rect
          key={`${r}-${c}`}
          x={c * cell + cell * 0.1}
          y={r * cell + cell * 0.1}
          width={cell * 0.8}
          height={cell * 0.8}
          fill={BRAND.colors.text}
          opacity={0.85}
          rx={cell * 0.1}
        />,
      );
    }
  }
  // Three corner markers (top-left, top-right, bottom-left).
  const corner = (cx: number, cy: number) => (
    <g>
      <rect x={cx * cell} y={cy * cell} width={cell * 3} height={cell * 3} fill="none" stroke={BRAND.colors.text} strokeWidth={cell * 0.3} rx={cell * 0.2} />
      <rect x={cx * cell + cell} y={cy * cell + cell} width={cell} height={cell} fill={BRAND.colors.text} rx={cell * 0.15} />
    </g>
  );
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <rect width={size} height={size} fill="white" rx={size * 0.04} />
      {dots}
      {corner(0, 0)}
      {corner(cells - 3, 0)}
      {corner(0, cells - 3)}
    </svg>
  );
}

export default function EndCard() {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();
  const base = Math.min(width, height);

  const envelope = inOutEnvelope(frame, vfps, durationInFrames);

  const headlineIn = springIn(frame, vfps, TIMING.entrance, "SNAPPY");
  const ctaIn = springIn(frame, vfps, TIMING.entrance + 12, "LIQUID");
  const promoIn = springIn(frame, vfps, TIMING.entrance + 22, "GENTLE");

  // Very subtle breathing on the CTA pill — feels alive without bouncing.
  const breathe = 1 + ambientDrift(frame, 0.008, 100, "cta");

  const headlineSize = base * 0.085;
  const ctaSize = base * 0.04;
  const promoSize = base * 0.022;

  return (
    <>
      <style>{BRAND_FONT_FACE_CSS}</style>
      <AbsoluteFill
        style={{
          background: BRAND.colors.bg,
          opacity: envelope,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            gap: base * 0.04,
            padding: `0 ${base * 0.06}px`,
          }}
        >
          <div
            style={{
              fontFamily: BRAND.fonts.marketing,
              fontWeight: 700,
              fontSize: headlineSize,
              color: BRAND.colors.text,
              letterSpacing: "-0.025em",
              lineHeight: 1.05,
              textAlign: "center",
              opacity: headlineIn,
              transform: `translateY(${interpolate(headlineIn, [0, 1], [24, 0])}px)`,
            }}
          >
            {CTA_HEADLINE}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: base * 0.04,
              opacity: ctaIn,
              transform: `translateY(${interpolate(ctaIn, [0, 1], [20, 0])}px) scale(${breathe})`,
            }}
          >
            <div
              style={{
                border: `${Math.max(2, base * 0.0025)}px solid ${ACCENT}`,
                borderRadius: 999,
                padding: `${base * 0.018}px ${base * 0.04}px`,
                fontFamily: BRAND.fonts.primary,
                fontWeight: 600,
                fontSize: ctaSize,
                color: ACCENT,
                letterSpacing: "-0.005em",
                background: "transparent",
              }}
            >
              {CTA_URL}
            </div>
            <QRPlaceholder size={base * 0.13} />
          </div>

          <div
            style={{
              opacity: promoIn,
              transform: `translateY(${interpolate(promoIn, [0, 1], [12, 0])}px)`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: base * 0.008,
            }}
          >
            <div
              style={{
                fontFamily: BRAND.fonts.primary,
                fontWeight: 500,
                fontSize: promoSize,
                color: BRAND.colors.textMuted,
                letterSpacing: "-0.005em",
              }}
            >
              {PROMO_LINE}
            </div>
            <div
              style={{
                fontFamily: BRAND.fonts.primary,
                fontWeight: 600,
                fontSize: promoSize,
                color: BRAND.colors.text,
                letterSpacing: "0.06em",
              }}
            >
              Code:{" "}
              <span
                style={{
                  background: BRAND.colors.orangeTint,
                  color: ACCENT,
                  padding: `${base * 0.003}px ${base * 0.01}px`,
                  borderRadius: base * 0.006,
                  fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
                  fontWeight: 600,
                }}
              >
                {PROMO_CODE}
              </span>
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </>
  );
}
