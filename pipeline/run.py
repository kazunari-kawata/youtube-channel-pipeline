"""1話分を通しで作る：ナレーション → 読み間違いチェック → 準備 → 書き出し → QA

  python pipeline/run.py 001-plains                  # 全部
  python pipeline/run.py 001-plains --from stage     # 途中から（例：台本は変えずに映像だけ直した）
  python pipeline/run.py 001-plains --only qa        # 1つだけ

どこかで失敗したら、そこで止まる（読み間違いやQA不合格のまま先へ進まない）。
"""
import argparse
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent
STEPS = {
    "tts": [HERE / "tts_elevenlabs.py"],
    "asr": [HERE / "asr_check.py"],
    "stage": [HERE / "stage.py"],
    "render": [HERE / "render.py"],
    "qa": [ROOT / "qa" / "check_video.py"],
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episode")
    ap.add_argument("--from", dest="start", choices=STEPS)
    ap.add_argument("--only", choices=STEPS)
    a = ap.parse_args()
    names = list(STEPS)
    if a.only:
        names = [a.only]
    elif a.start:
        names = names[names.index(a.start):]
    for n in names:
        print(f"\n=== {n} ===", flush=True)
        r = subprocess.run([sys.executable, str(STEPS[n][0]), a.episode])
        if r.returncode != 0:
            sys.exit(f"{n} で止まりました。上の表示を見て直してから、--from {n} で再開してください。")
    print("\n完了。build/video.mp4 を確認してください。")


if __name__ == "__main__":
    main()
