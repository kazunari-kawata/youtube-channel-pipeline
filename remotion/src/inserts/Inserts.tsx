/**
 * イメージ映像（挿入シーン）。事件の日常の場面だけを、顔のないシルエットで描く。
 * 犯行・被害者・暴力をほのめかす場面は作らない（CLAUDE.md）。画面に必ず「イメージ」と表示する。
 * 街灯は90年代の米国に多いナトリウム灯（オレンジ）。
 */
import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useLayoutEffect, useMemo } from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { Figure } from "../lib/Figure";
import { FONT } from "../lib/font";
import { H, W } from "../lib/geo";

const SODIUM = "#ffa24a";
const NIGHT = "#070a12";

/* ---------- れんが（手続きで作るテクスチャ。外部の画像素材は使わない） ---------- */

const BRICK_TILE_M = 1.2; // テクスチャ1枚が表す壁の大きさ（m）。米国の標準れんが 約20cm×6cm＋目地
let brickCache: { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } | null = null;
const brickTextures = () => {
  if (brickCache) return brickCache;
  const S = 512, rows = 16, cols = 6;
  const rowH = S / rows, colW = S / cols, mortar = 3;
  const color = document.createElement("canvas");
  const bump = document.createElement("canvas");
  color.width = color.height = bump.width = bump.height = S;
  const c = color.getContext("2d")!, b = bump.getContext("2d")!;
  c.fillStyle = "#3b3530"; c.fillRect(0, 0, S, S); // 目地
  b.fillStyle = "#000"; b.fillRect(0, 0, S, S);
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * colW * 0.5;
    for (let k = -1; k <= cols; k++) {
      const x = k * colW + off, y = r * rowH;
      const v = random(`brick-${r}-${k}`);
      const red = 92 + Math.floor(v * 40), g = 44 + Math.floor(v * 18), bl = 32 + Math.floor(v * 12);
      c.fillStyle = `rgb(${red},${g},${bl})`;
      c.fillRect(x + mortar / 2, y + mortar / 2, colW - mortar, rowH - mortar);
      b.fillStyle = `rgb(${200 + Math.floor(v * 40)},${200 + Math.floor(v * 40)},${200 + Math.floor(v * 40)})`;
      b.fillRect(x + mortar / 2, y + mortar / 2, colW - mortar, rowH - mortar);
    }
  }
  // 汚れと欠け（小さな点を散らす）
  for (let i = 0; i < 6000; i++) {
    const x = random(`sx${i}`) * S, y = random(`sy${i}`) * S, a = random(`sa${i}`) * 0.18;
    c.fillStyle = `rgba(0,0,0,${a})`; c.fillRect(x, y, 2, 2);
  }
  const mk = (cv: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 8;
    return t;
  };
  brickCache = { map: mk(color, true), bump: mk(bump, false) };
  return brickCache;
};

/** 壁の大きさ（m）に合わせてれんがの目の大きさをそろえた材質 */
const BrickMaterial: React.FC<{ w: number; h: number; tint?: string }> = ({ w, h, tint = "#8a7468" }) => {
  const mat = useMemo(() => {
    const { map, bump } = brickTextures();
    const m2 = map.clone(), b2 = bump.clone();
    for (const t of [m2, b2]) { t.repeat.set(w / BRICK_TILE_M, h / BRICK_TILE_M); t.needsUpdate = true; }
    return new THREE.MeshStandardMaterial({ map: m2, bumpMap: b2, bumpScale: 1.2, color: tint, roughness: 0.92 });
  }, [w, h, tint]);
  return <primitive object={mat} attach="material" />;
};

/* ---------- 共通 ---------- */

type CamKey = { pos: [number, number, number]; target: [number, number, number]; fov?: number };

