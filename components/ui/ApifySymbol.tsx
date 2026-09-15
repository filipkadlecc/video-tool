import React from "react";

/**
 * The Apify symbol — twin triangles and a base, from the design system.
 * Real geometry on a 40-unit viewBox; never redrawn as a single triangle.
 * 20px in the app header, 40px in About.
 */
export default function ApifySymbol({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" style={{ flexShrink: 0 }}>
      <path d="M 22.939 0 L 39.394 0 C 39.729 0 40 0.271 40 0.606 L 40 25.753 C 40 26.356 39.217 26.589 38.887 26.085 L 22.432 0.938 C 22.168 0.535 22.457 0 22.939 0 Z" fill="#F86606" />
      <path d="M 17.061 0 L 0.606 0 C 0.271 0 0 0.271 0 0.606 L 0 25.753 C 0 26.356 0.783 26.589 1.113 26.085 L 17.568 0.938 C 17.832 0.535 17.543 0 17.061 0 Z" fill="#F86606" />
      <path d="M 19.718 20.134 L 1.025 38.967 C 0.646 39.349 0.917 40 1.455 40 L 38.56 40 C 39.097 40 39.368 39.354 38.993 38.97 L 20.582 20.137 C 20.345 19.895 19.956 19.894 19.718 20.134 Z" fill="#F86606" />
    </svg>
  );
}
