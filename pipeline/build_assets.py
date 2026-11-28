"""素材の取得から、画面に出すファイル（remotion/public/<番号>/）までを1回で作り直す

  python pipeline/build_assets.py 009-gardner
  python pipeline/build_assets.py 009-gardner --skip-fetch   # 取得は済んでいる（切り出しと地図だけ）

remotion/public/ と build/ は Git に入らないので、クラウドの定期実行が作った画面用のファイルは Windows に届かない。
どの PC でも同じものを作れるように、手順をここにまとめる（Windows の automation/windows/draft_review.ps1 も呼ぶ）。

既定の手順（ファイルがあるものだけ）
  1. fetch_materials.py <回>                台帳の素材を build/materials/ に取る（取れないものは飛ばして進む）
  2. episodes/<回>/prepare_materials.py    回だけの前処理（PDF のページ画像など）
  3. cut_materials.py <回>                  cuts.yaml の切り出し・黒塗り
  4. make_maps.py <回>                      maps.yaml の地図（Natural Earth が無ければ fetch_data.py --light）
episode.yaml に assets_steps（コマンドの並び）を書くと、既定の代わりにそれを順に実行する。
  例：assets_steps: ["fetch", "episodes/003-db-cooper/prepare_materials.py", "cut", "maps",
                     "episodes/003-db-cooper/prepare_materials.py --assets"]
"""
import argparse
import shlex
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from common import DATA_RAW, ROOT, episode_dir, load_config  # noqa: E402

BUILTIN = {
    "fetch": ["pipeline/fetch_materials.py"],
    "cut": ["pipeline/cut_materials.py"],
    "maps": ["pipeline/make_maps.py"],
}


def default_steps(ep: str) -> list[str]:
    d = episode_dir(ep)
    steps = ["fetch"]
    if (d / "prepare_materials.py").exists():
        steps.append(f"episodes/{ep}/prepare_materials.py")
    if (d / "cuts.yaml").exists():
        steps.append("cut")
    if (d / "maps.yaml").exists():
        steps.append("maps")
    return steps


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("episode")
    ap.add_argument("--skip-fetch", action="store_true")
    a = ap.parse_args()
    cfg = load_config(a.episode)
    steps = cfg.get("assets_steps") or default_steps(a.episode)
    failed = []
    for step in steps:
        if step == "fetch" and a.skip_fetch:
            continue
        if step == "maps" and not (DATA_RAW / "ne" / "ne_10m_land.shp").exists():
            subprocess.run([sys.executable, "pipeline/fetch_data.py", "--light"], cwd=ROOT, check=True)
        cmd = [sys.executable, *BUILTIN[step], a.episode] if step in BUILTIN else [sys.executable, *shlex.split(step)]
        print(f"▶ {' '.join(cmd[1:])}", flush=True)
        r = subprocess.run(cmd, cwd=ROOT)
        if r.returncode != 0:
            # 取得は届かない取得元（fbi.gov など）があっても先へ進む。切り出し・地図の失敗は止める
            if step == "fetch":
                failed.append(step)
                print("  取得に失敗したものがあります（届かない取得元は手作業。automation/RUNNER.md）。続けます")
                continue
            sys.exit(f"失敗：{' '.join(cmd[1:])}（終了コード {r.returncode}）")
    print(f"画面用のファイルを作りました：remotion/public/{a.episode.split('-')[0]}/" + ("（取得に失敗あり）" if failed else ""))


if __name__ == "__main__":
    main()
