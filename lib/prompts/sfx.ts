import type { SfxEntry } from "../sfx";

export function buildSfxPrompt(sfx: SfxEntry[]): string {
  const list = sfx.map((s) => `- ${s.category} · assets/sfx/${s.file} — ${s.useWhen}`).join("\n");

  return `=== SOUND EFFECTS ===
You MAY add sound effects to reinforce motion. Use them sparingly and only where they sharpen a moment — a great animation has a few well-placed hits, not a wall of sound. Silence is a valid choice.

How to embed (Remotion bakes audio into the export automatically):
- Import: \`import { Audio, Sequence, staticFile } from "remotion";\`
- Place each effect on the exact frame it should fire by wrapping it in a Sequence:
  \`<Sequence from={FRAME}><Audio src={staticFile("assets/sfx/<file>")} volume={0.35} /></Sequence>\`
- \`from\` = the frame where the visual hit happens (a reveal, a slide-in, a stat landing). Sync the sound to the motion, not the other way around.
- Keep \`volume\` low: 0.2–0.45. SFX support the visuals, they don't dominate.
- One-shots only — never loop an effect. Don't stack multiple effects on the same frame.
- Do NOT add ambient beds or background music; these are punctuation, not a soundtrack.
- This does not change the no-fade rules or any timing — audio is additive only.

Available effects (use the EXACT path; do not invent filenames):
${list}`;
}
