"""003 D.B.クーパー：声なしの仮編集を Remotion Studio で見る準備（BGM と効果音あり）

  python episodes/003-db-cooper/stage_draft.py

2026-11-25 のユーザーの指示：声（ElevenLabs）はまだ作らず、映像と BGM・効果音だけを先に見る。
pipeline/stage.py --draft は、声がまだない仮の尺では BGM も効果音も入れない（曲の長さを声に合わせるため）。
この回だけの準備として、仮の尺（build/timeline.json。estimate_timeline.py の見積もり）の長さで BGM を作り、
香盤表の効果音（build/sfx_cues.json）を配る。共有の stage.py は変えない。

やること
  1. 仮の尺と香盤表を作り直す（estimate_timeline.py、shotlist.py）
  2. assets/sfx/ に足りない効果音があれば fetch_sfx.py で取る
  3. remotion/src/data/timeline.json と current.json を 003 にする（Studio の Main が 003 になる）
  4. episode.yaml の bgm.tracks をつないだ BGM を remotion/public/bgm.wav に置く

002 に戻すときは：python pipeline/stage.py 002-dahmer --draft
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "pipeline"))
import stage  # noqa: E402
from common import PUBLIC, SRC_DATA, build_dir, load_config, write_json  # noqa: E402

EP = "003-db-cooper"


def run(*args: str) -> None:
    subprocess.run([sys.executable, *args], cwd=ROOT, check=True)


def main() -> None:
    run("pipeline/estimate_timeline.py", EP)
    run("pipeline/shotlist.py", EP)
    # Windows の作業フォルダでは、香盤表を回すと shotlist.md が書き換わって次の pull が止まる（引き継ぎのメモ）
    subprocess.run(["git", "-c", "safe.directory=*", "checkout", "--", f"episodes/{EP}/shotlist.md"], cwd=ROOT)

    cfg = load_config(EP)
    out = build_dir(EP)
    sfx_src = ROOT / "assets" / "sfx"
    import json
    cues = json.loads((out / "sfx_cues.json").read_text(encoding="utf-8"))["cues"]
    if any(not (sfx_src / c["file"]).exists() for c in cues):
        run("pipeline/fetch_sfx.py")

    stage.stage_terrain(cfg)
    stage.check_public(EP)
    tl = stage.stage_timeline(EP, out)

    bgm = False
    tracks = [ROOT / p for p in (cfg.get("bgm") or {}).get("tracks", [])]
    missing = [str(t.relative_to(ROOT)) for t in tracks if not t.exists()]
    if tracks and not missing:
        stage.write_wav(PUBLIC / "bgm.wav", stage.bgm_bed(tracks, tl["totalSeconds"], cfg["audio"]["bgm_lufs"]), out)
        bgm = True
    else:
        print(f"注意: BGM なしで準備しました（episode.yaml の bgm.tracks：{missing or 'なし'}）")
    a = cfg["audio"]
    write_json(SRC_DATA / "current.json", {
        "episode": EP,
        "bgm": bgm,
        "sfx": stage.stage_sfx(EP, out, cfg),
        "mix": {"bgmSpeech": a["bgm_gain_speech"], "bgmGap": a["bgm_gain_gap"], "duckFrames": a["bgm_duck_frames"]},
    })
    print(f"仮編集の準備完了: {EP}（仮の尺 {tl['totalSeconds']:.1f}秒、声なし、{'BGM・' if bgm else ''}効果音あり）")
    print("Remotion Studio：cd remotion && npx remotion studio → Main")


if __name__ == "__main__":
    main()
