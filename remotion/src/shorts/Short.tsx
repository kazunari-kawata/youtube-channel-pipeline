/**
 * ショート動画（縦 720x1280、書き出しは1.5倍の 1080x1920）。決まりは CLAUDE.md の「ショート動画」（F-058）。
 * 中身は pipeline/short_build.py が public/shorts/<id>/data.json に書く（本編の current.json とは別）。
 *   npx remotion render src/index.ts Short out.mp4 --props='{"id":"002a"}' --scale=1.5
 *
 * 1フレーム目はサムネイル（本人の写真・名前・数字の一言）。フェードなしで最初から出す。
 * 字幕は画面の高さの約6割に、1回13字まで。動かさない（拡大・揺れはチラつく）。
 * 文字は YouTube の表示に隠れない所（x 40〜620、y 193〜833）に置く。右はボタン、下は題名に隠れる。
 */
import React from "react";
import { AbsoluteFill, Audio, CalculateMetadataFunction, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ASSETS as ASSETS_002, JA as JA_002 } from "../episodes/ep002-dahmer";
import { FILM_GRADE, InsertDuration, PortraitAim, PortraitZoom } from "../inserts/Inserts";
import { INSERT_SCENES } from "../inserts/registry";
import { FONT } from "../lib/font";
import { C } from "../lib/shots";

type Visual = { kind: string; [k: string]: any };
type Shot = { from: number; to: number; visual: Visual };
type Caption = { from: number; to: number; text: string; hl: string[] };
export type ShortData = {
  id: string; dir: string; fps: number; durationInFrames: number; audio: string;
  thumb: { frames: number; photo: string; doc: string; tag: string; name: string; name_en?: string; big: string; line: string };
  end: { from: number; text: string }; shots: Shot[]; captions: Caption[];
};
type Props = { id: string; data?: ShortData };

const DOCS: Record<string, { assets: Record<string, { title: string; source: string; aspect: number }>; ja: Record<string, string[]> }> = {
  "002": { assets: ASSETS_002, ja: JA_002 },
};

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const XF = 8; // カットの切り替え（なめらかに）
const CAP_Y = 787; // 字幕の中心（1080x1920 の y=1180）
const CAP_X = 330; // 字幕の中心（右のボタンを避けて少し左）
const CAP_W = 560;
const STROKE = "#000";

export const calcShort: CalculateMetadataFunction<Props> = async ({ props }) => {
  const res = await fetch(staticFile(`shorts/${props.id}/data.json`));
  const data = (await res.json()) as ShortData;
  return { durationInFrames: data.durationInFrames, fps: data.fps, props: { ...props, data } };
};

/** 縦の画面のフィルムの質感（本編の FilmFrame と同じ色・粒子・周辺減光） */
const Film: React.FC<{ children: React.ReactNode; bg?: string }> = ({ children, bg = C.bg }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const seed = Math.floor(frame / 2);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ background: bg, filter: FILM_GRADE }}>{children}</AbsoluteFill>
      <AbsoluteFill style={{ background: "rgba(255,190,140,0.035)", mixBlendMode: "screen" }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)" }} />
      <svg width={width} height={height} style={{ position: "absolute", opacity: 0.12, mixBlendMode: "overlay" }}>
        <filter id={`sg${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={seed} />
        </filter>
        <rect width="100%" height="100%" filter={`url(#sg${seed})`} />
      </svg>
    </AbsoluteFill>
  );
};

