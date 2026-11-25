"""香盤表：台本（narration.json）の各区間に何を映すか（visual）をまとめ、足りない素材を一覧にする

  python pipeline/shotlist.py 002-dahmer        → episodes/<id>/shotlist.md

narration.json の visual
  {"kind": "...", ...}   その区間から新しい画面（カット）を始める
  "same"                 前の区間の画面を続ける
kind
  card    文字カード（style: title / chapter / date / fact / span / question / netflix / chance / timeline / recount）
  doc     資料のページ（src は remotion/public/<ep>/ の画像名、focus で寄る場所）
  photo   写真（src は同上）
  aerial  航空写真（src は同上、label を地図の上に出す）
  map     実データの地図（view と points）
  insert  イメージ映像（scene は remotion/src/inserts/registry.ts の名前）

効果音（F-012）：画面の種類ごとの既定は config/sfx.yaml の rules。区間に sfx を書くと変えられる
  "sfx": "none"                         そのカットの既定の効果音を付けない
  "sfx": "paper"  / ["paper", "pin"]    既定の代わりにこの音（カットの始まりの区間）／この区間の始まりに足す（続きの区間）
  "sfx": [{"key": "pin", "at": 2.0}]    区間の始まりから 2.0 秒後に鳴らす
続きの区間（visual が "same"）に "reveal": N を書くと、年表の項目・地図の点の N 番目以降をその区間の頭で出し、印の音（pin）を付ける
間隔・強さの基準は config/channel.yaml の sfx。結果は shotlist.md の「効果音」と build/sfx_cues.json。

尺は build/timeline.json（本番の声 or estimate_timeline.py の見積もり）から取る。
守ること（CLAUDE.md）：イメージ映像は1回10秒まで・同じ場面を続けない、静止画は長く止めすぎない、
効果音は画面の動きに付け、間を空けすぎず詰めすぎない。
"""
import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import yaml  # noqa: E402

from common import ROOT, build_dir, episode_dir, load_config, load_narration, write_json  # noqa: E402

KIND_JA = {"card": "文字カード", "doc": "資料", "photo": "写真", "aerial": "航空写真", "map": "地図", "insert": "イメージ映像"}
INSERT_MAX = 10.0
STILL_MAX = 16.0


def shots_of(segs: list[dict]) -> list[dict]:
    shots = []
    for s in segs:
        v = s.get("visual")
        if v is None:
            sys.exit(f"{s['id']} に visual がありません（香盤表の欄を埋めてください）")
        if v == "same":
            if not shots:
                sys.exit(f"{s['id']}：最初の区間は same にできません")
            shots[-1]["segs"].append(s)
        else:
            shots.append({"v": v, "segs": [s]})
    for i, sh in enumerate(shots):
        sh["id"] = f"K{i + 1:02d}"
        sh["start"] = sh["segs"][0]["start"]
        nxt = shots[i + 1]["segs"][0]["start"] if i + 1 < len(shots) else sh["segs"][-1]["end"]
        sh["end"] = nxt
        sh["dur"] = round(nxt - sh["start"], 1)
    return shots


SFX_DIR = ROOT / "assets" / "sfx"
LEVEL_JA = {"bed": "下に流す", "light": "小", "mid": "中", "hit": "強"}
RANK = {"bed": 0, "light": 1, "mid": 2, "hit": 3}


def load_sfx() -> dict:
    lib = yaml.safe_load((ROOT / "config" / "sfx.yaml").read_text(encoding="utf-8"))
    words = [str(w).lower() for w in lib.get("forbidden", [])]
    names = [f"{k} {s.get('search', '')} {s.get('ja', '')}" for k, s in lib["sounds"].items()]
    names += [p.name for p in SFX_DIR.glob("*") if p.suffix.lower() in (".wav", ".mp3", ".flac", ".ogg")]
    for n in names:
        hit = [w for w in words if w in n.lower()]
        if hit:
            sys.exit(f"使わない音（{', '.join(hit)}）が効果音の台帳かファイルにあります：{n}")
    return lib


