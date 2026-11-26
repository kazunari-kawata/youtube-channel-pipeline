/**
 * 003 D.B.クーパー（1971年11月24日の夜〜1980年）のイメージ映像：屋外と窓の場面（人物なし）
 *   plane_clouds：雨雲の中を行く旅客機の灯り、雲の上から見下ろす森、夜の滑走路で待つ機体、後ろの階段を下ろして飛ぶ機体（i）
 *   rain_window：雨の窓（夜の空港の灯り、駐機場の機体、近づく車の灯り）
 *   rain_forest：ワシントン州南西部のダグラスファーの森（夜の雨、霧の明け方、雨の上がった朝）
 *   river_bank：冬のコロンビア川の岸（砂と流木、川の流れ）
 *   exit_diagram：727 の模式図。1972年の規則で「飛行中は開かない」作りになった、胴体の下側の後ろの階段を赤く示す
 * 飛び降りる姿や、落ちていく人は描かない（plan.md）。機体に航空会社の塗装・ロゴ・文字は入れない。
 * 動くものはゆっくり（雨は降る筋を描かず、窓の粒と霧と音で出す。速く落ちる細い線はチラつきになる）。
 */
import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { Camera, CamKey, SceneProps, Stage } from "./Inserts";
import { FONT } from "../lib/font";
import { bokehTexture, CloudLayer, Driftwood, dropsTexture, Forest, Jet727, sandTexture } from "./Props003";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
type V3 = [number, number, number];

/* ---------- 1. 雲の中の旅客機・雲の上から見た森・夜の滑走路 ---------- */

/** 濡れた舗装（駐機場・滑走路） */
const Tarmac: React.FC<{ size?: number; color?: string }> = ({ size = 400, color = "#101214" }) => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
    <planeGeometry args={[size, size]} />
    <meshStandardMaterial color={color} roughness={0.28} metalness={0.25} />
  </mesh>
);

