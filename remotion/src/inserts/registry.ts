/**
 * イメージ映像の場面の名前 → 部品。台本（narration.json）の visual.scene はここの名前で書く。
 * pipeline/shotlist.py はこのファイルを見て「作る／あり」を判定する。
 */
import React from "react";
import { InsertBusStop, InsertNightWalk, InsertWindow, SceneProps } from "./Inserts";
import { InsertCourthouse, InsertOhioRoad, InsertPoliceCar, InsertPrisonFence } from "./Scenes2";
import { InsertPrisonFloor } from "./ScenesPrison";
import { InsertArrest } from "./ScenesArrest";

export const INSERT_SCENES: Record<string, React.FC<SceneProps>> = {
  night_walk: InsertNightWalk,
  window: InsertWindow,
  bus_stop: InsertBusStop,
  ohio_road: InsertOhioRoad,
  courthouse: InsertCourthouse,
  police_car: InsertPoliceCar,
  prison_fence: InsertPrisonFence,
  prison_floor: InsertPrisonFloor,
  arrest: InsertArrest,
};
