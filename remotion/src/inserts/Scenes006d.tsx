/**
 * 006 アルカトラズ脱獄（1962年〜1979年）のイメージ映像：FBI サンフランシスコ支局の事務所
 *   sf_office：a 机の上の黒電話とタイプライター、奥にスーツの捜査官の後ろ姿
 *              b 壁に貼った湾の地図の前に立つ捜査官の後ろ姿
 *              c 机に積み上がった捜査ファイルと、めくられていく卓上カレンダー（人物なし）
 *              d 電話を受ける捜査官の後ろ姿
 *              e 机の上の書類に押される受付印（人物は手元だけ）
 *              f 棚に並んだ捜査ファイルの綴じ込み（人物なし）
 * 人物は顔のないシルエットで、後ろ姿だけ。紙・カレンダー・ファイルの背に読める文字は入れない。
 * 壁の地図は、湾の形をぼんやり塗っただけの小道具（地図として読ませない。地名・線・数字は描かない）。
 */
import React, { useMemo } from "react";
import { interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { Build, Figure } from "../lib/Figure";
import { WoodMaterial } from "./Era80s";
import { CamKey, SceneProps, Stage, useInsertDur } from "./Inserts";
import { CeilingLights, Desk, DeskPhone, FileBox, FilingCabinet, PaperStack, paperTexture, Typewriter } from "./Props003";
import { Cam006 } from "./Scenes006a";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
type V3 = [number, number, number];

/** 1962年の FBI の捜査官（濃い灰色のスーツ、白いシャツ、細いネクタイ。室内なので帽子なし） */
export const AGENT_62: Build = { shoulder: 0.9, width: 1.04, jacket: "#2c2e33", trousers: "#2a2c30", shoes: "#121110", skin: "#16110e", hair: "#2a221c", suit: { shirt: "#d6d2c8", tie: "#1c1e24" } };

/** 電話を耳に当てる右腕（後ろ姿で、肘が上がって見える） */
const PHONE_ARM: Record<string, [number, number, number]> = {
  "DEF-upper_armR": [1.15, 0, 0.55],
  "DEF-forearmR": [1.9, 0, 0],
};

const texCache: Record<string, THREE.CanvasTexture> = {};
const canvasTex = (key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) => {
  if (texCache[key]) return texCache[key];
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  draw(cv.getContext("2d")!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  texCache[key] = t;
  return t;
};

/** 壁の湾の地図（小道具）：古い紙に、水の部分を青灰色でぼんやり塗り、赤くない押しピンを数本 */
const bayChart = () =>
  canvasTex("baychart", 512, 384, (c) => {
    c.fillStyle = "#d8cfb8"; c.fillRect(0, 0, 512, 384);
    c.filter = "blur(6px)";
    c.fillStyle = "#93a3a8";
    c.beginPath();
    c.moveTo(0, 170); c.bezierCurveTo(120, 150, 170, 200, 230, 180); c.bezierCurveTo(300, 150, 320, 60, 380, 40);
    c.bezierCurveTo(420, 120, 400, 260, 440, 384); c.lineTo(330, 384); c.bezierCurveTo(300, 300, 260, 250, 210, 240);
    c.bezierCurveTo(150, 230, 90, 250, 0, 240); c.closePath(); c.fill();
    c.filter = "none";
    // 海図らしい薄い格子（線だけ。数字・地名は描かない）
    c.strokeStyle = "rgba(80,90,100,0.22)"; c.lineWidth = 1;
    for (let x = 32; x < 512; x += 64) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 384); c.stroke(); }
    for (let y = 32; y < 384; y += 64) { c.beginPath(); c.moveTo(0, y); c.lineTo(512, y); c.stroke(); }
    c.strokeStyle = "rgba(60,60,55,0.5)"; c.lineWidth = 3; c.strokeRect(10, 10, 492, 364);
    for (let i = 0; i < 2500; i++) {
      c.fillStyle = `rgba(90,80,60,${random(`bc${i}`) * 0.12})`;
      c.fillRect(random(`bcx${i}`) * 512, random(`bcy${i}`) * 384, 2, 2);
    }
  });

