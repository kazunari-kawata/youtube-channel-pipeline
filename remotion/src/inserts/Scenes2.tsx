/**
 * イメージ映像の追加場面（002 ダーマーの香盤表で足りなかったもの）。日常の場面と、人のいない風景だけ。
 *   ohio_road     70年代オハイオの郊外の道（夕方）。a：歩く人物、b：人物なし・日暮れ後
 *   courthouse    冬の裁判所の外観（人物なし）。a：引き、b：寄り
 *   police_car    夜の通りに止まった当時のパトカー（警光灯は消灯、人物なし）。a：横から、b：後ろから
 *   prison_fence  冬の夕暮れの刑務所のフェンス（人物なし）
 * 速く動く光・細かい模様は明滅に見えるので避ける（CLAUDE.md）。カメラはゆっくり。
 */
import React, { useMemo } from "react";
import { random, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { Figure } from "../lib/Figure";
import { Car80s, Storefront } from "./Era80s";
import { Building, Camera, CamKey, Ground, SceneProps, Stage, StreetLamp } from "./Inserts";

/** 空のグラデーション（遠くの大きな板）。霧の影響を受けない */
const Sky: React.FC<{ stops: [number, string][]; z?: number; w?: number; h?: number; y?: number }> = ({ stops, z = -160, w = 700, h = 160, y = 40 }) => {
  const tex = useMemo(() => {
    const cv = document.createElement("canvas");
    cv.width = 8;
    cv.height = 256;
    const c = cv.getContext("2d")!;
    const g = c.createLinearGradient(0, 256, 0, 0);
    stops.forEach(([p, col]) => g.addColorStop(p, col));
    c.fillStyle = g;
    c.fillRect(0, 0, 8, 256);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [stops]);
  return (
    <mesh position={[0, y, z]}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={tex} fog={false} />
    </mesh>
  );
};

const Tree: React.FC<{ x: number; z: number; s: number; color?: string }> = ({ x, z, s, color = "#1c2119" }) => (
  <group position={[x, 0, z]} scale={s}>
    <mesh position={[0, 1.2, 0]}>
      <cylinderGeometry args={[0.12, 0.18, 2.4, 6]} />
      <meshStandardMaterial color="#1a140f" roughness={1} />
    </mesh>
    <mesh position={[0, 3.6, 0]}>
      <sphereGeometry args={[1.9, 10, 8]} />
      <meshStandardMaterial color={color} roughness={1} />
    </mesh>
  </group>
);

/* ---------- 70年代オハイオの郊外の道 ---------- */

// a：夕方・歩く人物、b：日暮れ後・人物なし。c・d は 2026-11-25 追加の角度（F-029）：c 夕方・人物なし・高く引いて、d 日暮れ後・道の右から
const OHIO_CAMS: Record<string, [CamKey, CamKey]> = {
  a: [{ pos: [4.6, 1.5, 7.5], target: [3.0, 1.4, -30], fov: 36 }, { pos: [4.4, 1.55, 2.5], target: [3.0, 1.45, -35], fov: 35 }],
  b: [{ pos: [-1.5, 1.3, 8], target: [2.5, 1.2, -40], fov: 38 }, { pos: [-1.3, 1.35, 6.5], target: [2.5, 1.2, -45], fov: 37 }],
  c: [{ pos: [-3, 2.5, 10], target: [4, 1.0, -40], fov: 40 }, { pos: [-2.6, 2.4, 8], target: [4, 1.0, -45], fov: 39 }],
  d: [{ pos: [8.5, 1.1, 4], target: [0, 1.5, -40], fov: 36 }, { pos: [8.2, 1.15, 2.5], target: [0, 1.5, -45], fov: 35 }],
};

export const InsertOhioRoad: React.FC<SceneProps> = ({ variant = "a" }) => {
  const night = variant === "b" || variant === "d";
  const walk = useMemo(() => (t: number): [number, number, number] => [3.5, 0, 2.0 - t * 1.1], []);
  const trees = useMemo(() => {
    const out: { x: number; z: number; s: number }[] = [];
    for (let i = 0; i < 70; i++) {
      const side = random(`ts${i}`) < 0.5 ? -1 : 1;
      out.push({ x: side * (14 + random(`tx${i}`) * 40), z: -30 - random(`tz${i}`) * 160, s: 0.8 + random(`tsz${i}`) * 0.9 });
    }
    return out;
  }, []);
  const sun = useMemo(() => {
    const l = new THREE.DirectionalLight(night ? "#5a6a9a" : "#ffa060", night ? 0.25 : 1.6);
    l.position.set(-20, 6, -80);
    l.castShadow = true;
    l.shadow.mapSize.set(1024, 1024);
    l.shadow.camera.left = -20; l.shadow.camera.right = 20; l.shadow.camera.top = 20; l.shadow.camera.bottom = -20;
    return l;
  }, [night]);
  return (
    <Stage fog={0.012} exposure={night ? 1.25 : 1.0} bloom={0.4} bg={night ? "#1c2440" : "#4a4060"}
      hemi={night ? ["#5a6a9a", "#141210", 0.85] : ["#9a8ab8", "#3a2a1a", 0.7]}
      grade="sepia(0.3) saturate(0.78) contrast(1.04) brightness(1.02)">
      <Camera from={OHIO_CAMS[variant]?.[0] ?? OHIO_CAMS.a[0]} to={OHIO_CAMS[variant]?.[1] ?? OHIO_CAMS.a[1]} />
      <Sky stops={night ? [[0, "#4a4060"], [0.2, "#2a3050"], [1, "#0a0e1c"]] : [[0, "#ff9a52"], [0.18, "#d8706a"], [0.45, "#6a5a8a"], [1, "#1c2244"]]} />
      <primitive object={sun} />
      <primitive object={sun.target} />
      {/* 畑と道（片側1車線、黄色の中央線は破線にせず1本の線） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color={night ? "#1d1f16" : "#4a4628"} roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -80]} receiveShadow>
        <planeGeometry args={[6.4, 220]} />
        <meshStandardMaterial color="#2b2b2d" roughness={0.85} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -80]}>
        <planeGeometry args={[0.12, 220]} />
        <meshStandardMaterial color="#7a6a2a" roughness={0.8} />
      </mesh>
      {/* 電柱（電線は細すぎて揺らいで見えるので張らない） */}
      {Array.from({ length: 8 }, (_, i) => (
        <group key={i} position={[6.4, 0, -14 - i * 32]}>
          <mesh position={[0, 4.5, 0]} castShadow>
            <cylinderGeometry args={[0.12, 0.15, 9, 8]} />
            <meshStandardMaterial color="#2a2018" roughness={1} />
          </mesh>
          <mesh position={[0, 8.4, 0]}>
            <boxGeometry args={[0.12, 0.14, 2.2]} />
            <meshStandardMaterial color="#2a2018" roughness={1} />
          </mesh>
        </group>
      ))}
      {trees.map((t, i) => (
        <Tree key={i} {...t} />
      ))}
      {/* 路肩に止めた車と郵便受け */}
      <Car80s position={[4.6, 0, -15]} rotationY={Math.PI / 2} color="#7a5a2a" wagon />
      <group position={[4.2, 0, -5]}>
        <mesh position={[0, 0.55, 0]}>
          <boxGeometry args={[0.08, 1.1, 0.08]} />
          <meshStandardMaterial color="#3a2c20" />
        </mesh>
        <mesh position={[0, 1.18, 0]}>
          <boxGeometry args={[0.22, 0.24, 0.5]} />
          <meshStandardMaterial color="#5a5e64" roughness={0.5} metalness={0.4} />
        </mesh>
      </group>
      {variant === "a" ? <Figure clip="Walk_Loop" path={walk} rotationY={Math.PI} /> : null}
    </Stage>
  );
};

/* ---------- 冬の裁判所 ---------- */

const stoneTex = () => {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 256;
  const c = cv.getContext("2d")!;
  c.fillStyle = "#cfc7b8";
  c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2500; i++) {
    const v = random(`st${i}`);
    c.fillStyle = `rgba(${v > 0.5 ? 255 : 60},${v > 0.5 ? 250 : 55},${v > 0.5 ? 240 : 50},0.05)`;
    c.fillRect(random(`sx${i}`) * 256, random(`sy${i}`) * 256, 3, 3);
  }
  c.fillStyle = "rgba(80,70,60,0.25)"; // 石積みの目地（横）
  for (let y = 0; y < 256; y += 64) c.fillRect(0, y, 256, 2);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

const flagTex = () => {
  const cv = document.createElement("canvas");
  cv.width = 380;
  cv.height = 200;
  const c = cv.getContext("2d")!;
  for (let i = 0; i < 13; i++) {
    c.fillStyle = i % 2 === 0 ? "#a5242c" : "#f1ede4";
    c.fillRect(0, (i * 200) / 13, 380, 200 / 13 + 1);
  }
  c.fillStyle = "#2a3a6a";
  c.fillRect(0, 0, 152, (200 / 13) * 7);
  c.fillStyle = "#f1ede4";
  for (let r = 0; r < 9; r++) for (let k = 0; k < (r % 2 ? 5 : 6); k++) {
    c.beginPath();
    c.arc(12 + k * 25 + (r % 2 ? 12 : 0), 8 + r * 11.5, 2.6, 0, Math.PI * 2);
    c.fill();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};

/** ゆっくりなびく旗（頂点を毎フレーム少しだけ動かす） */
const Flag: React.FC<{ position: [number, number, number] }> = ({ position }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const geo = useMemo(() => new THREE.PlaneGeometry(2.6, 1.4, 24, 8), []);
  const base = useMemo(() => Float32Array.from(geo.getAttribute("position").array), [geo]);
  const tex = useMemo(flagTex, []);
  const t = frame / fps;
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = base[i * 3] + 1.3; // 竿からの距離
    pos.setZ(i, Math.sin(x * 2.2 - t * 1.6) * 0.09 * x);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return (
    <mesh geometry={geo} position={position}>
      <meshStandardMaterial map={tex} side={THREE.DoubleSide} roughness={0.8} />
    </mesh>
  );
};

export const InsertCourthouse: React.FC<SceneProps> = ({ variant = "a" }) => {
  const stone = useMemo(() => {
    const t = stoneTex();
    t.repeat.set(6, 3);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 });
  }, []);
  const cols = Array.from({ length: 8 }, (_, i) => -10.5 + i * 3);
  // a：引き、b：寄り。c・d は 2026-11-25 追加の角度（F-029）：c 階段の下から見上げる、d 右の遠くから
  const cams: Record<string, [CamKey, CamKey]> = {
    a: [{ pos: [2.5, 1.6, 30], target: [0, 6.0, -4], fov: 38 }, { pos: [2.0, 1.7, 25], target: [0, 6.2, -4], fov: 37 }],
    b: [{ pos: [-7, 2.0, 9], target: [-2, 6.5, -4], fov: 40 }, { pos: [-5.6, 2.1, 8.2], target: [-0.8, 6.6, -4], fov: 39 }],
    c: [{ pos: [3.5, 0.6, 7.5], target: [0, 8.0, -4], fov: 42 }, { pos: [3.0, 0.6, 6.8], target: [0, 8.2, -4], fov: 41 }],
    d: [{ pos: [22, 2.0, 18], target: [-2, 5.5, -4], fov: 34 }, { pos: [20.5, 2.0, 16.5], target: [-2, 5.6, -4], fov: 33 }],
    // e・f は 2026-11-28 追加（004）：e 左の低い所から見上げる、f 正面の高い所から遠く
    e: [{ pos: [-16, 1.2, 14], target: [1, 6.0, -4], fov: 40 }, { pos: [-15.2, 1.2, 13.4], target: [1, 6.1, -4], fov: 39 }],
    f: [{ pos: [6, 7.5, 36], target: [0, 6.0, -4], fov: 34 }, { pos: [5.6, 7.4, 34.5], target: [0, 6.0, -4], fov: 33 }],
  };
  const [from, to] = cams[variant] ?? cams.a;
  return (
    <Stage fog={0.01} exposure={1.0} bloom={0.15} bg="#8e98a3" hemi={["#dfe4ea", "#5d5a56", 1.1]} grade="sepia(0.1) saturate(0.72) contrast(1.05)">
      <Camera from={from} to={to} />
      <directionalLight position={[-10, 20, 15]} intensity={0.9} color="#f4f4f2" castShadow />
      <Sky stops={[[0, "#c2c8cf"], [1, "#7d8893"]]} z={-120} y={30} />
      {/* 雪の残る地面と階段 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial color="#d6d9dc" roughness={1} />
      </mesh>
      {Array.from({ length: 7 }, (_, i) => (
        <mesh key={i} position={[0, 0.09 + i * 0.18, 1.6 - i * 0.42]} material={stone} receiveShadow>
          <boxGeometry args={[30 - i * 0.2, 0.18, 2.4 - i * 0.0]} />
        </mesh>
      ))}
      <mesh position={[0, 0.65, -4]} material={stone}>
        <boxGeometry args={[28, 1.3, 6]} />
      </mesh>
      {/* 列柱 */}
      {cols.map((x) => (
        <group key={x} position={[x, 1.3, -3.2]}>
          <mesh position={[0, 0.2, 0]} material={stone}>
            <boxGeometry args={[1.5, 0.4, 1.5]} />
          </mesh>
          <mesh position={[0, 4.9, 0]} material={stone} castShadow>
            <cylinderGeometry args={[0.52, 0.6, 9.0, 24]} />
          </mesh>
          <mesh position={[0, 9.55, 0]} material={stone}>
            <boxGeometry args={[1.5, 0.3, 1.5]} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 12.0, -3.6]} material={stone} castShadow>
        <boxGeometry args={[27, 2.2, 2.6]} />
      </mesh>
      <mesh position={[0, 13.6, -4.4]} material={stone}>
        <boxGeometry args={[26, 1.2, 3.0]} />
      </mesh>
      {/* 柱の奥の壁と窓 */}
      <mesh position={[0, 6.5, -6.2]} material={stone} receiveShadow>
        <boxGeometry args={[27, 12, 1]} />
      </mesh>
      {cols.slice(0, -1).map((x) => (
        <mesh key={`w${x}`} position={[x + 1.5, 6.2, -5.68]}>
          <planeGeometry args={[1.3, 4.6]} />
          <meshStandardMaterial color="#2a2f36" roughness={0.3} metalness={0.3} />
        </mesh>
      ))}
      {/* 旗竿と星条旗 */}
      <mesh position={[-15.5, 7, 4]}>
        <cylinderGeometry args={[0.06, 0.09, 14, 10]} />
        <meshStandardMaterial color="#c9ccd0" roughness={0.4} metalness={0.6} />
      </mesh>
      <Flag position={[-14.2, 12.9, 4]} />
    </Stage>
  );
};

/* ---------- 夜の通りに止まったパトカー ---------- */

export const InsertPoliceCar: React.FC<SceneProps> = ({ variant = "a" }) => {
  // a：横から、b：後ろから。c〜e は 2026-11-25 追加の角度（F-029）：c 前寄りの低い所から、d 高い所から見下ろす、e 通りの向かいから引いて
  const cams: Record<string, [CamKey, CamKey]> = {
    a: [{ pos: [3.4, 1.3, -0.8], target: [-1.2, 0.85, -7.2], fov: 36 }, { pos: [3.1, 1.35, -1.8], target: [-1.2, 0.9, -7.6], fov: 35 }],
    b: [{ pos: [-1.6, 1.35, 4.5], target: [-1.1, 0.9, -12], fov: 34 }, { pos: [-1.5, 1.4, 3.0], target: [-1.1, 0.9, -14], fov: 33 }],
    c: [{ pos: [1.2, 0.9, -12.5], target: [-1.15, 0.8, -6.6], fov: 34 }, { pos: [1.0, 0.95, -12.0], target: [-1.15, 0.8, -6.6], fov: 33 }],
    d: [{ pos: [4.0, 6.5, 2.0], target: [-1.15, 0.5, -7.0], fov: 34 }, { pos: [3.8, 6.3, 1.4], target: [-1.15, 0.5, -7.2], fov: 33 }],
    e: [{ pos: [-9.5, 1.5, -3.0], target: [-1.0, 1.0, -8.0], fov: 32 }, { pos: [-9.1, 1.5, -3.4], target: [-1.0, 1.0, -8.2], fov: 31 }],
    // f・g は 2026-11-28 追加（004）：f 通りの向かいの高い所から（パトカーと前の車）、g 前の左の低い所から
    f: [{ pos: [-8.5, 4.6, -1.5], target: [-1.1, 0.7, -10.5], fov: 36 }, { pos: [-8.2, 4.5, -2.0], target: [-1.1, 0.7, -10.6], fov: 35 }],
    g: [{ pos: [-4.4, 0.85, -11.2], target: [-1.15, 0.85, -6.4], fov: 36 }, { pos: [-4.25, 0.87, -10.9], target: [-1.15, 0.85, -6.4], fov: 35 }],
  };
  const [from, to] = cams[variant] ?? cams.a;
  return (
    <Stage fog={0.045} exposure={1.05}>
      <Camera from={from} to={to} />
      <Ground />
      <mesh position={[1.5, 0.075, -40]} receiveShadow>
        <boxGeometry args={[3.0, 0.15, 120]} />
        <meshStandardMaterial color="#1c1d20" roughness={0.6} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => (
        <Building key={i} x={7.5} z={-6 - i * 13} w={6} d={12} h={9 + (i % 3) * 3} seed={40 + i} litRatio={0.12} facing={-1} />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <Building key={`o${i}`} x={-16} z={-4 - i * 15} w={6} d={14} h={8 + (i % 2) * 4} seed={60 + i} litRatio={0.08} facing={1} />
      ))}
      <Storefront position={[4.47, 1.45, -18]} rotationY={-Math.PI / 2} w={4.0} h={2.0} glow={0.16} />
      <StreetLamp x={0.2} z={-6} armDir={1} shadow intensity={1100} />
      <StreetLamp x={0.2} z={-26} armDir={1} intensity={800} />
      <Car80s position={[-1.15, 0, -6.6]} rotationY={Math.PI / 2} color="#121314" police />
      <Car80s position={[-1.15, 0, -14.5]} rotationY={Math.PI / 2} color="#6e4b34" wagon />
    </Stage>
  );
};

