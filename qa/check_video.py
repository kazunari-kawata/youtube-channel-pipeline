"""書き出した動画の自動チェック。ユーザーに見せる前に必ず通す（CLAUDE.md）

  python qa/check_video.py 001-plains                   # episodes/<id>/build/video.mp4 を検査
  python qa/check_video.py 001-plains --video other.mp4 # 別のファイルを検査
  python qa/check_video.py 001-plains --partial         # 一部だけ書き出した確認用（映像だけ検査）

検査項目（しきい値は config/channel.yaml の qa）
  映像  チラつき（F-001）／真っ黒なフレーム／解像度／長さ
  音    ナレーションと動画のずれ／全体の音量（ラウドネス）
        BGMが聞こえるか：声のない区間の音量、声の下でのBGMの大きさ（F-005）
  コード 字幕・出典カードを入れていないか、チラつき対策が外れていないか（F-002, F-004, F-001）
  効果音 香盤表で効果音を割り当てたか、間隔と強い音の頻度が基準内か（F-012）
結果は build/qa_report.json にも保存。不合格が1つでもあれば終了コード1。
"""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np
import pyloudnorm as pyln
from scipy.ndimage import binary_opening

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "pipeline"))
from common import REMOTION, build_dir, decode_audio, ffmpeg_bin, load_config, write_json  # noqa: E402

SR = 48000
SW, SH = 320, 180
OPEN = np.ones((3, 3), bool)


class Report:
    def __init__(self):
        self.items = []

    def add(self, name, ok, value, expect, note=""):
        self.items.append({"check": name, "ok": bool(ok), "value": value, "expect": expect, "note": note})
        mark = "OK " if ok else "NG "
        print(f"[{mark}] {name}: {value}（基準 {expect}）{' ' + note if note else ''}")

    @property
    def passed(self):
        return all(i["ok"] for i in self.items)


def probe(video: Path) -> dict:
    out = subprocess.run([ffmpeg_bin("ffprobe"), "-v", "error", "-show_entries",
                          "stream=codec_type,width,height,r_frame_rate:format=duration", "-of", "json", str(video)],
                         check=True, capture_output=True, text=True).stdout
    return json.loads(out)


def scan_frames(video: Path, cfg_qa: dict):
    """縮小グレー画像で全フレームを読み、チラつきと真っ黒を数える"""
    proc = subprocess.Popen([ffmpeg_bin(), "-v", "error", "-i", str(video), "-vf", f"scale={SW}:{SH},format=gray",
                             "-f", "rawvideo", "-"], stdout=subprocess.PIPE)
    size = SW * SH
    prev2 = prev1 = None
    flicker, black, idx = [], [], 0
    while True:
        buf = proc.stdout.read(size * 120)
        if not buf:
            break
        frames = np.frombuffer(buf, np.uint8).reshape(-1, SH, SW).astype(np.int16)
        for f in frames:
            if f.max() < cfg_qa["black_max_luma"]:
                black.append(idx)
            if prev2 is not None:
                # 明るさが「上がって下がる／下がって上がる」画素。カメラ移動で細かい光が流れるだけでも
                # 点状に出るので、3x3のまとまり（＝面で起きる明滅。Zファイティングはこれ）だけを数える
                d1, d2 = prev1 - prev2, f - prev1
                rev = ((d1 > 6) & (d2 < -6)) | ((d1 < -6) & (d2 > 6))
                n = int(binary_opening(rev, OPEN).sum())
                if n > cfg_qa["flicker_px"]:
                    flicker.append((idx - 1, n))
            prev2, prev1 = prev1, f
            idx += 1
    proc.wait()
    return idx, flicker, black


def ranges(frames: list[int]) -> str:
    if not frames:
        return "なし"
    out, s, p = [], frames[0], frames[0]
    for x in frames[1:] + [None]:
        if x is not None and x == p + 1:
            p = x
            continue
        out.append(f"{s}" if s == p else f"{s}-{p}")
        if x is not None:
            s = p = x
    return ", ".join(out[:12]) + (" …" if len(out) > 12 else "")


