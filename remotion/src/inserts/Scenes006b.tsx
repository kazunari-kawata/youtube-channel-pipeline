/**
 * 006 アルカトラズ脱獄（1962年6月）のイメージ映像：夜の岸・夜の湾・外海の浜・巡視艇・エンジェル島の捜索
 *   shore_night：島の北東の岸（a 夜の岩と黒い水と遠い島影、b 夜明けに上の道から見下ろす、c 水ぎわから暗い水面、d 水ぎわ。黒い水がゆっくり沖へ）
 *   bay_night：夜の湾（a 水面すれすれと遠い街の灯り、b 外海の方角の暗い水平線とうねり、c エンジェル島の岩場に打ちつける波）
 *   beach_day：曇りの午後の外海の浜（a 波打ち際と流木、b 灰色の水平線とうねり）
 *   patrol_boat：夜の湾の灰色の小型艇（a 横から遠景、探照灯はゆっくり、b 船尾から前を見る。乗員の後ろ姿）
 *   angel_search：エンジェル島の草の斜面を横切って捜す兵士たち（遠目。顔・武器・記章なし）
 * いかだ・救命胴衣・櫂・遺体・泳ぐ人は描かない（台本の note）。艇に標章・文字は入れない。
 * 動く光はゆっくり（探照灯は大きく振らない。速い明暗の変化はチラつきになる）。赤い光は使わない。
 * 方角は Scenes006a と同じ（北が -z）。空と遠くの丘は Scenes006a の BaySurround。
 */
import React, { useMemo } from "react";
import { interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { Build, Figure } from "../lib/Figure";
import { CamKey, SceneProps, Stage, useInsertDur } from "./Inserts";

import { BayWater, BaySurround, BG, Cam006, ENV, fbm, Look } from "./Scenes006a";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
type V3 = [number, number, number];
const sstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const useT = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return frame / fps;
};
const useP = () => {
  const frame = useCurrentFrame();
  const dur = useInsertDur();
  return frame / Math.max(1, dur - 1);
};

/* ---------- 人物（顔のないシルエット。記章・文字・武器は付けない） ---------- */

/** 1962年の陸軍の兵士（作業服。帽子をかぶる）。遠目にしか映さない */
export const SOLDIER_62: Build = { shoulder: 0.92, width: 1.08, jacket: "#4d5239", trousers: "#474b35", shoes: "#1a1611", skin: "#16110e", hair: "none" };
/** 沿岸警備隊の艇の乗員（紺の上着と帽子）。後ろ姿だけ */
export const CREW_62: Build = { shoulder: 0.9, width: 1.0, jacket: "#1e2433", trousers: "#1b1e27", shoes: "#0e0e10", skin: "#16110e", hair: "none" };

/* ---------- 岩（球を乱数でゆがめた形。毎回同じ形） ---------- */

const rockGeoCache: Record<number, THREE.BufferGeometry> = {};
const rockGeo = (seed: number) => {
  if (rockGeoCache[seed]) return rockGeoCache[seed];
  const g = new THREE.IcosahedronGeometry(1, 3);
  const p = g.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i));
    const n = fbm(v.x * 1.4 + seed * 3.1, v.y * 1.4 + v.z * 0.9 - seed);
    const k = 1 + (n - 0.5) * 0.7;
    p.setXYZ(i, v.x * k, v.y * k * 0.62, v.z * k);
  }
  g.computeVertexNormals();
  rockGeoCache[seed] = g;
  return g;
};

type Rock = { p: V3; s: V3; r: number; seed: number };
const Rocks: React.FC<{ items: Rock[]; dry: string; wet: string; waterY?: number }> = ({ items, dry, wet, waterY = 0 }) => {
  const mats = useMemo(() => ({
    dry: new THREE.MeshStandardMaterial({ color: dry, roughness: 0.92 }),
    wet: new THREE.MeshStandardMaterial({ color: wet, roughness: 0.38, metalness: 0.05 }),
  }), [dry, wet]);
  return (
    <group>
      {items.map((k, i) => (
        <mesh key={i} geometry={rockGeo(k.seed % 12)} material={k.p[1] < waterY + 0.4 ? mats.wet : mats.dry} position={k.p} scale={k.s} rotation={[0, k.r, 0]} castShadow receiveShadow />
      ))}
    </group>
  );
};

