/**
 * 006 アルカトラズ脱獄（1962年6月）のイメージ映像：房棟の中
 *   cellhouse：中央の通路（a 3層の房と天井の細長い天窓を見上げる、b 並んだ房の鉄格子を正面に）
 *   cell_front：房の正面の白い鉄格子（a。中は下半分が緑の壁、寝台、天井の電球。固定に近い）
 *   cell_evening：消灯後（b 房の床に落ちる鉄格子の影、c 通路から見た閉じた房の列）と、d 房の中（寝台にたたんだ毛布、小さな洗面台、折りたたみの机と棚）
 *   cell_vent：房の奥、洗面台の下の壁。通気口のまわりのコンクリートが崩れた穴と、床のかけら（a。道具は置かない）
 *   pipe_corridor：房の裏の狭い配管の通路（a 奥に裸電球、b 見上げる）
 *   tier_count：看守の点検（a 夜の通路を奥へ歩く、b 上の層から見下ろす、c 朝、房の前で足を止める。顔なし、走らせない、記章なし）
 * 見た目は、ユーザーが2026年8月に撮った映像を参考にした（footage.md）。映像そのものは使わない（F-057）。今の展示・解説板・観光客は入れない。
 * 寸法（m）：房は幅約1.5・奥行き約2.7・高さ約2.3。3層。中央の通路（ブロードウェイ）は幅4m で x の向きに延びる。
 * 通路の +z 側の房の列（正面は z = +2）と -z 側の房の列（正面は z = -2）。房の裏（+z 側の列なら z > 4.74）に配管の通路。
 * 鉄格子は遠くの房では絵（ぼかしの効く画像）、近くの房だけ棒の形で描く（細い棒を遠くまで形で描くと、カメラが動いたときにちらつく）。
 */
