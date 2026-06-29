import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { BRAND, BRAND_FONT_FACE_CSS } from "../../theme";
import { springIn, staggeredSpring, staggerChild, TIMING, inOutEnvelope } from "../../motion";
import { RegistrationFrame, IsoWireframe, TagPill } from "../../decor";

export const fps = 30;
export const durationInFrames = 220;

// "Hiring in {month}" recruitment card (the September board): headline with one
// highlighted phrase, a row of category TagPills, staggered role rows each with
// a department pill, isometric wireframe hero art in the corner, and an
// outlined "apply here" CTA. Registration frame on top.

const HEADLINE_LEAD = "Hiring in";
const HEADLINE_HIGHLIGHT = "September";
const TAGS = [
  "Engineering",
  "GTM",
];
const ROLES: { name: string; dept: string }[] = [
  { name: "Senior Backend Engineer", dept: "Engineering" },
  { name: "Engineering Manager", dept: "Engineering" },
  { name: "Creator Growth Lead", dept: "GTM" },
  { name: "Product Marketing Manager", dept: "GTM" },
  { name: "Senior Product Marketing Manager", dept: "GTM" },
];
const CTA = "apply here";

const ACCENT = BRAND.colors.orange;

export default function HiringCard() {
  const frame = useCurrentFrame();
  const { fps: vfps, width, height } = useVideoConfig();
  const base = Math.min(width, height);

  const envelope = inOutEnvelope(frame, vfps, durationInFrames);
  const titleIn = springIn(frame, vfps, TIMING.entrance, "SNAPPY");
  const highlightIn = springIn(frame, vfps, TIMING.entrance + 8, "LIQUID");
  const ctaIn = springIn(frame, vfps, TIMING.entrance + 22 + ROLES.length * TIMING.staggerItem, "SNAPPY");

  const headSize = base * 0.078;
  const roleSize = base * 0.026;
  const pillSize = base * 0.018;

  return (
    <>
      <style>{BRAND_FONT_FACE_CSS}</style>
      <AbsoluteFill style={{ background: BRAND.colors.bg, opacity: envelope }}>
        {/* Isometric wireframe hero art, bottom-right corner. */}
        <IsoWireframe
          shape="cube"
          size={base * 0.34}
          filled
          opacity={0.9}
          delay={TIMING.entrance + 10}
          style={{ right: base * 0.04, bottom: base * 0.06 }}
        />

        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: `${base * 0.12}px ${base * 0.09}px`,
            gap: base * 0.03,
          }}
        >
          {/* Headline */}
          <div
            style={{
              fontFamily: BRAND.fonts.marketing,
              fontWeight: 600,
              fontSize: headSize,
              color: BRAND.colors.text,
              lineHeight: 1.02,
              letterSpacing: "-0.025em",
            }}
          >
            <span style={{ opacity: titleIn }}>{HEADLINE_LEAD} </span>
            <span
              style={{
                opacity: highlightIn,
                color: ACCENT,
              }}
            >
              {HEADLINE_HIGHLIGHT}
            </span>
          </div>

          {/* Category tag pills */}
          <div style={{ display: "flex", gap: base * 0.012 }}>
            {TAGS.map((t, i) => (
              <div key={t} style={staggerChild(i, frame, vfps, { baseDelay: TIMING.entrance + 14 })}>
                <TagPill label={t} fontSize={pillSize} />
              </div>
            ))}
          </div>

          {/* Role rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: base * 0.014, marginTop: base * 0.01 }}>
            {ROLES.map((role, i) => {
              const rowIn = staggeredSpring(frame, vfps, i, TIMING.entrance + 22, TIMING.staggerItem, "LIQUID");
              return (
                <div
                  key={role.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: base * 0.016,
                    opacity: rowIn,
                    transform: `translateX(${interpolate(rowIn, [0, 1], [-14, 0])}px)`,
                  }}
                >
                  <div
                    style={{
                      width: base * 0.01,
                      height: base * 0.01,
                      background: ACCENT,
                      flexShrink: 0,
                    }}
                  />
                  <div
                    style={{
                      fontFamily: BRAND.fonts.primary,
                      fontWeight: 500,
                      fontSize: roleSize,
                      color: BRAND.colors.text,
                    }}
                  >
                    {role.name}
                  </div>
                  <TagPill label={role.dept} fontSize={pillSize * 0.82} style={{ opacity: 0.85 }} />
                </div>
              );
            })}
          </div>

          {/* CTA */}
          <div
            style={{
              marginTop: base * 0.02,
              opacity: ctaIn,
              transform: `translateY(${interpolate(ctaIn, [0, 1], [10, 0])}px)`,
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                border: `1.5px solid ${ACCENT}`,
                borderRadius: 999,
                padding: `${base * 0.016}px ${base * 0.032}px`,
                fontFamily: BRAND.fonts.primary,
                fontWeight: 600,
                fontSize: roleSize,
                color: ACCENT,
              }}
            >
              {CTA}
            </span>
          </div>
        </div>

        <RegistrationFrame inset={6} opacity={0.8} />
      </AbsoluteFill>
    </>
  );
}
