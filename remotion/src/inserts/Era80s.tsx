/**
 * 80年代アメリカの小道具と画面の質感（F-011）。外部の3Dモデルや画像は使わず、すべて手続きで作る。
 *   車：角ばったフルサイズのセダン（ビニールトップ）とウッドパネルのステーションワゴン。ロゴ・車名は入れない
 *   街：公衆電話、新聞の自販機、ネオンサイン（店の種類だけ。実在の店名は入れない）、木目の壁板、非常階段
 *   画面：光のにじみ（ブルーム）、色あせたフィルムの色、ゆっくりした画面の揺れ
 * 酒場など事件を連想させる店のネオンは使わない（CLAUDE.md：犯行をほのめかす場面は作らない）
 */
import { useFrame, useThree } from "@react-three/fiber";
import React, { useEffect, useMemo, useState } from "react";
import { continueRender, delayRender, random } from "remotion";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { FONT, FONT_READY } from "../lib/font";

type V3 = [number, number, number];

/* ---------- 光のにじみ（フィルムのハレーションの代わり） ---------- */

export const Bloom: React.FC<{ strength?: number; radius?: number; threshold?: number }> = ({ strength = 0.55, radius = 0.6, threshold = 0.8 }) => {
  const { gl, scene, camera, size } = useThree();
  const composer = useMemo(() => {
    const pr = gl.getPixelRatio();
    // 後処理では標準のアンチエイリアスが効かないので、描画先に MSAA を付ける
    const rt = new THREE.WebGLRenderTarget(size.width * pr, size.height * pr, { type: THREE.HalfFloatType, samples: 4 });
    const c = new EffectComposer(gl, rt);
    c.addPass(new RenderPass(scene, camera));
    c.addPass(new UnrealBloomPass(new THREE.Vector2(size.width, size.height), strength, radius, threshold));
    c.addPass(new OutputPass()); // トーンマッピングと色空間の変換はここで行う
    return c;
  }, [gl, scene, camera, size.width, size.height, strength, radius, threshold]);
  useEffect(() => {
    composer.setPixelRatio(gl.getPixelRatio());
    composer.setSize(size.width, size.height);
  }, [composer, gl, size.width, size.height]);
  useFrame(() => composer.render(), 1);
  return null;
};

/* ---------- 手続きで作るテクスチャ ---------- */

let woodCache: THREE.CanvasTexture | null = null;
/** 木目（80年代の部屋の壁板、ワゴンの側面） */
const woodTexture = () => {
  if (woodCache) return woodCache;
  const S = 512;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const c = cv.getContext("2d")!;
  c.fillStyle = "#8a5a33";
  c.fillRect(0, 0, S, S);
  const boards = 6;
  for (let b = 0; b < boards; b++) {
    const x0 = (b * S) / boards;
    const tone = random(`board-${b}`);
    c.fillStyle = `rgba(${60 + tone * 40},${30 + tone * 20},${10},0.35)`;
    c.fillRect(x0, 0, S / boards, S);
    // 木目：ゆるく波打つ細い線
    for (let i = 0; i < 26; i++) {
      const gx = x0 + random(`gx-${b}-${i}`) * (S / boards);
      const a = 0.08 + random(`ga-${b}-${i}`) * 0.2;
      c.strokeStyle = `rgba(40,18,6,${a})`;
      c.lineWidth = 1 + random(`gw-${b}-${i}`) * 2;
      c.beginPath();
      for (let y = 0; y <= S; y += 16) {
        const xx = gx + Math.sin(y / (40 + i * 3) + i) * 3 + Math.sin(y / 9 + b) * 0.8;
        if (y === 0) c.moveTo(xx, y);
        else c.lineTo(xx, y);
      }
      c.stroke();
    }
    c.fillStyle = "rgba(20,10,4,0.85)"; // 板の継ぎ目（溝）
    c.fillRect(x0, 0, 3, S);
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  woodCache = t;
  return t;
};

export const WoodMaterial: React.FC<{ w: number; h: number; horizontal?: boolean; tint?: string; glow?: number }> = ({ w, h, horizontal = false, tint = "#ffffff", glow = 0 }) => {
  const mat = useMemo(() => {
    const t = woodTexture().clone();
    t.center.set(0.5, 0.5);
    t.rotation = horizontal ? Math.PI / 2 : 0;
    t.repeat.set(horizontal ? h / 0.9 : w / 1.2, horizontal ? w / 1.2 : h / 2.4);
    t.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: t, color: tint, roughness: 0.6, emissive: glow > 0 ? "#ffffff" : "#000000", emissiveMap: glow > 0 ? t : null, emissiveIntensity: glow });
  }, [w, h, horizontal, tint, glow]);
  return <primitive object={mat} attach="material" />;
};

