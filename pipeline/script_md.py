"""台本を読みやすい形にする：narration.json → episodes/<id>/script.md（章ごとに 時間・ナレーション・画面）

  python pipeline/script_md.py 002-dahmer [--mark s055,s055b]

正本は narration.json。この md は確認用なので手で直さない（直したら作り直す）。
時間は build/timeline.json（本番の声 or estimate_timeline.py の見積もり）から取る。
--mark に区間IDを渡すと、その行に「★」を付ける（直した箇所を見せるとき）。
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from common import build_dir, episode_dir, load_narration  # noqa: E402

KIND_JA = {"card": "文字", "doc": "資料", "photo": "写真", "aerial": "航空写真", "map": "地図", "insert": "イメージ映像"}


def screen(v) -> str:
    if v == "same":
        return "（前の画面の続き）"
    k = v.get("kind")
    if k == "card":
        s = f"文字「{v.get('text') or '・'.join(v.get('items', []))}」"
        if v.get("sub"):
            s += f"（{v['sub']}）"
    elif k == "insert":
        s = f"イメージ映像：{v.get('note') or v.get('scene')}"
    elif k == "aerial":
        s = f"航空写真：{v.get('label') or v.get('src')}"
    elif k == "map":
        s = f"地図：{v.get('note') or v.get('view')}"
    else:
        s = f"{KIND_JA.get(k, k)}：{v.get('note') or v.get('title') or v.get('src')}"
    if v.get("source"):
        s += f"　出典：{v['source']}"
    return s.replace("\n", " ").replace("|", "／")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episode")
    ap.add_argument("--mark", default="")
    a = ap.parse_args()
    mark = {x for x in a.mark.split(",") if x}
    segs = load_narration(a.episode)
    tl = json.loads((build_dir(a.episode) / "timeline.json").read_text(encoding="utf-8"))
    t = {s["id"]: s for s in tl["segments"]}
    total = tl["totalSeconds"]
    chars = sum(len(s["caption"]) for s in segs)
    L = [f"# 台本：{a.episode}", "",
         f"{len(segs)}区間、約{total / 60:.1f}分（{'文字数からの見積もり' if tl.get('estimated') else '本番の声の長さ'}）、{chars}字。",
         "正本は narration.json。この表は `python pipeline/script_md.py " + a.episode + "` で作り直す。"]
    if mark:
        L.append(f"★ は今回直した区間（{len(mark)}か所）。")
    head = None
    for s in segs:
        ch = s.get("chapter") or (head is None and "冒頭")
        if ch and ch != head:
            head = ch
            L += ["", f"## {ch}", "", "| 時間 | ナレーション | 画面 |", "| --- | --- | --- |"]
        st = t.get(s["id"], {}).get("start", 0)
        m, sec = divmod(int(st), 60)
        star = "★ " if s["id"] in mark else ""
        L.append(f"| {m}:{sec:02d} | {star}{s['caption']} | {screen(s.get('visual'))} |")
    out = episode_dir(a.episode) / "script.md"
    out.write_text("\n".join(L) + "\n", encoding="utf-8")
    print(f"台本 → {out}")


if __name__ == "__main__":
    main()
