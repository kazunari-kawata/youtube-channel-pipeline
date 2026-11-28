/**
 * 004 テッド・バンディ（1972〜1989年）のイメージ映像。日常の場面と、人のいない場所だけ（CLAUDE.md、F-065）。
 *   campus          1970年代の大学の中庭（れんがの校舎、大きな木、芝生の道、外灯）。
 *                   a 夕方の引き、b 歩く学生（本人。顔のないシルエット）、c 図書館の入口の階段を下から、d 夜の外灯、e 朝の低い所から、g 夕方のベンチ、h 夜を高い所から引く
 *   college_street  夜の大学町の通り（古い木、ポーチの灯りの木造の家並み、ナトリウム灯）。a 通りの奥へ、b 反対の向きから
 *   hotline         夜の電話相談の部屋（机に並ぶダイヤル式の電話、卓上の灯り）。a
 *   campaign        1970年代の選挙事務所（積んだ白いビラ、文字のない看板、タイプライター）。a、b 別の角度
 *   lakepark        夏の湖畔の州立公園の駐車場（木々、湖面、止まった当時の車）。a 引き、b 助手席の窓につり布の掛かった小さな車、c 午後遅くの遠景
 *   carseat         止めた車の中（助手席の腕のつり布と、畳んだ上着）。a 運転席の側から、b 後ろの座席から前へ
 *   mall            夜のショッピングモールの駐車場（平屋の建物、看板の文字なし、ナトリウム灯）。a 引き、b 灯りの下の明るい色の小さな車
 *   winterjail      雪の小さな町の、れんがの郡の建物（夜）。a
 *   courtroom       1979年の法廷（判事席、陪審席、弁護人の机、テレビカメラ）。
 *                   a 引き（演台に立つ被告の後ろ姿）、b 傍聴席の後ろから（無人）、c テレビカメラに寄る、d 陪審席、e 判事席を見上げる、g 弁護人の机の法律用箋
 *   courtroom_fed   1987年の連邦裁判所の法廷（昼の窓の光、明るい木）。a 引き、b 証言台、c 窓の光の判事席
 *   figures_004     確認用：本人の2つの服装（学生、スーツ）。台本では使わない（Figure-Check の代わりに Scene-Check で見る）
 *
 * 女性（被害者）は描かない。本人と他人が同じ画面にいる絵、車に人を乗せる・連れ去る動きは描かない（F-065）。
 * 実在の店名・車名・ロゴ・政党の印・局のしるしは入れない。赤い光は使わない。
 * チラつき対策（CLAUDE.md）：カメラはゆっくり、細い線や細かい縦の並びを正面に置かない、走る光を置かない、小さく明るい物にブルームを掛けない。
 */
import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { Build, Figure } from "../lib/Figure";
import { Car80s, Storefront } from "./Era80s";
import { BrickMaterial, Camera, CamKey, SceneProps, Stage, StreetLamp } from "./Inserts";

/* ---------- 本人の服装（plan.md の人物の設定。FBI の電報の特徴：細身で筋肉質、濃い茶色の波打つ髪を右で分ける、眼鏡なし） ---------- */

// 1970年代の学生：襟付きのシャツにセーター、スラックス。002（ダーマー）の体つきは流用しない（肩幅をやや広く）
export const BUNDY_STUDENT: Build = { shoulder: 0.9, width: 1.0, jacket: "#4b4a3e", trousers: "#55524a", shoes: "#1a1512", skin: "#16110e", hair: "#2c2018", suit: { shirt: "#c9c1ad" } };
// 1979年の法廷：スーツ、白いシャツ、ネクタイ（F-036：襟と V とネクタイまで見せる）
export const BUNDY_SUIT: Build = { shoulder: 0.9, width: 1.0, jacket: "#3a3a3c", trousers: "#333335", shoes: "#141210", skin: "#16110e", hair: "#2c2018", suit: { shirt: "#d6d2c8", tie: "#2b2f3d" } };

/* ---------- 共通の部品 ---------- */

type Look = "dusk" | "day" | "night" | "morning";