import React, { useMemo } from "react";
import { interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { Build, Figure } from "../lib/Figure";
import { CamKey, SceneProps, Stage, useInsertDur } from "./Inserts";
import { Cam006 } from "./Scenes006a";
import { CREW_62, SOLDIER_62 } from "./Scenes006b";
import { AGENT_62 } from "./Scenes006d";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
type V3 = [number, number, number];

/** 1962年の看守（灰色がかった紺の制服と制帽。記章・文字は付けない） */
export const GUARD_62: Build = { shoulder: 0.94, width: 1.08, jacket: "#3a4252", trousers: "#2f3542", shoes: "#111112", skin: "#16110e", hair: "none" };

/* ---------- 寸法 ---------- */

const PITCH = 1.65; // 房の幅＋仕切り
const CELL_D = 2.74, CELL_H = 2.3, TIER = 2.75, N = 30, FRONT = 2.0, GALLERY = 1.05;
const XW = PITCH * N;
const X0 = -XW / 2;
const cellX = (i: number) => X0 + PITCH * (i + 0.5);
const WHITE = "#dcd8cc", GREEN = "#5d7a63", RAIL = "#74402f", FLOOR = "#7d7b74";

/* ---------- 手続きのテクスチャ ---------- */

const texCache: Record<string, THREE.CanvasTexture> = {};
const canvasTex = (key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, srgb = true) => {
  if (texCache[key]) return texCache[key];
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  draw(cv.getContext("2d")!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 16;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  texCache[key] = t;
  return t;
};

/** 下半分が緑、上が白っぽい塗りの壁（split：緑の高さの割合）。小さな汚れとはげ */
const twoTone = (split: number, worn = 0.4) =>
  canvasTex(`two${split}${worn}`, 256, 256, (c) => {
    const y = 256 * (1 - split);
    c.fillStyle = WHITE; c.fillRect(0, 0, 256, y);
    c.fillStyle = GREEN; c.fillRect(0, y, 256, 256 - y);
    c.fillStyle = "#3f5544"; c.fillRect(0, y - 2, 256, 4); // 境の線
    for (let i = 0; i < 700 * worn; i++) {
      const x = random(`tt${i}`) * 256, yy = random(`tty${i}`) * 256, r = 0.8 + random(`ttr${i}`) * 1.8;
      c.fillStyle = `rgba(${yy < y ? "120,110,95" : "40,50,42"},${0.06 + random(`tta${i}`) * 0.12})`;
      c.fillRect(x, yy, r, r * 0.7);
    }
  });

/** 遠くの房の鉄格子（白い縦の棒と横の帯。房1つ分） */
const barsTex = () =>
  canvasTex("bars", 256, 384, (c) => {
    c.clearRect(0, 0, 256, 384);
    c.fillStyle = "#e4e1d8";
    const n = 12;
    for (let k = 0; k < n; k++) c.fillRect(16 + (k * 224) / (n - 1) - 3, 0, 5, 384);
    for (const y of [0.04, 0.36, 0.7, 0.97]) c.fillRect(0, 384 * y - 4, 256, 8);
    c.fillRect(0, 0, 8, 384); c.fillRect(248, 0, 8, 384);
  });

/** 磨いたコンクリートの床（薄い継ぎ目と汚れ） */
const floorTex = () =>
  canvasTex("floor", 512, 512, (c) => {
    c.fillStyle = "#8a8880"; c.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 4000; i++) {
      c.fillStyle = `rgba(${random(`fl${i}`) < 0.5 ? "60,58,54" : "150,148,140"},0.12)`;
      c.fillRect(random(`flx${i}`) * 512, random(`fly${i}`) * 512, 3, 3);
    }
    c.strokeStyle = "rgba(50,50,48,0.35)"; c.lineWidth = 2;
    c.strokeRect(0, 0, 512, 512);
  });

/** はげたコンクリートの壁（配管の通路） */
const rawConcrete = () =>
  canvasTex("raw", 512, 512, (c) => {
    c.fillStyle = "#8d8a80"; c.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 260; i++) { // 塗装のはげ（大きめのしみ）
      const x = random(`rc${i}`) * 512, y = random(`rcy${i}`) * 512, r = 6 + random(`rcr${i}`) * 30;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      const dark = random(`rcd${i}`) < 0.55;
      g.addColorStop(0, dark ? "rgba(70,64,56,0.45)" : "rgba(175,170,158,0.4)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 5000; i++) {
      c.fillStyle = `rgba(40,38,34,${random(`rcn${i}`) * 0.2})`;
      c.fillRect(random(`rcx${i}`) * 512, random(`rcz${i}`) * 512, 2, 2);
    }
  });

/** さびた管 */
const rustTex = () =>
  canvasTex("rust", 128, 512, (c) => {
    c.fillStyle = "#6a4a36"; c.fillRect(0, 0, 128, 512);
    for (let i = 0; i < 1500; i++) {
      const v = random(`ru${i}`);
      c.fillStyle = v < 0.4 ? "rgba(120,70,40,0.35)" : v < 0.7 ? "rgba(60,50,44,0.35)" : "rgba(150,110,80,0.3)";
      c.fillRect(random(`rux${i}`) * 128, random(`ruy${i}`) * 512, 2 + v * 6, 2 + v * 10);
    }
  });

/* ---------- 部品 ---------- */

const Box: React.FC<{ p: V3; s: V3; color?: string; map?: THREE.Texture; rough?: number; metal?: number; emissive?: string; ei?: number; cast?: boolean }> = ({ p, s, color = "#ffffff", map, rough = 0.85, metal = 0, emissive, ei = 0, cast = true }) => (
  <mesh position={p} castShadow={cast} receiveShadow>
    <boxGeometry args={s} />
    <meshStandardMaterial color={color} map={map} roughness={rough} metalness={metal} emissive={emissive ?? "#000"} emissiveIntensity={ei} />
  </mesh>
);

/** 近くの房の鉄格子（棒の形。影を落とす）。正面は z = 0、幅は房1つ分 */
const BarFront: React.FC<{ x: number; y0: number; z: number }> = ({ x, y0, z }) => {
  const n = 11, w = PITCH - 0.15;
  return (
    <group position={[x, y0, z]}>
      {Array.from({ length: n }, (_, k) => (
        <mesh key={k} position={[-w / 2 + 0.06 + (k * (w - 0.12)) / (n - 1), CELL_H / 2, 0]} castShadow>
          <cylinderGeometry args={[0.014, 0.014, CELL_H, 8]} />
          <meshStandardMaterial color="#e2dfd6" roughness={0.55} metalness={0.2} />
        </mesh>
      ))}
      {[0.04, 0.36, 0.7, 0.97].map((f) => (
        <mesh key={f} position={[0, CELL_H * f, 0]} castShadow>
          <boxGeometry args={[w, 0.06, 0.03]} />
          <meshStandardMaterial color="#e2dfd6" roughness={0.55} metalness={0.2} />
        </mesh>
      ))}
    </group>
  );
};

/** 房の中の家具：寝台（たたんだ毛布）、洗面台、折りたたみの机と腰掛け、棚。x は房の中央、正面は z0、奥へ +dz */
const CellFurniture: React.FC<{ x: number; y0: number; z0: number; dz: number; detail?: boolean; vent?: boolean }> = ({ x, y0, z0, dz, detail = false, vent = false }) => {
  const zz = (d: number) => z0 + dz * d;
  const bw = 0.74;
  return (
    <group position={[0, y0, 0]}>
      {/* 寝台（左の壁ぞい）と、足もとにたたんだ毛布 */}
      <Box p={[x - PITCH / 2 + 0.08 + bw / 2, 0.42, zz(1.5)]} s={[bw, 0.06, 1.95]} color="#55585c" metal={0.3} rough={0.6} />
      <Box p={[x - PITCH / 2 + 0.08 + bw / 2, 0.5, zz(1.5)]} s={[bw - 0.04, 0.1, 1.9]} color="#c9c4b4" />
      {detail ? <Box p={[x - PITCH / 2 + 0.08 + bw / 2, 0.6, zz(2.25)]} s={[bw - 0.12, 0.1, 0.36]} color="#5d5f56" /> : null}
      {detail ? <Box p={[x - PITCH / 2 + 0.08 + bw / 2, 0.58, zz(0.8)]} s={[bw - 0.2, 0.07, 0.3]} color="#e6e2d6" /> : null}
      {[0.6, 2.42].map((d) => (
        <Box key={d} p={[x - PITCH / 2 + 0.1 + bw / 2, 0.2, zz(d)]} s={[bw - 0.04, 0.4, 0.04]} color="#4a4d52" metal={0.3} />
      ))}
      {/* 奥の壁の洗面台（白い陶器）と蛇口 */}
      <Box p={[x + 0.38, 0.78, zz(CELL_D - 0.2)]} s={[0.42, 0.16, 0.32]} color="#e4e2dc" rough={0.3} />
      {detail ? <Box p={[x + 0.38, 0.92, zz(CELL_D - 0.06)]} s={[0.05, 0.12, 0.08]} color="#9a9a96" metal={0.6} rough={0.3} /> : null}
      {/* 右の壁の折りたたみの机と腰掛け、その上の棚 */}
      <Box p={[x + PITCH / 2 - 0.08 - 0.2, 0.74, zz(1.3)]} s={[0.4, 0.04, 0.6]} color="#6b6e6a" metal={0.2} />
      <Box p={[x + PITCH / 2 - 0.08 - 0.15, 0.44, zz(1.95)]} s={[0.3, 0.04, 0.3]} color="#6b6e6a" metal={0.2} />
      <Box p={[x + PITCH / 2 - 0.08 - 0.13, 1.55, zz(1.5)]} s={[0.26, 0.03, 0.9]} color="#6b6e6a" metal={0.2} />
      {detail ? (
        <group>
          <Box p={[x + PITCH / 2 - 0.08 - 0.13, 1.62, zz(1.25)]} s={[0.08, 0.11, 0.08]} color="#c8c2b0" />
          <Box p={[x + PITCH / 2 - 0.08 - 0.13, 1.6, zz(1.55)]} s={[0.14, 0.06, 0.2]} color="#7a6a54" />
          <Box p={[x + PITCH / 2 - 0.08 - 0.13, 1.61, zz(1.78)]} s={[0.1, 0.09, 0.1]} color="#9a9890" />
        </group>
      ) : null}
      {/* 天井の電球（ソケットと裸の電球） */}
      <Box p={[x, CELL_H - 0.04, zz(1.4)]} s={[0.1, 0.06, 0.1]} color="#3a3a3a" cast={false} />
      {/* 洗面台の下の通気口（vent：まわりが崩れた穴） */}
      {vent ? <VentHole x={x + 0.38} y={0.3} z={zz(CELL_D) - dz * 0.005} dz={dz} /> : (
        <Box p={[x + 0.38, 0.3, zz(CELL_D) - dz * 0.005]} s={[0.2, 0.28, 0.01]} color="#3f4440" metal={0.3} cast={false} />
      )}
    </group>
  );
};

/** 通気口のまわりの崩れた穴：黒い穴、ぎざぎざの縁、床のかけら（道具は置かない） */
const VentHole: React.FC<{ x: number; y: number; z: number; dz: number }> = ({ x, y, z, dz }) => {
  const edge = useMemo(() => {
    // ぎざぎざの縁の形（穴の輪郭）
    const sh = new THREE.Shape();
    const n = 28;
    for (let k = 0; k <= n; k++) {
      const a = (k / n) * Math.PI * 2;
      const rx = 0.12 + (random(`vh${k}`) - 0.5) * 0.035, ry = 0.15 + (random(`vy${k}`) - 0.5) * 0.04;
      const px = Math.cos(a) * rx, py = Math.sin(a) * ry;
      if (k === 0) sh.moveTo(px, py); else sh.lineTo(px, py);
    }
    return new THREE.ShapeGeometry(sh);
  }, []);
  const chips = useMemo(() => Array.from({ length: 26 }, (_, i) => ({
    p: [x + (random(`ch${i}`) - 0.5) * 0.5, 0.008, z - dz * (0.04 + random(`chz${i}`) * 0.35)] as V3,
    s: 0.006 + random(`chs${i}`) * 0.022, r: random(`chr${i}`) * 6,
  })), [x, z, dz]);
  return (
    <group>
      <mesh geometry={edge} position={[x, y + 0.05, z - dz * 0.004]} rotation={[0, dz > 0 ? Math.PI : 0, 0]}>
        <meshStandardMaterial color="#0b0b0b" roughness={1} side={THREE.DoubleSide} />
      </mesh>
      {/* 縁のまわりの崩れた面（少し明るい灰色のぎざぎざ） */}
      <mesh geometry={edge} position={[x, y + 0.04, z - dz * 0.002]} scale={[1.18, 1.14, 1]} rotation={[0, dz > 0 ? Math.PI : 0, 0]}>
        <meshStandardMaterial color="#8f8c84" roughness={1} side={THREE.DoubleSide} />
      </mesh>
      {chips.map((c, i) => (
        // かけらは角ばらせない（小さな面の明暗がカメラの動きで入れ替わり、チラつきと判定された）
        <mesh key={i} position={c.p} rotation={[c.r, c.r * 1.7, 0]} scale={c.s}>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color={i % 4 ? "#8e8b82" : "#5d7a63"} roughness={1} />
        </mesh>
      ))}
    </group>
  );
};

/** 房の列（3層）。side = +1 は通路の +z 側（正面 z = +2）、-1 は -z 側。near：棒の形で描く房の番号 */
const CellBlock: React.FC<{ side: 1 | -1; near?: number[]; detail?: number; vent?: number }> = ({ side, near = [], detail = -1, vent = -1 }) => {
  const s = side;
  const zf = s * FRONT; // 正面
  const zb = s * (FRONT + CELL_D); // 奥の壁
  const wall = useMemo(() => {
    const t = twoTone(0.5).clone(); t.repeat.set(N, 1); t.needsUpdate = true; return t;
  }, []);
  const part = twoTone(0.5);
  const bars = barsTex();
  const barMat = useMemo(() => new THREE.MeshStandardMaterial({ map: bars, transparent: true, depthWrite: false, roughness: 0.6 }), [bars]);
  return (
    <group>
      {[0, 1, 2].map((k) => {
        const y0 = k * TIER;
        return (
          <group key={k}>
            {/* 床の板（2層目と3層目は、通路の側へ張り出して歩廊になる）。1層目は建物の床をそのまま使う：
                同じ高さに2枚の面を重ねると、コマごとに前後が入れ替わって縞のチラつきになった（F-001） */}
            {k > 0 ? <Box p={[0, y0 - 0.15, s * (FRONT + CELL_D / 2) - s * GALLERY / 2]} s={[XW + 0.3, 0.3, CELL_D + GALLERY]} color="#bdb8aa" /> : null}
            {/* 奥の壁 */}
            <mesh position={[0, y0 + CELL_H / 2, zb]} rotation={[0, s > 0 ? Math.PI : 0, 0]} receiveShadow>
              <planeGeometry args={[XW, CELL_H]} />
              <meshStandardMaterial map={wall} roughness={0.9} />
            </mesh>
            {/* 仕切りの壁（正面の柱も兼ねる） */}
            {Array.from({ length: N + 1 }, (_, i) => (
              <mesh key={i} position={[X0 + i * PITCH, y0 + CELL_H / 2, s * (FRONT + CELL_D / 2)]} castShadow receiveShadow>
                <boxGeometry args={[0.15, CELL_H, CELL_D]} />
                <meshStandardMaterial map={part} roughness={0.9} />
              </mesh>
            ))}
            {/* 房の天井（上の層の床の下） */}
            <Box p={[0, y0 + CELL_H + 0.1, s * (FRONT + CELL_D / 2)]} s={[XW + 0.3, 0.2, CELL_D]} color={WHITE} />
            {/* 正面の上の梁（白） */}
            <Box p={[0, y0 + CELL_H + 0.22, zf - s * 0.05]} s={[XW + 0.3, 0.44, 0.12]} color={WHITE} />
            {/* 遠くの房の鉄格子（絵）。近くの房（near）は棒の形 */}
            {Array.from({ length: N }, (_, i) => (near.includes(i) ? null : (
              <mesh key={i} position={[cellX(i), y0 + CELL_H / 2, zf + s * 0.01]} rotation={[0, s > 0 ? Math.PI : 0, 0]} renderOrder={1} material={barMat}>
                <planeGeometry args={[PITCH - 0.15, CELL_H]} />
              </mesh>
            )))}
            {near.map((i) => <BarFront key={i} x={cellX(i)} y0={y0 + 0.001} z={zf + s * 0.04} />)}
            {Array.from({ length: N }, (_, i) => (
              <CellFurniture key={i} x={cellX(i)} y0={y0} z0={zf} dz={s} detail={k === 0 && i === detail} vent={k === 0 && i === vent} />
            ))}
            {/* 歩廊の手すり（赤茶） */}
            {k > 0 ? (
              <group>
                <Box p={[0, y0 + 1.0, zf - s * GALLERY]} s={[XW, 0.06, 0.06]} color={RAIL} rough={0.6} />
                <Box p={[0, y0 + 0.55, zf - s * GALLERY]} s={[XW, 0.04, 0.04]} color={RAIL} rough={0.6} />
                {Array.from({ length: N + 1 }, (_, i) => (
                  <Box key={i} p={[X0 + i * PITCH, y0 + 0.5, zf - s * GALLERY]} s={[0.05, 1.0, 0.05]} color={RAIL} rough={0.6} />
                ))}
              </group>
            ) : null}
          </group>
        );
      })}
      {/* 列の上（3層目の上）の白い天板と、列の両端の壁 */}
      <Box p={[0, 3 * TIER - 0.15, s * (FRONT + CELL_D / 2)]} s={[XW + 0.3, 0.3, CELL_D + 0.3]} color={WHITE} />
      {[-1, 1].map((e) => (
        <Box key={e} p={[e * (XW / 2 + 0.3), (3 * TIER) / 2, s * (FRONT + CELL_D / 2)]} s={[0.6, 3 * TIER, CELL_D + 0.3]} map={twoTone(0.22)} />
      ))}
    </group>
  );
};

/** 房棟の建物：床、外の壁（高い窓）、天井と細長い天窓、通路の奥の壁 */
const Hall: React.FC<{ day: number; shadows?: boolean }> = ({ day, shadows = true }) => {
  const floor = useMemo(() => {
    const t = floorTex().clone(); t.repeat.set(30, 12); t.needsUpdate = true; return t;
  }, []);
  const wallT = useMemo(() => {
    const t = twoTone(0.16, 0.2).clone(); t.repeat.set(8, 1); t.needsUpdate = true; return t;
  }, []);
  const H = 13.5, ZW = 15;
  const sky = new THREE.Color("#dfe6ea").multiplyScalar(0.12 + day * 1.5);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[XW + 40, 2 * ZW]} />
        <meshStandardMaterial map={floor} roughness={0.35} metalness={0.05} />
      </mesh>
      {/* 外の壁（左右）。高い所に縦長の窓 */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[0, H / 2, s * ZW]} rotation={[0, s > 0 ? Math.PI : 0, 0]} receiveShadow>
            <planeGeometry args={[XW + 40, H]} />
            <meshStandardMaterial map={wallT} roughness={0.9} />
          </mesh>
          {Array.from({ length: 12 }, (_, i) => (
            <mesh key={i} position={[-XW / 2 - 8 + i * ((XW + 16) / 11), 10, s * (ZW - 0.02)]} rotation={[0, s > 0 ? Math.PI : 0, 0]}>
              <planeGeometry args={[1.6, 4.2]} />
              <meshBasicMaterial color={sky} toneMapped={false} />
            </mesh>
          ))}
        </group>
      ))}
      {/* 天井と梁 */}
      {/* 天井（下向きの面は上からの光が当たらないので、照り返しの明るさを足す） */}
      <mesh position={[0, H, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[XW + 40, 2 * ZW]} />
        <meshStandardMaterial color="#cfcabd" roughness={0.95} emissive="#8f8a7e" emissiveIntensity={0.15 + day * 0.55} />
      </mesh>
      {Array.from({ length: 14 }, (_, i) => (
        <Box key={i} p={[-XW / 2 - 6 + i * ((XW + 12) / 13), H - 0.35, 0]} s={[0.3, 0.7, 2 * ZW]} color="#bdb8aa" cast={false} />
      ))}
      {/* 通路の上の細長い天窓（2列）。格子の桟を細い線で */}
      {[-1.2, 1.2].map((z) => (
        <group key={z}>
          <mesh position={[0, H - 0.02, z]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[XW + 6, 1.5]} />
            <meshBasicMaterial color={sky} toneMapped={false} />
          </mesh>
          {Array.from({ length: 34 }, (_, i) => (
            <mesh key={i} position={[-XW / 2 - 3 + i * ((XW + 6) / 33), H - 0.05, z]}>
              <boxGeometry args={[0.07, 0.05, 1.5]} />
              <meshStandardMaterial color="#3a3c3e" />
            </mesh>
          ))}
        </group>
      ))}
      {/* 通路の奥の壁（大きな格子窓。文字・時計は描かない） */}
      {[-1, 1].map((e) => (
        <group key={e}>
          <mesh position={[e * (XW / 2 + 14), H / 2, 0]} rotation={[0, -e * Math.PI / 2, 0]}>
            <planeGeometry args={[2 * ZW, H]} />
            <meshStandardMaterial map={wallT} roughness={0.9} />
          </mesh>
          <mesh position={[e * (XW / 2 + 13.98), 7.5, 0]} rotation={[0, -e * Math.PI / 2, 0]}>
            <planeGeometry args={[3.2, 6]} />
            <meshBasicMaterial color={sky} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {/* 天窓と窓から入る光 */}
      {/* 影のにじみ（シャドウアクネ）がカメラの動きでちらつかないよう、bias と normalBias を大きめに */}
      <directionalLight position={[8, 40, 4]} intensity={1.4 * day} color="#eef0f0" castShadow={shadows && day > 0.2} shadow-mapSize={[2048, 2048]} shadow-camera-left={-40} shadow-camera-right={40} shadow-camera-top={20} shadow-camera-bottom={-20} shadow-bias={-0.0008} shadow-normalBias={0.06} />
    </group>
  );
};

/** 夜の通路の吊り下げ灯（ゆっくりも動かさない。止まった光） */
const HallLamps: React.FC<{ k: number }> = ({ k }) => (
  <group>
    {[-18, -6, 6, 18].map((x) => (
      <group key={x}>
        {/* 吊りの棒：細すぎると遠くで1画素より細くなってちらつくので、太めの管にする */}
        <mesh position={[x, 9.2, 0]}>
          <cylinderGeometry args={[0.045, 0.045, 8.6, 8]} />
          <meshStandardMaterial color="#3a3a38" />
        </mesh>
        <mesh position={[x, 4.9, 0]}>
          <coneGeometry args={[0.32, 0.22, 16, 1, true]} />
          <meshStandardMaterial color="#2c2e2c" side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[x, 4.8, 0]}>
          <sphereGeometry args={[0.07, 10, 10]} />
          <meshBasicMaterial color={new THREE.Color("#fff0d0").multiplyScalar(1.4)} toneMapped={false} />
        </mesh>
        <pointLight position={[x, 4.6, 0]} intensity={26 * k} distance={18} decay={1.5} color="#f2dcb4" />
      </group>
    ))}
  </group>
);

/* ---------- 場面 ---------- */

const useT = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return frame / fps;
};