def lufs(meter, x) -> float:
    return float(meter.integrated_loudness(x)) if len(x) >= int(0.5 * SR) else float("nan")


def audio_checks(video: Path, narr_path: Path, tl: dict, q: dict, rep: Report):
    mix = decode_audio(video, SR)
    narr = decode_audio(narr_path, SR)
    meter = pyln.Meter(SR)

    # ずれ：最初の40秒で相互相関
    n = min(len(mix), len(narr), 40 * SR)
    a, b = mix[:n], narr[:n]
    F = np.fft.rfft(a, 2 * n) * np.conj(np.fft.rfft(b, 2 * n))
    cc = np.fft.irfft(F)
    lag = int(np.argmax(np.concatenate([cc[-n:], cc[:n]]))) - n
    lag_ms = 1000 * lag / SR
    rep.add("ナレーションのずれ", abs(lag_ms) <= q["sync_max_ms"], f"{lag_ms:+.0f}ms", f"±{q['sync_max_ms']}ms以内")
    if lag > 0:
        narr = np.concatenate([np.zeros(lag, np.float32), narr])
    elif lag < 0:
        narr = narr[-lag:]
    m = min(len(mix), len(narr))
    mix, narr = mix[:m], narr[:m]

    total = lufs(meter, mix)
    lo, hi = q["loudness_lufs"]
    rep.add("全体の音量", lo <= total <= hi, f"{total:.1f} LUFS", f"{lo}〜{hi} LUFS", "YouTubeは約-14に揃える")

    segs = tl["segments"]
    speech = np.zeros(m, bool)
    for s in segs:
        speech[int(s["start"] * SR): int(s["end"] * SR)] = True

    # 声のない区間（冒頭と末尾）のBGMの音量
    gaps = []
    lead_end = segs[0]["start"] - 0.2
    if lead_end > 0.7:
        gaps.append(mix[int(0.2 * SR): int(lead_end * SR)])
    tail_s = segs[-1]["end"] + 0.5
    tail_e = min(m / SR, tail_s + 4.0)
    if tail_e - tail_s > 0.7:
        gaps.append(mix[int(tail_s * SR): int(tail_e * SR)])
    if gaps:
        g = lufs(meter, np.concatenate(gaps))
        lo, hi = q["bgm_gap_lufs"]
        ok = np.isfinite(g) and lo <= g <= hi
        rep.add("声のない区間のBGM", ok, f"{g:.1f} LUFS", f"{lo}〜{hi} LUFS", "低すぎると『BGMが聞こえない』")

    # 声の下のBGM：動画の音からナレーションを差し引いた残り＝BGM
    k = float((mix[speech] @ narr[speech]) / max(1e-9, narr[speech] @ narr[speech]))
    resid = mix - k * narr
    v_l = lufs(meter, (k * narr)[speech])
    b_l = lufs(meter, resid[speech])
    rel = b_l - v_l
    lo, hi = q["bgm_under_speech_db"]
    rep.add("声の下のBGM（声との差）", np.isfinite(rel) and lo <= rel <= hi, f"{rel:+.1f} dB", f"{lo}〜{hi} dB")


def lint(rep: Report):
    """フィードバックで禁止したものがコードに戻っていないか"""
    src = REMOTION / "src"
    text = {p: p.read_text(encoding="utf-8") for p in src.rglob("*.ts*")}
    bad = [str(p.relative_to(src)) for p, t in text.items()
           if re.search(r"<Subtitles|\bcaption\}|出典・使用データ|<EndCard", t)]
    rep.add("字幕・出典カードを入れていない", not bad, bad or "なし", "なし", "F-002, F-004")
    terrain = text.get(src / "lib" / "Terrain.tsx", "")
    ok = re.search(r"depthWrite:\s*false,\s*depthTest:\s*false", terrain) is not None and "dist * 0.05" in terrain
    rep.add("チラつき対策（海の板・近クリップ面）", ok, "あり" if ok else "外れている", "あり", "F-001")
    fig = text.get(src / "lib" / "Figure.tsx", "")
    ok = all(k in fig for k in ("hideCovered(m)", "makeClothes(", "makeHair(")) and "SLIM_90S" in fig
    rep.add("人物は服・髪つきの痩せ型（筋肉質なマネキンを見せない）", ok, "あり" if ok else "外れている", "あり", "F-008")
    ins = text.get(src / "inserts" / "Inserts.tsx", "")
    ok = "イメージ" in ins
    rep.add("イメージ映像に「イメージ」表示", ok, "あり" if ok else "なし", "あり", "F-009")
    ok = all(k in ins for k in ("FILM_GRADE", "<Bloom")) and (src / "inserts" / "Era80s.tsx").exists()
    rep.add("イメージ映像に時代の質感（フィルムの色・にじみ・小道具）", ok, "あり" if ok else "外れている", "あり", "F-011")


