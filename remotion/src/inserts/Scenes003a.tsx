/**
 * 003 D.B.クーパー（1971年11月24日、ポートランド〜シアトル）のイメージ映像：屋内の場面
 *   airport_walk：70年代の空港の通路を歩くトレンチコートの男（横から遠目。カメラに近づかない）
 *   airport_wait：空港の待合（座って待つ男、立ち上がる男、航空券のカウンター、検査の門、人のいない待合）
 *   cabin_seat：727 の機内（座席の列、窓の外の雲、灰皿、テーブル）
 *   field_office：70年代のFBIの支局の事務所（人物なし）
 * 描くのは日常の場面だけ。脅す・メモを渡す・飛び降りる場面は描かない（plan.md）。人物は顔のないシルエット。
 * 実在の航空会社の名前・ロゴ・塗装は入れない。
 */
import React, { useMemo } from "react";
import { interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { Figure } from "../lib/Figure";
import { WoodMaterial } from "./Era80s";
import { Camera, CamKey, SceneProps, Stage } from "./Inserts";
import {
  bokehTexture, calendarTexture, carpetTexture, CeilingLights, ChairRow, CloudLayer, COOPER_71, Desk, DeskPhone, dropsTexture, FileBox, FilingCabinet,
  Jet727, PaperStack, terrazzoTexture, TRAVELER_A, TRAVELER_B, Typewriter,
} from "./Props003";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
type V3 = [number, number, number];

/* ---------- 70年代の空港の待合（通路と待合で共通） ---------- */

/** 奥の壁は大きな窓。外は雨の夜の駐機場（止まった機体と、遠い灯りのぼけ） */
const Terminal: React.FC<{ plane?: boolean }> = ({ plane = true }) => {
  const floor = useMemo(() => {
    const t = terrazzoTexture().clone();
    t.repeat.set(12, 3.2);
    t.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.35, metalness: 0.05 });
  }, []);
  const bokeh = bokehTexture("apron", ["#ffd9a0", "#fff2d8", "#9fc3ff"], 34);
  const drops = dropsTexture();
  return (
    <group>
      {/* 床は窓の壁（z=-6）で止める。外の駐機場の板と同じ高さで重なると、重なった所がちらつく（QAで検出） */}
      <mesh position={[0, 0, 2]} rotation={[-Math.PI / 2, 0, 0]} material={floor} receiveShadow>
        <planeGeometry args={[60, 16]} />
      </mesh>
      {/* 天井と蛍光灯 */}
      <mesh position={[0, 4.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[60, 20]} />
        <meshStandardMaterial color="#d9d2c2" roughness={0.9} />
      </mesh>
      <CeilingLights y={4.18} xs={[-18, -12, -6, 0, 6, 12, 18]} zs={[-3, 1.5]} />
      {/* 奥の窓の壁：柱と窓枠、雨粒のガラス、外の夜 */}
      {[-24, -16, -8, 0, 8, 16, 24].map((x) => (
        <mesh key={x} position={[x, 2.1, -6]} castShadow>
          <boxGeometry args={[0.5, 4.2, 0.5]} />
          <meshStandardMaterial color="#8a7f6e" roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[0, 0.35, -6]}>
        <boxGeometry args={[60, 0.7, 0.3]} />
        <meshStandardMaterial color="#6d6458" roughness={0.8} />
      </mesh>
      <mesh position={[0, 3.8, -6]}>
        <boxGeometry args={[60, 0.8, 0.3]} />
        <meshStandardMaterial color="#cfc7b6" roughness={0.9} />
      </mesh>
      <mesh position={[0, 2.2, -6.02]}>
        <planeGeometry args={[60, 3.0]} />
        <meshStandardMaterial map={drops} transparent opacity={0.55} depthWrite={false} />
      </mesh>
      {/* 外：濡れた駐機場、遠い灯り */}
      <mesh position={[0, -0.02, -41.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[200, 70]} />
        <meshStandardMaterial color="#0b0d10" roughness={0.3} metalness={0.2} />
      </mesh>
      <mesh position={[0, 8, -75]}>
        <planeGeometry args={[220, 30]} />
        <meshBasicMaterial map={bokeh} />
      </mesh>
      {plane ? <Jet727 position={[14, 2.4, -52]} rotation={[0, 0.25, 0]} scale={0.8} lights={0.5} cabin={0.15} /> : null}
      {/* 手前の壁（画面の外。部屋の明るさのため） */}
      <pointLight position={[-8, 3.4, 1]} intensity={14} distance={20} color="#fff3dc" />
      <pointLight position={[8, 3.4, 1]} intensity={14} distance={20} color="#fff3dc" />
      <pointLight position={[0, 3.4, -3]} intensity={10} distance={16} color="#f2f6e8" />
    </group>
  );
};

/** 書類かばん */
const Briefcase: React.FC<{ position: V3; rotY?: number }> = ({ position, rotY = 0 }) => (
  <group position={position} rotation={[0, rotY, 0]}>
    <mesh position={[0, 0.17, 0]} castShadow>
      <boxGeometry args={[0.44, 0.33, 0.11]} />
      <meshStandardMaterial color="#2b1d14" roughness={0.55} />
    </mesh>
    <mesh position={[0, 0.36, 0]}>
      <torusGeometry args={[0.06, 0.012, 6, 12, Math.PI]} />
      <meshStandardMaterial color="#1a120c" />
    </mesh>
  </group>
);

/* ---------- 1. 空港の通路を歩く ---------- */

export const InsertAirportWalk003: React.FC<SceneProps> = ({ variant = "a" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  // 歩く速さは一定（毎秒1.2m）。カメラは横から遠目で、人物はカメラに近づかない
  const walkX = (t0: number, dir: number) => (s: number): V3 => [t0 + dir * 1.2 * s, 0, 0.6];
  const cams: Record<string, [CamKey, CamKey]> = {
    a: [{ pos: [-1.6, 1.5, 11], target: [-0.6, 1.2, -1], fov: 34 }, { pos: [0.8, 1.5, 11], target: [1.8, 1.2, -1], fov: 34 }], // 横から、男と一緒にゆっくり流す（速く流すと奥の床がちらつく）
    b: [{ pos: [-9, 1.6, 2.6], target: [4, 1.2, 0.2], fov: 30 }, { pos: [-8.5, 1.6, 2.6], target: [5, 1.2, 0.2], fov: 30 }], // 後ろから、遠ざかる男
    gate: [{ pos: [9, 2.2, 7], target: [-2, 1.1, -1], fov: 36 }, { pos: [8, 2.1, 6.4], target: [-2, 1.1, -1.2], fov: 35 }], // 搭乗口の列と検査の台
  };
  const [from, to] = cams[variant] ?? cams.a;
  return (
    <Stage fog={0.012} exposure={1.05} bg="#0b0c10" hemi={["#e8e2d4", "#3a3328", 0.55]}>
      <Camera from={from} to={to} />
      <Terminal />
      <ChairRow position={[-14, 0, -4.4]} n={8} />
      <ChairRow position={[8, 0, -4.4]} n={8} color="#7a6a3a" />
      {variant === "gate" ? (
        <>
          {/* 搭乗口の列：顔のない人の後ろ姿。検査の台と金属探知の門 */}
          {[0, 1, 2, 3].map((k) => (
            <Figure key={k} clip="Idle_Loop" position={[-1.5 + k * 0.9, 0, 0.4]} rotationY={-Math.PI / 2} timeOffset={k * 0.7} glasses={false}
              build={k % 2 ? TRAVELER_A : TRAVELER_B} />
          ))}
          <mesh position={[-4.2, 0.45, 0.4]} castShadow>
            <boxGeometry args={[1.4, 0.9, 0.7]} />
            <meshStandardMaterial color="#6f6a60" roughness={0.6} />
          </mesh>
          {[-1, 1].map((sd) => (
            <mesh key={sd} position={[-6.0, 1.05, 0.4 + sd * 0.48]}>
              <boxGeometry args={[0.18, 2.1, 0.18]} />
              <meshStandardMaterial color="#9a978e" roughness={0.5} metalness={0.3} />
            </mesh>
          ))}
          <mesh position={[-6.0, 2.15, 0.4]}>
            <boxGeometry args={[0.18, 0.18, 1.14]} />
            <meshStandardMaterial color="#9a978e" roughness={0.5} metalness={0.3} />
          </mesh>
        </>
      ) : (
        <Figure clip="Walk_Formal_Loop" path={variant === "b" ? walkX(-4.5, 1) : walkX(-4.0, 1)} rotationY={Math.PI / 2} glasses={false} build={COOPER_71} />
      )}
      {/* 遠くを行き交う人（顔なし、小さく） */}
      {variant !== "gate" ? (
        <Figure clip="Walk_Loop" path={(s) => [14 - 1.1 * s, 0, -2.8]} rotationY={-Math.PI / 2} timeOffset={1.3} glasses={false} build={TRAVELER_B} />
      ) : null}
    </Stage>
  );
};

/* ---------- 2. 空港の待合 ---------- */

export const InsertAirportWait003: React.FC<SceneProps> = ({ variant = "b" }) => {
  const cams: Record<string, [CamKey, CamKey]> = {
    // b：座って待つ男を横から（足元に書類かばん）
    b: [{ pos: [2.3, 2.3, 0.4], target: [-0.7, 0.55, -4.0], fov: 36 }, { pos: [2.1, 2.25, 0.2], target: [-0.7, 0.55, -4.0], fov: 35 }], // 少し上から（背中が暗い窓に溶けないよう、床を背に）
    // c：立っている男を遠目に（トレンチコート、かばん）
    c: [{ pos: [-7, 1.6, 7], target: [1.5, 1.1, -3.2], fov: 30 }, { pos: [-6.4, 1.6, 6.6], target: [1.5, 1.1, -3.2], fov: 30 }],
    // ticket：カウンターの上の航空券と紙幣（人物なし）
    ticket: [{ pos: [12.45, 1.32, 1.55], target: [12.02, 1.04, 0.93], fov: 30 }, { pos: [12.38, 1.28, 1.45], target: [12.02, 1.04, 0.93], fov: 28 }],
    // check：70年代の検査の門と手荷物の台（人物なし）
    check: [{ pos: [-15.5, 2.0, 6], target: [-20.5, 1.0, 0.2], fov: 34 }, { pos: [-15.0, 1.9, 5.5], target: [-20.5, 1.0, 0.2], fov: 33 }],
    // empty：人のいない待合を高く引いて
    empty: [{ pos: [-10, 3.3, 8], target: [0, 0.6, -3.5], fov: 40 }, { pos: [-9.2, 3.2, 7.6], target: [0, 0.6, -3.5], fov: 39 }],
  };
  const [from, to] = cams[variant] ?? cams.b;
  const ticketTex = useMemo(() => {
    const cv = document.createElement("canvas");
    cv.width = 256; cv.height = 128;
    const c = cv.getContext("2d")!;
    c.fillStyle = "#e9e2cf"; c.fillRect(0, 0, 256, 128);
    c.fillStyle = "#8a2f24"; c.fillRect(0, 0, 256, 18);
    c.fillStyle = "rgba(40,40,40,0.6)";
    for (let y = 34; y < 120; y += 14) c.fillRect(16, y, 120 + random(`tk${y}`) * 90, 4);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  return (
    <Stage fog={0.012} exposure={1.05} bg="#0b0c10" hemi={["#e8e2d4", "#3a3328", 0.55]}>
      <Camera from={from} to={to} />
      <Terminal />
      <ChairRow position={[-3.4, 0, -4.2]} n={9} />
      <ChairRow position={[3.6, 0, -4.2]} n={6} color="#7a6a3a" />
      {variant === "b" ? (
        <>
          <Figure clip="Sitting_Idle_Loop" position={[-0.6, 0, -4.1]} rotationY={0} glasses={false} build={COOPER_71} />
          <Briefcase position={[-1.15, 0, -3.75]} rotY={0.2} />
        </>
      ) : null}
      {variant === "c" ? (
        <>
          <Figure clip="Idle_Loop" position={[1.6, 0, -3.3]} rotationY={-0.5} glasses={false} build={COOPER_71} />
          <Briefcase position={[1.15, 0, -3.15]} rotY={-0.3} />
        </>
      ) : null}
      {/* 航空会社のカウンター（社名・ロゴなし） */}
      <group position={[12, 0, 0.6]}>
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[3.4, 1.0, 0.7]} />
          <WoodMaterial w={3.4} h={1.0} tint="#d9b48a" />
        </mesh>
        <mesh position={[0, 1.02, 0.05]}>
          <boxGeometry args={[3.5, 0.04, 0.85]} />
          <meshStandardMaterial color="#cfc6b2" roughness={0.4} />
        </mesh>
        {/* 航空券の封筒と、20ドル札（文字・肖像は描かない） */}
        <mesh position={[-0.05, 1.045, 0.32]} rotation={[-Math.PI / 2, 0, 0.12]}>
          <planeGeometry args={[0.2, 0.095]} />
          <meshStandardMaterial map={ticketTex} roughness={0.8} />
        </mesh>
        <mesh position={[0.17, 1.047, 0.38]} rotation={[-Math.PI / 2, 0, -0.2]}>
          <planeGeometry args={[0.156, 0.066]} />
          <meshStandardMaterial color="#8fa38a" roughness={0.9} />
        </mesh>
      </group>
      {/* 1972〜73年に入った検査の門と台（人物なし） */}
      <pointLight position={[-20, 3.6, 1.5]} intensity={12} distance={12} color="#f2f6e8" />
      <group position={[-20.5, 0, 0.2]}>
        {[-1, 1].map((sd) => (
          <mesh key={sd} position={[0, 1.05, sd * 0.5]} castShadow>
            <boxGeometry args={[0.2, 2.1, 0.16]} />
            <meshStandardMaterial color="#a19d92" roughness={0.5} metalness={0.3} />
          </mesh>
        ))}
        <mesh position={[0, 2.15, 0]}>
          <boxGeometry args={[0.2, 0.2, 1.16]} />
          <meshStandardMaterial color="#a19d92" roughness={0.5} metalness={0.3} />
        </mesh>
        <mesh position={[1.8, 0.45, 0]} castShadow>
          <boxGeometry args={[1.6, 0.9, 0.7]} />
          <meshStandardMaterial color="#6f6a60" roughness={0.6} />
        </mesh>
        <Briefcase position={[1.7, 0.9, 0]} rotY={Math.PI / 2} />
        {[-3, 3].map((x) => (
          <mesh key={x} position={[x * 0.5, 0.5, 1.4]}>
            <cylinderGeometry args={[0.04, 0.04, 1.0, 10]} />
            <meshStandardMaterial color="#b9b2a0" roughness={0.3} metalness={0.7} />
          </mesh>
        ))}
      </group>
      {/* 遠くに座る旅行者（顔なし）。待合が無人の角度では出さない */}
      {variant === "b" || variant === "c" ? (
        <Figure clip="Sitting_Idle_Loop" position={[5.46, 0, -4.1]} rotationY={0} timeOffset={1.9} glasses={false} build={TRAVELER_A} />
      ) : null}
    </Stage>
  );
};

/* ---------- 3. 727 の機内 ---------- */

const CABIN_R = 1.85;
const SEAT_PITCH = 0.86;

/** 座席1つ（70年代の布張り） */
const Seat: React.FC<{ position: V3; color: string }> = ({ position, color }) => (
  <group position={position}>
    <mesh position={[0, 0.44, 0]} castShadow receiveShadow>
      <boxGeometry args={[0.46, 0.12, 0.5]} />
      <meshStandardMaterial color={color} roughness={0.95} />
    </mesh>
    <mesh position={[-0.25, 0.76, 0]} rotation={[0, 0, 0.12]} castShadow>
      <boxGeometry args={[0.09, 0.62, 0.47]} />
      <meshStandardMaterial color={color} roughness={0.95} />
    </mesh>
    {/* 頭の当たる所の布（70年代の機内の白いカバー） */}
    <mesh position={[-0.205, 1.03, 0]} rotation={[0, 0, 0.12]}>
      <boxGeometry args={[0.1, 0.12, 0.38]} />
      <meshStandardMaterial color="#c9c0aa" roughness={0.9} />
    </mesh>
    {/* 肘掛け */}
    {[-1, 1].map((sd) => (
      <mesh key={sd} position={[0, 0.62, sd * 0.25]}>
        <boxGeometry args={[0.44, 0.05, 0.05]} />
        <meshStandardMaterial color="#3a352f" roughness={0.6} />
      </mesh>
    ))}
  </group>
);

/** 窓に寄る角度の右の壁：窓の穴を残して板で組む（円筒の壁だと外の雲が見えない）。窓は角の丸い縦長 */
const WindowWall: React.FC<{ x: number }> = ({ x }) => {
  const z = CABIN_R - 0.12;
  const wy = 1.45, ww = 0.26, wh = 0.36;
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#d8d0bd", roughness: 0.9, side: THREE.DoubleSide }), []);
  const ring = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-0.24, -0.29); s.lineTo(0.24, -0.29); s.lineTo(0.24, 0.29); s.lineTo(-0.24, 0.29); s.closePath();
    const h = new THREE.Path();
    h.absellipse(0, 0, ww / 2, wh / 2, 0, Math.PI * 2, false, 0);
    s.holes.push(h);
    return new THREE.ShapeGeometry(s, 32);
  }, []);
  return (
    <group>
      {/* 窓の周りの枠（楕円の穴） */}
      <mesh geometry={ring} material={mat} position={[x, wy, z]} rotation={[0, Math.PI, 0]} />
      {/* 窓の周りの壁（穴の外側を4枚で埋める） */}
      <mesh material={mat} position={[x - 0.24 - 5, wy, z]} rotation={[0, Math.PI, 0]}><planeGeometry args={[10, 3]} /></mesh>
      <mesh material={mat} position={[x + 0.24 + 5, wy, z]} rotation={[0, Math.PI, 0]}><planeGeometry args={[10, 3]} /></mesh>
      <mesh material={mat} position={[x, wy + 0.29 + 1, z]} rotation={[0, Math.PI, 0]}><planeGeometry args={[0.48, 2]} /></mesh>
      <mesh material={mat} position={[x, wy - 0.29 - 1, z]} rotation={[0, Math.PI, 0]}><planeGeometry args={[0.48, 2]} /></mesh>
      {/* 二重の窓ガラス（うっすら） */}
      <mesh position={[x, wy, z + 0.03]}>
        <planeGeometry args={[ww, wh]} />
        <meshStandardMaterial color="#9fb0c0" transparent opacity={0.06} depthWrite={false} />
      </mesh>
    </group>
  );
};

/** 窓の外の空：雲の模様をゆっくり流す（窓に寄る角度だけ）。速く流すとチラつくので、1秒に模様の幅の1%ほど */
const OutsideSky: React.FC<{ x: number; t: number; sky: "night" | "dusk" }> = ({ x, t, sky }) => {
  const tex = useMemo(() => {
    const cv = document.createElement("canvas");
    cv.width = 1024; cv.height = 512;
    const c = cv.getContext("2d")!;
    const g = c.createLinearGradient(0, 0, 0, 512);
    if (sky === "dusk") { g.addColorStop(0, "#6f6c78"); g.addColorStop(0.55, "#b08c72"); g.addColorStop(1, "#4a4040"); }
    else { g.addColorStop(0, "#0a0e18"); g.addColorStop(1, "#1a2030"); }
    c.fillStyle = g; c.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 260; i++) {
      // 横につながる雲（左右の端で模様がつながるように、同じ雲を1024ずらして2回描く）
      const cx = random(`os${i}`) * 1024, cy = 180 + random(`oy${i}`) * 300, r = 30 + random(`or${i}`) * 90;
      for (const dx of [0, -1024, 1024]) {
        const gg = c.createRadialGradient(cx + dx, cy, 0, cx + dx, cy, r);
        gg.addColorStop(0, sky === "dusk" ? "rgba(225,200,180,0.20)" : "rgba(120,130,150,0.16)");
        gg.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = gg; c.fillRect(cx + dx - r, cy - r, r * 2, r * 2);
      }
    }
    const tx = new THREE.CanvasTexture(cv);
    tx.colorSpace = THREE.SRGBColorSpace;
    tx.wrapS = THREE.RepeatWrapping;
    return tx;
  }, [sky]);
  tex.offset.x = t * 0.012;
  return (
    <mesh position={[x, 1.2, 5]} rotation={[0, Math.PI, 0]}>
      <planeGeometry args={[14, 7]} />
      <meshBasicMaterial map={tex} side={THREE.DoubleSide} />
    </mesh>
  );
};

/** 機内：胴体の内側、座席の列（左右3席ずつ）、窓、網棚。機首は +x。cloudT を与えると窓の外に雲が流れる */
const Cabin: React.FC<{ t: number; sky: "night" | "dusk"; rows?: number; windowAt?: number }> = ({ t, sky, rows = 9, windowAt }) => {
  const carpet = useMemo(() => {
    const tx = carpetTexture().clone();
    tx.repeat.set(10, 2);
    tx.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: tx, roughness: 1 });
  }, []);
  const skyColor = sky === "dusk" ? "#8d7a6c" : "#1a2130";
  const seatColors = ["#3d5a3e", "#46663f", "#384f37"]; // 70年代の機内の、くすんだ緑の布張り
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={carpet} receiveShadow>
        <planeGeometry args={[20, 3.4]} />
      </mesh>
      {/* 胴体の内壁（円筒の内側）。窓に寄る角度では、右の壁を窓の穴のある板に替えて外の雲を見せる */}
      <mesh position={[0, 1.0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[CABIN_R, CABIN_R, 20, 40, 1, true, windowAt === undefined ? 0 : 0.9, windowAt === undefined ? Math.PI * 2 : Math.PI * 2 - 1.3]} />
        <meshStandardMaterial color="#d8d0bd" roughness={0.9} side={THREE.BackSide} />
      </mesh>
      {windowAt !== undefined ? <WindowWall x={windowAt} /> : null}
      {windowAt !== undefined ? <OutsideSky x={windowAt} t={t} sky={sky} /> : null}
      {/* 窓：左右の壁に小さな窓。外は夜か夕方の空 */}
      {Array.from({ length: 18 }, (_, k) => -7.5 + k * 0.9).flatMap((x) =>
        [-1, 1].filter((sd) => windowAt === undefined || sd < 0).map((sd) => (
          <mesh key={`${x}-${sd}`} position={[x, 1.45, sd * (CABIN_R - 0.13)]} rotation={[0, sd > 0 ? Math.PI : 0, 0]}>
            <planeGeometry args={[0.26, 0.34]} />
            <meshStandardMaterial color="#000" emissive={skyColor} emissiveIntensity={sky === "dusk" ? 0.45 : 0.25} />
          </mesh>
        )),
      )}
      {/* 網棚（70年代は開いた棚） */}
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[0, 2.12, sd * 1.25]} rotation={[sd * 0.25, 0, 0]}>
          <boxGeometry args={[18, 0.04, 0.55]} />
          <meshStandardMaterial color="#cfc6b0" roughness={0.8} />
        </mesh>
      ))}
      {/* 座席：左右3席ずつ（真ん中が通路） */}
      {Array.from({ length: rows }, (_, r) => -5 + r * SEAT_PITCH).flatMap((x) =>
        [-1.42, -0.95, -0.48, 0.48, 0.95, 1.42].map((z, k) => <Seat key={`${x}-${z}`} position={[x, 0, z]} color={seatColors[(((k + Math.round(x * 3)) % 3) + 3) % 3]} />),
      )}
      {/* 天井の明かり（暖かい色。にじまない明るさ） */}
      <mesh position={[0, 2.55, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[18, 0.3]} />
        <meshStandardMaterial color="#000" emissive="#ffe6bd" emissiveIntensity={0.25} side={THREE.DoubleSide} />
      </mesh>
      <pointLight position={[-3, 2.2, 0]} intensity={4} distance={8} color="#ffdcae" />
      <pointLight position={[2, 2.2, 0]} intensity={4} distance={8} color="#ffdcae" />
      {/* 窓の外を流れる雲（窓に寄る角度で見える） */}
      <group position={[0, 0, 7]}>
        <CloudLayer t={t} y={1.2} count={14} spread={40} drift={-6} color={sky === "dusk" ? "#c9a98e" : "#5d6676"} opacity={0.8} seed={3} size={9} />
      </group>
      <mesh position={[0, 1.2, 12]}>
        <planeGeometry args={[80, 30]} />
        <meshBasicMaterial color={sky === "dusk" ? "#7c675a" : "#0d1220"} />
      </mesh>
    </group>
  );
};