/** 房棟の中の共通の舞台。day：0（夜）〜1（昼）、night：夜の灯り */
const Cellhouse: React.FC<{ from: CamKey; to: CamKey; day: number; lamps?: number; near?: { side: 1 | -1; idx: number[] }; detail?: number; vent?: number; children?: React.ReactNode; hemi?: number; shadows?: boolean }> = ({
  from, to, day, lamps = 0, near, detail = -1, vent = -1, children, hemi = 1, shadows = true,
}) => (
  <Stage fog={0.012} exposure={1.0} bloom={0} bg={day > 0.5 ? "#9a9890" : "#121314"} hemi={["#e4e2da", "#4a4843", (0.18 + day * 0.9) * hemi]}>
    <Cam006 from={from} to={to} near={0.05} far={200} />
    <Hall day={day} shadows={shadows} />
    {lamps > 0 ? <HallLamps k={lamps} /> : null}
    <CellBlock side={1} near={near?.side === 1 ? near.idx : []} detail={detail} vent={vent} />
    <CellBlock side={-1} near={near?.side === -1 ? near.idx : []} />
    {children}
  </Stage>
);

const C0 = 15; // 近くで見せる房（+z 側の1層目）

export const InsertCellhouse006: React.FC<SceneProps> = ({ variant = "a" }) => {
  const cams: Record<string, [CamKey, CamKey]> = {
    // 通路の床から、3層の房と天井の天窓を見上げる
    a: [{ pos: [-14, 1.5, -0.3], target: [0, 9.5, 2.4], fov: 58 }, { pos: [-13, 1.5, -0.3], target: [1, 10.5, 1.8], fov: 57 }],
    // 通路の高さから、並んだ房の鉄格子を正面に（ゆっくり横へ）
    // 止めたカメラ：細かい格子を正面から横へ流すと、縦の棒の並びが画面の画素と干渉してチラつきと判定された
    b: [{ pos: [-3.3, 1.6, -1.4], target: [-3.3, 2.6, 8], fov: 52 }, { pos: [-3.3, 1.6, -1.4], target: [-3.3, 2.6, 8], fov: 52 }],
  };
  const [from, to] = cams[variant] ?? cams.a;
  return <Cellhouse from={from} to={to} day={1} />;
};