def rule_key(v: dict) -> str:
    if v["kind"] == "card":
        return f"card/{v.get('style', '')}"
    if v["kind"] == "insert":
        return f"insert/{v['scene']}"
    return v["kind"]


def parse_sfx(x, default_at=0.15):
    if x is None:
        return None
    if x == "none":
        return []
    items = [x] if isinstance(x, (str, dict)) else x
    return [{"key": e, "at": default_at} if isinstance(e, str) else {"key": e["key"], "at": float(e.get("at", default_at))}
            for e in items]


def plan_sfx(shots: list[dict], lib: dict, scfg: dict, speech_end: float):
    """カットごとの効果音を決め、近すぎる音を落とし、間隔を集計する"""
    raw = []
    for sh in shots:
        own = parse_sfx(sh["segs"][0].get("sfx"))
        base = own if own is not None else lib["rules"].get(rule_key(sh["v"]), [])
        for c in base:
            raw.append({"t": sh["start"] + c["at"], "key": c["key"], "shot": sh["id"]})
        for s in sh["segs"][1:]:
            add = parse_sfx(s.get("sfx"))
            if add is None and s.get("reveal") is not None:
                add = [{"key": "pin", "at": 0.15}]  # 続きの区間で項目・点を出す（reveal）ときは印の音
            for c in add or []:
                raw.append({"t": s["start"] + c["at"], "key": c["key"], "shot": sh["id"]})
    for c in raw:
        if c["key"] not in lib["sounds"]:
            sys.exit(f"{c['shot']}：効果音「{c['key']}」が config/sfx.yaml にありません")
        c["level"] = lib["sounds"][c["key"]]["level"]
    raw.sort(key=lambda c: c["t"])
    kept, dropped = [], []
    for c in raw:
        prev = next((k for k in reversed(kept) if k["level"] != "bed"), None)
        if c["level"] != "bed" and prev and c["t"] - prev["t"] < scfg["min_gap_sec"]:
            if RANK[c["level"]] > RANK[prev["level"]]:
                kept.remove(prev)
                dropped.append(prev)
            else:
                dropped.append(c)
                continue
        kept.append(c)
    count: dict[str, int] = {}
    for c in kept:
        s = lib["sounds"][c["key"]]
        n = count.get(c["key"], 0)
        count[c["key"]] = n + 1
        c["file"] = f"{c['key']}_{n % s.get('variants', 1) + 1}.wav"
        c["t"] = round(c["t"], 2)
        c["db_below_voice"] = scfg["db_below_voice"][c["level"]]
    # 空白は最後のナレーションの終わりまでで測る（そのあとの余韻はBGMだけで終える）
    times = [0.0] + [c["t"] for c in kept] + [max(speech_end, kept[-1]["t"] if kept else 0.0)]
    gaps = [(times[i], times[i + 1] - times[i]) for i in range(len(times) - 1)]
    return kept, dropped, gaps


