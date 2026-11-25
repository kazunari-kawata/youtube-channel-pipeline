/**
 * 002 ダーマー：文字カードを約4秒にして空いた時間を埋める場面（2026-11-25 追加。F-023・F-029）。人物は出さない。
 *   tv_room       2022年の居間。テレビの光だけ（画面の中身・ロゴは見せない）。テーブルにビール瓶（ラベルなし。飲酒の問題に重ねる：ユーザー指定）。a：ソファの後ろから、b：横の低い所から、c：テレビの横から壁の光、d：入口から引いて、e：窓の側から
 *   windows_2022  2022年の集合住宅を外から。窓ごとにテレビの青い光。a：見上げる、b：通りの向かいから、c：斜めから
 *   phone         1991年ごろの台所の壁の電話（受話器は掛けたまま）。a：電話に寄る、b：入口から台所を引いて、c：調理台の側から
 *   court_hall    裁判所の中の廊下（大理石の床、木の扉、長いす、冬の昼の窓）。a：廊下の奥へ、b：長いすの横の低い所から、c：窓の側から振り返る
 * 光はゆっくり変えるだけ（速い明滅は QA のチラつき検査に掛かる）。小さく明るいものにはブルームが掛からない明るさにする。
 */
import React, { useMemo } from "react";
import { random, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { slowWave, WoodMaterial } from "./Era80s";
import { BrickMaterial, Camera, CamKey, Ground, SceneProps, Stage } from "./Inserts";

const pick = (cams: Record<string, [CamKey, CamKey]>, v: string) => cams[v] ?? cams.a;

/* ---------- 2022年の居間（テレビの光） ---------- */

/** ビール瓶（茶色のガラス。ラベル・文字・ロゴなし）。原点は瓶の底の中心 */
const BeerBottle: React.FC<{ position: [number, number, number]; rotation?: [number, number, number] }> = ({ position, rotation = [0, 0, 0] }) => {
  const geo = useMemo(() => {
    // 胴 → 肩 → 首 → 口の輪郭を回して作る（高さ約24cm）
    const pts = [[0, 0], [0.031, 0], [0.033, 0.004], [0.033, 0.14], [0.03, 0.16], [0.018, 0.185], [0.013, 0.2], [0.013, 0.232], [0.015, 0.236], [0.012, 0.24], [0, 0.24]]
      .map(([r, y]) => new THREE.Vector2(r, y));
    return new THREE.LatheGeometry(pts, 24);
  }, []);
  return (
    <mesh geometry={geo} position={position} rotation={rotation} castShadow>
      <meshStandardMaterial color="#5a2f0e" roughness={0.38} metalness={0} />
    </mesh>
  );
};

export const InsertTvRoom: React.FC<SceneProps> = ({ variant = "a" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const cams: Record<string, [CamKey, CamKey]> = {
    a: [{ pos: [0.35, 1.7, 2.7], target: [0, 0.7, -2.0], fov: 40 }, { pos: [0.3, 1.65, 2.3], target: [0, 0.7, -2.0], fov: 39 }], // ソファの後ろの高い所から（テーブルの瓶が見えるように）
    b: [{ pos: [2.4, 0.6, 0.9], target: [-0.6, 0.8, -1.6], fov: 42 }, { pos: [2.25, 0.62, 0.6], target: [-0.6, 0.8, -1.7], fov: 41 }],
    c: [{ pos: [-2.2, 1.1, -1.2], target: [0.4, 1.0, -2.5], fov: 44 }, { pos: [-2.1, 1.1, -1.45], target: [0.4, 1.0, -2.5], fov: 43 }],
    d: [{ pos: [2.6, 1.6, 2.9], target: [-0.4, 0.8, -1.4], fov: 46 }, { pos: [2.45, 1.6, 2.6], target: [-0.4, 0.8, -1.5], fov: 45 }],
    e: [{ pos: [-2.5, 1.6, 2.2], target: [0.5, 0.8, -2.0], fov: 46 }, { pos: [-2.35, 1.6, 1.9], target: [0.5, 0.8, -2.0], fov: 45 }],
  };
  const [from, to] = pick(cams, variant);
  // テレビの光：青白く、ゆっくり明るさが変わる（画面の中身は見せない）
  const tv = useMemo(() => new THREE.PointLight("#9ab8ff", 0, 9, 2), []);
  tv.position.set(0, 1.0, -2.2);
  tv.intensity = 7 + 4 * slowWave(t, 2.0);
  const screenGlow = 0.3 + 0.12 * slowWave(t, 2.0); // 明るすぎると白い板に見え、光のにじみも強く出た
  return (
    <Stage fog={0.02} exposure={1.15} bloom={0.3} bg="#05070c" hemi={["#26304a", "#0a0908", 0.25]} grade="saturate(0.85) contrast(1.05)">
      <Camera from={from} to={to} />
      {/* 床（明るい木目のフローリング）と壁・天井 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[8, 8]} />
        <meshStandardMaterial color="#5a4a3c" roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.35, -2.75]} receiveShadow>
        <planeGeometry args={[8, 2.7]} />
        <meshStandardMaterial color="#9a9ca2" roughness={0.9} />
      </mesh>
      <mesh position={[-3.0, 1.35, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[8, 2.7]} />
        <meshStandardMaterial color="#8f9197" roughness={0.9} />
      </mesh>
      <mesh position={[0, 2.7, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[8, 8]} />
        <meshStandardMaterial color="#2a2b2e" roughness={1} />
      </mesh>
      {/* 左の壁の窓（夜の街の遠い明かり） */}
      <mesh position={[-2.98, 1.5, -0.6]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[1.6, 1.3]} />
        <meshStandardMaterial color="#0d1424" emissive="#2a3a66" emissiveIntensity={0.25} />
      </mesh>
      {/* テレビ台と薄型テレビ。画面は光るだけ（文字・ロゴ・映像は出さない） */}
      <mesh position={[0, 0.25, -2.45]} castShadow receiveShadow>
        <boxGeometry args={[1.9, 0.5, 0.45]} />
        <meshStandardMaterial color="#2c2622" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.02, -2.62]}>
        <boxGeometry args={[1.45, 0.84, 0.05]} />
        <meshStandardMaterial color="#0b0b0c" roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.02, -2.594]}>
        <planeGeometry args={[1.38, 0.77]} />
        <meshStandardMaterial color="#000" emissive="#b8ccff" emissiveIntensity={screenGlow} />
      </mesh>
      <primitive object={tv} />
      {/* ソファ（テレビに向いた背中）とローテーブル */}
      <group position={[0, 0, 0.9]}>
        <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.1, 0.45, 0.9]} />
          <meshStandardMaterial color="#3d4148" roughness={0.95} />
        </mesh>
        <mesh position={[0, 0.62, 0.38]} castShadow>
          <boxGeometry args={[2.1, 0.55, 0.22]} />
          <meshStandardMaterial color="#3a3e45" roughness={0.95} />
        </mesh>
        {[-1.0, 1.0].map((x) => (
          <mesh key={x} position={[x, 0.42, 0]} castShadow>
            <boxGeometry args={[0.2, 0.42, 0.9]} />
            <meshStandardMaterial color="#383c42" roughness={0.95} />
          </mesh>
        ))}
      </group>
      <mesh position={[0, 0.2, -0.6]} castShadow receiveShadow>
        <boxGeometry args={[1.0, 0.06, 0.55]} />
        <meshStandardMaterial color="#4a3a2c" roughness={0.6} />
      </mesh>
      {/* テーブルの上のビール瓶（茶色のガラス、ラベルも文字もなし。飲酒の問題のくだりに重ねる：ユーザー指定）。
          つやは抑える（小さく明るい映り込みはブルームでチラつく） */}
      <BeerBottle position={[-0.28, 0.23, -0.52]} />
      <BeerBottle position={[-0.12, 0.23, -0.7]} />
      <BeerBottle position={[0.05, 0.23, -0.5]} />
      <BeerBottle position={[0.28, 0.265, -0.62]} rotation={[0, 0.6, Math.PI / 2]} />
      {/* 消えたフロアランプ */}
      <mesh position={[1.9, 0.75, -1.9]}>
        <cylinderGeometry args={[0.02, 0.02, 1.5, 8]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[1.9, 1.55, -1.9]}>
        <cylinderGeometry args={[0.16, 0.22, 0.28, 16, 1, true]} />
        <meshStandardMaterial color="#cfc6b6" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
    </Stage>
  );
};

