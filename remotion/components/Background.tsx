import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";

export const Background: React.FC = () => {
  return (
    <AbsoluteFill>
      <Img
        src={staticFile("assets/backgrounds/Back_Dark.png")}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />
    </AbsoluteFill>
  );
};
