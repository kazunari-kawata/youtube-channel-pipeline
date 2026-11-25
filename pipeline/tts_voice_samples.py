"""ElevenLabs の声を探して聞き比べる

  python pipeline/tts_voice_samples.py --models
      使えるモデルの一覧（日本語対応かどうか）
  python pipeline/tts_voice_samples.py --library [--gender male] [--search 落ち着いた]
      ボイスライブラリの日本語の声を一覧し、公式の試聴音声（無料）を build/voice_samples/preview/ に保存
  python pipeline/tts_voice_samples.py --add <public_owner_id>:<voice_id>
      ライブラリの声を自分のアカウントに追加（APIで使うのに必要）
  python pipeline/tts_voice_samples.py --sample <voice_id>[,<voice_id>...] [--model eleven_multilingual_v2]
      その回（--episode、既定 002-dahmer）の冒頭（--chars 字、既定60字）を台本の文のまま、その声で読ませる（1声あたり約60〜80文字を消費）

  python pipeline/tts_voice_samples.py --segments 3 --voice <voice_id> --model eleven_multilingual_v2
      冒頭の N 区間を、本番と同じ作り方（区間ごとに生成、v2 は前後の文を渡すつなぎあり、無音の切りそろえ、間、音量）でつないで聞く。
      区間の変わり目の音も含めて確かめるため。--joined を付けると N 区間を1回の生成で読ませる

聞き比べて決めたら、config/channel.yaml の tts.voice_id（と model_id）に書く。
"""
import argparse
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import subprocess  # noqa: E402
import tempfile  # noqa: E402

import numpy as np  # noqa: E402
import pyloudnorm as pyln  # noqa: E402
import soundfile as sf  # noqa: E402

from common import ROOT, decode_audio, ffmpeg_bin, load_config, require_env  # noqa: E402
from tts_elevenlabs import API, SR, level_segments, limit_peaks, request_audio, stitching, trim  # noqa: E402

OUT = ROOT / "build" / "voice_samples"