/* ---------- 2022年の集合住宅（窓ごとのテレビの光） ---------- */

export const InsertWindows2022: React.FC<SceneProps> = ({ variant = "a" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const cams: Record<string, [CamKey, CamKey]> = {
    a: [{ pos: [2.0, 1.4, 12], target: [0, 9, 0], fov: 46 }, { pos: [1.8, 1.4, 11], target: [0, 9.3, 0], fov: 45 }],
    b: [{ pos: [-4, 6, 30], target: [0, 8, 0], fov: 38 }, { pos: [-3.6, 6, 28], target: [0, 8.1, 0], fov: 37 }],
    c: [{ pos: [16, 3.0, 16], target: [-2, 8, 0], fov: 40 }, { pos: [15, 3.0, 15], target: [-2, 8.1, 0], fov: 39 }],
  };
  const [from, to] = pick(cams, variant);
  const cols = 10, rows = 7;
  const wins = useMemo(() => {
    const out: { x: number; y: number; kind: number; seed: number }[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const rr = random(`w22-${r}-${c}`);
        out.push({ x: -9 + c * 2.0, y: 1.8 + r * 2.6, kind: rr < 0.38 ? 2 : rr < 0.52 ? 1 : 0, seed: random(`s22-${r}-${c}`) * 10 });
      }
    }
    return out;
  }, []);
  return (
    <Stage fog={0.02} exposure={1.1} bloom={0.3} bg="#0a0f1c" hemi={["#2a3654", "#0b0a09", 0.35]} grade="saturate(0.85) contrast(1.05)">
      <Camera from={from} to={to} />
      <Ground />
      {/* 建物の壁（れんが）と、上の階を分ける細い帯 */}
      <mesh position={[0, 9.5, -0.3]} receiveShadow>
        <boxGeometry args={[22, 19, 0.6]} />
        <BrickMaterial w={22} h={19} tint="#6a5e58" />
      </mesh>
      {wins.map((w, i) => (
        <mesh key={i} position={[w.x, w.y, 0.02]}>
          <planeGeometry args={[1.2, 1.5]} />
          {w.kind === 2 ? (
            // テレビの青い光：窓ごとに少しずつずらして、ゆっくり変える
            <meshStandardMaterial color="#000" emissive="#7ea2ff" emissiveIntensity={0.1 + 0.07 * slowWave(t, w.seed)} />
          ) : w.kind === 1 ? (
            <meshStandardMaterial color="#000" emissive="#ffb070" emissiveIntensity={0.1} />
          ) : (
            <meshStandardMaterial color="#0a0c10" roughness={0.6} />
          )}
        </mesh>
      ))}
      {/* 歩道と、ごく弱い街の明かり */}
      <mesh position={[0, 0.075, 3]} receiveShadow>
        <boxGeometry args={[40, 0.15, 5]} />
        <meshStandardMaterial color="#1c1d20" roughness={0.6} />
      </mesh>
      {/* 月明かりと、下の街灯の明かり（れんがの壁がうっすら見える程度） */}
      <directionalLight position={[-8, 12, 20]} color="#6f86b8" intensity={0.8} />
      <pointLight position={[4, 3, 5]} color="#ffb070" intensity={40} distance={22} decay={2} />
      <pointLight position={[-6, 3, 5]} color="#ffb070" intensity={30} distance={20} decay={2} />
    </Stage>
  );
};

