import React from "react";
import { Composition } from "remotion";
import { DynamicScene } from "./DynamicScene";

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
    </>
  );
};
