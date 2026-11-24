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

尺は build/timeline.json（本番の声 or estimate_timeline.py の見積もり）から取る。
守ること（CLAUDE.md）：イメージ映像は1回10秒まで・同じ場面を続けない、静止画は長く止めすぎない。
"""
import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from common import ROOT, build_dir, episode_dir, load_narration  # noqa: E402

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
    segs = [{**s, "visual": narr[s["id"]].get("visual"), "caption": narr[s["id"]]["caption"]} for s in tl["segments"]]
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
    by_kind: dict[str, float] = {}
    for sh in shots:
        by_kind[sh["v"]["kind"]] = by_kind.get(sh["v"]["kind"], 0) + sh["dur"]

    L = [f"# 香盤表：{a.episode}", "",
         f"尺 {total / 60:.1f}分（{'台本の文字数から見積もった仮の尺' if tl.get('estimated') else '本番の声の長さ'}）、カット {len(shots)}、区間 {len(tl['segments'])}。",
         "`python pipeline/shotlist.py " + a.episode + "` で作り直す（台本の visual 欄が正本。この表は手で直さない）。", "",
         "## 画面の内訳", "", "| 種類 | 合計 | 割合 |", "| --- | --- | --- |"]
    for k, sec in sorted(by_kind.items(), key=lambda x: -x[1]):
        L.append(f"| {KIND_JA.get(k, k)} | {sec:.0f}秒 | {sec / total * 100:.0f}% |")
    L += ["", "## 香盤表", "", "| カット | 時間 | 秒 | 画面 | 素材・場面 | 見せ方 | 状態 | ナレーション（区間） |",
          "| --- | --- | --- | --- | --- | --- | --- | --- |"]
    for sh in shots:
        v = sh["v"]
        what = v.get("src") or v.get("scene") or v.get("view") or v.get("style", "")
        if v["kind"] == "insert" and v.get("var"):
            what += f"（{v['var']}）"
        how = v.get("note") or v.get("text") or v.get("label") or ""
        narr = " / ".join(f"{s['id']} {s['caption'][:26]}…" for s in sh["segs"])
        m, sec = divmod(sh["start"], 60)
        L.append(f"| {sh['id']} | {int(m)}:{sec:04.1f} | {sh['dur']} | {KIND_JA.get(v['kind'], v['kind'])} | {what} | "
                 f"{how.replace(chr(10), ' ')} | {status(a.episode, v)} | {narr} |")
    todo = sorted({(KIND_JA[sh['v']['kind']], sh['v'].get('src') or sh['v'].get('scene'), status(a.episode, sh['v']))
                   for sh in shots if status(a.episode, sh['v']) not in ("あり", "部品で描く")})
    L += ["", "## 足りないもの", ""]
    L += [f"- {k}：{n}（{st}）" for k, n, st in todo] or ["- なし"]
    L += ["", "## 注意（CLAUDE.md のルールに照らして）", ""]
    L += [f"- {w}" for w in warn] or ["- なし"]
    out = episode_dir(a.episode) / "shotlist.md"
    out.write_text("\n".join(L) + "\n", encoding="utf-8")
    print(f"香盤表：{len(shots)}カット → {out}")
    print(f"足りないもの {len(todo)}件、注意 {len(warn)}件")
    for w in warn:
        print("  注意:", w)


if __name__ == "__main__":
    main()
