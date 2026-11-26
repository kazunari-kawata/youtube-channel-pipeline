/**
 * 003 D.B.クーパー事件「なぜ名前すら分からないのか」
 * 構成案：episodes/003-db-cooper/plan.md ／ 台本と香盤表：episodes/003-db-cooper/narration.json（visual 欄）、shotlist.md
 *
 * カットの並びは台本の visual 欄から自動で作る（"same" は前のカットを続ける。組み方は ep002 と同じ）。
 * 素材は remotion/public/003/（episodes/003-db-cooper/prepare_materials.py → pipeline/cut_materials.py、make_maps.py で作る）。
 * 同じ資料の別の行は <src>__<focus>.jpg に切り出してあり、あればそちらを出す。
 *
 * 2026-11-25：声はまだ作らない（ユーザーの指示）。声がないあいだは、仮の尺（build/timeline.json）で、
 * BGM と効果音だけを鳴らす（episodes/003-db-cooper/stage_draft.py が準備する）。
 * まだ取れていない素材と、まだ作っていないイメージ映像の場面は「素材待ち」の画面にする（止めずに全体を通して見られるように）。
 */
import React, { useMemo } from "react";
import { AbsoluteFill, Audio, Easing, getStaticFiles, Img, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import current from "../data/current.json";
import { InsertDuration } from "../inserts/Inserts";
import { INSERT_SCENES } from "../inserts/registry";
import { FONT } from "../lib/font";
import { H, W } from "../lib/geo";
import { C, CardShot, CardV, DocMeta, FilmFrame, PaperShot, Reveal } from "../lib/shots";
import { Map003 } from "./ep003-map";
import { Seg, segs, TL } from "../lib/timeline";
import SIZES from "./ep003-assets.json";

const DIR = "003";
const XF = 12; // カットの切り替え（クロスフェード）
const LEAD = 8; // ナレーションより少し先に画面を変える

const FBI = "出典：FBI（情報公開法による公開）";
const FBI_WEB = "出典：FBI";
const NARA = "出典：米国立公文書館";

/** 画面に出す素材の見出しと出典（台帳 materials.yaml の id ごと）。縦横比は ep003-assets.json（prepare_materials.py --assets） */
const META: Record<string, DocMeta> = {
  fbi_v43_press_1980: { title: "FBIシアトル支局の発表文（1980年2月12日）", source: FBI },
  fbi_v64_p159: { title: "FBIの聞き取りの記録（客室乗務員、1971年12月3日）", source: FBI },
  fbi_v64_p161: { title: "FBIの聞き取りの記録（客室乗務員）", source: FBI },
  fbi_v26_p471: { title: "FBI本部からシアトル支局への覚書（1972年6月27日）", source: FBI },
  fbi_v24_p307: { title: "FBIのテレタイプ：男が書き取らせた要求", source: FBI },
  fbi_v41_p27: { title: "FBIの報告：機内の灰皿", source: FBI },
  fbi_v74_p257: { title: "FBIがまとめた人物像", source: FBI },
  fbi_v76_p76: { title: "FBIシアトル支局の事件のまとめ（SE 164-81）", source: FBI },
  fbi_v76_p77: { title: "FBIシアトル支局の事件のまとめ（SE 164-81）", source: FBI },
  fbi_v76_p78: { title: "FBIシアトル支局の事件のまとめ（SE 164-81）", source: FBI },
  fbi_v10_p448: { title: "FBIの聞き取りの記録（客室乗務員）", source: FBI },
  fbi_v95_p293: { title: "FBIの報告：305便の飛び方", source: FBI },
  fbi_v10_reno_teletype: { title: "FBIのテレタイプ（1971年11月25日）", source: FBI },
  fbi_v43_decal_teletype: { title: "FBIシアトル支局のテレタイプ（1978年11月）", source: FBI },
  fbi_v77_description: { title: "FBIの事件の概要と人相書き", source: FBI },
  fbi_v77_p250: { title: "FBIの事件の概要と人相書き（2ページ目）", source: FBI },
  fbi_v42_letter_1978: { title: "FBIの書簡（1978年）", source: FBI },
  fbi_v24_indictment: { title: "起訴状（オレゴン地区連邦地裁 CR 76-229、1976年11月24日）", source: `${FBI}。連邦地裁の書類` },
  fbi_v52_p038: { title: "FBIの文書（2002年8月20日）", source: FBI },
  fbi_sketch: { title: "FBIの似顔絵（乗務員の証言から作成）", source: FBI },
  nara_us_attorney: { title: "連邦検事局の事件ファイル（国立公文書館シアトル分館）", source: NARA },
  // fbi.gov のページの写真（クラウドからは取れない。取れたら cuts.yaml に足す）
  fbi_tie: { title: "機内に残されたネクタイ", source: FBI_WEB },
  fbi_money_1980: { title: "1980年に見つかった紙幣", source: FBI_WEB },
  fbi_ticket: { title: "男が「ダン・クーパー」の名で買った航空券", source: FBI_WEB },
  fbi_parachute: { title: "機内に残されたパラシュート", source: FBI_WEB },
  fbi_parachute_bag: { title: "パラシュートの袋", source: FBI_WEB },
  fbi_map_2007: { title: "FBIの地図（2007年公開）", source: FBI_WEB },
  fbi_2007_story: { title: "FBIの記事（2007年12月31日）", source: FBI_WEB },
  fbi_2016_update: { title: "FBIシアトル支局の発表（2016年7月12日）", source: FBI_WEB },
  faa_rule_1972: { title: "連邦航空局の規則改正 25-34・121-99（1972年）", source: "出典：米連邦官報（1972年11月30日）" },
  doc_pdx_airport: { title: "1970年代のポートランド国際空港（事件当日の写真ではない）", source: `${NARA}（DOCUMERICA）` },
  doc_portland_misty_evening: { title: "1970年代のポートランド（事件当日の写真ではない）", source: `${NARA}（DOCUMERICA）` },
  doc_columbia_cascade_locks: { title: "1970年代のコロンビア川（カスケード・ロックス）", source: `${NARA}（DOCUMERICA）` },
  doc_columbia_hayden: { title: "1970年代のコロンビア川（ポートランドとバンクーバーの間）", source: `${NARA}（DOCUMERICA）` },
  usgs_swwa_1970s: { title: "ワシントン州南西部の航空写真（1970年代）", source: "出典：米地質調査所（USGS）" },
  usgs_topo_ariel_1971: { title: "ルイス川とマーウィン湖のあたりの地形図（1971年版）", source: "出典：米地質調査所（USGS）" },
};

const ASSET_SIZES = SIZES as unknown as Record<string, [number, number]>;
/** 台本の src と focus から、出す画像の名前を決める（同じ資料の別の行は <src>__<focus>） */
const assetName = (src: string, focus?: string) => (focus && ASSET_SIZES[`${src}__${focus}`] ? `${src}__${focus}` : src);

type Visual = { kind: string; [k: string]: any };
type Shot = { v: Visual; from: number; to: number; segs: Seg[]; reveal?: Reveal };

const buildShots = (): Shot[] => {
  const out: Shot[] = [];
  const at = (s: any, frac: number) => Math.round(s.startFrame + frac * (s.endFrame - s.startFrame));
  for (const s of segs) {
    const v = (s as any).visual as Visual | "same" | undefined;
    if (!v) throw new Error(`${s.id} に visual がありません（香盤表）`);
    if (v === "same") {
      if (!out.length) throw new Error("最初の区間は same にできません");
      out[out.length - 1].segs.push(s);
    } else {
      out.push({ v, from: out.length ? Math.max(0, s.startFrame - LEAD) : 0, to: 0, segs: [s] });
    }
    const c = (s as any).cut;
    const r = (s as any).reveal;
    const ra = (s as any).reveal_at ?? 0;
    const addReveal = () => {
      const sh = out[out.length - 1];
      sh.reveal = { from: r, frame: Math.max(0, at(s, ra) - sh.from) };
    };
    if (typeof r === "number" && !(c && ra >= c.at)) addReveal();
    if (c) out.push({ v: c.visual as Visual, from: at(s, c.at), to: 0, segs: [s] });
    if (typeof r === "number" && c && ra >= c.at) addReveal();
  }
  out.forEach((sh, i) => (sh.to = i + 1 < out.length ? out[i + 1].from : TL.totalFrames));
  return out;
};

/** まだ素材・場面がないところ。何が入るかを小さく出す（確認用。公開する動画には残さない） */
const Pending: React.FC<{ what: string; id: string; note?: string }> = ({ what, id, note }) => (
  <FilmFrame bg="radial-gradient(ellipse at 50% 45%, #1d1a17 0%, #0b0a09 80%)">
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", fontFamily: FONT, textAlign: "center" }}>
      <div style={{ color: C.amber, fontSize: 22, letterSpacing: 6 }}>素材待ち：{what}</div>
      <div style={{ color: C.cream, fontSize: 30, fontWeight: 700, marginTop: 14 }}>{id}</div>
      {note ? <div style={{ color: C.muted, fontSize: 20, marginTop: 14, maxWidth: 900, lineHeight: 1.6 }}>{note}</div> : null}
    </AbsoluteFill>
  </FilmFrame>
);

/** 当時の航空写真（USGS）。ゆっくりも拡大しない（細い線がちらつく） */
const Aerial003: React.FC<{ src: string; label: string }> = ({ src, label }) => (
  <FilmFrame bg="#000">
    <Img src={staticFile(src)} style={{ position: "absolute", width: W, height: H, objectFit: "cover" }} />
    <AbsoluteFill style={{ background: "rgba(10,12,20,0.15)" }} />
    <div style={{ position: "absolute", left: 60, bottom: 70, fontFamily: FONT, fontSize: 24, color: C.cream, background: "rgba(13,14,18,0.78)", padding: "6px 14px", borderLeft: `3px solid ${C.amber}` }}>{label}</div>
  </FilmFrame>
);

const ShotView: React.FC<{ v: Visual; reveal?: Reveal }> = ({ v, reveal }) => {
  switch (v.kind) {
    case "card":
      return <CardShot v={v as unknown as CardV} reveal={reveal} />;
    case "doc":
    case "photo": {
      const name = assetName(v.src, v.focus);
      const size = ASSET_SIZES[name];
      const m = META[v.src];
      if (!m) throw new Error(`素材 ${v.src} の見出しがありません（ep003-db-cooper.tsx の META）`);
      if (!size) return <Pending what={v.kind === "photo" ? "写真" : "資料"} id={v.src} note={v.note} />;
      const meta = v.kind === "photo" && v.label ? { ...m, title: v.label } : m;
      return <PaperShot src={`${DIR}/${name}.jpg`} meta={meta} photo={v.kind === "photo"} aspect={size[0] / size[1]} ja={v.ja} />;
    }
    case "aerial":
      return ASSET_SIZES[v.src] ? <Aerial003 src={`${DIR}/${v.src}.jpg`} label={v.label} /> : <Pending what="航空写真" id={v.src} note={v.label} />;
    case "map":
      return <Map003 file={`${DIR}/map_${v.view}.json`} points={v.points ?? []} route={v.route} reveal={reveal} hl={v.hl} labels={v.labels} />;
    case "insert": {
      const Scene = INSERT_SCENES[v.scene];
      if (!Scene) return <Pending what="イメージ映像" id={`${v.scene}:${v.var}`} note={v.note} />;
      return <Scene variant={v.var} />;
    }
    default:
      throw new Error(`知らない画面の種類 ${v.kind}`);
  }
};

const Fade: React.FC<{ children: React.ReactNode; first: boolean }> = ({ children, first }) => {
  const f = useCurrentFrame();
  const o = first ? 1 : interpolate(f, [0, XF], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
};

/** 効果音（stage.py / stage_draft.py が current.json の sfx に置く）。組み方は ep002 と同じ */
type SfxCue = { file: string; frame: number; gain: number; bed: boolean; frames?: number };
const BedVolume = (gain: number, frames: number) => (f: number) =>
  gain * interpolate(f, [0, 15, Math.max(16, frames - 21), frames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
const Sfx: React.FC = () => {
  const cues = ((current as any).sfx ?? []) as SfxCue[];
  return (
    <>
      {cues.map((c, i) =>
        c.bed ? (
          <Sequence key={i} from={c.frame} durationInFrames={Math.max(1, c.frames ?? 120)} layout="none">
            <Audio src={staticFile(`sfx/${c.file}`)} volume={BedVolume(c.gain, c.frames ?? 120)} loop />
          </Sequence>
        ) : (
          <Sequence key={i} from={c.frame} layout="none">
            <Audio src={staticFile(`sfx/${c.file}`)} volume={c.gain} />
          </Sequence>
        ),
      )}
    </>
  );
};

/** 声・BGM・効果音。声がまだない（仮の尺）あいだは、BGM を声のない区間の音量で通し、効果音を鳴らす */
const Sound: React.FC = () => {
  const files = getStaticFiles().map((f) => f.name);
  const cur = current as any;
  if (cur.episode !== "003-db-cooper") return null;
  const voice = !(TL as any).estimated && files.includes("narration.wav");
  const withBgm = cur.bgm === true && files.includes("bgm.wav");
  const { bgmSpeech, bgmGap, duckFrames } = cur.mix;
  const vol = (f: number) => {
    if (!voice) return bgmGap;
    let d = Infinity;
    for (const s of segs) {
      if (f >= s.startFrame && f <= s.endFrame) return bgmSpeech;
      d = Math.min(d, Math.abs(f - s.startFrame), Math.abs(f - s.endFrame));
    }
    const k = Math.min(1, d / duckFrames);
    return bgmSpeech + (bgmGap - bgmSpeech) * (k * k * (3 - 2 * k));
  };
  return (
    <>
      {voice ? <Audio src={staticFile("narration.wav")} /> : null}
      {withBgm ? <Audio src={staticFile("bgm.wav")} volume={vol} /> : null}
      <Sfx />
    </>
  );
};

export const Ep003: React.FC = () => {
  const shots = useMemo(buildShots, []);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {shots.map((sh, i) => {
        const dur = sh.to - sh.from + (i + 1 < shots.length ? XF : 0);
        return (
          <Sequence key={i} from={sh.from} durationInFrames={dur} name={`${sh.v.kind} ${sh.segs[0].id}`}>
            <InsertDuration.Provider value={dur}>
              <Fade first={i === 0}>
                <ShotView v={sh.v} reveal={sh.reveal} />
              </Fade>
            </InsertDuration.Provider>
          </Sequence>
        );
      })}
      <Sound />
    </AbsoluteFill>
  );
};
