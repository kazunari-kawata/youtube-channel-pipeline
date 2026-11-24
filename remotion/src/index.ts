import React from "react";
import { Composition, registerRoot } from "remotion";
import current from "./data/current.json";
import { EPISODES } from "./episodes";
import { H, W } from "./lib/geo";
import { TL } from "./lib/timeline";
import "./lib/font";

// どの回を書き出すかは pipeline/stage.py が src/data/current.json に書く
const Episode = EPISODES[(current as any).episode];
if (!Episode) throw new Error(`回 ${(current as any).episode} が src/episodes/index.ts に登録されていません`);

const Root: React.FC = () =>
  React.createElement(Composition, {
    id: "Main", component: Episode, durationInFrames: TL.totalFrames, fps: TL.fps, width: W, height: H,
  });

registerRoot(Root);
