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
区間に "reveal": N を書くと、年表の項目・地図の点の N 番目以降をその区間の頭（"reveal_at": 0〜1 で区間の途中）で出し、印の音（pin）を付ける
区間に "cut": {"at": 0〜1, "visual": {...}} を書くと、区間の途中で次のカットに替える（声を作り直さずに長い絵を分ける。"sfx" も書ける）
  1つの区間で2回以上替えるときは、"cut": [{"at": 0.3, "visual": ...}, {"at": 0.65, "visual": ...}] のようにリストで書く
間隔・強さの基準は config/channel.yaml の sfx。結果は shotlist.md の「効果音」と build/sfx_cues.json。

尺は build/timeline.json（本番の声 or estimate_timeline.py の見積もり）から取る。
守ること（CLAUDE.md）：イメージ映像は1回10秒まで・同じ場面を続けない、静止画は長く止めすぎない、文字カードは約4秒まで、
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


def seg_at(s: dict, frac: float) -> float:
    """区間の中の位置（0〜1）を秒に直す"""
    return s["start"] + frac * (s["end"] - s["start"])


def shots_of(segs: list[dict]) -> list[dict]:
    """区間をカットにまとめる。"same" は前のカットの続き、"cut": {at, visual} は区間の途中で次のカットを始める"""
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
            shots.append({"v": v, "segs": [s], "start": s["start"]})
        cuts, ra = cuts_of(s), s.get("reveal_at", 0)
        rev = s.get("reveal") is not None
        # 後出し（reveal）は、その時刻に映っているカットに付く
        if rev and (not cuts or ra < cuts[0]["at"]):
            shots[-1].setdefault("reveals", []).append(seg_at(s, ra))
        for k, c in enumerate(cuts):
            shots.append({"v": c["visual"], "segs": [s], "start": seg_at(s, c["at"]), "mid": True, "cut": c})
            nxt_at = cuts[k + 1]["at"] if k + 1 < len(cuts) else 2.0
            if rev and c["at"] <= ra < nxt_at:
                shots[-1].setdefault("reveals", []).append(seg_at(s, ra))
    for i, sh in enumerate(shots):
        sh["id"] = f"K{i + 1:02d}"
        nxt = shots[i + 1]["start"] if i + 1 < len(shots) else sh["segs"][-1]["end"]
        sh["end"] = nxt
        sh["dur"] = round(nxt - sh["start"], 1)
        # 動きのない時間（カットの頭と後出しの間の最長）
        marks = [sh["start"]] + sorted(sh.get("reveals", [])) + [nxt]
        sh["still"] = round(max(b - a for a, b in zip(marks, marks[1:])), 1)
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


def cuts_of(s: dict) -> list[dict]:
    """区間の途中で画面を替える指定（"cut"）を、時刻の順のリストにする（1つなら dict、2つ以上ならリストで書ける）"""
    c = s.get("cut")
    if not c:
        return []
    return sorted(c if isinstance(c, list) else [c], key=lambda x: x["at"])


def own_sfx(sh: dict):
    """カットに指定した効果音（区間の途中で始まるカットは cut の sfx、それ以外は最初の区間の sfx）"""
    if sh.get("mid"):
        return parse_sfx(sh["cut"].get("sfx"))
    return parse_sfx(sh["segs"][0].get("sfx"))


def plan_sfx(shots: list[dict], lib: dict, scfg: dict, speech_end: float):
    """カットごとの効果音を決め、近すぎる音を落とし、間隔を集計する"""
    raw = []
    for sh in shots:
        own = own_sfx(sh)
        base = own if own is not None else lib["rules"].get(rule_key(sh["v"]), [])
        for c in base:
            raw.append({"t": sh["start"] + c["at"], "key": c["key"], "shot": sh["id"], "shot_end": sh["end"]})
        for s in sh["segs"][1:]:
            for c in parse_sfx(s.get("sfx")) or []:
                raw.append({"t": s["start"] + c["at"], "key": c["key"], "shot": sh["id"]})
        for r in sh.get("reveals", []):
            if r > sh["start"] + 0.3:  # 後から項目・点を出す（reveal）ときは印の音
                raw.append({"t": r + 0.15, "key": "pin", "shot": sh["id"]})
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
        if c["level"] == "bed":  # 環境音はカットの終わりまで流す（Remotion でフェードイン・アウト）
            c["dur"] = round(max(0.5, c.get("shot_end", c["t"] + 4) - c["t"]), 2)
        c.pop("shot_end", None)
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