const Camera: React.FC<{ from: CamKey; to: CamKey }> = ({ from, to }) => {
  const { camera, advance } = useThree();
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  useLayoutEffect(() => {
    const t = THREE.MathUtils.smootherstep(frame / (durationInFrames - 1), 0, 1);
    const c = camera as THREE.PerspectiveCamera;
    c.position.lerpVectors(new THREE.Vector3(...from.pos), new THREE.Vector3(...to.pos), t);
    const tg = new THREE.Vector3(...from.target).lerp(new THREE.Vector3(...to.target), t);
    c.fov = THREE.MathUtils.lerp(from.fov ?? 35, to.fov ?? 35, t);
    c.near = 0.1;
    c.far = 300;
    c.lookAt(tg);
    c.updateProjectionMatrix();
  }, [frame, camera, durationInFrames, from, to, advance]);
  return null;
};

/** ナトリウム灯の街灯：柱・灯具・下向きのスポットライト・うっすら見える光の円錐 */
const StreetLamp: React.FC<{ x: number; z: number; armDir?: number; intensity?: number; shadow?: boolean; cone?: boolean }> = ({ x, z, armDir = -1, intensity = 900, shadow = false, cone = true }) => {
  const h = 6.2;
  const headX = x + armDir * 1.4;
  const light = useMemo(() => {
    const l = new THREE.SpotLight(SODIUM, intensity, 0, 0.75, 0.55, 2);
    l.position.set(headX, h - 0.15, z);
    l.target.position.set(headX, 0, z);
    l.castShadow = shadow;
    l.shadow.mapSize.set(1024, 1024);
    l.shadow.bias = -0.0005;
    return l;
  }, [headX, z, intensity, shadow]);
  return (
    <group>
      <mesh position={[x, h / 2, z]} castShadow>
        <cylinderGeometry args={[0.07, 0.09, h, 10]} />
        <meshStandardMaterial color="#1b1b1d" roughness={0.6} />
      </mesh>
      <mesh position={[x + armDir * 0.7, h, z]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, 1.4, 8]} />
        <meshStandardMaterial color="#1b1b1d" roughness={0.6} />
      </mesh>
      <mesh position={[headX, h - 0.08, z]}>
        <boxGeometry args={[0.55, 0.14, 0.3]} />
        <meshStandardMaterial color="#222" emissive={SODIUM} emissiveIntensity={3.5} />
      </mesh>
      {/* 光の円錐（霧の中の光の筋の代わり）。カメラに近い街灯では画面を覆うので出さない */}
      {cone ? (
        <mesh position={[headX, h / 2 - 0.1, z]}>
          <coneGeometry args={[2.6, h - 0.2, 32, 1, true]} />
          <meshBasicMaterial color={SODIUM} transparent opacity={0.03} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
        </mesh>
      ) : null}
      <primitive object={light} />
      <primitive object={light.target} />
    </group>
  );
};

/** 濡れたアスファルト（暗く、街灯がにじんで映る） */
const Ground: React.FC<{ size?: number }> = ({ size = 200 }) => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
    <planeGeometry args={[size, size]} />
    <meshStandardMaterial color="#141518" roughness={0.38} metalness={0.15} />
  </mesh>
);