/** 綴じ込みの背（色の違う厚紙の背。ラベルの白い四角だけで、文字は入れない） */
const binderSpines = (seed: number) =>
  canvasTex(`spines${seed}`, 512, 128, (c) => {
    let x = 0;
    const cols = ["#5b4a36", "#4a5560", "#6b5a3c", "#3e4a3e", "#7a6a50"];
    while (x < 512) {
      const w = 18 + random(`sp${seed}${x}`) * 26;
      c.fillStyle = cols[Math.floor(random(`spc${seed}${x}`) * cols.length)];
      c.fillRect(x, 4 + random(`sph${seed}${x}`) * 14, w - 2, 124);
      c.fillStyle = "rgba(230,224,210,0.85)";
      c.fillRect(x + 4, 30, w - 10, 16);
      x += w;
    }
  });

/** 卓上カレンダー（めくりの台と紙。数字は描かず、上の帯と升目だけ） */
const calPage = (seed: number) =>
  canvasTex(`cal${seed}`, 128, 160, (c) => {
    c.fillStyle = "#efe9dc"; c.fillRect(0, 0, 128, 160);
    c.fillStyle = ["#4d5e78", "#5e6e56", "#6e5a4a"][seed % 3]; c.fillRect(0, 0, 128, 34);
    c.strokeStyle = "rgba(40,40,40,0.45)"; c.lineWidth = 1.5;
    for (let r = 0; r <= 5; r++) { c.beginPath(); c.moveTo(8, 46 + r * 20); c.lineTo(120, 46 + r * 20); c.stroke(); }
    for (let k = 0; k <= 7; k++) { c.beginPath(); c.moveTo(8 + k * 16, 46); c.lineTo(8 + k * 16, 146); c.stroke(); }
  });

const DeskCalendar: React.FC<{ position: V3; rotY?: number; t: number }> = ({ position, rotY = 0, t }) => {
  // 2.8秒に1枚、上の紙が少し持ち上がりながら薄れて消え、下の紙が出る（0.9秒かけて）。
  // 紙を回してめくると、真横を向いた細い紙が速く画面を横切り、チラつきと判定された
  const PER = 2.8;
  const n = Math.floor(t / PER);
  const k = Math.min(1, (t - n * PER) / 0.9);
  const fade = 1 - THREE.MathUtils.smootherstep(k, 0, 1);
  const flip = THREE.MathUtils.smootherstep(k, 0, 1) * 0.25;
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[0.2, 0.06, 0.12]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.5} />
      </mesh>
      {/* 下の紙（次の月） */}
      <mesh position={[0, 0.16, 0.0]} rotation={[-0.25, 0, 0]}>
        <planeGeometry args={[0.18, 0.22]} />
        <meshStandardMaterial map={calPage(n + 1)} roughness={0.9} />
      </mesh>
      {/* めくれる紙（上の綴じ目を軸に回る） */}
      {fade > 0.001 ? (
        <group position={[0, 0.27, -0.028]} rotation={[-0.25 - flip, 0, 0]}>
          <mesh position={[0, -0.11, 0.003]}>
            <planeGeometry args={[0.18, 0.22]} />
            <meshStandardMaterial map={calPage(n)} roughness={0.9} side={THREE.DoubleSide} transparent opacity={fade} />
          </mesh>
        </group>
      ) : null}
    </group>
  );
};

