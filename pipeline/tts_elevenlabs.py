"""narration.json → ElevenLabs で区間ごとに音声合成 → narration.wav と timeline.json

  python pipeline/tts_elevenlabs.py 001-plains            # 生成（同じ文はキャッシュを使い、再課金しない）
  python pipeline/tts_elevenlabs.py 001-plains --only n05 # 1区間だけ作り直す（キャッシュを無視）
  python pipeline/tts_elevenlabs.py 001-plains --dry-run  # 文字数と概算費用だけ表示

narration.json の各区間：
  caption  台本の文（概要欄や確認用。画面には出さない）
  tts      合成に渡す文（任意）。読み間違いの言い換えはここに書く。無ければ caption を使う。どちらも数字はひらがなに直してから渡す
  read     正しい読み（かな）。ASRチェックで、聞き取り結果と比べる基準

出力（episodes/<id>/build/）：
  segments/<id>.wav   区間ごとの音声（ASRチェック用）
  narration.wav       全体（48kHz, モノラル, 目標ラウドネスに調整済み）
  timeline.json       区間の開始・終了（秒とフレーム）
"""
import argparse
import hashlib
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import numpy as np
import pyloudnorm as pyln
import soundfile as sf

sys.path.insert(0, str(Path(__file__).parent))
import subprocess  # noqa: E402
import tempfile  # noqa: E402

from common import build_dir, decode_audio, ffmpeg_bin, load_config, load_narration, require_env, write_json  # noqa: E402
from numread import numbers_to_kana  # noqa: E402

API = "https://api.elevenlabs.io/v1"
SR = 48000
USD_PER_1K = 0.08  # 従量課金の目安（Starter超過分 / v3・multilingual_v2）。プラン内なら追加費用なし


def tts_text(s: dict) -> str:
    """合成に渡す文。数字はひらがなの読みに直す（「1978年」などの読み違いを防ぐ。numread.py）"""
    return numbers_to_kana(s.get("tts") or s["caption"])


