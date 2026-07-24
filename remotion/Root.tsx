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
import Years, {
  fps as yearsFps,
  durationInFrames as yearsDuration,
} from "./scenes/branded/Years";
import AccountCTA, {
  fps as accountCtaFps,
  durationInFrames as accountCtaDuration,
} from "./scenes/branded/AccountCTA";
import ClaudeTypewriter, {
  fps as ctwFps,
  durationInFrames as ctwDuration,
} from "./scenes/ClaudeTypewriter";
import MiamiScroll, {
  fps as miamiFps,
  durationInFrames as miamiDuration,
} from "./scenes/MiamiScroll";
import ApifyAIRunning, {
  fps as aiFps,
  durationInFrames as aiDuration,
} from "./scenes/ApifyAIRunning";
import ApifyAIMinimal, {
  fps as aiMinFps,
  durationInFrames as aiMinDuration,
} from "./scenes/ApifyAIMinimal";
import ActorRiser, {
  fps as actorRiserFps,
  computeDuration as actorRiserDuration,
  durationInFrames as actorRiserDefaultDuration,
  DEFAULT_SEGMENTS as actorRiserSegments,
  DEFAULT_FREEZE_FRAMES as actorRiserFreeze,
  type ActorRiserProps,
} from "./scenes/ActorRiser";
import AmazonChat, {
  fps as amazonFps,
  durationInFrames as amazonDuration,
  CalibrationDoc as AmazonCalibrationDoc,
} from "./scenes/AmazonChat.built";

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
      <Composition
        id="Years"
        component={Years}
        durationInFrames={yearsDuration}
        fps={yearsFps}
        width={3840}
        height={2160}
      />
      <Composition
        id="AccountCTA"
        component={AccountCTA}
        durationInFrames={accountCtaDuration}
        fps={accountCtaFps}
        width={1920}
        height={1080}
      />
      <Composition
        id="ClaudeTypewriter"
        component={ClaudeTypewriter}
        durationInFrames={ctwDuration}
        fps={ctwFps}
        width={3840}
        height={2160}
      />
      <Composition
        id="MiamiScroll"
        component={MiamiScroll}
        durationInFrames={miamiDuration}
        fps={miamiFps}
        width={3840}
        height={2160}
      />
      <Composition
        id="ApifyAIRunning"
        component={ApifyAIRunning}
        durationInFrames={aiDuration}
        fps={aiFps}
        width={3840}
        height={2160}
      />
      <Composition
        id="ApifyAIMinimal"
        component={ApifyAIMinimal}
        durationInFrames={aiMinDuration}
        fps={aiMinFps}
        width={3840}
        height={2160}
      />
      <Composition
        id="AmazonChat"
        component={AmazonChat}
        durationInFrames={amazonDuration}
        fps={amazonFps}
        width={1920}
        height={1080}
      />
      <Composition
        id="AmazonChatSquare"
        component={AmazonChat}
        durationInFrames={amazonDuration}
        fps={amazonFps}
        width={1080}
        height={1080}
      />
      <Composition
        id="AmazonChatDoc"
        component={AmazonCalibrationDoc}
        durationInFrames={1}
        fps={25}
        width={1222}
        height={2900}
      />
      <Composition
        id="ActorRiser"
        component={ActorRiser}
        fps={actorRiserFps}
        width={3840}
        height={2160}
        durationInFrames={actorRiserDefaultDuration}
        defaultProps={{
          apifyLogo: staticFile("assets/apify/Apify symbol colors.svg"),
        }}
        calculateMetadata={({ props }) => {
          const p = props as ActorRiserProps;
          return {
            durationInFrames: actorRiserDuration(
              p.segments ?? actorRiserSegments,
              p.freezeFrames ?? actorRiserFreeze,
            ),
          };
        }}
      />
    </>
  );
};