/** 受付印：木の柄とゴムの台。手（袖と手の甲）が上から押す */
const Stamp: React.FC<{ position: V3; press: number }> = ({ position, press }) => {
  const y = 0.02 + (1 - press) * 0.12;
  return (
    <group position={position}>
      <group position={[0, y, 0]}>
        <mesh position={[0, 0.012, 0]}>
          <boxGeometry args={[0.07, 0.024, 0.045]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.06, 0]}>
          <cylinderGeometry args={[0.012, 0.016, 0.07, 10]} />
          <meshStandardMaterial color="#6b4a2e" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.105, 0]}>
          <sphereGeometry args={[0.022, 12, 12]} />
          <meshStandardMaterial color="#6b4a2e" roughness={0.6} />
        </mesh>
        {/* 握った手：手の甲（平たい箱）、取っ手の前に回した4本の指、横の親指。袖口（白）と袖は上の奥へ抜ける */}
        <group position={[0, 0.105, 0]}>
          <mesh position={[0, 0.016, -0.006]} rotation={[-0.5, 0, 0]}>
            <boxGeometry args={[0.072, 0.03, 0.07]} />
            <meshStandardMaterial color="#2a1f19" roughness={0.85} />
          </mesh>
          {[-0.027, -0.009, 0.009, 0.027].map((x, k) => (
            <mesh key={k} position={[x, 0.0, 0.026]} rotation={[0.25, 0, 0]}>
              <capsuleGeometry args={[0.0085, 0.028, 4, 8]} />
              <meshStandardMaterial color="#2a1f19" roughness={0.85} />
            </mesh>
          ))}
          <mesh position={[0.04, 0.008, 0.0]} rotation={[0, 0, 0.6]}>
            <capsuleGeometry args={[0.009, 0.03, 4, 8]} />
            <meshStandardMaterial color="#2a1f19" roughness={0.85} />
          </mesh>
          <group position={[0, 0.03, -0.04]} rotation={[-0.45, 0, 0.12]}>
            <mesh position={[0, 0.02, 0]}>
              <cylinderGeometry args={[0.033, 0.033, 0.035, 14]} />
              <meshStandardMaterial color="#d6d2c8" roughness={0.8} />
            </mesh>
            <mesh position={[0, 0.2, 0]}>
              <cylinderGeometry args={[0.046, 0.042, 0.34, 14]} />
              <meshStandardMaterial color="#2c2e33" roughness={0.85} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
};