/** 空のドーム（半径 220）。広角や横向きのカメラでも、空の板の端や遠いクリップ面が見えないように。stops は地平線(0)→天頂(1) */
const SkyDome: React.FC<{ stops: [number, string][] }> = ({ stops }) => {
  const tex = useMemo(() => {
    const cv = document.createElement("canvas");
    cv.width = 8;
    cv.height = 512;
    const c = cv.getContext("2d")!;
    // 球の v は下の極(0)→上の極(1)。地平線は v=0.5。キャンバスの y は上が 0
    const g = c.createLinearGradient(0, 512, 0, 0);
    g.addColorStop(0, stops[0][1]);
    stops.forEach(([p, col]) => g.addColorStop(0.5 + p * 0.5, col));
    c.fillStyle = g;
    c.fillRect(0, 0, 8, 512);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [stops]);
  return (
    <mesh renderOrder={-1}>
      <sphereGeometry args={[220, 32, 24]} />
      <meshBasicMaterial map={tex} side={THREE.BackSide} fog={false} depthWrite={false} />
    </mesh>
  );
};

const SKY: Record<Look, [number, string][]> = {
  dusk: [[0, "#d39a72"], [0.18, "#a2788a"], [0.5, "#4f5880"], [1, "#1d2340"]],
  day: [[0, "#d6dbe0"], [0.5, "#a9b6c4"], [1, "#7f92a8"]],
  night: [[0, "#2a2a38"], [0.3, "#161a2a"], [1, "#07090f"]],
  morning: [[0, "#e8d8c0"], [0.35, "#bcc6cf"], [1, "#8a9cb0"]],
};
const BG: Record<Look, string> = { dusk: "#3b3a4c", day: "#a9b3bc", night: "#0b0d14", morning: "#b9bfc4" };

/** 木（幹と、丸みのある葉のかたまり2〜3個）。葉は細かくしない（チラつき対策） */
const Tree: React.FC<{ x: number; z: number; s?: number; color?: string; seed?: number }> = ({ x, z, s = 1, color = "#34402c", seed = 0 }) => {
  const r = (k: number) => (Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453) % 1;
  return (
    <group position={[x, 0, z]} scale={s}>
      <mesh position={[0, 1.6, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.26, 3.2, 8]} />
        <meshStandardMaterial color="#2b2119" roughness={1} />
      </mesh>
      <mesh position={[0, 4.6, 0]} castShadow>
        <sphereGeometry args={[2.3, 14, 10]} />
        <meshStandardMaterial color={color} roughness={1} />
      </mesh>
      <mesh position={[1.1 + Math.abs(r(1)) * 0.4, 4.0, 0.4]} castShadow>
        <sphereGeometry args={[1.5, 12, 9]} />
        <meshStandardMaterial color={color} roughness={1} />
      </mesh>
      <mesh position={[-1.0, 4.2, -0.5 - Math.abs(r(2)) * 0.4]} castShadow>
        <sphereGeometry args={[1.6, 12, 9]} />
        <meshStandardMaterial color={color} roughness={1} />
      </mesh>
    </group>
  );
};

/** れんがの校舎：箱、窓（夜は一部だけ灯る）、平らな屋根の縁 */
const Hall: React.FC<{ x: number; z: number; w: number; d: number; h: number; rotY?: number; lit?: number; seed?: number }> = ({ x, z, w, d, h, rotY = 0, lit = 0, seed = 1 }) => {
  const wins = useMemo(() => {
    const out: { x: number; y: number; on: boolean }[] = [];
    for (let fy = 0; fy * 3.4 + 2.2 < h; fy++) {
      for (let k = 0; k * 2.8 + 1.6 < w; k++) {
        const v = Math.abs(Math.sin(seed * 31.7 + fy * 7.1 + k * 3.3));
        out.push({ x: -w / 2 + 1.6 + k * 2.8, y: 1.6 + fy * 3.4, on: v < lit });
      }
    }
    return out;
  }, [w, h, lit, seed]);
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <mesh position={[0, h / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[w, h, d]} />
        <BrickMaterial w={w} h={h} tint="#9a6e58" />
      </mesh>
      <mesh position={[0, h + 0.15, 0]}>
        <boxGeometry args={[w + 0.3, 0.3, d + 0.3]} />
        <meshStandardMaterial color="#c9c0b0" roughness={0.9} />
      </mesh>
      {wins.map((wd, i) => (
        <mesh key={i} position={[wd.x, wd.y, d / 2 + 0.04]}>
          <planeGeometry args={[1.3, 1.9]} />
          {wd.on ? (
            <meshStandardMaterial color="#000" emissive="#e8b072" emissiveIntensity={0.55} />
          ) : (
            <meshStandardMaterial color="#23272e" roughness={0.4} metalness={0.2} />
          )}
        </mesh>
      ))}
    </group>
  );
};

/** 大学の外灯（低い柱に丸い灯具）。on のときだけ光る。灯具は大きめ・暗めにして、ブルームが掛からないようにする */
const CampusLamp: React.FC<{ x: number; z: number; on: boolean }> = ({ x, z, on }) => {
  const light = useMemo(() => {
    const l = new THREE.PointLight("#ffd9a0", on ? 70 : 0, 16, 2);
    l.position.set(x, 3.3, z);
    return l;
  }, [x, z, on]);
  return (
    <group>
      {/* 柱は太め（細い柱はカメラが動くと画素の境目でちらつく） */}
      <mesh position={[x, 1.6, z]}>
        <cylinderGeometry args={[0.1, 0.12, 3.2, 10]} />
        <meshStandardMaterial color="#1d1d20" roughness={0.6} />
      </mesh>
      <mesh position={[x, 3.4, z]}>
        <sphereGeometry args={[0.24, 16, 12]} />
        <meshStandardMaterial color="#d8d2c4" emissive="#ffd9a0" emissiveIntensity={on ? 1.1 : 0} roughness={0.5} />
      </mesh>
      {on ? <primitive object={light} /> : null}
    </group>
  );
};

const Bench: React.FC<{ x: number; z: number; rotY?: number }> = ({ x, z, rotY = 0 }) => (
  <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
    <mesh position={[0, 0.45, 0]} castShadow>
      <boxGeometry args={[1.8, 0.08, 0.45]} />
      <meshStandardMaterial color="#5a4632" roughness={0.9} />
    </mesh>
    <mesh position={[0, 0.8, -0.2]} castShadow>
      <boxGeometry args={[1.8, 0.4, 0.06]} />
      <meshStandardMaterial color="#5a4632" roughness={0.9} />
    </mesh>
    {[-0.75, 0.75].map((dx) => (
      <mesh key={dx} position={[dx, 0.22, 0]}>
        <boxGeometry args={[0.08, 0.44, 0.4]} />
        <meshStandardMaterial color="#26262a" roughness={0.6} />
      </mesh>
    ))}
  </group>
);

/* ---------- 1. 大学の中庭 ---------- */

export const InsertCampus004: React.FC<SceneProps> = ({ variant = "a" }) => {
  const look: Look = variant === "b" ? "day" : variant === "d" || variant === "h" ? "night" : variant === "e" ? "morning" : variant === "c" ? "day" : "dusk";
  const night = look === "night";
  const cams: Record<string, [CamKey, CamKey]> = {
    a: [{ pos: [-14, 2.2, 22], target: [2, 3.5, -10], fov: 42 }, { pos: [-12.8, 2.2, 21], target: [2, 3.5, -10], fov: 41 }],
    // b：歩く人物は遠目に（脚の細い動きが明るい道の上で明滅と判定された：カメラを約14m離す）
    b: [{ pos: [7, 1.7, 15], target: [1.5, 1.3, 1], fov: 32 }, { pos: [6.4, 1.7, 14.6], target: [-2.5, 1.3, 1], fov: 32 }],
    c: [{ pos: [3.4, 0.8, 12.5], target: [0, 5.5, -12], fov: 40 }, { pos: [3.0, 0.8, 11.8], target: [0, 5.7, -12], fov: 39 }],
    d: [{ pos: [-8, 1.8, 16], target: [2, 2.6, -6], fov: 42 }, { pos: [-7.4, 1.8, 15.2], target: [2, 2.6, -6], fov: 41 }],
    e: [{ pos: [-6, 0.5, 16], target: [18, 4.0, -10], fov: 40 }, { pos: [-5.4, 0.5, 15.4], target: [18, 4.1, -10], fov: 39 }],
    g: [{ pos: [-5.2, 1.3, 9.8], target: [-7.5, 0.8, 5.2], fov: 38 }, { pos: [-5.0, 1.32, 9.4], target: [-7.5, 0.8, 5.2], fov: 37 }],
    h: [{ pos: [6, 9, 30], target: [0, 1.5, -2], fov: 40 }, { pos: [6.5, 9.6, 32], target: [0, 1.5, -2], fov: 41 }],
  };
  const [from, to] = cams[variant] ?? cams.a;
  // 歩く学生（b だけ）。毎秒1.15m、カメラの前を横切る（近づかない）
  const walk = useMemo(() => (t: number): [number, number, number] => [4.5 - t * 1.15, 0.02, 1.2], []);
  const sun = useMemo(() => {
    const l = new THREE.DirectionalLight(look === "dusk" ? "#f0b48a" : look === "morning" ? "#f2dcc0" : "#e6e8ea", look === "night" ? 0 : look === "dusk" ? 0.9 : 1.3);
    l.position.set(look === "dusk" ? -40 : 30, look === "dusk" ? 12 : 40, look === "dusk" ? 20 : 25);
    l.castShadow = true;
    l.shadow.mapSize.set(2048, 2048);
    const c = l.shadow.camera as THREE.OrthographicCamera;
    c.left = -40; c.right = 40; c.top = 40; c.bottom = -40; c.far = 200;
    return l;
  }, [look]);
  const hemi: [string, string, number] =
    look === "night" ? ["#6a7aa8", "#1c1a16", 1.1] : look === "dusk" ? ["#d8bcc4", "#4a4030", 1.5] : look === "morning" ? ["#e4e0d6", "#4a4638", 1.2] : ["#dfe3e6", "#4b4a40", 1.3];
  // 夜は月明かりと、図書館の正面を照らす投光（静止画1コマで大学と分かる明るさ：F-052）
  const moon = useMemo(() => {
    const l = new THREE.DirectionalLight("#9fb2dc", look === "night" ? 0.9 : 0);
    l.position.set(20, 30, 30);
    return l;
  }, [look]);
  const flood = useMemo(() => {
    const l = new THREE.SpotLight("#ffe2b8", look === "night" ? 260 : 0, 0, 0.55, 0.7, 1.6);
    l.position.set(0, 1.0, -2);
    l.target.position.set(0, 5, -16);
    return l;
  }, [look]);
  const lampsOn = night || look === "dusk";
  return (
    <Stage fog={night ? 0.014 : 0.01} exposure={night ? 1.3 : look === "dusk" ? 1.15 : 1.0} bloom={night ? 0.2 : 0.1} bg={BG[look]} hemi={hemi}>
      <Camera from={from} to={to} />
      <SkyDome stops={SKY[look]} />
      <primitive object={sun} />
      <primitive object={moon} />
      <primitive object={flood} />
      <primitive object={flood.target} />
      {/* 芝生と、交わる2本の道（太い帯。細い線にしない） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[240, 240]} />
        <meshStandardMaterial color={night ? "#2c3626" : "#4f5d3c"} roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 1.2]} receiveShadow>
        <planeGeometry args={[60, 2.6]} />
        <meshStandardMaterial color={night ? "#3a3936" : "#a9a395"} roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[0, 0.022, -4]} receiveShadow>
        <planeGeometry args={[40, 2.6]} />
        <meshStandardMaterial color={night ? "#3a3936" : "#a9a395"} roughness={0.95} />
      </mesh>
      {/* 校舎（奥と左右）。図書館は奥の中央で、柱と階段つき */}
      <Hall x={-22} z={-14} w={22} d={12} h={12} rotY={0.25} lit={night ? 0.45 : look === "dusk" ? 0.2 : 0} seed={3} />
      <Hall x={22} z={-12} w={20} d={12} h={11} rotY={-0.3} lit={night ? 0.4 : look === "dusk" ? 0.2 : 0} seed={7} />
      <Hall x={0} z={-22} w={26} d={12} h={14} lit={night ? 0.35 : look === "dusk" ? 0.15 : 0} seed={11} />
      {/* 図書館の入口：石の階段と4本の柱、重い木の扉 */}
      <group position={[0, 0, -15.9]}>
        {Array.from({ length: 6 }, (_, i) => (
          <mesh key={i} position={[0, 0.1 + i * 0.2, 2.6 - i * 0.42]} receiveShadow>
            <boxGeometry args={[10 - i * 0.1, 0.2, 0.7]} />
            <meshStandardMaterial color="#b8b2a6" roughness={0.95} />
          </mesh>
        ))}
        {[-3.3, -1.1, 1.1, 3.3].map((x) => (
          <mesh key={x} position={[x, 4.4, 0.2]} castShadow>
            <cylinderGeometry args={[0.38, 0.44, 6.4, 20]} />
            <meshStandardMaterial color="#cfc8ba" roughness={0.9} />
          </mesh>
        ))}
        <mesh position={[0, 7.9, 0.3]}>
          <boxGeometry args={[9.4, 0.9, 1.3]} />
          <meshStandardMaterial color="#cfc8ba" roughness={0.9} />
        </mesh>
        {/* 扉は校舎の窓（壁から 4cm）より前に置く。同じ深さだと重なった所が縞になる（F-001） */}
        <mesh position={[0, 2.6, 0.04]}>
          <planeGeometry args={[2.0, 3.2]} />
          <meshStandardMaterial color="#3a2618" roughness={0.7} emissive={night ? "#e8b072" : "#000"} emissiveIntensity={night ? 0.12 : 0} />
        </mesh>
      </group>
      {/* 大きな木 */}
      <Tree x={-9} z={-3} s={1.2} seed={1} color={night ? "#18200f" : look === "dusk" ? "#3b4128" : "#3e4c2e"} />
      <Tree x={10} z={-5} s={1.1} seed={2} color={night ? "#18200f" : look === "dusk" ? "#3b4128" : "#3e4c2e"} />
      <Tree x={-13} z={8} s={1.3} seed={3} color={night ? "#18200f" : look === "dusk" ? "#3b4128" : "#3e4c2e"} />
      <Tree x={14} z={10} s={1.25} seed={4} color={night ? "#18200f" : look === "dusk" ? "#3b4128" : "#3e4c2e"} />
      {/* 外灯とベンチ */}
      <CampusLamp x={-4} z={3.2} on={lampsOn} />
      <CampusLamp x={6} z={3.2} on={lampsOn} />
      <CampusLamp x={-6.2} z={-6} on={lampsOn} />
      <Bench x={-7.5} z={4.2} rotY={0.1} />
      <Bench x={7.5} z={4.2} rotY={-0.1} />
      {variant === "b" ? <Figure clip="Walk_Loop" path={walk} rotationY={-Math.PI / 2} glasses={false} build={BUNDY_STUDENT} /> : null}
    </Stage>
  );
};

/* ---------- 2. 夜の大学町の通り ---------- */

const House: React.FC<{ x: number; z: number; rotY: number; color: string; porch: boolean }> = ({ x, z, rotY, color, porch }) => {
  const roof = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-4.4, 0); s.lineTo(0, 2.6); s.lineTo(4.4, 0); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 9.4, bevelEnabled: false });
    g.translate(0, 0, -4.7);
    return g;
  }, []);
  const light = useMemo(() => {
    const l = new THREE.PointLight("#ffc98a", porch ? 30 : 0, 10, 2);
    l.position.set(0, 2.6, 5.2);
    return l;
  }, [porch]);
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <mesh position={[0, 2.6, 0]} castShadow receiveShadow>
        <boxGeometry args={[8, 5.2, 9]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      <mesh geometry={roof} position={[0, 5.2, 0]} castShadow>
        <meshStandardMaterial color="#2a2624" roughness={0.9} />
      </mesh>
      {/* ポーチの屋根と柱 */}
      <mesh position={[0, 3.0, 5.3]}>
        <boxGeometry args={[6, 0.2, 1.8]} />
        <meshStandardMaterial color="#d7d0c0" roughness={0.9} />
      </mesh>
      {[-2.8, 2.8].map((dx) => (
        <mesh key={dx} position={[dx, 1.5, 6.0]}>
          <boxGeometry args={[0.2, 3.0, 0.2]} />
          <meshStandardMaterial color="#d7d0c0" roughness={0.9} />
        </mesh>
      ))}
      {/* 窓（1つだけ暖かく灯る）と扉 */}
      <mesh position={[-2.2, 2.4, 4.52]}>
        <planeGeometry args={[1.4, 1.6]} />
        <meshStandardMaterial color="#000" emissive="#e0a46a" emissiveIntensity={porch ? 0.35 : 0.05} />
      </mesh>
      <mesh position={[2.2, 2.4, 4.52]}>
        <planeGeometry args={[1.4, 1.6]} />
        <meshStandardMaterial color="#1e2228" roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.2, 4.52]}>
        <planeGeometry args={[1.1, 2.3]} />
        <meshStandardMaterial color="#3a2a1e" roughness={0.7} />
      </mesh>
      {porch ? (
        <>
          <mesh position={[0, 2.75, 4.7]}>
            <sphereGeometry args={[0.12, 12, 8]} />
            <meshStandardMaterial color="#ddd" emissive="#ffc98a" emissiveIntensity={0.9} />
          </mesh>
          <primitive object={light} />
        </>
      ) : null}
    </group>
  );
};

