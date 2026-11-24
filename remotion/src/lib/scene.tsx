import React, { useMemo } from "react";
import { AbsoluteFill, Audio, Easing, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import current from "../data/current.json";
import { FONT } from "./font";
import { Cam, H, Region, W, project, world } from "./geo";
import { Terrain, TerrainParams } from "./Terrain";
import { TL, seg, segs } from "./timeline";

/* ---------- 共通の小道具 ---------- */

export const ease = Easing.inOut(Easing.cubic);
export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerpV = (a: THREE.Vector3, b: THREE.Vector3, t: number) => a.clone().lerp(b, t);
export const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
export const ramp = (f: number, a: number, b: number, from = 0, to = 1) => interpolate(f, [a, b], [from, to], { ...clamp, easing: ease });
export const P = (o: Partial<TerrainParams>): TerrainParams => ({ night: 0, sea: 0, low: 0, desat: 0, bright: 1, ...o });

/** 経路（複数点）上を t(0..1) で進む */
export const along = (region: Region, pts: readonly (readonly [number, number])[], t: number) => {
  const n = pts.length - 1;
  const x = Math.min(n - 1e-6, Math.max(0, t * n));
  const i = Math.floor(x);
  return lerpV(world(region, pts[i][0], pts[i][1]), world(region, pts[i + 1][0], pts[i + 1][1]), x - i);
};

/* ---------- シーン（ブロック）：ナレーションの区間に合わせて地図とカメラを動かす ---------- */

export type Block = {
  key: string;
  region: Region;
  ids: string[]; // このシーンで流れるナレーション区間
  cam: (t: number, f: number) => Cam;
  params: (f: number, local: number) => TerrainParams;
  labels?: (f: number) => { text: string; lon: number; lat: number; alpha: number; y?: number }[];
  rivers?: (f: number) => React.ReactNode;
  note?: (f: number) => string | null; // 誇張倍率・模式図などの注記（必須級：CLAUDE.md）
  credit: string; // 画面右上の小さなデータ表記
  yScale?: number;
};

export const XF = 14; // シーン切り替えのクロスフェード（フレーム）

const Label: React.FC<{ x: number; y: number; text: string; alpha: number }> = ({ x, y, text, alpha }) => (
  <div style={{ position: "absolute", left: x, top: y, transform: "translate(-50%, -100%)", opacity: alpha, textAlign: "center", fontFamily: FONT }}>
    <div style={{ color: "#fff", fontSize: 22, fontWeight: 700, textShadow: "0 0 6px #000, 0 0 3px #000", whiteSpace: "nowrap", marginBottom: 4 }}>{text}</div>
    <div style={{ width: 8, height: 8, borderRadius: 4, background: "#fff", margin: "0 auto", boxShadow: "0 0 6px #000" }} />
  </div>
);

const BlockView: React.FC<{ b: Block; start: number; end: number }> = ({ b, start, end }) => {
  const local = useCurrentFrame();
  const f = local + start;
  const t = interpolate(local, [0, end - start], [0, 1], clamp);
  const cam = b.cam(ease(t), f);
  const fade = start === 0 ? 1 : interpolate(local, [0, XF * 2], [0, 1], clamp);
  const labels = b.labels?.(f) ?? [];
  const note = b.note?.(f);
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <ThreeCanvas width={W} height={H} linear flat gl={{ antialias: true, preserveDrawingBuffer: true }}>
        <Terrain region={b.region} cam={cam} p={b.params(f, local)} rivers={b.rivers?.(f)} yScale={b.yScale ?? 1} />
      </ThreeCanvas>
      {labels.map((l, i) => {
        const p = project(cam, world(b.region, l.lon, l.lat, l.y ?? 1));
        return p.visible && l.alpha > 0.01 ? <Label key={i} x={p.x} y={p.y} text={l.text} alpha={l.alpha} /> : null;
      })}
      {note ? (
        <div style={{ position: "absolute", right: 24, top: 20, maxWidth: 820, textAlign: "right", fontFamily: FONT, fontSize: 17, color: "#fff",
          background: "rgba(0,0,0,0.45)", padding: "6px 12px", borderRadius: 6 }}>{note}</div>
      ) : null}
      <div style={{ position: "absolute", right: 24, top: note ? 60 : 20, fontFamily: FONT, fontSize: 13, color: "rgba(255,255,255,0.75)", textShadow: "0 0 4px #000" }}>{b.credit}</div>
    </AbsoluteFill>
  );
};

/* ---------- 画面上の文字（字幕は出さない：F-004） ---------- */