/** 水ぎわに沿って岩を並べる（z が負の側が海） */
const shoreRocks = (seed: string, n: number, x0: number, x1: number, z0: number, z1: number, smin: number, smax: number, hill = 16): Rock[] =>
  Array.from({ length: n }, (_, i) => {
    const s = smin + random(`rs${seed}${i}`) * (smax - smin);
    const z = z0 + random(`rz${seed}${i}`) * (z1 - z0), x = x0 + random(`rx${seed}${i}`) * (x1 - x0);
    return {
      p: [x, Math.max(-0.22 * s, shoreH(x, z, hill)) - s * 0.08, z] as V3,
      s: [s * (0.8 + random(`ra${seed}${i}`) * 0.6), s, s * (0.8 + random(`rb${seed}${i}`) * 0.6)] as V3,
      r: random(`rr${seed}${i}`) * 6.28,
      seed: Math.floor(random(`rk${seed}${i}`) * 1000),
    };
  });

/** 岸の地面の高さ：水ぎわ（z = 0）から陸（+z）へ上がる岩がちの斜面。hill で奥の高さ */
const shoreH = (x: number, z: number, hill: number) => {
  const n = fbm(x / 5 + 2, z / 5 - 3);
  let h = -0.5 + z * 0.28 + (n - 0.5) * 1.4;
  h += hill * sstep(14, 40, z) + (fbm(x / 18, z / 18) - 0.5) * 4 * sstep(10, 30, z);
  return Math.max(-2.5, h);
};
const ShoreGround: React.FC<{ hill?: number; color: string; size?: [number, number] }> = ({ hill = 14, color, size = [240, 120] }) => {
  const geo = useMemo(() => {
    const [W, D] = size, NX = 160, NZ = 90;
    const pos: number[] = [];
    for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
      const x = -W / 2 + (W * i) / NX, z = -8 + (D * j) / NZ;
      pos.push(x, shoreH(x, z, hill), z);
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
    return g;
  }, [hill, size]);
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial color={color} roughness={0.95} />
    </mesh>
  );
};

