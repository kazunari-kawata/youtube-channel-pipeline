/**
 * 犯罪・事件の回の画面部品（2D）：文字カード、資料、写真、航空写真、地図。
 * 見た目は80年代の記録映画ふう（色あせたフィルムの色・粒子・ゆっくりした揺れ）。実在の局のデザインはまねない。
 * 長さはカットごとに InsertDuration で受け取る（../inserts/Inserts.tsx）。
 */
import React, { useEffect, useMemo, useState } from "react";
import { AbsoluteFill, cancelRender, continueRender, delayRender, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { FILM_GRADE, useInsertDur } from "../inserts/Inserts";
import { FONT } from "./font";
import { H, W } from "./geo";

export const C = { bg: "#0d0e12", amber: "#e6a35a", cream: "#efe4d0", muted: "#9a917f", line: "rgba(230,163,90,0.55)" };
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 2Dの画面にもフィルムの質感（色・粒子・周辺減光・ゆっくりした揺れ）を掛ける */
export const FilmFrame: React.FC<{ children: React.ReactNode; bg?: string }> = ({ children, bg = C.bg }) => {
  const frame = useCurrentFrame();
  const seed = Math.floor(frame / 2);
  const dx = 0.5 * Math.sin(frame * 0.21) + 0.3 * Math.sin(frame * 0.53 + 1.0);
  const dy = 0.4 * Math.sin(frame * 0.17 + 2.0) + 0.25 * Math.sin(frame * 0.47);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ background: bg, filter: FILM_GRADE, transform: `translate(${dx}px, ${dy}px) scale(1.012)` }}>{children}</AbsoluteFill>
      <AbsoluteFill style={{ background: "rgba(255,190,140,0.035)", mixBlendMode: "screen" }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 50%, rgba(0,0,0,0.6) 100%)" }} />
      <svg width={W} height={H} style={{ position: "absolute", opacity: 0.12, mixBlendMode: "overlay" }}>
        <filter id={`fg${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={seed} />
        </filter>
        <rect width="100%" height="100%" filter={`url(#fg${seed})`} />
      </svg>
    </AbsoluteFill>
  );
};

const Source: React.FC<{ text?: string }> = ({ text }) =>
  text ? (
    <div style={{ position: "absolute", right: 34, bottom: 24, fontFamily: FONT, fontSize: 15, color: "rgba(239,228,208,0.62)", letterSpacing: 1 }}>{text}</div>
  ) : null;

const Label: React.FC<{ kind: string; title?: string }> = ({ kind, title }) => (
  <div style={{ position: "absolute", left: 40, top: 30, display: "flex", alignItems: "center", gap: 14, fontFamily: FONT }}>
    <span style={{ fontSize: 14, color: C.bg, background: C.amber, padding: "3px 10px", letterSpacing: 3, fontWeight: 700 }}>{kind}</span>
    {title ? <span style={{ fontSize: 19, color: C.cream, letterSpacing: 1, textShadow: "0 1px 6px rgba(0,0,0,0.8)" }}>{title}</span> : null}
  </div>
);

const useIn = (delay = 0, len = 14) => {
  const f = useCurrentFrame();
  return interpolate(f, [delay, delay + len], [0, 1], clamp);
};

/* ---------- 文字カード ---------- */

export type CardV = { style: string; text?: string; sub?: string; source?: string; items?: string[]; highlight?: number };

