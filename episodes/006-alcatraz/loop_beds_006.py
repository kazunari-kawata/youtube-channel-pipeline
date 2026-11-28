"""006 の環境音のうち、元の音が短いもの（数秒のループ）を約30秒につなぎ直す

  python pipeline/fetch_sfx.py                    # まず取得（短いものは短いまま、頭と終わりがフェードしている）
  python episodes/006-alcatraz/loop_beds_006.py   # 短いものを、つなぎ目を1秒ずつ重ねて30秒に

Remotion は環境音を loop で鳴らすので、5.8秒の音だと頭と終わりのフェード（0.5秒）が約6秒ごとに「すっと消えて戻る」に聞こえる。
元の mp3（assets/sfx/_src/）から、つなぎ目を1秒の等パワーのクロスフェードで重ねて30秒にし、fetch_sfx.py と同じそろえ方（-18 LUFS、頭と終わり0.5秒のフェード）で書き直す。
共有の fetch_sfx.py は変えない（この回の中で足す）
"""
import sys
from pathlib import Path

import numpy as np
import pyloudnorm as pyln
import soundfile as sf
import yaml

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "pipeline"))
from common import decode_audio  # noqa: E402

SR = 48000
TARGET = 30.0
XF = 1.0
NAMES = ["amb_boat_1", "amb_cell_1"]  # 20秒を超えるものは、1カット（10秒まで）の間にループしないのでそのまま


def loop_to(a: np.ndarray, sec: float) -> np.ndarray:
    n, xf = int(sec * SR), int(XF * SR)
    t = np.linspace(0, np.pi / 2, xf)
    fin, fout = np.sin(t), np.cos(t)
    out = a.copy()
    while len(out) < n:
        out = np.concatenate([out[:-xf], out[-xf:] * fout + a[:xf] * fin, a[xf:]])
    return out[:n]


def main():
    cfg = yaml.safe_load((ROOT / "config" / "sfx_sources.yaml").read_text(encoding="utf-8"))["files"]
    for name in NAMES:
        f = cfg[name]
        x = np.array(decode_audio(ROOT / "assets" / "sfx" / "_src" / f"mixkit_{f['id']}.mp3", SR), dtype=np.float32)
        x = x[int(f.get("start", 0) * SR):]
        if len(x) / SR >= TARGET:
            continue
        # 元の音の頭と終わりの0.1秒は、録音のフェードで小さいことがあるので落とす
        x = x[int(0.1 * SR): len(x) - int(0.1 * SR)]
        y = loop_to(x, TARGET)
        y = y * 10 ** ((-18 - pyln.Meter(SR).integrated_loudness(y)) / 20)
        k = int(0.5 * SR)
        y[:k] *= np.linspace(0, 1, k)
        y[-k:] *= np.linspace(1, 0, k)
        p = np.abs(y).max()
        if p > 0.89:
            y *= 0.89 / p
        sf.write(ROOT / "assets" / "sfx" / f"{name}.wav", y.astype(np.float32), SR, subtype="PCM_16")
        print(f"{name}.wav  {len(x) / SR:.1f}秒 → {len(y) / SR:.0f}秒（つなぎ目 {XF}秒）")


if __name__ == "__main__":
    main()