export const InsertCellFront006: React.FC<SceneProps> = () => {
  const x = cellX(C0);
  // 房の正面の鉄格子を、通路からほぼ固定で
  const from: CamKey = { pos: [x - 0.12, 1.45, -0.2], target: [x, 1.1, 4], fov: 46 };
  const to: CamKey = { pos: [x - 0.02, 1.45, -0.05], target: [x, 1.1, 4], fov: 45 };
  return (
    <Cellhouse from={from} to={to} day={0.85} near={{ side: 1, idx: [C0 - 1, C0, C0 + 1] }} detail={C0} shadows={false}>
      {/* 房の天井の電球（灯っている） */}
      <mesh position={[x, CELL_H - 0.12, FRONT + 1.4]}>
        <sphereGeometry args={[0.05, 10, 10]} />
        <meshBasicMaterial color={new THREE.Color("#fff2d6").multiplyScalar(1.3)} toneMapped={false} />
      </mesh>
      <pointLight position={[x, CELL_H - 0.2, FRONT + 1.4]} intensity={2.2} distance={4} decay={1.5} color="#f6e2bc" />
    </Cellhouse>
  );
};

export const InsertCellEvening006: React.FC<SceneProps> = ({ variant = "b" }) => {
  const x = cellX(C0);
  if (variant === "b") return <CellShadow />;
  if (variant === "c") {
    // 消灯後の通路から見た、閉じた房の列（斜めに）
    const from: CamKey = { pos: [-16, 1.6, -1.0], target: [6, 1.2, 2.6], fov: 46 };
    const to: CamKey = { pos: [-15.6, 1.6, -1.0], target: [6.5, 1.2, 2.6], fov: 46 };
    return <Cellhouse from={from} to={to} day={0.03} lamps={0.6} hemi={0.45} />;
  }
  // d：房の中。正面の隅から、寝台・洗面台・机と棚を見る
  const from: CamKey = { pos: [x + 0.55, 1.55, FRONT + 0.3], target: [x - 0.25, 0.7, FRONT + CELL_D], fov: 62 };
  const to: CamKey = { pos: [x + 0.5, 1.55, FRONT + 0.36], target: [x - 0.2, 0.72, FRONT + CELL_D], fov: 61 };
  return (
    <Cellhouse from={from} to={to} day={0.7} detail={C0} near={{ side: 1, idx: [C0] }} shadows={false}>
      <pointLight position={[x, CELL_H - 0.2, FRONT + 1.4]} intensity={2.5} distance={4} decay={1.5} color="#f6e2bc" />
    </Cellhouse>
  );
};

