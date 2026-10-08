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
    description: "Sans/mono contrast, magazine layout, patient pacing.",
  },
  {
    id: "cinematic",
    label: "Cinematic",
    description: "Letterboxed, deep and slow — depth, light, dramatic timing.",
  },
];

const STYLE_PROMPTS: Record<StyleMode, string> = {
  default: DEFAULT_STYLE_PROMPT,
  kinetic: KINETIC_STYLE_PROMPT,
  editorial: EDITORIAL_STYLE_PROMPT,
  cinematic: CINEMATIC_STYLE_PROMPT,
};

// A preset sets the character of a video; the brand and motion rules around it
// are fixed. Said once here, in front of every preset, so a preset line that
// predates a rule (default.ts is frozen and still mentions blur, translucent
// cards and gradient backgrounds) is settled before the model has to wonder.
const PRESET_PRECEDENCE = `=== HOW TO READ THE STYLE PRESET BELOW ===
The preset sets this video's CHARACTER: composition, type scale, pace and the feel of the motion. It never overrides the brand and motion rules above. Where a line in it says otherwise, these win:
- The background is the root flat brand black (#020202); scenes paint no background, gradient wash or vignette.
- Cards, panels and pills are OPAQUE \`COLORS.card\` surfaces — no translucent or glass fills, no backdrop blur.
- Nothing blurs as it enters (rule 15); a static blur only on decorative shapes behind the content.
- Weights stop at 500; fonts are GT Walsheim and Inter (plus monospace for code and metadata).
- Orange is the only accent; text uses the \`text\` / \`textMuted\` / \`textSubtle\` tokens.
- No camera zoom or whole-frame drift unless the user asked (rule 17); overshoot stays under ~2%.
- "% of canvas height" means % of the short edge (× u).`;

export function getStylePrompt(mode: StyleMode | undefined): string {
  return `${PRESET_PRECEDENCE}\n${STYLE_PROMPTS[mode ?? "default"]}`;
}