/** たばこの煙：透明な板をゆっくり上げる（速く動かすとチラつく） */
const Smoke: React.FC<{ position: V3; t: number }> = ({ position, t }) => {
  const tex = useMemo(() => {
    const cv = document.createElement("canvas");
    cv.width = 64; cv.height = 256;
    const c = cv.getContext("2d")!;
    for (let i = 0; i < 40; i++) {
      const y = 256 - i * 6, x = 32 + Math.sin(i * 0.35) * (4 + i * 0.4), r = 6 + i * 0.5;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(235,235,235,0.10)");
      g.addColorStop(1, "rgba(235,235,235,0)");
      c.fillStyle = g;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const tx = new THREE.CanvasTexture(cv);
    tx.colorSpace = THREE.SRGBColorSpace;
    return tx;
  }, []);
  const rise = (t * 0.012) % 0.04;
  return (
    <group position={position}>
      {[0, 1].map((k) => (
        <mesh key={k} position={[0.002 * k, 0.12 + rise + k * 0.02, 0]} rotation={[0, k * 0.9, 0]}>
          <planeGeometry args={[0.06, 0.24]} />
          <meshBasicMaterial map={tex} transparent opacity={0.55} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
};

export const InsertCabinSeat003: React.FC<SceneProps> = ({ variant = "a" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const row18 = -5 + 6 * SEAT_PITCH; // 男の席（後ろ寄り、右の真ん中）の列
  const seatZ = 0.95;
  const cams: Record<string, [CamKey, CamKey]> = {
    // a：座席の列を後ろから（後ろ姿の輪郭）
    a: [{ pos: [-7.2, 1.55, 0.15], target: [2, 1.0, 0.6], fov: 40 }, { pos: [-6.7, 1.55, 0.15], target: [2, 1.0, 0.6], fov: 39 }],
    // b：通路の低い所から、座席の列と後ろ姿
    b: [{ pos: [-3.9, 1.12, -0.05], target: [3, 1.05, 0.45], fov: 40 }, { pos: [-3.6, 1.12, -0.05], target: [3, 1.05, 0.45], fov: 39 }],
    // c・d：窓に寄って、外を流れる雲（人物なし）
    c: [{ pos: [row18 - 0.22, 1.4, 1.05], target: [row18 + 0.1, 1.45, 1.75], fov: 34 }, { pos: [row18 - 0.2, 1.4, 1.12], target: [row18 + 0.1, 1.45, 1.75], fov: 32 }],
    d: [{ pos: [row18 + 0.3, 1.42, 1.05], target: [row18 + 0.05, 1.45, 1.75], fov: 34 }, { pos: [row18 + 0.28, 1.42, 1.12], target: [row18 + 0.05, 1.45, 1.75], fov: 32 }],
    // ash：肘掛けの灰皿と、袖口の輪郭
    ash: [{ pos: [row18 + 0.62, 1.02, seatZ - 0.15], target: [row18 + 0.04, 0.64, seatZ + 0.24], fov: 30 }, { pos: [row18 + 0.58, 0.99, seatZ - 0.1], target: [row18 + 0.04, 0.64, seatZ + 0.24], fov: 28 }],
    // ash2：灰皿のふちのたばこ（人物なし）
    ash2: [{ pos: [row18 + 0.32, 0.78, seatZ + 0.12], target: [row18, 0.64, seatZ + 0.25], fov: 26 }, { pos: [row18 + 0.3, 0.76, seatZ + 0.1], target: [row18, 0.64, seatZ + 0.25], fov: 24 }],
    // tray：前の席の背のテーブルに、空のコップとたたんだ紙幣（人物なし）
    tray: [{ pos: [row18 - 0.05, 1.18, seatZ - 0.12], target: [row18 + 0.45, 0.75, seatZ], fov: 36 }, { pos: [row18 - 0.02, 1.14, seatZ - 0.1], target: [row18 + 0.45, 0.75, seatZ], fov: 34 }],
    // empty：誰もいない座席の列を、後ろの戸の方へ
    empty: [{ pos: [5.5, 1.6, -0.2], target: [-8, 1.0, 0.2], fov: 38 }, { pos: [5.0, 1.6, -0.2], target: [-8, 1.0, 0.2], fov: 37 }],
  };
  const [from, to] = cams[variant] ?? cams.a;
  const sky = variant === "d" || variant === "a" || variant === "tray" ? "dusk" : "night";
  const person = variant === "a" || variant === "b";
  return (
    <Stage fog={0.02} exposure={1.0} bg="#0a0c12" hemi={["#f0e2c8", "#2a241c", 0.45]}>
      <Camera from={from} to={to} />
      <Cabin t={t} sky={sky} windowAt={variant === "c" ? row18 + 0.1 : variant === "d" ? row18 + 0.05 : undefined} />
      {person ? (
        <>
          {/* 座席に座る後ろ姿（顔は見えない）。前の方にほかの乗客の頭 */}
          <Figure clip="Sitting_Idle_Loop" position={[row18 - 0.02, 0.08, seatZ]} rotationY={Math.PI / 2} glasses={false} build={COOPER_71} />
          <Figure clip="Sitting_Idle_Loop" position={[row18 + 3 * SEAT_PITCH - 0.02, 0.08, -0.95]} rotationY={Math.PI / 2} timeOffset={1.1} glasses={false} build={TRAVELER_A} />
        </>
      ) : null}
      {/* 肘掛けの灰皿（70年代の機内には肘掛けに灰皿があった） */}
      <group position={[row18 + 0.05, 0.645, seatZ + 0.25]}>
        <mesh>
          <boxGeometry args={[0.1, 0.02, 0.06]} />
          <meshStandardMaterial color="#8a8d90" roughness={0.45} metalness={0.6} />
        </mesh>
        <mesh position={[0, 0.011, 0]}>
          <boxGeometry args={[0.085, 0.004, 0.045]} />
          <meshStandardMaterial color="#2a2a2a" roughness={0.9} />
        </mesh>
        {variant === "ash" || variant === "ash2" ? (
          <>
            {/* 吸い殻と、ふちに置いた火のついたたばこ。火は暗めの橙（にじまない明るさ） */}
            {[0, 1, 2].map((k) => (
              <mesh key={k} position={[-0.025 + k * 0.02, 0.016, -0.008 + k * 0.006]} rotation={[0, 0.6 * k, Math.PI / 2]}>
                <cylinderGeometry args={[0.0035, 0.0035, 0.025, 8]} />
                <meshStandardMaterial color={k === 1 ? "#c9a46a" : "#e6e0d2"} roughness={0.9} />
              </mesh>
            ))}
            <mesh position={[0.03, 0.02, 0.012]} rotation={[0, 0.3, Math.PI / 2]}>
              <cylinderGeometry args={[0.0038, 0.0038, 0.06, 10]} />
              <meshStandardMaterial color="#efeae0" roughness={0.9} />
            </mesh>
            <mesh position={[0.06, 0.02, 0.003]} rotation={[0, 0.3, Math.PI / 2]}>
              <cylinderGeometry args={[0.0039, 0.0039, 0.004, 10]} />
              <meshStandardMaterial color="#3a1a0c" emissive="#ff7a30" emissiveIntensity={0.9} />
            </mesh>
            <Smoke position={[0.062, 0.02, 0.003]} t={t} />
          </>
        ) : null}
      </group>
      {variant === "ash" ? (
        // 袖口の輪郭だけ（腕を肘掛けに置いた形）。手や顔は描かない
        <mesh position={[row18 - 0.15, 0.69, seatZ + 0.22]} rotation={[0, 0, Math.PI / 2 - 0.06]}>
          <cylinderGeometry args={[0.043, 0.048, 0.22, 12]} />
          <meshStandardMaterial color={COOPER_71.jacket} roughness={0.9} />
        </mesh>
      ) : null}
      {variant === "tray" ? (
        <group position={[row18 + 0.42, 0.74, seatZ]}>
          {/* 前の席の背から下ろしたテーブル */}
          <mesh>
            <boxGeometry args={[0.3, 0.02, 0.42]} />
            <meshStandardMaterial color="#c9bfa8" roughness={0.6} />
          </mesh>
          <mesh position={[-0.04, 0.055, -0.06]}>
            <cylinderGeometry args={[0.032, 0.026, 0.09, 20, 1, true]} />
            <meshStandardMaterial color="#ebe7dc" roughness={0.5} side={THREE.DoubleSide} />
          </mesh>
          {/* たたんだ紙幣（文字・肖像は描かない） */}
          <mesh position={[-0.04, 0.013, 0.1]} rotation={[-Math.PI / 2, 0, 0.3]}>
            <planeGeometry args={[0.078, 0.066]} />
            <meshStandardMaterial color="#8fa38a" roughness={0.9} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[-0.035, 0.016, 0.105]} rotation={[-Math.PI / 2, 0, 0.5]}>
            <planeGeometry args={[0.078, 0.066]} />
            <meshStandardMaterial color="#869a80" roughness={0.9} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ) : null}
    </Stage>
  );
};

/* ---------- 4. 70年代のFBIの支局の事務所（人物なし） ---------- */

/** 索引カードの引き出しの棚（1つだけ引き出してある） */
const CardCatalog: React.FC<{ position: V3; rotY?: number; open?: boolean }> = ({ position, rotY = 0, open = true }) => {
  const wood = useMemo(() => new THREE.MeshStandardMaterial({ color: "#6b4a2e", roughness: 0.55 }), []);
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0.55, 0]} material={wood} castShadow>
        <boxGeometry args={[0.9, 1.1, 0.5]} />
      </mesh>
      {Array.from({ length: 4 }, (_, c) =>
        Array.from({ length: 6 }, (_, r) => {
          const isOpen = open && c === 1 && r === 3;
          return (
            <group key={`${c}-${r}`} position={[-0.33 + c * 0.22, 0.15 + r * 0.17, 0.25 + (isOpen ? 0.22 : 0)]}>
              <mesh material={wood}>
                <boxGeometry args={[0.2, 0.15, isOpen ? 0.44 : 0.02]} />
              </mesh>
              <mesh position={[0, 0.03, isOpen ? 0.225 : 0.012]}>
                <boxGeometry args={[0.05, 0.02, 0.01]} />
                <meshStandardMaterial color="#c8bfa2" roughness={0.3} metalness={0.7} />
              </mesh>
              {isOpen
                ? Array.from({ length: 16 }, (_, k) => (
                    <mesh key={k} position={[0, 0.06, -0.18 + k * 0.022]} rotation={[-0.15, 0, 0]}>
                      <planeGeometry args={[0.17, 0.11]} />
                      <meshStandardMaterial color={k % 5 === 2 ? "#e6d2a0" : "#efe9da"} side={THREE.DoubleSide} roughness={0.9} />
                    </mesh>
                  ))
                : null}
            </group>
          );
        }),
      )}
    </group>
  );
};

/** 保管棚（書類箱がぎっしり並ぶ） */
const ArchiveShelf: React.FC<{ position: V3; rotY?: number; seed: number }> = ({ position, rotY = 0, seed }) => (
  <group position={position} rotation={[0, rotY, 0]}>
    {[0, 1, 2, 3].map((k) => (
      <mesh key={k} position={[0, 0.05 + k * 0.6, 0]}>
        <boxGeometry args={[2.4, 0.03, 0.45]} />
        <meshStandardMaterial color="#6d6f6a" roughness={0.5} metalness={0.4} />
      </mesh>
    ))}
    {[-1, 1].map((sd) => (
      <mesh key={sd} position={[sd * 1.2, 1.1, 0]}>
        <boxGeometry args={[0.04, 2.2, 0.45]} />
        <meshStandardMaterial color="#6d6f6a" roughness={0.5} metalness={0.4} />
      </mesh>
    ))}
    {[0, 1, 2].flatMap((k) =>
      Array.from({ length: 5 }, (_, i) =>
        random(`as${seed}-${k}-${i}`) < 0.12 ? null : <FileBox key={`${k}-${i}`} position={[-0.92 + i * 0.46, 0.065 + k * 0.6, 0]} seed={seed + k * 5 + i} />,
      ),
    )}
  </group>
);

export const InsertFieldOffice003: React.FC<SceneProps> = ({ variant = "a" }) => {
  const night = variant === "c";
  const cams: Record<string, [CamKey, CamKey]> = {
    a: [{ pos: [1.4, 1.45, 1.6], target: [0, 0.8, 0], fov: 38 }, { pos: [1.2, 1.4, 1.45], target: [0, 0.8, 0], fov: 36 }], // 机の書類とタイプライター
    b: [{ pos: [-1.6, 1.3, 1.4], target: [-2.2, 0.6, -1.6], fov: 40 }, { pos: [-1.4, 1.25, 1.25], target: [-2.2, 0.6, -1.6], fov: 38 }], // 積まれた書類の箱
    c: [{ pos: [1.2, 1.25, 1.3], target: [0, 0.8, 0], fov: 36 }, { pos: [1.05, 1.22, 1.15], target: [0, 0.8, 0], fov: 34 }], // 夜、机の明かりだけ
    d: [{ pos: [-0.9, 1.5, 1.3], target: [-0.35, 0.85, 0.05], fov: 34 }, { pos: [-0.8, 1.45, 1.2], target: [-0.35, 0.85, 0.05], fov: 32 }], // 机の上のふたをした箱
    e: [{ pos: [3.2, 1.7, 3.0], target: [-1.0, 0.9, -2.0], fov: 42 }, { pos: [2.9, 1.65, 2.8], target: [-1.0, 0.9, -2.0], fov: 41 }], // 書類棚と積まれた箱（広く）
    f: [{ pos: [2.6, 1.35, -0.6], target: [2.3, 0.65, -2.2], fov: 32 }, { pos: [2.55, 1.3, -0.75], target: [2.3, 0.65, -2.2], fov: 30 }], // 索引カードの引き出し
    g: [{ pos: [-0.6, 1.6, 0.4], target: [-1.2, 1.55, -2.45], fov: 34 }, { pos: [-0.65, 1.58, 0.2], target: [-1.2, 1.55, -2.45], fov: 32 }], // 壁のカレンダー
    i: [{ pos: [3.6, 1.45, 1.5], target: [3.0, 0.8, 0], fov: 36 }, { pos: [3.45, 1.4, 1.35], target: [3.0, 0.8, 0], fov: 34 }], // 新聞の束と電話の机
    j: [{ pos: [-4.6, 1.5, 2.2], target: [-5.8, 1.0, -1.6], fov: 40 }, { pos: [-4.4, 1.45, 2.0], target: [-5.8, 1.0, -1.6], fov: 39 }], // 保管棚
  };
  const [from, to] = cams[variant] ?? cams.a;
  const lamp = useMemo(() => {
    const l = new THREE.PointLight("#ffd29a", night ? 5 : 1.5, 4, 2);
    l.position.set(0.45, 1.25, -0.15);
    return l;
  }, [night]);
  const newsTex = useMemo(() => {
    // 新聞の束（見出しの文字は読めないように、灰色の帯だけ）
    const cv = document.createElement("canvas");
    cv.width = 256; cv.height = 340;
    const c = cv.getContext("2d")!;
    c.fillStyle = "#d9d3c4"; c.fillRect(0, 0, 256, 340);
    c.fillStyle = "rgba(30,30,30,0.7)"; c.fillRect(16, 16, 224, 34);
    c.fillStyle = "rgba(60,60,60,0.45)";
    for (let col = 0; col < 4; col++) for (let y = 66; y < 330; y += 7) c.fillRect(16 + col * 57, y, 50, 2);
    c.fillStyle = "rgba(70,70,70,0.5)"; c.fillRect(130, 70, 108, 80);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  return (
    <Stage fog={0.01} exposure={night ? 0.95 : 1.05} bg="#0d0c0b" hemi={night ? ["#3a4458", "#0c0a08", 0.18] : ["#efe6d2", "#3a3022", 0.6]}>
      <Camera from={from} to={to} />
      {/* 床と、木目の壁板の壁（奥と左） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[16, 10]} />
        <meshStandardMaterial color="#5d564a" roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.6, -2.6]}>
        <planeGeometry args={[16, 3.2]} />
        <WoodMaterial w={16} h={3.2} tint="#e6c39a" />
      </mesh>
      <mesh position={[-6.5, 1.6, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[10, 3.2]} />
        <WoodMaterial w={10} h={3.2} tint="#e6c39a" />
      </mesh>
      {!night ? <CeilingLights y={3.15} xs={[-3, 0, 3]} zs={[-0.5]} glow={1.0} /> : null}
      {!night ? <pointLight position={[0, 2.9, 0.5]} intensity={12} distance={12} color="#f4f2e4" /> : null}
      {/* 窓（ブラインド。外は曇りの昼か夜） */}
      <group position={[2.0, 1.75, -2.58]}>
        <mesh>
          <planeGeometry args={[1.6, 1.3]} />
          <meshStandardMaterial color="#000" emissive={night ? "#0e1422" : "#a9b4bd"} emissiveIntensity={night ? 0.6 : 0.8} />
        </mesh>
        {Array.from({ length: 16 }, (_, k) => (
          <mesh key={k} position={[0, -0.6 + k * 0.08, 0.02]} rotation={[0.6, 0, 0]}>
            <planeGeometry args={[1.6, 0.05]} />
            <meshStandardMaterial color="#d8d0bf" roughness={0.7} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
      {/* 主な机：書類の束、タイプライター、電話、灰皿、机の明かり */}
      <Desk position={[0, 0, 0]} />
      <PaperStack position={[-0.35, 0.76, 0.05]} rotY={0.1} seed={1} n={7} />
      <PaperStack position={[-0.1, 0.76, 0.18]} rotY={-0.25} seed={4} n={3} />
      {variant === "d" ? <FileBox position={[-0.35, 0.76, 0.05]} rotY={0.08} seed={2} lid /> : <Typewriter position={[0.28, 0.76, 0.05]} rotY={-0.1} />}
      <DeskPhone position={[0.6, 0.76, -0.2]} rotY={-0.4} />
      <group position={[0.45, 0.76, -0.15]}>
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.4, 8]} />
          <meshStandardMaterial color="#2b2b2b" />
        </mesh>
        <mesh position={[0, 0.42, 0]}>
          <coneGeometry args={[0.12, 0.12, 20, 1, true]} />
          <meshStandardMaterial color="#2f3b2a" side={THREE.DoubleSide} emissive="#ffd29a" emissiveIntensity={night ? 0.25 : 0} />
        </mesh>
      </group>
      <primitive object={lamp} />
      {/* 隣の机：新聞の束と電話 */}
      <Desk position={[3, 0, 0]} />
      {[0, 1, 2, 3, 4].map((k) => (
        <mesh key={k} position={[2.8 + (k % 2) * 0.01, 0.765 + k * 0.012, 0.05]} rotation={[-Math.PI / 2, 0, 0.05 * (k % 3)]}>
          <planeGeometry args={[0.38, 0.5]} />
          <meshStandardMaterial map={newsTex} roughness={0.95} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <DeskPhone position={[3.45, 0.76, -0.15]} rotY={-0.6} />
      {/* 書類棚と積まれた書類箱 */}
      {[-3.2, -2.7, -2.2].map((x, k) => (
        <FilingCabinet key={x} position={[x, 0, -2.25]} color={k === 1 ? "#5f625a" : "#6b6e66"} />
      ))}
      {[0, 1, 2].flatMap((stk) =>
        [0, 1, 2, 3].slice(0, 4 - stk).map((k) => (
          <FileBox key={`${stk}-${k}`} position={[-1.7 + stk * 0.48, k * 0.33, -1.6 + (stk % 2) * 0.1]} rotY={(random(`fb${stk}-${k}`) - 0.5) * 0.2} seed={stk * 4 + k} />
        )),
      )}
      <CardCatalog position={[2.3, 0, -2.25]} />
      {/* 壁のカレンダーと、ピンで留めた書類 */}
      <mesh position={[-1.2, 1.55, -2.58]}>
        <planeGeometry args={[0.42, 0.52]} />
        <meshStandardMaterial map={calendarTexture()} roughness={0.9} />
      </mesh>
      <mesh position={[-0.6, 1.62, -2.58]} rotation={[0, 0, 0.04]}>
        <planeGeometry args={[0.216, 0.279]} />
        <meshStandardMaterial color="#ece4d2" roughness={0.9} />
      </mesh>
      {/* 保管室の棚（左の奥） */}
      <ArchiveShelf position={[-5.8, 0, -1.9]} seed={11} />
      <ArchiveShelf position={[-5.8, 0, -0.8]} rotY={0} seed={23} />
    </Stage>
  );
};