export const InsertCellVent006: React.FC<SceneProps> = () => {
  const x = cellX(C0);
  // 洗面台の下の壁を、しゃがんだ高さから
  // 止めたカメラ（床の小さなかけらは、カメラが少し動くだけで明暗が入れ替わってチラつきと判定された）
  const from: CamKey = { pos: [x + 0.08, 0.61, FRONT + 1.6], target: [x + 0.42, 0.32, FRONT + CELL_D], fov: 49 };
  const to = from;
  return (
    <Cellhouse from={from} to={to} day={0.6} vent={C0} near={{ side: 1, idx: [C0] }} shadows={false}>
      <pointLight position={[x, CELL_H - 0.2, FRONT + 1.4]} intensity={2.8} distance={4} decay={1.5} color="#f6e2bc" />
    </Cellhouse>
  );
};

/** 消灯後：通路の灯りが鉄格子を通して、房の床に影を落とす（人物なし） */
const CellShadow: React.FC = () => {
  const x = cellX(C0);
  const spot = useMemo(() => {
    const l = new THREE.SpotLight("#f0dcb0", 40, 14, 0.5, 0.35, 1.3);
    l.castShadow = true;
    l.shadow.mapSize.set(2048, 2048);
    l.shadow.bias = -0.0012;
    l.shadow.normalBias = 0.025; // 床の自分の影の縞（コマごとに出たり消えたりした）を消す
    l.position.set(x - 1.2, 4.6, -1.0);
    l.target.position.set(x, 0, FRONT + 1.4);
    return l;
  }, [x]);
  const from: CamKey = { pos: [x + 0.45, 1.95, FRONT + 2.3], target: [x - 0.1, 0, FRONT + 0.7], fov: 50 };
  const to: CamKey = { pos: [x + 0.4, 1.95, FRONT + 2.2], target: [x - 0.12, 0, FRONT + 0.72], fov: 49 };
  return (
    <Cellhouse from={from} to={to} day={0} near={{ side: 1, idx: [C0] }} hemi={0.9}>
      <primitive object={spot} />
      <primitive object={spot.target} />
    </Cellhouse>
  );
};