/* ---------- 冬の夕暮れの刑務所のフェンス ---------- */

const fenceTex = () => {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 64;
  const c = cv.getContext("2d")!;
  // 遠くからは網目が灰色のもやに見えるように、地を半透明にする（細い線だけだと消えるか、ちらつく）
  c.fillStyle = "rgb(95,95,95)";
  c.fillRect(0, 0, 64, 64);
  c.strokeStyle = "rgb(255,255,255)";
  c.lineWidth = 7;
  c.beginPath();
  c.moveTo(0, 32); c.lineTo(32, 0); c.lineTo(64, 32); c.lineTo(32, 64); c.closePath();
  c.stroke();
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
};

const Fence: React.FC<{ z: number; len: number; h: number }> = ({ z, len, h }) => {
  const mat = useMemo(() => {
    const t = fenceTex();
    t.repeat.set(len / 0.15, h / 0.15); // 網目は約15cm。カメラは遠くからほとんど動かさない
    return new THREE.MeshStandardMaterial({ color: "#a4aab2", alphaMap: t, transparent: true, opacity: 0.75, roughness: 0.6, metalness: 0.4, side: THREE.DoubleSide, depthWrite: false });
  }, [len, h]);
  const posts = Array.from({ length: Math.floor(len / 3) + 1 }, (_, i) => -len / 2 + i * 3);
  return (
    <group position={[0, 0, z]}>
      <mesh position={[0, h / 2, 0]} material={mat}>
        <planeGeometry args={[len, h]} />
      </mesh>
      {posts.map((x) => (
        <mesh key={x} position={[x, h / 2 + 0.3, 0.03]}>
          <cylinderGeometry args={[0.045, 0.045, h + 0.6, 8]} />
          <meshStandardMaterial color="#5c6168" roughness={0.5} metalness={0.5} />
        </mesh>
      ))}
      {/* 有刺鉄線のコイル */}
      {Array.from({ length: Math.floor(len / 0.9) }, (_, i) => (
        <mesh key={`c${i}`} position={[-len / 2 + i * 0.9, h + 0.45, 0]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.32, 0.018, 4, 16]} />
          <meshStandardMaterial color="#6a6f76" roughness={0.5} metalness={0.6} />
        </mesh>
      ))}
    </group>
  );
};