export const InsertCollegeStreet004: React.FC<SceneProps> = ({ variant = "a" }) => {
  const cams: Record<string, [CamKey, CamKey]> = {
    a: [{ pos: [1.2, 1.6, 10], target: [-0.5, 2.0, -30], fov: 40 }, { pos: [1.2, 1.6, 8.6], target: [-0.5, 2.0, -32], fov: 39 }],
    b: [{ pos: [-2.5, 1.7, -36], target: [1.0, 2.2, 0], fov: 40 }, { pos: [-2.4, 1.7, -34.8], target: [1.0, 2.2, 2], fov: 39 }],
  };
  const [from, to] = cams[variant] ?? cams.a;
  const houses = [-2, -16, -30].flatMap((z, i) => [
    { x: -11, z, rotY: Math.PI / 2, color: ["#7d7468", "#6a6e72", "#8a7b62"][i], porch: i !== 1 },
    { x: 11, z: z - 6, rotY: -Math.PI / 2, color: ["#6f6a60", "#86786a", "#5f6670"][i], porch: i === 1 },
  ]);
  return (
    <Stage fog={0.022} exposure={1.25} bloom={0.25} bg="#0b0d14" hemi={["#6a7aa8", "#1c1a16", 1.0]}>
      <Camera from={from} to={to} />
      <SkyDome stops={SKY.night} />
      <directionalLight position={[-20, 30, 10]} intensity={0.7} color="#9fb2dc" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#1a2016" roughness={1} />
      </mesh>
      {/* 車道と歩道 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -15]} receiveShadow>
        <planeGeometry args={[7, 90]} />
        <meshStandardMaterial color="#1b1c1f" roughness={0.55} metalness={0.1} />
      </mesh>
      {[-5, 5].map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.02, -15]} receiveShadow>
          <planeGeometry args={[1.8, 90]} />
          <meshStandardMaterial color="#4a4843" roughness={0.95} />
        </mesh>
      ))}
      {houses.map((h, i) => (
        <House key={i} {...h} />
      ))}
      {[-8, -22, -36].map((z, i) => (
        <Tree key={z} x={i % 2 ? 6.5 : -6.5} z={z} s={1.25} seed={10 + i} color="#151b10" />
      ))}
      <StreetLamp x={4.2} z={-11} armDir={-1} intensity={900} shadow cone={false} />
      <StreetLamp x={-4.2} z={-27} armDir={1} intensity={700} cone={false} />
      <Car80s position={[2.4, 0, -19]} rotationY={Math.PI / 2} color="#4b5450" />
    </Stage>
  );
};

/* ---------- 3. 電話相談の部屋・選挙事務所（1970年代の室内） ---------- */

const Phone: React.FC<{ position: [number, number, number]; rotY?: number; color?: string }> = ({ position, rotY = 0, color = "#222326" }) => (
  <group position={position} rotation={[0, rotY, 0]} scale={1.3}>
    <mesh position={[0, 0.05, 0]} castShadow>
      <boxGeometry args={[0.22, 0.1, 0.24]} />
      <meshStandardMaterial color={color} roughness={0.45} />
    </mesh>
    <mesh position={[0, 0.105, 0.03]} rotation={[-Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.065, 0.065, 0.01, 20]} />
      <meshStandardMaterial color="#cfcac0" roughness={0.6} />
    </mesh>
    {/* 受話器（掛けたまま） */}
    <mesh position={[0, 0.14, -0.06]} rotation={[0, 0, Math.PI / 2]} castShadow>
      <capsuleGeometry args={[0.03, 0.16, 6, 10]} />
      <meshStandardMaterial color={color} roughness={0.45} />
    </mesh>
  </group>
);

const Desk: React.FC<{ x: number; z: number; w?: number; rotY?: number }> = ({ x, z, w = 1.5, rotY = 0 }) => (
  <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
    <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
      <boxGeometry args={[w, 0.05, 0.75]} />
      <meshStandardMaterial color="#5e4630" roughness={0.75} />
    </mesh>
    <mesh position={[w / 2 - 0.25, 0.37, 0]} castShadow>
      <boxGeometry args={[0.45, 0.72, 0.7]} />
      <meshStandardMaterial color="#4d3926" roughness={0.8} />
    </mesh>
    <mesh position={[-w / 2 + 0.04, 0.37, 0]}>
      <boxGeometry args={[0.05, 0.72, 0.7]} />
      <meshStandardMaterial color="#4d3926" roughness={0.8} />
    </mesh>
  </group>
);

const Paper: React.FC<{ position: [number, number, number]; rotY?: number; w?: number; d?: number; h?: number; color?: string }> = ({ position, rotY = 0, w = 0.22, d = 0.3, h = 0.004, color = "#e6e0d2" }) => (
  <mesh position={position} rotation={[0, rotY, 0]} castShadow receiveShadow>
    <boxGeometry args={[w, h, d]} />
    <meshStandardMaterial color={color} roughness={0.95} />
  </mesh>
);

const Room: React.FC<{ w: number; d: number; h: number; wall: string; floor: string; window?: boolean; night?: boolean }> = ({ w, d, h, wall, floor, window = true, night = true }) => (
  <group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial color={floor} roughness={0.85} />
    </mesh>
    <mesh position={[0, h, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial color="#d8d2c4" roughness={1} />
    </mesh>
    <mesh position={[0, h / 2, -d / 2]} receiveShadow>
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial color={wall} roughness={0.9} />
    </mesh>
    <mesh position={[-w / 2, h / 2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
      <planeGeometry args={[d, h]} />
      <meshStandardMaterial color={wall} roughness={0.9} />
    </mesh>
    <mesh position={[w / 2, h / 2, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
      <planeGeometry args={[d, h]} />
      <meshStandardMaterial color={wall} roughness={0.9} />
    </mesh>
    {window ? (
      <mesh position={[w / 2 - 0.02, h * 0.55, -d / 4]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[2.4, 1.5]} />
        <meshStandardMaterial color="#000" emissive={night ? "#1e2a44" : "#cfd8e2"} emissiveIntensity={night ? 0.6 : 0.8} />
      </mesh>
    ) : null}
  </group>
);

export const InsertHotline004: React.FC<SceneProps> = ({ variant = "a" }) => {
  const cams: Record<string, [CamKey, CamKey]> = {
    a: [{ pos: [1.3, 1.35, 0.6], target: [-0.6, 0.8, -1.3], fov: 40 }, { pos: [1.2, 1.32, 0.45], target: [-0.6, 0.8, -1.3], fov: 39 }],
    b: [{ pos: [-2.4, 1.3, 2.4], target: [0.6, 0.8, -1.4], fov: 40 }, { pos: [-2.2, 1.28, 2.2], target: [0.6, 0.8, -1.4], fov: 39 }],
  };
  const [from, to] = cams[variant] ?? cams.a;
  const desks = [-1.6, 0.4];
  const lamps = useMemo(
    () =>
      desks.map((x) => {
        const l = new THREE.PointLight("#ffd29a", 6, 5, 2);
        l.position.set(x + 0.4, 1.25, -1.2);
        return l;
      }),
    [],
  );
  return (
    <Stage fog={0.01} exposure={1.15} bloom={0.1} bg="#0d0c0b" hemi={["#8a8e9a", "#2a2018", 0.8]}>
      <Camera from={from} to={to} />
      <Room w={7} d={6} h={2.8} wall="#6d5a44" floor="#3e352c" />
      {desks.map((x, i) => (
        <group key={x}>
          <Desk x={x} z={-1.2} w={1.7} />
          <Phone position={[x - 0.3, 0.765, -1.25]} rotY={0.2} color={i ? "#2c2b29" : "#3b3a36"} />
          <Phone position={[x + 0.25, 0.765, -1.35]} rotY={-0.15} color="#222326" />
          <Paper position={[x - 0.55, 0.77, -1.0]} rotY={0.3} color="#e8e1c8" />
          <Paper position={[x + 0.05, 0.77, -0.98]} rotY={-0.2} />
          {/* 卓上の灯り（笠） */}
          <mesh position={[x + 0.55, 1.05, -1.4]}>
            <coneGeometry args={[0.16, 0.18, 18, 1, true]} />
            <meshStandardMaterial color="#3a4a3a" roughness={0.6} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[x + 0.55, 0.9, -1.4]}>
            <cylinderGeometry args={[0.015, 0.015, 0.3, 8]} />
            <meshStandardMaterial color="#222" />
          </mesh>
          <primitive object={lamps[i]} />
        </group>
      ))}
      {/* 椅子（空） */}
      {desks.map((x) => (
        <mesh key={`c${x}`} position={[x - 0.1, 0.45, -0.55]} castShadow>
          <boxGeometry args={[0.45, 0.06, 0.45]} />
          <meshStandardMaterial color="#2c2a28" roughness={0.7} />
        </mesh>
      ))}
      {/* 壁の掲示板（文字のない紙） */}
      <mesh position={[-1.0, 1.7, -2.97]}>
        <planeGeometry args={[1.6, 0.9]} />
        <meshStandardMaterial color="#8a6a46" roughness={1} />
      </mesh>
      {[[-1.4, 1.8], [-0.9, 1.6], [-0.5, 1.85]].map(([x, y], i) => (
        <mesh key={i} position={[x, y, -2.96]}>
          <planeGeometry args={[0.3, 0.38]} />
          <meshStandardMaterial color="#e6e0d0" roughness={1} />
        </mesh>
      ))}
    </Stage>
  );
};

const Typewriter: React.FC<{ position: [number, number, number]; rotY?: number }> = ({ position, rotY = 0 }) => (
  <group position={position} rotation={[0, rotY, 0]}>
    <mesh position={[0, 0.06, 0]} castShadow>
      <boxGeometry args={[0.46, 0.12, 0.36]} />
      <meshStandardMaterial color="#2f3532" roughness={0.5} />
    </mesh>
    <mesh position={[0, 0.15, -0.1]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.035, 0.035, 0.5, 14]} />
      <meshStandardMaterial color="#1a1a1a" roughness={0.5} />
    </mesh>
    <mesh position={[0, 0.22, -0.12]} rotation={[-0.3, 0, 0]}>
      <boxGeometry args={[0.26, 0.16, 0.004]} />
      <meshStandardMaterial color="#ebe6d8" roughness={1} />
    </mesh>
  </group>
);

export const InsertCampaign004: React.FC<SceneProps> = ({ variant = "a" }) => {
  const cams: Record<string, [CamKey, CamKey]> = {
    a: [{ pos: [2.8, 1.6, 3.0], target: [-0.4, 0.9, -1.0], fov: 42 }, { pos: [2.6, 1.55, 2.75], target: [-0.4, 0.9, -1.0], fov: 41 }],
    b: [{ pos: [-2.6, 1.45, 1.8], target: [0.4, 0.85, -0.8], fov: 40 }, { pos: [-2.45, 1.42, 1.62], target: [0.4, 0.85, -0.8], fov: 39 }],
  };
  const [from, to] = cams[variant] ?? cams.a;
  const stacks = useMemo(() => Array.from({ length: 7 }, (_, i) => ({ x: -1.6 + (i % 4) * 0.42, z: -1.0 + Math.floor(i / 4) * 0.4, h: 0.06 + ((i * 37) % 5) * 0.03 })), []);
  return (
    <Stage fog={0.006} exposure={1.1} bloom={0.08} bg="#1a1712" hemi={["#f4ecd8", "#4a3e2c", 1.5]}>
      <Camera from={from} to={to} />
      <Room w={8} d={7} h={2.9} wall="#b8ab90" floor="#5a4e40" window={false} />
      {/* 天井の蛍光灯（2本） */}
      {[-1.2, 1.2].map((x) => (
        <group key={x}>
          <mesh position={[x, 2.86, -0.8]}>
            <boxGeometry args={[0.3, 0.06, 1.4]} />
            <meshStandardMaterial color="#eee" emissive="#fff6e6" emissiveIntensity={0.7} />
          </mesh>
          <pointLight position={[x, 2.6, -0.8]} intensity={9} distance={7} decay={2} color="#fff2dc" />
        </group>
      ))}
      {/* 右の壁の窓（昼。枠と桟は太く） */}
      <group position={[3.98, 1.65, -1.6]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh>
          <planeGeometry args={[2.2, 1.4]} />
          <meshStandardMaterial color="#000" emissive="#b8c8d8" emissiveIntensity={0.45} />
        </mesh>
        {[-1.1, 0, 1.1].map((x) => (
          <mesh key={x} position={[x, 0, 0.02]}>
            <boxGeometry args={[0.09, 1.5, 0.05]} />
            <meshStandardMaterial color="#e6e0d2" roughness={0.8} />
          </mesh>
        ))}
        {[-0.7, 0.7].map((y) => (
          <mesh key={y} position={[0, y, 0.02]}>
            <boxGeometry args={[2.3, 0.09, 0.05]} />
            <meshStandardMaterial color="#e6e0d2" roughness={0.8} />
          </mesh>
        ))}
      </group>
      {/* 長机と、積んだ白いビラ（文字なし） */}
      <mesh position={[-0.9, 0.74, -0.8]} castShadow receiveShadow>
        <boxGeometry args={[2.8, 0.05, 1.0]} />
        <meshStandardMaterial color="#8b8478" roughness={0.7} />
      </mesh>
      {[-2.2, 0.4].map((x) => (
        <mesh key={x} position={[x, 0.37, -0.8]}>
          <boxGeometry args={[0.06, 0.72, 0.9]} />
          <meshStandardMaterial color="#3c3a36" roughness={0.6} />
        </mesh>
      ))}
      {stacks.map((s, i) => (
        <Paper key={i} position={[s.x, 0.765 + s.h / 2, s.z]} rotY={(i % 3) * 0.08 - 0.08} w={0.3} d={0.4} h={s.h} color="#ece7da" />
      ))}
      <Typewriter position={[0.0, 0.765, -0.7]} rotY={-0.4} />
      <Phone position={[-0.4, 0.765, -1.1]} rotY={0.3} color="#2c2b29" />
      {/* 壁に立てかけた、文字のない看板（白地に色の帯） */}
      {[-2.6, -1.2, 0.2].map((x, i) => (
        <group key={x} position={[x, 1.55, -3.44]}>
          <mesh>
            <planeGeometry args={[1.2, 0.8]} />
            <meshStandardMaterial color="#efeae0" roughness={1} />
          </mesh>
          <mesh position={[0, -0.25, 0.005]}>
            <planeGeometry args={[1.2, 0.14]} />
            <meshStandardMaterial color={["#3d5a80", "#6b4a3a", "#3d5a80"][i]} roughness={1} />
          </mesh>
        </group>
      ))}
      {/* 床に置いた段ボール箱 */}
      {[[1.6, -2.2], [2.1, -2.4], [1.85, -1.8]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.22 + (i === 2 ? 0.44 : 0), z]} castShadow>
          <boxGeometry args={[0.55, 0.44, 0.45]} />
          <meshStandardMaterial color="#a08060" roughness={0.95} />
        </mesh>
      ))}
    </Stage>
  );
};

/* ---------- 4. 夏の湖畔の公園の駐車場・止めた車の中 ---------- */

/** 腕のつり布（三角の布と、首にかける帯）。白っぽい布 */
const Sling: React.FC<{ position: [number, number, number]; rotation?: [number, number, number]; scale?: number }> = ({ position, rotation = [0, 0, 0], scale = 1 }) => {
  // 三角の布（腕を受ける袋の形）と、布の両端から出て輪になる帯（首にかける）。平らに置いた形
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-0.3, 0); s.quadraticCurveTo(0, -0.07, 0.3, 0); s.lineTo(0.02, 0.3); s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2 });
  }, []);
  const strap = useMemo(() => {
    const pts = [
      new THREE.Vector3(-0.27, 0.02, 0.02), new THREE.Vector3(-0.38, 0.22, 0.02), new THREE.Vector3(-0.3, 0.5, 0.02),
      new THREE.Vector3(0.0, 0.62, 0.02), new THREE.Vector3(0.22, 0.48, 0.02), new THREE.Vector3(0.04, 0.3, 0.02),
    ];
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.022, 8, false);
  }, []);
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh geometry={geo} castShadow>
        <meshStandardMaterial color="#e6e1d4" roughness={1} />
      </mesh>
      <mesh geometry={strap} scale={[1, 1, 0.5]} castShadow>
        <meshStandardMaterial color="#d8d1c0" roughness={1} />
      </mesh>
    </group>
  );
};

