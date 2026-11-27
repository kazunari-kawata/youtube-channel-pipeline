"""006：イメージ映像の短い動画（remotion/scene_clips.mjs で書き出したもの）を、本編と同じ基準で検査する

  python episodes/006-alcatraz/check_scenes.py <動画のフォルダ>

検査すること
  チラつき：qa/check_video.py の scan_frames（明るさが上下に反転した画素のまとまり。基準は config/channel.yaml の qa）
  暗すぎ（F-052）：真ん中の1コマの上位10%の明るさが qa.dark_insert_p90 未満なら「静止画で何の場所か分からない」
"""
import subprocess
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "pipeline"))
sys.path.insert(0, str(ROOT / "qa"))
from common import ffmpeg_bin, load_config  # noqa: E402
from check_video import scan_frames  # noqa: E402


def middle_p90(video: Path, n: int) -> float:
    raw = subprocess.run([ffmpeg_bin(), "-v", "error", "-i", str(video), "-vf", f"select=eq(n\\,{n // 2}),scale=320:180,format=gray",
                          "-frames:v", "1", "-f", "rawvideo", "-"], capture_output=True, check=True).stdout
    return float(np.percentile(np.frombuffer(raw, np.uint8), 90))


def main() -> None:
    folder = Path(sys.argv[1])
    q = load_config("006-alcatraz")["qa"]
    bad = 0
    for v in sorted(folder.glob("*.mp4")):
        n, flicker, black = scan_frames(v, q)
        # 単体の確認用の動画は、最初と最後に黒からのフェードがある（本編の中では切ってある：Inserts.tsx の Stage）。その黒は数えない
        black = [b for b in black if 3 <= b < n - 3]
        # フェードの間（最初と最後の11コマ）の明滅も数えない。本編ではこの間は前後のカットとの切り替えになる（本編のQAで確かめる）
        flicker = [(i, c) for i, c in flicker if 11 <= i < n - 11]
        p90 = middle_p90(v, n)
        ok = len(flicker) <= q["flicker_max_frames"] and not black and p90 >= q["dark_insert_p90"]
        bad += not ok
        worst = max((c for _, c in flicker), default=0)
        print(f"{'OK ' if ok else 'NG '} {v.stem:22s} {n:4d}コマ  チラつき {len(flicker)}コマ（最大 {worst}画素）  真っ黒 {len(black)}  明るさp90 {p90:.0f}")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
