// The document is on the new spring set. The classic names still work (they
// resolve to their closest match) but the new names say what the motion is FOR,
// which is what gets a scene to use HEAVY on a logo instead of SNAPPY on
// everything.
const NEW_MOTION_GUIDANCE =
  "\n\n=== MOTION STYLE: NEW SPRINGS ===\n" +
  "This video uses the new spring set. SNAPPY / ELASTIC / LIQUID / GENTLE still work but now resolve to UI / PLAYFUL / DEFAULT / HEAVY, so write with the new names, chosen by what each element is:\n" +
  "| `UI` | quick, barely any overshoot | buttons, toggles, cursors, chips, leading edges, UI chrome |\n" +
  "| `DEFAULT` | smooth, settles without bounce | cards, containers, panels, camera moves |\n" +
  "| `HEAVY` | slow, has mass, lands with weight | big type, hero numbers, logo lockups, 3D objects |\n" +
  "| `PLAYFUL` | visible overshoot | icons, stickers, badges popping in — sparingly |\n" +
  "e.g. `springIn(frame, fps, 6, \"HEAVY\")`, `track(frame, fps, 0, steps, \"UI\")`. Mix at least two in every scene; the Spring Palette table above describes the classic set.";

/** The system-prompt addition for a document's spring set — empty for classic. */
export function motionStyleGuidance(style: unknown): string {
  return style === "new" ? NEW_MOTION_GUIDANCE : "";
}