const LAKE_CARS: { x: number; z: number; color: string; wagon?: boolean }[] = [
  { x: -6, z: 0, color: "#6a4a2c", wagon: true },
  { x: 0, z: 0, color: "#9a7a52" }, // 明るい茶色の小さな車（つり布の車）
  { x: 9, z: 0, color: "#3e4a5a" },
  { x: -3, z: 9, color: "#7a6a40" },
];

export const InsertLakePark004: React.FC<SceneProps> = ({ variant = "a" }) => {
  const late = variant === "c";
  const cams: Record<string, [CamKey, CamKey]> = {
    a: [{ pos: [-18, 3.2, 20], target: [4, 1.2, -6], fov: 40 }, { pos: [-17, 3.2, 19], target: [4, 1.2, -6], fov: 39 }],
    b: [{ pos: [0.6, 1.35, 4.6], target: [0.2, 1.0, 0.2], fov: 34 }, { pos: [0.35, 1.33, 4.35], target: [0.1, 1.0, 0.2], fov: 33 }],
    c: [{ pos: [22, 4.0, 26], target: [-2, 1.0, -2], fov: 34 }, { pos: [21, 4.0, 25.2], target: [-2, 1.0, -2], fov: 33 }],
  };
  const [from, to] = cams[variant] ?? cams.a;
  const sun = useMemo(() => {
    const l = new THREE.DirectionalLight(late ? "#f3c08e" : "#fff4e0", late ? 1.3 : 1.7);
    l.position.set(late ? -50 : 25, late ? 14 : 45, late ? 10 : 20);
    l.castShadow = true;
    l.shadow.mapSize.set(2048, 2048);
    const c = l.shadow.camera as THREE.OrthographicCamera;
    c.left = -40; c.right = 40; c.top = 40; c.bottom = -40; c.far = 200;
    return l;
  }, [late]);
  const cars = late ? LAKE_CARS.filter((c) => c.color === "#9a7a52" || c.color === "#3e4a5a") : LAKE_CARS;
  return (
    <Stage fog={0.006} exposure={1.0} bloom={0.08} bg={late ? "#c4a98c" : "#b9c6cf"} hemi={late ? ["#e8c8a8", "#4a4030", 0.9] : ["#e6edf2", "#4f5a3c", 1.3]}>
      <Camera from={from} to={to} />
      <SkyDome stops={late ? [[0, "#f0c49a"], [0.3, "#c9b0a4"], [1, "#7c8aa4"]] : [[0, "#e6ecef"], [0.4, "#b8c9d8"], [1, "#7f9cbc"]]} />
      <primitive object={sun} />
      {/* 芝生と、駐車場（線は太く少なく） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial color="#5d6b3e" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[1, 0.01, 4]} receiveShadow>
        <planeGeometry args={[34, 18]} />
        <meshStandardMaterial color="#4a4946" roughness={0.9} />
      </mesh>
      {[-3.0, 3.0, 6.2].map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.025, 0]}>
          <planeGeometry args={[0.16, 2.8]} />
          <meshStandardMaterial color="#c8c4b6" roughness={1} />
        </mesh>
      ))}
      {/* 湖（動かさない水面）と、向こう岸の丘 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, -60]}>
        <planeGeometry args={[400, 90]} />
        <meshStandardMaterial color={late ? "#7d8a94" : "#6f8ea4"} roughness={0.25} metalness={0.3} />
      </mesh>
      <mesh position={[0, 4, -110]} scale={[1, 0.25, 1]}>
        <sphereGeometry args={[70, 24, 12]} />
        <meshStandardMaterial color="#47563a" roughness={1} />
      </mesh>
      {/* 木々（駐車場のまわり）と、ピクニックテーブル */}
      {[-16, -11, 13, 18, -20, 21].map((x, i) => (
        <Tree key={x} x={x} z={i < 4 ? -9 : 6} s={1.3} seed={20 + i} color={late ? "#47502e" : "#3f5228"} />
      ))}
      {[[-12, 12], [14, 14]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.75, 0]} castShadow>
            <boxGeometry args={[1.9, 0.07, 0.8]} />
            <meshStandardMaterial color="#6a5038" roughness={0.9} />
          </mesh>
          {[-0.75, 0.75].map((dx) => (
            <mesh key={`l${dx}`} position={[dx, 0.38, 0]} castShadow>
              <boxGeometry args={[0.08, 0.74, 1.3]} />
              <meshStandardMaterial color="#5a4430" roughness={0.9} />
            </mesh>
          ))}
          {[-0.6, 0.6].map((dz) => (
            <mesh key={dz} position={[0, 0.45, dz]} castShadow>
              <boxGeometry args={[1.9, 0.06, 0.28]} />
              <meshStandardMaterial color="#6a5038" roughness={0.9} />
            </mesh>
          ))}
        </group>
      ))}
      {cars.map((c, i) => (
        <Car80s key={i} position={[c.x, 0, c.z]} rotationY={0} color={c.color} wagon={c.wagon} />
      ))}
    </Stage>
  );
};