/** 1962年の事務所：木目の壁板、ブラインドの窓、蛍光灯、机、書類棚、綴じ込みの棚、壁の地図 */
const Office: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const chart = bayChart();
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[16, 10]} />
        <meshStandardMaterial color="#4f4a40" roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.6, -2.6]} receiveShadow>
        <planeGeometry args={[16, 3.2]} />
        <WoodMaterial w={16} h={3.2} tint="#e0c09a" />
      </mesh>
      <mesh position={[-4.5, 1.6, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[10, 3.2]} />
        <WoodMaterial w={10} h={3.2} tint="#e0c09a" />
      </mesh>
      <mesh position={[0, 3.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[16, 10]} />
        <meshStandardMaterial color="#d8d4c8" roughness={0.95} emissive="#8a867a" emissiveIntensity={0.25} />
      </mesh>
      <CeilingLights y={3.15} xs={[-2.5, 0.5, 3.5]} zs={[-0.6, 1.6]} glow={1.0} />
      <pointLight position={[0, 2.9, 0.4]} intensity={10} distance={12} color="#f2f0e2" />
      <pointLight position={[-2.5, 2.9, -1.2]} intensity={6} distance={9} color="#f2f0e2" />
      {/* 窓（ブラインド。外は曇りの昼） */}
      <group position={[2.4, 1.75, -2.58]}>
        <mesh>
          <planeGeometry args={[1.6, 1.3]} />
          <meshStandardMaterial color="#000" emissive="#a9b4bd" emissiveIntensity={0.8} />
        </mesh>
        {Array.from({ length: 16 }, (_, k) => (
          <mesh key={k} position={[0, -0.6 + k * 0.08, 0.02]} rotation={[0.6, 0, 0]}>
            <planeGeometry args={[1.6, 0.05]} />
            <meshStandardMaterial color="#d8d0bf" roughness={0.7} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
      {/* 壁の湾の地図（小道具）と押しピン */}
      <mesh position={[-1.3, 1.62, -2.57]}>
        <planeGeometry args={[1.3, 0.98]} />
        <meshStandardMaterial map={chart} roughness={0.9} />
      </mesh>
      {[[-1.55, 1.78], [-1.2, 1.5], [-0.95, 1.7], [-1.4, 1.38]].map(([x, y], i) => (
        <mesh key={i} position={[x, y, -2.55]}>
          <sphereGeometry args={[0.012, 8, 8]} />
          <meshStandardMaterial color={i % 2 ? "#2f4c7a" : "#d8c860"} roughness={0.4} />
        </mesh>
      ))}
      {/* 机2つ */}
      <Desk position={[0, 0, 0]} />
      <Desk position={[2.6, 0, 0.3]} rotY={-0.05} />
      {/* 書類棚（奥の壁ぞい） */}
      {[0.6, 1.08, 1.56].map((x, k) => <FilingCabinet key={x} position={[x, 0, -2.25]} color={k === 1 ? "#5f625a" : "#6b6e66"} />)}
      {/* 左の壁の綴じ込みの棚（4段） */}
      <group position={[-4.25, 0, -0.6]}>
        <mesh position={[0, 1.0, 0]}>
          <boxGeometry args={[0.36, 2.0, 2.4]} />
          <meshStandardMaterial color="#58554c" roughness={0.6} metalness={0.3} transparent opacity={0} />
        </mesh>
        {[0.15, 0.6, 1.05, 1.5, 1.95].map((y) => (
          <mesh key={y} position={[0, y, 0]}>
            <boxGeometry args={[0.38, 0.03, 2.4]} />
            <meshStandardMaterial color="#5e5b52" roughness={0.5} metalness={0.3} />
          </mesh>
        ))}
        {[-1.2, 1.2].map((z) => (
          <mesh key={z} position={[0, 1.0, z]}>
            <boxGeometry args={[0.38, 2.0, 0.03]} />
            <meshStandardMaterial color="#5e5b52" roughness={0.5} metalness={0.3} />
          </mesh>
        ))}
        {[0.17, 0.62, 1.07, 1.52].map((y, k) => (
          <mesh key={y} position={[0.06, y + 0.17, 0]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[2.34, 0.34]} />
            <meshStandardMaterial map={binderSpines(k)} roughness={0.85} />
          </mesh>
        ))}
      </group>
      {children}
    </group>
  );
};

const useT = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return frame / fps;
};

export const InsertSfOffice006: React.FC<SceneProps> = ({ variant = "a" }) => {
  const t = useT();
  const frame = useCurrentFrame();
  const dur = useInsertDur();
  const p = frame / Math.max(1, dur - 1);
  const cams: Record<string, [CamKey, CamKey]> = {
    a: [{ pos: [1.25, 1.3, 1.45], target: [-0.6, 0.95, -1.4], fov: 40 }, { pos: [1.1, 1.28, 1.3], target: [-0.6, 0.95, -1.4], fov: 39 }],
    b: [{ pos: [0.9, 1.6, 1.4], target: [-1.3, 1.45, -2.6], fov: 40 }, { pos: [0.75, 1.58, 1.2], target: [-1.3, 1.45, -2.6], fov: 39 }],
    c: [{ pos: [0.95, 1.2, 0.95], target: [-0.1, 0.85, -0.05], fov: 36 }, { pos: [0.85, 1.18, 0.85], target: [-0.1, 0.85, -0.05], fov: 35 }],
    d: [{ pos: [1.6, 1.55, 2.4], target: [-0.1, 1.3, -1.0], fov: 40 }, { pos: [1.45, 1.53, 2.2], target: [-0.1, 1.3, -1.0], fov: 39 }],
    e: [{ pos: [0.42, 1.2, 0.66], target: [0.05, 0.84, 0.04], fov: 36 }, { pos: [0.39, 1.18, 0.62], target: [0.05, 0.84, 0.04], fov: 35 }],
    f: [{ pos: [-2.6, 1.3, 1.0], target: [-4.2, 1.0, -0.7], fov: 42 }, { pos: [-2.75, 1.28, 0.85], target: [-4.2, 1.0, -0.7], fov: 41 }],
  };
  const [from, to] = cams[variant] ?? cams.a;
  // 受付印：3秒あたりで1回、ゆっくり押して戻す
  const press = variant === "e" ? interpolate(p, [0.2, 0.38, 0.55, 0.72], [0, 1, 1, 0], clamp) : 0;
  const inked = variant === "e" && p > 0.4;
  return (
    <Stage fog={0.01} exposure={1.05} bloom={0} bg="#0d0c0b" hemi={["#efe6d2", "#3a3022", 0.6]}>
      <Cam006 from={from} to={to} near={0.03} far={60} />
      <Office>
        {/* 主な机の上 */}
        {variant !== "c" && variant !== "e" ? <Typewriter position={[0.28, 0.76, 0.05]} rotY={-0.1} /> : null}
        <DeskPhone position={[0.6, 0.76, -0.2]} rotY={-0.4} />
        <PaperStack position={[-0.35, 0.76, 0.05]} rotY={0.1} seed={1} n={variant === "c" ? 3 : 6} />
        {variant === "c" ? (
          <group>
            {[0, 1, 2, 3, 4, 5, 6].map((k) => (
              <mesh key={k} position={[-0.25 + (random(`cf${k}`) - 0.5) * 0.03, 0.78 + k * 0.035, -0.05]} rotation={[0, (random(`cr${k}`) - 0.5) * 0.25, 0]} castShadow>
                <boxGeometry args={[0.24, 0.03, 0.31]} />
                <meshStandardMaterial color={["#c9a86a", "#b89a62", "#d4b47a"][k % 3]} roughness={0.9} />
              </mesh>
            ))}
            {[0, 1, 2, 3].map((k) => (
              <mesh key={`b${k}`} position={[0.08 + (random(`cg${k}`) - 0.5) * 0.03, 0.78 + k * 0.035, 0.1]} rotation={[0, 0.3 + (random(`ch${k}`) - 0.5) * 0.2, 0]} castShadow>
                <boxGeometry args={[0.24, 0.03, 0.31]} />
                <meshStandardMaterial color={["#b89a62", "#c9a86a"][k % 2]} roughness={0.9} />
              </mesh>
            ))}
            <DeskCalendar position={[0.4, 0.76, 0.15]} rotY={-0.5} t={t} />
          </group>
        ) : null}
        {variant === "e" ? (
          <group>
            <mesh position={[0.02, 0.765, 0.08]} rotation={[-Math.PI / 2, 0, 0.08]}>
              <planeGeometry args={[0.216, 0.279]} />
              <meshStandardMaterial map={paperTexture(7)} roughness={0.9} />
            </mesh>
            {inked ? (
              <mesh position={[0.05, 0.767, 0.02]} rotation={[-Math.PI / 2, 0, 0.08]}>
                <planeGeometry args={[0.065, 0.04]} />
                <meshStandardMaterial color="#2a3550" roughness={0.9} transparent opacity={0.75} />
              </mesh>
            ) : null}
            <Stamp position={[0.05, 0.765, 0.02]} press={press} />
          </group>
        ) : null}
        {variant === "a" ? <FileBox position={[2.4, 0.76, 0.2]} rotY={0.1} seed={5} lid /> : null}
        {/* 人物（後ろ姿だけ） */}
        {variant === "a" ? <Figure clip="Idle_Loop" position={[-1.5, 0, -1.55]} rotationY={Math.PI} build={AGENT_62} glasses={false} /> : null}
        {variant === "b" ? <Figure clip="Idle_Loop" position={[-1.25, 0, -1.75]} rotationY={Math.PI + 0.08} build={AGENT_62} glasses={false} /> : null}
        {variant === "d" ? (
          <group>
            <Figure clip="Idle_Loop" position={[0.15, 0, -0.75]} rotationY={Math.PI - 0.2} build={AGENT_62} glasses={false} pose={PHONE_ARM} />
            {/* 電話の台から耳もとへ延びるコード */}
            <mesh>
              <tubeGeometry args={[new THREE.CatmullRomCurve3([new THREE.Vector3(0.6, 0.82, -0.2), new THREE.Vector3(0.5, 0.95, -0.45), new THREE.Vector3(0.32, 1.3, -0.7), new THREE.Vector3(0.26, 1.55, -0.78)]), 20, 0.006, 6, false]} />
              <meshStandardMaterial color="#141414" roughness={0.5} />
            </mesh>
          </group>
        ) : null}
      </Office>
    </Stage>
  );
};