def sfx_checks(episode: str, cfg: dict, rep: Report):
    """効果音の計画（pipeline/shotlist.py が作る build/sfx_cues.json）が基準内か"""
    s = cfg["sfx"]
    f = build_dir(episode) / "sfx_cues.json"
    if not f.exists():
        rep.add("効果音の計画（香盤表）", False, "なし", "あり", "F-012：python pipeline/shotlist.py を実行")
        return
    d = json.loads(f.read_text(encoding="utf-8"))
    lo, hi = s["target_interval_sec"]
    rep.add("効果音の平均の間隔", bool(d["cues"]) and lo <= d["avg_interval"] <= hi, f"{d['avg_interval']}秒", f"{lo}〜{hi}秒", "F-012")
    rep.add("強い効果音の頻度", d["hits_per_min"] <= s["hit_per_min_max"], f"{d['hits_per_min']}回/分", f"{s['hit_per_min_max']}回/分まで", "F-012")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episode")
    ap.add_argument("--video")
    ap.add_argument("--partial", action="store_true", help="一部だけの書き出し（長さと音は検査しない）")
    args = ap.parse_args()
    cfg = load_config(args.episode)
    q = cfg["qa"]
    out = build_dir(args.episode)
    video = Path(args.video) if args.video else out / ("preview.mp4" if args.partial else "video.mp4")
    if not video.exists():
        sys.exit(f"{video} がありません")
    tl = json.loads((out / "timeline.json").read_text(encoding="utf-8"))
    rep = Report()
    print(f"検査: {video}")

    info = probe(video)
    vs = next(s for s in info["streams"] if s["codec_type"] == "video")
    has_audio = any(s["codec_type"] == "audio" for s in info["streams"])
    want_w = round(cfg["video"]["width"] * cfg["video"]["render_scale"])
    want_h = round(cfg["video"]["height"] * cfg["video"]["render_scale"])
    rep.add("解像度", (vs["width"], vs["height"]) == (want_w, want_h), f"{vs['width']}x{vs['height']}", f"{want_w}x{want_h}")
    dur = float(info["format"]["duration"])
    if not args.partial:
        rep.add("長さ", abs(dur - tl["totalSeconds"]) < 0.2, f"{dur:.2f}秒", f"{tl['totalSeconds']:.2f}秒")
        rep.add("音声トラック", has_audio, "あり" if has_audio else "なし", "あり")

    n, flicker, black = scan_frames(video, q)
    worst = max((c for _, c in flicker), default=0)
    rep.add("チラつき", len(flicker) <= q["flicker_max_frames"], f"{len(flicker)}フレーム（最大{worst}画素）",
            f"{q['flicker_max_frames']}フレーム", "該当: " + ranges([i for i, _ in flicker]) if flicker else "")
    rep.add("真っ黒なフレーム", not black, f"{len(black)}フレーム", "0", "該当: " + ranges(black) if black else "")

    if not args.partial and has_audio:
        audio_checks(video, out / "narration.wav", tl, q, rep)
    lint(rep)
    sfx_checks(args.episode, cfg, rep)

    write_json(out / ("qa_report_partial.json" if args.partial else "qa_report.json"),
               {"video": str(video), "frames": n, "passed": rep.passed, "items": rep.items})
    print("合格" if rep.passed else "不合格：直してから再書き出し")
    sys.exit(0 if rep.passed else 1)


if __name__ == "__main__":
    main()
