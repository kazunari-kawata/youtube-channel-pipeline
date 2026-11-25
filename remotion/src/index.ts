import React from "react";
import { Composition, registerRoot } from "remotion";
import current from "./data/current.json";
import { EPISODES } from "./episodes";
import { H, W } from "./lib/geo";
import { TL } from "./lib/timeline";
import "./lib/font";
import { FigureCheck, InsertBusStop, InsertNightWalk, InsertWindow, PropsCheck } from "./inserts/Inserts";
import { InsertCourthouse, InsertOhioRoad, InsertPoliceCar, InsertPrisonFence } from "./inserts/Scenes2";
import { InsertPrisonFloor } from "./inserts/ScenesPrison";

// どの回を書き出すかは pipeline/stage.py が src/data/current.json に書く
const Episode = EPISODES[(current as any).episode];
if (!Episode) throw new Error(`回 ${(current as any).episode} が src/episodes/index.ts に登録されていません`);

// イメージ映像（挿入シーン）の単体確認用。本編では各回の定義から呼び出す
const INSERTS: [string, React.FC][] = [["Insert-NightWalk", InsertNightWalk], ["Insert-Window", InsertWindow], ["Insert-BusStop", InsertBusStop], ["Figure-Check", FigureCheck], ["Props-Check", PropsCheck],
  ["Insert-OhioRoad", InsertOhioRoad], ["Insert-Courthouse", InsertCourthouse], ["Insert-PoliceCar", InsertPoliceCar], ["Insert-PrisonFence", InsertPrisonFence], ["Insert-PrisonFloor", InsertPrisonFloor]];

const Root: React.FC = () =>
  React.createElement(React.Fragment, null,
    React.createElement(Composition, {
      id: "Main", component: Episode, durationInFrames: TL.totalFrames, fps: TL.fps, width: W, height: H,
    }),
    ...INSERTS.map(([id, c]) => React.createElement(Composition, { key: id, id, component: c, durationInFrames: 180, fps: 30, width: W, height: H })),
  );

registerRoot(Root);
