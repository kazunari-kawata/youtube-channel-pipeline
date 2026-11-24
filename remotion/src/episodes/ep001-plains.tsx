/**
 * 第1回「なぜ日本人の7割は、国土のたった3.5%に住んでいるのか」
 * 構成案：episodes/001-plains/plan.md ／ 台本：episodes/001-plains/narration.json
 */
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { FONT } from "../lib/font";
import { EXAG, pl, world } from "../lib/geo";
import { RiverLine } from "../lib/Terrain";
import { Block, Card, EpisodeShell, P, along, clamp, ease, lerp, lerpV, ramp, v } from "../lib/scene";
import { seg } from "../lib/timeline";

// 主な平野の名前（低地を塗るシーンで表示）
const PLAINS: [string, number, number][] = [
  ["関東平野", 139.6, 36.05], ["濃尾平野", 136.75, 35.25], ["大阪平野", 135.6, 34.75],
  ["越後平野", 139.1, 37.85], ["石狩平野", 141.55, 43.25], ["筑紫平野", 130.4, 33.25],
];

// 利根川の流路（模式図。おおよその位置を結んだもの。画面にも「模式図」と表示する）
const TONE_OLD: [number, number][] = [
  [139.06, 36.39], [139.4, 36.22], [139.53, 36.2], [139.6, 36.11], [139.75, 35.98],
  [139.79, 35.89], [139.83, 35.75], [139.86, 35.64],
];
const TONE_NEW: [number, number][] = [
  [139.53, 36.2], [139.69, 36.14], [139.82, 36.09], [139.95, 36.0], [140.05, 35.91],
  [140.15, 35.86], [140.3, 35.88], [140.5, 35.89], [140.7, 35.82], [140.86, 35.74],
];

const NIGHT_Y = 0.4; // 夜の日本全体は高さの誇張を15倍→6倍に抑える

