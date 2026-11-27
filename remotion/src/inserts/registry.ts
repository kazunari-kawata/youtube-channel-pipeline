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
import { InsertIslandBoat006, InsertIslandFar006 } from "./Scenes006a";
import { InsertCellEvening006, InsertCellFront006, InsertCellhouse006, InsertCellVent006, InsertFigures006, InsertPipeCorridor006, InsertTierCount006 } from "./Scenes006c";
import { InsertSfOffice006 } from "./Scenes006d";
import { InsertAngelSearch006, InsertBayNight006, InsertBeachDay006, InsertPatrolBoat006, InsertShoreNight006 } from "./Scenes006b";
import { InsertExitDiagram003, InsertForestFloor003, InsertPlaneClouds003, InsertRainForest003, InsertRainWindow003, InsertRiverBank003 } from "./Scenes003b";

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
  forest_floor: InsertForestFloor003,
  river_bank: InsertRiverBank003,
  exit_diagram: InsertExitDiagram003,
  // 006 アルカトラズ脱獄（1962年）
  island_far: InsertIslandFar006,
  island_boat: InsertIslandBoat006,
  shore_night: InsertShoreNight006,
  bay_night: InsertBayNight006,
  beach_day: InsertBeachDay006,
  patrol_boat: InsertPatrolBoat006,
  angel_search: InsertAngelSearch006,
  cellhouse: InsertCellhouse006,
  cell_front: InsertCellFront006,
  cell_evening: InsertCellEvening006,
  cell_vent: InsertCellVent006,
  pipe_corridor: InsertPipeCorridor006,
  tier_count: InsertTierCount006,
  sf_office: InsertSfOffice006,
  figures_006: InsertFigures006, // 確認用（看守・兵士・艇の乗員）。台本では使わない
};