/** 当時の車の中（ダッシュボード、2つの前の座席、窓の外は夏の公園） */
export const InsertCarSeat004: React.FC<SceneProps> = ({ variant = "a" }) => {
  const cams: Record<string, [CamKey, CamKey]> = {
    a: [{ pos: [-0.22, 1.18, 0.02], target: [0.4, 0.55, 0.05], fov: 58 }, { pos: [-0.2, 1.16, 0.0], target: [0.4, 0.55, 0.05], fov: 57 }], // 運転席の側から、助手席
    b: [{ pos: [0.3, 1.12, -0.5], target: [0.3, 0.6, 0.4], fov: 56 }, { pos: [0.3, 1.11, -0.45], target: [0.3, 0.6, 0.4], fov: 55 }], // 前の窓の側から振り返って、助手席と後ろの座席
  };
  const [from, to] = cams[variant] ?? cams.a;
  const seat = (x: number) => (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 0.5, 0.05]} castShadow receiveShadow>
        <boxGeometry args={[0.5, 0.14, 0.52]} />
        <meshStandardMaterial color="#6b5a44" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.85, 0.32]} rotation={[-0.18, 0, 0]} castShadow>
        <boxGeometry args={[0.5, 0.62, 0.12]} />
        <meshStandardMaterial color="#6b5a44" roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.22, 0.4]} castShadow>
        <boxGeometry args={[0.3, 0.16, 0.1]} />
        <meshStandardMaterial color="#6b5a44" roughness={0.85} />
      </mesh>
    </group>
  );
  return (
    <Stage fog={0.004} exposure={1.0} bloom={0.08} bg="#c8d2c8" hemi={["#eef2ec", "#4a4436", 1.1]}>
      <Camera from={from} to={to} />
      {/* 窓の外：明るい夏の公園（遠い板の緑と空）。窓ガラスは描かない */}
      <mesh position={[0, 1.6, -12]}>
        <planeGeometry args={[60, 10]} />
        <meshBasicMaterial color="#a9bfd0" fog={false} />
      </mesh>
      <mesh position={[0, 0.8, -11]}>
        <planeGeometry args={[60, 3]} />
        <meshBasicMaterial color="#6d7f4e" fog={false} />
      </mesh>
      <mesh position={[8, 1.0, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[40, 6]} />
        <meshBasicMaterial color="#7a8c58" fog={false} />
      </mesh>
      <directionalLight position={[3, 4, -2]} intensity={1.4} color="#fff2dc" castShadow />
      {/* 床・天井・ダッシュボード・扉の内側 */}
      <mesh position={[0, 0.3, 0]} receiveShadow>
        <boxGeometry args={[1.5, 0.05, 2.6]} />
        <meshStandardMaterial color="#3a332a" roughness={1} />
      </mesh>
      <mesh position={[0, 1.42, 0.2]}>
        <boxGeometry args={[1.5, 0.04, 2.4]} />
        <meshStandardMaterial color="#cfc6b2" roughness={1} />
      </mesh>
      <mesh position={[0, 0.8, -0.75]} castShadow>
        <boxGeometry args={[1.5, 0.28, 0.4]} />
        <meshStandardMaterial color="#4a3e30" roughness={0.7} />
      </mesh>
      <mesh position={[-0.38, 0.98, -0.6]} rotation={[-1.0, 0, 0]}>
        <torusGeometry args={[0.17, 0.022, 8, 28]} />
        <meshStandardMaterial color="#1c1a18" roughness={0.5} />
      </mesh>
      {/* 窓の枠（太い柱だけ） */}
      {[-0.72, 0.72].map((x) => (
        <mesh key={x} position={[x, 1.15, -0.6]} rotation={[0.4, 0, 0]}>
          <boxGeometry args={[0.07, 0.65, 0.07]} />
          <meshStandardMaterial color="#5c5040" roughness={0.8} />
        </mesh>
      ))}
      {[-0.74, 0.74].map((x) => (
        <mesh key={`d${x}`} position={[x, 0.62, 0.2]}>
          <boxGeometry args={[0.04, 0.6, 2.2]} />
          <meshStandardMaterial color="#6b5a44" roughness={0.85} />
        </mesh>
      ))}
      {seat(-0.36)}
      {seat(0.36)}
      {/* 後ろの座席と、後ろの窓の外（明るい公園） */}
      <mesh position={[0, 0.5, 1.05]} castShadow receiveShadow>
        <boxGeometry args={[1.4, 0.14, 0.5]} />
        <meshStandardMaterial color="#6b5a44" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.82, 1.3]} rotation={[-0.15, 0, 0]} castShadow>
        <boxGeometry args={[1.4, 0.55, 0.12]} />
        <meshStandardMaterial color="#6b5a44" roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.2, 1.42]} rotation={[0.5, 0, 0]}>
        <planeGeometry args={[1.3, 0.4]} />
        <meshBasicMaterial color="#b9cbd6" side={THREE.DoubleSide} fog={false} />
      </mesh>
      {/* 助手席の腕のつり布と、畳んだ上着 */}
      <Sling position={[0.3, 0.58, 0.02]} rotation={[-Math.PI / 2 + 0.15, 0, 0.3]} scale={0.85} />
      <mesh position={[0.46, 0.6, 0.2]} rotation={[0, 0.3, 0]} castShadow>
        <boxGeometry args={[0.24, 0.06, 0.34]} />
        <meshStandardMaterial color="#3b4048" roughness={0.95} />
      </mesh>
    </Stage>
  );
};