def status(ep: str, v: dict) -> str:
    k = v["kind"]
    if k in ("doc", "photo", "aerial"):
        f = ROOT / "remotion" / "public" / ep.split("-")[0] / f"{v['src']}.jpg"
        return "あり" if f.exists() else "切り出し待ち"
    if k == "insert":
        reg = ROOT / "remotion" / "src" / "inserts" / "registry.ts"
        txt = reg.read_text(encoding="utf-8") if reg.exists() else ""
        return "あり" if re.search(rf'\b{re.escape(v["scene"])}\s*:', txt) else "作る"
    return "部品で描く"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episode")
    a = ap.parse_args()
    tl = json.loads((build_dir(a.episode) / "timeline.json").read_text(encoding="utf-8"))
    # 画面の指定は台本（narration.json）が正本。時刻だけ timeline.json から取る
    narr = {s["id"]: s for s in load_narration(a.episode)}
    ids = [s["id"] for s in tl["segments"]]
    if ids != list(narr):
        sys.exit("timeline.json と narration.json の区間が違います。estimate_timeline.py（または tts_elevenlabs.py）を先に実行してください。")
    # 画面・効果音・後出しの指定は台本が正本（timeline.json は時刻だけ使う）
    segs = [{**{k: v for k, v in s.items() if k not in ("sfx", "reveal")}, "visual": narr[s["id"]].get("visual"),
             "caption": narr[s["id"]]["caption"],
             **{k: narr[s["id"]][k] for k in ("sfx", "reveal") if k in narr[s["id"]]}} for s in tl["segments"]]
    shots = shots_of(segs)

    warn = []
    for i, sh in enumerate(shots):
        v = sh["v"]
        if v["kind"] == "insert":
            if sh["dur"] > INSERT_MAX:
                warn.append(f"{sh['id']}：イメージ映像が {sh['dur']}秒（{INSERT_MAX:.0f}秒まで）")
            if i > 0 and shots[i - 1]["v"]["kind"] == "insert" and shots[i - 1]["v"]["scene"] == v["scene"]:
                warn.append(f"{sh['id']}：同じイメージ映像（{v['scene']}）が続いている")
        elif v["kind"] in ("doc", "photo", "card") and sh["dur"] > STILL_MAX:
            warn.append(f"{sh['id']}：静止画が {sh['dur']}秒（{STILL_MAX:.0f}秒を超えたら分けるか動きを足す）")

    total = tl["totalSeconds"]
    cfg = load_config(a.episode)
    scfg = cfg["sfx"]
    lib = load_sfx()
    cues, dropped, gaps = plan_sfx(shots, lib, scfg, segs[-1]["end"])
    for sh in shots:
        sh["sfx"] = [c for c in cues if c["shot"] == sh["id"]]
    n_cue = len(cues)
    avg = total / n_cue if n_cue else total
    hits = sum(1 for c in cues if c["level"] == "hit")
    hit_rate = hits / (total / 60)
    lo, hi = scfg["target_interval_sec"]
    # わざと音を付けないカット（遺族の言葉など、rules が [] か sfx: none）にかかる空白は注意に出さない
    quiet = [(sh["start"], sh["end"]) for sh in shots
             if (parse_sfx(sh["segs"][0].get("sfx")) == []) or
             (sh["segs"][0].get("sfx") is None and lib["rules"].get(rule_key(sh["v"])) == [])]
    long_gaps = [(t0, g) for t0, g in gaps if g > scfg["max_gap_sec"]
                 and not any(q0 < t0 + g and t0 < q1 for q0, q1 in quiet)]
    if not lo <= avg <= hi:
        warn.append(f"効果音の平均の間隔が {avg:.1f}秒（目安 {lo}〜{hi}秒）")
    if hit_rate > scfg["hit_per_min_max"]:
        warn.append(f"強い効果音が1分に {hit_rate:.1f}回（{scfg['hit_per_min_max']}回まで）")
    for t0, g in long_gaps:
        m0, s0 = divmod(t0, 60)
        warn.append(f"効果音のない時間が {g:.1f}秒（{int(m0)}:{s0:04.1f}から。{scfg['max_gap_sec']}秒まで）")
    for x, y in zip(cues, cues[1:]):
        if x["file"] == y["file"] and scfg.get("same_in_row_max", 1) <= 1:
            warn.append(f"{y['shot']}：同じ効果音のファイル（{y['file']}）が続いている")
    missing = sorted({c["file"] for c in cues if not (SFX_DIR / c["file"]).exists()})
    write_json(build_dir(a.episode) / "sfx_cues.json",
               {"cues": cues, "dropped": dropped, "avg_interval": round(avg, 2), "hits_per_min": round(hit_rate, 2)})

    by_kind: dict[str, float] = {}
    for sh in shots:
        by_kind[sh["v"]["kind"]] = by_kind.get(sh["v"]["kind"], 0) + sh["dur"]

    L = [f"# 香盤表：{a.episode}", "",
         f"尺 {total / 60:.1f}分（{'台本の文字数から見積もった仮の尺' if tl.get('estimated') else '本番の声の長さ'}）、カット {len(shots)}、区間 {len(tl['segments'])}。",
         "`python pipeline/shotlist.py " + a.episode + "` で作り直す（台本の visual 欄が正本。この表は手で直さない）。", "",
         "## 画面の内訳", "", "| 種類 | 合計 | 割合 |", "| --- | --- | --- |"]
    for k, sec in sorted(by_kind.items(), key=lambda x: -x[1]):
        L.append(f"| {KIND_JA.get(k, k)} | {sec:.0f}秒 | {sec / total * 100:.0f}% |")
    L += ["", "## 香盤表", "", "| カット | 時間 | 秒 | 画面 | 素材・場面 | 見せ方 | 効果音 | 状態 | ナレーション（区間） |",
          "| --- | --- | --- | --- | --- | --- | --- | --- | --- |"]
    for sh in shots:
        v = sh["v"]
        what = v.get("src") or v.get("scene") or v.get("view") or v.get("style", "")
        if v["kind"] == "insert" and v.get("var"):
            what += f"（{v['var']}）"
        how = v.get("note") or v.get("text") or v.get("label") or ""
        narr = " / ".join(f"{s['id']} {s['caption'][:26]}…" for s in sh["segs"])
        m, sec = divmod(sh["start"], 60)
        se = "、".join(f"{lib['sounds'][c['key']]['ja'].split('（')[0]}（{LEVEL_JA[c['level']]}）" for c in sh["sfx"]) or "なし"
        L.append(f"| {sh['id']} | {int(m)}:{sec:04.1f} | {sh['dur']} | {KIND_JA.get(v['kind'], v['kind'])} | {what} | "
                 f"{how.replace(chr(10), ' ')} | {se} | {status(a.episode, v)} | {narr} |")
    todo = sorted({(KIND_JA[sh['v']['kind']], sh['v'].get('src') or sh['v'].get('scene'), status(a.episode, sh['v']))
                   for sh in shots if status(a.episode, sh['v']) not in ("あり", "部品で描く")})
    by_level: dict[str, int] = {}
    for c in cues:
        by_level[c["level"]] = by_level.get(c["level"], 0) + 1
    longest = max(gaps, key=lambda x: x[1])
    L += ["", "## 効果音", "",
          f"- {n_cue}回、平均 {avg:.1f}秒に1回（目安 {lo}〜{hi}秒）。"
          + "、".join(f"{LEVEL_JA[k]} {by_level.get(k, 0)}回" for k in ("hit", "mid", "light", "bed")),
          f"- 強い音は1分に {hit_rate:.1f}回（{scfg['hit_per_min_max']}回まで）。最長の空白は {longest[1]:.1f}秒"
          f"（{int(longest[0] // 60)}:{longest[0] % 60:04.1f}から）",
          f"- 近すぎて落とした音 {len(dropped)}回。音量は声より 強 {scfg['db_below_voice']['hit']}dB／中 {scfg['db_below_voice']['mid']}dB"
          f"／小 {scfg['db_below_voice']['light']}dB／環境音 {scfg['db_below_voice']['bed']}dB 小さく（耳で確かめて直す）",
          "- 一つずつの時刻とファイルは build/sfx_cues.json"]
    L += ["", "## 足りないもの", ""]
    L += [f"- {k}：{n}（{st}）" for k, n, st in todo]
    if missing:
        L.append(f"- 効果音のファイル {len(missing)}本（assets/sfx/。取得して LICENSES.md に記録する）：" + "、".join(missing))
    if not todo and not missing:
        L.append("- なし")
    L += ["", "## 注意（CLAUDE.md のルールに照らして）", ""]
    L += [f"- {w}" for w in warn] or ["- なし"]
    out = episode_dir(a.episode) / "shotlist.md"
    out.write_text("\n".join(L) + "\n", encoding="utf-8")
    print(f"香盤表：{len(shots)}カット → {out}")
    print(f"効果音 {n_cue}回（平均 {avg:.1f}秒に1回、強い音 {hit_rate:.1f}回/分、最長の空白 {max(g for _, g in gaps):.1f}秒）、未取得のファイル {len(missing)}本")
    print(f"足りないもの {len(todo)}件、注意 {len(warn)}件")
    for w in warn:
        print("  注意:", w)


if __name__ == "__main__":
    main()