export const CardShot: React.FC<{ v: CardV }> = ({ v }) => {
  const frame = useCurrentFrame();
  const dur = useInsertDur();
  const a = useIn(4, 16);
  const rise = (1 - a) * 14;
  const glow = { textShadow: "0 0 18px rgba(230,163,90,0.25)" };
  const base: React.CSSProperties = { fontFamily: FONT, color: C.cream, textAlign: "center" };
  let body: React.ReactNode = null;
  if (v.style === "chapter") {
    const lineW = interpolate(frame, [8, 34], [0, 520], clamp);
    body = (
      <div style={{ ...base, opacity: a, transform: `translateY(${rise}px)` }}>
        <div style={{ fontSize: 24, color: C.amber, letterSpacing: 8 }}>{v.sub}</div>
        <div style={{ height: 2, width: lineW, background: C.line, margin: "22px auto" }} />
        <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: 6, ...glow }}>{v.text}</div>
      </div>
    );
  } else if (v.style === "date") {
    const text = v.text ?? "";
    const n = Math.floor(interpolate(frame, [6, 6 + text.length * 2.2], [0, text.length], clamp)); // タイプライターのように1字ずつ
    body = (
      <div style={{ ...base }}>
        <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: 3, color: C.cream, ...glow, minHeight: 90 }}>{text.slice(0, n)}</div>
        <div style={{ height: 2, width: 420, background: C.line, margin: "18px auto", opacity: a }} />
        <div style={{ fontSize: 30, color: C.amber, letterSpacing: 4, opacity: interpolate(frame, [20, 34], [0, 1], clamp) }}>{v.sub}</div>
      </div>
    );
  } else if (v.style === "fact" || v.style === "span") {
    body = (
      <div style={{ ...base, opacity: a, transform: `translateY(${rise}px)` }}>
        <div style={{ fontSize: v.style === "span" ? 110 : 130, fontWeight: 800, color: C.amber, letterSpacing: 4, ...glow }}>{v.text}</div>
        <div style={{ fontSize: 32, marginTop: 14, letterSpacing: 2 }}>{v.sub}</div>
      </div>
    );
  } else if (v.style === "question") {
    body = (
      <div style={{ ...base, opacity: a }}>
        <div style={{ fontSize: 22, color: C.amber, letterSpacing: 10, marginBottom: 26 }}>問い</div>
        <div style={{ fontSize: 58, fontWeight: 700, letterSpacing: 3, lineHeight: 1.4, ...glow, transform: `scale(${1 + (frame / dur) * 0.03})` }}>{v.text}</div>
      </div>
    );
  } else if (v.style === "netflix") {
    body = (
      <div style={{ ...base, opacity: a, transform: `translateY(${rise}px)` }}>
        <div style={{ display: "inline-block", fontSize: 18, color: C.amber, border: `1px solid ${C.line}`, padding: "4px 14px", letterSpacing: 6, marginBottom: 26 }}>ドラマ</div>
        <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: 2, lineHeight: 1.6, whiteSpace: "pre-line" }}>{v.text}</div>
        {v.sub ? <div style={{ fontSize: 26, color: C.muted, marginTop: 18, letterSpacing: 2 }}>{v.sub}</div> : null}
      </div>
    );
  } else if (v.style === "chance") {
    body = (
      <div style={{ ...base, opacity: a, transform: `translateY(${rise}px)`, borderLeft: `4px solid ${C.amber}`, paddingLeft: 36, textAlign: "left" }}>
        <div style={{ fontSize: 50, fontWeight: 700, color: C.amber, letterSpacing: 3, ...glow }}>{v.text}</div>
        <div style={{ fontSize: 32, marginTop: 16, letterSpacing: 2 }}>{v.sub}</div>
      </div>
    );
  } else if (v.style === "quote") {
    body = (
      <div style={{ ...base, opacity: a, maxWidth: 1000 }}>
        <div style={{ fontSize: 120, color: C.amber, lineHeight: 0.6, opacity: 0.7 }}>“</div>
        <div style={{ fontSize: 42, fontWeight: 600, lineHeight: 1.7, letterSpacing: 2, whiteSpace: "pre-line" }}>{v.text}</div>
        <div style={{ fontSize: 22, color: C.muted, marginTop: 24, letterSpacing: 1 }}>{v.sub}</div>
      </div>
    );
  } else if (v.style === "timeline") {
    const items = v.items ?? [];
    body = (
      <div style={{ position: "relative", width: 1100, height: 260, fontFamily: FONT }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 120, height: 2, background: C.line, width: interpolate(frame, [4, 30], [0, 1100], clamp) }} />
        {items.map((it, i) => {
          const x = 60 + (i * 980) / Math.max(1, items.length - 1);
          const hi = i === v.highlight;
          const o = interpolate(frame, [10 + i * 8, 22 + i * 8], [0, 1], clamp);
          const [date, ...rest] = it.split(" ");
          return (
            <div key={i} style={{ position: "absolute", left: x - 110, width: 220, top: 0, textAlign: "center", opacity: o }}>
              <div style={{ height: 96, display: "flex", alignItems: "flex-end", justifyContent: "center", fontSize: hi ? 30 : 24, color: hi ? C.amber : C.cream, fontWeight: hi ? 700 : 500 }}>{date}</div>
              <div style={{ width: hi ? 22 : 14, height: hi ? 22 : 14, borderRadius: "50%", background: hi ? C.amber : C.cream, margin: `${hi ? 13 : 17}px auto 0` }} />
              <div style={{ fontSize: 22, color: rest.length ? C.amber : C.muted, marginTop: 14 }}>{rest.join(" ") || "事件"}</div>
            </div>
          );
        })}
      </div>
    );
  } else if (v.style === "recount") {
    const items = v.items ?? [];
    body = (
      <div style={{ fontFamily: FONT, textAlign: "left" }}>
        <div style={{ fontSize: 24, color: C.amber, letterSpacing: 6, marginBottom: 30 }}>記録で確かめられる「止められたかもしれない場面」</div>
        {items.map((it, i) => (
          <div key={i} style={{ fontSize: 40, color: C.cream, margin: "18px 0", opacity: interpolate(frame, [10 + i * 26, 24 + i * 26], [0, 1], clamp) }}>
            <span style={{ color: C.amber, marginRight: 22 }}>{"①②③④⑤"[i]}</span>
            {it}
          </div>
        ))}
      </div>
    );
  } else {
    body = <div style={{ ...base, fontSize: 52, opacity: a }}>{v.text}</div>;
  }
  return (
    <FilmFrame bg="radial-gradient(ellipse at 50% 45%, #1c1a1d 0%, #0b0c10 70%)">
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>{body}</AbsoluteFill>
      <Source text={v.source ? `出典：${v.source}` : undefined} />
    </FilmFrame>
  );
};