/** 章タイトル：narration.json の chapter がある区間の頭に出す */
export const Chapter: React.FC = () => {
  const f = useCurrentFrame();
  const s = segs.find((x) => x.chapter && f >= x.startFrame - 20 && f < x.startFrame + 130);
  if (!s) return null;
  const a = interpolate(f, [s.startFrame - 20, s.startFrame, s.startFrame + 105, s.startFrame + 130], [0, 1, 1, 0], clamp);
  return (
    <div style={{ position: "absolute", left: 40, top: 30, opacity: a, fontFamily: FONT, color: "#fff" }}>
      <div style={{ fontSize: 30, fontWeight: 700, textShadow: "0 0 10px #000, 0 0 4px #000", borderLeft: "6px solid #ffd25a", paddingLeft: 14 }}>{s.chapter}</div>
    </div>
  );
};

/** 数字カード：narration.json の stat（big と source）を区間中に出す。出典は必ず添える */
export const StatCard: React.FC = () => {
  const f = useCurrentFrame();
  const s = segs.find((x) => x.stat && f >= x.startFrame + 10 && f < x.endFrame + 25);
  if (!s || !s.stat) return null;
  const a = interpolate(f, [s.startFrame + 10, s.startFrame + 30, s.endFrame + 5, s.endFrame + 25], [0, 1, 1, 0], clamp);
  const hasChapter = !!s.chapter && f < s.startFrame + 130;
  return (
    <div style={{ position: "absolute", left: 40, top: hasChapter ? 96 : 34, opacity: a, fontFamily: FONT, maxWidth: 640,
      background: "rgba(8,14,26,0.78)", borderRadius: 10, padding: "14px 20px", color: "#fff" }}>
      <div style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.25 }}>{s.stat.big}</div>
      <div style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", marginTop: 8 }}>出典：{s.stat.source}</div>
    </div>
  );
};

/** グラフ用の枠（出典つき） */
export const Card: React.FC<{ a: number; children: React.ReactNode; src: string }> = ({ a, children, src }) => (
  <div style={{ position: "absolute", left: 40, top: 96, width: 600, opacity: a, fontFamily: FONT, color: "#fff",
    background: "rgba(8,14,26,0.82)", borderRadius: 12, padding: "18px 22px" }}>
    {children}
    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 12 }}>出典：{src}</div>
  </div>
);

/** 区間 id の表示期間に合わせたフェード（0..1） */
export const segFade = (f: number, id: string, inOffset = 0, len = 20) => {
  const s = seg(id);
  return interpolate(f, [s.startFrame + inOffset, s.startFrame + inOffset + len, s.endFrame + 5, s.endFrame + 25], [0, 1, 1, 0], clamp);
};

/* ---------- 音：ナレーションとBGM（F-005：BGMは必ず聞こえる音量で入れる） ---------- */

const smooth = (k: number) => k * k * (3 - 2 * k);

/** 話している間は下げ、話していない間は上げる。切り替えはなめらかに */
const bgmVolume = (f: number) => {
  const { bgmSpeech, bgmGap, duckFrames } = (current as any).mix;
  let d = Infinity;
  for (const s of segs) {
    if (f >= s.startFrame && f <= s.endFrame) return bgmSpeech;
    d = Math.min(d, f < s.startFrame ? s.startFrame - f : f - s.endFrame);
  }
  const k = Math.min(1, Math.max(0, (d - 4) / duckFrames));
  return bgmSpeech + (bgmGap - bgmSpeech) * smooth(k);
};

/* ---------- 1話分の外枠 ---------- */

export const EpisodeShell: React.FC<{ blocks: Block[]; children?: React.ReactNode }> = ({ blocks, children }) => {
  const ranges = useMemo(() => {
    const starts = blocks.map((b, i) => (i === 0 ? 0 : seg(b.ids[0]).startFrame - XF));
    return starts.map((start, i) => ({ start, end: i + 1 < starts.length ? starts[i + 1] + XF : TL.totalFrames }));
  }, [blocks]);
  return (
    <AbsoluteFill style={{ background: "#03050a" }}>
      {blocks.map((b, i) => (
        <Sequence key={b.key} from={ranges[i].start} durationInFrames={ranges[i].end - ranges[i].start} layout="none">
          <AbsoluteFill><BlockView b={b} start={ranges[i].start} end={ranges[i].end} /></AbsoluteFill>
        </Sequence>
      ))}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.45) 100%)" }} />
      <Chapter />
      <StatCard />
      {children}
      <Audio src={staticFile("narration.wav")} />
      <Audio src={staticFile("bgm.wav")} volume={bgmVolume} />
    </AbsoluteFill>
  );
};
