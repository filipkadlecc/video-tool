import type { StyleMode } from "../../types";
import { DEFAULT_STYLE_PROMPT } from "./default";
import { KINETIC_STYLE_PROMPT } from "./kinetic";
import { EDITORIAL_STYLE_PROMPT } from "./editorial";
import { CINEMATIC_STYLE_PROMPT } from "./cinematic";

export interface StyleModeMeta {
  id: StyleMode;
  label: string;
  description: string;
}

export const STYLE_MODES: StyleModeMeta[] = [
  {
    id: "default",
    label: "Default",
    description: "Modern, asymmetric, balanced. Good baseline.",
  },
  {
    id: "kinetic",
    label: "Kinetic",
    description: "Bold oversized typography, snappy reveals. Linear/Vercel feel.",
  },
  {
    id: "editorial",
    label: "Editorial",
    description: "Serif/sans contrast, magazine layout, patient pacing.",
  },
  {
    id: "cinematic",
    label: "Cinematic",
    description: "Slow camera motion, depth blur, dramatic timing.",
  },
];

const STYLE_PROMPTS: Record<StyleMode, string> = {
  default: DEFAULT_STYLE_PROMPT,
  kinetic: KINETIC_STYLE_PROMPT,
  editorial: EDITORIAL_STYLE_PROMPT,
  cinematic: CINEMATIC_STYLE_PROMPT,
};

export function getStylePrompt(mode: StyleMode | undefined): string {
  return STYLE_PROMPTS[mode ?? "default"];
}