const BLOCKS: Block[] = [
  {
    key: "jp_night_intro", region: "japan", ids: ["n01", "n02", "n03"],
    cam: (t) => {
      const tg = lerpV(world("japan", 137.6, 37.4), world("japan", 137.9, 36.5), t);
      return { target: tg, pos: tg.clone().add(lerpV(v(0, 2500, 700), v(0, 1450, 1150), t)) };
    },
    params: () => P({ night: 1 }),
    yScale: NIGHT_Y,
    credit: "夜の光：NASA Black Marble 2016（NASA GIBS）",
  },
  {
    key: "jp_day_fly", region: "japan", ids: ["n04"],
    cam: (t) => {
      const tg = lerpV(world("japan", 131.2, 33.4), world("japan", 138.0, 35.9), t);
      return { target: tg, pos: tg.clone().add(v(-60, 430, 560)) };
    },
    params: (_f, local) => P({ night: interpolate(local, [0, 40], [1, 0], clamp) }),
    note: () => `地形の高さは${EXAG.japan}倍に強調`,
    credit: "地形：Copernicus DEM GLO-90",
  },
  {
    key: "jp_day_landuse", region: "japan", ids: ["n05"],
    cam: (t) => {
      const tg = world("japan", 137.6, 37.3);
      return { target: tg, pos: tg.clone().add(lerpV(v(0, 1950, 900), v(0, 1800, 1000), t)) };
    },
    params: () => P({ bright: 0.75 }),
    note: () => `地形の高さは${EXAG.japan}倍に強調`,
    credit: "地形：Copernicus DEM GLO-90",
  },
  {
    key: "jp_lowland", region: "japan", ids: ["n06"],
    cam: (t) => {
      const tg = world("japan", 137.5, 37.4);
      return { target: tg, pos: tg.clone().add(lerpV(v(0, 2400, 420), v(0, 2250, 560), t)) };
    },
    params: (f) => P({ low: ramp(f, seg("n06").startFrame - 5, seg("n06").startFrame + 55) }),
    labels: (f) => PLAINS.map(([text, lon, lat]) => ({ text, lon, lat, alpha: ramp(f, seg("n06").startFrame + 60, seg("n06").startFrame + 90) })),
    note: () => "黄色：標高100m未満の土地（日本の陸地のみ）",
    credit: "地形：Copernicus DEM GLO-90",
  },
  {
    key: "kanto_sea", region: "kanto", ids: ["n07", "n08", "n09"],
    cam: (t) => {
      const tg = lerpV(world("kanto", 139.74, 35.82), world("kanto", 139.8, 35.97), t);
      return { target: tg, pos: tg.clone().add(lerpV(v(0, 125, 170), v(-25, 105, 150), t)) };
    },
    params: (f) => {
      const up = ramp(f, seg("n08").startFrame + 10, seg("n08").startFrame + 200, 0, 10);
      const down = ramp(f, seg("n09").startFrame + 10, seg("n09").endFrame, 0, 10);
      return P({ sea: Math.max(0, up - down) });
    },
    labels: (f) => {
      const up = ramp(f, seg("n08").startFrame + 150, seg("n08").startFrame + 200) - ramp(f, seg("n09").startFrame + 30, seg("n09").startFrame + 90);
      return [
        { text: "東京湾", lon: 139.86, lat: 35.5, alpha: 1 },
        { text: "奥東京湾（目安）", lon: 139.68, lat: 36.05, alpha: Math.max(0, up) },
        { text: "富士山", lon: 138.73, lat: 35.36, alpha: ramp(f, seg("n07").startFrame, seg("n07").startFrame + 30), y: 22 },
      ];
    },
    note: (f) => {
      const up = ramp(f, seg("n08").startFrame + 10, seg("n08").startFrame + 200, 0, 10);
      const down = ramp(f, seg("n09").startFrame + 10, seg("n09").endFrame, 0, 10);
      const s = Math.max(0, up - down);
      return s > 0.05 ? `現在の地形で海面を +${s.toFixed(1)}m 上げた目安（当時の海岸線の復元ではない）` : `地形の高さは${EXAG.kanto}倍に強調`;
    },
    credit: "地形：Copernicus DEM GLO-30",
  },
  {
    key: "kanto_tone", region: "kanto", ids: ["n10", "n11", "n12"],
    cam: (t) => {
      const tg = world("kanto", 139.95, 35.95);
      return { target: tg, pos: tg.clone().add(lerpV(v(0, 255, 55), v(0, 240, 70), t)) };
    },
    params: () => P({ desat: 0.45, bright: 0.85 }),
    rivers: (f) => {
      const oldP = ramp(f, seg("n10").startFrame + 60, seg("n10").startFrame + 150);
      const newP = ramp(f, seg("n11").startFrame + 60, seg("n11").startFrame + 200);
      const oldA = interpolate(f, [seg("n11").startFrame + 60, seg("n11").startFrame + 200], [1, 0.35], clamp);
      return (
        <>
          <RiverLine region="kanto" pts={TONE_OLD} progress={oldP} color="#7fb8ff" opacity={oldA} />
          <RiverLine region="kanto" pts={TONE_NEW} progress={newP} color="#ffd25a" opacity={1} />
        </>
      );
    },
    labels: (f) => {
      const a1 = ramp(f, seg("n10").startFrame + 20, seg("n10").startFrame + 50);
      const a2 = ramp(f, seg("n10").startFrame + 120, seg("n10").startFrame + 150);
      const a3 = ramp(f, seg("n11").startFrame + 170, seg("n11").startFrame + 200);
      return [
        { text: "江戸", lon: pl("edo")[0], lat: pl("edo")[1], alpha: a1 },
        { text: "東京湾", lon: 139.86, lat: 35.5, alpha: a1 },
        { text: "付け替え前の利根川", lon: 139.5, lat: 36.0, alpha: a2 },
        { text: "銚子", lon: pl("choshi")[0], lat: pl("choshi")[1], alpha: a3 },
        { text: "付け替え後の利根川", lon: 140.25, lat: 36.0, alpha: a3 },
      ];
    },
    note: () => "模式図：川筋はおおよその位置",
    credit: "地形：Copernicus DEM GLO-30",
  },
  {
    key: "kanto_night", region: "kanto", ids: ["n13", "n14"],
    cam: (t) => {
      const tg = world("kanto", 139.75, 35.75);
      const a = lerp(-0.35, 0.3, t);
      return { target: tg, pos: tg.clone().add(v(150 * Math.sin(a), 85, 150 * Math.cos(a))) };
    },
    params: () => P({ night: 1 }),
    labels: () => [{ text: "東京", lon: pl("tokyo")[0], lat: pl("tokyo")[1], alpha: 1 }],
    credit: "夜の光：NASA Black Marble 2016（NASA GIBS）",
  },
  {
    key: "jp_night_belt", region: "japan", ids: ["n15"],
    cam: (t) => {
      const route = [pl("kitakyushu"), pl("hiroshima"), pl("osaka"), pl("nagoya"), pl("tokyo")];
      const tg = along("japan", route, ease(t));
      return { target: tg, pos: tg.clone().add(v(0, 300, 430)) };
    },
    params: () => P({ night: 1 }),
    labels: () => [
      { text: "北九州", lon: pl("kitakyushu")[0], lat: pl("kitakyushu")[1], alpha: 1 },
      { text: "広島", lon: pl("hiroshima")[0], lat: pl("hiroshima")[1], alpha: 1 },
      { text: "大阪", lon: pl("osaka")[0], lat: pl("osaka")[1], alpha: 1 },
      { text: "名古屋", lon: pl("nagoya")[0], lat: pl("nagoya")[1], alpha: 1 },
      { text: "東京", lon: pl("tokyo")[0], lat: pl("tokyo")[1], alpha: 1 },
    ],
    note: () => `地形の高さは${EXAG.japan * NIGHT_Y}倍に強調`,
    yScale: NIGHT_Y,
    credit: "夜の光：NASA Black Marble 2016（NASA GIBS）",
  },
  {
    key: "jp_night_tokyo", region: "japan", ids: ["n16"],
    cam: (t) => {
      const tg = world("japan", pl("tokyo")[0], pl("tokyo")[1]);
      return { target: tg, pos: tg.clone().add(lerpV(v(0, 300, 430), v(-20, 160, 230), t)) };
    },
    params: () => P({ night: 1 }),
    labels: () => [{ text: "東京", lon: pl("tokyo")[0], lat: pl("tokyo")[1], alpha: 1 }],
    note: () => `地形の高さは${EXAG.japan * NIGHT_Y}倍に強調`,
    yScale: NIGHT_Y,
    credit: "夜の光：NASA Black Marble 2016（NASA GIBS）",
  },
  {
    key: "jp_night_outro", region: "japan", ids: ["n17", "n18"],
    cam: (t) => {
      const tg = lerpV(world("japan", pl("tokyo")[0], pl("tokyo")[1]), world("japan", 137.6, 37.2), t);
      return { target: tg, pos: tg.clone().add(lerpV(v(-20, 160, 230), v(0, 2500, 760), t)) };
    },
    params: () => P({ night: 1 }),
    yScale: NIGHT_Y,
    credit: "夜の光：NASA Black Marble 2016（NASA GIBS）",
  },
];

