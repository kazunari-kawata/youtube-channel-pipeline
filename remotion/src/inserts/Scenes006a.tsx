/**
 * 006 アルカトラズ脱獄（1962年6月）のイメージ映像：湾に浮かぶ島（人物なし、船なし）
 *   island_far：曇りの湾に浮かぶ島の遠景（a 正面、b 少し近く、c 横から、d 夕方、e 日暮れの島を北東から）
 *   island_boat：水面の低い所から見た島（a 近づく全景、b 北側の近く、c 曇りの朝に横へ、d ゆっくり引いていく）
 * 見た目は、ユーザーが2026年8月に撮った映像を参考にした（episodes/006-alcatraz/footage.md）。映像そのものは使わない（F-057）。
 * 島は1962年の姿にする：今の展示・解説板・観光客・売店は入れない。建物に文字・標章は描かない。
 * 長さは実寸（m）。島は長さ約510m・高さ約40m。北西が -x、南東が +x、北が -z（サンフランシスコの街は +z の側）。
 * 建物：房棟（島のいちばん高い所）、灯台と所長の家（房棟の南東の端）、船着き場の大きな建物（東の岸）、給水塔（北）、工場（北西の低い所）
 */
import { useThree } from "@react-three/fiber";
import React, { useContext, useLayoutEffect, useMemo } from "react";
import { interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { CamKey, PortraitAim, PortraitZoom, SceneProps, Stage, useInsertDur } from "./Inserts";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
type V3 = [number, number, number];

/* ---------- カメラ（実寸の屋外なので、奥の限りを遠くに。近い面は距離に合わせる：F-001） ---------- */

/** 横の画面用の画角を、縦の画面（ショート）で左右の幅が zoom 倍になる画角に直す（Inserts.tsx の Camera と同じ） */
const portraitFov = (fov: number, aspect: number, zoom: number) => {
  const half = THREE.MathUtils.degToRad(fov / 2);
  const hHalf = Math.atan(Math.tan(half) * (16 / 9)) * zoom;
  return THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hHalf) / aspect));
};

/** Inserts.tsx の Camera と同じ動き（縦の画面にも対応）で、近い面と奥の限りだけを場面に合わせて変えられる */
export const Cam006: React.FC<{ from: CamKey; to: CamKey; near?: number; far?: number }> = ({ from, to, near = 1, far = 9000 }) => {
  const { camera } = useThree();
  const frame = useCurrentFrame();
  const dur = useInsertDur();
  const { width, height } = useVideoConfig();
  const zoom = useContext(PortraitZoom);
  const aim = useContext(PortraitAim);
  useLayoutEffect(() => {
    const t = THREE.MathUtils.smootherstep(frame / (dur - 1), 0, 1);
    const c = camera as THREE.PerspectiveCamera;
    c.position.lerpVectors(new THREE.Vector3(...from.pos), new THREE.Vector3(...to.pos), t);
    const tg = new THREE.Vector3(...from.target).lerp(new THREE.Vector3(...to.target), t);
    const fov = THREE.MathUtils.lerp(from.fov ?? 35, to.fov ?? 35, t);
    c.fov = height > width ? portraitFov(fov, width / height, zoom) : fov;
    c.near = near;
    c.far = far;
    c.lookAt(tg);
    if (height > width && (aim[0] || aim[1])) {
      c.rotateY(THREE.MathUtils.degToRad(aim[0]));
      c.rotateX(THREE.MathUtils.degToRad(aim[1]));
    }
    c.updateProjectionMatrix();
  }, [frame, camera, dur, from, to, near, far, width, height, zoom, aim]);
  return null;
};

/* ---------- なめらかな乱数（地形の凹凸用。毎回同じ形になる） ---------- */

