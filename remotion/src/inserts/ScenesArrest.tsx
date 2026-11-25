/**
 * 002 ダーマー：逮捕の場面（1991年7月22日の夜、オックスフォード・アパートの前）と、同じ通りのアパートの外観。ユーザーが場面を指定した例外（CLAUDE.md「イメージ映像」）。
 * 両手を後ろに回した本人を、後ろの警官が腕に手を添えて、止めたパトカーのほうへ連れていく。もう1人の警官はパトカーの横で待つ。
 * 暴力・もみ合い・武器は描かない。警光灯は消灯（赤い光を地面に落とさない）。建物は実在のアパートに似せない、ありふれたれんがの建物。
 *   arrest  a：通りの向かいから引き（横から、手を後ろに回しているのが分かる角度）、b：歩道の後ろ寄りから、c：車道側の斜め後ろから
 */
import React, { useMemo } from "react";
import * as THREE from "three";
import { Figure, OFFICER_90S, SLIM_90S } from "../lib/Figure";
import { Car80s } from "./Era80s";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { H, W } from "../lib/geo";
import { Building, Camera, CamKey, Ground, SceneProps, Stage, StreetLamp } from "./Inserts";

type Pose = Record<string, [number, number, number]>;

/** 両手を腰の後ろで組む：上腕を少し後ろへ、内側へひねり、肘を曲げる（ひねりの向きは左右で逆。確認用の並べ書きで確かめた） */
export const HANDS_BEHIND: Pose = {
  "DEF-upper_armL": [-0.2, 1.5, 0],
  "DEF-forearmL": [0.95, 0, 0],
  "DEF-upper_armR": [-0.2, -1.5, 0],
  "DEF-forearmR": [0.95, 0, 0],
};

/** 後ろの警官：左手を前へ出し、前に立つ人の腕に添える */
const HOLD_ARM: Pose = {
  "DEF-upper_armL": [0.6, 0, -0.15],
  "DEF-forearmL": [0.45, 0, 0],
};

/** 建物の入口：木の扉、上に小さな明かり、3段の石段 */
const Entrance: React.FC<{ x: number; z: number }> = ({ x, z }) => {
  const lamp = useMemo(() => {
    const l = new THREE.PointLight("#ffc890", 22, 10, 2);
    l.position.set(x - 0.35, 2.75, z);
    return l;
  }, [x, z]);
  return (
    <group>
      <mesh position={[x - 0.02, 1.25, z]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[1.15, 2.3]} />
        <meshStandardMaterial color="#2e2119" roughness={0.75} />
      </mesh>
      {/* 扉の上の小窓（暗いガラス） */}
      <mesh position={[x - 0.025, 2.6, z]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[1.15, 0.32]} />
        <meshStandardMaterial color="#1a1612" emissive="#ffb070" emissiveIntensity={0.08} />
      </mesh>
      {/* 明かりの灯具（街灯の電球より暗くして、にじませない） */}
      <mesh position={[x - 0.12, 2.95, z]}>
        <boxGeometry args={[0.16, 0.22, 0.16]} />
        <meshStandardMaterial color="#2a2520" emissive="#ffc27a" emissiveIntensity={0.9} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[x - 0.35 - i * 0.3, 0.09 + (2 - i) * 0.16, z]} receiveShadow castShadow>
          <boxGeometry args={[0.3, 0.18 + (2 - i) * 0.32, 1.7]} />
          <meshStandardMaterial color="#6b6660" roughness={0.9} />
        </mesh>
      ))}
      <primitive object={lamp} />
    </group>
  );
};