/* ---------- 配管の通路（房の裏） ---------- */

const PipeCorridor: React.FC<{ from: CamKey; to: CamKey }> = ({ from, to }) => {
  const W = 1.15, L = 40, H = 8.6;
  const walls = useMemo(() => {
    const t = rawConcrete().clone(); t.repeat.set(L / 3, H / 3); t.needsUpdate = true; return t;
  }, []);
  const rust = rustTex();
  const pipes = useMemo(() => {
    const out: { x: number; z: number; r: number }[] = [];
    for (let i = 0; i < 26; i++) {
      const x = -L / 2 + 1 + i * 1.55 + (random(`pp${i}`) - 0.5) * 0.4;
      out.push({ x, z: (random(`pz${i}`) < 0.5 ? -1 : 1) * (W / 2 - 0.12), r: 0.035 + random(`pr${i}`) * 0.05 });
      if (random(`p2${i}`) < 0.5) out.push({ x: x + 0.25, z: (random(`pz2${i}`) < 0.5 ? -1 : 1) * (W / 2 - 0.1), r: 0.025 + random(`pr2${i}`) * 0.03 });
    }
    return out;
  }, []);
  return (
    <Stage fog={0.035} exposure={1.0} bloom={0} bg="#141210" hemi={["#a49a88", "#2a2622", 0.42]}>
      <Cam006 from={from} to={to} near={0.03} far={120} />
      {/* 床（通路の底）、両側の壁、上の層の格子の足場 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[L, W]} />
        <meshStandardMaterial color="#4e4a44" roughness={1} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, H / 2, s * W / 2]} rotation={[0, s > 0 ? Math.PI : 0, 0]} receiveShadow>
          <planeGeometry args={[L, H]} />
          <meshStandardMaterial map={walls} roughness={0.95} />
        </mesh>
      ))}
      {[TIER, 2 * TIER].map((y) => (
        <group key={y}>
          {Array.from({ length: 40 }, (_, i) => (
            <Box key={i} p={[-L / 2 + 0.5 + i, y, 0]} s={[0.05, 0.05, W]} color="#3a3530" metal={0.3} cast={false} />
          ))}
        </group>
      ))}
      {/* さびた縦の管と、横に走る管 */}
      {pipes.map((p, i) => (
        <mesh key={i} position={[p.x, H / 2, p.z]} castShadow>
          <cylinderGeometry args={[p.r, p.r, H, 10]} />
          <meshStandardMaterial map={rust} roughness={0.85} metalness={0.3} />
        </mesh>
      ))}
      {[1.9, 2.3, 4.9, 7.4].map((y, i) => (
        <mesh key={i} position={[0, y, (i % 2 ? -1 : 1) * (W / 2 - 0.08)]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.04, 0.04, L, 10]} />
          <meshStandardMaterial map={rust} roughness={0.85} metalness={0.3} />
        </mesh>
      ))}
      {/* 奥の裸電球1つ（揺らさない） */}
      <mesh position={[L / 2 - 3, 3.2, 0]}>
        <sphereGeometry args={[0.05, 10, 10]} />
        <meshBasicMaterial color={new THREE.Color("#fff1d2").multiplyScalar(1.6)} toneMapped={false} />
      </mesh>
      <mesh position={[L / 2 - 3, 3.6, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.8, 4]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <pointLight position={[L / 2 - 3, 3.1, 0]} intensity={22} distance={40} decay={1.2} color="#f4dcb0" castShadow />
      {/* 手前と上の層の弱い灯り（何もない真っ暗にしない） */}
      <pointLight position={[-L / 2 + 4, 2.6, 0]} intensity={4} distance={16} decay={1.3} color="#d8c8a8" />
      <pointLight position={[-L / 2 + 9, 7.6, 0]} intensity={6} distance={14} decay={1.3} color="#e0d0b0" />
      <mesh position={[-L / 2 + 9, 7.7, 0]}>
        <sphereGeometry args={[0.045, 10, 10]} />
        <meshBasicMaterial color={new THREE.Color("#fff1d2").multiplyScalar(1.4)} toneMapped={false} />
      </mesh>
    </Stage>
  );
};

