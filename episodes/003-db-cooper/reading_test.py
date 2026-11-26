"""003：数字の読み（305便・727）を、全編を作る前に短く試す。本番と同じ作り方（Otani・eleven_v3・声の初期値、
うしろに1文足して無音で切る）で、言い方の違う3案を読ませ、耳で選ぶ。

  python episodes/003-db-cooper/reading_test.py          # 文字数だけ表示（生成しない）
  python episodes/003-db-cooper/reading_test.py --run    # 生成する（約220クレジット）。結果は build/reading_test/*.mp3

ユーザーの希望の読み：ボーイング「ななにーなな」、「さんまるご」便（2026-11-26）。
C 案（カタカナ）は、F-018（数字をひらがなに開かない）の例外になる。選ぶなら CLAUDE.md を書き換える
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "pipeline"))
from common import build_dir, ffmpeg_bin, load_config, require_env  # noqa: E402
from tts_elevenlabs import SR, gen_chunk, show_quota  # noqa: E402

EP = "003-db-cooper"
TAIL = "それでは。"  # うしろに足して切り捨てる文（聞こえない）
CASES = {
    "A_台本のまま": "ノースウエスト・オリエント航空305便。機体はボーイング727です。午後7時36分、305便は再び離陸します。J.C.ペニーの品で、当時の値段は1ドル50セントほど。",
    "B_漢数字": "ノースウエスト・オリエント航空三〇五便。機体はボーイング七二七です。午後7時36分、三〇五便は再び離陸します。",
    "C_カタカナ": "ノースウエスト・オリエント航空サンマルゴ便。機体はボーイング、ナナニーナナです。午後7時36分、サンマルゴ便は再び離陸します。",
}


def main():
    chars = sum(len(v) + len(TAIL) for v in CASES.values())
    print(f"{len(CASES)}案 / {chars}文字（約{chars}クレジット）")
    if "--run" not in sys.argv:
        return
    t = load_config(EP)["tts"]
    key = require_env("ELEVENLABS_API_KEY")
    out = build_dir(EP) / "reading_test"
    out.mkdir(parents=True, exist_ok=True)
    import numpy as np
    import soundfile as sf
    for name, text in CASES.items():
        a, spans, cut, billed, _ = gen_chunk([{"id": name, "caption": text}], TAIL, t, key, out, False)
        s0, s1 = spans[0]
        x = a[int(s0 * SR): int(min(cut, s1 + 0.12) * SR)].copy()
        fo = int(0.08 * SR)
        x[-fo:] *= np.linspace(1, 0, fo, dtype=np.float32) ** 2
        x = x / (np.abs(x).max() + 1e-9) * 0.7
        wav = out / f"{name}.wav"
        sf.write(wav, x.astype(np.float32), SR)
        subprocess.run([ffmpeg_bin(), "-v", "error", "-y", "-i", str(wav), "-b:a", "160k", str(out / f"{name}.mp3")], check=True)
        print(f"{name}：{len(x) / SR:.1f}秒、{'生成' if billed else 'キャッシュ'}（{billed}文字）")
    show_quota(key)


if __name__ == "__main__":
    main()
