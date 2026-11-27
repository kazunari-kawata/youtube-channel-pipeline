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
import { InsertArrest, OfficerCheck } from "./inserts/ScenesArrest";
import { INSERT_SCENES } from "./inserts/registry";
import { calcShort, Short } from "./shorts/Short";

// どの回を書き出すかは pipeline/stage.py が src/data/current.json に書く
const Episode = EPISODES[(current as any).episode];
if (!Episode) throw new Error(`回 ${(current as any).episode} が src/episodes/index.ts に登録されていません`);

// イメージ映像（挿入シーン）の単体確認用。本編では各回の定義から呼び出す
const INSERTS: [string, React.FC][] = [["Insert-NightWalk", InsertNightWalk], ["Insert-Window", InsertWindow], ["Insert-BusStop", InsertBusStop], ["Figure-Check", FigureCheck], ["Props-Check", PropsCheck],
  ["Insert-OhioRoad", InsertOhioRoad], ["Insert-Courthouse", InsertCourthouse], ["Insert-PoliceCar", InsertPoliceCar], ["Insert-PrisonFence", InsertPrisonFence], ["Insert-PrisonFloor", InsertPrisonFloor],
  ["Insert-Arrest", InsertArrest], ["Officer-Check", OfficerCheck]];

// 確認用：場面と角度を入力（inputProps の scene・variant）で選んで描く（node scene_stills.mjs で静止画をまとめて書き出す）
const SceneCheck: React.FC<{ scene?: string; variant?: string }> = ({ scene = "night_walk", variant = "a" }) => {
  const C = INSERT_SCENES[scene];
  return C ? React.createElement(C, { variant }) : null;
};

const Root: React.FC = () =>
  React.createElement(React.Fragment, null,
    React.createElement(Composition, {
      id: "Main", component: Episode, durationInFrames: TL.totalFrames, fps: TL.fps, width: W, height: H,
    }),
    ...INSERTS.map(([id, c]) => React.createElement(Composition, { key: id, id, component: c, durationInFrames: 180, fps: 30, width: W, height: H })),
    React.createElement(Composition, { key: "Scene-Check", id: "Scene-Check", component: SceneCheck as React.FC, durationInFrames: 300, fps: 30, width: W, height: H, defaultProps: { scene: "night_walk", variant: "a" } }),
    // ショート（縦）。中身は public/shorts/<id>/data.json（pipeline/short_build.py）。--props='{"id":"002a"}'
    React.createElement(Composition, { key: "Short", id: "Short", component: Short as React.FC<any>, durationInFrames: 300, fps: 30, width: 720, height: 1280, defaultProps: { id: "002a" }, calculateMetadata: calcShort as any }),
  );

registerRoot(Root);