/* ---------- 5. 夜のショッピングモールの駐車場 ---------- */

export const InsertMall004: React.FC<SceneProps> = ({ variant = "a" }) => {
  const cams: Record<string, [CamKey, CamKey]> = {
    a: [{ pos: [-8, 2.4, 20], target: [2, 2.4, -12], fov: 42 }, { pos: [-7.4, 2.4, 19.2], target: [2, 2.4, -12], fov: 41 }],
    b: [{ pos: [-5.5, 1.5, 9.5], target: [1.0, 0.8, 2.4], fov: 36 }, { pos: [-5.2, 1.5, 9.1], target: [1.0, 0.8, 2.4], fov: 35 }],
  };
  const [from, to] = cams[variant] ?? cams.a;
  const glow = useMemo(() => {
    const l = new THREE.RectAreaLight("#ffe8c4", 6, 16, 2.2);
    l.position.set(0, 2.2, -11.6);
    l.lookAt(0, 0, 10);
    return l;
  }, []);
  return (
    <Stage fog={0.007} exposure={1.3} bloom={0.2} bg="#0b0d14" hemi={["#7a8ab8", "#24201a", 1.2]}>
      <Camera from={from} to={to} />
      <SkyDome stops={SKY.night} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial color="#1c1d20" roughness={0.6} metalness={0.1} />
      </mesh>
      {/* 平屋の長い建物（コンクリートとれんがの帯、入口のガラス戸の光。看板は文字のない暗い板） */}
      <mesh position={[0, 3, -16]} receiveShadow>
        <boxGeometry args={[70, 6, 8]} />
        <meshStandardMaterial color="#a49a8a" roughness={0.95} />
      </mesh>
      <mesh position={[0, 1.2, -11.95]}>
        <boxGeometry args={[70, 2.4, 0.1]} />
        <BrickMaterial w={70} h={2.4} tint="#8a6a58" />
      </mesh>
      {/* 店の並び（ガラスの正面。文字なし）と、張り出した庇 */}
      {[-24, -12, 0, 12, 24].map((x, i) => (
        <Storefront key={x} position={[x, 1.45, -11.82]} w={i === 2 ? 8 : 7} h={2.4} glow={i === 2 ? 0.3 : 0.18} curtain="#2c3038" />
      ))}
      <mesh position={[0, 3.05, -10.9]} castShadow>
        <boxGeometry args={[70, 0.25, 2.0]} />
        <meshStandardMaterial color="#9a9286" roughness={0.9} />
      </mesh>
      {[-20, 20].map((x) => (
        <mesh key={x} position={[x, 4.6, -11.85]}>
          <planeGeometry args={[9, 1.2]} />
          <meshStandardMaterial color="#2a2c32" roughness={0.6} />
        </mesh>
      ))}
      <primitive object={glow} />
      <directionalLight position={[-20, 30, 20]} intensity={0.5} color="#9fb2dc" />
      {/* 駐車場の灯り（ナトリウム灯）と、止まった車 */}
      {/* 車は街灯の真下に置かない（強く照らされた縁がにじんで揺れる） */}
      <StreetLamp x={6.5} z={3.5} armDir={-1} intensity={900} shadow cone={false} />
      <StreetLamp x={-18} z={-2} armDir={1} intensity={800} cone={false} />
      <StreetLamp x={20} z={8} armDir={-1} intensity={800} />
      <Car80s position={[0.6, 0, 2.6]} rotationY={Math.PI / 2 + 0.05} color="#bcae90" />
      <Car80s position={[-14, 0, -3]} rotationY={Math.PI / 2} color="#3a3c40" />
      <Car80s position={[16, 0, 4]} rotationY={-Math.PI / 2} color="#5a4636" wagon />
    </Stage>
  );
};

/* ---------- 6. 雪の小さな町の郡の建物（夜） ---------- */