/** 黒いフチの太い文字。フチを下に、塗りを上に重ねる（フチが文字の中に食い込まない） */
const Outlined: React.FC<{ text: string; size: number; color: string; stroke?: number; hl?: string[]; hlColor?: string; style?: React.CSSProperties }> = ({
  text, size, color, stroke = 8, hl = [], hlColor = "#FFD400", style,
}) => {
  const parts: { t: string; c: string }[] = [];
  let rest = text;
  while (rest.length) {
    let hit: { i: number; h: string } | null = null;
    for (const h of hl) {
      const i = rest.indexOf(h);
      if (i >= 0 && (!hit || i < hit.i)) hit = { i, h };
    }
    if (!hit) {
      parts.push({ t: rest, c: color });
      break;
    }
    if (hit.i > 0) parts.push({ t: rest.slice(0, hit.i), c: color });
    parts.push({ t: hit.h, c: hlColor });
    rest = rest.slice(hit.i + hit.h.length);
  }
  const base: React.CSSProperties = { fontFamily: FONT, fontWeight: 900, fontSize: size, lineHeight: 1.18, whiteSpace: "pre", letterSpacing: 1, ...style };
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <div style={{ ...base, color: STROKE, WebkitTextStroke: `${stroke}px ${STROKE}`, position: "absolute", inset: 0 }}>{text}</div>
      <div style={{ ...base, position: "relative" }}>
        {parts.map((p, i) => (
          <span key={i} style={{ color: p.c }}>{p.t}</span>
        ))}
      </div>
    </div>
  );
};

/* ---------- 1フレーム目：サムネイル ---------- */

const Thumb: React.FC<{ d: ShortData }> = ({ d }) => {
  const t = d.thumb;
  return (
    <AbsoluteFill style={{ background: "#0b0807" }}>
      {/* FBIファイルの表紙（上の部分）を暗くして背景に */}
      <div style={{ position: "absolute", left: -60, top: 120, width: 860, height: 330, overflow: "hidden", transform: "rotate(-4deg)", opacity: 0.5 }}>
        <Img src={staticFile(`${d.dir}/${t.doc}.jpg`)} style={{ width: 860, position: "absolute", top: -120, filter: "grayscale(1) sepia(0.35) brightness(0.8) contrast(1.1)" }} />
      </div>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 35%, rgba(95,0,0,0.75) 100%)" }} />
      {/* 本人の写真（逮捕時。身長の目盛りごと） */}
      <div style={{ position: "absolute", left: 352, top: 216, width: 320, height: 400, overflow: "hidden", border: "5px solid #ece6d8", boxShadow: "0 14px 40px rgba(0,0,0,0.75)" }}>
        <Img src={staticFile(`${d.dir}/${t.photo}.jpg`)} style={{ width: "100%", display: "block", filter: "grayscale(0.7) contrast(1.15)" }} />
      </div>
      <div style={{ position: "absolute", left: 40, top: 200, background: "#FFD400", padding: "4px 14px", fontFamily: FONT, fontWeight: 900, fontSize: 26, color: "#000", letterSpacing: 2 }}>{t.tag}</div>
      {/* 名前（写真の左下） */}
      <div style={{ position: "absolute", left: 36, top: 440, width: 330 }}>
        {t.name.split("・").map((s, i, a) => (
          <div key={i}>
            <Outlined text={s + (i < a.length - 1 ? "・" : "")} size={54} color="#fff" stroke={9} />
          </div>
        ))}
        {t.name_en ? <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 20, color: C.cream, letterSpacing: 3, marginTop: 6, textShadow: "0 2px 6px #000" }}>{t.name_en}</div> : null}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 612, textAlign: "center" }}>
        <Outlined text={t.big} size={168} color="#E8231F" stroke={14} style={{ letterSpacing: 4 }} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 796, textAlign: "center" }}>
        <Outlined text={t.line} size={56} color="#fff" stroke={10} />
      </div>
    </AbsoluteFill>
  );
};

/* ---------- 画面の種類 ---------- */

const Label: React.FC<{ kind: string; title?: string; sub?: string }> = ({ kind, title, sub }) => (
  <div style={{ position: "absolute", left: 40, top: 200, right: 100, fontFamily: FONT }}>
    <span style={{ fontSize: 18, color: C.bg, background: C.amber, padding: "3px 10px", letterSpacing: 3, fontWeight: 700 }}>{kind}</span>
    {title ? <div style={{ fontSize: 24, color: C.cream, marginTop: 10, fontWeight: 700, lineHeight: 1.35, textShadow: "0 2px 8px rgba(0,0,0,0.9)" }}>{title}</div> : null}
    {sub ? <div style={{ fontSize: 20, color: "rgba(239,228,208,0.85)", marginTop: 4, textShadow: "0 2px 8px rgba(0,0,0,0.9)" }}>{sub}</div> : null}
  </div>
);