/** れんがの建物（箱）と窓。lit の窓だけ暖色に光る */
const Building: React.FC<{ x: number; z: number; w: number; d: number; h: number; seed: number; litRatio?: number; facing?: 1 | -1 }> = ({ x, z, w, d, h, seed, litRatio = 0.12, facing = -1 }) => {
  const windows = useMemo(() => {
    const out: { y: number; zz: number; lit: boolean; warm: number }[] = [];
    for (let fy = 1; fy * 3.0 + 1.2 < h; fy++) {
      for (let k = 0; k * 2.6 + 1.3 < d; k++) {
        const r = random(`w-${seed}-${fy}-${k}`);
        out.push({ y: fy * 3.0 + 0.4, zz: z - d / 2 + 1.3 + k * 2.6, lit: r < litRatio, warm: random(`c-${seed}-${fy}-${k}`) });
      }
    }
    return out;
  }, [h, d, z, seed, litRatio]);
  const faceX = x + (facing * w) / 2 + facing * 0.03; // 壁面から3cm離す（同じ深さで重ねない：F-001）
  return (
    <group>
      <mesh position={[x, h / 2, z]} receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <BrickMaterial w={d} h={h} tint="#5c4a42" />
      </mesh>
      {windows.map((wd, i) => (
        <mesh key={i} position={[faceX, wd.y, wd.zz]} rotation={[0, (facing * Math.PI) / 2, 0]}>
          <planeGeometry args={[1.1, 1.5]} />
          {wd.lit ? (
            <meshStandardMaterial color="#000" emissive={wd.warm > 0.5 ? "#ff9a4a" : "#ffbb70"} emissiveIntensity={0.1} />
          ) : (
            <meshStandardMaterial color="#0c0e12" roughness={0.55} metalness={0.0} />
          )}
        </mesh>
      ))}
    </group>
  );
};

/** フィルムの粒子・周辺減光・「イメージ」表示 */
const Overlay: React.FC = () => {
  const frame = useCurrentFrame();
  const seed = Math.floor(frame / 2);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,0.65) 100%)" }} />
      <svg width={W} height={H} style={{ position: "absolute", opacity: 0.09, mixBlendMode: "overlay" }}>
        <filter id={`g${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={seed} />
        </filter>
        <rect width="100%" height="100%" filter={`url(#g${seed})`} />
      </svg>
      <div style={{ position: "absolute", left: 28, bottom: 22, fontFamily: FONT, fontSize: 15, color: "rgba(255,255,255,0.72)",
        letterSpacing: 2, border: "1px solid rgba(255,255,255,0.4)", padding: "3px 10px", borderRadius: 3 }}>イメージ</div>
    </AbsoluteFill>
  );
};

const Stage: React.FC<{ children: React.ReactNode; fog?: number; exposure?: number }> = ({ children, fog = 0.035, exposure = 1.0 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const fade = interpolate(frame, [0, 10, durationInFrames - 10, durationInFrames - 1], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: NIGHT }}>
      <AbsoluteFill style={{ opacity: fade }}>
        <ThreeCanvas width={W} height={H} shadows gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: exposure }}>
          <color attach="background" args={[NIGHT]} />
          <fogExp2 attach="fog" args={[NIGHT, fog]} />
          <hemisphereLight args={["#2b3a5a", "#0a0806", 0.35]} />
          {children}
        </ThreeCanvas>
      </AbsoluteFill>
      <Overlay />
    </AbsoluteFill>
  );
};

/* ---------- 1. 夜道を歩く ---------- */

export const InsertNightWalk: React.FC = () => {
  const walk = useMemo(() => (t: number): [number, number, number] => [1.3, 0.15, 1.0 - t * 1.15], []);
  return (
    <Stage fog={0.045} exposure={1.05}>
      <Camera from={{ pos: [2.3, 1.25, 6.2], target: [1.3, 1.3, -6] }} to={{ pos: [2.1, 1.3, 1.6], target: [1.2, 1.35, -10] }} />
      <Ground />
      {/* 歩道（車道より15cm高い） */}
      <mesh position={[1.5, 0.075, -40]} receiveShadow>
        <boxGeometry args={[3.0, 0.15, 120]} />
        <meshStandardMaterial color="#1c1d20" roughness={0.6} />
      </mesh>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <Building key={i} x={7.5} z={-6 - i * 13} w={6} d={12} h={9 + (i % 3) * 3} seed={i} litRatio={0.14} facing={-1} />
      ))}
      {[0, 1, 2, 3, 4].map((i) => (
        <Building key={`o${i}`} x={-16} z={-4 - i * 15} w={6} d={14} h={8 + (i % 2) * 4} seed={20 + i} litRatio={0.08} facing={1} />
      ))}
      <StreetLamp x={0.2} z={-9} armDir={1} shadow intensity={1100} />
      <StreetLamp x={0.2} z={-27} armDir={1} intensity={900} />
      <StreetLamp x={0.2} z={-45} armDir={1} intensity={900} />
      <StreetLamp x={0.2} z={4} armDir={1} intensity={450} cone={false} />
      <Figure clip="Walk_Loop" path={walk} rotationY={Math.PI} />
    </Stage>
  );
};