const hash = (x: number, y: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const vnoise = (x: number, y: number) => {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
export const fbm = (x: number, y: number) => vnoise(x, y) * 0.5 + vnoise(x * 2.1 + 5.2, y * 2.1 - 1.7) * 0.3 + vnoise(x * 4.3 - 3.1, y * 4.3 + 8.3) * 0.2;
const sstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/* ---------- 島の地形 ---------- */

const ISL_A = 255, ISL_B = 84;
/** 島の上の平らな所の高さ：房棟の下がいちばん高く（約40m）、北西の端と南東の端は低い */
const plateau = (x: number) => 40 - 22 * sstep(80, 235, -x) - 15 * sstep(125, 245, x);

/** 東の岸の船着き場の前（大きな建物が立つ、海の高さの平らな所） */
const DOCK = { x0: 108, x1: 196, z0: 46, z1: 90, h: 2.2 };

export const islandH = (x: number, z: number) => {
  const n = fbm(x / 55 + 3, z / 55 - 7);
  const e = Math.hypot(x / ISL_A, z / ISL_B) * (1 + 0.18 * (n - 0.5));
  if (e >= 1) return -3 - (e - 1) * 60;
  const k = Math.min(1, (1 - e) / 0.22);
  let h = plateau(x) * Math.pow(k, 0.42);
  h += (fbm(x / 9, z / 9) - 0.5) * 6 * (1 - 0.75 * k); // 岩の凹凸（崖ほど強く）
  const inDock = Math.min(sstep(DOCK.x0, DOCK.x0 + 14, x), 1 - sstep(DOCK.x1 - 14, DOCK.x1, x), sstep(DOCK.z0, DOCK.z0 + 8, z));
  if (inDock > 0) h = THREE.MathUtils.lerp(h, Math.min(h, DOCK.h), inDock);
  return h;
};

const IslandTerrain: React.FC = () => {
  const geo = useMemo(() => {
    const NX = 280, NZ = 110, X0 = -285, X1 = 285, Z0 = -115, Z1 = 115;
    const pos: number[] = [];
    for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
      const x = X0 + ((X1 - X0) * i) / NX, z = Z0 + ((Z1 - Z0) * j) / NZ;
      pos.push(x, islandH(x, z), z);
    }
    const idx: number[] = [];
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
      const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    // 色：水ぎわは濡れた黒い岩、急な所は灰色の岩、ゆるい斜面は緑の茂み、上の平らな所は土とコンクリート
    const nrm = g.getAttribute("normal");
    const col: number[] = [];
    const wet = new THREE.Color("#2f2e2a"), rockA = new THREE.Color("#7d7a70"), rockB = new THREE.Color("#5c5a53");
    const brushA = new THREE.Color("#5c6b44"), brushB = new THREE.Color("#43523a"), top = new THREE.Color("#8a877b");
    const tmp = new THREE.Color();
    for (let k = 0; k < pos.length / 3; k++) {
      const x = pos[k * 3], y = pos[k * 3 + 1], z = pos[k * 3 + 2], ny = nrm.getY(k);
      const n2 = fbm(x / 6 + 11, z / 6 - 4);
      const rock = tmp.copy(rockA).lerp(rockB, n2).clone();
      const brush = brushA.clone().lerp(brushB, fbm(x / 14 - 2, z / 14 + 9));
      const steep = 1 - sstep(0.34, 0.6, ny);
      let c = brush.clone().lerp(rock, steep);
      const flatTop = sstep(0.9, 0.97, ny) * sstep(plateau(x) - 8, plateau(x) - 2, y);
      c = c.lerp(top.clone().lerp(brushB, n2 * 0.5), flatTop * 0.8);
      c = c.lerp(wet, 1 - sstep(0.4, 2.4, y));
      col.push(c.r, c.g, c.b);
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    return g;
  }, []);
  return (
    <mesh geometry={geo} receiveShadow castShadow>
      <meshStandardMaterial vertexColors roughness={0.95} />
    </mesh>
  );
};

/* ---------- 建物（窓の並びだけの壁。文字・標章は描かない） ---------- */

const facadeCache: Record<string, THREE.CanvasTexture> = {};
/** 壁の絵：塗った壁、雨の筋の汚れ、窓（暗い四角）の並び */
const facade = (key: string, o: { base: string; win: string; cols: number; rows: number; ww: number; wh: number; top: number; bottom: number; stain?: number }) => {
  if (facadeCache[key]) return facadeCache[key];
  const W = 1024, H = 256;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const c = cv.getContext("2d")!;
  c.fillStyle = o.base; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 180; i++) { // 縦の雨だれの筋
    const x = random(`fs${key}${i}`) * W, len = 20 + random(`fl${key}${i}`) * 140;
    c.fillStyle = `rgba(40,40,36,${(o.stain ?? 0.06) * random(`fa${key}${i}`)})`;
    c.fillRect(x, H * 0.1 + random(`fy${key}${i}`) * H * 0.5, 2 + random(`fw${key}${i}`) * 4, len);
  }
  const cw = W / o.cols, rh = (H * (1 - o.top - o.bottom)) / o.rows;
  for (let r = 0; r < o.rows; r++) for (let k = 0; k < o.cols; k++) {
    const x = k * cw + (cw * (1 - o.ww)) / 2, y = H * o.top + r * rh + (rh * (1 - o.wh)) / 2;
    c.fillStyle = o.win; c.fillRect(x, y, cw * o.ww, rh * o.wh);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  facadeCache[key] = t;
  return t;
};

/** 箱の建物。長い面と短い面に窓の絵、屋根は無地 */
const Block: React.FC<{ position: V3; size: V3; rotY?: number; long: THREE.Texture; short: THREE.Texture; roof: string; tint?: string }> = ({ position, size, rotY = 0, long, short, roof, tint = "#ffffff" }) => {
  const mats = useMemo(() => {
    const side = (map: THREE.Texture) => new THREE.MeshStandardMaterial({ map, color: tint, roughness: 0.9 });
    const r = new THREE.MeshStandardMaterial({ color: roof, roughness: 0.95 });
    return [side(short), side(short), r, r, side(long), side(long)];
  }, [long, short, roof, tint]);
  return (
    <mesh position={[position[0], position[1] + size[1] / 2, position[2]]} rotation={[0, rotY, 0]} material={mats} castShadow receiveShadow>
      <boxGeometry args={size} />
    </mesh>
  );
};

/** 房棟：島のいちばん高い所の、白っぽい長い建物。屋根の中央に細長い天窓の列 */
const Cellhouse: React.FC<{ lit?: number }> = ({ lit = 0 }) => {
  const long = facade("cell-long", { base: "#dcd8cc", win: "#3a3f44", cols: 30, rows: 3, ww: 0.4, wh: 0.7, top: 0.1, bottom: 0.08 });
  const short = facade("cell-short", { base: "#dcd8cc", win: "#3a3f44", cols: 8, rows: 3, ww: 0.4, wh: 0.7, top: 0.1, bottom: 0.08 });
  const y = 39.2;
  return (
    <group>
      <Block position={[22, y, -2]} size={[104, 19, 32]} long={long} short={short} roof="#8f8b80" />
      {/* 天窓の列（屋根の上の低い棟） */}
      <mesh position={[22, y + 19 + 1.1, -2]}>
        <boxGeometry args={[92, 2.2, 9]} />
        <meshStandardMaterial color="#5d6166" roughness={0.6} metalness={0.1} emissive="#ffe8c0" emissiveIntensity={lit * 0.15} />
      </mesh>
      {/* 南東の端の、管理棟の低い建物 */}
      <Block position={[81, y, -2]} size={[16, 11, 34]} long={short} short={short} roof="#8f8b80" />
    </group>
  );
};

/** 灯台（白い八角の塔、上に黒い灯室）と所長の家 */
const Lighthouse: React.FC<{ glow?: number }> = ({ glow = 0 }) => {
  const x = 96, z = 16, y = islandH(96, 16) - 0.5;
  const house = facade("warden", { base: "#d3cab4", win: "#33302c", cols: 6, rows: 2, ww: 0.4, wh: 0.55, top: 0.2, bottom: 0.15 });
  return (
    <group>
      <mesh position={[x, y + 11, z]} castShadow>
        <cylinderGeometry args={[1.7, 2.3, 22, 8]} />
        <meshStandardMaterial color="#e2ded4" roughness={0.85} />
      </mesh>
      <mesh position={[x, y + 22.2, z]}>
        <cylinderGeometry args={[2.7, 2.7, 0.4, 16]} />
        <meshStandardMaterial color="#2c2c2c" roughness={0.7} />
      </mesh>
      <mesh position={[x, y + 23.6, z]}>
        <cylinderGeometry args={[1.5, 1.5, 2.4, 12]} />
        <meshStandardMaterial color="#20262a" roughness={0.3} metalness={0.3} emissive="#fff1d0" emissiveIntensity={glow} />
      </mesh>
      <mesh position={[x, y + 25.4, z]}>
        <coneGeometry args={[1.7, 1.4, 12]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.6} />
      </mesh>
      <Block position={[110, islandH(110, 2) - 0.6, 2]} size={[18, 8, 13]} long={house} short={house} roof="#5c4c42" />
    </group>
  );
};

/** 船着き場の大きな建物（4階建て、海の高さ）と、まわりの小さな建物 */
const DockBuildings: React.FC = () => {
  const big = facade("b64-long", { base: "#d6cfbb", win: "#34383c", cols: 24, rows: 4, ww: 0.45, wh: 0.6, top: 0.08, bottom: 0.1, stain: 0.09 });
  const bigShort = facade("b64-short", { base: "#d6cfbb", win: "#34383c", cols: 5, rows: 4, ww: 0.45, wh: 0.6, top: 0.08, bottom: 0.1, stain: 0.09 });
  const small = facade("small", { base: "#c9c2ad", win: "#35352f", cols: 5, rows: 1, ww: 0.4, wh: 0.5, top: 0.25, bottom: 0.2 });
  return (
    <group>
      <Block position={[150, DOCK.h - 0.3, 60]} size={[66, 15, 14]} long={big} short={bigShort} roof="#6d685f" />
      {/* 桟橋（低い板） */}
      <mesh position={[172, 1.0, 78]}>
        <boxGeometry args={[36, 1.2, 9]} />
        <meshStandardMaterial color="#4b463d" roughness={0.95} />
      </mesh>
      <Block position={[124, islandH(124, 32) - 0.6, 32]} size={[14, 7, 9]} long={small} short={small} roof="#5e584e" />
      <Block position={[66, islandH(66, 44) - 0.6, 44]} size={[18, 6, 9]} long={small} short={small} roof="#5e584e" />
    </group>
  );
};

/** 給水塔（北の端の高い所）と、北西の端の低い工場の建物 */
const NorthBuildings: React.FC = () => {
  const x = -150, z = -26, y = islandH(-150, -26) - 0.5;
  const shop = facade("shop", { base: "#bfb9aa", win: "#34363a", cols: 22, rows: 2, ww: 0.5, wh: 0.55, top: 0.15, bottom: 0.12 });
  const shopS = facade("shop-s", { base: "#bfb9aa", win: "#34363a", cols: 6, rows: 2, ww: 0.5, wh: 0.55, top: 0.15, bottom: 0.12 });
  return (
    <group>
      {[[-4, -4], [4, -4], [-4, 4], [4, 4]].map(([dx, dz], i) => (
        <mesh key={i} position={[x + dx, y + 9, z + dz]} castShadow>
          <cylinderGeometry args={[0.35, 0.35, 18, 6]} />
          <meshStandardMaterial color="#5a5852" roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[x, y + 21.5, z]} castShadow>
        <cylinderGeometry args={[6, 6, 7, 20]} />
        <meshStandardMaterial color="#9c978b" roughness={0.85} />
      </mesh>
      <mesh position={[x, y + 25.8, z]}>
        <coneGeometry args={[6.2, 1.6, 20]} />
        <meshStandardMaterial color="#77736a" roughness={0.85} />
      </mesh>
      <Block position={[-212, islandH(-212, -44) - 0.8, -44]} size={[70, 9, 18]} rotY={0.12} long={shop} short={shopS} roof="#6f6b62" />
    </group>
  );
};

/** 斜面の低い木（ユーカリやイトスギの濃い緑のかたまり） */
const Trees: React.FC = () => {
  const items = useMemo(() => {
    const out: { p: V3; s: number }[] = [];
    for (let i = 0; i < 90; i++) {
      const x = -60 + random(`tx${i}`) * 260, z = -70 + random(`tz${i}`) * 140;
      const h = islandH(x, z);
      if (h < 8 || h > plateau(x) - 4) continue;
      if (x > 100 && z > 40) continue; // 船着き場の前は空ける
      if (random(`tk${i}`) < 0.45) continue;
      out.push({ p: [x, h - 1, z], s: 1.8 + random(`ts${i}`) * 2.2 });
    }
    return out;
  }, []);
  return (
    <group>
      {items.map((it, i) => (
        <mesh key={i} position={[it.p[0], it.p[1] + it.s * 0.5, it.p[2]]} scale={[it.s, it.s * 0.8, it.s]} castShadow>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color="#45573c" roughness={1} flatShading />
        </mesh>
      ))}
    </group>
  );
};


/** 南東の端の練兵場の住宅（1962年にはあった。1971年に取り壊し）、房棟の北西の運動場の塀、北の発電所 */
const OtherBuildings: React.FC = () => {
  const apt = facade("apt", { base: "#cfc8b4", win: "#34383c", cols: 12, rows: 3, ww: 0.45, wh: 0.55, top: 0.1, bottom: 0.1 });
  const aptS = facade("apt-s", { base: "#cfc8b4", win: "#34383c", cols: 4, rows: 3, ww: 0.45, wh: 0.55, top: 0.1, bottom: 0.1 });
  const plant = facade("plant", { base: "#b8b1a0", win: "#36373a", cols: 10, rows: 2, ww: 0.45, wh: 0.5, top: 0.15, bottom: 0.15 });
  const wallY = islandH(-48, -2) - 0.5;
  return (
    <group>
      <Block position={[176, islandH(176, -18) - 1, -18]} size={[34, 10, 12]} rotY={0.1} long={apt} short={aptS} roof="#6c665c" />
      <Block position={[196, islandH(196, 8) - 1, 8]} size={[26, 10, 12]} rotY={-0.15} long={apt} short={aptS} roof="#6c665c" />
      {/* 運動場の塀（房棟の北西の端） */}
      {([[-48, -2, 34, 0.8, true], [-31, -2, 34, 0.8, true], [-39.5, -18.6, 17, 0.8, false], [-39.5, 14.6, 17, 0.8, false]] as [number, number, number, number, boolean][]).map(([x, z, len, th, alongZ], i) => (
        <mesh key={i} position={[x, wallY + 3.5, z]} castShadow>
          <boxGeometry args={alongZ ? [th, 7, len] : [len, 7, th]} />
          <meshStandardMaterial color="#cfcabd" roughness={0.9} />
        </mesh>
      ))}
      <Block position={[-188, islandH(-188, 14) - 0.8, 14]} size={[22, 9, 14]} long={plant} short={plant} roof="#66625a" />
      <mesh position={[-180, islandH(-188, 14) + 15, 18]} castShadow>
        <cylinderGeometry args={[1.1, 1.5, 30, 12]} />
        <meshStandardMaterial color="#8c867a" roughness={0.9} />
      </mesh>
    </group>
  );
};

/** 東と南の斜面の段（擁壁と道）、房棟のまわりの舗装、船着き場の監視塔 */
const Terraces: React.FC = () => {
  const walls: [number, number, number, number, number][] = [ // x, z, 長さ, 高さ, 向き（rad）
    [92, 50, 40, 4, 0.05], [60, 46, 34, 3.5, -0.1], [118, 38, 30, 4, 0.35], [140, 26, 26, 3, 0.6], [36, 40, 30, 3, 0.0], [164, 6, 24, 3, 1.1],
  ];
  return (
    <group>
      {walls.map(([x, z, len, h, r], i) => {
        const y = islandH(x, z);
        return (
          <mesh key={i} position={[x, y + h / 2 - 0.8, z]} rotation={[0, r, 0]} castShadow receiveShadow>
            <boxGeometry args={[len, h, 1.2]} />
            <meshStandardMaterial color="#b3ae9f" roughness={0.95} />
          </mesh>
        );
      })}
      {/* 房棟のまわりの舗装 */}
      <mesh position={[24, 40.2, -2]} receiveShadow>
        <boxGeometry args={[150, 2, 52]} />
        <meshStandardMaterial color="#9b978a" roughness={0.95} />
      </mesh>
      {/* 船着き場の監視塔（細い塔と小屋） */}
      <mesh position={[192, 8, 74]} castShadow>
        <boxGeometry args={[1.6, 16, 1.6]} />
        <meshStandardMaterial color="#5a564e" roughness={0.9} />
      </mesh>
      <mesh position={[192, 17.2, 74]} castShadow>
        <boxGeometry args={[4.2, 3, 4.2]} />
        <meshStandardMaterial color="#c9c3b2" roughness={0.9} />
      </mesh>
    </group>
  );
};

export const AlcatrazIsland: React.FC<{ lit?: number; glow?: number }> = ({ lit = 0, glow = 0 }) => (
  <group>
    <IslandTerrain />
    <Cellhouse lit={lit} />
    <Lighthouse glow={glow} />
    <DockBuildings />
    <NorthBuildings />
    <OtherBuildings />
    <Terraces />
    <Trees />
  </group>
);

/* ---------- 湾の水面 ---------- */

/** 周期のある乱数（タイルにしても継ぎ目が出ない） */
const pnoise = (x: number, y: number, P: number) => {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const m = (a: number) => ((a % P) + P) % P;
  const a = hash(m(xi), m(yi)), b = hash(m(xi + 1), m(yi)), c = hash(m(xi), m(yi + 1)), d = hash(m(xi + 1), m(yi + 1));
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};

let waveNormalCache: THREE.CanvasTexture | null = null;
/** 小さな波の法線の絵（横に長いうねり。強くしない：細かく強い凹凸は遠くでちらつく） */
const waveNormals = () => {
  if (waveNormalCache) return waveNormalCache;
  const N = 512, P = 18;
  const hgt = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = (i / N) * P, y = (j / N) * P;
    hgt[j * N + i] = pnoise(x, y * 2.2, P) * 0.6 + pnoise(x * 2, y * 4.4, P * 2) * 0.3 + pnoise(x * 4, y * 8.8, P * 4) * 0.1;
  }
  const cv = document.createElement("canvas");
  cv.width = cv.height = N;
  const c = cv.getContext("2d")!;
  const img = c.createImageData(N, N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const hx = hgt[j * N + ((i + 1) % N)] - hgt[j * N + ((i - 1 + N) % N)];
    const hy = hgt[((j + 1) % N) * N + i] - hgt[((j - 1 + N) % N) * N + i];
    const nx = -hx * 6, ny = -hy * 6, nz = 1, l = Math.hypot(nx, ny, nz);
    const o = (j * N + i) * 4;
    img.data[o] = ((nx / l) * 0.5 + 0.5) * 255; img.data[o + 1] = ((ny / l) * 0.5 + 0.5) * 255; img.data[o + 2] = ((nz / l) * 0.5 + 0.5) * 255; img.data[o + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 16;
  waveNormalCache = t;
  return t;
};

const envCache: Record<string, THREE.CanvasTexture> = {};
/** 水面に映す空（上は空の色、水平線より下は暗い色）。曇り空の映り込みで、遠くの水面ほど明るくなる */
const skyEnv = (top: string, low: string, below: string) => {
  const key = top + low + below;
  if (envCache[key]) return envCache[key];
  const cv = document.createElement("canvas");
  cv.width = 64; cv.height = 256;
  const c = cv.getContext("2d")!;
  const g = c.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, top); g.addColorStop(0.46, low); g.addColorStop(0.5, low); g.addColorStop(0.54, below); g.addColorStop(1, below);
  c.fillStyle = g; c.fillRect(0, 0, 64, 256);
  const t = new THREE.CanvasTexture(cv);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  envCache[key] = t;
  return t;
};

/** 湾の水面：空が映る（遠いほど明るい）。小さな波の法線をゆっくり流す */
export const BayWater: React.FC<{ t: number; color: string; env: [string, string, string]; envK?: number; tile?: number; drift?: number; waves?: number; rough?: number; rot?: number }> = ({
  t, color, env, envK = 1, tile = 40, drift = 1, waves = 0.24, rough = 0.32, rot = 0,
}) => {
  const SIZE = 16000;
  const nrm = useMemo(() => {
    const n = waveNormals().clone();
    n.repeat.set(SIZE / tile, SIZE / tile);
    n.rotation = rot; // 波の筋を、見る向きに対して横に（縦にすると遠くで細かい縞になってちらつく）
    n.needsUpdate = true;
    return n;
  }, [tile, rot]);
  nrm.offset.set((t * 0.035 * drift) / tile, (t * 0.015 * drift) / tile);
  const envMap = skyEnv(...env);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[SIZE, SIZE]} />
      <meshStandardMaterial color={color} roughness={rough} metalness={0} envMap={envMap} envMapIntensity={envK} normalMap={nrm} normalScale={new THREE.Vector2(waves, waves)} />
    </mesh>
  );
};

/* ---------- 空とまわりの丘（島を囲む筒に描く。遠いのでカメラが動いてもずれない） ---------- */

export type Look = "overcast" | "morning" | "dusk" | "night" | "dawn";

const LOOKS: Record<Look, { skyTop: string; skyLow: string; far: string; near: string; city: string; haze: string }> = {
  overcast: { skyTop: "#7c858b", skyLow: "#b4b9bb", far: "#9ba2a3", near: "#7a8480", city: "#8f9492", haze: "rgba(180,185,187,0.85)" },
  morning: { skyTop: "#868e95", skyLow: "#c0c3c2", far: "#a8adac", near: "#858d89", city: "#9a9e9b", haze: "rgba(192,195,194,0.9)" },
  dusk: { skyTop: "#3d434d", skyLow: "#8a8a8c", far: "#6c6f74", near: "#4f5556", city: "#5e6264", haze: "rgba(130,130,132,0.75)" },
  // 夜：雲の底が街の灯りでうっすら明るい（サンフランシスコの夜空）。丘は黒い影
  night: { skyTop: "#11141c", skyLow: "#4c4c58", far: "#1e222a", near: "#13171c", city: "#16171b", haze: "rgba(72,72,82,0.6)" },
  dawn: { skyTop: "#3e4656", skyLow: "#aca59d", far: "#60656c", near: "#3b4146", city: "#545659", haze: "rgba(162,154,148,0.6)" },
};

/** 方角（度。北=0、東=90）ごとの丘の高さ（筒の上の m。半径4000m の筒） */
const ridgeNear = (az: number) => {
  const d = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
  let h = 0;
  h = Math.max(h, 270 * Math.max(0, 1 - Math.pow(d(az, 355) / 24, 1.6))); // エンジェル島
  h = Math.max(h, 170 * Math.max(0, 1 - Math.pow(d(az, 8) / 16, 2)));
  h = Math.max(h, 130 * Math.max(0, 1 - Math.pow(d(az, 325) / 10, 2))); // ティブロン
  h = Math.max(h, 240 * Math.max(0, 1 - Math.pow(d(az, 290) / 22, 2))); // マリンの岬
  h = Math.max(h, 190 * Math.max(0, 1 - Math.pow(d(az, 205) / 40, 2))); // サンフランシスコの丘
  h = Math.max(h, 60 * Math.max(0, 1 - Math.pow(d(az, 140) / 16, 2))); // トレジャー・アイランドの方
  return h;
};
const ridgeFar = (az: number) => {
  const d = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
  let h = 0;
  h = Math.max(h, 300 * Math.max(0, 1 - Math.pow(d(az, 312) / 26, 2))); // タマルパイス山
  h = Math.max(h, 170 * Math.max(0, 1 - Math.pow(d(az, 80) / 45, 2))); // バークレーの丘
  h = Math.max(h, 150 * Math.max(0, 1 - Math.pow(d(az, 210) / 30, 2))); // ツインピークス
  h = Math.max(h, 80 * Math.max(0, 1 - Math.pow(d(az, 30) / 18, 2))); // リッチモンド
  return h;
};

const panoCache: Record<string, THREE.CanvasTexture> = {};
const panorama = (look: Look, ridges = true) => {
  const key = look + (ridges ? "" : "-sea");
  if (panoCache[key]) return panoCache[key];
  const L = LOOKS[look];
  const W = 4096, H = 512, HM = 1000, Y0 = -20; // 筒の高さ 1000m（-20m〜980m）
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const c = cv.getContext("2d")!;
  c.clearRect(0, 0, W, H);
  const row = (m: number) => H * (1 - (m - Y0) / HM);
  const az = (u: number) => {
    // 筒の u：0 → +z（南）、0.25 → +x（東）、0.5 → -z（北）、0.75 → -x（西）
    const th = u * Math.PI * 2, x = Math.sin(th), z = Math.cos(th);
    return ((Math.atan2(x, -z) * 180) / Math.PI + 360) % 360;
  };
  const layer = (fn: (a: number) => number, color: string, rough: number, seed: number) => {
    c.fillStyle = color;
    c.beginPath(); c.moveTo(0, H);
    for (let px = 0; px <= W; px += 4) {
      const a = az(px / W);
      const h = fn(a);
      const m = h > 0 ? h + (fbm(px / 60 + seed, seed) - 0.5) * rough * Math.min(1, h / 60) : -5;
      c.lineTo(px, row(m));
    }
    c.lineTo(W, H); c.closePath(); c.fill();
  };
  if (ridges) {
    layer(ridgeFar, L.far, 60, 3);
    layer(ridgeNear, L.near, 70, 7);
  }
  // サンフランシスコの街並み（低い四角の並び。1962年なので高い塔は少ない。どの建物かは描き分けない）
  for (let px = 0; px < W; px += 3) {
    const a = az(px / W);
    if (!ridges || a < 168 || a > 238) continue;
    const base = ridgeNear(a);
    const bh = 10 + random(`cty${px >> 3}`) * 30 * (1 - Math.abs(a - 200) / 40);
    c.fillStyle = L.city;
    c.fillRect(px, row(base + bh), 3, row(base) - row(base + bh) + 1);
  }
  // 夜は街の灯り（にじませた小さな点。止まっている。細かすぎる点はカメラが動くと瞬くので、少しぼかす）
  if (look === "night" && ridges) {
    const dots = (a0: number, a1: number, n: number, warm: number, seed: string) => {
      for (let i = 0; i < n; i++) {
        const u = random(`lu${seed}${i}`);
        const px = Math.floor(u * W);
        const a = az(u);
        if (a < a0 || a > a1) continue;
        const base = Math.max(ridgeNear(a), 2);
        const m = 2 + random(`lm${seed}${i}`) * Math.max(8, base * 0.9);
        const y = row(m), r = 1.6 + random(`lr${seed}${i}`) * 1.4;
        const gg = c.createRadialGradient(px, y, 0, px, y, r);
        const col = random(`lc${seed}${i}`) < warm ? "255,196,130" : "235,232,220";
        gg.addColorStop(0, `rgba(${col},${0.55 + random(`la${seed}${i}`) * 0.35})`); gg.addColorStop(1, `rgba(${col},0)`);
        c.fillStyle = gg; c.fillRect(px - r, y - r, r * 2, r * 2);
      }
    };
    dots(165, 240, 9000, 0.65, "sf"); // サンフランシスコ
    dots(55, 115, 3500, 0.6, "eb"); // バークレー・オークランド
    dots(318, 338, 700, 0.7, "tb"); // ティブロン
  }
  // 水平線のもや
  const g = c.createLinearGradient(0, row(140), 0, row(-5));
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, L.haze);
  c.fillStyle = g;
  c.fillRect(0, row(140), W, row(-5) - row(140));
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  panoCache[key] = t;
  return t;
};

const skyCache: Record<string, THREE.CanvasTexture> = {};
const skyTex = (look: Look) => {
  if (skyCache[look]) return skyCache[look];
  const L = LOOKS[look];
  const cv = document.createElement("canvas");
  cv.width = 8; cv.height = 256;
  const c = cv.getContext("2d")!;
  const g = c.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, L.skyTop); g.addColorStop(0.42, L.skyTop); g.addColorStop(0.5, L.skyLow); g.addColorStop(1, L.skyLow);
  c.fillStyle = g; c.fillRect(0, 0, 8, 256);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  skyCache[look] = t;
  return t;
};

