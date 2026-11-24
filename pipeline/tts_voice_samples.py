"""ElevenLabs の声を探して聞き比べる

  python pipeline/tts_voice_samples.py --models
      使えるモデルの一覧（日本語対応かどうか）
  python pipeline/tts_voice_samples.py --library [--gender male] [--search 落ち着いた]
      ボイスライブラリの日本語の声を一覧し、公式の試聴音声（無料）を build/voice_samples/preview/ に保存
  python pipeline/tts_voice_samples.py --add <public_owner_id>:<voice_id>
      ライブラリの声を自分のアカウントに追加（APIで使うのに必要）
  python pipeline/tts_voice_samples.py --sample <voice_id>[,<voice_id>...] [--model eleven_v3]
      001話の冒頭3文を、その声で実際に読ませる（1声あたり約150文字を消費）

聞き比べて決めたら、config/channel.yaml の tts.voice_id（と model_id）に書く。
"""
import argparse
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from common import ROOT, require_env  # noqa: E402
from tts_elevenlabs import API, request_audio  # noqa: E402

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


def sample(key, ids, model):
    segs = json.loads((ROOT / "episodes" / "001-plains" / "narration.json").read_text(encoding="utf-8"))[:3]
    text = "".join(s.get("tts") or s["caption"] for s in segs)
    OUT.mkdir(parents=True, exist_ok=True)
    t = {"model_id": model, "voice_settings": None, "stitch": False, "output_format": "mp3_44100_128"}
    if model.startswith("eleven_v3"):
        t["language_code"] = "ja"
    for vid in ids:
        t["voice_id"] = vid
        p = OUT / f"{vid}_{model}.mp3"
        p.write_bytes(request_audio(text, t, key, "", ""))
        print(f"{p}（{len(text)}文字）")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", action="store_true")
    ap.add_argument("--library", action="store_true")
    ap.add_argument("--gender")
    ap.add_argument("--search")
    ap.add_argument("-n", type=int, default=20)
    ap.add_argument("--add")
    ap.add_argument("--sample")
    ap.add_argument("--model", default="eleven_multilingual_v2")
    a = ap.parse_args()
    key = require_env("ELEVENLABS_API_KEY")
    if a.models:
        models(key)
    if a.library:
        library(key, a.gender, a.search, a.n)
    if a.add:
        add(key, a.add)
    if a.sample:
        sample(key, a.sample.split(","), a.model)


if __name__ == "__main__":
    main()