/** 岩に寄せる白い泡（ゆっくり濃くなったり薄くなったりする。周期7秒） */
const foamTexCache: Record<string, THREE.CanvasTexture> = {};
const foamTex = (key: string) => {
  if (foamTexCache[key]) return foamTexCache[key];
  const cv = document.createElement("canvas");
  cv.width = 512; cv.height = 128;
  const c = cv.getContext("2d")!;
  c.clearRect(0, 0, 512, 128);
  for (let i = 0; i < 900; i++) {
    const x = random(`fx${key}${i}`) * 512, y = 64 + (random(`fy${key}${i}`) - 0.5) * 90 * random(`fz${key}${i}`);
    const r = 3 + random(`fr${key}${i}`) * 9;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(255,255,255,0.5)"); g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  foamTexCache[key] = t;
  return t;
};
const Foam: React.FC<{ t: number; z: number; w: number; d: number; k: number; period?: number; phase?: number; color?: string; y?: number }> = ({ t, z, w, d, k, period = 7, phase = 0, color = "#ffffff", y = 0.06 }) => {
  const tex = useMemo(() => {
    const x = foamTex("f").clone();
    x.repeat.set(w / 30, 1);
    x.needsUpdate = true;
    return x;
  }, [w]);
  const a = k * (0.55 + 0.45 * Math.sin(((t + phase) / period) * Math.PI * 2));
  return (
    <mesh position={[0, y, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[w, d]} />
      <meshBasicMaterial map={tex} color={color} transparent opacity={a} depthWrite={false} />
    </mesh>
  );
};

/* ---------- 場面の共通：空・水面・光 ---------- */

const NightWorld: React.FC<{ look: Look; dim?: number; fog?: number; children: React.ReactNode; from: CamKey; to: CamKey; near?: number; hemi?: number; exposure?: number; lightZ?: number }> = ({
  look, dim = 1, fog = 0.0004, children, from, to, near = 0.3, hemi = 1, exposure = 1, lightZ = 700,
}) => {
  const night = look === "night";
  return (
    <Stage fog={fog} exposure={exposure} bloom={0} bg={BG[look]} hemi={night ? ["#69708a", "#18181c", 1.6 * hemi * dim] : [look === "dawn" ? "#b8b0aa" : "#cfd3d6", "#4a4a44", 1.05 * hemi * dim]}>
      <Cam006 from={from} to={to} near={near} far={9000} />
      {night ? (
        // 街の灯りが雲に映った、上からのぼんやりした光（低い角度にすると水面に月の道のような光の筋が出るので、高くする）
        <directionalLight position={[0, 1400, lightZ]} intensity={0.9 * dim} color="#d2c4b0" />
      ) : (
        <directionalLight position={[-300, 500, 400]} intensity={0.7 * dim} color={look === "dawn" ? "#e8d2c0" : "#eceef0"} />
      )}
      <BaySurround look={look} dim={dim} />
      {children}
    </Stage>
  );
};

/** 波の筋の向き（カメラの向きに対して横） */
const rotOf = (c: CamKey) => Math.atan2(c.target[0] - c.pos[0], -(c.target[2] - c.pos[2]));

/* ---------- 1. 島の北東の岸 ---------- */

export const InsertShoreNight006: React.FC<SceneProps> = ({ variant = "a" }) => {
  const t = useT();
  const p = useP();
  const rocks = useMemo(() => [...shoreRocks("n1", 70, -60, 60, -6, 3, 0.5, 2.4), ...shoreRocks("n2", 40, -70, 70, 2, 14, 1.0, 3.6)], []);
  // 北東の岸から、北東（エンジェル島の右）の沖を見る。カメラは陸（+z）の側
  const cams: Record<string, [CamKey, CamKey]> = {
    a: [{ pos: [-2, 4.4, 9], target: [18, -9, -80], fov: 44 }, { pos: [1, 4.4, 8.4], target: [20, -9, -80], fov: 43 }],
    // 夜明け：上の道から見下ろす。明るくなっていく湾
    b: [{ pos: [-12, 36, 48], target: [6, 0, -14], fov: 46 }, { pos: [-9, 36, 46], target: [8, 0, -16], fov: 45 }],
    // 水ぎわから、暗い水面
    c: [{ pos: [3, 1.5, -0.5], target: [14, 0.0, -90], fov: 40 }, { pos: [3.6, 1.5, -0.8], target: [16, 0.0, -90], fov: 40 }],
    // 水ぎわ。黒い水がゆっくり沖へ
    d: [{ pos: [-4, 2.2, 3.5], target: [6, -0.6, -26], fov: 42 }, { pos: [-3.4, 2.2, 3.1], target: [6, -0.6, -26], fov: 42 }],
  };
  const [from, to] = cams[variant] ?? cams.a;
  const look: Look = variant === "b" ? "dawn" : "night";
  const dim = variant === "b" ? interpolate(p, [0, 1], [0.72, 1.0], clamp) : 1;
  const env = ENV[look];
  return (
    <NightWorld look={look} dim={dim} from={from} to={to} fog={variant === "b" ? 0.00035 : 0.0005} hemi={variant === "b" ? 1 : 1.1}>
      <ShoreGround hill={16} color={look === "night" ? "#3d3c38" : "#5a5850"} />
      <Rocks items={rocks} dry={look === "night" ? "#5d5b55" : "#6c6961"} wet={look === "night" ? "#34343a" : "#3e3d39"} />
      <BayWater t={t} color={look === "night" ? "#0c1011" : "#2a3331"} env={env} envK={dim} rot={rotOf(to)} drift={variant === "d" ? 1.6 : 1} />
      <Foam t={t} z={-1.2} w={140} d={2.6} k={look === "night" ? 0.35 : 0.4} color={look === "night" ? "#c4cad2" : "#ffffff"} />
      <Foam t={t} z={-3.4} w={140} d={2.0} k={look === "night" ? 0.2 : 0.24} phase={3} color={look === "night" ? "#c4cad2" : "#ffffff"} />
    </NightWorld>
  );
};

/* ---------- 2. 夜の湾 ---------- */

export const InsertBayNight006: React.FC<SceneProps> = ({ variant = "a" }) => {
  const t = useT();
  const cams: Record<string, [CamKey, CamKey]> = {
    // 水面すれすれから、南の街の灯り
    a: [{ pos: [0, 1.6, 0], target: [-120, 2, 1000], fov: 40 }, { pos: [6, 1.6, 2], target: [-80, 2, 1000], fov: 40 }],
    // 西（金門橋の向こうの外海の方角）。暗い水平線とうねり
    b: [{ pos: [0, 1.8, 0], target: [-1000, 0, 60], fov: 42 }, { pos: [0, 1.8, -4], target: [-1000, 0, 90], fov: 42 }],
    // エンジェル島の岩場：海の側から岸を見る
    c: [{ pos: [-4, 2.4, -26], target: [2, 3, 10], fov: 44 }, { pos: [-1, 2.4, -25], target: [4, 3, 10], fov: 43 }],
  };
  const [from, to] = cams[variant] ?? cams.a;
  if (variant === "c") {
    const rocks = shoreRocks("ac", 90, -50, 50, -7, 6, 0.6, 3.2, 60);
    return (
      <NightWorld look="night" from={from} to={to} fog={0.0006} hemi={1.5} lightZ={-900}>
        <ShoreGround hill={60} color="#4a5444" />
        <Rocks items={rocks} dry="#5a5952" wet="#36363a" />
        <BayWater t={t} color="#0c1011" env={ENV.night} rot={rotOf(to)} drift={1.4} waves={0.45} />
        <Foam t={t} z={-1.6} w={120} d={3.2} k={0.5} color="#d0d6de" period={5.5} />
        <Foam t={t} z={-4.2} w={120} d={2.4} k={0.34} color="#d0d6de" period={6.5} phase={2.4} />
        <Foam t={t} z={-6.4} w={120} d={2.0} k={0.22} color="#d0d6de" period={7.5} phase={4.1} />
      </NightWorld>
    );
  }
  return (
    <NightWorld look="night" from={from} to={to} fog={0.00035}>
      <BayWater t={t} color="#0b0f10" env={ENV.night} rot={rotOf(to)} waves={variant === "b" ? 0.55 : 0.4} tile={variant === "b" ? 60 : 40} />
    </NightWorld>
  );
};

/* ---------- 3. 外海の浜（曇りの午後） ---------- */

let sandCache: THREE.CanvasTexture | null = null;
/** 明るい灰色がかった砂（外海の浜）。粒の点と、波が残した筋 */
const beachSand = () => {
  if (sandCache) return sandCache;
  const cv = document.createElement("canvas");
  cv.width = cv.height = 512;
  const c = cv.getContext("2d")!;
  c.fillStyle = "#b7ad97"; c.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 26000; i++) {
    const v = random(`bs${i}`);
    c.fillStyle = v < 0.5 ? "rgba(110,102,88,0.3)" : "rgba(214,206,188,0.3)";
    c.fillRect(random(`bsx${i}`) * 512, random(`bsy${i}`) * 512, 1 + v * 2, 1 + v * 2);
  }
  c.strokeStyle = "rgba(120,110,95,0.25)";
  for (let k = 0; k < 10; k++) {
    c.lineWidth = 3;
    c.beginPath();
    const y = random(`bsl${k}`) * 512;
    c.moveTo(0, y);
    for (let x = 0; x <= 512; x += 32) c.lineTo(x, y + Math.sin(x / 70 + k) * 8);
    c.stroke();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  sandCache = t;
  return t;
};

/** 流木：少し曲がった幹（細い管を曲線に沿わせる）と、折れた枝の付け根 */
const Log: React.FC<{ position: V3; len: number; r: number; rotY: number; bend?: number; seed: number }> = ({ position, len, r, rotY, bend = 0.25, seed }) => {
  const geo = useMemo(() => {
    const pts = [0, 0.33, 0.66, 1].map((k) => new THREE.Vector3((k - 0.5) * len, r * 0.6 + Math.sin(k * Math.PI) * bend * 0.3, Math.sin(k * Math.PI * 1.3 + seed) * bend));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, r, 7, false);
  }, [len, r, bend, seed]);
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh geometry={geo} castShadow receiveShadow>
        <meshStandardMaterial color="#a29a8b" roughness={1} flatShading />
      </mesh>
      <mesh position={[len * 0.2, r * 1.3, 0]} rotation={[0.3, 0, 0.9]} castShadow>
        <cylinderGeometry args={[r * 0.15, r * 0.3, len * 0.18, 6]} />
        <meshStandardMaterial color="#958d7e" roughness={1} flatShading />
      </mesh>
    </group>
  );
};