export const BaySurround: React.FC<{ look: Look; dim?: number; ridges?: boolean }> = ({ look, dim = 1, ridges = true }) => {
  const pano = panorama(look, ridges);
  const sky = skyTex(look);
  const k = new THREE.Color(dim, dim, dim);
  return (
    <group>
      <mesh renderOrder={-2}>
        <sphereGeometry args={[7000, 32, 16]} />
        <meshBasicMaterial map={sky} color={k} side={THREE.BackSide} fog={false} depthWrite={false} />
      </mesh>
      <mesh position={[0, 480, 0]} renderOrder={-1}>
        <cylinderGeometry args={[4000, 4000, 1000, 96, 1, true]} />
        <meshBasicMaterial map={pano} color={k} transparent side={THREE.BackSide} fog={false} depthWrite={false} />
      </mesh>
    </group>
  );
};

/* ---------- 場面 ---------- */

export const BG: Record<Look, string> = { overcast: "#aeb3b5", morning: "#babdbc", dusk: "#7d7e82", night: "#2c2d35", dawn: "#8f8b87" };
/** 水面に映す空：上の空、水平線、水平線より下（向こう岸の暗さ） */
export const ENV: Record<Look, [string, string, string]> = {
  overcast: ["#8a9296", "#b9bebf", "#4d5654"],
  morning: ["#939ba0", "#c3c6c5", "#56605d"],
  dusk: ["#454b55", "#8c8b8e", "#2c3232"],
  night: ["#14161d", "#5a5a66", "#0c0d10"],
  dawn: ["#4c5462", "#b6aea4", "#30363a"],
};