export const InsertWinterJail004: React.FC<SceneProps> = ({ variant = "a" }) => {
  const cams: Record<string, [CamKey, CamKey]> = {
    a: [{ pos: [-7, 1.7, 11], target: [1, 3.4, -6], fov: 42 }, { pos: [-6.6, 1.7, 10.4], target: [1, 3.5, -6], fov: 41 }],
  };
  const [from, to] = cams[variant] ?? cams.a;
  const wins = useMemo(() => Array.from({ length: 10 }, (_, i) => ({ x: -7.2 + (i % 5) * 3.6, y: i < 5 ? 2.2 : 5.6, on: i === 1 || i === 7 })), []);
  return (
    <Stage fog={0.008} exposure={1.25} bloom={0.15} bg="#0d1018" hemi={["#7888b8", "#3a3a40", 1.3]}>
      <directionalLight position={[25, 35, 20]} intensity={0.8} color="#a6b6dc" />
      <Camera from={from} to={to} />
      <SkyDome stops={[[0, "#3a3e52"], [0.3, "#22283a"], [1, "#0c0f1a"]]} />
      {/* 雪の地面と、遠い山の影 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial color="#c9ced8" roughness={1} />
      </mesh>
      <mesh position={[-30, 0, -120]} scale={[1, 0.45, 1]}>
        <sphereGeometry args={[60, 20, 10]} />
        <meshStandardMaterial color="#2a3040" roughness={1} />
      </mesh>
      <mesh position={[50, 0, -130]} scale={[1, 0.5, 1]}>
        <sphereGeometry args={[55, 20, 10]} />
        <meshStandardMaterial color="#323848" roughness={1} />
      </mesh>
      {/* れんがの2階建て。窓の鉄格子は太く少なく */}
      <mesh position={[0, 3.8, -8]} castShadow receiveShadow>
        <boxGeometry args={[20, 7.6, 10]} />
        <BrickMaterial w={20} h={7.6} tint="#b08470" />
      </mesh>
      <mesh position={[0, 7.75, -8]}>
        <boxGeometry args={[20.4, 0.3, 10.4]} />
        <meshStandardMaterial color="#e2e6ee" roughness={1} />
      </mesh>
      {wins.map((w, i) => (
        <group key={i} position={[w.x, w.y, -2.96]}>
          <mesh>
            <planeGeometry args={[1.3, 1.7]} />
            <meshStandardMaterial color="#000" emissive={w.on ? "#d9a868" : "#0e1018"} emissiveIntensity={w.on ? 0.4 : 0.1} />
          </mesh>
          {[-0.36, 0, 0.36].map((dx) => (
            <mesh key={dx} position={[dx, 0, 0.04]}>
              <boxGeometry args={[0.07, 1.7, 0.05]} />
              <meshStandardMaterial color="#1a1a1e" roughness={0.6} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[0, 1.3, -2.94]}>
        <planeGeometry args={[1.6, 2.6]} />
        <meshStandardMaterial color="#3a2e26" roughness={0.7} />
      </mesh>
      {/* 入口の上の灯り（壁を照らす） */}
      <mesh position={[0, 2.95, -2.8]}>
        <boxGeometry args={[0.5, 0.18, 0.3]} />
        <meshStandardMaterial color="#ddd" emissive="#ffd9a0" emissiveIntensity={0.8} />
      </mesh>
      <spotLight position={[0, 3.3, -1.6]} angle={1.0} penumbra={0.8} intensity={60} distance={14} decay={2} color="#ffd9a0" />
      {/* 雪の吹きだまり（なめらかな形） */}
      {[[-6, 1.5], [5, 2.5], [10, 0.5]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0, z]} scale={[2.4, 0.5, 1.4]}>
          <sphereGeometry args={[1, 16, 10]} />
          <meshStandardMaterial color="#d6dbe4" roughness={1} />
        </mesh>
      ))}
      <StreetLamp x={-6} z={3} armDir={1} intensity={320} shadow cone={false} />
      <StreetLamp x={9} z={3} armDir={-1} intensity={260} cone={false} />
    </Stage>
  );
};

/* ---------- 7. 法廷（1979年）と連邦裁判所の法廷（1987年） ---------- */

const TvCamera: React.FC<{ position: [number, number, number]; rotY?: number }> = ({ position, rotY = 0 }) => (
  <group position={position} rotation={[0, rotY, 0]}>
    {/* 三脚（太めの脚） */}
    {[0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((a) => (
      <mesh key={a} position={[Math.sin(a) * 0.22, 0.62, Math.cos(a) * 0.22]} rotation={[Math.cos(a) * 0.32, 0, -Math.sin(a) * 0.32]}>
        <cylinderGeometry args={[0.025, 0.025, 1.3, 8]} />
        <meshStandardMaterial color="#2a2a2c" roughness={0.5} />
      </mesh>
    ))}
    <mesh position={[0, 1.38, 0]} castShadow>
      <boxGeometry args={[0.34, 0.36, 0.62]} />
      <meshStandardMaterial color="#4a4c50" roughness={0.45} />
    </mesh>
    <mesh position={[0, 1.4, -0.42]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.1, 0.12, 0.3, 20]} />
      <meshStandardMaterial color="#1c1c1e" roughness={0.4} />
    </mesh>
    <mesh position={[0, 1.62, 0.05]}>
      <boxGeometry args={[0.2, 0.12, 0.26]} />
      <meshStandardMaterial color="#38393c" roughness={0.5} />
    </mesh>
  </group>
);

const Chair: React.FC<{ position: [number, number, number]; rotY?: number }> = ({ position, rotY = 0 }) => (
  <group position={position} rotation={[0, rotY, 0]}>
    <mesh position={[0, 0.47, 0]} castShadow>
      <boxGeometry args={[0.5, 0.08, 0.5]} />
      <meshStandardMaterial color="#3e2a1e" roughness={0.7} />
    </mesh>
    <mesh position={[0, 0.9, 0.22]} castShadow>
      <boxGeometry args={[0.5, 0.75, 0.07]} />
      <meshStandardMaterial color="#3e2a1e" roughness={0.7} />
    </mesh>
  </group>
);

const Court: React.FC<{ variant: string; fed: boolean }> = ({ variant, fed }) => {
  const wood = fed ? "#8a6a48" : "#5a3e2a";
  const wall = fed ? "#c9bea8" : "#8e7a62";
  const cams: Record<string, [CamKey, CamKey]> = fed
    ? {
        a: [{ pos: [3.5, 1.8, 7.5], target: [-0.5, 1.4, -5], fov: 44 }, { pos: [3.2, 1.8, 7.0], target: [-0.5, 1.4, -5], fov: 43 }],
        b: [{ pos: [-1.2, 1.25, -1.0], target: [-3.6, 1.0, -3.6], fov: 38 }, { pos: [-1.1, 1.24, -1.15], target: [-3.6, 1.0, -3.6], fov: 37 }],
        c: [{ pos: [1.6, 1.4, 1.4], target: [0, 1.6, -5.2], fov: 40 }, { pos: [1.5, 1.38, 1.2], target: [0, 1.6, -5.2], fov: 39 }],
      }
    : {
        a: [{ pos: [-2.8, 1.75, 4.6], target: [0.4, 1.25, -3.0], fov: 44 }, { pos: [-2.6, 1.75, 4.2], target: [0.4, 1.25, -3.0], fov: 43 }],
        b: [{ pos: [0.2, 2.0, 9.5], target: [0, 1.5, -5], fov: 46 }, { pos: [0.2, 2.0, 9.0], target: [0, 1.5, -5], fov: 45 }],
        c: [{ pos: [4.6, 1.6, 4.3], target: [3.2, 1.3, 2.4], fov: 38 }, { pos: [4.5, 1.58, 4.1], target: [3.2, 1.3, 2.4], fov: 37 }],
        d: [{ pos: [0.5, 1.5, 0.5], target: [4.2, 1.0, -2.2], fov: 42 }, { pos: [0.45, 1.48, 0.3], target: [4.2, 1.0, -2.2], fov: 41 }],
        e: [{ pos: [0.3, 1.0, 0.2], target: [0, 2.3, -5], fov: 44 }, { pos: [0.3, 1.0, 0.0], target: [0, 2.35, -5], fov: 43 }],
        g: [{ pos: [-0.6, 1.45, 1.45], target: [-1.65, 0.78, 0.82], fov: 38 }, { pos: [-0.62, 1.43, 1.36], target: [-1.65, 0.78, 0.82], fov: 37 }],
      };
  const [from, to] = cams[variant] ?? cams.a;
  const ceiling = useMemo(() => {
    const l = new THREE.SpotLight(fed ? "#f4efe4" : "#f2dcb8", fed ? 30 : 38, 0, 1.1, 0.8, 1.4);
    l.position.set(0, 4.6, 1);
    l.target.position.set(0, 0, -1);
    l.castShadow = true;
    l.shadow.mapSize.set(1024, 1024);
    return l;
  }, [fed]);
  const sun = useMemo(() => {
    const l = new THREE.SpotLight("#e6ecf4", fed ? 40 : 0, 0, 0.7, 0.8, 1.2);
    l.position.set(6.5, 3.4, -2);
    l.target.position.set(-1, 0, -2);
    return l;
  }, [fed]);
  return (
    <>
      <Camera from={from} to={to} />
      {/* 床・壁・天井 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[14, 22]} />
        <meshStandardMaterial color={fed ? "#6a5e50" : "#4a3a2e"} roughness={0.8} />
      </mesh>
      <mesh position={[0, 2.5, -6]} receiveShadow>
        <planeGeometry args={[14, 5]} />
        <meshStandardMaterial color={wall} roughness={0.9} />
      </mesh>
      {[-7, 7].map((x) => (
        <mesh key={x} position={[x, 2.5, 2]} rotation={[0, x < 0 ? Math.PI / 2 : -Math.PI / 2, 0]} receiveShadow>
          <planeGeometry args={[22, 5]} />
          <meshStandardMaterial color={wall} roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, 5, 2]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[14, 22]} />
        <meshStandardMaterial color="#cfc6b4" roughness={1} />
      </mesh>
      {/* 腰板 */}
      <mesh position={[0, 0.6, -5.98]}>
        <planeGeometry args={[14, 1.2]} />
        <meshStandardMaterial color={wood} roughness={0.7} />
      </mesh>
      {/* 連邦の法廷は右の壁に大きな窓（昼の光） */}
      {fed
        ? [-3, 1].map((z) => (
            <mesh key={z} position={[6.97, 2.6, z]} rotation={[0, -Math.PI / 2, 0]}>
              <planeGeometry args={[2.2, 2.8]} />
              <meshStandardMaterial color="#000" emissive="#dfe6ee" emissiveIntensity={0.9} />
            </mesh>
          ))
        : null}
      {/* 判事席（高い台）と、後ろの旗竿（旗は文字なしの単色の布） */}
      <mesh position={[0, 0.75, -4.6]} castShadow receiveShadow>
        <boxGeometry args={[4.2, 1.5, 1.3]} />
        <meshStandardMaterial color={wood} roughness={0.65} />
      </mesh>
      <mesh position={[0, 1.55, -4.6]}>
        <boxGeometry args={[4.4, 0.1, 1.4]} />
        <meshStandardMaterial color={wood} roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.6, -5.4]} castShadow>
        <boxGeometry args={[0.7, 1.4, 0.15]} />
        <meshStandardMaterial color="#2a1e18" roughness={0.7} />
      </mesh>
      {/* 証言台（判事席の左） */}
      <mesh position={[-3.2, 0.6, -3.6]} castShadow>
        <boxGeometry args={[1.3, 1.2, 1.0]} />
        <meshStandardMaterial color={wood} roughness={0.65} />
      </mesh>
      <mesh position={[-3.2, 1.3, -3.4]} rotation={[0.5, 0, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.35, 8]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <Chair position={[-3.2, 0, -3.95]} />
      {/* 陪審席（右。2列の椅子と手すり） */}
      <mesh position={[4.6, 0.5, -1.2]}>
        <boxGeometry args={[0.15, 1.0, 5.0]} />
        <meshStandardMaterial color={wood} roughness={0.65} />
      </mesh>
      {Array.from({ length: 12 }, (_, i) => (
        <Chair key={i} position={[5.3 + (i >= 6 ? 0.9 : 0), i >= 6 ? 0.2 : 0, -3.2 + (i % 6) * 0.78]} rotY={-Math.PI / 2} />
      ))}
      {!fed ? (
        <>
          {/* 弁護人と検察の机、法律用箋 */}
          {[-1.6, 1.6].map((x) => (
            <group key={x}>
              <mesh position={[x, 0.76, 0.8]} castShadow receiveShadow>
                <boxGeometry args={[2.2, 0.06, 0.9]} />
                <meshStandardMaterial color={wood} roughness={0.6} />
              </mesh>
              {[-0.95, 0.95].map((dx) => (
                <mesh key={dx} position={[x + dx, 0.37, 0.8]}>
                  <boxGeometry args={[0.07, 0.74, 0.8]} />
                  <meshStandardMaterial color={wood} roughness={0.6} />
                </mesh>
              ))}
              <Chair position={[x - 0.5, 0, 1.55]} rotY={Math.PI} />
              <Chair position={[x + 0.5, 0, 1.55]} rotY={Math.PI} />
            </group>
          ))}
          <Paper position={[-1.75, 0.795, 0.78]} rotY={0.1} w={0.22} d={0.33} h={0.012} color="#e8d878" />
          <Paper position={[-1.45, 0.795, 0.86]} rotY={-0.25} w={0.22} d={0.33} h={0.008} color="#ece0a0" />
          <mesh position={[-1.25, 0.8, 0.7]} rotation={[0, 0.6, Math.PI / 2]}>
            <cylinderGeometry args={[0.006, 0.006, 0.15, 8]} />
            <meshStandardMaterial color="#1c2a50" />
          </mesh>
          {/* 演台 */}
          <mesh position={[0, 0.55, -1.4]} castShadow>
            <boxGeometry args={[0.6, 1.1, 0.45]} />
            <meshStandardMaterial color={wood} roughness={0.6} />
          </mesh>
          {/* テレビカメラ（右の手前）と、床を這うケーブル（太め） */}
          <TvCamera position={[3.2, 0, 2.4]} rotY={-0.6} />
          <mesh position={[3.9, 0.02, 4.8]} rotation={[-Math.PI / 2, 0, 0.3]}>
            <planeGeometry args={[0.05, 5]} />
            <meshStandardMaterial color="#111" roughness={0.6} />
          </mesh>
          {/* 傍聴席の長いす */}
          {[4.2, 5.4, 6.6, 7.8].map((z) =>
            [-3.4, 3.4].map((x) => (
              <group key={`${x}${z}`} position={[x, 0, z]}>
                <mesh position={[0, 0.45, 0]} castShadow>
                  <boxGeometry args={[4.6, 0.08, 0.5]} />
                  <meshStandardMaterial color={wood} roughness={0.7} />
                </mesh>
                <mesh position={[0, 0.85, 0.25]} castShadow>
                  <boxGeometry args={[4.6, 0.7, 0.07]} />
                  <meshStandardMaterial color={wood} roughness={0.7} />
                </mesh>
              </group>
            )),
          )}
          {/* 演台に立つ被告（a だけ。後ろ姿の顔のないシルエット） */}
          {variant === "a" ? <Figure clip="Idle_Loop" position={[0, 0, -0.95]} rotationY={Math.PI} glasses={false} build={BUNDY_SUIT} /> : null}
        </>
      ) : null}
      {/* 天井の照明パネル（部屋全体を明るく：F-052） */}
      {[-3.5, 0, 3.5].flatMap((x) => [-3, 1.5, 6].map((z) => (
        <group key={`${x}_${z}`}>
          <mesh position={[x, 4.96, z]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1.2, 0.6]} />
            <meshStandardMaterial color="#fff" emissive="#fff4e2" emissiveIntensity={0.6} side={THREE.DoubleSide} />
          </mesh>
          <pointLight position={[x, 4.4, z]} intensity={fed ? 10 : 12} distance={9} decay={2} color={fed ? "#f4f0e8" : "#ffe8c8"} />
        </group>
      )))}
      <primitive object={ceiling} />
      <primitive object={ceiling.target} />
      <primitive object={sun} />
      <primitive object={sun.target} />
    </>
  );
};

