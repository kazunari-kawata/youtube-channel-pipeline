"""Remotion で動画を書き出す（先に stage.py を実行しておく）

  python pipeline/render.py 001-plains                 # 本番 → episodes/<id>/build/video.mp4
  python pipeline/render.py 001-plains --frames 0-239  # 一部だけ（確認用）→ build/preview.mp4
  python pipeline/render.py 001-plains --stills 0,900  # 静止画（確認用）→ build/stills/

GPU：Windows/Mac は ANGLE（GPU）、Linux クラウドは SwANGLE（CPU）を自動で選ぶ。
"""
import argparse
import json
import os
import platform
import shutil
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from common import REMOTION, SRC_DATA, build_dir, load_config  # noqa: E402


def npx() -> str:
    p = shutil.which("npx")
    if not p:
        sys.exit("npx が見つかりません。Node.js（LTS）を入れてください。")
    return p


def gl_for(cfg) -> str:
    s = platform.system()
    r = cfg["render"]
    return r["gl_windows"] if s == "Windows" else r["gl_mac"] if s == "Darwin" else r["gl_linux"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episode")
    ap.add_argument("--frames", help="例 0-239")
    ap.add_argument("--stills", help="例 0,900,1800")
    ap.add_argument("--scale", type=float)
    ap.add_argument("--concurrency")
    args = ap.parse_args()

    cur = json.loads((SRC_DATA / "current.json").read_text(encoding="utf-8")) if (SRC_DATA / "current.json").exists() else {}
    if cur.get("episode") != args.episode:
        sys.exit(f"Remotion に配られているのは {cur.get('episode')} です。先に python pipeline/stage.py {args.episode} を実行してください。")
    cfg = load_config(args.episode)
    out = build_dir(args.episode)
    scale = args.scale or cfg["video"]["render_scale"]
    env = {**os.environ, "REMOTION_GL": gl_for(cfg)}
    if not (REMOTION / "node_modules").exists():
        subprocess.run([shutil.which("npm") or "npm", "ci"], cwd=REMOTION, check=True)

    if args.stills:
        d = out / "stills"
        d.mkdir(exist_ok=True)
        subprocess.run(["node", "stills.mjs", str(d), args.stills, str(scale)], cwd=REMOTION, env=env, check=True)
        return

    target = out / ("preview.mp4" if args.frames else "video.mp4")
    cmd = [npx(), "remotion", "render", "src/index.ts", "Main", str(target),
           f"--gl={gl_for(cfg)}", f"--scale={scale}", f"--jpeg-quality={cfg['render']['jpeg_quality']}",
           f"--crf={cfg['render']['crf']}"]
    if args.frames:
        cmd.append(f"--frames={args.frames}")
    if args.concurrency:
        cmd.append(f"--concurrency={args.concurrency}")
    t0 = time.time()
    subprocess.run(cmd, cwd=REMOTION, env=env, check=True)
    print(f"書き出し完了: {target}（{(time.time() - t0) / 60:.1f}分）")


if __name__ == "__main__":
    main()
