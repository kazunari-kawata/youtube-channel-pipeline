/**
 * 006 の地図（サンフランシスコ湾）。見た目は ep003 の地図とそろえる（共有の MapShot は変えない）。
 * 陸地は米国勢調査局 TIGER/Line（episodes/006-alcatraz/make_maps_006.py → remotion/public/006/map_<view>.json）。
 * ep003 から足したもの
 *   ・点の kind：area（点ではなく範囲。包み2つ）、text（点を打たず文字だけ。「約2km」）
 *   ・areas：薄い赤の面と赤い線（F-055）。捜索の範囲（模式図）も同じ描き方
 *   ・route：3点以上の矢印（潮の向きの模式図）。区切りごとに順に出し、先に矢じりを付ける。線は伸ばさず、なめらかに現す（動きの速い線はちらつく）
 *   ・route_note：矢印を出すときだけ注記に足す文
 * 地図は拡大・移動しない。点・範囲・矢印を順に出すだけ（CLAUDE.md）。
 */
import React, { useEffect, useState } from "react";
import { AbsoluteFill, cancelRender, continueRender, delayRender, interpolate, staticFile, useCurrentFrame } from "remotion";
import { FONT } from "../lib/font";
import { H, W } from "../lib/geo";
import { C, FilmFrame, Reveal } from "../lib/shots";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = (x: number) => x * x * (3 - 2 * x);
const HL = "#e0504a";
const TIDE = "#7fb2e6";

type Pt = { x: number; y: number; label: string; kind: string };
type Area = { key: string; d: string; label: string; bbox: [number, number, number, number] };
type MapData = {
  land: string[]; points: Record<string, Pt>; labels: { x: number; y: number; text: string; kind: string }[];
  areas: Area[]; note: string; route_note: string; source: string;
};
const cache: Record<string, Promise<MapData>> = {};

const revealStart = (i: number, base: number, step: number, r?: Reveal) => (r && i >= r.from ? r.frame + (i - r.from) * step : base + i * step);

/** 1区切りの矢印（ゆるい弧と矢じり） */
const arrow = (p: Pt, q: Pt) => {
  const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
  const nx = -(q.y - p.y), ny = q.x - p.x, l = Math.hypot(nx, ny) || 1;
  const bend = Math.hypot(q.x - p.x, q.y - p.y) * 0.12;
  const cx = mx + (nx / l) * bend, cy = my + (ny / l) * bend;
  // 線の終わりは矢じりの手前で止める
  const tx = q.x - cx, ty = q.y - cy, tl = Math.hypot(tx, ty) || 1;
  const ux = tx / tl, uy = ty / tl, head = 22;
  const ex = q.x - ux * head * 0.7, ey = q.y - uy * head * 0.7;
  const line = `M${p.x},${p.y} Q${cx},${cy} ${ex},${ey}`;
  const hx = -uy, hy = ux;
  const tip = `M${q.x},${q.y} L${q.x - ux * head + hx * head * 0.55},${q.y - uy * head + hy * head * 0.55} L${q.x - ux * head - hx * head * 0.55},${q.y - uy * head - hy * head * 0.55}Z`;
  return { line, tip };
};