export const InsertPrisonFence: React.FC<SceneProps> = ({ variant = "a" }) => {
  // a：左から、b：右から（2026-11-25 追加の角度：F-029）
  const cams: Record<string, [CamKey, CamKey]> = {
    a: [{ pos: [-3.5, 1.6, 9], target: [1.5, 2.6, -8], fov: 40 }, { pos: [-2.8, 1.6, 8.4], target: [1.8, 2.6, -8], fov: 39 }],
    b: [{ pos: [8.5, 1.4, 6], target: [-2, 2.8, -6], fov: 38 }, { pos: [8.0, 1.4, 5.4], target: [-2, 2.8, -6], fov: 37 }],
    // c〜f は 2026-11-28 追加（004）。網目がちらつかないよう、どれも遠くから、ほとんど動かさない
    c: [{ pos: [0.5, 2.0, 26], target: [0, 3.0, -8], fov: 36 }, { pos: [0.5, 2.0, 25.2], target: [0, 3.0, -8], fov: 35.5 }], // 遠くから正面に
    d: [{ pos: [9, 1.5, 15], target: [-5.5, 6.0, -14], fov: 38 }, { pos: [8.7, 1.5, 14.6], target: [-5.5, 6.0, -14], fov: 37.5 }], // 右から、監視塔へ
    e: [{ pos: [-14, 6.0, 22], target: [2, 2.0, -8], fov: 40 }, { pos: [-13.6, 5.9, 21.4], target: [2, 2.0, -8], fov: 39.5 }], // 左の高い所から広く
    f: [{ pos: [16, 2.6, 24], target: [-4, 2.6, -8], fov: 34 }, { pos: [15.6, 2.6, 23.4], target: [-4, 2.6, -8], fov: 33.5 }], // 右の遠くから、照明塔と奥の建物
  };
  const [from, to] = cams[variant] ?? cams.a;
  const flood = useMemo(() => {
    const l = new THREE.SpotLight("#ffa24a", 650, 0, 0.9, 0.7, 2);
    l.position.set(4, 11, -4);
    l.target.position.set(1, 0, -10);
    l.castShadow = true;
    return l;
  }, []);
  return (
    <Stage fog={0.02} exposure={1.0} bloom={0.4} bg="#1e2740" hemi={["#4a5a86", "#1a1612", 0.5]}>
      <Camera from={from} to={to} />
      <Sky stops={[[0, "#c7805a"], [0.15, "#7a5a72"], [0.45, "#33406a"], [1, "#0e1428"]]} z={-150} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial color="#aeb4bf" roughness={1} />
      </mesh>
      <Fence z={-4} len={60} h={3.6} />
      <Fence z={-8} len={60} h={4.2} />
      {/* 照明塔と監視塔 */}
      <mesh position={[4, 5.5, -4.5]}>
        <cylinderGeometry args={[0.12, 0.16, 11, 8]} />
        <meshStandardMaterial color="#3a3d42" />
      </mesh>
      <mesh position={[4, 11, -4.3]}>
        <boxGeometry args={[0.9, 0.25, 0.4]} />
        <meshStandardMaterial color="#222" emissive="#ffa24a" emissiveIntensity={3} />
      </mesh>
      <primitive object={flood} />
      <primitive object={flood.target} />
      <group position={[-5.5, 0, -14]}>
        {[[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]].map(([x, z], i) => (
          <mesh key={i} position={[x, 3.5, z]}>
            <boxGeometry args={[0.2, 7, 0.2]} />
            <meshStandardMaterial color="#3a3d42" />
          </mesh>
        ))}
        <mesh position={[0, 8, 0]}>
          <boxGeometry args={[3.2, 2.2, 3.2]} />
          <meshStandardMaterial color="#5a5e66" roughness={0.8} />
        </mesh>
        <mesh position={[0, 8.1, 1.62]}>
          <planeGeometry args={[2.2, 0.8]} />
          <meshStandardMaterial color="#000" emissive="#ffd9a0" emissiveIntensity={0.25} />
        </mesh>
        <mesh position={[0, 9.4, 0]}>
          <boxGeometry args={[3.8, 0.3, 3.8]} />
          <meshStandardMaterial color="#2c2f34" />
        </mesh>
      </group>
      {/* 奥の建物 */}
      {[-24, -6, 12, 30].map((x, i) => (
        <mesh key={x} position={[x, 4, -30 - (i % 2) * 6]}>
          <boxGeometry args={[16, 8, 10]} />
          <meshStandardMaterial color="#3e4148" roughness={0.9} />
        </mesh>
      ))}
    </Stage>
  );
};