def material_key(v: dict) -> str | None:
    """同じ見た目かどうかの鍵。写真・資料・航空写真は素材の名前、地図は見せ方と点、イメージ映像は場面と種類"""
    k = v.get("kind")
    if k in ("doc", "photo", "aerial"):
        return f"{k}:{v['src']}"
    if k == "map":
        return f"map:{v.get('view')}:{','.join(v.get('points', []))}"
    if k == "insert":
        return f"insert:{v.get('scene')}.{v.get('var', '')}"
    return None


def year_warnings(shots: list[dict]) -> list[str]:
    """文字カードの年と、カードと同時に読むナレーションの年が食い違っていないか（F-025）。
    カードに「1988〜1990」のような期間があるのに、ナレーションが期間の外の年（1991年など）から始まると、時間が飛んだように見える"""
    out = []
    for sh in shots:
        v = sh["v"]
        if v.get("kind") != "card":
            continue
        cyears = [int(y) for y in re.findall(r"(1[89]\d\d|20\d\d)", f"{v.get('text', '')} {v.get('sub', '')}")]
        if not cyears:
            continue
        lo, hi = min(cyears), max(cyears)
        nyears = [int(y) for y in re.findall(r"(1[89]\d\d|20\d\d)年", sh["segs"][0]["caption"])]
        bad = [y for y in nyears if not lo <= y <= hi]
        if bad:
            out.append(f"{sh['id']}：カードの年（{lo}〜{hi}）と、同時に読むナレーションの年（{'、'.join(map(str, bad))}年）が食い違っている")
    return out


def reuse_warnings(shots: list[dict], cfg: dict) -> list[str]:
    """素材の使い回し（F-021）と、本人の姿が出るまでの時間（F-022）"""
    r = cfg.get("shots", {})
    mat_max, ins_max, first = r.get("material_max", 2), r.get("insert_variant_max", 3), r.get("person_first_sec", 30)
    uses: dict[str, list[str]] = {}
    for sh in shots:
        k = material_key(sh["v"])
        if k:
            uses.setdefault(k, []).append(f"{sh['id']}（{int(sh['start'] // 60)}:{sh['start'] % 60:04.1f}）")
    out = []
    for k, u in uses.items():
        lim = ins_max if k.startswith("insert:") else mat_max
        if len(u) > lim:
            out.append(f"同じ素材 {k} を {len(u)}回使っている（{lim}回まで）：{'、'.join(u)}")
    # 2回目からは、ナレーションがその素材の中身を指す理由（visual.reuse）を書く。空いた時間を埋めるためだけの使い回しは不可（F-029）。
    # イメージ映像も同じ角度（同じ var）なら同じ。別の角度（別の var）は別の素材として数える
    if r.get("reuse_needs_reason", True):
        seen: set[str] = set()
        for sh in shots:
            k = material_key(sh["v"])
            if not k:
                continue
            if k in seen and not str(sh["v"].get("reuse", "")).strip():
                out.append(f"{sh['id']}：{k} の2回目以降に理由がない（ナレーションが中身を指すなら visual.reuse に理由を書く。埋めるためだけなら、別の角度・新しい切り出し・次の絵の前倒しにする。F-029）")
            seen.add(k)
    people = set(cfg.get("person_photos", []))
    if people:
        t = next((sh["start"] for sh in shots if sh["v"].get("src") in people), None)
        if t is None or t > first:
            out.append(f"本人の姿（{'、'.join(sorted(people))}）が最初に出るのが {('なし' if t is None else f'{t:.1f}秒')}（{first}秒以内に出す）")
    return out


