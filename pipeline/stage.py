"""書き出し前の準備：その回の素材を Remotion に配る

  python pipeline/stage.py 001-plains

やること
  data/processed/ の地形・夜景テクスチャ → remotion/public/（地形を使う回だけ。episode.yaml の terrain: true）
  episodes/<id>/build/narration.wav, timeline.json → remotion/public/, remotion/src/data/
  episode.yaml の bgm.tracks をつないで動画の長さに合わせ、音量をそろえたBGM → remotion/public/bgm.wav
  どの回を書き出すか・音量の設定 → remotion/src/data/current.json
"""
import argparse
import shutil
import sys
from pathlib import Path

import numpy as np
import pyloudnorm as pyln
import soundfile as sf

sys.path.insert(0, str(Path(__file__).parent))
from common import (load_narration, DATA_PROCESSED, PUBLIC, ROOT, SRC_DATA, build_dir, decode_audio,  # noqa: E402
                    load_config, write_json)
import json  # noqa: E402

SR = 48000
DEFAULT_META = ROOT / "remotion" / "src" / "defaults" / "meta.json"


def stage_terrain(cfg: dict) -> None:
    """地形を使う回は data/processed/ を配る。使わない回も geo.ts が meta.json を読むので、無ければ既定を置く"""
    SRC_DATA.mkdir(parents=True, exist_ok=True)
    if cfg.get("terrain"):
        if not (DATA_PROCESSED / "meta.json").exists():
            sys.exit("data/processed/ が空です。先に fetch_data.py と process_geo.py を実行してください。")
        PUBLIC.mkdir(parents=True, exist_ok=True)
        for f in DATA_PROCESSED.iterdir():
            if f.suffix in (".png", ".bin"):
                shutil.copy2(f, PUBLIC / f.name)
        shutil.copy2(DATA_PROCESSED / "meta.json", SRC_DATA / "meta.json")
    elif not (SRC_DATA / "meta.json").exists():
        shutil.copy2(DEFAULT_META, SRC_DATA / "meta.json")


# 画面の指定は台本（narration.json）が正本。声の尺（timeline.json）は時刻だけを使う
SCREEN_KEYS = ("caption", "visual", "sfx", "reveal", "reveal_at", "cut", "chapter", "stat")


def stage_timeline(ep: str, out: Path) -> dict:
    """声の尺に、今の台本の画面指定を重ねて remotion/src/data/timeline.json に書く"""
    tl = json.loads((out / "timeline.json").read_text(encoding="utf-8"))
    narr = {s["id"]: s for s in load_narration(ep)}
    missing = [s["id"] for s in tl["segments"] if s["id"] not in narr]
    if missing or len(narr) != len(tl["segments"]):
        sys.exit(f"台本と声の区間が合いません（声を作り直す）: 声だけ {missing[:5]}、台本 {len(narr)} 区間 / 声 {len(tl['segments'])} 区間")
    for s in tl["segments"]:
        for k in SCREEN_KEYS:
            s.pop(k, None)
            if k in narr[s["id"]]:
                s[k] = narr[s["id"]][k]
    SRC_DATA.mkdir(parents=True, exist_ok=True)
    write_json(SRC_DATA / "timeline.json", tl)
    return tl


def check_public(ep: str) -> None:
    """書き出しに要る remotion/public/ のファイル（Gitに入らない）がそろっているか"""
    need = [PUBLIC / "fonts" / "NotoSansJP.ttf", PUBLIC / "figures" / "mannequin.glb"]
    num = ep.split("-")[0]
    if (PUBLIC / num).exists() or (ROOT / "episodes" / ep / "cuts.yaml").exists():
        need.append(PUBLIC / num)
    missing = [str(p.relative_to(ROOT)) for p in need if not p.exists()]
    if missing:
        sys.exit("remotion/public/ に足りないものがあります: " + ", ".join(missing)
                 + "（フォントは fetch_data.py、資料と地図は cut_materials.py と make_maps.py で作る）")