export const InsertPipeCorridor006: React.FC<SceneProps> = ({ variant = "a" }) => {
  const cams: Record<string, [CamKey, CamKey]> = {
    a: [{ pos: [-17.5, 1.55, 0.05], target: [20, 2.4, 0], fov: 50 }, { pos: [-17.1, 1.55, 0.02], target: [20, 2.5, 0], fov: 49 }],
    b: [{ pos: [-12, 1.3, 0.25], target: [-9.5, 8.6, -0.1], fov: 60 }, { pos: [-12, 1.3, 0.25], target: [-9.2, 9.0, -0.15], fov: 59 }],
  };
  const [from, to] = cams[variant] ?? cams.a;
  return <PipeCorridor from={from} to={to} />;
};

/* ---------- 看守の点検 ---------- */

export const InsertTierCount006: React.FC<SceneProps> = ({ variant = "a" }) => {
  const t = useT();
  if (variant === "c") {
    // 朝：房の前で足を止める看守の後ろ姿（走らせない）
    const x = cellX(C0);
    const from: CamKey = { pos: [x - 2.6, 1.7, -1.5], target: [x + 0.2, 1.4, 3.0], fov: 46 };
    const to: CamKey = { pos: [x - 2.3, 1.7, -1.45], target: [x + 0.2, 1.4, 3.0], fov: 45 };
    return (
      <Cellhouse from={from} to={to} day={0.8} near={{ side: 1, idx: [C0 - 1, C0, C0 + 1] }}>
        <Figure clip="Idle_Loop" position={[x - 0.1, 0, 0.95]} rotationY={0.1} build={GUARD_62} hat={GUARD_62.jacket} glasses={false} />
      </Cellhouse>
    );
  }
  if (variant === "b") {
    // 上の層（-z 側の3層目の歩廊）から見下ろす。通路を行く看守が小さく見える
    const from: CamKey = { pos: [-7, 2 * TIER + 1.6, -1.05], target: [3, 0, 1.3], fov: 46 };
    const to: CamKey = { pos: [-6.5, 2 * TIER + 1.6, -1.05], target: [3.5, 0, 1.3], fov: 46 };
    return (
      <Cellhouse from={from} to={to} day={0.08} lamps={1} hemi={0.8}>
        <Figure clip="Walk_Loop" build={GUARD_62} hat={GUARD_62.jacket} glasses={false} rotationY={Math.PI / 2} path={(s) => [-1 + s * 1.15, 0, 0.9]} />
      </Cellhouse>
    );
  }
  // a：夜の通路を、房を見ながら奥へ歩く看守（遠目。カメラから離れていく）
  const from: CamKey = { pos: [-20, 1.7, -0.4], target: [10, 1.3, 0.6], fov: 40 };
  const to: CamKey = { pos: [-19.4, 1.7, -0.4], target: [10, 1.3, 0.6], fov: 40 };
  return (
    <Cellhouse from={from} to={to} day={0.05} lamps={1} hemi={0.8}>
      <Figure clip="Walk_Loop" build={GUARD_62} hat={GUARD_62.jacket} glasses={false} rotationY={Math.PI / 2} path={(s) => [-13 + s * 1.15, 0, 1.0]} />
    </Cellhouse>
  );
};

