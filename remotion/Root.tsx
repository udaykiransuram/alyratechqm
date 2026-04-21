import React from "react";
import { Composition } from "remotion";
import { SummerCrash45s } from "./SummerCrash45s";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="SummerCrash45s"
        component={SummerCrash45s}
        durationInFrames={1350}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