export const InsertCourtroom004: React.FC<SceneProps> = ({ variant = "a" }) => (
  <Stage fog={0.008} exposure={1.1} bloom={0.08} bg="#141110" hemi={["#e8d8bc", "#3a2e22", 1.3]} grade="sepia(0.18) saturate(0.82) contrast(1.06)">
    <Court variant={variant} fed={false} />
  </Stage>
);

export const InsertCourtroomFed004: React.FC<SceneProps> = ({ variant = "a" }) => (
  <Stage fog={0.006} exposure={1.1} bloom={0.08} bg="#2a2824" hemi={["#f0ece2", "#4a4238", 1.4]} grade="sepia(0.1) saturate(0.8) contrast(1.04)">
    <Court variant={variant} fed />
  </Stage>
);

/* ---------- 確認用：本人の2つの服装（Scene-Check で figures_004 を見る。台本では使わない） ---------- */

export const InsertFigures004: React.FC<SceneProps> = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const a = (frame / Math.max(1, durationInFrames)) * Math.PI * 2;
  const cam: CamKey = { pos: [Math.sin(a) * 4.2, 1.25, Math.cos(a) * 4.2], target: [0, 1.0, 0], fov: 34 };
  return (
    <Stage fog={0} exposure={1.0} bloom={0} bg="#7a7a7a" hemi={["#ffffff", "#444444", 1.6]} grade="none">
      <Camera from={cam} to={cam} />
      <directionalLight position={[3, 5, 4]} intensity={2.2} />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#6e6e6e" roughness={1} />
      </mesh>
      <Figure clip="Idle_Loop" position={[-0.6, 0, 0]} glasses={false} build={BUNDY_STUDENT} />
      <Figure clip="Idle_Loop" position={[0.6, 0, 0]} glasses={false} build={BUNDY_SUIT} />
    </Stage>
  );
};