export const InsertBeachDay006: React.FC<SceneProps> = ({ variant = "a" }) => {
  const t = useT();
  const sand = useMemo(() => {
    const tx = beachSand().clone();
    tx.repeat.set(60, 8);
    tx.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: tx, roughness: 0.95, color: "#ffffff" });
  }, []);
  // 浜は x 方向に長く、海は -z（西）。波打ち際は z = 0
  const cams: Record<string, [CamKey, CamKey]> = {
    a: [{ pos: [-10, 1.4, 12], target: [8, 0.3, -6], fov: 42 }, { pos: [-8.8, 1.4, 11.2], target: [9, 0.3, -6], fov: 41 }],
    b: [{ pos: [0, 2.2, 6], target: [2, 1.5, -400], fov: 40 }, { pos: [0, 2.2, 5.4], target: [6, 1.5, -400], fov: 40 }],
  };
  const [from, to] = cams[variant] ?? cams.a;
  // 寄せる波の白い筋：沖から波打ち際へ、ゆっくり（1本9秒）
  const surf = [0, 3, 6].map((ph) => {
    const k = ((t + ph) % 9) / 9;
    return { z: -26 + k * 24, a: Math.sin(k * Math.PI) * 0.55 };
  });
  // 浜に上がる薄い水の膜
  const wash = 0.5 + 0.5 * Math.sin((t / 9) * Math.PI * 2 - 1.2);
  return (
    <Stage fog={0.0004} exposure={1.0} bloom={0} bg={BG.overcast} hemi={["#d2d6d9", "#5a564e", 1.15]}>
      <Cam006 from={from} to={to} near={0.3} far={9000} />
      <directionalLight position={[-200, 400, 300]} intensity={0.7} color="#eceef0" />
      <BaySurround look="overcast" ridges={false} />
      {/* 砂（波打ち際より陸側） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 40]} material={sand} receiveShadow>
        <planeGeometry args={[600, 80]} />
      </mesh>
      {/* 濡れた砂（水の下まで続く緩い斜面） */}
      <mesh rotation={[-Math.PI / 2 + 0.02, 0, 0]} position={[0, -0.12, -6]}>
        <planeGeometry args={[600, 12]} />
        <meshStandardMaterial color="#6a665d" roughness={0.3} metalness={0.1} />
      </mesh>
      <BayWater t={t} color="#2e3638" env={ENV.overcast} rot={rotOf(to)} waves={0.5} tile={50} drift={1.2} />
      {surf.map((s, i) => (
        <Foam key={i} t={0} z={s.z} w={300} d={4.5} k={Math.min(1, s.a * 2.2)} y={0.08} />
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, -1 + wash * 2.5]}>
        <planeGeometry args={[300, 4]} />
        <meshStandardMaterial color="#8a8e8c" roughness={0.15} metalness={0.1} transparent opacity={0.35 * wash} depthWrite={false} />
      </mesh>
      <Log position={[4, 0, 3.5]} len={4.2} r={0.17} rotY={0.35} seed={1} />
      <Log position={[11, 0, 6.5]} len={2.6} r={0.12} rotY={-0.7} seed={2} />
      <Log position={[0, 0, 7.5]} len={3.4} r={0.15} rotY={2.6} seed={3} />
      <Log position={[18, 0, 4.5]} len={3.6} r={0.15} rotY={0.1} seed={4} />
    </Stage>
  );
};