/* ---------- 1991年ごろの台所の壁の電話 ---------- */

/** 巻いた電話のコード（らせん） */
const Cord: React.FC<{ from: [number, number, number]; drop: number }> = ({ from, drop }) => {
  const geo = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const turns = 26, n = 520;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const a = u * turns * Math.PI * 2;
      // 下へ垂れて、また受話器へ戻る U の字
      const y = -Math.sin(u * Math.PI) * drop;
      const x = 0.012 * Math.cos(a) + (u - 0.5) * 0.05;
      const z = 0.012 * Math.sin(a) + 0.03;
      pts.push(new THREE.Vector3(from[0] + x, from[1] + y, from[2] + z));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 900, 0.0035, 6, false);
  }, [from, drop]);
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color="#c9bea4" roughness={0.7} />
    </mesh>
  );
};

export const InsertPhone: React.FC<SceneProps> = ({ variant = "a" }) => {
  const cams: Record<string, [CamKey, CamKey]> = {
    a: [{ pos: [0.55, 1.45, 1.15], target: [0, 1.4, 0], fov: 34 }, { pos: [0.45, 1.45, 0.95], target: [0, 1.4, 0], fov: 33 }],
    b: [{ pos: [2.6, 1.55, 3.0], target: [-0.4, 1.1, 0], fov: 42 }, { pos: [2.45, 1.55, 2.7], target: [-0.4, 1.1, 0], fov: 41 }],
    c: [{ pos: [-1.2, 1.5, 1.6], target: [0.05, 1.3, 0], fov: 30 }, { pos: [-1.1, 1.5, 1.45], target: [0.05, 1.3, 0], fov: 29 }], // 調理台の側から、壁の電話
  };
  const [from, to] = pick(cams, variant);
  const lamp = useMemo(() => {
    const l = new THREE.PointLight("#ffcf96", 9, 6, 2);
    l.position.set(0.8, 2.3, 1.0);
    l.castShadow = true;
    l.shadow.mapSize.set(1024, 1024);
    l.shadow.bias = -0.0008;
    return l;
  }, []);
  return (
    <Stage fog={0.02} exposure={1.0} bloom={0.2} bg="#07080c" hemi={["#3a3a46", "#120e0a", 0.35]}>
      <Camera from={from} to={to} />
      {/* 床・壁（下は木目の壁板、上は黄ばんだ壁紙） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[8, 8]} />
        <meshStandardMaterial color="#5c4c3a" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.5, -0.02]} receiveShadow>
        <planeGeometry args={[6, 1.0]} />
        <WoodMaterial w={6} h={1.0} tint="#d6a878" />
      </mesh>
      <mesh position={[0, 1.75, -0.02]} receiveShadow>
        <planeGeometry args={[6, 1.5]} />
        <meshStandardMaterial color="#b9a986" roughness={0.95} />
      </mesh>
      {/* 調理台と流し、上の窓（夜） */}
      <mesh position={[-1.5, 0.45, 0.3]} castShadow receiveShadow>
        <boxGeometry args={[2.2, 0.9, 0.6]} />
        <meshStandardMaterial color="#6b5a45" roughness={0.7} />
      </mesh>
      <mesh position={[-1.5, 0.915, 0.3]} receiveShadow>
        <boxGeometry args={[2.2, 0.03, 0.62]} />
        <meshStandardMaterial color="#c8c2b0" roughness={0.6} />
      </mesh>
      <mesh position={[-1.6, 1.7, -0.01]}>
        <planeGeometry args={[1.0, 0.8]} />
        <meshStandardMaterial color="#0b1020" emissive="#1c2742" emissiveIntensity={0.3} />
      </mesh>
      {/* マグカップと小さなラジオ */}
      <mesh position={[-1.0, 0.98, 0.35]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.1, 16]} />
        <meshStandardMaterial color="#8a3b2e" roughness={0.6} />
      </mesh>
      <mesh position={[-2.2, 1.0, 0.25]} castShadow>
        <boxGeometry args={[0.3, 0.16, 0.12]} />
        <meshStandardMaterial color="#3a332c" roughness={0.6} />
      </mesh>
      {/* 壁掛けの電話（本体・受話器）とカレンダーの板（文字なし） */}
      <group position={[0, 1.4, 0]}>
        <mesh position={[0, 0, 0.04]} castShadow>
          <boxGeometry args={[0.12, 0.22, 0.07]} />
          <meshStandardMaterial color="#d9cfb6" roughness={0.55} />
        </mesh>
        <mesh position={[0, 0.0, 0.11]} castShadow>
          <capsuleGeometry args={[0.022, 0.17, 6, 12]} />
          <meshStandardMaterial color="#d6ccb2" roughness={0.5} />
        </mesh>
        <mesh position={[0, -0.03, 0.078]}>
          <boxGeometry args={[0.07, 0.07, 0.005]} />
          <meshStandardMaterial color="#bfb59c" roughness={0.6} />
        </mesh>
      </group>
      <Cord from={[0, 1.31, 0.1]} drop={0.35} />
      <mesh position={[0.55, 1.55, 0.0]}>
        <planeGeometry args={[0.32, 0.42]} />
        <meshStandardMaterial color="#e8e0cc" roughness={0.9} />
      </mesh>
      <primitive object={lamp} />
    </Stage>
  );
};

