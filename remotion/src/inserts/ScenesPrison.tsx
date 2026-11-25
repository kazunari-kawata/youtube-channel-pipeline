/**
 * 002 ダーマー：刑務所の床に倒れた人物（1994年11月28日、コロンビア矯正施設での死亡を伝える場面）。
 * ユーザーの判断で入れる例外の場面（CLAUDE.md「イメージ映像」、F-027）。倒れた姿を離れたところから静かに見せるだけ。
 * 血・凶器・襲う人物・赤い色は出さない。カメラはほとんど動かさない。照明は消えたり揺れたりしない蛍光灯。
 *   prison_floor  a：斜め上から引き、b：横から低く
 */
import React, { useMemo } from "react";
import * as THREE from "three";
import { Figure, SLIM_PRISON } from "../lib/Figure";
import { BrickMaterial, Camera, CamKey, SceneProps, Stage } from "./Inserts";

const WALL = "#8e968f"; // 塗装したブロック壁（うすい灰緑）

/** 天井の蛍光灯（灯具は光る板、光は動かない） */
const Fluorescent: React.FC<{ x: number; z: number }> = ({ x, z }) => {
  const light = useMemo(() => {
    const l = new THREE.PointLight("#dfe7f2", 26, 9, 2);
    l.position.set(x, 2.75, z);
    l.castShadow = true;
    l.shadow.mapSize.set(1024, 1024);
    l.shadow.bias = -0.0008;
    return l;
  }, [x, z]);
  return (
    <group>
      <mesh position={[x, 2.95, z]}>
        <boxGeometry args={[1.3, 0.06, 0.32]} />
        <meshStandardMaterial color="#c9ced6" emissive="#eef3fb" emissiveIntensity={1.4} />
      </mesh>
      <primitive object={light} />
    </group>
  );
};

export const InsertPrisonFloor: React.FC<SceneProps> = ({ variant = "a" }) => {
  const cams: Record<string, [CamKey, CamKey]> = {
    a: [{ pos: [3.0, 2.9, 3.9], target: [-0.2, 0.1, -0.2], fov: 38 }, { pos: [2.85, 2.8, 3.7], target: [-0.2, 0.1, -0.2], fov: 37.5 }],
    b: [{ pos: [3.6, 0.7, 0.6], target: [0.0, 0.2, 0.0], fov: 34 }, { pos: [3.45, 0.7, 0.55], target: [0.0, 0.2, 0.0], fov: 33.5 }],
  };
  const [from, to] = cams[variant] ?? cams.a;
  return (
    <Stage fog={0.02} exposure={0.8} bloom={0.25} bg="#0c0d10" hemi={["#5d6676", "#141310", 0.3]}>
      <Camera from={from} to={to} />
      {/* 床（コンクリート） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[12, 12]} />
        <meshStandardMaterial color="#666863" roughness={0.88} />
      </mesh>
      {/* 奥と左の壁（塗装したブロック） */}
      <mesh position={[0, 1.5, -2.6]} receiveShadow>
        <planeGeometry args={[12, 3]} />
        <BrickMaterial w={12} h={3} tint={WALL} painted />
      </mesh>
      <mesh position={[-3.2, 1.5, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[12, 3]} />
        <BrickMaterial w={12} h={3} tint={WALL} painted />
      </mesh>
      {/* 壁の下の帯（腰の高さまで濃い色） */}
      <mesh position={[0, 0.5, -2.59]}>
        <planeGeometry args={[12, 1.0]} />
        <meshStandardMaterial color="#5d655f" roughness={0.9} transparent opacity={0.55} />
      </mesh>
      {/* 奥の鉄の扉（小窓つき）。開いていない */}
      <group position={[1.6, 0, -2.57]}>
        <mesh position={[0, 1.05, 0]}>
          <boxGeometry args={[0.95, 2.1, 0.06]} />
          <meshStandardMaterial color="#4c535a" roughness={0.55} metalness={0.4} />
        </mesh>
        <mesh position={[0, 1.55, 0.035]}>
          <planeGeometry args={[0.28, 0.36]} />
          <meshStandardMaterial color="#1c2026" roughness={0.3} />
        </mesh>
      </group>
      {/* 天井（暗い）と蛍光灯 */}
      <mesh position={[0, 3.0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 12]} />
        <meshStandardMaterial color="#2a2c2e" roughness={1} />
      </mesh>
      <Fluorescent x={-0.6} z={-0.6} />
      <Fluorescent x={1.6} z={1.4} />
      {/* 倒れた人物：倒れる動き（Death01）の最後の姿勢で止める。動かない */}
      <Figure clip="Death01" freeze="end" position={[0, 0, 0]} rotationY={-0.9} build={SLIM_PRISON} glasses />
    </Stage>
  );
};
