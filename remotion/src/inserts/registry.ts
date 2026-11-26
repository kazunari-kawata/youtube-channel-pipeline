/**
 * イメージ映像の場面の名前 → 部品。台本（narration.json）の visual.scene はここの名前で書く。
 * pipeline/shotlist.py はこのファイルを見て「作る／あり」を判定する。
 */
import React from "react";
import { InsertBusStop, InsertNightWalk, InsertWindow, SceneProps } from "./Inserts";
import { InsertCourthouse, InsertOhioRoad, InsertPoliceCar, InsertPrisonFence } from "./Scenes2";
import { InsertPrisonFloor } from "./ScenesPrison";
import { InsertApartments, InsertArrest } from "./ScenesArrest";
import { InsertCourtHall, InsertPhone, InsertTvRoom, InsertWindows2022 } from "./ScenesDahmer2";
import { InsertAirportWait003, InsertAirportWalk003, InsertCabinSeat003, InsertFbiLab003, InsertFieldOffice003 } from "./Scenes003a";
import { InsertExitDiagram003, InsertPlaneClouds003, InsertRainForest003, InsertRainWindow003, InsertRiverBank003 } from "./Scenes003b";

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
  apartments: InsertApartments,
  tv_room: InsertTvRoom,
  windows_2022: InsertWindows2022,
  phone: InsertPhone,
  court_hall: InsertCourtHall,
  // 003 D.B.クーパー（1971年）
  airport_walk: InsertAirportWalk003,
  airport_wait: InsertAirportWait003,
  cabin_seat: InsertCabinSeat003,
  field_office: InsertFieldOffice003,
  fbi_lab: InsertFbiLab003,
  plane_clouds: InsertPlaneClouds003,
  rain_window: InsertRainWindow003,
  rain_forest: InsertRainForest003,
  river_bank: InsertRiverBank003,
  exit_diagram: InsertExitDiagram003,
};