def load_shots(episode: str) -> tuple[dict, list[dict]]:
    """timeline.json の時刻に台本の画面指定を重ねて、カットの列にする（qa/check_video.py からも使う）"""
    tl = json.loads((build_dir(episode) / "timeline.json").read_text(encoding="utf-8"))
    # 画面の指定は台本（narration.json）が正本。時刻だけ timeline.json から取る
    narr = {s["id"]: s for s in load_narration(episode)}
    ids = [s["id"] for s in tl["segments"]]
    if ids != list(narr):
        sys.exit("timeline.json と narration.json の区間が違います。estimate_timeline.py（または tts_elevenlabs.py）を先に実行してください。")
    # 画面・効果音・後出しの指定は台本が正本（timeline.json は時刻だけ使う）
    segs = [{**{k: v for k, v in s.items() if k not in ("sfx", "reveal", "reveal_at", "cut")}, "visual": narr[s["id"]].get("visual"),
             "caption": narr[s["id"]]["caption"],
             **{k: narr[s["id"]][k] for k in ("sfx", "reveal", "reveal_at", "cut") if k in narr[s["id"]]}} for s in tl["segments"]]
    return tl, shots_of(segs)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episode")
    a = ap.parse_args()
    tl, shots = load_shots(a.episode)

    warn = []
    for i, sh in enumerate(shots):
        v = sh["v"]
        if v["kind"] == "insert":
            if sh["dur"] > INSERT_MAX:
                warn.append(f"{sh['id']}：イメージ映像が {sh['dur']}秒（{INSERT_MAX:.0f}秒まで）")
            if i > 0 and shots[i - 1]["v"]["kind"] == "insert" and shots[i - 1]["v"]["scene"] == v["scene"]:
                warn.append(f"{sh['id']}：同じイメージ映像（{v['scene']}）が続いている")
        elif v["kind"] in ("doc", "photo", "card") and sh["still"] > STILL_MAX:
            warn.append(f"{sh['id']}：静止画が {sh['still']}秒動かない（{STILL_MAX:.0f}秒を超えたら分けるか動きを足す）")

    total = tl["totalSeconds"]
    cfg = load_config(a.episode)
    scfg = cfg["sfx"]
    # 文字カードは約4秒まで（F-023。長く見せると、その間に離脱されやすい）
    card_max = cfg.get("shots", {}).get("card_max_sec", 5.0)
    for sh in shots:
        # 遺族の言葉のように、途中で絵を替えないと決めたカードは visual.keep に理由を書く
        if sh["v"]["kind"] == "card" and sh["dur"] > card_max and not str(sh["v"].get("keep", "")).strip():
            warn.append(f"{sh['id']}：文字カードが {sh['dur']}秒（約4秒まで。{card_max:g}秒を超えたら区間の途中で cut して資料・地図・イメージ映像に替える。F-023）")
    # 資料（日本語の説明つき）は、読み切れる長さだけ出す（F-044：003 で服装の段落が約5秒、直前のネクタイの写真が約11秒と偏っていた）
    doc_min = cfg.get("shots", {}).get("doc_min_sec", 5.0)
    for sh in shots:
        if sh["v"]["kind"] == "doc" and sh["dur"] < doc_min:  # 資料にはどれも説明が付く（F-020。回の定義の JA も）
            warn.append(f"{sh['id']}：説明つきの資料が {sh['dur']}秒しか出ない（{doc_min:g}秒より短いと読み切れない。前後の絵と長さをそろえる。F-044）")
    # 絵が短い間隔で続けて替わると、せわしない（F-034：文字カードを約4秒で切ったあと、3秒台のイメージ映像とカードを交互に続けた）。
    # 続くカードは1枚にまとめるか、イメージ映像を区間をまたいで長めに出す（次の区間は same）
    run_n, run_sec = cfg.get("shots", {}).get("busy_run", 5), cfg.get("shots", {}).get("busy_sec", 5.0)
    run: list[dict] = []
    for sh in shots + [{"dur": 1e9, "id": "", "start": 0}]:
        if sh["dur"] < run_sec:
            run.append(sh)
            continue
        if len(run) >= run_n:
            warn.append(f"{run[0]['id']}〜{run[-1]['id']}（{int(run[0]['start'] // 60)}:{run[0]['start'] % 60:04.1f}から）：{run_sec:g}秒未満の絵が {len(run)}回続く（せわしない。カードをまとめるか、イメージ映像を区間をまたいで長めに出す。F-034）")
        run = []
    warn += reuse_warnings(shots, cfg)
    warn += year_warnings(shots)
    lib = load_sfx()
    cues, dropped, gaps = plan_sfx(shots, lib, scfg, shots[-1]["segs"][-1]["end"])
    for sh in shots:
        sh["sfx"] = [c for c in cues if c["shot"] == sh["id"]]
    n_cue = len(cues)
    avg = total / n_cue if n_cue else total
    hits = sum(1 for c in cues if c["level"] == "hit")
    hit_rate = hits / (total / 60)
    lo, hi = scfg["target_interval_sec"]
    # わざと音を付けないカット（遺族の言葉など、rules が [] か sfx: none）にかかる空白は注意に出さない
    quiet = [(sh["start"], sh["end"]) for sh in shots
             if own_sfx(sh) == [] or (own_sfx(sh) is None and lib["rules"].get(rule_key(sh["v"])) == [])]
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
        # 環境音（bed）は続いてよい（同じ街の音が続くのは自然）。慣れで効かなくなるのは鳴らす音
        if x["file"] == y["file"] and y["level"] != "bed" and scfg.get("same_in_row_max", 1) <= 1:
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
