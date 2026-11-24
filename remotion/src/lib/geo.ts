import * as THREE from "three";
import meta from "../data/meta.json";

export type Region = "japan" | "kanto";
export const W = 1280; // 作業解像度。書き出し時に render_scale 倍（1.5 → 1920x1080）
export const H = 720;
export const FOV = 35;

// 高さの誇張倍率（画面にも必ず表示する：CLAUDE.md ルール）
export const EXAG: Record<Region, number> = { japan: 15, kanto: 6 };

/** 経度・緯度 → 3D空間の座標（単位km。東が+x、北が-z、上が+y） */
export const world = (region: Region, lon: number, lat: number, y = 0): THREE.Vector3 => {
  const m = (meta as any)[region];
  const lonC = (m.west + m.east) / 2;
  const latC = (m.south + m.north) / 2;
  const x = ((lon - lonC) / (m.east - m.west)) * m.km_x;
  const z = -((lat - latC) / (m.north - m.south)) * m.km_y;
  return new THREE.Vector3(x, y, z);
};

export type Cam = { pos: THREE.Vector3; target: THREE.Vector3 };

/** ラベルを画面座標に投影するための、描画と同じ設定のカメラ */
export const project = (cam: Cam, p: THREE.Vector3) => {
  const c = new THREE.PerspectiveCamera(FOV, W / H, 1, 20000);
  c.position.copy(cam.pos);
  c.lookAt(cam.target);
  c.updateMatrixWorld();
  c.updateProjectionMatrix();
  const v = p.clone().project(c);
  return { x: ((v.x + 1) / 2) * W, y: ((1 - v.y) / 2) * H, visible: v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 };
};

/** 主な都市の経度・緯度（各回で共通に使う） */
export const PLACES = {
  tokyo: [139.77, 35.68], osaka: [135.5, 34.69], nagoya: [136.91, 35.18], kitakyushu: [130.88, 33.88],
  hiroshima: [132.46, 34.39], fukuoka: [130.4, 33.59], sendai: [140.87, 38.27], sapporo: [141.35, 43.06],
  edo: [139.753, 35.685], tokyoBay: [139.86, 35.5], choshi: [140.83, 35.73],
} as const;
export const pl = (k: keyof typeof PLACES) => PLACES[k];
