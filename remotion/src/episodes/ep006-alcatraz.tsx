/**
 * 006 アルカトラズ脱獄「FBIの支局が『間違いなく死亡』と書いた3人の手配は、なぜ64年たっても消えないのか」
 * 構成案：episodes/006-alcatraz/plan.md ／ 台本と香盤表：episodes/006-alcatraz/narration.json（visual 欄）、shotlist.md
 *
 * 組み方は ep003 と同じ（カットの並びは台本の visual 欄から自動で作る。"same" は前のカットを続ける）。
 * 素材は remotion/public/006/（episodes/006-alcatraz/prepare_materials_006.py、地図は make_maps_006.py）。
 * 同じ資料の別の行は <src>__<focus>.jpg に切り出してあり、あればそちらを出す。
 *
 * 2026-11-28：声はまだ作らない（ユーザーの指示）。仮の尺（build/timeline.json）で、BGM と効果音だけを鳴らす
 * （episodes/006-alcatraz/stage_draft.py が準備する）。まだ取れていない素材は「素材待ち」の画面にする（止めずに全体を通して見られるように）。
 * イメージ映像は remotion/src/inserts/Scenes006a〜d.tsx。撮った映像は使わない（F-057）。
 */
import React, { useMemo } from "react";
import { AbsoluteFill, Audio, Easing, getStaticFiles, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import current from "../data/current.json";
import { InsertDuration } from "../inserts/Inserts";
import { INSERT_SCENES } from "../inserts/registry";
import { FONT } from "../lib/font";
import { H, W } from "../lib/geo";
import { C, CardShot, CardV, DocMeta, FilmFrame, PaperShot, Reveal } from "../lib/shots";
import { Map006 } from "./ep006-map";
import { Seg, segs, TL } from "../lib/timeline";
import SIZES from "./ep006-assets.json";

const DIR = "006";
const XF = 12; // カットの切り替え（クロスフェード）
const LEAD = 8; // ナレーションより少し先に画面を変える

const FBI = "出典：FBI（情報公開法による公開）";
const FBI_WEB = "出典：FBI";
const USMS = "出典：連邦保安官局";
const LOC = "出典：米議会図書館（HABS）";

/** 画面に出す素材の見出しと出典（台帳 materials.yaml の id ごと）。縦横比は ep006-assets.json（episodes/006-alcatraz/prepare_materials_006.py が書く） */
const META: Record<string, DocMeta> = {
  // FBI の捜査ファイル（FBI Vault「Alcatraz Escape」。分冊とページは素材台帳）
  fbi_v15_p041: { title: "FBIサンフランシスコ支局の報告（1971年10月29日）", source: FBI },
  fbi_v15_p042: { title: "FBIサンフランシスコ支局の報告（1971年10月29日）の結び", source: FBI },
  fbi_v15_p049: { title: "FBI本部から支局へ（1971年11月12日）", source: FBI },
  fbi_v15_p087: { title: "FBI本部から全支局へ（1980年1月8日）", source: FBI },
  fbi_v06_p115: { title: "FBIの聞き取りの記録（朝の点検にいた職員）", source: FBI },
  fbi_v02_p035: { title: "FBIの捜査概要報告（1962年6月19日）", source: FBI },
  fbi_v02_p037: { title: "FBIの捜査概要報告（1962年6月19日）より", source: FBI },
  fbi_v02_p005: { title: "FBI本部のメモ（1962年6月14日）", source: FBI },
  fbi_v07_p044: { title: "FBIの聞き取りの記録（4人目の受刑者）", source: FBI },
  fbi_v10_p027: { title: "FBIの聞き取りの記録（夜勤の職員、1962年8月）", source: FBI },
  fbi_v05_p003: { title: "FBI支局長から長官への通信（1962年7月20日）", source: FBI },
  fbi_v05_p033: { title: "FBIの報告（1962年7月18日）", source: FBI },
  fbi_v05_p044: { title: "FBIの報告（1962年7月18日）：捜索", source: FBI },
  fbi_v05_p048: { title: "FBIの報告（1962年7月）：潮と流れ", source: FBI },
  fbi_v01_p078: { title: "FBI本部のメモ（1962年6月15日）", source: FBI },
  fbi_v01_p089: { title: "FBI本部の要約メモ（1962年6月）", source: FBI },
  fbi_v11_p042: { title: "FBIの聞き取り（1962年10月18日）", source: FBI },
  fbi_v11_p112: { title: "FBIの報告：鑑識の結果", source: FBI },
  fbi_v13_p073: { title: "FBI本部から支局へ（1964年7月13日）", source: FBI },
  // FBI の公式ページの写真
  fbi_dummy_head_side: { title: "人形の頭", source: FBI_WEB },
  fbi_dummy_head_bed: { title: "房の寝台に置かれていた人形の頭", source: FBI_WEB },
  fbi_mugshots: { title: "3人の顔写真", source: FBI_WEB },
  fbi_ev_vent_grille: { title: "房の奥の通気口", source: FBI_WEB },
  fbi_ev_roof_vent: { title: "屋根の通気口", source: FBI_WEB },
  fbi_ev_shore_aerial: { title: "島の北東の岸", source: FBI_WEB },
  fbi_ev_raft: { title: "いかだの一部", source: FBI_WEB },
  fbi_ev_paddle: { title: "手作りの櫂", source: FBI_WEB },
  fbi_ev_lifevest: { title: "手作りの救命胴衣", source: FBI_WEB },
  // 連邦保安官局（手配書と、サイトの画面の写し）
  usms_profile_morris: { title: "連邦保安官局の手配ページ（2026年11月26日に保存）", source: USMS },
  usms_profiles_list: { title: "連邦保安官局のサイト（2026年11月26日に保存）", source: USMS },
  usms_poster_morris: { title: "連邦保安官局の手配書（フランク・リー・モリス）", source: USMS },
  usms_poster_john: { title: "連邦保安官局の手配書（ジョン・ウィリアム・アングリン）", source: USMS },
  usms_poster_clarence: { title: "連邦保安官局の手配書（クラレンス・アングリン）", source: USMS },
  usms_release_2012: { title: "連邦保安官局の発表（2012年6月7日）", source: USMS },
  // 議会図書館（歴史的アメリカ建築調査 HABS。1986年の記録写真）
  loc_habs_exterior: { title: "閉鎖後のアルカトラズの房棟（1986年撮影）", source: LOC },
  loc_habs_cellhouse: { title: "閉鎖後の房棟の内部（1986年撮影）", source: LOC },
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
    // 区間の途中で画面を替える（cut。1つなら {at, visual}、2つ以上ならリスト）
    const raw = (s as any).cut;
    const cuts: { at: number; visual: Visual }[] = (raw ? (Array.isArray(raw) ? raw : [raw]) : []).slice().sort((a: any, b: any) => a.at - b.at);
    const r = (s as any).reveal;
    const ra = (s as any).reveal_at ?? 0;
    const addReveal = () => {
      const sh = out[out.length - 1];
      sh.reveal = { from: r, frame: Math.max(0, at(s, ra) - sh.from) };
    };
    // 後出し（reveal）は、その時刻に映っているカットに付く
    if (typeof r === "number" && (!cuts.length || ra < cuts[0].at)) addReveal();
    cuts.forEach((c, k) => {
      out.push({ v: c.visual, from: at(s, c.at), to: 0, segs: [s] });
      const nxt = k + 1 < cuts.length ? cuts[k + 1].at : 2;
      if (typeof r === "number" && c.at <= ra && ra < nxt) addReveal();
    });
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

const ShotView: React.FC<{ v: Visual; reveal?: Reveal }> = ({ v, reveal }) => {
  switch (v.kind) {
    case "card":
      return <CardShot v={v as unknown as CardV} reveal={reveal} />;
    case "doc":
    case "photo": {
      const name = assetName(v.src, v.focus);
      const size = ASSET_SIZES[name];
      const m = META[v.src];
      if (!m) throw new Error(`素材 ${v.src} の見出しがありません（ep006-alcatraz.tsx の META）`);
      if (!size) return <Pending what={v.kind === "photo" ? "写真" : "資料"} id={v.src} note={v.note} />;
      const meta = v.kind === "photo" && v.label ? { ...m, title: v.label } : m;
      return <PaperShot src={`${DIR}/${name}.jpg`} meta={meta} photo={v.kind === "photo"} aspect={size[0] / size[1]} ja={v.ja} />;
    }
    case "map":
      return <Map006 file={`${DIR}/map_${v.view}.json`} points={v.points ?? []} route={v.route} reveal={reveal} hl={v.hl} labels={v.labels} />;
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

/** 声・BGM・効果音。声がまだない（仮の尺）あいだは、BGM を声のない区間の音量で通し、効果音を鳴らす（ep003 と同じ） */
const Sound: React.FC = () => {
  const files = getStaticFiles().map((f) => f.name);
  const cur = current as any;
  if (cur.episode !== "006-alcatraz") return null;
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

export const Ep006: React.FC = () => {
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
