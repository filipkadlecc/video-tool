// Standalone entry for rendering QuestionCard overlays via the Remotion CLI —
// does not touch Root.tsx. Usage:
//   npx remotion render remotion/qcard-entry.tsx QCard9x16 out.mov \
//     --codec prores --prores-profile 4444 --image-format png \
//     --pixel-format yuva444p10le --props '{"lead":"...","highlight":"..."}'
import React from "react";
import { Composition, registerRoot } from "remotion";
import QuestionCard, {
  fps,
  durationInFrames,
  type QuestionCardProps,
} from "./scenes/branded/QuestionCard";

const defaults: QuestionCardProps = {
  eyebrow: "THE QUESTION",
  lead: "What's one AI trend",
  highlight: "you hope disappears?",
};

const QCardRoot: React.FC = () => (
  <>
    <Composition
      id="QCard9x16"
      component={QuestionCard}
      durationInFrames={durationInFrames}
      fps={fps}
      width={2160}
      height={3840}
      defaultProps={defaults}
    />
    <Composition
      id="QCard1x1"
      component={QuestionCard}
      durationInFrames={durationInFrames}
      fps={fps}
      width={2160}
      height={2160}
      defaultProps={defaults}
    />
  </>
);

registerRoot(QCardRoot);