export const Map006: React.FC<{ file: string; points: string[]; route?: string[]; reveal?: Reveal; hl?: string[]; labels?: Record<string, string> }> = ({
  file, points, route, reveal, hl = [], labels = {},
}) => {
  const frame = useCurrentFrame();
  const [data, setData] = useState<MapData | null>(null);
  const [handle] = useState(() => delayRender(`map ${file}`));
  useEffect(() => {
    (cache[file] ??= fetch(staticFile(file)).then((r) => r.json()))
      .then((d) => {
        setData(d);
        continueRender(handle);
      })
      .catch((e) => cancelRender(e));
  }, [file, handle]);
  if (!data) return null;
  const areaO = (k: number) => interpolate(frame, [2 + k, 26 + k], [0, 1], { ...clamp, easing: ease });
  // 矢印は、点がそろってから。後出し（reveal）があればその時刻から、区切りごとに18コマずつ
  const pointsDone = revealStart(Math.max(0, points.length - 1), 8, 14) + 10;
  const routeStart = reveal ? reveal.frame : pointsDone;
  const segsR = route && route.length >= 2 ? route.slice(1).map((k, i) => ({ ...arrow(data.points[route[i]], data.points[k]), i })) : [];
  const note = data.note + (segsR.length && data.route_note ? data.route_note : "");
  const searchArea = data.areas.find((a) => a.key === "search");
  const pointAreas = data.areas.filter((a) => a.key !== "search" && points.includes(a.key));
  return (
    <FilmFrame bg="#0f1726">
      <AbsoluteFill>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          <rect width={W} height={H} fill="#13203a" />
          {data.land.map((d, i) => <path key={`l${i}`} d={d} fill="#2a2a2c" stroke="rgba(239,228,208,0.18)" strokeWidth={1} />)}
          {searchArea ? (
            <g opacity={areaO(0)}>
              <path d={searchArea.d} fill="rgba(224,80,74,0.18)" stroke="none" />
              <path d={searchArea.d} fill="none" stroke={HL} strokeWidth={2.5} strokeLinejoin="round" opacity={0.85} />
            </g>
          ) : null}
          {pointAreas.map((a) => {
            const i = points.indexOf(a.key);
            const s0 = revealStart(i, 8, 14, reveal);
            const o = interpolate(frame, [s0, s0 + 16], [0, 1], { ...clamp, easing: ease });
            const h = hl.includes(a.key);
            return (
              <g key={a.key} opacity={o}>
                <path d={a.d} fill={h ? "rgba(224,80,74,0.26)" : "rgba(230,163,90,0.22)"} stroke="none" />
                <path d={a.d} fill="none" stroke={h ? HL : C.amber} strokeWidth={3} strokeLinejoin="round" />
              </g>
            );
          })}
          {segsR.map((s) => {
            const t0 = routeStart + s.i * 18;
            const o = interpolate(frame, [t0, t0 + 16], [0, 1], { ...clamp, easing: ease });
            return (
              <g key={s.i} opacity={o}>
                <path d={s.line} fill="none" stroke={TIDE} strokeWidth={5} strokeLinecap="round" />
                <path d={s.tip} fill={TIDE} />
              </g>
            );
          })}
        </svg>
        {data.labels.map((l, i) => (
          <div key={i} style={{ position: "absolute", left: l.x, top: l.y, transform: "translate(-50%,-50%)", fontFamily: FONT, fontSize: l.kind === "water" ? 21 : 24,
            color: l.kind === "water" ? "rgba(150,185,230,0.85)" : "rgba(239,228,208,0.6)", letterSpacing: 4, whiteSpace: "nowrap", textShadow: "0 1px 6px rgba(0,0,0,0.8)" }}>{l.text}</div>
        ))}
        {points.map((k, i) => {
          const p = data.points[k];
          if (!p) return null;
          const s0 = revealStart(i, 8, 14, reveal);
          const o = interpolate(frame, [s0, s0 + 12], [0, 1], clamp);
          const h = hl.includes(k);
          const raw = labels[k] ?? p.label;
          const left = raw.startsWith("←") || p.x > W - 360;
          const text = raw.replace(/^←/, "");
          if (p.kind === "text") {
            return (
              <div key={k} style={{ opacity: o, position: "absolute", left: p.x, top: p.y, transform: "translate(-50%,-50%)", fontFamily: FONT, fontSize: 30, fontWeight: 700,
                color: C.cream, letterSpacing: 2, whiteSpace: "nowrap", textShadow: "0 2px 8px rgba(0,0,0,0.9)" }}>{text}</div>
            );
          }
          if (p.kind === "area") {
            const a = data.areas.find((x) => x.key === k);
            if (!a) return null;
            return (
              <div key={k} style={{ opacity: o, position: "absolute", left: a.bbox[2] + 14, top: (a.bbox[1] + a.bbox[3]) / 2 - 19, fontFamily: FONT, fontSize: h ? 28 : 26, fontWeight: 700,
                color: h ? "#ff8a80" : C.cream, textShadow: "0 2px 8px rgba(0,0,0,0.9)", whiteSpace: "nowrap" }}>{text}</div>
            );
          }
          const r = h ? 12 : 8;
          return (
            <div key={k} style={{ opacity: o }}>
              <div style={{ position: "absolute", left: p.x - r, top: p.y - r, width: r * 2, height: r * 2, borderRadius: "50%", background: h ? HL : C.amber,
                boxShadow: h ? "0 0 0 8px rgba(224,80,74,0.30)" : "0 0 0 6px rgba(230,163,90,0.25)" }} />
              <div style={{ position: "absolute", ...(left ? { right: W - p.x + r + 10 } : { left: p.x + r + 10 }), top: p.y - 19, fontFamily: FONT, fontSize: h ? 28 : 26, fontWeight: 700,
                color: h ? "#ff8a80" : C.cream, textShadow: "0 2px 8px rgba(0,0,0,0.9)", whiteSpace: "nowrap" }}>{text}</div>
            </div>
          );
        })}
        {route ? route.filter((k) => data.points[k]?.label && labels[k] !== undefined).map((k) => {
          // 矢印の先の文字（「太平洋へ」）は、その区切りが出たときに
          const p = data.points[k];
          const i = route.indexOf(k) - 1;
          const t0 = routeStart + Math.max(0, i) * 18 + 8;
          const o = interpolate(frame, [t0, t0 + 14], [0, 1], clamp);
          return (
            <div key={`rt${k}`} style={{ opacity: o, position: "absolute", left: p.x, top: p.y + 30, transform: "translateX(-50%)", fontFamily: FONT, fontSize: 24, fontWeight: 700,
              color: TIDE, whiteSpace: "nowrap", textShadow: "0 2px 8px rgba(0,0,0,0.9)" }}>{labels[k]}</div>
          );
        }) : null}
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 40, top: 30, display: "flex", alignItems: "center", gap: 14, fontFamily: FONT }}>
        <span style={{ fontSize: 14, color: C.bg, background: C.amber, padding: "3px 10px", letterSpacing: 3, fontWeight: 700 }}>地図</span>
        {note ? <span style={{ fontSize: 19, color: C.cream, letterSpacing: 1, textShadow: "0 1px 6px rgba(0,0,0,0.8)" }}>{note}</span> : null}
      </div>
      {data.source ? (
        <div style={{ position: "absolute", right: 34, bottom: 24, fontFamily: FONT, fontSize: 15, color: "rgba(239,228,208,0.62)", letterSpacing: 1 }}>{data.source}</div>
      ) : null}
    </FilmFrame>
  );
};
