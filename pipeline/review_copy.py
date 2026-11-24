"""確認用の動画を作る：書き出した動画に、ナレーションの字幕トラックを入れる（画面に焼き込まない、切り替え式。F-004 の範囲内）

  python pipeline/review_copy.py 002-dahmer      → build/review_<id>.mp4 と build/narration.srt

字幕は timeline.json の caption と時刻から作る。QuickTime や VLC では「字幕」メニューで表示を切り替えられる。
YouTube に上げる本番の動画には使わない（キャプションは YouTube 側で付ける）。
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from common import build_dir, ffmpeg_bin  # noqa: E402


def ts(t: float) -> str:
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episode")
    a = ap.parse_args()
    d = build_dir(a.episode)
    tl = json.loads((d / "timeline.json").read_text(encoding="utf-8"))
    srt = d / "narration.srt"
    srt.write_text("".join(f"{i + 1}\n{ts(s['start'])} --> {ts(s['end'])}\n{s['caption']}\n\n" for i, s in enumerate(tl["segments"])), encoding="utf-8")
    src = d / ("video_draft.mp4" if tl.get("estimated") else "video.mp4")
    out = d / f"review_{a.episode}.mp4"
    subprocess.run([ffmpeg_bin(), "-v", "error", "-y", "-i", str(src), "-i", str(srt), "-map", "0", "-map", "1", "-c", "copy", "-c:s", "mov_text",
                    "-metadata:s:s:0", "language=jpn", "-metadata:s:s:0", "title=ナレーション（仮）", str(out)], check=True)
    print(f"確認用：{out}（字幕 {len(tl['segments'])}件）／ 字幕ファイル：{srt}")


if __name__ == "__main__":
    main()