const fontLoaded = () => Array.from(document.fonts).some((f) => f.family.replace(/"/g, "") === "Noto Sans JP" && f.status === "loaded");

/**
 * フォントの読み込みを待ってから canvas に文字を描く（読み込み前に描くと別のフォントになる）。
 * 待った場合は、文字の板を画面に足して描き直してから撮影を再開する。描き直さずに再開すると、
 * そのフレームだけ看板が消え、フレームごとに点いたり消えたりして見える（QAのチラつき検査で検出）
 */
const useCanvasText = <T,>(make: () => T, deps: React.DependencyList): T | null => {
  const { advance } = useThree();
  const [ready, setReady] = useState(fontLoaded);
  const [handle] = useState(() => (fontLoaded() ? null : delayRender("canvas text: font")));
  useEffect(() => {
    if (!ready) FONT_READY.then(() => setReady(true));
  }, [ready]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(() => (ready ? make() : null), [ready, ...deps]);
  useEffect(() => {
    if (value !== null && handle !== null) {
      advance(performance.now());
      continueRender(handle);
    }
  }, [value, handle, advance]);
  return value;
};

/** ネオン管の文字（輪郭を光らせる）。縦書きの袖看板にもできる */
const neonTexture = (text: string, color: string, vertical: boolean) => {
  const chars = vertical ? text.split("") : [text];
  const cell = 220;
  const cv = document.createElement("canvas");
  cv.width = vertical ? cell * 1.2 : Math.ceil(cell * 0.72 * text.length + cell * 0.6);
  cv.height = vertical ? cell * chars.length + cell * 0.3 : cell * 1.3;
  const c = cv.getContext("2d")!;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.font = `700 ${cell * 0.82}px ${FONT}`;
  c.lineJoin = "round";
  const draw = (stroke: string, width: number, blur: number) => {
    c.shadowColor = color;
    c.shadowBlur = blur;
    c.strokeStyle = stroke;
    c.lineWidth = width;
    chars.forEach((ch, i) => {
      const x = cv.width / 2;
      const y = vertical ? cell * 0.65 + i * cell : cv.height / 2;
      c.strokeText(ch, x, y);
    });
  };
  // 管は太めに描く。細いと、カメラが動いたときに画面上で1〜2ピクセルの線が揺れてチラついて見える（QAで検出）
  draw(color, 30, 40);
  draw(color, 20, 16);
  draw("#ffffff", 7, 6); // 管の芯は白っぽく
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return { tex: t, aspect: cv.width / cv.height };
};

/* ---------- ネオンサイン ---------- */

export const NeonSign: React.FC<{
  text: string;
  color: string;
  position: V3;
  rotationY?: number;
  height: number; // 文字部分の高さ（m）
  vertical?: boolean;
  board?: boolean; // 後ろに暗い看板の板を付ける
  light?: number; // 周りの壁を照らす光の強さ
}> = ({ text, color, position, rotationY = 0, height, vertical = false, board = true, light = 6 }) => {
  const neon = useCanvasText(() => neonTexture(text, color, vertical), [text, color, vertical]);
  const mat = useMemo(() => {
    if (!neon) return null;
    const m = new THREE.MeshBasicMaterial({ map: neon.tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    // ネオンの光の広がりは canvas に描いてある。ブルームを掛けると、小さく明るい文字が縮小処理で
    // フレームごとに明るさを変え、看板がチラついて見える（QAで検出）ので、しきい値より暗くしておく
    m.color.setScalar(0.85);
    return m;
  }, [neon]);
  const pl = useMemo(() => new THREE.PointLight(color, light, 9, 2), [color, light]);
  if (!neon || !mat) return null;
  const w = height * neon.aspect;
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {board ? (
        <mesh position={[0, 0, -0.06]}>
          <boxGeometry args={[w * 1.04, height * 1.04, 0.08]} />
          <meshStandardMaterial color="#121212" roughness={0.7} />
        </mesh>
      ) : null}
      {/* 看板の板から2cm離す（同じ深さで重ねない：F-001） */}
      <mesh position={[0, 0, 0.0]} material={mat}>
        <planeGeometry args={[w, height]} />
      </mesh>
      <primitive object={pl} position={[0, 0, 0.6]} />
    </group>
  );
};

/* ---------- 車 ---------- */

export type CarProps = {
  position: V3;
  rotationY?: number; // 車の前は +X
  color: string;
  wagon?: boolean;
  vinylTop?: string; // ビニールトップの色（セダン）
  headlights?: number; // 0〜1
  brake?: number; // テールランプ 0〜1
};

const W_CAR = 1.95;

/** 横から見た車体の輪郭（前が +X）。タイヤの位置は切り欠く */
const bodyShape = () => {
  const s = new THREE.Shape();
  s.moveTo(-2.66, 0.42);
  s.lineTo(-2.62, 0.3);
  s.lineTo(-1.9, 0.3);
  s.absarc(-1.45, 0.36, 0.45, Math.PI, 0, true);
  s.lineTo(-1.0, 0.3);
  s.lineTo(1.15, 0.3);
  s.absarc(1.6, 0.36, 0.45, Math.PI, 0, true);
  s.lineTo(2.05, 0.3);
  s.lineTo(2.6, 0.3);
  s.lineTo(2.66, 0.42);
  s.lineTo(2.66, 0.76);
  s.lineTo(2.56, 0.84);
  s.lineTo(0.9, 0.9);
  s.lineTo(-1.8, 0.9);
  s.lineTo(-2.6, 0.87);
  s.lineTo(-2.66, 0.74);
  s.closePath();
  return s;
};

const extrude = (shape: THREE.Shape, depth: number, bevel: number) => {
  const g = new THREE.ExtrudeGeometry(shape, { depth: depth - 2 * bevel, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 16 });
  g.translate(0, 0, -(depth - 2 * bevel) / 2);
  return g;
};

export const Car80s: React.FC<CarProps> = ({ position, rotationY = 0, color, wagon = false, vinylTop, headlights = 0, brake = 0 }) => {
  const geo = useMemo(() => {
    const body = extrude(bodyShape(), W_CAR, 0.03);
    const gs = new THREE.Shape();
    if (wagon) {
      gs.moveTo(0.9, 0.89); gs.lineTo(0.15, 1.4); gs.lineTo(-2.5, 1.4); gs.lineTo(-2.6, 0.89);
    } else {
      gs.moveTo(0.9, 0.89); gs.lineTo(0.12, 1.37); gs.lineTo(-1.0, 1.37); gs.lineTo(-1.8, 0.89);
    }
    gs.closePath();
    const glass = extrude(gs, W_CAR * 0.9, 0.0);
    return { body, glass };
  }, [wagon]);
  const paint = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.25 }), [color]);
  // めっき。つるつるにすると街灯の映り込みが点のように強く光り、人物の腕の動きで見え隠れしてチラつく
  const chrome = useMemo(() => new THREE.MeshStandardMaterial({ color: "#a9adb3", roughness: 0.45, metalness: 0.7 }), []);
  // 窓ガラス。真っ黒にすると夜の背景に溶けて、車体の下半分と屋根だけが浮いて見える
  const dark = useMemo(() => new THREE.MeshStandardMaterial({ color: "#3a4450", roughness: 0.16, metalness: 0.55, emissive: "#0c1016", emissiveIntensity: 1 }), []);
  const tire = useMemo(() => new THREE.MeshStandardMaterial({ color: "#0b0b0b", roughness: 0.9 }), []);
  const head = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: "#d8d4c8", roughness: 0.3, emissive: "#fff4dc", emissiveIntensity: 0 });
    return m;
  }, []);
  const tail = useMemo(() => new THREE.MeshStandardMaterial({ color: "#3a0606", roughness: 0.4, emissive: "#ff1a10", emissiveIntensity: 0 }), []);
  head.emissiveIntensity = headlights * 6;
  // 止めてある車はテールランプを消す（暗い画面に赤い四角だけが浮くため）
  tail.emissiveIntensity = headlights > 0 ? 0.5 + brake * 3 : 0;

  const roofTop = wagon ? 1.4 : 1.37;
  const roofX = wagon ? [-2.52, 0.17] : [-1.02, 0.14];
  const roofW = W_CAR * 0.9 + 0.03;
  const pillars = wagon ? [-0.4, -1.45, -2.48] : [-0.42];
  const half = W_CAR / 2;
  const wood = wagon
    ? [
        // [x0, x1, y0, y1] タイヤの切り欠きをよけて木目の板を貼る
        [-0.98, 1.13, 0.42, 0.86],
        [-2.56, -1.92, 0.42, 0.86],
        [-1.92, -0.98, 0.83, 0.86],
        [1.13, 2.07, 0.83, 0.86],
        [2.07, 2.5, 0.42, 0.86],
      ]
    : [];
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={geo.body} material={paint} castShadow receiveShadow />
      <mesh geometry={geo.glass} material={dark} castShadow />
      {/* 屋根（セダンはビニールトップ） */}
      <mesh position={[(roofX[0] + roofX[1]) / 2, roofTop + 0.015, 0]} castShadow>
        <boxGeometry args={[roofX[1] - roofX[0], 0.035, roofW]} />
        {vinylTop && !wagon ? <meshStandardMaterial color={vinylTop} roughness={0.85} /> : <primitive object={paint} attach="material" />}
      </mesh>
      {wagon
        ? [-0.55, 0.55].map((z) => (
            <mesh key={z} position={[-1.2, roofTop + 0.07, z]}>
              <boxGeometry args={[2.4, 0.04, 0.04]} />
              <primitive object={chrome} attach="material" />
            </mesh>
          ))
        : null}
      {pillars.map((x) => (
        <mesh key={x} position={[x, (0.9 + roofTop) / 2, 0]} material={paint}>
          <boxGeometry args={[0.1, roofTop - 0.9, W_CAR * 0.9 + 0.02]} />
        </mesh>
      ))}
      {/* バンパー・グリル・ライト（前 +X） */}
      {[2.7, -2.7].map((x) => (
        <mesh key={x} position={[x, 0.42, 0]} material={chrome}>
          <boxGeometry args={[0.14, 0.18, W_CAR + 0.06]} />
        </mesh>
      ))}
      <mesh position={[2.675, 0.63, 0]}>
        <boxGeometry args={[0.04, 0.24, 0.95]} />
        <meshStandardMaterial color="#16181b" roughness={0.5} metalness={0.4} />
      </mesh>
      {[-0.82, -0.62, 0.62, 0.82].map((z) => (
        <mesh key={z} position={[2.685, 0.64, z]} material={head}>
          <boxGeometry args={[0.03, 0.11, 0.17]} />
        </mesh>
      ))}
      {[-0.6, 0.6].map((z) => (
        <mesh key={z} position={[-2.685, 0.66, z]} material={tail}>
          <boxGeometry args={[0.03, 0.14, 0.55]} />
        </mesh>
      ))}
      {/* 側面のモール */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 0.6, s * (half + 0.008)]} material={chrome}>
          <boxGeometry args={[5.0, 0.025, 0.01]} />
        </mesh>
      ))}
      {wood.flatMap(([x0, x1, y0, y1], i) =>
        [-1, 1].map((s) => (
          <mesh key={`${i}${s}`} position={[(x0 + x1) / 2, (y0 + y1) / 2, s * (half + 0.016)]} rotation={[0, s > 0 ? 0 : Math.PI, 0]}>
            <planeGeometry args={[x1 - x0, y1 - y0]} />
            <WoodMaterial w={x1 - x0} h={y1 - y0} horizontal tint="#b98a5e" />
          </mesh>
        )),
      )}
      {/* タイヤとホイールキャップ */}
      {[1.6, -1.45].flatMap((x) =>
        [-1, 1].map((s) => (
          <group key={`${x}${s}`} position={[x, 0.33, s * (half - 0.17)]}>
            <mesh rotation={[Math.PI / 2, 0, 0]} material={tire} castShadow>
              <cylinderGeometry args={[0.33, 0.33, 0.22, 24]} />
            </mesh>
            <mesh position={[0, 0, s * 0.115]} rotation={[Math.PI / 2, 0, 0]} material={chrome}>
              <cylinderGeometry args={[0.19, 0.19, 0.012, 20]} />
            </mesh>
          </group>
        )),
      )}
    </group>
  );
};