/** アパートの前の通り（逮捕の場面と、アパートの外観の場面で共通）。dawn：明け方の空、police：止めたパトカー */
const ApartmentStreet: React.FC<{ from: CamKey; to: CamKey; dawn?: boolean; police?: boolean; children?: React.ReactNode }> = ({ from, to, dawn = false, police = true, children }) => (
  <Stage fog={dawn ? 0.025 : 0.035} exposure={dawn ? 1.1 : 1.3} bg={dawn ? "#3b4864" : "#0e1422"} hemi={dawn ? ["#8a9cc4", "#1a1814", 0.9] : ["#34436a", "#0a0806", 0.45]}>
    <Camera from={from} to={to} />
    <Ground />
    {/* 歩道 */}
    <mesh position={[1.6, 0.075, -20]} receiveShadow>
      <boxGeometry args={[3.2, 0.15, 80]} />
      <meshStandardMaterial color="#1e1f22" roughness={0.6} />
    </mesh>
    {/* アパート（入口のある建物）と、すき間をあけた隣の建物 */}
    <Building x={6.2} z={-4} w={6} d={12} h={12} seed={91} litRatio={dawn ? 0.08 : 0.16} facing={-1} />
    <Building x={6.2} z={-17} w={6} d={12} h={9} seed={92} litRatio={dawn ? 0.05 : 0.1} facing={-1} />
    <Building x={6.2} z={-30} w={6} d={12} h={12} seed={93} litRatio={0.1} facing={-1} />
    {/* 通りの向かいの建物（引きの角度で見える） */}
    {[0, 1, 2].map((i) => (
      <Building key={`o${i}`} x={-16} z={2 - i * 15} w={6} d={14} h={8 + (i % 2) * 4} seed={95 + i} litRatio={0.08} facing={1} />
    ))}
    <Entrance x={3.16} z={-3.5} />
    {/* 隣の建物の入口（2棟が別の建物だと分かるように） */}
    <Entrance x={3.16} z={-16.5} />
    {/* 街灯は人物の真上を避け、少し手前と、パトカーの先に置く（真下の細い縁はにじみが揺れてチラつく） */}
    <StreetLamp x={0.2} z={1.0} armDir={1} intensity={dawn ? 700 : 1200} shadow cone={false} />
    <StreetLamp x={0.2} z={-12.5} armDir={1} intensity={dawn ? 500 : 900} />
    {/* 止めたパトカー（警光灯は消灯） */}
    {police ? <Car80s position={[-1.15, 0, -8.2]} rotationY={Math.PI / 2} color="#121314" police /> : null}
    {children}
  </Stage>
);

export const InsertArrest: React.FC<SceneProps> = ({ variant = "c" }) => {
  const cams: Record<string, [CamKey, CamKey]> = {
    a: [{ pos: [-10.5, 1.6, -0.6], target: [1.0, 1.05, -4.4], fov: 25 }, { pos: [-9.9, 1.6, -0.8], target: [1.0, 1.05, -4.4], fov: 24 }],
    b: [{ pos: [-2.6, 1.6, 4.2], target: [1.1, 1.0, -4.0], fov: 30 }, { pos: [-2.4, 1.6, 3.8], target: [1.1, 1.0, -4.0], fov: 29 }],
    c: [{ pos: [-3.4, 1.75, 3.0], target: [1.2, 1.0, -4.2], fov: 31 }, { pos: [-3.2, 1.75, 2.6], target: [1.2, 1.0, -4.2], fov: 30 }],
  };
  const [from, to] = cams[variant] ?? cams.c;
  // 本人：歩道の上で、パトカーのほう（-z、少し車道側）を向く。警官は本人の右うしろ（建物側）に立ち、左手を本人の右腕に添える。
  // こうすると、通りの向かい（a）からも後ろ（c）からも、本人の両手が後ろに回っているのが警官に隠れずに見える
  const face = Math.PI + 0.25;
  const fwd: [number, number] = [Math.sin(face), Math.cos(face)];
  const right: [number, number] = [-Math.cos(face), Math.sin(face)]; // 本人の右手の向き（rotationY=0 で -x）
  const me: [number, number] = [1.3, -3.0];
  const off: [number, number] = [me[0] - 0.5 * fwd[0] + 0.3 * right[0], me[1] - 0.5 * fwd[1] + 0.3 * right[1]];
  return (
    <ApartmentStreet from={from} to={to}>
      {/* 人物：本人（両手を後ろ）、後ろの警官（腕に手を添える）、パトカーの横の警官 */}
      <Figure clip="Idle_Loop" position={[me[0], 0.15, me[1]]} rotationY={face} pose={HANDS_BEHIND} build={SLIM_90S} glasses />
      <Figure clip="Idle_Loop" position={[off[0], 0.15, off[1]]} rotationY={face} pose={HOLD_ARM} build={OFFICER_90S} hat={OFFICER_90S.jacket} glasses={false} timeOffset={0.8} />
      <Figure clip="Idle_Loop" position={[0.75, 0.15, -5.3]} rotationY={0.35} build={OFFICER_90S} hat={OFFICER_90S.jacket} glasses={false} timeOffset={1.7} />
    </ApartmentStreet>
  );
};