/* ---------- 4. 巡視艇（灰色の小型艇。標章・文字なし） ---------- */

const PatrolBoat: React.FC<{ beam: number; sweep: number }> = ({ beam, sweep }) => {
  const gray = "#959aa0", dark = "#2a2d31";
  const spot = useMemo(() => {
    const l = new THREE.SpotLight("#f2efe4", 0, 220, 0.12, 0.6, 1.4);
    return l;
  }, []);
  spot.intensity = 0; // 水面を照らすと、明るい三角の板のように見えるので照らさない（光の筋だけ見せる）
  spot.penumbra = 0.85;
  const dir = new THREE.Vector3(Math.sin(sweep), -0.09, -Math.cos(sweep)).normalize();
  spot.position.set(0, 4.2, -1.4);
  spot.target.position.set(dir.x * 60, 4.2 + dir.y * 60, -1.4 + dir.z * 60);
  return (
    <group>
      {/* 船体：箱と、とがった舳先 */}
      <mesh position={[0, 0.7, 1]} castShadow>
        <boxGeometry args={[3.4, 1.6, 9]} />
        <meshStandardMaterial color={gray} roughness={0.7} />
      </mesh>
      {/* 舳先：45度回した箱の前半分が、とがって突き出る */}
      <mesh position={[0, 0.7, -3.5]} rotation={[0, Math.PI / 4, 0]} scale={[1, 1, 1.45]}>
        <boxGeometry args={[2.4, 1.6, 2.4]} />
        <meshStandardMaterial color={gray} roughness={0.7} />
      </mesh>
      {/* 船室と窓 */}
      <mesh position={[0, 2.4, -0.6]} castShadow>
        <boxGeometry args={[2.6, 1.8, 3.2]} />
        <meshStandardMaterial color="#8d9298" roughness={0.7} />
      </mesh>
      <mesh position={[0, 2.7, -2.22]}>
        <planeGeometry args={[2.2, 0.6]} />
        <meshStandardMaterial color="#111" emissive="#e8d8b0" emissiveIntensity={0.25} />
      </mesh>
      {/* 船室の横の窓（中の灯りがうっすら） */}
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[sd * 1.31, 2.7, -0.6]} rotation={[0, sd * Math.PI / 2, 0]}>
          <planeGeometry args={[2.2, 0.5]} />
          <meshStandardMaterial color="#111" emissive="#e8d8b0" emissiveIntensity={0.45} />
        </mesh>
      ))}
      {/* 船べりの白っぽい縁 */}
      <mesh position={[0, 1.52, 1]}>
        <boxGeometry args={[3.5, 0.08, 9.1]} />
        <meshStandardMaterial color="#c8ccd0" roughness={0.6} />
      </mesh>
      {/* 船室の上の探照灯と細い柱 */}
      <mesh position={[0, 3.7, -1.4]}>
        <cylinderGeometry args={[0.22, 0.26, 0.5, 12]} />
        <meshStandardMaterial color={dark} emissive="#fff4dc" emissiveIntensity={beam * 1.5} />
      </mesh>
      <mesh position={[0, 4.6, 0.4]}>
        <cylinderGeometry args={[0.05, 0.05, 2.6, 6]} />
        <meshStandardMaterial color={dark} />
      </mesh>
      {/* 帆柱の灯り：小さく明るい点は遠くで瞬いて見えるので、少し大きく、明るさは控えめに */}
      <mesh position={[0, 5.9, 0.4]}>
        <sphereGeometry args={[0.16, 10, 10]} />
        <meshBasicMaterial color={new THREE.Color("#fff6e6").multiplyScalar(0.95)} toneMapped={false} />
      </mesh>
      {/* 光の筋（霧に当たって見える）。ゆっくり振る */}
      <mesh position={[dir.x * 30, 3.7 + dir.y * 30, -1.4 + dir.z * 30]} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate())}>
        {/* 先のとがった円錐にすると、灯りの所で1画素より細くなってちらつくので、根元に太さを残す */}
        <cylinderGeometry args={[0.3, 6.5, 60, 24, 1, true]} />
        <meshBasicMaterial color="#f2eee2" transparent opacity={0.075 * beam} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
      </mesh>
      {/* 船室の中の灯りが甲板を照らす */}
      <pointLight position={[0, 3.6, 2.6]} intensity={5} distance={8} decay={1.6} color="#f0dcb8" />
      {/* 船室の後ろの戸（暗い板） */}
      <mesh position={[0, 2.3, 1.02]}>
        <planeGeometry args={[0.8, 1.4]} />
        <meshStandardMaterial color="#2a2c30" roughness={0.6} />
      </mesh>
      {/* 手すり */}
      {[-1.62, 1.62].map((x) => (
        <group key={x}>
          <mesh position={[x, 2.3, 2.6]}>
            <boxGeometry args={[0.05, 0.05, 6]} />
            <meshStandardMaterial color="#5a5e64" roughness={0.6} />
          </mesh>
          {[0, 1, 2, 3].map((k) => (
            <mesh key={k} position={[x, 1.9, 0 + k * 1.8]}>
              <boxGeometry args={[0.04, 0.8, 0.04]} />
              <meshStandardMaterial color="#5a5e64" roughness={0.6} />
            </mesh>
          ))}
        </group>
      ))}
      <primitive object={spot} />
      <primitive object={spot.target} />
    </group>
  );
};

