/**
 * 002 ジェフリー・ダーマー事件「なぜ13年間、誰も止められなかったのか」
 * 構成案：episodes/002-dahmer/plan.md ／ 台本と香盤表：episodes/002-dahmer/narration.json（visual 欄）、shotlist.md
 *
 * カットの並びは台本の visual 欄から自動で作る（"same" は前のカットを続ける）。
 * 素材は remotion/public/002/（pipeline/cut_materials.py、make_maps.py で作る）。
 */
import React, { useMemo } from "react";
import { AbsoluteFill, Audio, Easing, getStaticFiles, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import current from "../data/current.json";
import { InsertDuration } from "../inserts/Inserts";
import { INSERT_SCENES } from "../inserts/registry";
import { AerialShot, CardShot, CardV, DocMeta, MapShot, PaperShot, Reveal } from "../lib/shots";
import { Seg, segs, TL } from "../lib/timeline";

const DIR = "002";
const XF = 12; // カットの切り替え（クロスフェード）
const LEAD = 8; // ナレーションより少し先に画面を変える

const MPD = "出典：ミルウォーキー警察の公開資料";
const FBI = "出典：FBI（情報公開法による公開）";
const COMMONS = "出典：Wikimedia Commons（著作権表示なしで公表）";

/** 画面に出す素材の見出し・出典・縦横比（cut_materials.py の出力に合わせる） */
const ASSETS: Record<string, DocMeta & { aspect: number }> = {
  mpd_p064: { title: "ミルウォーキー警察 補充報告書（1991年7月23日）", source: MPD, aspect: 1632 / 216 },
  mpd_p161: { title: "起訴状の記載：1989年1月30日の有罪判決（F-882515）", source: MPD, aspect: 1632 / 169 },
  mpd_p221: { title: "修正起訴状（1991年、事件番号 F-912542）", source: MPD, aspect: 1700 / 517 },
  mpd_p222: { title: "修正起訴状 第11訴因", source: MPD, aspect: 1700 / 227 },
  fbi1_cover: { title: "FBIファイル ミルウォーキー支局（7-MW-26057）", source: FBI, aspect: 1104 / 1430 },
  fbi6_lab: { title: "FBIファイル 研究所（95-HQ-209705）", source: FBI, aspect: 1086 / 1430 },
  booking_1991: { title: "1991年7月 逮捕時の写真", source: "出典：ミルウォーキー警察", aspect: 2420 / 1870 },
  apartment_a: { title: "213号室（警察の記録写真）", source: "出典：ミルウォーキー警察", aspect: 1903 / 1700 },
  yearbook_1978: { title: "1978年 リビア高校の卒業アルバム", source: COMMONS, aspect: 450 / 600 },
  yearbook_cartoon: { title: "1978年 卒業アルバムの漫画（同級生が描いたもの）", source: COMMONS, aspect: 1022 / 636 },
  army_1979: { title: "1979年 西ドイツ・バウムホルダー", source: COMMONS, aspect: 1000 / 686 },
};
const NAIP_DATE: Record<string, string> = { naip_oxford: "2022年6月", naip_columbia: "2022年8月" };

type Visual = { kind: string; [k: string]: any };
type Shot = { v: Visual; from: number; to: number; segs: Seg[]; reveal?: Reveal };

const buildShots = (): Shot[] => {
  const out: Shot[] = [];
  // 区間の中の位置（0〜1）をコマに直す
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
    // "cut": {at, visual} → 区間の途中で次の画面に替える（1枚の絵が長くなりすぎるとき。声はそのまま）
    // "reveal": N（"reveal_at": 区間の中の位置）→ 年表の項目・地図の点の N 番目以降をそこで出す（香盤表では印の音が付く）
    //   cut より後ろの位置の reveal は、cut で始まったカットに付く
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

const ShotView: React.FC<{ v: Visual; reveal?: Reveal }> = ({ v, reveal }) => {
  switch (v.kind) {
    case "card":
      return <CardShot v={v as unknown as CardV} reveal={reveal} />;
    case "doc":
    case "photo": {
      const m = ASSETS[v.src];
      if (!m) throw new Error(`素材 ${v.src} の見出しがありません（ep002-dahmer.tsx の ASSETS）`);
      return <PaperShot src={`${DIR}/${v.src}.jpg`} meta={m} photo={v.kind === "photo"} aspect={m.aspect} />;
    }
    case "aerial":
      return <AerialShot src={`${DIR}/${v.src}.jpg`} label={v.label} zoom={v.zoom ?? "in"} date={NAIP_DATE[v.src] ?? ""} />;
    case "map":
      return <MapShot file={`${DIR}/map_${v.view}.json`} points={v.points ?? []} route={v.route} reveal={reveal} />;
    case "insert": {
      const Scene = INSERT_SCENES[v.scene];
      if (!Scene) throw new Error(`イメージ映像 ${v.scene} がありません（inserts/registry.ts）`);
      return <Scene variant={v.var} />;
    }
    default:
      throw new Error(`知らない画面の種類 ${v.kind}`);
  }
};

/** カットの頭でフェードイン（前のカットの上に重ねる） */
const Fade: React.FC<{ children: React.ReactNode; first: boolean }> = ({ children, first }) => {
  const f = useCurrentFrame();
  // 始めと終わりをなめらかに（直線だと、フェードの最後の1コマで明るさが急に止まり、次のコマの動きと逆向きになってチラつきと判定される）
  const o = first ? 1 : interpolate(f, [0, XF], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
};

/** 効果音（stage.py が current.json の sfx に置く。香盤表の build/sfx_cues.json から）。
 *  単発の音はその時刻から鳴らしきる。環境音（bed）はカットの終わりまで、頭0.5秒・終わり0.7秒でフェード */
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

/** 声とBGMと効果音。仮の尺（estimated）のときや、まだ声のファイルがないときは入れない。
 *  BGM は stage.py の本番の準備（current.json の bgm: true）のときだけ。確認用（--draft）は声と効果音 */
const Sound: React.FC = () => {
  const files = getStaticFiles().map((f) => f.name);
  if ((TL as any).estimated || !files.includes("narration.wav")) return null;
  const withBgm = (current as any).bgm !== false && files.includes("bgm.wav");
  const { bgmSpeech, bgmGap, duckFrames } = (current as any).mix;
  const vol = (f: number) => {
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
      <Audio src={staticFile("narration.wav")} />
      {withBgm && <Audio src={staticFile("bgm.wav")} volume={vol} />}
      <Sfx />
    </>
  );
};

export const Ep002: React.FC = () => {
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