/* ---------- 資料・写真 ---------- */

export type DocMeta = { title: string; source: string; kind?: string };

/** 机の上に置いた紙（資料）や焼き付けた写真。ゆっくり寄る */
export const PaperShot: React.FC<{ src: string; meta: DocMeta; photo?: boolean; aspect: number }> = ({ src, meta, photo = false, aspect }) => {
  const frame = useCurrentFrame();
  const dur = useInsertDur();
  const t = frame / Math.max(1, dur);
  const a = useIn(0, 12);
  // 横長の切り出し（資料の数行）は幅で、縦長（表紙・写真）は高さで合わせる
  const maxW = photo ? 1000 : 1120;
  const maxH = photo ? 540 : 560;
  let w = maxW;
  let h = w / aspect;
  if (h > maxH) {
    h = maxH;
    w = h * aspect;
  }
  const s = 1 + t * 0.06;
  return (
    <FilmFrame bg="radial-gradient(ellipse at 50% 40%, #2a2420 0%, #110e0c 75%)">
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            width: w, height: h, transform: `scale(${s}) rotate(${photo ? 0.9 : -0.5}deg) translateY(${(1 - a) * 10}px)`, opacity: a,
            boxShadow: "0 18px 50px rgba(0,0,0,0.7)", background: photo ? "#f4efe4" : "#ece6d8", padding: photo ? 14 : 0,
          }}
        >
          <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: photo ? "none" : "contrast(1.08)" }} />
        </div>
      </AbsoluteFill>
      <Label kind={meta.kind ?? (photo ? "写真" : "資料")} title={meta.title} />
      <Source text={meta.source} />
    </FilmFrame>
  );
};

/* ---------- 航空写真 ---------- */

export const AerialShot: React.FC<{ src: string; label: string; zoom: string; date: string }> = ({ src, label, zoom, date }) => {
  const frame = useCurrentFrame();
  const dur = useInsertDur();
  const t = interpolate(frame, [0, dur], [0, 1], clamp);
  const [s0, s1] = zoom === "in" ? [1.0, 1.32] : zoom === "out" ? [1.32, 1.0] : [1.08, 1.16];
  const s = s0 + (s1 - s0) * (t * t * (3 - 2 * t));
  const pin = interpolate(frame, [12, 26], [0, 1], clamp);
  return (
    <FilmFrame bg="#000">
      <AbsoluteFill style={{ transform: `scale(${s})` }}>
        <Img src={staticFile(src)} style={{ width: W, height: H, objectFit: "cover" }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "rgba(10,12,20,0.18)" }} />
      <div style={{ position: "absolute", left: W / 2 - 18, top: H / 2 - 18, width: 36, height: 36, borderRadius: "50%", border: `3px solid ${C.amber}`, opacity: pin, boxShadow: "0 0 10px rgba(0,0,0,0.8)" }} />
      <div style={{ position: "absolute", left: W / 2 + 34, top: H / 2 - 22, fontFamily: FONT, fontSize: 24, color: C.cream, background: "rgba(13,14,18,0.78)", padding: "6px 14px", borderLeft: `3px solid ${C.amber}`, opacity: pin }}>
        {label}
      </div>
      <Label kind="航空写真" />
      <Source text={`航空写真：米農務省 NAIP（${date}撮影）`} />
    </FilmFrame>
  );
};

