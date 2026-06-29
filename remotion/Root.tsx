import React from "react";
import { Composition, staticFile } from "remotion";
import { DynamicScene } from "./DynamicScene";
import FramedRecording from "./scenes/FramedRecording";
import BaguetteIndex, {
  fps as baguetteFps,
  durationInFrames as baguetteDuration,
} from "./BaguetteIndex";
import HeroLaunch, {
  fps as heroFps,
  durationInFrames as heroDuration,
} from "./scenes/HeroLaunch";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="DynamicScene"
        component={DynamicScene}
        durationInFrames={250}
        fps={25}
        width={3840}
        height={2160}
      />
      <Composition
        id="BrandDealSpyFrame"
        component={FramedRecording}
        durationInFrames={10863}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          videoSrc: staticFile("assets/brand-deal-spy-src.mp4"),
          aspect: 1666 / 1080,
          heightFraction: 0.9,
          showLogo: false,
        }}
      />
      <Composition
        id="BaguetteIndex"
        component={BaguetteIndex}
        durationInFrames={baguetteDuration}
        fps={baguetteFps}
        width={1080}
        height={1920}
      />
      <Composition
        id="HeroLaunch"
        component={HeroLaunch}
        durationInFrames={heroDuration}
        fps={heroFps}
        width={3840}
        height={2160}
      />
    </>
  );
};
