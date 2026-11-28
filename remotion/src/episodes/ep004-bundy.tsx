/**
 * 004 テッド・バンディ「イケメンで法学部、選挙運動もした『好青年』は何をしたのか」（仮）
 * 構成案：episodes/004-bundy/plan.md ／ 台本と香盤表：episodes/004-bundy/narration.json（visual 欄）、shotlist.md
 *
 * 組み方は ep006 と同じ（カットの並びは台本の visual 欄から自動で作る。"same" は前のカットを続ける）。
 * 素材は remotion/public/004/（episodes/004-bundy/prepare_materials_004.py、地図は pipeline/make_maps.py）。
 * 判決文は、紙の上に文字を組み直した引用（prepare_materials_004.py の text）。出典の行にそう書く。
 *
 * 2026-11-28：声はまだ作らない（ユーザーの指示）。仮の尺（build/timeline.json）で、BGM と効果音だけを鳴らす
 * （episodes/004-bundy/stage_draft.py が準備する）。まだ取れていない素材は「素材待ち」の画面にする。
 * イメージ映像は remotion/src/inserts/Scenes004.tsx と、002・003 の場面の新しい角度。
 */
import React, { useMemo } from "react";
import { AbsoluteFill, Audio, Easing, getStaticFiles, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import current from "../data/current.json";
import { InsertDuration } from "../inserts/Inserts";
import { INSERT_SCENES } from "../inserts/registry";
import { FONT } from "../lib/font";
import { H, W } from "../lib/geo";
import { C, CardShot, CardV, DocMeta, FilmFrame, MapShot, PaperShot, Reveal } from "../lib/shots";
import { Seg, segs, TL } from "../lib/timeline";
import SIZES from "./ep004-assets.json";

const DIR = "004";
const XF = 12; // カットの切り替え（クロスフェード）
const LEAD = 8; // ナレーションより少し先に画面を変える

const FBI = "出典：FBI（情報公開法による公開）";
const FBI_WEB = "出典：FBI";
const FM = "出典：State Archives of Florida, Florida Memory";
const FLA = "出典：フロリダ州最高裁の判決（文字を組み直した引用）";
const FED = "出典：連邦裁判所の判決（文字を組み直した引用）";
const UTAH = "出典：ユタ州最高裁の判決（文字を組み直した引用）";

/** 画面に出す素材の見出しと出典（台帳 materials.yaml の id ごと）。縦横比は ep004-assets.json（prepare_materials_004.py が書く） */
const META: Record<string, DocMeta> = {
  // FBI の文書（The Black Vault の写しの中の、FBI の職員が書いたページ）
  fbi_bv_p28: { title: "FBIデンバー支局の電報（1977年6月11日）", source: FBI },
  fbi_bv_p29: { title: "FBIデンバー支局の電報（1977年6月11日）", source: FBI },
  fbi_bv_p30: { title: "FBIデンバー支局の電報（1977年6月11日）：本人の特徴", source: FBI },
  fbi_bv_p40: { title: "FBIデンバー支局からソルトレイクシティ支局へ（1977年6月11日）", source: FBI },
  fbi_bv_p92: { title: "FBIソルトレイクシティ支局からデンバー支局へ（1978年1月）", source: FBI },
  fbi_foia_web: { title: "FBIの情報公開のページ（2009年の保存）", source: "出典：FBI（北テキサス大学のウェブ保存）" },
  // 写真
  fbi_top_ten_360: { title: "FBIの10大重要指名手配 360番", source: FBI_WEB },
  fm_n035655: { title: "レオン郡の裁判所を出る本人（1979年）", source: FM },
  fm_144978: { title: "本人（1980年2月13日撮影）", source: FM },
  // 判決文（文字を組み直した引用）
  ct_fla455_counts: { title: "フロリダ州最高裁の判決（1984年6月21日）", source: FLA },
  ct_fla455_facts: { title: "フロリダ州最高裁の判決（1984年6月21日）", source: FLA },
  ct_fla455_evidence: { title: "フロリダ州最高裁の判決（1984年6月21日）", source: FLA },
  ct_fla471_arrest: { title: "フロリダ州最高裁の判決（1985年）", source: FLA },
  ct_fla538: { title: "フロリダ州最高裁の決定（1989年1月20日）", source: FLA },
  ct_ca11_1988: { title: "連邦控訴裁の判決（1988年7月7日）", source: FED },
  ct_fsupp_edu: { title: "連邦地裁の決定（1987年12月22日）", source: FED },
  ct_fsupp_law: { title: "連邦地裁の決定（1987年12月22日）", source: FED },
  ct_fsupp_self: { title: "連邦地裁の決定（1987年12月22日）", source: FED },
  ct_fsupp_boone: { title: "連邦地裁の決定（1987年12月22日）", source: FED },
  ct_fsupp_people: { title: "連邦地裁の決定（1987年12月22日）", source: FED },
  ct_utah_approach: { title: "ユタ州最高裁の判決（1978年12月28日）", source: UTAH },
  ct_utah_car: { title: "ユタ州最高裁の判決（1978年12月28日）", source: UTAH },
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
      if (!m) throw new Error(`素材 ${v.src} の見出しがありません（ep004-bundy.tsx の META）`);
      if (!size) return <Pending what={v.kind === "photo" ? "写真" : "資料"} id={v.src} note={v.note} />;
      const meta = v.kind === "photo" && v.label ? { ...m, title: v.label } : m;
      return <PaperShot src={`${DIR}/${name}.jpg`} meta={meta} photo={v.kind === "photo"} aspect={size[0] / size[1]} ja={v.ja} />;
    }
    case "map":
      return <MapShot file={`${DIR}/map_${v.view}.json`} points={v.points ?? []} route={v.route} reveal={reveal} hl={v.hl} labels={v.labels} />;
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
  if (cur.episode !== "004-bundy") return null;
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

export const Ep004: React.FC = () => {
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