let wakeCache: THREE.CanvasTexture | null = null;
/** 航跡の絵：艇に近いほど白く、離れるほど薄れて消える */
const wakeTex = () => {
  if (wakeCache) return wakeCache;
  const cv = document.createElement("canvas");
  cv.width = 1024; cv.height = 128;
  const c = cv.getContext("2d")!;
  for (let i = 0; i < 1600; i++) {
    const x = random(`wx${i}`) * 1024, spread = 10 + (x / 1024) * 50;
    const y = 64 + (random(`wy${i}`) - 0.5) * spread * 2;
    const r = 3 + random(`wr${i}`) * 8;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(255,255,255,0.45)"); g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  c.globalCompositeOperation = "destination-in";
  const m = c.createLinearGradient(0, 0, 1024, 0);
  m.addColorStop(0, "rgba(0,0,0,1)"); m.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = m; c.fillRect(0, 0, 1024, 128);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  wakeCache = t;
  return t;
};

/** 艇の後ろの白い航跡 */
const Wake: React.FC<{ len: number; k: number }> = ({ len, k }) => {
  const tex = wakeTex();
  return (
    <mesh position={[0, 0.05, 5.5 + len / 2]} rotation={[-Math.PI / 2, 0, -Math.PI / 2]}>
      <planeGeometry args={[len, 8]} />
      <meshBasicMaterial map={tex} color="#c8ccd2" transparent opacity={k} depthWrite={false} />
    </mesh>
  );
};

export const InsertPatrolBoat006: React.FC<SceneProps> = ({ variant = "a" }) => {
  const t = useT();
  const p = useP();
  const sweep = 0.35 * Math.sin((t / 9) * Math.PI * 2); // 探照灯：9秒で1往復、振れ幅は約20度
  const roll = 0.012 * Math.sin((t / 5) * Math.PI * 2), pitch = 0.008 * Math.sin((t / 6.5) * Math.PI * 2 + 1);
  if (variant === "b") {
    // 船尾から前を見る。艇は止めて、水面の模様を後ろへ流す（進んでいるように見せる）
    const from: CamKey = { pos: [0.3, 3.9, 10.5], target: [0, 1.8, -40], fov: 46 };
    const to: CamKey = { pos: [0.2, 3.9, 10.3], target: [-0.6, 1.8, -40], fov: 45 };
    return (
      <NightWorld look="night" from={from} to={to} fog={0.0008} near={0.2} hemi={1.3}>
        <group rotation={[pitch, 0, roll]}>
          <PatrolBoat beam={1} sweep={sweep * 0.6} />
          {/* 甲板（乗員が立つ所） */}
          <mesh position={[0, 1.52, 3.4]}>
            <boxGeometry args={[3.2, 0.06, 4.2]} />
            <meshStandardMaterial color="#4a4e54" roughness={0.85} />
          </mesh>
          <Figure clip="Idle_Loop" position={[-0.7, 1.55, 2.6]} rotationY={Math.PI} build={CREW_62} hat={CREW_62.jacket} glasses={false} />
          <Figure clip="Idle_Loop" position={[0.75, 1.55, 3.4]} rotationY={Math.PI + 0.25} build={CREW_62} hat={CREW_62.jacket} glasses={false} timeOffset={1.3} />
        </group>
        <BayWater t={t} color="#0b0f10" env={ENV.night} rot={0} drift={-6} waves={0.45} />
      </NightWorld>
    );
  }
  // a：夜の湾を行く艇を、横から遠景で。艇はゆっくり（毎秒4m）左から右へ
  const x = -22 + p * 30;
  const from: CamKey = { pos: [-12, 3.5, 58], target: [-14, 2.2, 0], fov: 28 };
  const to: CamKey = { pos: [-4, 3.5, 58], target: [2, 2.2, 0], fov: 28 };
  return (
    <NightWorld look="night" from={from} to={to} fog={0.00045} hemi={1.2}>
      <group position={[x, 0, 0]} rotation={[pitch, -Math.PI / 2, roll]}>
        <PatrolBoat beam={1} sweep={sweep} />
        <Wake len={40} k={0.35} />
      </group>
      <BayWater t={t} color="#0b0f10" env={ENV.night} rot={rotOf(to)} />
    </NightWorld>
  );
};

/* ---------- 5. エンジェル島の捜索（草の斜面を横切る兵士たち。遠目） ---------- */

/** 草の斜面の高さ：奥（-z）と右（+x）が高く、左の奥は湾へ下りる */
const slopeH = (x: number, z: number) => 16 + 0.12 * x - 0.2 * z + (fbm(x / 22 + 4, z / 22) - 0.5) * 5;

/** 低い茂み（小さな球の集まり）と、カシの木（幹と丸い葉のかたまり） */
const Shrub: React.FC<{ p: V3; s: number; seed: number }> = ({ p, s, seed }) => (
  <group position={p}>
    {[0, 1, 2, 3].map((k) => (
      <mesh key={k} position={[(random(`sh${seed}${k}`) - 0.5) * s * 1.4, s * 0.3, (random(`sz${seed}${k}`) - 0.5) * s * 1.2]} scale={s * (0.45 + random(`ss${seed}${k}`) * 0.3)} castShadow>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#4d5737" roughness={1} />
      </mesh>
    ))}
  </group>
);
const Oak: React.FC<{ p: V3; s: number; seed: number }> = ({ p, s, seed }) => (
  <group position={p}>
    <mesh position={[0, s * 0.45, 0]} castShadow>
      <cylinderGeometry args={[s * 0.05, s * 0.08, s * 0.9, 7]} />
      <meshStandardMaterial color="#3b332a" roughness={1} />
    </mesh>
    {[0, 1, 2, 3, 4, 5].map((k) => (
      <mesh key={k} position={[(random(`ok${seed}${k}`) - 0.5) * s * 1.1, s * (0.85 + random(`oy${seed}${k}`) * 0.35), (random(`oz${seed}${k}`) - 0.5) * s * 1.0]} scale={s * (0.38 + random(`os${seed}${k}`) * 0.22)} castShadow>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#3f4a31" roughness={1} />
      </mesh>
    ))}
  </group>
);

const GrassSlope: React.FC = () => {
  const geo = useMemo(() => {
    const W = 520, D = 360, NX = 170, NZ = 120;
    const pos: number[] = [], col: number[] = [];
    // 6月のカリフォルニアの草：乾いた黄土色に、緑の残るところ
    const a = new THREE.Color("#a39a6a"), b = new THREE.Color("#7f8452"), dry = new THREE.Color("#b6aa7c");
    for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
      const x = -W / 2 - 60 + (W * i) / NX, z = -D + 60 + (D * j) / NZ;
      pos.push(x, slopeH(x, z), z);
      const c = a.clone().lerp(b, fbm(x / 12, z / 12) * 0.9).lerp(dry, fbm(x / 30 + 7, z / 30) * 0.6);
      col.push(c.r, c.g, c.b);
    }
    const idx: number[] = [];
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
      const q = j * (NX + 1) + i, r = q + 1, s2 = q + NX + 1, u = s2 + 1;
      idx.push(q, s2, r, r, s2, u);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, []);
  const plants = useMemo(() => {
    const out: { p: V3; s: number; oak: boolean; seed: number }[] = [];
    for (let i = 0; i < 140; i++) {
      const x = -200 + random(`gbx${i}`) * 300, z = -220 + random(`gbz${i}`) * 260;
      if (x > -20 && x < 50 && z > -30 && z < 30) continue; // 兵士が歩く所は空ける
      const h = slopeH(x, z);
      if (h < 1) continue;
      const oak = random(`gbo${i}`) < 0.35;
      out.push({ p: [x, h - 0.2, z], s: oak ? 5 + random(`gbs${i}`) * 4 : 0.8 + random(`gbs${i}`) * 1.4, oak, seed: i });
    }
    return out;
  }, []);
  return (
    <group>
      <mesh geometry={geo} receiveShadow>
        <meshStandardMaterial vertexColors roughness={1} />
      </mesh>
      {plants.map((b) => (b.oak ? <Oak key={b.seed} p={b.p} s={b.s} seed={b.seed} /> : <Shrub key={b.seed} p={b.p} s={b.s} seed={b.seed} />))}
    </group>
  );
};

export const InsertAngelSearch006: React.FC<SceneProps> = () => {
  const t = useT();
  // 兵士6人が間をあけて並び、斜面を奥（-z）へ上りながら捜す（毎秒1m）。カメラは右の高い所から、左下の湾の方を見下ろす
  const men = [0, 1, 2, 3, 4, 5].map((i) => ({ x: -6 + i * 6.5, z0: 14 + (random(`mz${i}`) - 0.5) * 3, off: i * 0.37 }));
  const from: CamKey = { pos: [46, slopeH(46, 24) + 5, 24], target: [-40, slopeH(-40, -4) + 4, -4], fov: 32 };
  const to: CamKey = { pos: [46, slopeH(46, 20) + 5, 20], target: [-40, slopeH(-40, -8) + 4, -8], fov: 32 };
  return (
    <Stage fog={0.0011} exposure={1.0} bloom={0} bg={BG.overcast} hemi={["#d2d6d9", "#5a564e", 1.15]}>
      <Cam006 from={from} to={to} near={0.3} far={9000} />
      <directionalLight position={[-200, 300, 200]} intensity={0.75} color="#eceef0" castShadow />
      <BaySurround look="overcast" />
      <BayWater t={t} color="#53605b" env={ENV.overcast} rot={rotOf(to)} />
      <GrassSlope />
      {men.map((m, i) => (
        <Figure key={i} clip="Walk_Loop" build={SOLDIER_62} hat={SOLDIER_62.jacket} glasses={false} timeOffset={m.off} rotationY={Math.PI}
          path={(s) => { const z = m.z0 - s * 1.0; return [m.x, slopeH(m.x, z), z]; }} />
      ))}
    </Stage>
  );
};
