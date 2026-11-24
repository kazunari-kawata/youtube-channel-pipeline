"""区間に分けて書き出し、最後につなぐ（止まっても続きから再開できる）

  python pipeline/render_chunks.py 002-dahmer                 # 1回の実行で最大9分ぶん書き出す。残りがあれば終了コード3
  python pipeline/render_chunks.py 002-dahmer --budget 60     # 60分まで
  python pipeline/render_chunks.py 002-dahmer --scale 1.5     # 本番の解像度（1920x1080）

区間は build/chunks/ に置く。台本・動画の定義・素材が変わったら（指紋が変わったら）区間を作り直す。
全区間がそろったら build/video.mp4（仮の尺なら build/video_draft.mp4）につなぐ。
クラウド（CPU）では遅いので、夜間の仮編集などに使う。本番は Windows の GPU で render.py を使ってもよい。
"""
import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from common import ROOT, build_dir, ffmpeg_bin, load_config  # noqa: E402

REMOTION = ROOT / "remotion"


def fingerprint(ep: str, scale: float) -> str:
    h = hashlib.sha1(f"{ep} {scale}".encode())
    for f in sorted((REMOTION / "src").rglob("*")):
        if f.is_file():
            h.update(str(f.relative_to(REMOTION)).encode())
            h.update(f.read_bytes())
    pub = REMOTION / "public" / ep.split("-")[0]
    for f in sorted(pub.glob("*")) if pub.exists() else []:
        h.update(f"{f.name}:{f.stat().st_size}".encode())
    return h.hexdigest()[:16]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episode")
    ap.add_argument("--budget", type=float, default=9.0, help="この実行で使う時間の上限（分）")
    ap.add_argument("--chunk", type=float, default=20.0, help="区間の長さ（秒）")
    ap.add_argument("--scale", type=float, default=1.0)
    a = ap.parse_args()
    cfg = load_config(a.episode)
    cur = json.loads((REMOTION / "src" / "data" / "current.json").read_text(encoding="utf-8"))
    if cur["episode"] != a.episode:
        sys.exit(f"いま準備されているのは {cur['episode']} です。先に stage.py {a.episode}（仮編集なら --draft）を実行してください。")
    tl = json.loads((REMOTION / "src" / "data" / "timeline.json").read_text(encoding="utf-8"))

    chunks = build_dir(a.episode) / "chunks"
    fp = fingerprint(a.episode, a.scale)
    fpf = chunks / "fingerprint.txt"
    if chunks.exists() and (not fpf.exists() or fpf.read_text().strip() != fp):
        print("台本・動画の定義・素材が前回の書き出しと違うので、区間を作り直します")
        shutil.rmtree(chunks)
    chunks.mkdir(parents=True, exist_ok=True)
    fpf.write_text(fp)

    gl = cfg["render"]["gl_linux"] if sys.platform.startswith("linux") else cfg["render"]["gl_windows"] if os.name == "nt" else cfg["render"]["gl_mac"]
    r = subprocess.run(["node", "render_chunks.mjs", str(chunks), str(a.chunk), str(a.budget), str(a.scale)],
                       cwd=REMOTION, env={**os.environ, "REMOTION_GL": gl})
    if r.returncode == 3:
        plan = json.loads((chunks / "plan.json").read_text())
        have = len(list(chunks.glob("c*.mp4"))) - len(list(chunks.glob("c*.part.mp4")))
        print(f"まだ残りがあります（{have}/{plan['n']}区間）。同じコマンドをもう一度実行すると続きから書き出します。")
        sys.exit(3)
    if r.returncode != 0:
        sys.exit("書き出しで止まりました。上の表示を見てください。")

    parts = sorted(p for p in chunks.glob("c*.mp4") if not p.name.endswith(".part.mp4"))
    lst = chunks / "list.txt"
    lst.write_text("".join(f"file '{p.name}'\n" for p in parts))
    out = build_dir(a.episode) / ("video_draft.mp4" if tl.get("estimated") else "video.mp4")
    subprocess.run([ffmpeg_bin(), "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(out)], check=True)
    print(f"完成：{out}（{len(parts)}区間をつないだ）")


if __name__ == "__main__":
    main()
