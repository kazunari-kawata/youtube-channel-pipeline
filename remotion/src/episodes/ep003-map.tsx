/**
 * 003 の地図。共有の MapShot（lib/shots.tsx）と同じ見せ方に、川の中心線（USGS NHD）を足したもの。
 * この回は「ルイス川とコロンビア川に囲まれた一帯」が話の中心なので、川の線がないと場所が伝わらない。
 * 川の線は episodes/003-db-cooper/maps_rivers.py が map_<view>.json の rivers に入れる。
 * 共有の MapShot は変えない（002 の画面に影響させないため）。見た目を変えるときは MapShot とそろえる。
 */
import React, { useEffect, useMemo, useState } from "react";
import { AbsoluteFill, cancelRender, continueRender, delayRender, interpolate, staticFile, useCurrentFrame } from "remotion";
import { FONT } from "../lib/font";
import { H, W } from "../lib/geo";
import { C, FilmFrame, Reveal } from "../lib/shots";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const HL = "#e0504a";

type MapData = {
  land: string[]; lakes: string[]; countries: string[]; states: { d: string; hl: boolean }[];
  points: Record<string, { x: number; y: number; label: string }>; labels: { x: number; y: number; text: string; kind: string }[];
  note: string; source: string; rivers?: { d: string; name: string; kind: string }[];
};
const cache: Record<string, Promise<MapData>> = {};

const revealStart = (i: number, base: number, step: number, r?: Reveal) => (r && i >= r.from ? r.frame + (i - r.from) * step : base + i * step);

export const Map003: React.FC<{ file: string; points: string[]; route?: string[]; reveal?: Reveal; hl?: string[]; labels?: Record<string, string> }> = ({
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
  const routeD = useMemo(() => {
    if (!data || !route || route.length < 2) return null;
    const [p, q] = [data.points[route[0]], data.points[route[1]]];
    const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2 - Math.hypot(q.x - p.x, q.y - p.y) * 0.22;
    return `M${p.x},${p.y} Q${mx},${my} ${q.x},${q.y}`;
  }, [data, route]);
  if (!data) return null;
  const routeStart = route ? Math.max(...route.map((k) => revealStart(Math.max(0, points.indexOf(k)), 8, 14, reveal))) + 6 : 14;
  const draw = interpolate(frame, [routeStart, routeStart + 46], [0, 1], clamp);
  return (
    <FilmFrame bg="#0f1726">
      {/* 地図は拡大・縮小しない（細い線と地名がピクセルの境目でちらつく） */}
      <AbsoluteFill>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          <rect width={W} height={H} fill="#13203a" />
          {data.land.map((d, i) => <path key={`l${i}`} d={d} fill="#2a2a2c" />)}
          {data.states.map((s, i) => <path key={`s${i}`} d={s.d} fill={s.hl ? "#3d3528" : "none"} stroke="rgba(239,228,208,0.28)" strokeWidth={1} />)}
          {data.countries.map((d, i) => <path key={`c${i}`} d={d} fill="none" stroke="rgba(239,228,208,0.25)" strokeWidth={0.8} />)}
          {data.lakes.map((d, i) => <path key={`k${i}`} d={d} fill="#13203a" />)}
          {(data.rivers ?? []).map((r, i) => (
            <path key={`r${i}`} d={r.d} fill="none" stroke="#3f6596" strokeWidth={r.kind === "main" ? 5 : 2.4} strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {routeD ? <path d={routeD} fill="none" stroke={C.amber} strokeWidth={3} strokeDasharray="10 8" opacity={draw} /> : null}
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
          const r = h ? 12 : 8;
          // 地名の頭に「←」を付けると点の左に出す（隣の点の地名と重なるとき）。右端に近い点も左
          const raw = labels[k] ?? p.label;
          const left = raw.startsWith("←") || p.x > W - 360;
          const text = raw.replace(/^←/, "");
          return (
            <div key={k} style={{ opacity: o }}>
              <div style={{ position: "absolute", left: p.x - r, top: p.y - r, width: r * 2, height: r * 2, borderRadius: "50%", background: h ? HL : C.amber,
                boxShadow: h ? "0 0 0 8px rgba(224,80,74,0.30)" : "0 0 0 6px rgba(230,163,90,0.25)" }} />
              <div style={{ position: "absolute", ...(left ? { right: W - p.x + r + 10 } : { left: p.x + r + 10 }), top: p.y - 19, fontFamily: FONT, fontSize: h ? 28 : 26, fontWeight: 700,
                color: h ? "#ff8a80" : C.cream, textShadow: "0 2px 8px rgba(0,0,0,0.9)", whiteSpace: "nowrap" }}>{text}</div>
            </div>
          );
        })}
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 40, top: 30, display: "flex", alignItems: "center", gap: 14, fontFamily: FONT }}>
        <span style={{ fontSize: 14, color: C.bg, background: C.amber, padding: "3px 10px", letterSpacing: 3, fontWeight: 700 }}>地図</span>
        {data.note ? <span style={{ fontSize: 19, color: C.cream, letterSpacing: 1, textShadow: "0 1px 6px rgba(0,0,0,0.8)" }}>{data.note}</span> : null}
      </div>
      {data.source ? (
        <div style={{ position: "absolute", right: 34, bottom: 24, fontFamily: FONT, fontSize: 15, color: "rgba(239,228,208,0.62)", letterSpacing: 1 }}>{data.source}</div>
      ) : null}
    </FilmFrame>
  );
};