/* ---------- 地図（Natural Earth を make_maps.py で画面座標にしたもの） ---------- */

type MapData = {
  land: string[]; lakes: string[]; countries: string[]; states: { d: string; hl: boolean }[];
  points: Record<string, { x: number; y: number; label: string }>; labels: { x: number; y: number; text: string; kind: string }[];
  note: string; source: string;
};
const mapCache: Record<string, Promise<MapData>> = {};

export const MapShot: React.FC<{ file: string; points: string[]; route?: string[] }> = ({ file, points, route }) => {
  const frame = useCurrentFrame();
  const dur = useInsertDur();
  const [data, setData] = useState<MapData | null>(null);
  const [handle] = useState(() => delayRender(`map ${file}`));
  useEffect(() => {
    (mapCache[file] ??= fetch(staticFile(file)).then((r) => r.json()))
      .then((d) => {
        setData(d);
        continueRender(handle);
      })
      .catch((e) => cancelRender(e));
  }, [file, handle]);
  const t = interpolate(frame, [0, dur], [0, 1], clamp);
  const routeD = useMemo(() => {
    if (!data || !route || route.length < 2) return null;
    const [p, q] = [data.points[route[0]], data.points[route[1]]];
    const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2 - Math.hypot(q.x - p.x, q.y - p.y) * 0.22;
    return `M${p.x},${p.y} Q${mx},${my} ${q.x},${q.y}`;
  }, [data, route]);
  if (!data) return null;
  const draw = interpolate(frame, [14, 60], [0, 1], clamp);
  return (
    <FilmFrame bg="#0f1726">
      <AbsoluteFill style={{ transform: `scale(${1.0 + t * 0.05})` }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          <rect width={W} height={H} fill="#13203a" />
          {data.land.map((d, i) => <path key={`l${i}`} d={d} fill="#2a2a2c" />)}
          {data.states.map((s, i) => <path key={`s${i}`} d={s.d} fill={s.hl ? "#3d3528" : "none"} stroke="rgba(239,228,208,0.28)" strokeWidth={1} />)}
          {data.countries.map((d, i) => <path key={`c${i}`} d={d} fill="none" stroke="rgba(239,228,208,0.25)" strokeWidth={0.8} />)}
          {data.lakes.map((d, i) => <path key={`k${i}`} d={d} fill="#13203a" />)}
          {routeD ? <path d={routeD} fill="none" stroke={C.amber} strokeWidth={3} strokeDasharray="10 8" pathLength={1000} strokeDashoffset={0}
            style={{ clipPath: "none" }} opacity={draw} /> : null}
        </svg>
        {data.labels.map((l, i) => (
          <div key={i} style={{ position: "absolute", left: l.x, top: l.y, transform: "translate(-50%,-50%)", fontFamily: FONT, fontSize: l.kind === "water" ? 20 : 24,
            color: l.kind === "water" ? "rgba(150,180,220,0.75)" : "rgba(239,228,208,0.6)", letterSpacing: 4, whiteSpace: "nowrap" }}>{l.text}</div>
        ))}
        {points.map((k, i) => {
          const p = data.points[k];
          if (!p) return null;
          const o = interpolate(frame, [8 + i * 14, 20 + i * 14], [0, 1], clamp);
          return (
            <div key={k} style={{ opacity: o }}>
              <div style={{ position: "absolute", left: p.x - 8, top: p.y - 8, width: 16, height: 16, borderRadius: "50%", background: C.amber, boxShadow: "0 0 0 6px rgba(230,163,90,0.25)" }} />
              {/* 右端に近い地名は点の左に出す（画面からはみ出さないように） */}
              <div style={{ position: "absolute", ...(p.x > W - 300 ? { right: W - p.x + 16 } : { left: p.x + 16 }), top: p.y - 18, fontFamily: FONT, fontSize: 26, fontWeight: 700, color: C.cream, textShadow: "0 2px 8px rgba(0,0,0,0.9)", whiteSpace: "nowrap" }}>{p.label}</div>
            </div>
          );
        })}
      </AbsoluteFill>
      <Label kind="地図" title={data.note || undefined} />
      <Source text={data.source} />
    </FilmFrame>
  );
};