/* ---------- 2. アパートの窓辺に立つ ---------- */

export const InsertWindow: React.FC = () => {
  const winY = 4.6; // 2階の窓の中心
  const room = useMemo(() => {
    const l = new THREE.PointLight("#ffc98a", 60, 0, 2);
    l.position.set(0.3, winY + 0.6, -2.6);
    return l;
  }, []);
  return (
    <Stage fog={0.02} exposure={1.0}>
      <Camera from={{ pos: [2.8, 1.6, 12], target: [0, winY - 0.2, 0], fov: 30 }} to={{ pos: [1.6, 1.8, 8.5], target: [0, winY, 0], fov: 27 }} />
      <Ground />
      {/* 外壁：窓の穴を残して4枚の箱で組む */}
      {[
        { p: [-6.1, 4.5, 0], s: [10, 9, 0.4] },
        { p: [6.1, 4.5, 0], s: [10, 9, 0.4] },
        { p: [0, (winY - 1.0) / 2, 0], s: [2.2, winY - 1.0, 0.4] },
        { p: [0, (9 + winY + 1.0) / 2, 0], s: [2.2, 9 - winY - 1.0, 0.4] },
      ].map((b, i) => (
        <mesh key={i} position={b.p as [number, number, number]} receiveShadow>
          <boxGeometry args={b.s as [number, number, number]} />
          <BrickMaterial w={b.s[0]} h={b.s[1]} tint="#6a564c" />
        </mesh>
      ))}
      {/* ほかの暗い窓 */}
      {[-6, -3.4, 3.4, 6].flatMap((x) => [1.6, winY, 7.6].map((y) => ({ x, y }))).map((w, i) => (
        <mesh key={`w${i}`} position={[w.x, w.y, 0.23]}>
          <planeGeometry args={[1.2, 1.7]} />
          <meshStandardMaterial color="#0b0d11" roughness={0.12} metalness={0.5} />
        </mesh>
      ))}
      {/* 部屋：奥の壁と床 */}
      <mesh position={[0, winY, -3.4]}>
        <planeGeometry args={[6, 4]} />
        <meshStandardMaterial color="#d8b48a" roughness={0.9} emissive="#ffb870" emissiveIntensity={0.55} />
      </mesh>
      <mesh position={[0, winY - 1.25, -1.7]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6, 3.4]} />
        <meshStandardMaterial color="#3a2a1e" roughness={0.8} />
      </mesh>
      {/* カーテン（半分開いている） */}
      {[-0.78, 0.82].map((x, i) => (
        <mesh key={`c${i}`} position={[x, winY, -0.35]}>
          <planeGeometry args={[0.65, 2.0, 1, 1]} />
          <meshStandardMaterial color="#1d2a44" roughness={1} transparent opacity={0.92} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* 窓ガラスと窓枠 */}
      <mesh position={[0, winY, 0.12]}>
        <planeGeometry args={[2.2, 2.0]} />
        <meshStandardMaterial color="#9fb3c8" transparent opacity={0.08} roughness={0.05} metalness={0.2} depthWrite={false} />
      </mesh>
      <mesh position={[0, winY, 0.14]}>
        <boxGeometry args={[0.06, 2.0, 0.05]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <primitive object={room} />
      <Figure clip="Idle_Loop" position={[0.15, winY - 1.25, -1.0]} rotationY={0} />
      <StreetLamp x={4.5} z={6} armDir={-1} intensity={700} cone={false} />
    </Stage>
  );
};

/* ---------- 3. バス停で待つ ---------- */

export const InsertBusStop: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // ゆっくり通り過ぎる車のヘッドライト（1.5〜6秒）。速く動かすと明滅に見える（QAのチラつき検査で確認）
  const t = frame / fps;
  const carX = interpolate(t, [1.5, 6.0], [-22, 14], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const car = useMemo(() => new THREE.SpotLight("#e8f0ff", 0, 0, 0.55, 1.0, 2), []);
  car.intensity = 1300 * interpolate(t, [1.5, 2.2, 5.3, 6.0], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  car.position.set(carX, 0.8, 3.2);
  car.target.position.set(carX + 12, 0.2, 2.0);
  return (
    <Stage fog={0.05} exposure={1.0}>
      <Camera from={{ pos: [-3.4, 1.1, 9.5], target: [0.2, 1.2, 0], fov: 32 }} to={{ pos: [-2.4, 1.15, 8.6], target: [0.3, 1.25, 0], fov: 31 }} />
      <Ground />
      <mesh position={[0, 0.075, -1.5]} receiveShadow>
        <boxGeometry args={[60, 0.15, 3.4]} />
        <meshStandardMaterial color="#1c1d20" roughness={0.6} />
      </mesh>
      {/* バス停の標識（文字なし）とベンチ */}
      <mesh position={[1.6, 1.4, -0.4]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 2.8, 8]} />
        <meshStandardMaterial color="#202226" />
      </mesh>
      <mesh position={[1.6, 2.6, -0.4]} castShadow>
        <boxGeometry args={[0.04, 0.55, 0.45]} />
        <meshStandardMaterial color="#1f3b6e" roughness={0.5} />
      </mesh>
      <mesh position={[-1.4, 0.5, -1.6]} castShadow>
        <boxGeometry args={[1.8, 0.08, 0.45]} />
        <meshStandardMaterial color="#26221f" roughness={0.8} />
      </mesh>
      {[-2.2, -0.6].map((x) => (
        <mesh key={x} position={[x, 0.3, -1.6]}>
          <boxGeometry args={[0.06, 0.45, 0.4]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      ))}
      {/* 通りの向かいではなく背後の建物。Building は x 向きの壁面しか作らないので、90度回して正面をカメラに向ける */}
      <group rotation={[0, -Math.PI / 2, 0]}>
        <Building x={-9} z={0} w={8} d={40} h={12} seed={77} litRatio={0} facing={1} />
      </group>
      <StreetLamp x={0.6} z={-2.9} armDir={1} shadow intensity={1100} />
      <StreetLamp x={-18} z={-2.9} armDir={1} intensity={700} />
      <StreetLamp x={19} z={-2.9} armDir={1} intensity={700} />
      <Figure clip="Idle_Loop" position={[0.6, 0.15, -0.6]} rotationY={-Math.PI / 2 + 0.25} timeOffset={0.7} />
      <primitive object={car} />
      <primitive object={car.target} />
    </Stage>
  );
};

/* ---------- 確認用：人物を明るい場所で見る（本編には使わない） ---------- */

export const FigureCheck: React.FC = () => {
  const frame = useCurrentFrame();
  const angle = (frame / 180) * Math.PI * 2;
  return (
    <AbsoluteFill style={{ background: "#808080" }}>
      <ThreeCanvas width={W} height={H} gl={{ antialias: true, preserveDrawingBuffer: true }}>
        <color attach="background" args={["#7a7a7a"]} />
        <hemisphereLight args={["#ffffff", "#444444", 2.0]} />
        <directionalLight position={[3, 5, 4]} intensity={2.5} />
        <Camera from={{ pos: [Math.sin(angle) * 3.2, 1.2, Math.cos(angle) * 3.2], target: [0, 1.0, 0], fov: 35 }} to={{ pos: [Math.sin(angle) * 3.2, 1.2, Math.cos(angle) * 3.2], target: [0, 1.0, 0], fov: 35 }} />
        <Figure clip="Idle_Loop" position={[0, 0, 0]} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
