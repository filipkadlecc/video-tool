import type { AnimationType } from "./types";

export interface AnimationTypeMeta {
  id: AnimationType;
  label: string;
  subtitle: string;
  icon: string;
  color: string;
  colorSoft: string;
  badgeLabel: string;
}

export const ANIMATION_TYPES: AnimationTypeMeta[] = [
  {
    id: "broll",
    label: "B-Roll",
    subtitle: "Dark, cinematic style",
    icon: "film",
    color: "var(--magenta)",
    colorSoft: "var(--magenta-soft)",
    badgeLabel: "B-ROLL",
  },
  {
    id: "animation",
    label: "Animation",
    subtitle: "Generic motion graphics",
    icon: "bolt",
    color: "var(--cyan)",
    colorSoft: "var(--cyan-soft)",
    badgeLabel: "ANIMATION",
  },
  {
    id: "svg",
    label: "SVG",
    subtitle: "Animate SVG assets",
    icon: "layers",
    color: "var(--amber)",
    colorSoft: "var(--amber-soft)",
    badgeLabel: "SVG",
  },
  {
    id: "video",
    label: "Video Edit",
    subtitle: "Compose & edit video files",
    icon: "movie",
    color: "var(--accent)",
    colorSoft: "var(--accent-soft)",
    badgeLabel: "VIDEO",
  },
  {
    id: "terminal",
    label: "Terminal",
    subtitle: "Record terminal sessions with vhs",
    icon: "code",
    color: "var(--cyan)",
    colorSoft: "var(--cyan-soft)",
    badgeLabel: "TERMINAL",
  },
];

export function getAnimationTypeMeta(type: AnimationType): AnimationTypeMeta {
  return ANIMATION_TYPES.find((t) => t.id === type) ?? ANIMATION_TYPES[1];
}
