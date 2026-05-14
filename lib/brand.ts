// Apify brand tokens, hand-ported from /Users/filip/apify-design-system.
// Intended for use inside Remotion scenes — keep this file static and
// dependency-free so the snippet eval sandbox (remotion/DynamicScene.tsx)
// can resolve it via the theme module pattern.

export const BRAND = {
  colors: {
    // Logo
    orange: "#F86606",
    green: "#20A34E",
    blue: "#246DFF",
    // Accent
    pink: "#FF64B8",
    // Magenta family (matches design system)
    magenta: {
      deep: "#694D6B",
      main: "#9D829F",
      tint: "#FEF3FF",
      accent: "#FF64B8",
    },
    // Backgrounds
    bg: "#12091A",
    bgSoft: "#1B0F23",
    text: "#FFFFFF",
    textMuted: "rgba(255,255,255,0.6)",
  },
  fonts: {
    primary: "Inter, sans-serif",
    marketing: "'GT Walsheim', Inter, sans-serif",
  },
  logoSrc: "/assets/logos/Brand.svg",
} as const;

export type BrandColor = keyof typeof BRAND.colors;
