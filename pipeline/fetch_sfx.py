"""効果音を取ってきて、使える形にそろえる（config/sfx_sources.yaml → assets/sfx/<名前>.wav）

  python pipeline/fetch_sfx.py            # 足りないものだけ取得
  python pipeline/fetch_sfx.py --force    # 全部取り直す

そろえ方
  単発の音：頭の無音を切る → max 秒で切る（最後はフェードアウト）→ 鳴っている部分の音量を -18 dBFS（RMS）に、ピークは -1 dBFS まで
  環境音（bed）：start から max 秒 → 統合ラウドネス -18 LUFS、頭と終わりを0.5秒でフェード
  どれも 48kHz モノラル。声との音量差は Remotion で config/channel.yaml の sfx.db_below_voice を掛ける
取ったものは assets/sfx/LICENSES.md の「記録」に書く（このスクリプトが足りない行を足す）。元の mp3 は assets/sfx/_src/ に残す
"""
import argparse
import datetime
import sys
import urllib.request
from pathlib import Path

import numpy as np
import pyloudnorm as pyln
import soundfile as sf
import yaml

sys.path.insert(0, str(Path(__file__).parent))
from common import ROOT, decode_audio  # noqa: E402

SR = 48000
SFX = ROOT / "assets" / "sfx"
URL = "https://assets.mixkit.co/active_storage/sfx/{id}/{id}-preview.mp3"
PAGE = "https://mixkit.co/free-sound-effects/"


def db(x: np.ndarray) -> float:
    return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)


def shape_oneshot(a: np.ndarray, mx: float) -> np.ndarray:
    a = np.array(a, dtype=np.float32)  # decode_audio は読み取り専用の配列を返す
    peak = np.abs(a).max() + 1e-12
    on = np.flatnonzero(np.abs(a) > peak * 10 ** (-40 / 20))
    a = a[max(0, on[0] - int(0.005 * SR)):] if len(on) else a
    if len(a) > mx * SR:
        a = a[: int(mx * SR)]
        f = int(min(0.25, mx / 3) * SR)
        a[-f:] *= np.linspace(1, 0, f) ** 2
    else:
        f = min(len(a), int(0.02 * SR))
        a[-f:] *= np.linspace(1, 0, f)
    act = a[np.abs(a) > (np.abs(a).max() * 0.05)]
    a = a * 10 ** ((-18 - db(act if len(act) else a)) / 20)
    p = np.abs(a).max()
    if p > 0.89:
        a *= 0.89 / p
    return a.astype(np.float32)


def shape_bed(a: np.ndarray, start: float, mx: float) -> np.ndarray:
    a = np.array(a[int(start * SR): int((start + mx) * SR)], dtype=np.float32)
    a = a * 10 ** ((-18 - pyln.Meter(SR).integrated_loudness(a)) / 20)
    f = int(0.5 * SR)
    a[:f] *= np.linspace(0, 1, f)
    a[-f:] *= np.linspace(1, 0, f)
    p = np.abs(a).max()
    if p > 0.89:
        a *= 0.89 / p
    return a.astype(np.float32)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()
    cfg = yaml.safe_load((ROOT / "config" / "sfx_sources.yaml").read_text(encoding="utf-8"))
    src = SFX / "_src"
    src.mkdir(parents=True, exist_ok=True)
    lic = SFX / "LICENSES.md"
    lic_text = lic.read_text(encoding="utf-8")
    today = datetime.date.today().isoformat()
    rows = []
    for name, f in cfg["files"].items():
        out = SFX / f"{name}.wav"
        mp3 = src / f"mixkit_{f['id']}.mp3"
        if a.force or not mp3.exists():
            req = urllib.request.Request(URL.format(id=f["id"]), headers={"User-Agent": "Mozilla/5.0"})
            mp3.write_bytes(urllib.request.urlopen(req, timeout=60).read())
        if a.force or not out.exists():
            x = decode_audio(mp3, SR)
            y = shape_bed(x, f.get("start", 0.0), f["max"]) if f.get("bed") else shape_oneshot(x[int(f.get("start", 0) * SR):], f["max"])
            sf.write(out, y, SR, subtype="PCM_16")
            print(f"{out.name:18} ← Mixkit {f['id']}「{f['title']}」 {len(y) / SR:.1f}秒")
        if f"| {name}.wav |" not in lic_text:
            key = name.rsplit("_", 1)[0]
            rows.append(f"| {name}.wav | {key} | {f['title']} | Mixkit #{f['id']}（{URL.format(id=f['id'])}） | "
                        f"Mixkit Sound Effects Free License（商用・YouTube 可、クレジット不要） | {today} | mixkit.co/license（2026-11-25 確認） | 002 |")
    if rows:
        lic.write_text(lic_text.rstrip("\n") + "\n" + "\n".join(rows) + "\n", encoding="utf-8")
        print(f"LICENSES.md に {len(rows)} 行を足しました")


if __name__ == "__main__":
    main()