def request_audio(text: str, t: dict, key: str, prev: str, nxt: str) -> bytes:
    body = {"text": text, "model_id": t["model_id"]}
    if t.get("voice_settings"):
        body["voice_settings"] = t["voice_settings"]
    if t.get("language_code"):
        body["language_code"] = t["language_code"]
    if t.get("seed") is not None:
        body["seed"] = int(t["seed"])
    if t.get("stitch", True):
        if prev:
            body["previous_text"] = prev
        if nxt:
            body["next_text"] = nxt
    url = f"{API}/text-to-speech/{t['voice_id']}?output_format={t.get('output_format', 'mp3_44100_128')}"
    data = json.dumps(body).encode("utf-8")
    for attempt in range(5):
        req = urllib.request.Request(url, data=data, method="POST",
                                     headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg"})
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            msg = e.read().decode("utf-8", errors="replace")[:500]
            if e.code in (429, 500, 502, 503, 504) and attempt < 4:
                time.sleep(4 * (attempt + 1))
                continue
            sys.exit(f"ElevenLabs API エラー {e.code}: {msg}")
    sys.exit("ElevenLabs API に接続できませんでした")


def level_segments(segs_audio: list[np.ndarray], max_gain_db: float = 6.0) -> list[np.ndarray]:
    """区間ごとの音量のばらつきをそろえる（ElevenLabs は区間によって数dB違う）。中央値に合わせ、±max_gain_db まで"""
    meter = pyln.Meter(SR)
    louds = [meter.integrated_loudness(a) if len(a) > SR // 2 else float("nan") for a in segs_audio]
    ok = [x for x in louds if np.isfinite(x)]
    if not ok:
        return segs_audio
    ref = float(np.median(ok))
    out = []
    for a, l in zip(segs_audio, louds):
        g = 0.0 if not np.isfinite(l) else float(np.clip(ref - l, -max_gain_db, max_gain_db))
        out.append((a * 10 ** (g / 20)).astype(np.float32))
    return out


def limit_peaks(wav: np.ndarray, ceiling: float = 0.89) -> np.ndarray:
    """口の音や破裂音の一瞬のピークだけを抑える（ffmpeg の alimiter）。これが無いと、ピークに合わせて全体が小さくなる"""
    with tempfile.TemporaryDirectory() as d:
        src, dst = Path(d) / "in.wav", Path(d) / "out.wav"
        sf.write(src, wav.astype(np.float32), SR, subtype="FLOAT")
        subprocess.run([ffmpeg_bin(), "-v", "error", "-y", "-i", str(src), "-af",
                        f"alimiter=limit={ceiling}:attack=2:release=50:level=disabled", "-ar", str(SR), str(dst)], check=True)
        out, _ = sf.read(dst, dtype="float32")
    return out[: len(wav)] if len(out) >= len(wav) else np.pad(out, (0, len(wav) - len(out)))


def trim(a: np.ndarray, db: float, pad: float = 0.05) -> np.ndarray:
    """頭と末尾の無音を切りそろえる（区切りの間を設定どおりにするため）"""
    win = int(0.01 * SR)
    n = len(a) // win
    if n == 0:
        return a
    rms = np.sqrt((a[: n * win].reshape(n, win) ** 2).mean(axis=1) + 1e-12)
    on = np.where(20 * np.log10(rms) > db)[0]
    if len(on) == 0:
        return a
    s = max(0, on[0] * win - int(pad * SR))
    e = min(len(a), (on[-1] + 1) * win + int(pad * SR))
    return a[s:e]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episode")
    ap.add_argument("--only", help="作り直す区間ID（カンマ区切り）。キャッシュを使わない")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    cfg = load_config(args.episode)
    t, fps = cfg["tts"], cfg["video"]["fps"]
    segs = load_narration(args.episode)
    chars = sum(len(tts_text(s)) for s in segs)
    print(f"{len(segs)}区間 / {chars}文字（全区間を新規生成した場合の概算 ${chars / 1000 * USD_PER_1K:.2f}）")
    if args.dry_run:
        return
    if not t.get("voice_id"):
        sys.exit("config/channel.yaml の tts.voice_id が未設定です。tts_voice_samples.py で声を決めてください。")
    key = require_env("ELEVENLABS_API_KEY")

    out = build_dir(args.episode)
    cache = out / "tts_cache"
    seg_dir = out / "segments"
    cache.mkdir(exist_ok=True)
    seg_dir.mkdir(exist_ok=True)
    only = set(args.only.split(",")) if args.only else set()

    pieces = [np.zeros(int(t["lead"] * SR), np.float32)]
    pos = t["lead"]
    timeline, billed = [], 0
    for i, s in enumerate(segs):
        if i > 0:
            g = t["chapter_gap"] if s.get("chapter") else t["gap"]
            pieces.append(np.zeros(int(g * SR), np.float32))
            pos += g
        text = tts_text(s)
        prev = tts_text(segs[i - 1]) if i > 0 else ""
        nxt = tts_text(segs[i + 1]) if i + 1 < len(segs) else ""
        sig = json.dumps([text, prev, nxt, t["voice_id"], t["model_id"], t.get("voice_settings"), t.get("seed"),
                          t.get("language_code"), t.get("stitch", True)], ensure_ascii=False, sort_keys=True)
        h = hashlib.sha1(sig.encode("utf-8")).hexdigest()[:16]
        mp3 = cache / f"{s['id']}_{h}.mp3"
        if s["id"] in only or not mp3.exists():
            mp3.write_bytes(request_audio(text, t, key, prev, nxt))
            billed += len(text)
            tag = "生成"
        else:
            tag = "キャッシュ"
        a = trim(decode_audio(mp3, SR), t["trim_silence_db"])
        sf.write(seg_dir / f"{s['id']}.wav", a, SR)
        dur = len(a) / SR
        pieces.append(a)
        timeline.append({**s, "start": round(pos, 3), "end": round(pos + dur, 3),
                         "startFrame": int(round(pos * fps)), "endFrame": int(round((pos + dur) * fps))})
        print(f"{s['id']} {dur:5.2f}s [{tag}] {s['caption'][:28]}")
        pos += dur
    pieces.append(np.zeros(int(t["tail"] * SR), np.float32))
    pos += t["tail"]

    # 区間の音量をそろえる（無音の間は pieces の偶数番目、声は奇数番目）
    voiced = [i for i in range(1, len(pieces) - 1) if i % 2 == 1]
    leveled = level_segments([pieces[i] for i in voiced])
    for i, a in zip(voiced, leveled):
        pieces[i] = a
    wav = np.concatenate(pieces)
    meter = pyln.Meter(SR)
    speech = np.concatenate(pieces[1:-1])
    gain = 10 ** ((cfg["audio"]["narration_lufs"] - meter.integrated_loudness(speech)) / 20)
    wav = limit_peaks(wav * gain)
    after = meter.integrated_loudness(wav[int(t["lead"] * SR): len(wav) - int(t["tail"] * SR)])
    print(f"ナレーションの音量 {after:.1f} LUFS（目標 {cfg['audio']['narration_lufs']}）、ピーク {20 * np.log10(np.abs(wav).max() + 1e-9):.1f} dBFS")
    sf.write(out / "narration.wav", wav.astype(np.float32), SR, subtype="PCM_16")
    write_json(out / "timeline.json", {"fps": fps, "totalSeconds": round(pos, 3),
                                       "totalFrames": int(np.ceil(pos * fps)), "segments": timeline})
    print(f"合計 {pos:.1f}秒 / 今回課金された文字数 {billed}（概算 ${billed / 1000 * USD_PER_1K:.2f}）")
    show_quota(key)


def show_quota(key: str) -> None:
    try:
        req = urllib.request.Request(f"{API}/user/subscription", headers={"xi-api-key": key})
        with urllib.request.urlopen(req, timeout=30) as r:
            sub = json.loads(r.read())
        print(f"今月の使用量: {sub.get('character_count')} / {sub.get('character_limit')} クレジット（プラン {sub.get('tier')}）")
    except Exception:
        pass


if __name__ == "__main__":
    main()
