// Apify brand tokens, hand-ported from /Users/filip/apify-design-system.
// Intended for use inside Remotion scenes — keep this file static and
// dependency-free so the snippet eval sandbox (remotion/DynamicScene.tsx)
// can resolve it via the theme module pattern.
//
// Canonical dark surface + text tokens come from the Figma variables on
// the YouTube marketing file (4yDBgcWJEXEoAOARXNgrpJ, Semantic/Neutral/*).
// The accent colors below `orange*` exist to keep the legacy branded
// snippet library compiling — new AI output should use orange only.

export const BRAND = {
  colors: {
    // === Canonical Apify marketing palette (use these in new scenes) ===
    bg: "#161718",
    card: "#1d1e1f",
    border: "#3d3f43",
    text: "#f4f4f5",
    textMuted: "#bfc1c5",
    textSubtle: "#8c93a8",
    orange: "#F86606",
    orangeDeep: "#FF4800",
    orangeTint: "rgba(248,102,6,0.16)",

    // === Legacy accents (kept for backward compat with branded snippets) ===
    // Do NOT use these in new AI-generated scenes — orange-only.
    green: "#20A34E",
    blue: "#246DFF",
    pink: "#FF64B8",
    magenta: {
      deep: "#694D6B",
      main: "#9D829F",
      tint: "#FEF3FF",
      accent: "#FF64B8",
    },
    bgSoft: "#1B0F23",
  },
  fonts: {
    primary: "Inter, sans-serif",
    marketing: "'GT Walsheim', Inter, sans-serif",
  },
  logoSrc: "/assets/logos/Brand.svg",
} as const;

export type BrandColor = keyof typeof BRAND.colors;