/** 滑走路の縁の灯り（点滅させない。にじまない明るさ） */
const RunwayLights: React.FC<{ z: number; x0: number; x1: number; step?: number; color?: string; k?: number }> = ({ z, x0, x1, step = 12, color = "#ffe2b0", k = 1.3 }) => {
  const xs = useMemo(() => Array.from({ length: Math.floor((x1 - x0) / step) + 1 }, (_, i) => x0 + i * step), [x0, x1, step]);
  const c = useMemo(() => new THREE.Color(color).multiplyScalar(k), [color, k]);
  return (
    <group>
      {xs.map((x) => (
        <mesh key={x} position={[x, 0.25, z]}>
          <sphereGeometry args={[0.18, 8, 8]} />
          <meshBasicMaterial color={c} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
};

export const InsertPlaneClouds003: React.FC<SceneProps> = ({ variant = "a" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  if (variant === "d") return <ForestFromAbove t={t} />;
  if (variant === "e") return <RunwayNight t={t} />;
  if (variant === "f") return <TakeoffNight t={t} />;
  if (variant === "g") return <LandingNight t={t} />;
  // a・b・c：夜の雨雲の中。機体はゆっくり遠ざかる（画面の上で速く動かない距離に置く）
  const planeX = -t * 4; // 機体はゆっくり遠ざかる（カメラも少し追う）
  const fade = variant === "c" ? interpolate(t, [1.5, 6.5], [0.9, 0], clamp) : 0.5;
  const cams: Record<string, [CamKey, CamKey]> = {
    a: [{ pos: [38, -5, 34], target: [0, 0, 0], fov: 34 }, { pos: [30, -4.5, 32], target: [-24, 0, 0], fov: 33 }], // 後ろ下から、雨雲の中を遠ざかる機体
    b: [{ pos: [70, 6, 120], target: [-10, 0, 0], fov: 24 }, { pos: [62, 6.5, 116], target: [-30, 0, 0], fov: 23 }], // さらに遠くから
    // 雲だけ、遠い灯りが消える。雲の板は +z を向いているので、カメラは -z の方を向ける（横から見ると板が細くなって何も映らない）
    c: [{ pos: [10, 2, 62], target: [-6, 1, 0], fov: 34 }, { pos: [8, 2.2, 59], target: [-11, 1, 0], fov: 33 }],
    zz: [{ pos: [0, 10, 70], target: [0, 0, 0], fov: 40 }, { pos: [0, 10, 70], target: [0, 0, 0], fov: 40 }], // 確認用：機体を横から（本編では使わない）
    // h：夕方、雲の上で旋回しながら待つ機体（シアトルの上空を回って金を待った時間）。斜め上から
    h: [{ pos: [34, 4, 46], target: [-2, 1, 0], fov: 30 }, { pos: [29, 3.8, 44], target: [-12, 1, 0], fov: 29 }],
    // i：午後8時11分。後ろの階段を下ろしたまま、夜の雨雲の中を飛ぶ機体を、後ろの斜め下から（人物は描かない。飛び降りる姿も描かない）
    i: [{ pos: [52, -10, 22], target: [10, -1.5, 0], fov: 33 }, { pos: [46, -9.5, 21], target: [-6, -1.5, 0], fov: 32 }],
  };
  const [from, to] = cams[variant] ?? cams.a;
  // c は機体がないので、雲そのものを見せる：月明かりを強めて、雲を明るく濃くする（暗いままだと何も映らない画面になる）
  const cl =
    variant === "c"
      ? { k: 2.4, lo: "#aab6cc", hi: "#9aa6bc", mid: "#b6c0d4", near: "#c2cadc", op: 1.25 }
      : variant === "h"
        ? { k: 1.8, lo: "#a4929a", hi: "#8a8496", mid: "#b09ea2", near: "#bcaeb0", op: 1.1 } // 夕方：雲の上の面に残る夕日の色
        : { k: 1.5, lo: "#8f9bb4", hi: "#7d89a3", mid: "#9ca8c0", near: "#a8b2c8", op: 1.1 };
  return (
    <Stage fog={variant === "b" ? 0.006 : variant === "c" ? 0.006 : 0.008} exposure={1.15} bloom={0.5} bg={variant === "c" ? "#151b28" : variant === "h" ? "#3b3a4c" : "#1b2333"} hemi={variant === "h" ? ["#c8a898", "#1a1820", 0.9] : ["#6a7a9a", "#10131a", 0.9]}>
      <Camera from={from} to={to} />
      <directionalLight position={variant === "h" ? [-60, 25, 20] : [40, 60, 30]} intensity={cl.k} color={variant === "h" ? "#e6b894" : "#a8b8d8"} />
      {variant !== "c" ? <Jet727 position={[planeX, 0, 0]} rotation={[variant === "h" ? 0.2 : 0, Math.PI, 0.02]} lights={0.9} cabin={0.6} stairs={variant === "i"} /> : null}
      {variant === "c" ? (
        // 遠い灯りだけ。だんだん雲に消えていく
        <mesh position={[-14 - t * 3, 3, -40]}>
          <sphereGeometry args={[0.35, 10, 10]} />
          <meshBasicMaterial color={new THREE.Color("#ffffff").multiplyScalar(fade * 2)} toneMapped={false} transparent opacity={Math.min(1, fade * 2)} />
        </mesh>
      ) : null}
      <CloudLayer t={t} y={-14} count={30} spread={220} drift={2.5} color={cl.lo} opacity={Math.min(1, 0.85 * cl.op)} seed={11} size={70} />
      <CloudLayer t={t} y={16} count={26} spread={220} drift={1.6} color={cl.hi} opacity={Math.min(1, 0.7 * cl.op)} seed={12} size={80} />
      <group position={[0, 0, -30]}>
        <CloudLayer t={t} y={2} count={variant === "c" ? 22 : 14} spread={160} drift={3.2} color={cl.mid} opacity={Math.min(1, 0.5 * cl.op)} seed={13} size={50} />
      </group>
      {/* 手前を流れる薄い雲（雲の中を飛んでいる感じ）。カメラに近いのでごく薄く、ゆっくり */}
      <group position={[20, 0, 18]}>
        <CloudLayer t={t} y={-1} count={8} spread={120} drift={2.0} color={cl.near} opacity={0.28} seed={14} size={40} />
      </group>
      {variant === "zz" ? <ambientLight intensity={2} /> : null}
    </Stage>
  );
};

/** 雲の上から見下ろす、暗い森の広がり（夜。月明かりがうっすら） */
const ForestFromAbove: React.FC<{ t: number }> = ({ t }) => {
  const from: CamKey = { pos: [0, 120, 60], target: [0, 0, -20], fov: 38 };
  const to: CamKey = { pos: [-6, 118, 54], target: [-6, 0, -26], fov: 37 };
  return (
    <Stage fog={0.003} exposure={1.2} bloom={0} bg="#1a2232" hemi={["#7a8aaa", "#10141a", 0.9]}>
      <Camera from={from} to={to} />
      <directionalLight position={[-50, 80, 40]} intensity={1.2} color="#a8b8d8" />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[600, 600]} />
        <meshStandardMaterial color="#1e281f" roughness={1} />
      </mesh>
      {/* 森（遠いので円錐を大きめに、まばらに） */}
      <Forest seed={21} n={600} x={[-160, 160]} z={[-200, 80]} h={[22, 38]} color="#2a3a2e" />
      {/* 森を横切る川の暗い筋 */}
      <mesh position={[30, 0.3, -30]} rotation={[-Math.PI / 2, 0, 0.5]}>
        <planeGeometry args={[14, 500]} />
        <meshStandardMaterial color="#1a2230" roughness={0.3} metalness={0.3} />
      </mesh>
      {/* 雲の層（カメラと森の間を、ゆっくり流れる） */}
      <CloudLayer t={t} y={70} count={14} spread={320} drift={2.2} color="#9aa6be" opacity={0.4} seed={31} size={80} facing="up" />
      <CloudLayer t={t} y={95} count={7} spread={320} drift={3.0} color="#aab4c8" opacity={0.25} seed={32} size={60} facing="up" />
    </Stage>
  );
};

/** 夜の滑走路で待つ旅客機の後ろ姿（塗装・ロゴなし。人物なし） */
const RunwayNight: React.FC<{ t: number }> = ({ t }) => {
  const from: CamKey = { pos: [-70, 4, 10], target: [0, 4, 0], fov: 30 };
  const to: CamKey = { pos: [-66, 4.2, 9.5], target: [0, 4, 0], fov: 29.5 };
  const bokeh = bokehTexture("runway", ["#ffd9a0", "#a8c8ff", "#fff2d8"], 30);
  return (
    <Stage fog={0.008} exposure={1.2} bloom={0.4} bg="#161d2b" hemi={["#5a6a8a", "#0c0e12", 0.8]}>
      <Camera from={from} to={to} />
      <Tarmac />
      {/* 機体は滑走路の端で待つ（後ろの階段は閉じている） */}
      <Jet727 position={[0, 2.95, 0]} rotation={[0, 0, 0]} lights={0.8} cabin={0.45} />
      <RunwayLights z={-24} x0={-140} x1={160} />
      <RunwayLights z={24} x0={-140} x1={160} />
      <RunwayLights z={-10} x0={-100} x1={-40} step={8} color="#7aa8ff" k={1.1} />
      <mesh position={[60, 12, -160]}>
        <planeGeometry args={[400, 40]} />
        <meshBasicMaterial map={bokeh} />
      </mesh>
      <spotLight position={[-40, 30, 25]} angle={0.5} penumbra={1} intensity={2500} distance={0} decay={2} color="#cfd8ea" />
      {/* 雨の夜の空の雲（低く） */}
      <CloudLayer t={t} y={45} count={16} spread={300} drift={1.0} color="#2c3446" opacity={0.6} seed={41} size={90} />
    </Stage>
  );
};

/** f：シアトル・タコマ空港を再び離陸する 305便（2026-11-26 ユーザーの指示。4:28 の「再び離陸します」）。
 *  滑走の途中から、後ろの斜めから見る。機体は遠ざかりながら機首を上げ、雨の夜へ上っていく。
 *  画面を横切らせない（灯りが速く横に動くとチラつく）。遠ざかるほど霧に溶ける */
const TakeoffNight: React.FC<{ t: number }> = ({ t }) => {
  const from: CamKey = { pos: [-72, 2.6, 22], target: [10, 6, 0], fov: 30 };
  const to: CamKey = { pos: [-71, 2.7, 21.5], target: [55, 13, 0], fov: 29 };
  const bokeh = bokehTexture("runway", ["#ffd9a0", "#a8c8ff", "#fff2d8"], 30);
  const tr = 1.0; // 機首を上げはじめる時刻（区間は5秒ほど）
  const x = -40 + 30 * t + 1.5 * t * t; // 滑走の途中から加速
  const pitch = interpolate(t, [tr, tr + 1.6], [0, 0.13], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const climb = Math.max(0, t - tr - 0.6);
  // 機体の中心で回すと尾部が地面に沈むので、尾部の近くを支点にしたように中心を持ち上げる
  const y = 2.95 + 17 * Math.sin(pitch) + 2.4 * climb * climb;
  // 機体を照らす点光源は、濡れた滑走路に白い縦の筋を映すので使わない。空の明るさ（hemi）を上げて機体の形を出す
  return (
    <Stage fog={0.0035} exposure={1.2} bloom={0.4} bg="#161d2b" hemi={["#8a9aba", "#0c0e12", 1.9]}>
      <Camera from={from} to={to} />
      <Tarmac />
      <Jet727 position={[x, y, 0]} rotation={[0, 0, pitch]} lights={0.8} cabin={0.45} gear />
      <RunwayLights z={-24} x0={-140} x1={420} />
      <RunwayLights z={24} x0={-140} x1={420} />
      <mesh position={[160, 14, -200]}>
        <planeGeometry args={[520, 44]} />
        <meshBasicMaterial map={bokeh} />
      </mesh>
      <spotLight position={[-40, 30, 25]} angle={0.5} penumbra={1} intensity={2500} distance={0} decay={2} color="#cfd8ea" />
      <CloudLayer t={t} y={45} count={16} spread={400} drift={1.0} color="#2c3446" opacity={0.6} seed={41} size={90} />
    </Stage>
  );
};

/** g：シアトル・タコマ空港に着陸して滑走する 305便（2026-11-26 ユーザーの指示。「着陸したのは、午後5時46分です」）。
 *  滑走路の端の近くから、奥を正面に見る。機体は遠くで降りてきて接地し、こちらへ向かって減速しながら滑走し、手前に来る前に止まる。
 *  正面から近づくだけで、画面を横切らせない（灯りが速く横に動くとチラつく） */
const LandingNight: React.FC<{ t: number }> = ({ t }) => {
  const from: CamKey = { pos: [-80, 3.0, 20], target: [160, 7, 0], fov: 22 };
  const to: CamKey = { pos: [-80, 3.0, 20], target: [60, 4, 0], fov: 22 };
  const bokeh = bokehTexture("runway", ["#ffd9a0", "#a8c8ff", "#fff2d8"], 30);
  const td = 1.8; // 接地の時刻（区間は6秒ほど）
  const v = 48; // 接地の速さ（m/秒。少し遅めにして画面の動きを抑える）
  const xTd = 180;
  // 接地までは一定の速さで降りてくる。接地のあとは減速しながら、カメラの 100m ほど先まで滑走する
  const x = t < td ? xTd + v * (td - t) : xTd - v * (t - td) + 2.5 * (t - td) * (t - td);
  const y = t < td ? 2.95 + 2.6 * (td - t) * (td - t) : 2.95;
  // 着陸の直前に機首を少し上げ、接地のあと下ろす
  const pitch = t < td ? interpolate(t, [0, td], [0.03, 0.07], clamp) : interpolate(t, [td, td + 1.5], [0.07, 0], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  return (
    <Stage fog={0.003} exposure={1.2} bloom={0.4} bg="#161d2b" hemi={["#8a9aba", "#0c0e12", 1.9]}>
      <Camera from={from} to={to} />
      <Tarmac />
      <Jet727 position={[x, y, 0]} rotation={[0, Math.PI, pitch]} lights={0.8} cabin={0.45} gear />
      {/* 着陸灯（主翼の付け根、こちら向き）。にじみのしきい値より暗く */}
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[x - 6, y - 0.6, sd * 3.2]}>
          <sphereGeometry args={[0.28, 12, 10]} />
          <meshBasicMaterial color={new THREE.Color("#fff2d8").multiplyScalar(1.2)} toneMapped={false} />
        </mesh>
      ))}
      <RunwayLights z={-24} x0={-140} x1={460} />
      <RunwayLights z={24} x0={-140} x1={460} />
      <mesh position={[160, 14, -200]}>
        <planeGeometry args={[520, 44]} />
        <meshBasicMaterial map={bokeh} />
      </mesh>
      <spotLight position={[-40, 30, 25]} angle={0.5} penumbra={1} intensity={2500} distance={0} decay={2} color="#cfd8ea" />
      <CloudLayer t={t} y={45} count={16} spread={400} drift={1.0} color="#2c3446" opacity={0.6} seed={42} size={90} />
    </Stage>
  );
};

/* ---------- 2. 雨の窓 ---------- */

/** 室内側の窓枠と、雨粒の付いたガラス。外の景色は children */
const WetWindow: React.FC<{ drops?: number; frameColor?: string; children: React.ReactNode; t: number }> = ({ drops = 0.75, frameColor = "#2a2620", children, t }) => {
  const tex = dropsTexture();
  // 流れ落ちる粒をいくつか（ゆっくり。1秒に数センチ）
  const trickles = useMemo(() => Array.from({ length: 9 }, (_, i) => ({ x: (random(`tr${i}`) - 0.5) * 3.2, y0: 0.9 + random(`ty${i}`) * 0.5, v: 0.02 + random(`tv${i}`) * 0.03, r: 0.006 + random(`trr${i}`) * 0.006 })), []);
  return (
    <group>
      {/* 窓の外の景色 */}
      {children}
      {/* 窓ガラスの雨粒（静止）と流れる粒 */}
      {drops > 0 ? (
        <mesh position={[0, 1.5, 0]}>
          <planeGeometry args={[3.6, 2.25]} />
          <meshBasicMaterial map={tex} color="#9fb2c6" transparent opacity={drops * 0.45} depthWrite={false} />
        </mesh>
      ) : null}
      {drops > 0
        ? trickles.map((d, i) => (
            <mesh key={i} position={[d.x, 1.5 + d.y0 - ((t * d.v) % 1.6), 0.005]}>
              <circleGeometry args={[d.r, 10]} />
              <meshBasicMaterial color="#9fb2c6" transparent opacity={0.3} depthWrite={false} />
            </mesh>
          ))
        : null}
      {/* 窓枠（4本）と真ん中の桟 */}
      {[
        { p: [0, 2.68, 0.05], s: [3.9, 0.14, 0.12] },
        { p: [0, 0.32, 0.05], s: [3.9, 0.14, 0.12] },
        { p: [-1.88, 1.5, 0.05], s: [0.14, 2.5, 0.12] },
        { p: [1.88, 1.5, 0.05], s: [0.14, 2.5, 0.12] },
        { p: [0, 1.5, 0.05], s: [0.06, 2.3, 0.08] },
      ].map((b, i) => (
        <mesh key={i} position={b.p as V3}>
          <boxGeometry args={b.s as V3} />
          <meshStandardMaterial color={frameColor} roughness={0.6} />
        </mesh>
      ))}
      {/* 窓の周りの壁（室内は暗い） */}
      {[
        { p: [-4.5, 1.5, 0.1], s: [5, 6] },
        { p: [4.5, 1.5, 0.1], s: [5, 6] },
        { p: [0, 4.0, 0.1], s: [4, 2.5] },
        { p: [0, -0.9, 0.1], s: [4, 2.5] },
      ].map((w, i) => (
        <mesh key={`w${i}`} position={w.p as V3}>
          <planeGeometry args={w.s as [number, number]} />
          <meshStandardMaterial color="#1a1816" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
};

/** 昼・夕方の窓の外の遠景：空のグラデーション、遠い丘の稜線、低い格納庫の並び（実在の空港の建物はまねない）。
 *  空が一色で舗装が黒いだけだと、上下に塗り分けた板にしか見えないので、地平線に物を置いて奥行きを出す */
const DayBackdrop: React.FC<{ look: "overcast" | "clearing" }> = ({ look }) => {
  const sky = useMemo(() => {
    const cv = document.createElement("canvas");
    cv.width = 512; cv.height = 512;
    const c = cv.getContext("2d")!;
    const g = c.createLinearGradient(0, 0, 0, 512);
    if (look === "overcast") { g.addColorStop(0, "#58616c"); g.addColorStop(0.75, "#a9b0b8"); g.addColorStop(1, "#bcc2c8"); }
    else { g.addColorStop(0, "#39414f"); g.addColorStop(0.55, "#7d7f88"); g.addColorStop(0.85, "#c6a88c"); g.addColorStop(1, "#d8b896"); }
    c.fillStyle = g; c.fillRect(0, 0, 512, 512);
    // 雲の筋（横に長く、薄く）
    for (let i = 0; i < 24; i++) {
      const x = random(`dbx${look}${i}`) * 512, y = 40 + random(`dby${look}${i}`) * 360, rx = 60 + random(`dbr${look}${i}`) * 140;
      c.save(); c.translate(x, y); c.scale(1, 0.2);
      const gg = c.createRadialGradient(0, 0, 0, 0, 0, rx);
      gg.addColorStop(0, look === "overcast" ? "rgba(70,78,88,0.1)" : "rgba(60,64,78,0.12)");
      gg.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = gg; c.fillRect(-rx, -rx, rx * 2, rx * 2); c.restore();
    }
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [look]);
  const ridge = useMemo(() => {
    const cv = document.createElement("canvas");
    cv.width = 1024; cv.height = 128;
    const c = cv.getContext("2d")!;
    c.clearRect(0, 0, 1024, 128);
    c.fillStyle = look === "overcast" ? "#6f7880" : "#55596a";
    c.beginPath(); c.moveTo(0, 128);
    for (let x = 0; x <= 1024; x += 8) {
      const y = 70 - 26 * Math.sin(x / 170 + 1.3) - 14 * Math.sin(x / 61) - 8 * random(`rg${x}`);
      c.lineTo(x, y);
    }
    c.lineTo(1024, 128); c.closePath(); c.fill();
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [look]);
  const hangar = look === "overcast" ? "#5b6066" : "#4a4c54";
  return (
    <group>
      {/* カメラの奥の限り（300m）より手前に置く */}
      <mesh position={[0, 70, -240]}>
        <planeGeometry args={[800, 200]} />
        <meshBasicMaterial map={sky} fog={false} />
      </mesh>
      <mesh position={[0, 11, -225]}>
        <planeGeometry args={[760, 46]} />
        <meshBasicMaterial map={ridge} transparent fog={false} depthWrite={false} />
      </mesh>
      {/* 低い格納庫と建物（窓や文字は描かない） */}
      {[[-90, 26, 9], [-52, 18, 6], [30, 34, 11], [78, 14, 5], [110, 22, 7]].map(([x, w, h], i) => (
        <mesh key={i} position={[x * 0.8, h / 2, -165 - i * 5]}>
          <boxGeometry args={[w, h, 14]} />
          <meshStandardMaterial color={hangar} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
};

export const InsertRainWindow003: React.FC<SceneProps> = ({ variant = "d" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const day = variant === "e" || variant === "c" || variant === "f";
  const cams: Record<string, [CamKey, CamKey]> = {
    b: [{ pos: [0.3, 1.5, 2.6], target: [0, 1.5, 0], fov: 40 }, { pos: [0.25, 1.5, 2.3], target: [0, 1.5, 0], fov: 39 }], // 夜の雨の窓（室内側から）
    c: [{ pos: [-0.6, 1.45, 2.4], target: [0.4, 2.5, -10], fov: 42 }, { pos: [-0.55, 1.45, 2.2], target: [0.4, 2.5, -10], fov: 41 }], // 雨の上がった窓、遠い滑走路の灯り
    d: [{ pos: [0.8, 1.55, 2.2], target: [-0.3, 1.5, -10], fov: 40 }, { pos: [0.7, 1.55, 2.0], target: [-0.3, 1.5, -10], fov: 39 }], // 雨の窓に映る空港の灯り
    e: [{ pos: [0.2, 1.6, 2.6], target: [0, 3.6, -30], fov: 40 }, { pos: [0.15, 1.6, 2.4], target: [0, 3.6, -30], fov: 39 }], // 窓越しの機体の尾部
    g: [{ pos: [0.5, 1.6, 2.5], target: [0, 1.4, -30], fov: 42 }, { pos: [0.45, 1.6, 2.3], target: [0, 1.4, -30], fov: 41 }], // 雨の駐機場の機体と、近づく車の灯り
    f: [{ pos: [0.4, 1.55, 2.6], target: [-2, 2.6, -40], fov: 40 }, { pos: [0.35, 1.55, 2.35], target: [-2, 2.6, -40], fov: 39 }], // 昼の雨の窓越しに、搭乗口の 727 を横から（機体の全体）
  };
  const [from, to] = cams[variant] ?? cams.d;
  // g：近づく車の灯り（遠くから、ゆっくり明るくなる。画面を横切らない）
  const car = useMemo(() => new THREE.SpotLight("#f4f0e4", 0, 0, 0.5, 1.0, 2), []);
  const cz = interpolate(t, [0, 8], [-120, -55], clamp);
  car.intensity = variant === "g" ? interpolate(t, [0, 3], [30, 120], clamp) : 0;
  car.position.set(14, 0.9, cz);
  car.target.position.set(6, 0.3, cz + 30);
  const bokeh = useMemo(() => bokehTexture("nightport", ["#ffd9a0", "#ffe9c8", "#9fc3ff"], 46), []);
  const outsideBg = day ? "#6d7680" : "#141a26";
  return (
    <Stage fog={day ? 0.006 : 0.006} exposure={day ? 1.0 : 1.15} bloom={day ? 0 : 0.3} bg={outsideBg} hemi={day ? ["#b6c0cc", "#3a3a3c", 0.8] : ["#4a5a7a", "#0a0c10", 0.7]}>
      <Camera from={from} to={to} />
      <WetWindow t={t} drops={variant === "c" ? 0.3 : variant === "e" || variant === "f" ? 0.45 : 0.8}>
        <group position={[0, 0, -2]}>
          {day ? (
            <>
              {/* 昼の濡れた舗装：空の明るさを受けて灰色に見える（金属っぽくすると真っ黒になる） */}
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[400, 400]} />
                <meshStandardMaterial color="#6c7177" roughness={0.55} metalness={0} />
              </mesh>
              <DayBackdrop look={variant === "c" ? "clearing" : "overcast"} />
            </>
          ) : (
            <Tarmac color="#0c0e11" />
          )}
          {day ? null : (
            <mesh position={[0, 14, -170]}>
              <planeGeometry args={[420, 50]} />
              <meshBasicMaterial map={bokeh} />
            </mesh>
          )}
          {variant === "e" || variant === "g" || variant === "f" ? (
            <Jet727
              position={variant === "e" ? [16, 2.95, -72] : variant === "f" ? [-6, 2.95, -62] : [-4, 2.95, -60]}
              rotation={[0, variant === "e" ? Math.PI / 2 + 0.5 : variant === "f" ? -0.22 : -0.5, 0]}
              lights={day ? 0 : 0.7}
              cabin={day ? 0 : 0.35}
              gear
            />
          ) : null}
          {variant === "c" ? <RunwayLights z={-80} x0={-120} x1={120} step={10} color="#7aa8ff" k={1.0} /> : null}
          {/* c：滑走路の上に止まった 727（滑走路だと分かるように。動かさない）。画面の真ん中に置く（窓の桟が掛かっても真ん中を優先：ユーザー判断、F-050） */}
          {variant === "c" ? <Jet727 position={[12, 2.95, -88]} rotation={[0, 0.08, 0]} lights={0} cabin={0} gear /> : null}
          {variant === "d" || variant === "b" ? <RunwayLights z={-90} x0={-140} x1={140} step={9} color="#ffd9a0" k={1.0} /> : null}
          {day ? <directionalLight position={[-20, 40, 20]} intensity={0.9} color="#d8dee6" /> : null}
          {/* 駐機場の投光器（機体をうっすら照らす） */}
          {!day && variant === "g" ? <pointLight position={[-14, 30, -48]} intensity={900} distance={0} decay={2} color="#ffe2b8" /> : null}
          <primitive object={car} />
          <primitive object={car.target} />
        </group>
      </WetWindow>
      {/* 室内のごく弱い明かり（窓枠の輪郭が見える程度） */}
      <pointLight position={[0.5, 2.2, 2.2]} intensity={day ? 1 : 1.5} distance={5} color="#ffdcae" />
    </Stage>
  );
};

/* ---------- 3. ダグラスファーの森 ---------- */

/** 霧の板（ゆっくり横に流れる） */
const Mist: React.FC<{ t: number; y: number; z: number; color: string; opacity: number; seed: number }> = ({ t, y, z, color, opacity, seed }) => (
  <group position={[0, 0, z]}>
    <CloudLayer t={t} y={y} count={10} spread={90} drift={0.4} color={color} opacity={opacity} seed={seed} size={36} />
  </group>
);

/** シダと下草（地面の低い緑） */
const Undergrowth: React.FC<{ seed: number; n: number; color: string }> = ({ seed, n, color }) => {
  const items = useMemo(
    () => Array.from({ length: n }, (_, i) => ({ x: (random(`ug${seed}x${i}`) - 0.5) * 60, z: -random(`ug${seed}z${i}`) * 50 + 6, s: 0.4 + random(`ug${seed}s${i}`) * 0.8, r: random(`ug${seed}r${i}`) * 3 })),
    [seed, n],
  );
  return (
    <group>
      {items.map((u, i) => (
        <mesh key={i} position={[u.x, u.s * 0.25, u.z]} rotation={[0, u.r, 0]} scale={[u.s, u.s * 0.5, u.s]}>
          <sphereGeometry args={[0.6, 7, 5]} />
          <meshStandardMaterial color={color} roughness={1} />
        </mesh>
      ))}
    </group>
  );
};

export const InsertRainForest003: React.FC<SceneProps> = ({ variant = "a" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  type Look = { bg: string; fog: number; hemi: [string, string, number]; sun: number; sunColor: string; mist: string; mistO: number; tree: string | undefined; ground: string; exposure: number };
  const looks: Record<string, Look> = {
    night: { bg: "#232c3c", fog: 0.035, hemi: ["#8090b0", "#141a14", 1.1], sun: 0.9, sunColor: "#a8bcdc", mist: "#6a7a94", mistO: 0.35, tree: "#22322a", ground: "#1e2820", exposure: 1.3 },
    dawn: { bg: "#5e6870", fog: 0.07, hemi: ["#8e9aa8", "#1c1f1c", 0.7], sun: 0.35, sunColor: "#b8c4d0", mist: "#a8b2bc", mistO: 0.45, tree: "#1e2a24", ground: "#232a22", exposure: 1.0 },
    morning: { bg: "#8d969a", fog: 0.035, hemi: ["#c8d0d4", "#2a2a22", 0.8], sun: 1.1, sunColor: "#f2e2c4", mist: "#d8dcd8", mistO: 0.3, tree: "#22322a", ground: "#2c3424", exposure: 1.0 },
  };
  const lookKey = variant === "c" ? "dawn" : variant === "d" || variant === "e" ? "morning" : "night";
  const L = looks[lookKey];
  const cams: Record<string, [CamKey, CamKey]> = {
    a: [{ pos: [0, 2.0, 14], target: [0, 9, -20], fov: 46 }, { pos: [0, 2.1, 12.5], target: [0.3, 9.5, -20], fov: 45 }], // 夜の雨の森（下から幹と枝の重なり）
    b: [{ pos: [-8, 14, 18], target: [4, 6, -18], fov: 42 }, { pos: [-7.6, 13.6, 17], target: [4, 6, -18], fov: 41 }], // 別の場所（斜面の上から）
    c: [{ pos: [2, 1.8, 14], target: [-2, 7, -25], fov: 46 }, { pos: [1.8, 1.85, 13.0], target: [-2, 7.2, -25], fov: 45 }], // 霧の明け方
    d: [{ pos: [0, 1.8, 13], target: [0, 11, -20], fov: 46 }, { pos: [0, 1.9, 12.0], target: [0, 11.5, -20], fov: 45 }], // 雨の上がった朝
    e: [{ pos: [8, 3.0, 14], target: [-4, 9, -18], fov: 44 }, { pos: [7.6, 3.1, 13.2], target: [-4, 9.2, -18], fov: 43 }], // 朝の光が差す森を別の場所から
  };
  const [from, to] = cams[variant] ?? cams.a;
  const seed = variant === "b" || variant === "e" ? 52 : 51;
  return (
    <Stage fog={L.fog} exposure={L.exposure} bloom={0} bg={L.bg} hemi={L.hemi}>
      <Camera from={from} to={to} />
      <directionalLight position={variant === "e" ? [-30, 30, 10] : [20, 40, 10]} intensity={L.sun} color={L.sunColor} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color={L.ground} roughness={1} />
      </mesh>
      <Forest seed={seed} n={170} x={[-40, 40]} z={[-70, 0]} h={[16, 30]} color={L.tree} />
      <Undergrowth seed={seed} n={90} color={lookKey === "night" ? "#152016" : "#2a3a24"} />
      {/* 倒れた木（森の床に） */}
      <Driftwood position={[2.5, 0.35, -4]} len={9} r={0.45} rotY={0.6} />
      <Mist t={t} y={2.5} z={-12} color={L.mist} opacity={L.mistO} seed={seed} />
      <Mist t={t} y={6} z={-28} color={L.mist} opacity={L.mistO * 0.8} seed={seed + 1} />
      {lookKey === "morning" ? (
        // 朝の光の筋（静止した、うっすらした板）
        <group>
          {[-6, -1, 4].map((x, i) => (
            <mesh key={i} position={[x, 10, -16 - i * 4]} rotation={[0, 0, variant === "e" ? -0.45 : 0.4]}>
              <planeGeometry args={[1.6, 28]} />
              <meshBasicMaterial color="#fff2d6" transparent opacity={0.05} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
            </mesh>
          ))}
        </group>
      ) : null}
    </Stage>
  );
};

/* ---------- 3b. 森の床に落ちた表示の切れ端（1978年11月、キャッスルロックの東の山中） ---------- */
// 2026-11-26：7:55 の「着地点を絞る手がかりにはならなかった」に置いていた夜の雨の窓が、何の絵か分からなかった（ユーザーの指摘）。
// 見つかった物を、森の床で見せる。表示の文字は描かない（読める文字・実在の表示のまねはしない）。灰色の線で「何か書かれた板」と分かる程度にする。
// 落ち葉は茶・黄土・黄色だけ（赤い色を地面に置かない）。カメラはほとんど動かさない（細かい葉がちらつかないように）

/** シダの葉1枚：軸の左右に小葉が並ぶ、のこぎりの歯のような輪郭。付け根から外へ傾けて置く */
const FernFrond: React.FC<{ len: number; rotY: number; color: string; droop: number }> = ({ len, rotY, color, droop }) => {
  const geo = useMemo(() => {
    const sh = new THREE.Shape();
    const n = 11, wmax = len * 0.2;
    const width = (u: number) => wmax * Math.sin(Math.PI * Math.min(1, u * 1.15)) * (1 - u * 0.35);
    sh.moveTo(0.004, 0);
    for (let i = 0; i < n; i++) {
      const u0 = i / n, u1 = (i + 0.5) / n;
      sh.lineTo(0.004, u0 * len);
      sh.lineTo(width(u1), (u1 + 0.06) * len); // 小葉の先（少し上向き）
    }
    sh.lineTo(0, len);
    for (let i = n - 1; i >= 0; i--) {
      const u0 = i / n, u1 = (i + 0.5) / n;
      sh.lineTo(-width(u1), (u1 + 0.06) * len);
      sh.lineTo(-0.004, u0 * len);
    }
    sh.closePath();
    return new THREE.ShapeGeometry(sh, 2);
  }, [len]);
  return (
    <group rotation={[0, rotY, 0]}>
      <mesh geometry={geo} rotation={[-droop, 0, 0]}>
        <meshStandardMaterial color={color} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

const Fern: React.FC<{ position: [number, number, number]; size: number; seed: number }> = ({ position, size, seed }) => {
  const fronds = useMemo(
    () => Array.from({ length: 9 }, (_, i) => ({
      rotY: (i / 9) * Math.PI * 2 + random(`fr${seed}-${i}`) * 0.5,
      len: size * (0.7 + random(`fl${seed}-${i}`) * 0.5),
      droop: 0.75 + random(`fd${seed}-${i}`) * 0.4,
      color: random(`fc${seed}-${i}`) < 0.5 ? "#3b5530" : "#466338",
    })),
    [seed, size],
  );
  return (
    <group position={position}>
      {fronds.map((f, i) => <FernFrond key={i} len={f.len} rotY={f.rotY} color={f.color} droop={f.droop} />)}
    </group>
  );
};

/** 落ち葉：地面に平たく置いた楕円の葉（茶・黄土・黄色） */
const LeafLitter: React.FC<{ n: number; r: number; seed: number }> = ({ n, r, seed }) => {
  const leaves = useMemo(
    () => Array.from({ length: n }, (_, i) => {
      const a = random(`la${seed}-${i}`) * Math.PI * 2, d = Math.sqrt(random(`ld${seed}-${i}`)) * r;
      const c = random(`lc${seed}-${i}`);
      return {
        x: Math.cos(a) * d, z: Math.sin(a) * d, y: 0.004 + random(`ly${seed}-${i}`) * 0.01,
        rot: random(`lr${seed}-${i}`) * Math.PI * 2, s: 0.025 + random(`ls${seed}-${i}`) * 0.03,
        color: c < 0.4 ? "#5e4b31" : c < 0.7 ? "#735c38" : c < 0.9 ? "#86703f" : "#52432d",
      };
    }),
    [n, r, seed],
  );
  const leafGeo = useMemo(() => {
    // 先のとがった葉（長さ2・幅0.9）
    const sh = new THREE.Shape();
    sh.moveTo(-1, 0);
    sh.quadraticCurveTo(-0.2, 0.55, 1, 0);
    sh.quadraticCurveTo(-0.2, -0.55, -1, 0);
    return new THREE.ShapeGeometry(sh, 6);
  }, []);
  return (
    <group>
      {leaves.map((l, i) => (
        <mesh key={i} geometry={leafGeo} position={[l.x, l.y, l.z]} rotation={[-Math.PI / 2, 0, l.rot]} scale={[l.s, l.s, 1]}>
          <meshStandardMaterial color={l.color} roughness={0.95} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
};

/** 表示の切れ端：角が欠けた白っぽい板。文字の代わりに灰色の細い線（読めない） */
const PlacardPiece: React.FC<{ position: [number, number, number]; rotY: number }> = ({ position, rotY }) => {
  const geo = useMemo(() => {
    const w = 0.3, h = 0.18;
    const sh = new THREE.Shape();
    sh.moveTo(-w / 2, -h / 2);
    sh.lineTo(w / 2, -h / 2);
    sh.lineTo(w / 2, h * 0.12);
    // 右上の角が斜めに割れて欠けている
    sh.lineTo(w * 0.36, h * 0.2); sh.lineTo(w * 0.3, h / 2);
    sh.lineTo(-w / 2, h / 2);
    sh.closePath();
    return new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: false });
  }, []);
  const lines = [0.05, 0.02, -0.01, -0.04];
  return (
    <group position={position} rotation={[-Math.PI / 2, 0, rotY]}>
      <mesh geometry={geo}>
        <meshStandardMaterial color="#d9d2bf" roughness={0.75} />
      </mesh>
      {/* 板の縁の黒い帯と、文字の代わりの線（読めない灰色の帯） */}
      <mesh position={[-0.015, 0.072, 0.0065]}>
        <planeGeometry args={[0.24, 0.012]} />
        <meshStandardMaterial color="#3c3a36" roughness={0.8} />
      </mesh>
      {lines.map((y, i) => (
        <mesh key={i} position={[-0.03 + (i % 2) * 0.01, y, 0.0065]}>
          <planeGeometry args={[0.2 - (i % 3) * 0.03, 0.008]} />
          <meshStandardMaterial color="#8d8a82" roughness={0.85} />
        </mesh>
      ))}
      {/* 長い年月の汚れ（うすい茶色のしみ） */}
      <mesh position={[0.06, -0.05, 0.0066]}>
        <circleGeometry args={[0.05, 16]} />
        <meshStandardMaterial color="#9b8f74" transparent opacity={0.45} roughness={0.9} depthWrite={false} />
      </mesh>
    </group>
  );
};

export const InsertForestFloor003: React.FC<SceneProps> = ({ variant = "placard" }) => {
  const cams: Record<string, [CamKey, CamKey]> = {
    // 斜め上から、森の床の板を真ん中に（奥に倒木と木の幹、霧）
    placard: [{ pos: [0.02, 0.44, 0.9], target: [0, 0.03, -0.04], fov: 38 }, { pos: [0.02, 0.42, 0.84], target: [0, 0.03, -0.04], fov: 37 }],
  };
  const [from, to] = cams[variant] ?? cams.placard;
  return (
    <Stage fog={0.06} exposure={1.25} bloom={0} bg="#8a9498" hemi={["#d0d8dc", "#3a3628", 1.0]}>
      <Camera from={from} to={to} />
      <directionalLight position={[-6, 12, 4]} intensity={1.0} color="#efe2c8" />
      {/* 地面（湿った土） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color="#4a4130" roughness={1} />
      </mesh>
      {/* 苔の広がり */}
      {[[-0.55, -0.35, 0.35], [0.5, -0.6, 0.45], [-0.2, 0.45, 0.25]].map(([x, z, r], i) => (
        <mesh key={i} position={[x, 0.002, z]} rotation={[-Math.PI / 2, 0, i]} scale={[1, 0.7, 1]}>
          <circleGeometry args={[r, 9]} />
          <meshStandardMaterial color="#45482e" roughness={1} />
        </mesh>
      ))}
      <LeafLitter n={520} r={2.4} seed={7} />
      <PlacardPiece position={[0, 0.016, -0.04]} rotY={0.18} />
      {/* 板に半分かかる落ち葉 */}
      <mesh position={[0.12, 0.024, 0.0]} rotation={[-Math.PI / 2 + 0.08, 0, 0.7]} scale={[0.045, 0.025, 1]}>
        <circleGeometry args={[1, 10]} />
        <meshStandardMaterial color="#7d6338" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      <Fern position={[-0.5, 0, -0.55]} size={0.5} seed={1} />
      <Fern position={[0.55, 0, -0.75]} size={0.55} seed={2} />
      <Fern position={[-0.7, 0, 0.1]} size={0.4} seed={3} />
      <Fern position={[0.68, 0, -0.05]} size={0.38} seed={4} />
      <Fern position={[-1.3, 0, -1.6]} size={0.6} seed={5} />
      <Fern position={[1.2, 0, -1.9]} size={0.6} seed={6} />
      {/* 奥の倒木と、木の幹（霧の中） */}
      {[[-1.1, -3.2, 0.42], [1.5, -4.2, 0.5], [0.2, -6.5, 0.38]].map(([x, z, r], i) => (
        <mesh key={i} position={[x, 4, z]}>
          <cylinderGeometry args={[r * 0.85, r * 1.15, 8, 14]} />
          <meshStandardMaterial color="#4a4136" roughness={1} />
        </mesh>
      ))}
      <Driftwood position={[-0.9, 0.12, -1.6]} len={1.6} r={0.1} rotY={-0.5} />
      <Forest seed={53} n={120} x={[-25, 25]} z={[-40, -2.5]} h={[16, 28]} color="#2a3528" />
      <Mist t={0} y={1.2} z={-6} color="#a8b0b4" opacity={0.35} seed={9} />
    </Stage>
  );
};

/* ---------- 4. 冬のコロンビア川の岸 ---------- */

/** 川の水面：模様をゆっくり流す（1秒に数センチ相当） */
const River: React.FC<{ t: number; color: string }> = ({ t, color }) => {
  const tex = useMemo(() => {
    const cv = document.createElement("canvas");
    cv.width = 512; cv.height = 512;
    const c = cv.getContext("2d")!;
    c.fillStyle = "#808080"; c.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 1400; i++) {
      const x = random(`rv${i}`) * 512, y = random(`ry${i}`) * 512, w = 20 + random(`rw${i}`) * 60;
      c.strokeStyle = random(`rc${i}`) < 0.5 ? "rgba(200,200,200,0.25)" : "rgba(40,40,40,0.25)";
      c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + w / 2, y + 3, x + w, y); c.stroke();
    }
    const tx = new THREE.CanvasTexture(cv);
    tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
    tx.repeat.set(10, 10);
    return tx;
  }, []);
  tex.offset.x = t * 0.004;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0, -83]}>
      <planeGeometry args={[500, 154]} />
      {/* 曇り空を映した水面（映り込みの計算はせず、空の明るさを少し足す） */}
      <meshStandardMaterial color={color} map={tex} roughness={0.55} metalness={0} emissive="#4a5359" emissiveIntensity={0.9} />
    </mesh>
  );
};

export const InsertRiverBank003: React.FC<SceneProps> = ({ variant = "a" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const sand = useMemo(() => {
    const tx = sandTexture().clone();
    tx.repeat.set(30, 30);
    tx.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: tx, roughness: 0.95 });
  }, []);
  const cams: Record<string, [CamKey, CamKey]> = {
    a: [{ pos: [0, 0.8, 6], target: [1, 0.2, -4], fov: 40 }, { pos: [0.4, 0.8, 5.4], target: [1.2, 0.2, -4], fov: 39 }], // 砂と流木（低い所から）
    b: [{ pos: [-12, 4.5, 10], target: [4, 0, -20], fov: 40 }, { pos: [-11.2, 4.4, 9.4], target: [4, 0, -20], fov: 39 }], // 川の流れと砂州
    c: [{ pos: [2, 1.6, -1], target: [-6, 0.6, -40], fov: 38 }, { pos: [1.8, 1.6, -1.6], target: [-6, 0.6, -40], fov: 37 }], // 曇り空の冬の川面
    d: [{ pos: [10, 1.6, 4], target: [-20, 0.3, -8], fov: 38 }, { pos: [9.4, 1.6, 3.6], target: [-20, 0.3, -8], fov: 37 }], // 下流へ続く岸と流木
  };
  const [from, to] = cams[variant] ?? cams.a;
  return (
    <Stage fog={0.012} exposure={1.0} bloom={0} bg="#8f979c" hemi={["#c4ccd2", "#4a463e", 0.85]}>
      <Camera from={from} to={to} />
      <directionalLight position={[-30, 40, 20]} intensity={0.7} color="#e2e6ea" />
      {/* 砂の岸（水ぎわは z = -6） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 17]} material={sand} receiveShadow>
        <planeGeometry args={[300, 46]} />
      </mesh>
      <River t={t} color="#8a959c" />
      {/* 向こう岸の低い森（オレゴン州側） */}
      <group position={[0, 0, -120]}>
        <Forest seed={61} n={160} x={[-220, 220]} z={[-8, 4]} h={[14, 24]} color="#2a3330" />
      </group>
      {/* 流木 */}
      <Driftwood position={[1.2, 0.18, -1.5]} len={5.5} r={0.22} rotY={0.4} />
      <Driftwood position={[-2.8, 0.14, -3.2]} len={3.2} r={0.16} rotY={-0.9} tilt={0.05} />
      <Driftwood position={[5.5, 0.2, -2.6]} len={7} r={0.26} rotY={1.4} />
      <Driftwood position={[-9, 0.2, -4.2]} len={6} r={0.24} rotY={0.1} />
      <Driftwood position={[-16, 0.18, -3.6]} len={4.5} r={0.2} rotY={-0.4} />
      {/* 水ぎわの濡れた砂の帯 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, -5.8]}>
        <planeGeometry args={[300, 1.6]} />
        <meshStandardMaterial color="#4f4c46" roughness={0.35} metalness={0.15} />
      </mesh>
      <CloudLayer t={t} y={60} count={14} spread={300} drift={0.6} color="#b8bec4" opacity={0.25} seed={71} size={120} />
    </Stage>
  );
};

/* ---------- 5. 727 の模式図：飛行中は開かない出口（1972年の規則） ---------- */

/**
 * 灰色の背景に浮かべた 727 を、後ろの斜め下からゆっくり回り込んで見せ、胴体の下側の後ろの階段を赤く示す。
 * 模式図なので右上に「模式図」、左下に赤い部分の説明を出す（文字は動かさない）。塗装・ロゴ・文字は入れない
 */
export const InsertExitDiagram003: React.FC<SceneProps> = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const hl = interpolate(t, [1.0, 2.2], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const from: CamKey = { pos: [-40, -9, -27], target: [-7, 2.2, 0], fov: 41 };
  const to: CamKey = { pos: [-36, -8.5, -31], target: [-7, 2.2, 0], fov: 40 };
  return (
    <AbsoluteFill>
      <Stage fog={0} exposure={1.05} bloom={0.3} bg="#1a1d22" hemi={["#dfe5ec", "#2b2b2e", 1.5]}>
        <Camera from={from} to={to} />
        <directionalLight position={[-20, -12, -30]} intensity={1.2} color="#e9eef4" />
        <directionalLight position={[10, 30, 20]} intensity={1.0} color="#ffffff" />
        <Jet727 position={[0, 0, 0]} lights={0} cabin={0} stairsHl={hl} />
      </Stage>
      <div style={{ position: "absolute", right: 56, top: 44, fontFamily: FONT, fontSize: 20, color: "#d9d4c8", letterSpacing: 2, opacity: 0.85 }}>模式図</div>
      <div style={{ position: "absolute", left: 60, bottom: 66, display: "flex", alignItems: "center", gap: 14, opacity: hl, fontFamily: FONT, fontSize: 24, color: "#efe4d0", background: "rgba(13,14,18,0.72)", padding: "8px 16px" }}>
        <div style={{ width: 22, height: 22, background: "#d23a2c" }} />
        胴体の下側の後ろの階段（飛行中は開かない作りに）
      </div>
    </AbsoluteFill>
  );
};