/** 曇りの湾と島。look で空の色、dim で暗さ（夕方に光が落ちる） */
const BayScene: React.FC<{ look: Look; from: CamKey; to: CamKey; dim?: number; glow?: number; lit?: number; fog?: number }> = ({ look, from, to, dim = 1, glow = 0, lit = 0, fog = 0.00026 }) => {
  // 波の筋の向き：カメラの向きに合わせる
  const rot = Math.atan2(to.target[0] - to.pos[0], -(to.target[2] - to.pos[2]));
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const water = look === "dusk" ? "#1c2322" : look === "morning" ? "#26302d" : "#232c29";
  return (
    <Stage fog={fog} exposure={1.0} bloom={0} bg={BG[look]} hemi={[look === "dusk" ? "#8a8c94" : "#cfd3d6", "#55554e", (look === "dusk" ? 0.75 : 1.15) * dim]}>
      <Cam006 from={from} to={to} near={2} far={9000} />
      <directionalLight position={[-300, 500, 400]} intensity={(look === "dusk" ? 0.35 : 0.75) * dim} color={look === "dusk" ? "#c8b8b0" : "#eceef0"} />
      <BaySurround look={look} dim={dim} />
      <BayWater t={t} color={water} env={ENV[look]} envK={dim} rot={rot} />
      <AlcatrazIsland glow={glow} lit={lit} />
    </Stage>
  );
};

