"use client";

import React, { useCallback, useRef } from "react";

/**
 * Apple-TV style card tilt.
 *
 * Implementation notes that actually matter:
 *   - The transform is written DIRECTLY to the node, never through React
 *     state. Tracking must be 1:1 with the cursor and must not re-render.
 *   - The corner UNDER the cursor tips away from the viewer, so
 *     rotateX = (0.5 - py) * MAX and rotateY = (px - 0.5) * MAX.
 *   - `transition: none` while tracking; the ease-back only exists on leave.
 *   - NOTHING SCALES on hover. The design system forbids scale transforms,
 *     and this is the one place the reference implementations disagree.
 *   - Tilt is for the THREE HERO CARDS ONLY. In a dense grid every neighbour
 *     is a strict rectangle, so a tilted card's slanted edges read as broken
 *     rather than tactile no matter how small the angle — the problem isn't
 *     the amount, it's the kind. Grid cards pass max={0} and get the specular
 *     highlight alone, which follows the cursor without bending anything.
 *   - Disabled entirely under prefers-reduced-motion.
 *
 * `perspective` belongs on the CONTAINER, not here — 1000px for the three hero
 * cards, 1400px for a wall of grid cards, because a deeper vanishing point
 * stops each card in a grid looking independently warped.
 */
interface ParallaxCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Max tilt in degrees. Hero 2.5, grid 1.5. */
  max?: number;
  /** Specular strength. Hero .05, grid .03. */
  glare?: number;
  children: React.ReactNode;
}

export default function ParallaxCard({
  max = 2, glare = 0.04, children, style, ...rest
}: ParallaxCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);

  const reduced = typeof window !== "undefined"
    && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    if (max > 0) {
      el.style.transition = "none";
      el.style.transform = `rotateX(${(0.5 - py) * max}deg) rotateY(${(px - 0.5) * max}deg)`;
    }
    const g = glareRef.current;
    if (g) {
      g.style.opacity = "1";
      g.style.background =
        `radial-gradient(420px circle at ${px * 100}% ${py * 100}%, rgba(244,244,245,${glare}), rgba(244,244,245,0) 60%)`;
    }
  }, [max, glare, reduced]);

  const onLeave = useCallback(() => {
    const el = ref.current;
    if (el) {
      el.style.transition = "transform var(--dur-enter) var(--ease)";
      el.style.transform = "rotateX(0deg) rotateY(0deg)";
    }
    const g = glareRef.current;
    if (g) g.style.opacity = "0";
  }, []);

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{
        position: "relative",
        transformStyle: "preserve-3d",
        willChange: "transform",
        ...style,
      }}
      {...rest}
    >
      {children}
      <div
        ref={glareRef}
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "inherit",
          pointerEvents: "none",
          zIndex: 4,
          opacity: 0,
          transition: "opacity var(--dur-enter) var(--ease)",
        }}
      />
    </div>
  );
}

/** Lifts a child toward the viewer inside a tilted card. */
export function Depth({
  z, children, style, ...rest
}: { z: number } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div style={{ transform: `translateZ(${z}px)`, ...style }} {...rest}>
      {children}
    </div>
  );
}
