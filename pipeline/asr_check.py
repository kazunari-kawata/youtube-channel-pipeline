"""合成ナレーションの読み間違いチェック：Whisperで文字に戻し、原稿の読み（かな）と区間ごとに比べる

  python pipeline/asr_check.py 001-plains

一致率がしきい値（config qa.asr_min_ratio）未満の区間は「要確認」。
直し方：narration.json のその区間に "tts" を足し、誤読しにくい言い方やかな表記に変えてから
  python pipeline/tts_elevenlabs.py 001-plains --only <区間ID>
"""
import argparse
import difflib
import json
import sys
import unicodedata
from pathlib import Path

import numpy as np
import scipy.signal as sg
import soundfile as sf

sys.path.insert(0, str(Path(__file__).parent))
from common import build_dir, load_config, write_json  # noqa: E402


def make_kana():
    import fugashi
    tagger = fugashi.Tagger()

    def kana(s: str) -> str:
        """漢字かな混じり文を、カタカナの発音形にそろえる（記号・数字は除く）"""
        s = unicodedata.normalize("NFKC", s)
        out = []
        for w in tagger(s):
            out.append(getattr(w.feature, "pron", None) or getattr(w.feature, "kana", None) or w.surface)
        k = "".join(out)
        k = "".join(chr(ord(c) + 0x60) if "ぁ" <= c <= "ゖ" else c for c in k)
        return "".join(ch for ch in k if "゠" <= ch <= "ヿ")
    return kana


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episode")
    ap.add_argument("--model", default="small")
    args = ap.parse_args()
    from faster_whisper import WhisperModel

    cfg = load_config(args.episode)
    th = cfg["qa"]["asr_min_ratio"]
    out = build_dir(args.episode)
    tl = json.loads((out / "timeline.json").read_text(encoding="utf-8"))
    model = WhisperModel(args.model, device="auto", compute_type="int8")
    kana = make_kana()
    rows, bad = [], []
    for s in tl["segments"]:
        a, sr = sf.read(out / "segments" / f"{s['id']}.wav", dtype="float32")
        g = np.gcd(sr, 16000)
        x = sg.resample_poly(a, 16000 // g, sr // g).astype(np.float32)
        parts, _ = model.transcribe(x, language="ja", beam_size=5, vad_filter=False)
        hyp = "".join(p.text for p in parts)
        ref = s.get("read") or s.get("tts") or s["caption"]
        r = difflib.SequenceMatcher(None, kana(ref), kana(hyp)).ratio()
        rows.append({"id": s["id"], "ratio": round(r, 3), "caption": s["caption"], "heard": hyp})
        flag = "" if r >= th else "  <-- 要確認"
        if r < th:
            bad.append(s["id"])
        print(f"{s['id']} 一致率 {r:.2f}{flag}\n   原稿: {s['caption']}\n   認識: {hyp}")
    write_json(out / "asr_report.json", {"threshold": th, "segments": rows, "flagged": bad})
    print(f"平均一致率 {np.mean([r['ratio'] for r in rows]):.3f} / 要確認 {len(bad)}区間 {bad}")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