/* ---------- この回だけのグラフ・タイトル ---------- */

const Title: React.FC = () => {
  const f = useCurrentFrame();
  const s = seg("n03");
  const a = interpolate(f, [s.startFrame + 20, s.startFrame + 45, s.endFrame - 5, s.endFrame + 15], [0, 1, 1, 0], clamp);
  if (a <= 0) return null;
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: a }}>
      <div style={{ fontFamily: FONT, fontSize: 50, fontWeight: 700, color: "#fff", textAlign: "center", lineHeight: 1.35,
        textShadow: "0 0 18px #000, 0 0 6px #000", marginTop: -120 }}>
        なぜ日本人の7割は、<br />国土の3.5%に住んでいるのか
      </div>
    </AbsoluteFill>
  );
};

const LandUseChart: React.FC = () => {
  const f = useCurrentFrame(); const s = seg("n05");
  const a = interpolate(f, [s.startFrame, s.startFrame + 20, s.endFrame + 5, s.endFrame + 25], [0, 1, 1, 0], clamp);
  if (a <= 0) return null;
  const g = ramp(f, s.startFrame + 10, s.startFrame + 70);
  const items = [
    { k: "森林", v: 66.2, c: "#4e9a5a" }, { k: "農地", v: 11.6, c: "#d8c15a" },
    { k: "宅地", v: 3.2, c: "#ff6b4a" }, { k: "その他（道路・水面など）", v: 19.0, c: "#7d8794" },
  ];
  return (
    <Card a={a} src="総務省統計局「日本統計年鑑」（国土交通省「土地白書」, 2020年）">
      <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>国土の使い道（2020年）</div>
      <div style={{ display: "flex", height: 40, borderRadius: 6, overflow: "hidden", width: 556 }}>
        {items.map((it) => <div key={it.k} style={{ width: `${it.v * g}%`, background: it.c }} />)}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px", marginTop: 12, fontSize: 18 }}>
        {items.map((it) => (
          <div key={it.k} style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: it.k === "宅地" ? 700 : 400 }}>
            <span style={{ width: 12, height: 12, background: it.c, display: "inline-block", borderRadius: 2 }} />{it.k} {it.v.toFixed(1)}%
          </div>
        ))}
      </div>
    </Card>
  );
};