def bgm_bed(tracks: list[Path], seconds: float, lufs: float, xfade: float = 3.0, fade_out: float = 4.0) -> np.ndarray:
    """曲をクロスフェードでつなぎ、足りなければ繰り返して、動画の長さちょうどにする"""
    clips = [decode_audio(t, SR, 2) for t in tracks]
    meter = pyln.Meter(SR)
    # 曲ごとの音量差をなくしてからつなぐ
    clips = [c * 10 ** ((lufs - meter.integrated_loudness(c)) / 20) for c in clips]
    need = int(seconds * SR)
    n_x = int(xfade * SR)
    bed = clips[0].copy()
    i = 1
    while len(bed) < need:
        nxt = clips[i % len(clips)]
        ramp = np.linspace(0, 1, n_x, dtype=np.float32)[:, None]
        bed[-n_x:] = bed[-n_x:] * (1 - ramp) + nxt[:n_x] * ramp
        bed = np.concatenate([bed, nxt[n_x:]])
        i += 1
    bed = bed[:need]
    n_f = int(fade_out * SR)
    bed[-n_f:] *= np.linspace(1, 0, n_f, dtype=np.float32)[:, None]
    peak = np.abs(bed).max()
    if peak > 0.89:
        bed *= 0.89 / peak
    return bed.astype(np.float32)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episode")
    ap.add_argument("--draft", action="store_true",
                    help="BGMなしの確認用（Remotion Studio で見る）。声を作ってあれば声あり、まだなら仮の尺で声なし。書き出し・公開には使わない")
    args = ap.parse_args()
    cfg = load_config(args.episode)
    out = build_dir(args.episode)

    stage_terrain(cfg)
    check_public(args.episode)
    if args.draft:
        tl = stage_timeline(args.episode, out)
        voice = not tl.get("estimated") and (out / "narration.wav").exists()
        if voice:
            PUBLIC.mkdir(parents=True, exist_ok=True)
            shutil.copy2(out / "narration.wav", PUBLIC / "narration.wav")
        a = cfg["audio"]
        write_json(SRC_DATA / "current.json", {
            "episode": args.episode,
            "bgm": False,  # 確認用は BGM を鳴らさない（public/ に前の bgm.wav が残っていても）
            "mix": {"bgmSpeech": a["bgm_gain_speech"], "bgmGap": a["bgm_gain_gap"], "duckFrames": a["bgm_duck_frames"]},
        })
        kind = "仮の尺（声なし）" if tl.get("estimated") else ("声あり・BGMなし" if voice else "声の尺（声のファイルなし）")
        print(f"仮編集の準備完了: {args.episode}（{tl['totalSeconds']:.1f}秒、{kind}）")
        return

    for f in ("narration.wav", "timeline.json"):
        if not (out / f).exists():
            sys.exit(f"{out / f} がありません。先に tts_elevenlabs.py を実行してください。")
    PUBLIC.mkdir(parents=True, exist_ok=True)
    shutil.copy2(out / "narration.wav", PUBLIC / "narration.wav")
    tl = stage_timeline(args.episode, out)

    tracks = [ROOT / p for p in (cfg.get("bgm") or {}).get("tracks", [])]
    if not tracks:
        sys.exit("episode.yaml の bgm.tracks が空です。assets/bgm/ の曲を指定してください（BGMなしは不可：F-005）。")
    missing = [str(t) for t in tracks if not t.exists()]
    if missing:
        sys.exit(f"BGMファイルがありません: {missing}")
    bed = bgm_bed(tracks, tl["totalSeconds"], cfg["audio"]["bgm_lufs"])
    sf.write(PUBLIC / "bgm.wav", bed, SR, subtype="PCM_16")

    a = cfg["audio"]
    write_json(SRC_DATA / "current.json", {
        "episode": args.episode,
        "bgm": True,
        "mix": {"bgmSpeech": a["bgm_gain_speech"], "bgmGap": a["bgm_gain_gap"], "duckFrames": a["bgm_duck_frames"]},
    })
    print(f"準備完了: {args.episode}（{tl['totalSeconds']:.1f}秒, BGM {len(tracks)}曲）")


if __name__ == "__main__":
    main()