export const InsertIslandFar006: React.FC<SceneProps> = ({ variant = "a" }) => {
  const frame = useCurrentFrame();
  const dur = useInsertDur();
  const p = frame / Math.max(1, dur - 1);
  // 南東（サンフランシスコの側）から、北西へ向いた遠景。島は画面の中ほどに低く（F-050：主役は真ん中）
  const cams: Record<string, [CamKey, CamKey]> = {
    a: [{ pos: [260, 7, 1650], target: [10, 22, 0], fov: 25 }, { pos: [190, 7, 1640], target: [6, 22, 0], fov: 25 }],
    b: [{ pos: [150, 6, 1020], target: [16, 24, 0], fov: 27 }, { pos: [112, 6, 1016], target: [15, 24, 0], fov: 27 }],
    // 横から（西南西）。左右に霧の丘
    // 近くの水面が画面の下に入るとちらつくので、カメラを少し高く（画面の下に映る水面を遠くに）、横の動きは小さく
    c: [{ pos: [-1170, 9, 1070], target: [0, 24, 0], fov: 24 }, { pos: [-1159, 9, 1080], target: [2, 24, 0], fov: 24 }],
    d: [{ pos: [300, 7, 1550], target: [12, 22, 0], fov: 26 }, { pos: [250, 7, 1545], target: [10, 22, 0], fov: 26 }],
    // 北東（エンジェル島の側）から。3人が離れた北東の岸の側を見る（006 の s030。島の北東の岸の航空写真の代わり）
    e: [{ pos: [1010, 9, -1180], target: [0, 20, 0], fov: 24 }, { pos: [985, 9, -1205], target: [0, 20, 0], fov: 24 }],
  };
  const [from, to] = cams[variant] ?? cams.a;
  if (variant === "d") {
    // 夕方：光が少しずつ落ちる。灯台は止まった灯り（回る光の筋は描かない：明滅になる）
    const dim = interpolate(p, [0, 1], [1, 0.72], clamp);
    return <BayScene look="dusk" from={from} to={to} dim={dim} glow={interpolate(p, [0, 1], [0.6, 1.6], clamp)} lit={interpolate(p, [0, 1], [0.2, 0.6], clamp)} />;
  }
  if (variant === "e") {
    // 日暮れ：d と同じ見た目で、光は落としきった所で止める（島の形と房棟が静止画1コマで分かる明るさ。F-052）
    return <BayScene look="dusk" from={from} to={to} dim={0.8} glow={1.2} lit={0.5} />;
  }
  return <BayScene look="overcast" from={from} to={to} />;
};