def call(path: str, key: str, method: str = "GET", body: dict | None = None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(f"{API}{path}", data=data, method=method,
                                 headers={"xi-api-key": key, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def models(key):
    for m in call("/models", key):
        if not m.get("can_do_text_to_speech"):
            continue
        ja = any(l.get("language_id") == "ja" for l in m.get("languages", []))
        print(f"{m['model_id']:32} 日本語{'○' if ja else '×'}  文字単価x{m.get('model_rates', {}).get('character_cost_multiplier', '?')}"
              f"  1回の上限 {m.get('maximum_text_length_per_request', '?')}文字  {m.get('name')}")


def library(key, gender, search, n):
    q = {"language": "ja", "page_size": n, "sort": "cloned_by_count"}
    if gender:
        q["gender"] = gender
    if search:
        q["search"] = search
    res = call("/shared-voices?" + urllib.parse.urlencode(q), key)
    prev = OUT / "preview"
    prev.mkdir(parents=True, exist_ok=True)
    for v in res.get("voices", []):
        name = v.get("name", "")
        safe = "".join(c if c.isalnum() else "_" for c in name)[:40]
        line = (f"{name} | {v.get('gender')} {v.get('age')} | {v.get('use_case')} | 利用者{v.get('cloned_by_count')}"
                f" | 単価x{v.get('rate', 1)} | {v.get('public_owner_id')}:{v.get('voice_id')}")
        print(line)
        if v.get("description"):
            print("    ", v["description"][:120].replace("\n", " "))
        if v.get("preview_url"):
            try:
                urllib.request.urlretrieve(v["preview_url"], prev / f"{safe}_{v['voice_id']}.mp3")
            except Exception:
                pass
    print(f"\n試聴音声: {prev}")


def add(key, spec):
    owner, vid = spec.split(":")
    res = call(f"/voices/add/{owner}/{vid}", key, "POST", {"new_name": f"lib_{vid[:8]}"})
    print("追加しました。voice_id =", res.get("voice_id"))


def voice_name(key, vid) -> str:
    try:
        return call(f"/voices/{vid}", key).get("name", vid)
    except Exception:
        return vid


def sample(key, ids, model, episode, chars):
    """その回の冒頭（約 chars 文字）を、その声で読ませる。台本の文のまま渡す（本番と同じ。数字をひらがなに直さない：F-018）"""
    segs = json.loads((ROOT / "episodes" / episode / "narration.json").read_text(encoding="utf-8"))
    text = ""
    for s in segs:
        text += s.get("tts") or s["caption"]
        if len(text) >= chars:
            break
    out = OUT / episode
    out.mkdir(parents=True, exist_ok=True)
    t = {"model_id": model, "voice_settings": None, "stitch": False, "output_format": "mp3_44100_128"}
    if model.startswith("eleven_v3"):
        t["language_code"] = "ja"
    for vid in ids:
        t["voice_id"] = vid
        name = "".join(c if c.isalnum() else "_" for c in voice_name(key, vid))[:30]
        p = out / f"{name}_{vid}_{model}.mp3"
        p.write_bytes(request_audio(text, t, key, "", ""))
        print(f"{p.name}（{len(text)}文字）")


V2_SETTINGS = {"stability": 0.5, "similarity_boost": 0.75, "style": 0.0, "use_speaker_boost": True, "speed": 1.0}


def segments_sample(key, vid, model, episode, n, joined):
    """冒頭の n 区間を本番と同じ作り方でつなぐ（区間の変わり目の音を確かめる）"""
    cfg = load_config(episode)["tts"]
    segs = json.loads((ROOT / "episodes" / episode / "narration.json").read_text(encoding="utf-8"))[:n]
    texts = [s.get("tts") or s["caption"] for s in segs]
    t = {"voice_id": vid, "model_id": model, "seed": 42, "stitch": True, "output_format": "mp3_44100_128",
         "voice_settings": None if model.startswith("eleven_v3") else V2_SETTINGS}
    if model.startswith("eleven_v3"):
        t["language_code"] = "ja"
    gap = np.zeros(int(cfg["gap"] * SR), np.float32)
    with tempfile.TemporaryDirectory() as d:
        def gen(text, prev, nxt):
            mp3 = Path(d) / f"{abs(hash((text, prev, nxt)))}.mp3"
            mp3.write_bytes(request_audio(text, t, key, prev, nxt))
            return trim(decode_audio(mp3, SR), cfg["trim_silence_db"])
        if joined:
            parts = [gen("".join(texts), "", "")]
        else:
            parts = [gen(x, texts[i - 1] if i else "", texts[i + 1] if i + 1 < n else "") for i, x in enumerate(texts)]
            parts = level_segments(parts)
        pieces = [np.zeros(int(0.5 * SR), np.float32)]
        for i, a in enumerate(parts):
            pieces += ([gap] if i else []) + [a]
        pieces.append(np.zeros(int(1.0 * SR), np.float32))
        wav = np.concatenate(pieces)
        meter = pyln.Meter(SR)
        wav = limit_peaks(wav * 10 ** ((-16 - meter.integrated_loudness(np.concatenate(parts))) / 20))
        out = OUT / episode
        out.mkdir(parents=True, exist_ok=True)
        tag = "joined" if joined else ("stitched" if stitching(t) else "separate")
        dst = out / f"{vid}_{model}_{n}seg_{tag}.mp3"
        src = Path(d) / "mix.wav"
        sf.write(src, wav.astype(np.float32), SR)
        subprocess.run([ffmpeg_bin(), "-v", "error", "-y", "-i", str(src), "-b:a", "192k", str(dst)], check=True)
    print(f"{dst.name}（{sum(len(x) for x in texts)}文字、{len(wav) / SR:.1f}秒）")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", action="store_true")
    ap.add_argument("--library", action="store_true")
    ap.add_argument("--gender")
    ap.add_argument("--search")
    ap.add_argument("-n", type=int, default=20)
    ap.add_argument("--add")
    ap.add_argument("--sample")
    ap.add_argument("--model", default="eleven_v3")
    ap.add_argument("--episode", default="002-dahmer", help="--sample で読ませる回")
    ap.add_argument("--chars", type=int, default=60, help="--sample の文字数の目安（60字で約10秒）")
    ap.add_argument("--segments", type=int, help="冒頭の N 区間を本番と同じ作り方でつなぐ（--voice で声を指定）")
    ap.add_argument("--voice", help="--segments の声（既定は config の tts.voice_id）")
    ap.add_argument("--joined", action="store_true", help="--segments の N 区間を1回の生成で読ませる")
    a = ap.parse_args()
    key = require_env("ELEVENLABS_API_KEY")
    if a.models:
        models(key)
    if a.library:
        library(key, a.gender, a.search, a.n)
    if a.add:
        add(key, a.add)
    if a.sample:
        sample(key, a.sample.split(","), a.model, a.episode, a.chars)
    if a.segments:
        vid = a.voice or load_config(a.episode)["tts"]["voice_id"]
        segments_sample(key, vid, a.model, a.episode, a.segments, a.joined)


if __name__ == "__main__":
    main()