const DidChart: React.FC = () => {
  const f = useCurrentFrame(); const s = seg("n13");
  const a = interpolate(f, [s.startFrame + 140, s.startFrame + 160, s.endFrame + 5, s.endFrame + 25], [0, 1, 1, 0], clamp);
  if (a <= 0) return null;
  const g = ramp(f, s.startFrame + 160, s.startFrame + 260);
  const bar = (label: string, val: number, grow: number, color: string) => (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 18 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 420, height: 26, background: "rgba(255,255,255,0.12)", borderRadius: 4 }}>
          <div style={{ width: `${val * grow}%`, height: "100%", background: color, borderRadius: 4 }} />
        </div>
        <div style={{ fontSize: 26, fontWeight: 700, width: 100 }}>{(val * grow).toFixed(1)}%</div>
      </div>
    </div>
  );
  return (
    <Card a={a} src="総務省統計局「令和2年国勢調査 人口集中地区の概要」">
      <div style={{ fontSize: 22, fontWeight: 700 }}>人口集中地区に住む人の割合</div>
      {bar("1960年", 43.7, 1, "#8fb3d9")}
      {bar("2020年", 70.0, g, "#ffd25a")}
    </Card>
  );
};

const TokyoKenChart: React.FC = () => {
  const f = useCurrentFrame(); const s = seg("n14");
  const a = interpolate(f, [s.startFrame + 10, s.startFrame + 30, s.endFrame + 5, s.endFrame + 25], [0, 1, 1, 0], clamp);
  if (a <= 0) return null;
  const rows = [["1920年", 13.7, "#8fb3d9"], ["2020年", 29.3, "#c9b06a"], ["2025年", 30.1, "#ffd25a"]] as const;
  return (
    <Card a={a} src="内閣府「令和5年版 防災白書」（1920・2020年）、総務省統計局「令和7年国勢調査」（2025年）">
      <div style={{ fontSize: 22, fontWeight: 700 }}>東京圏の人口が全国に占める割合</div>
      {rows.map(([label, val, color], i) => {
        const g = ramp(f, s.startFrame + 30 + i * 90, s.startFrame + 90 + i * 90);
        return (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
            <div style={{ width: 70, fontSize: 18 }}>{label}</div>
            <div style={{ width: 360, height: 26, background: "rgba(255,255,255,0.12)", borderRadius: 4 }}>
              <div style={{ width: `${(val / 35) * 100 * g}%`, height: "100%", background: color, borderRadius: 4 }} />
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, opacity: g }}>{val.toFixed(1)}%</div>
          </div>
        );
      })}
    </Card>
  );
};

export const Ep001: React.FC = () => (
  <EpisodeShell blocks={BLOCKS}>
    <Title />
    <LandUseChart />
    <DidChart />
    <TokyoKenChart />
  </EpisodeShell>
);
