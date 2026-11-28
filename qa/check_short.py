"""ショート動画の品質チェック（CLAUDE.md「ショート動画」、F-058）

  python qa/check_short.py 002-dahmer a [--video 書き出した.mp4]

本編の check_video.py と同じ基準（チラつき・真っ黒・音量・音のピーク）に、ショートの決まりを足す：
縦 1080x1920、60秒以内、1フレーム目がサムネイル（真っ黒でなく、サムネイルの間は止まっている）、
字幕は1回13字まで・サムネイルに重ねない・隠れない範囲、最後に本編への案内。
hook（0秒からの一言）で始めるショートは、止まったサムネイルの代わりに「最初の0.5秒で絵が動いている」「一言がある」を確かめる（F-059）。
絵の切り替えは1つ3秒まで（F-062）。
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np
import pyloudnorm as pyln

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "pipeline"))
from check_video import probe, scan_frames  # noqa: E402
from common import PUBLIC, build_dir, decode_audio, ffmpeg_bin, load_config  # noqa: E402

SR = 48000
CAP_MAX = 13
# Short.tsx の字幕と文字の置き場所（720x1280 の座標）。YouTube の表示に隠れない範囲（x 40〜620、y 193〜833）に入っているか
CAP_BOX = {"left": 330 - 280, "right": 330 + 280, "top": 787 - 34, "bottom": 787 + 40}
SAFE = {"left": 40, "right": 620, "top": 193, "bottom": 833}


def frame_gray(video: Path, idx: int, fps: float = 30.0) -> np.ndarray:
    out = subprocess.run([ffmpeg_bin(), "-v", "error", "-ss", f"{idx / fps:.4f}", "-i", str(video), "-frames:v", "1",
                          "-vf", "scale=180:320,format=gray", "-f", "rawvideo", "-"], check=True, capture_output=True).stdout
    return np.frombuffer(out, np.uint8).reshape(320, 180).astype(np.int16)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episode")
    ap.add_argument("name")
    ap.add_argument("--video")
    args = ap.parse_args()
    cfg = load_config(args.episode)
    q = cfg["qa"]
    sid = args.episode.split("-")[0] + args.name
    data = json.loads((PUBLIC / "shorts" / sid / "data.json").read_text(encoding="utf-8"))
    video = Path(args.video) if args.video else build_dir(args.episode) / f"short_{args.name}.mp4"
    if not video.exists():
        sys.exit(f"{video} がありません")
    res = []

    def add(name, ok, got, want, note=""):
        res.append(ok)
        print(f"[{'OK ' if ok else 'NG '}] {name}: {got}（基準 {want}）{' ' + note if note else ''}")

    info = probe(video)
    vs = next(s for s in info["streams"] if s["codec_type"] == "video")
    add("解像度", (vs["width"], vs["height"]) == (1080, 1920), f"{vs['width']}x{vs['height']}", "1080x1920")
    dur = float(info["format"]["duration"])
    add("長さ", dur <= 60.0 and abs(dur - data["durationInFrames"] / data["fps"]) < 0.2, f"{dur:.2f}秒", "60秒以内・台本どおり",
        "1分を超えると Content ID の申し立て1件で全世界で見られなくなる")
    n, flicker, black = scan_frames(video, q, size=(180, 320))
    worst = max((c for _, c in flicker), default=0)
    add("チラつき", len(flicker) <= q["flicker_max_frames"], f"{len(flicker)}フレーム（最大{worst}画素）", f"{q['flicker_max_frames']}フレーム",
        ("該当: " + ", ".join(str(i) for i, _ in flicker[:10])) if flicker else "")
    add("真っ黒なフレーム", len(black) == 0, f"{len(black)}フレーム", "0")
    tf = data["thumb"]["frames"]
    hook = data.get("hook")
    if tf > 0:
        # 1フレーム目＝サムネイル：真っ黒でなく、サムネイルの間は止まっている（フェードしない）
        f0, f1 = frame_gray(video, 0), frame_gray(video, tf - 2)
        diff = float(np.abs(f0 - f1).mean())
        add("1フレーム目がサムネイル", f0.max() > 120 and diff < 3.0, f"明るさの最大 {int(f0.max())}、{tf - 2}フレーム目との差 {diff:.1f}",
            "真っ黒でなく、サムネイルの間は動かない", "F-058")
        name = data["thumb"].get("name", "")
        add("サムネイルに名前", bool(name), name or "なし", "本人の名前", "F-058")
    else:
        # 0秒からの一言（F-059）：最初のフレームは真っ黒でなく、最初の0.5秒で絵が動いている（止まった絵で始めない）
        f0, f1 = frame_gray(video, 0), frame_gray(video, 15)
        diff = float(np.abs(f0 - f1).mean())
        add("最初の0.5秒で絵が動く", f0.max() > 120 and diff > 0.3, f"明るさの最大 {int(f0.max())}、15フレーム目との差 {diff:.2f}",
            "真っ黒でなく、動いている", "F-059")
        add("0秒からの一言", bool(hook and hook.get("lines")), " / ".join(hook["lines"]) if hook else "なし", "あり", "F-059")
    # 絵の切り替え：1つの絵は3秒まで（F-062。最初の飛行機の5.2秒で離脱すると指摘された。F-059 では6秒まで）
    lens = [(sh["to"] - sh["from"]) / data["fps"] for sh in data["shots"]]
    cap = data.get("max_shot_sec", 3.0)
    long_ = [f"{sh['from'] / data['fps']:.1f}秒から{(sh['to'] - sh['from']) / data['fps']:.1f}秒" for sh in data["shots"] if (sh["to"] - sh["from"]) / data["fps"] > cap + 1e-6]
    add("絵の切り替え", not long_, f"平均 {np.mean(lens):.1f}秒、最長 {max(lens):.1f}秒" + (f"（{'、'.join(long_[:4])}）" if long_ else ""), f"1つ{cap:g}秒まで", "F-062")
    # 字幕
    long_caps = [c["text"] for c in data["captions"] if len(re.sub(r"\s", "", c["text"])) > CAP_MAX]
    add("字幕は1回13字まで", not long_caps, "、".join(long_caps) or "すべて13字以内", f"{CAP_MAX}字")
    first = max(tf, hook["to"] if hook else 0)
    early = [c["text"] for c in data["captions"] if c["from"] < first]
    add("サムネイル・一言に字幕を重ねない", not early, "、".join(early) or "なし", "なし")
    inside = CAP_BOX["left"] >= SAFE["left"] and CAP_BOX["right"] <= SAFE["right"] and CAP_BOX["top"] >= SAFE["top"] and CAP_BOX["bottom"] <= SAFE["bottom"]
    add("字幕の位置（隠れない範囲）", inside, f"x {CAP_BOX['left']}〜{CAP_BOX['right']}、y {CAP_BOX['top']}〜{CAP_BOX['bottom']}",
        f"x {SAFE['left']}〜{SAFE['right']}、y {SAFE['top']}〜{SAFE['bottom']}（720x1280）")
    add("本編への案内", bool(data.get("end", {}).get("text")), data.get("end", {}).get("text", "なし"), "あり")
    # 音
    mix = decode_audio(video, SR, 2)
    loud = pyln.Meter(SR).integrated_loudness(mix)
    lo, hi = q["loudness_lufs"]
    add("全体の音量", lo <= loud <= hi, f"{loud:.1f} LUFS", f"{lo}〜{hi} LUFS")
    peak = 20 * np.log10(float(np.abs(mix).max()) + 1e-9)
    add("音のピーク（音割れ）", peak <= -0.5, f"{peak:.1f} dBFS", "-0.5 dBFS 以下")
    ok = all(res)
    print("合格" if ok else "不合格：直してから書き出し直す")
    (build_dir(args.episode) / f"qa_short_{args.name}.json").write_text(json.dumps({"ok": ok, "video": str(video)}, ensure_ascii=False), encoding="utf-8")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