export const InsertIslandBoat006: React.FC<SceneProps> = ({ variant = "a" }) => {
  // 水面の低い所（船の甲板くらいの高さ）から。船そのものは画面に入れない
  const cams: Record<string, [CamKey, CamKey]> = {
    // 遠景（island_far a・b）と見分けがつくよう、近くまで寄せる（船の速さ、毎秒5m前後）
    a: [{ pos: [250, 4, 500], target: [28, 24, 0], fov: 38 }, { pos: [243, 4, 466], target: [28, 24, 0], fov: 38 }],
    // 北側を近くから：岩の斜面の上に房棟
    b: [{ pos: [-60, 4, -360], target: [14, 34, 0], fov: 38 }, { pos: [-20, 4, -340], target: [18, 34, 0], fov: 38 }],
    // 曇りの朝、水面すれすれから横へ流して
    c: [{ pos: [-250, 2.5, 640], target: [-20, 22, 0], fov: 32 }, { pos: [-225, 2.5, 640], target: [4, 22, 0], fov: 32 }],
    // 島の全景をゆっくり引いていく
    d: [{ pos: [170, 7, 520], target: [22, 26, 0], fov: 31 }, { pos: [182, 7.5, 562], target: [21, 25, 0], fov: 35 }],
  };
  const [from, to] = cams[variant] ?? cams.a;
  return <BayScene look={variant === "c" ? "morning" : "overcast"} from={from} to={to} />;
};