/**
 * れんがのアパートの外観（人物なし）。実在の建物には似せない。2026-11-25 追加（文字カードを約4秒にして空いた時間：F-023・F-029）
 *   apartments  a：通りの向かいから2棟（入口のある建物と、すき間をあけた隣の建物）、b：明け方、止めたパトカー、
 *               c：夜、歩道の先から入口とパトカー、d：夜、通りの手前から建物を見上げる
 */
export const InsertApartments: React.FC<SceneProps> = ({ variant = "a" }) => {
  const cams: Record<string, [CamKey, CamKey]> = {
    a: [{ pos: [-11.5, 2.4, -2.0], target: [3.2, 3.0, -11.0], fov: 44 }, { pos: [-11.1, 2.4, -2.5], target: [3.2, 3.0, -11.2], fov: 43 }],
    b: [{ pos: [-4.0, 1.4, 6.0], target: [3, 2.6, -6], fov: 36 }, { pos: [-3.7, 1.45, 5.2], target: [3, 2.7, -6], fov: 35 }],
    c: [{ pos: [0.9, 1.3, -11.5], target: [2.6, 1.5, -2.5], fov: 38 }, { pos: [0.95, 1.32, -11.0], target: [2.6, 1.52, -2.5], fov: 37 }],
    d: [{ pos: [-6.0, 1.6, 16], target: [4, 4.5, -8], fov: 34 }, { pos: [-5.6, 1.7, 14.8], target: [4, 4.7, -8], fov: 33 }],
  };
  const [from, to] = cams[variant] ?? cams.a;
  return <ApartmentStreet from={from} to={to} dawn={variant === "b"} police={variant === "b" || variant === "c"} />;
};

/** 確認用：警官の人物を明るい場所で一周して見る（本編には使わない。F-008） */
export const OfficerCheck: React.FC = () => {
  const frame = useCurrentFrame();
  const angle = (frame / 180) * Math.PI * 2;
  const cam: CamKey = { pos: [Math.sin(angle) * 3.4, 1.25, Math.cos(angle) * 3.4], target: [0, 1.0, 0], fov: 35 };
  return (
    <AbsoluteFill style={{ background: "#808080" }}>
      <ThreeCanvas width={W} height={H} gl={{ antialias: true, preserveDrawingBuffer: true }}>
        <color attach="background" args={["#7a7a7a"]} />
        <hemisphereLight args={["#ffffff", "#444444", 2.0]} />
        <directionalLight position={[3, 5, 4]} intensity={2.5} />
        <Camera from={cam} to={cam} />
        <Figure clip="Idle_Loop" position={[-0.45, 0, 0]} build={OFFICER_90S} hat={OFFICER_90S.jacket} glasses={false} />
        <Figure clip="Idle_Loop" position={[0.45, 0, 0]} pose={HANDS_BEHIND} build={SLIM_90S} glasses />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
