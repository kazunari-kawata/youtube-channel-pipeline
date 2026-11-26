/**
 * 003 D.B.クーパー（1971年11月24日、ポートランド〜シアトル）のイメージ映像：屋内の場面
 *   airport_walk：70年代の空港の通路を歩くトレンチコートの男（横から遠目。カメラに近づかない）
 *   airport_wait：空港の待合（座って待つ男、立ち上がる男、航空券のカウンター、検査の門、人のいない待合）
 *   cabin_seat：727 の機内（座席の列、窓の外の雲、灰皿、テーブル）
 *   field_office：70年代のFBIの支局の事務所（人物なし）
 *   fbi_lab：2001年の FBI の研究所。白衣の検査官が、台の上のネクタイから DNA の試料を採る（顔なし。後ろ斜めから）
 * 描くのは日常の場面だけ。脅す・メモを渡す・飛び降りる場面は描かない（plan.md）。人物は顔のないシルエット。
 * 実在の航空会社の名前・ロゴ・塗装は入れない。
 */
import React, { useMemo } from "react";
import { interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { Build, Figure } from "../lib/Figure";
import { WoodMaterial } from "./Era80s";
import { BrickMaterial, Camera, CamKey, SceneProps, Stage } from "./Inserts";
import {
  ATTENDANT_71, bokehTexture, calendarTexture, carpetTexture, CeilingLights, ChairRow, CloudLayer, COOPER_71, Desk, DeskPhone, dropsTexture, FileBox, FilingCabinet,
  Jet727, LAB_2001, PaperStack, terrazzoTexture, TRAVELER_A, TRAVELER_B, Typewriter,
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

/** 確認用（本編では使わない）：人物 COOPER_71 を灰色の背景で前後左右から見る（F-008、F-010。Figure-Check の 003 版）。
 *  共有の Figure-Check は 002 の体つきなので、003 の場面の角度 fig0・fig90・fig180・fig270 で見る */
const Cooper71Check: React.FC<{ deg: number; close?: boolean; build?: Build }> = ({ deg, close, build = COOPER_71 }) => {
  const a = (deg / 180) * Math.PI;
  const d = close ? 1.25 : 3.4;
  const cam: CamKey = { pos: [Math.sin(a) * d, close ? 1.5 : 1.15, Math.cos(a) * d], target: [0, close ? 1.42 : 0.95, 0], fov: 35 };
  return (
    <Stage fog={0} exposure={1.0} bloom={0} grade="none" bg="#7a7a7a" hemi={["#ffffff", "#444444", 2.0]}>
      <Camera from={cam} to={cam} />
      <directionalLight position={[3, 5, 4]} intensity={2.5} />
      <Figure clip="Idle_Loop" position={[0, 0, 0]} glasses={false} build={build} />
    </Stage>
  );
};

export const InsertAirportWalk003: React.FC<SceneProps> = ({ variant = "a" }) => {
  if (variant === "figc") return <Cooper71Check deg={20} close />;
  if (variant.startsWith("afig")) return <Cooper71Check deg={Number(variant.slice(4)) || 0} build={ATTENDANT_71} />;
  if (variant.startsWith("fig")) return <Cooper71Check deg={Number(variant.slice(3)) || 0} />;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  // 歩く速さは一定（毎秒1.2m）。カメラは横から遠目で、人物はカメラに近づかない
  const walkX = (t0: number, dir: number) => (s: number): V3 => [t0 + dir * 1.2 * s, 0, 0.6];
  const cams: Record<string, [CamKey, CamKey]> = {
    a: [{ pos: [-1.6, 1.5, 11], target: [-0.6, 1.2, -1], fov: 34 }, { pos: [0.8, 1.5, 11], target: [1.8, 1.2, -1], fov: 34 }], // 横から、男と一緒にゆっくり流す（速く流すと奥の床がちらつく）
    b: [{ pos: [-9, 1.6, 2.6], target: [4, 1.2, 0.2], fov: 30 }, { pos: [-8.5, 1.6, 2.6], target: [5, 1.2, 0.2], fov: 30 }], // 後ろから、遠ざかる男
    gate: [{ pos: [9, 2.2, 7], target: [-2, 1.1, -1], fov: 36 }, { pos: [8, 2.1, 6.4], target: [-2, 1.1, -1.2], fov: 35 }], // 搭乗口の列と検査の台
    // c：天井に近い高い所から、通路の奥へ小さく遠ざかる男（名前の分からない男）。カメラはほとんど動かさない
    c: [{ pos: [9.5, 3.7, 5.5], target: [-1.5, 0.5, -0.5], fov: 42 }, { pos: [9.2, 3.7, 5.3], target: [-2.0, 0.5, -0.5], fov: 41 }],
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
        variant === "c" ? (
          <Figure clip="Walk_Formal_Loop" path={walkX(2.6, -1)} rotationY={-Math.PI / 2} glasses={false} build={COOPER_71} />
        ) : (
          <Figure clip="Walk_Formal_Loop" path={variant === "b" ? walkX(-4.5, 1) : walkX(-4.0, 1)} rotationY={Math.PI / 2} glasses={false} build={COOPER_71} />
        )
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

/** 座席1つ（70年代の布張り）。席の間隔は 0.47m。座面や肘掛けが隣の席と重なると、重なった面がちらつく（QAで検出）ので、
 *  座面と背は間隔より狭くし、肘掛けは席の境目に1本だけ置く（arms：-1 は通路と反対側の端、1 は z の大きい側） */
const Seat: React.FC<{ position: V3; color: string; arms?: number[] }> = ({ position, color, arms = [-1, 1] }) => (
  <group position={position}>
    <mesh position={[0, 0.44, 0]} castShadow receiveShadow>
      <boxGeometry args={[0.46, 0.12, 0.455]} />
      <meshStandardMaterial color={color} roughness={0.95} />
    </mesh>
    <mesh position={[-0.25, 0.76, 0]} rotation={[0, 0, 0.12]} castShadow>
      <boxGeometry args={[0.09, 0.62, 0.445]} />
      <meshStandardMaterial color={color} roughness={0.95} />
    </mesh>
    {/* 頭の当たる所の布（70年代の機内の白いカバー） */}
    <mesh position={[-0.205, 1.03, 0]} rotation={[0, 0, 0.12]}>
      <boxGeometry args={[0.1, 0.12, 0.38]} />
      <meshStandardMaterial color="#c9c0aa" roughness={0.9} />
    </mesh>
    {/* 肘掛け */}
    {arms.map((sd) => (
      <mesh key={sd} position={[0, 0.62, sd * 0.235]}>
        <boxGeometry args={[0.44, 0.05, 0.045]} />
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
  // 窓から見えるのは空の狭い範囲なので、板を小さくして模様を細かくする（大きな板に粗い模様だと、窓いっぱいのぼやけた色になる）。
  // 地平線（雲海の上の縁）は窓の真ん中の高さ。上は空、下は夕日（または月明かり）に縁を照らされた雲海
  const tex = useMemo(() => {
    const W = 2048, H = 1024, hz = H * 0.5;
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const c = cv.getContext("2d")!;
    const dusk = sky === "dusk";
    const g = c.createLinearGradient(0, 0, 0, hz);
    if (dusk) { g.addColorStop(0, "#4e5068"); g.addColorStop(0.7, "#9a7c78"); g.addColorStop(1, "#d6a27c"); }
    else { g.addColorStop(0, "#060810"); g.addColorStop(1, "#232c3e"); }
    c.fillStyle = g; c.fillRect(0, 0, W, hz);
    const d = c.createLinearGradient(0, hz, 0, H);
    if (dusk) { d.addColorStop(0, "#8a6c66"); d.addColorStop(1, "#3a3036"); }
    else { d.addColorStop(0, "#273043"); d.addColorStop(1, "#0d111a"); }
    c.fillStyle = d; c.fillRect(0, hz, W, H - hz);
    // 左右の端で模様がつながるように、同じものを W ずらして描く
    const blob = (x: number, y: number, rx: number, ry: number, col: string) => {
      for (const dx of [0, -W, W]) {
        c.save();
        c.translate(x + dx, y);
        c.scale(1, ry / rx);
        const gg = c.createRadialGradient(0, 0, 0, 0, 0, rx);
        gg.addColorStop(0, col);
        gg.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = gg;
        c.fillRect(-rx, -rx, rx * 2, rx * 2);
        c.restore();
      }
    };
    // 高い所の薄い筋雲
    for (let i = 0; i < 26; i++) {
      blob(random(`hs${i}`) * W, hz * (0.25 + random(`hy${i}`) * 0.6), 120 + random(`hr${i}`) * 220, 10 + random(`hq${i}`) * 14,
        dusk ? "rgba(235,190,165,0.16)" : "rgba(90,100,125,0.12)");
    }
    // 雲海：奥ほど小さく低く。上の縁を明るく、下に影
    for (let i = 0; i < 420; i++) {
      const depth = random(`dd${i}`);
      const y = hz + 6 + depth ** 1.6 * (H - hz) * 0.95;
      const r = 18 + depth * 110 + random(`dr${i}`) * 30;
      const xx = random(`dx${i}`) * W;
      blob(xx, y + r * 0.18, r * 1.4, r * 0.5, dusk ? "rgba(40,30,38,0.22)" : "rgba(4,6,10,0.25)");
      blob(xx, y - r * 0.12, r * 1.2, r * 0.42, dusk ? "rgba(240,196,160,0.20)" : "rgba(140,155,185,0.24)");
    }
    const tx = new THREE.CanvasTexture(cv);
    tx.colorSpace = THREE.SRGBColorSpace;
    tx.wrapS = THREE.RepeatWrapping;
    tx.anisotropy = 8;
    return tx;
  }, [sky]);
  tex.offset.x = t * 0.008;
  return (
    <mesh position={[x, 1.45, 6]} rotation={[0, Math.PI, 0]}>
      <planeGeometry args={[12, 6]} />
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
        [-1.42, -0.95, -0.48, 0.48, 0.95, 1.42].map((z, k) => (
          <Seat key={`${x}-${z}`} position={[x, 0, z]} color={seatColors[(((k + Math.round(x * 3)) % 3) + 3) % 3]} arms={k === 0 || k === 3 ? [-1, 1] : [1]} />
        )),
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
    //   近すぎると窓が画面いっぱいの楕円になって何か分からないので、窓の周りの壁と座席の背が入る所まで離す
    c: [{ pos: [row18 - 0.38, 1.36, 0.5], target: [row18 + 0.04, 1.4, 1.75], fov: 31 }, { pos: [row18 - 0.34, 1.37, 0.6], target: [row18 + 0.04, 1.41, 1.75], fov: 29 }],
    d: [{ pos: [row18 + 0.46, 1.38, 0.55], target: [row18 + 0.02, 1.42, 1.75], fov: 31 }, { pos: [row18 + 0.42, 1.38, 0.64], target: [row18 + 0.02, 1.42, 1.75], fov: 29 }],
    // ash：肘掛けの灰皿と、袖口の輪郭
    ash: [{ pos: [row18 + 0.62, 1.02, seatZ - 0.15], target: [row18 + 0.04, 0.64, seatZ + 0.24], fov: 30 }, { pos: [row18 + 0.58, 0.99, seatZ - 0.1], target: [row18 + 0.04, 0.64, seatZ + 0.24], fov: 28 }],
    // ash2：灰皿のふちのたばこ（人物なし）
    ash2: [{ pos: [row18 + 0.32, 0.78, seatZ + 0.12], target: [row18, 0.64, seatZ + 0.25], fov: 26 }, { pos: [row18 + 0.3, 0.76, seatZ + 0.1], target: [row18, 0.64, seatZ + 0.25], fov: 24 }],
    // tray：前の席の背のテーブルに、空のコップとたたんだ紙幣（人物なし）
    tray: [{ pos: [row18 - 0.05, 1.18, seatZ - 0.12], target: [row18 + 0.45, 0.75, seatZ], fov: 36 }, { pos: [row18 - 0.02, 1.14, seatZ - 0.1], target: [row18 + 0.45, 0.75, seatZ], fov: 34 }],
    // ask：通路に立つ客室乗務員が、席の男に尋ねる（2026-11-26 ユーザーの指示）。前の列の背の上から見下ろす
    ask: [{ pos: [row18 + 2.3, 1.78, -0.42], target: [row18 + 0.02, 1.0, 0.45], fov: 40 }, { pos: [row18 + 2.15, 1.76, -0.4], target: [row18 + 0.02, 1.0, 0.45], fov: 39 }],
    // empty：誰もいない座席の列を、後ろの戸の方へ
    empty: [{ pos: [5.5, 1.6, -0.2], target: [-8, 1.0, 0.2], fov: 38 }, { pos: [5.0, 1.6, -0.2], target: [-8, 1.0, 0.2], fov: 37 }],
  };
  const [from, to] = cams[variant] ?? cams.a;
  const sky = variant === "d" || variant === "a" || variant === "tray" || variant === "ask" ? "dusk" : "night";
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
      {variant === "ask" ? (
        <>
          {/* 席の男は座って答え、通路の乗務員は男の方を向いて話す（顔なし） */}
          <Figure clip="Sitting_Talking_Loop" position={[row18 - 0.02, 0.08, seatZ]} rotationY={Math.PI / 2} glasses={false} build={COOPER_71} />
          <Figure clip="Idle_Talking_Loop" position={[row18 + 0.1, 0, 0.0]} rotationY={-0.15} timeOffset={0.7} glasses={false} build={ATTENDANT_71} />
        </>
      ) : null}
      {/* 肘掛けの灰皿（70年代の機内には肘掛けに灰皿があった） */}
      <group position={[row18 + 0.05, 0.645, seatZ + 0.235]}>
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
        <mesh position={[row18 - 0.15, 0.7, seatZ + 0.225]} rotation={[0, 0, Math.PI / 2 - 0.06]}>
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
    {/* 背板：棚の隙間から奥の棚の箱の細い切れ端が見えると、カメラが動くたびにちらつく（QAで検出） */}
    <mesh position={[0, 1.1, -0.235]}>
      <boxGeometry args={[2.36, 2.2, 0.02]} />
      <meshStandardMaterial color="#4a4c48" roughness={0.7} metalness={0.2} />
    </mesh>
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
    j: [{ pos: [-4.0, 1.5, 2.2], target: [-5.2, 1.0, -1.6], fov: 40 }, { pos: [-3.8, 1.45, 2.0], target: [-5.2, 1.0, -1.6], fov: 39 }], // 保管棚
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
      {/* 保管室の棚（左の奥）。左の壁（x=-6.5）に食い込ませない：壁を突き抜けた箱の切れ端がちらつく */}
      <ArchiveShelf position={[-5.2, 0, -1.9]} seed={11} />
      <ArchiveShelf position={[-5.2, 0, -0.8]} rotY={0} seed={23} />
    </Stage>
  );
};

/* ---------- 2001年の FBI の研究所：ネクタイから DNA の試料を採る ---------- */

/** 台の上に平らに置いたクリップ式の黒いネクタイ（白い紙の上）。結び目から剣先へ広がり、先がとがる */
const TieOnPaper: React.FC<{ position: V3; rotY?: number }> = ({ position, rotY = 0 }) => {
  const shape = useMemo(() => {
    const sh = new THREE.Shape();
    // 平面の x が幅、y が長さ（あとで寝かせる）。上が結び目、下が剣先
    sh.moveTo(-0.022, 0.24);
    sh.lineTo(0.022, 0.24);
    sh.lineTo(0.016, 0.2);
    sh.lineTo(0.036, -0.17);
    sh.lineTo(0, -0.22);
    sh.lineTo(-0.036, -0.17);
    sh.lineTo(-0.016, 0.2);
    sh.closePath();
    return sh;
  }, []);
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0.002, 0]} receiveShadow>
        <boxGeometry args={[0.46, 0.004, 0.62]} />
        <meshStandardMaterial color="#d6d3ca" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <shapeGeometry args={[shape]} />
        <meshStandardMaterial color="#0d0d10" roughness={0.6} side={THREE.DoubleSide} />
      </mesh>
      {/* 結び目の上のクリップ（金具は光らせない） */}
      <mesh position={[0, 0.012, -0.245]}>
        <boxGeometry args={[0.04, 0.01, 0.03]} />
        <meshStandardMaterial color="#3a3a3c" roughness={0.7} />
      </mesh>
    </group>
  );
};

/** 綿棒を入れる細い管の立て（白い管が4本） */
const SwabRack: React.FC<{ position: V3 }> = ({ position }) => (
  <group position={position}>
    <mesh position={[0, 0.03, 0]}>
      <boxGeometry args={[0.22, 0.06, 0.06]} />
      <meshStandardMaterial color="#8d949a" roughness={0.6} />
    </mesh>
    {[0, 1, 2, 3].map((k) => (
      <mesh key={k} position={[-0.075 + k * 0.05, 0.1, 0]}>
        <cylinderGeometry args={[0.009, 0.009, 0.14, 10]} />
        <meshStandardMaterial color="#e8eaec" roughness={0.5} />
      </mesh>
    ))}
  </group>
);

/** 実験台（黒い天板と、明るい灰色の引き出し） */
const LabBench: React.FC<{ position: V3; w?: number }> = ({ position, w = 3.2 }) => (
  <group position={position}>
    <mesh position={[0, 0.9, 0]} receiveShadow castShadow>
      <boxGeometry args={[w, 0.04, 0.8]} />
      <meshStandardMaterial color="#1c2023" roughness={0.45} />
    </mesh>
    <mesh position={[0, 0.44, 0.02]} receiveShadow>
      <boxGeometry args={[w, 0.88, 0.74]} />
      <meshStandardMaterial color="#b8bcb9" roughness={0.7} />
    </mesh>
    {Array.from({ length: Math.floor(w / 0.8) }, (_, k) => (
      <mesh key={k} position={[-w / 2 + 0.4 + k * 0.8, 0.72, 0.392]}>
        <boxGeometry args={[0.7, 0.012, 0.01]} />
        <meshStandardMaterial color="#7d8280" roughness={0.6} />
      </mesh>
    ))}
  </group>
);

/** 拡大鏡つきの台の明かり（光はにじまない明るさ） */
const MagLamp: React.FC<{ position: V3 }> = ({ position }) => (
  <group position={position}>
    <mesh position={[0, 0.02, 0]}>
      <cylinderGeometry args={[0.07, 0.08, 0.04, 16]} />
      <meshStandardMaterial color="#d6d8d6" roughness={0.6} />
    </mesh>
    <mesh position={[0, 0.25, 0]} rotation={[0, 0, 0.25]}>
      <cylinderGeometry args={[0.012, 0.012, 0.46, 8]} />
      <meshStandardMaterial color="#cfd2d0" roughness={0.6} />
    </mesh>
    <mesh position={[-0.14, 0.44, 0.08]} rotation={[0.25, 0, 0.6]}>
      <torusGeometry args={[0.09, 0.018, 8, 24]} />
      <meshStandardMaterial color="#cfd2d0" roughness={0.6} />
    </mesh>
  </group>
);

/** 顕微鏡（形だけ） */
const Microscope: React.FC<{ position: V3; rotY?: number }> = ({ position, rotY = 0 }) => (
  <group position={position} rotation={[0, rotY, 0]}>
    <mesh position={[0, 0.03, 0]}><boxGeometry args={[0.2, 0.05, 0.26]} /><meshStandardMaterial color="#d9dbd8" roughness={0.6} /></mesh>
    <mesh position={[0, 0.2, -0.08]}><boxGeometry args={[0.06, 0.32, 0.06]} /><meshStandardMaterial color="#d9dbd8" roughness={0.6} /></mesh>
    <mesh position={[0, 0.33, -0.01]} rotation={[0.5, 0, 0]}><cylinderGeometry args={[0.022, 0.022, 0.2, 12]} /><meshStandardMaterial color="#2a2c2e" roughness={0.5} /></mesh>
    <mesh position={[0, 0.12, 0.02]}><boxGeometry args={[0.14, 0.012, 0.12]} /><meshStandardMaterial color="#2a2c2e" roughness={0.5} /></mesh>
  </group>
);

/** 台に向かって少し前かがみになり、両手を台の上の物へ下ろす姿勢（Idle_Loop の息づかいはそのまま） */
const BENCH_WORK: Record<string, [number, number, number]> = {
  "DEF-spine002": [0.22, 0, 0],
  "DEF-neck": [0.3, 0, 0],
  "DEF-upper_armL": [0.38, 0, -0.12],
  "DEF-forearmL": [1.05, 0, 0],
  "DEF-upper_armR": [0.38, 0, 0.12],
  "DEF-forearmR": [1.05, 0, 0],
};

const LabFigureCheck: React.FC<{ deg: number; clip?: string; work?: boolean }> = ({ deg, clip = "Idle_Loop", work }) => {
  const a = (deg / 180) * Math.PI;
  const cam: CamKey = { pos: [Math.sin(a) * 3.4, 1.15, Math.cos(a) * 3.4], target: [0, 0.95, 0], fov: 35 };
  return (
    <Stage fog={0} exposure={1.0} bloom={0} grade="none" bg="#7a7a7a" hemi={["#ffffff", "#444444", 2.0]}>
      <Camera from={cam} to={cam} />
      <directionalLight position={[3, 5, 4]} intensity={2.5} />
      <Figure clip={clip} position={[0, 0, 0]} glasses={false} build={LAB_2001} pose={work ? BENCH_WORK : undefined} />
    </Stage>
  );
};

export const InsertFbiLab003: React.FC<SceneProps> = ({ variant = "a" }) => {
  if (variant.startsWith("wfig")) return <LabFigureCheck deg={Number(variant.slice(4)) || 0} work />;
  if (variant.startsWith("ifig")) return <LabFigureCheck deg={Number(variant.slice(4)) || 0} clip="Interact" />;
  if (variant.startsWith("pfig")) return <LabFigureCheck deg={Number(variant.slice(4)) || 0} clip="PickUp_Table" />;
  if (variant.startsWith("fig")) return <LabFigureCheck deg={Number(variant.slice(3)) || 0} />;
  // a：後ろ斜めの少し高い所から。台に向かってネクタイに両手を下ろす検査官と、明かりの下のネクタイ（顔は見えない）。カメラはゆっくり寄るだけ
  const cams: Record<string, [CamKey, CamKey]> = {
    a: [{ pos: [1.55, 1.75, 1.15], target: [-0.05, 1.0, -0.95], fov: 38 }, { pos: [1.4, 1.72, 1.0], target: [-0.05, 1.0, -0.95], fov: 36 }],
  };
  const [from, to] = cams[variant] ?? cams.a;
  return (
    <Stage fog={0.015} exposure={1.05} bg="#101214" hemi={["#eef2f4", "#3a3e40", 0.55]}>
      <Camera from={from} to={to} />
      {/* 床（明るい灰色の床材）と、塗装したブロックの壁（奥と左） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[14, 10]} />
        <meshStandardMaterial color="#8f9290" roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.6, -1.65]}>
        <planeGeometry args={[14, 3.2]} />
        <BrickMaterial w={14} h={3.2} tint="#d7dad6" painted />
      </mesh>
      <mesh position={[-3.2, 1.6, 1.5]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[7, 3.2]} />
        <BrickMaterial w={7} h={3.2} tint="#d7dad6" painted />
      </mesh>
      <CeilingLights y={3.05} xs={[-1.6, 1.2]} zs={[-0.4]} glow={0.9} />
      <pointLight position={[0, 2.8, 0.2]} intensity={10} distance={10} color="#f2f6f8" />
      {/* 台の手元を照らす明かり */}
      <pointLight position={[-0.15, 1.45, -0.95]} intensity={1.6} distance={2.2} color="#fff2dc" />
      {/* 奥の壁の棚（瓶と箱。文字なし） */}
      <group position={[0.4, 1.75, -1.5]}>
        <mesh><boxGeometry args={[2.6, 0.03, 0.26]} /><meshStandardMaterial color="#c9ccca" roughness={0.6} /></mesh>
        {Array.from({ length: 9 }, (_, k) => (
          <mesh key={k} position={[-1.15 + k * 0.28, 0.1 + (k % 3) * 0.01, 0]}>
            {k % 3 === 0 ? <boxGeometry args={[0.18, 0.16, 0.16]} /> : <cylinderGeometry args={[0.045, 0.05, 0.18 + (k % 2) * 0.05, 12]} />}
            <meshStandardMaterial color={k % 3 === 0 ? "#b7a88a" : "#7f8c8a"} roughness={0.5} />
          </mesh>
        ))}
      </group>
      <LabBench position={[0.2, 0, -1.05]} />
      <TieOnPaper position={[-0.12, 0.92, -0.95]} rotY={0.35} />
      <SwabRack position={[0.45, 0.92, -1.2]} />
      <MagLamp position={[-1.35, 0.92, -1.3]} />
      <Microscope position={[1.25, 0.92, -1.15]} rotY={-0.3} />
      {/* 茶色の紙の証拠袋（文字なし） */}
      <mesh position={[0.75, 0.94, -0.85]} rotation={[0, 0.2, 0]}>
        <boxGeometry args={[0.26, 0.03, 0.36]} />
        <meshStandardMaterial color="#8c6c46" roughness={0.9} />
      </mesh>
      {/* 検査官：台に向かって少し前かがみになり、ネクタイに両手を下ろす */}
      <Figure clip="Idle_Loop" position={[-0.05, 0, -0.38]} rotationY={Math.PI} glasses={false} build={LAB_2001} pose={BENCH_WORK} />
    </Stage>
  );
};