/* ---------- 裁判所の中の廊下 ---------- */

export const InsertCourtHall: React.FC<SceneProps> = ({ variant = "a" }) => {
  const cams: Record<string, [CamKey, CamKey]> = {
    a: [{ pos: [0.3, 1.6, 9], target: [0, 1.6, -20], fov: 44 }, { pos: [0.3, 1.6, 7.6], target: [0, 1.6, -20], fov: 43 }],
    b: [{ pos: [-1.9, 0.7, 2.0], target: [1.5, 1.6, -6], fov: 40 }, { pos: [-1.85, 0.72, 1.4], target: [1.5, 1.65, -6], fov: 39 }],
    c: [{ pos: [1.6, 2.6, -18], target: [-0.6, 0.9, -2], fov: 40 }, { pos: [1.5, 2.55, -17.4], target: [-0.6, 0.9, -2], fov: 39 }], // 窓の側の高い所から、手前へ振り返る
  };
  const [from, to] = pick(cams, variant);
  const doors = [-2, -8, -14];
  const lights = [4, -2, -8, -14];
  const sun = useMemo(() => {
    const l = new THREE.SpotLight("#dfe6f0", 45, 0, 0.6, 0.8, 1.2);
    l.position.set(0, 3.0, -21);
    l.target.position.set(0, 0, -6);
    return l;
  }, []);
  return (
    <Stage fog={0.015} exposure={0.82} bloom={0.1} bg="#202326" hemi={["#c9c6be", "#3a3530", 0.32]} grade="sepia(0.12) saturate(0.78) contrast(1.05)">
      <Camera from={from} to={to} />
      {/* 大理石の床（つやは控えめ） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -6]} receiveShadow>
        <planeGeometry args={[4.4, 34]} />
        <meshStandardMaterial color="#b9b4aa" roughness={0.42} metalness={0.05} />
      </mesh>
      {/* 両側の壁：下は木の腰板、上はしっくい */}
      {[-2.2, 2.2].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.6, -6]} rotation={[0, x < 0 ? Math.PI / 2 : -Math.PI / 2, 0]} receiveShadow>
            <planeGeometry args={[34, 1.2]} />
            <WoodMaterial w={34} h={1.2} horizontal tint="#b4885e" />
          </mesh>
          <mesh position={[x, 2.6, -6]} rotation={[0, x < 0 ? Math.PI / 2 : -Math.PI / 2, 0]} receiveShadow>
            <planeGeometry args={[34, 2.8]} />
            <meshStandardMaterial color="#d8cfbd" roughness={0.95} />
          </mesh>
        </group>
      ))}
      {/* 天井と、消えない丸い照明 */}
      <mesh position={[0, 4.0, -6]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4.4, 34]} />
        <meshStandardMaterial color="#cfc8b8" roughness={1} />
      </mesh>
      {lights.map((z) => (
        <group key={z}>
          <mesh position={[0, 3.85, z]}>
            <sphereGeometry args={[0.22, 20, 12]} />
            <meshStandardMaterial color="#e8e0cc" emissive="#fff0d0" emissiveIntensity={0.55} />
          </mesh>
          <pointLight position={[0, 3.5, z]} color="#ffe6c0" intensity={3.2} distance={8} decay={2} />
        </group>
      ))}
      {/* 右の壁の木の扉（表札の板は文字なし）と、左の壁の長いす */}
      {doors.map((z) => (
        <group key={z} position={[2.18, 0, z]}>
          <mesh position={[0, 1.2, 0]} rotation={[0, -Math.PI / 2, 0]}>
            <planeGeometry args={[1.5, 2.4]} />
            <meshStandardMaterial color="#4a3020" roughness={0.6} />
          </mesh>
          <mesh position={[-0.01, 2.65, 0]} rotation={[0, -Math.PI / 2, 0]}>
            <planeGeometry args={[0.7, 0.18]} />
            <meshStandardMaterial color="#8c7a52" roughness={0.5} />
          </mesh>
        </group>
      ))}
      {[-1, -7, -13].map((z) => (
        <group key={z} position={[-1.85, 0, z]}>
          <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.45, 0.06, 2.2]} />
            <meshStandardMaterial color="#5a3a24" roughness={0.6} />
          </mesh>
          <mesh position={[-0.2, 0.8, 0]} castShadow>
            <boxGeometry args={[0.05, 0.6, 2.2]} />
            <meshStandardMaterial color="#5a3a24" roughness={0.6} />
          </mesh>
          {[-1.0, 1.0].map((dz) => (
            <mesh key={dz} position={[0, 0.22, dz]}>
              <boxGeometry args={[0.4, 0.44, 0.05]} />
              <meshStandardMaterial color="#3e2818" />
            </mesh>
          ))}
        </group>
      ))}
      {/* 突き当たりの高い窓（冬の昼の白い光） */}
      <mesh position={[0, 2.1, -22.9]}>
        <planeGeometry args={[2.2, 3.2]} />
        <meshStandardMaterial color="#000" emissive="#e6ecf4" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0, 2.0, -23]}>
        <planeGeometry args={[4.4, 4.0]} />
        <meshStandardMaterial color="#d8cfbd" roughness={0.95} />
      </mesh>
      <primitive object={sun} />
      <primitive object={sun.target} />
    </Stage>
  );
};