const Source: React.FC<{ text?: string; top: number }> = ({ text, top }) =>
  text ? <div style={{ position: "absolute", left: 40, top, fontFamily: FONT, fontSize: 15, color: "rgba(239,228,208,0.62)", letterSpacing: 1 }}>{text}</div> : null;

const InsertV: React.FC<{ v: Visual; dur: number }> = ({ v, dur }) => {
  const Scene = INSERT_SCENES[v.scene];
  return (
    <AbsoluteFill>
      <InsertDuration.Provider value={dur}>
        <PortraitZoom.Provider value={v.zoom ?? 0.8}>
          <PortraitAim.Provider value={(v.aim ?? [0, 0]) as [number, number]}>{Scene ? <Scene variant={v.var} /> : null}</PortraitAim.Provider>
        </PortraitZoom.Provider>
      </InsertDuration.Provider>
      {v.label ? (
        <div style={{ position: "absolute", left: 40, top: 200, fontFamily: FONT }}>
          <div style={{ display: "inline-block", fontSize: 24, fontWeight: 900, color: C.bg, background: C.amber, padding: "4px 12px", letterSpacing: 1 }}>{v.label}</div>
          {v.sub ? <div style={{ fontSize: 20, color: C.cream, marginTop: 8, textShadow: "0 2px 8px #000" }}>{v.sub}</div> : null}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/** 資料：横幅いっぱいに置き、下に日本語の説明（F-020）。動かさない */
const DocV: React.FC<{ v: Visual; dir: string }> = ({ v, dir }) => {
  const reg = DOCS[dir];
  const meta = reg.assets[v.src];
  const ja = reg.ja[v.src] ?? [];
  const w = 640;
  let h = w / meta.aspect;
  let ww = w;
  // 資料と説明は字幕の帯（y 750〜）より上に収める
  if (h > 280) {
    h = 280;
    ww = h * meta.aspect;
  }
  const top = 270;
  const [head, ...body] = ja;
  return (
    <Film bg="radial-gradient(ellipse at 50% 35%, #2a2420 0%, #110e0c 75%)">
      <Label kind="資料" title={meta.title} />
      <div style={{ position: "absolute", left: (720 - ww) / 2, top, width: ww, height: h, background: "#ece6d8", boxShadow: "0 18px 50px rgba(0,0,0,0.7)" }}>
        <Img src={staticFile(`${dir}/${v.src}.jpg`)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: "contrast(1.08)" }} />
      </div>
      {head ? (
        <div style={{ position: "absolute", left: 40, top: top + h + 22, width: 560, fontFamily: FONT, color: C.cream, background: "rgba(13,14,18,0.78)", borderLeft: `3px solid ${C.amber}`, padding: "10px 16px" }}>
          <div style={{ fontSize: 15, color: C.amber, letterSpacing: 3, marginBottom: 4 }}>書かれていること</div>
          <div style={{ fontSize: 21, lineHeight: 1.5, fontWeight: 700 }}>{head}</div>
          {body.map((l, i) => (
            <div key={i} style={{ fontSize: 18, lineHeight: 1.5, marginTop: 3, color: "rgba(239,228,208,0.92)" }}>{l}</div>
          ))}
        </div>
      ) : null}
      <Source text={meta.source} top={1060} />
    </Film>
  );
};

/** 写真：縦長の写真を大きく。動かさない */
const PhotoV: React.FC<{ v: Visual; dir: string }> = ({ v, dir }) => {
  const meta = DOCS[dir].assets[v.src];
  const h = 620;
  const w = h * meta.aspect;
  return (
    <Film bg="radial-gradient(ellipse at 50% 40%, #2a2420 0%, #110e0c 75%)">
      <div style={{ position: "absolute", left: (720 - w) / 2 - 20, top: 196, width: w, height: h, padding: 12, background: "#f4efe4", boxShadow: "0 18px 50px rgba(0,0,0,0.7)", transform: "rotate(0.8deg)" }}>
        <Img src={staticFile(`${dir}/${v.src}.jpg`)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      </div>
      {v.caption ? <div style={{ position: "absolute", left: 40, top: 840, fontFamily: FONT, fontSize: 18, color: "rgba(239,228,208,0.8)" }}>{v.caption}</div> : null}
      <Source text={meta.source} top={1060} />
    </Film>
  );
};

/** 文字カード：数字・期間・問い */
const CardV: React.FC<{ v: Visual }> = ({ v }) => {
  const big = v.style === "question" ? 50 : v.style === "span" ? 96 : 170;
  const color = v.style === "question" ? "#fff" : C.amber;
  return (
    <Film bg="radial-gradient(ellipse at 50% 40%, #241d18 0%, #0d0b0a 78%)">
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start", paddingTop: v.style === "question" ? 330 : 300 }}>
        <div style={{ textAlign: "center", maxWidth: 580, marginLeft: -40 }}>
          <Outlined text={v.text} size={big} color={color} stroke={v.style === "question" ? 9 : 10} style={{ textAlign: "center" }} />
        </div>
        {v.sub ? (
          <div style={{ marginTop: 18, maxWidth: 560, textAlign: "center" }}>
            <Outlined text={v.sub} size={v.style === "span" ? 64 : 26} color={v.style === "span" ? "#fff" : C.cream} stroke={v.style === "span" ? 9 : 5} style={{ whiteSpace: "pre-wrap" }} />
          </div>
        ) : null}
      </AbsoluteFill>
      <Source text={v.source} top={1060} />
    </Film>
  );
};

const ShotView: React.FC<{ s: Shot; dir: string }> = ({ s, dir }) => {
  const v = s.visual;
  if (v.kind === "insert") return <InsertV v={v} dur={s.to - s.from + XF} />;
  if (v.kind === "doc") return <DocV v={v} dir={dir} />;
  if (v.kind === "photo") return <PhotoV v={v} dir={dir} />;
  return <CardV v={v} />;
};

/** 前のカットの上に、なめらかに重ねて出す */
const FadeIn: React.FC<{ children: React.ReactNode; instant?: boolean }> = ({ children, instant }) => {
  const f = useCurrentFrame();
  const o = instant ? 1 : interpolate(f, [0, XF], [0, 1], { ...clamp, easing: Easing.inOut(Easing.ease) });
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
};

const Captions: React.FC<{ caps: Caption[] }> = ({ caps }) => {
  const f = useCurrentFrame();
  const c = caps.find((x) => f >= x.from && f < x.to);
  if (!c) return null;
  return (
    <div style={{ position: "absolute", left: CAP_X - CAP_W / 2, width: CAP_W, top: CAP_Y - 34, textAlign: "center" }}>
      <Outlined text={c.text} size={44} color="#fff" stroke={9} hl={c.hl} />
    </div>
  );
};

const EndCard: React.FC<{ text: string }> = ({ text }) => (
  <Film bg="radial-gradient(ellipse at 50% 40%, #241d18 0%, #0d0b0a 78%)">
    <div style={{ position: "absolute", left: 40, right: 100, top: 640, textAlign: "center" }}>
      <Outlined text={text} size={40} color="#fff" stroke={8} />
    </div>
    {/* 関連動画のリンク（画面の下、チャンネル名の下）を指す矢印 */}
    <svg width={120} height={150} style={{ position: "absolute", left: 270, top: 730 }} viewBox="0 0 120 150">
      <path d="M60 6 V118 M22 82 L60 122 L98 82" stroke={C.amber} strokeWidth={14} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </Film>
);

export const Short: React.FC<Props> = ({ data }) => {
  if (!data) return null;
  const d = data;
  const tf = d.thumb.frames;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {d.shots.map((s, i) => (
        <Sequence key={i} from={s.from} durationInFrames={s.to - s.from + XF} layout="none">
          <FadeIn instant={i === 0}>
            <ShotView s={s} dir={d.dir} />
          </FadeIn>
        </Sequence>
      ))}
      <Sequence from={d.end.from} layout="none">
        <FadeIn>
          <EndCard text={d.end.text} />
        </FadeIn>
      </Sequence>
      <Sequence from={0} durationInFrames={tf} layout="none">
        <Thumb d={d} />
      </Sequence>
      <Captions caps={d.captions} />
      <Audio src={staticFile(d.audio)} />
    </AbsoluteFill>
  );
};