/* ---------- 人物の確認用（本編には使わない）：看守・兵士・艇の乗員を、灰色の背景で前後左右から ---------- */

export const FigureCheck006: React.FC<{ builds: [Build, string][] }> = ({ builds }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, 1], [0, 1], clamp);
  return (
    <Stage fog={0} exposure={1.0} bloom={0} bg="#7a7a7a" grade="none" hemi={["#ffffff", "#444444", 2.0]}>
      <Cam006 from={{ pos: [0, 1.2, 8 + p * 0], target: [0, 0.95, 0], fov: 34 }} to={{ pos: [0, 1.2, 8], target: [0, 0.95, 0], fov: 34 }} near={0.1} far={100} />
      <directionalLight position={[3, 5, 6]} intensity={2.2} />
      {builds.map(([b, hat], i) => [0, Math.PI / 2, Math.PI, -Math.PI / 2].map((r, k) => (
        <Figure key={`${i}-${k}`} clip="Idle_Loop" position={[-3.3 + k * 2.2, 0, -i * 0.01]} rotationY={r} build={b} hat={hat || undefined} glasses={false} />
      )))}
    </Stage>
  );
};
export const InsertFigures006: React.FC<SceneProps> = ({ variant = "guard" }) => {
  const map: Record<string, [Build, string]> = { guard: [GUARD_62, GUARD_62.jacket], soldier: [SOLDIER_62, SOLDIER_62.jacket], crew: [CREW_62, CREW_62.jacket], agent: [AGENT_62, ""] };
  return <FigureCheck006 builds={[map[variant] ?? map.guard]} />;
};