/* ---------- 街の小物 ---------- */

/** 看板などの小さな文字の板（光る） */
const LabelPlate: React.FC<{ text: string; w: number; h: number; bg: string; fg: string; glow?: number; position: V3 }> = ({ text, w, h, bg, fg, glow = 0.8, position }) => {
  const tex = useCanvasText(() => {
    const cv = document.createElement("canvas");
    cv.width = 512;
    cv.height = Math.round((512 * h) / w);
    const c = cv.getContext("2d")!;
    c.fillStyle = bg;
    c.fillRect(0, 0, cv.width, cv.height);
    c.fillStyle = fg;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = `700 ${cv.height * 0.62}px ${FONT}`;
    c.fillText(text, cv.width / 2, cv.height / 2 + cv.height * 0.03);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [text, w, h, bg, fg]);
  if (!tex) return null;
  return (
    <mesh position={position}>
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial map={tex} emissive="#ffffff" emissiveMap={tex} emissiveIntensity={glow} roughness={0.5} />
    </mesh>
  );
};

/** 公衆電話（正面が +Z） */
export const Payphone: React.FC<{ position: V3; rotationY?: number }> = ({ position, rotationY = 0 }) => (
  <group position={position} rotation={[0, rotationY, 0]}>
    <mesh position={[0, 0.55, 0]} castShadow>
      <cylinderGeometry args={[0.04, 0.05, 1.1, 10]} />
      <meshStandardMaterial color="#5d6166" roughness={0.5} metalness={0.6} />
    </mesh>
    <mesh position={[0, 1.38, 0]} castShadow>
      <boxGeometry args={[0.34, 0.6, 0.2]} />
      <meshStandardMaterial color="#9ba1a8" roughness={0.38} metalness={0.7} />
    </mesh>
    <mesh position={[0.02, 1.36, 0.105]}>
      <planeGeometry args={[0.2, 0.3]} />
      <meshStandardMaterial color="#26292d" roughness={0.6} />
    </mesh>
    {/* ボタン */}
    {[0, 1, 2, 3].flatMap((r) =>
      [0, 1, 2].map((k) => (
        <mesh key={`${r}${k}`} position={[-0.035 + k * 0.05, 1.3 + r * 0.045, 0.112]}>
          <boxGeometry args={[0.03, 0.025, 0.01]} />
          <meshStandardMaterial color="#c9ccd0" roughness={0.4} metalness={0.5} />
        </mesh>
      )),
    )}
    {/* 受話器 */}
    <mesh position={[-0.2, 1.4, 0.04]} castShadow>
      <boxGeometry args={[0.06, 0.24, 0.07]} />
      <meshStandardMaterial color="#0c0c0c" roughness={0.5} />
    </mesh>
    {/* 上の青い看板とひさし */}
    <mesh position={[0, 1.82, 0.02]}>
      <boxGeometry args={[0.42, 0.18, 0.26]} />
      <meshStandardMaterial color="#1d4c95" roughness={0.5} />
    </mesh>
    <LabelPlate text="PHONE" w={0.36} h={0.12} bg="#1d4c95" fg="#f4f4f4" position={[0, 1.82, 0.152]} />
    {/* ひさしの下の小さな明かり（当時の公衆電話は夜も手元が見えるように照らしていた） */}
    <pointLight position={[0, 1.7, 0.45]} color="#dfe8ff" intensity={0.12} distance={2.2} decay={2} />
  </group>
);

/** 新聞の自販機（正面が +Z） */
export const NewsBox: React.FC<{ position: V3; rotationY?: number; color?: string }> = ({ position, rotationY = 0, color = "#c79a1e" }) => (
  <group position={position} rotation={[0, rotationY, 0]}>
    <mesh position={[0, 0.55, 0]} castShadow>
      <boxGeometry args={[0.48, 0.9, 0.42]} />
      <meshStandardMaterial color={color} roughness={0.55} metalness={0.2} />
    </mesh>
    <mesh position={[0, 0.72, 0.215]}>
      <planeGeometry args={[0.38, 0.36]} />
      {/* つやを抑える（街灯の映り込みが強く光り、人物の腕の動きで見え隠れしてチラつくため） */}
      <meshStandardMaterial color="#9a9d95" roughness={0.65} emissive="#3a3a36" emissiveIntensity={0.15} />
    </mesh>
    {[-0.2, 0.2].map((x) => (
      <mesh key={x} position={[x, 0.05, 0]}>
        <boxGeometry args={[0.04, 0.1, 0.38]} />
        <meshStandardMaterial color="#222" />
      </mesh>
    ))}
  </group>
);

/** 鉄の非常階段（米国のれんがのアパートの外壁）。壁は z=wallZ、手前に出る */
export const FireEscape: React.FC<{ x0: number; x1: number; wallZ: number; floors: number[]; depth?: number }> = ({ x0, x1, wallZ, floors, depth = 1.0 }) => {
  const iron = useMemo(() => new THREE.MeshStandardMaterial({ color: "#070707", roughness: 0.75, metalness: 0.3 }), []);
  const parts: { p: V3; s: V3; r?: V3 }[] = [];
  const zf = wallZ + 0.05 + depth; // 手すりの前側
  floors.forEach((y, fi) => {
    parts.push({ p: [(x0 + x1) / 2, y, wallZ + 0.05 + depth / 2], s: [x1 - x0, 0.05, depth] }); // 床
    parts.push({ p: [(x0 + x1) / 2, y + 1.0, zf], s: [x1 - x0, 0.035, 0.035] }); // 前の手すり
    for (const x of [x0, x1]) parts.push({ p: [x, y + 1.0, wallZ + 0.05 + depth / 2], s: [0.035, 0.035, depth] }); // 横の手すり
    for (let x = x0; x <= x1 + 1e-6; x += 0.15) parts.push({ p: [x, y + 0.5, zf], s: [0.015, 1.0, 0.015] }); // 柵
    for (const x of [x0, x1]) for (let z = wallZ + 0.2; z < zf; z += 0.15) parts.push({ p: [x, y + 0.5, z], s: [0.015, 1.0, 0.015] });
    // 上の階への階段：2本の側桁と段板（1枚の板にすると太い梁に見える）
    const next = floors[fi + 1];
    if (next !== undefined) {
      const ax = x1 - 0.3, bx = x0 + 0.3;
      const len = Math.hypot(ax - bx, next - y);
      const ang = Math.atan2(next - y, bx - ax);
      const zc = wallZ + 0.05 + depth * 0.5;
      for (const dz of [-0.24, 0.24]) parts.push({ p: [(ax + bx) / 2, (y + next) / 2, zc + dz], s: [len, 0.12, 0.025], r: [0, 0, ang] });
      const steps = Math.round((next - y) / 0.22);
      for (let k = 1; k < steps; k++) {
        const f = k / steps;
        parts.push({ p: [ax + (bx - ax) * f, y + (next - y) * f, zc], s: [0.2, 0.02, 0.48] });
      }
    }
  });
  // いちばん下の階から下ろすはしご
  const y0 = floors[0];
  for (const dz of [0.25, 0.65]) parts.push({ p: [x1 - 0.25, y0 - 0.8, wallZ + 0.05 + dz], s: [0.03, 1.6, 0.03] });
  for (let y = y0 - 1.5; y < y0; y += 0.3) parts.push({ p: [x1 - 0.25, y, wallZ + 0.5], s: [0.02, 0.02, 0.4] });
  return (
    <group>
      {parts.map((q, i) => (
        <mesh key={i} position={q.p} rotation={q.r ?? [0, 0, 0]} material={iron} castShadow>
          <boxGeometry args={q.s} />
        </mesh>
      ))}
    </group>
  );
};

/** ゆっくり揺れる明るさ（テレビの光など）。急に変えると明滅に見えるので、低い周波数の波だけを足す */
export const slowWave = (t: number, seed: number) =>
  0.5 + 0.25 * Math.sin(t * 1.1 + seed) + 0.15 * Math.sin(t * 2.3 + seed * 2) + 0.1 * Math.sin(t * 0.6 + seed * 3);

/** 1階の店のショーウィンドウ：店内の明かり、下半分のカフェカーテン、窓枠。正面が +Z */
export const Storefront: React.FC<{ position: V3; rotationY?: number; w: number; h: number; glow?: number; light?: string; curtain?: string }> = ({
  position, rotationY = 0, w, h, glow = 0.22, light = "#ffd6a0", curtain = "#3a1416",
}) => {
  const panes = Math.max(2, Math.round(w / 1.6));
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color="#000" emissive={light} emissiveIntensity={glow} />
      </mesh>
      {/* 店内の天井の明かりの帯（上ほど明るい） */}
      <mesh position={[0, h * 0.42, 0.01]}>
        <planeGeometry args={[w * 0.96, h * 0.08]} />
        <meshStandardMaterial color="#000" emissive={light} emissiveIntensity={glow * 2.4} />
      </mesh>
      <mesh position={[0, -h * 0.3, 0.02]}>
        <planeGeometry args={[w, h * 0.4]} />
        <meshStandardMaterial color={curtain} roughness={0.9} emissive={curtain} emissiveIntensity={0.25} />
      </mesh>
      {Array.from({ length: panes + 1 }, (_, i) => -w / 2 + (i * w) / panes).map((x) => (
        <mesh key={x} position={[x, 0, 0.04]}>
          <boxGeometry args={[0.07, h, 0.04]} />
          <meshStandardMaterial color="#141414" roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, h / 2 + 0.05, 0.04]}>
        <boxGeometry args={[w + 0.1, 0.1, 0.05]} />
        <meshStandardMaterial color="#141414" roughness={0.6} />
      </mesh>
    </group>
  );
};
