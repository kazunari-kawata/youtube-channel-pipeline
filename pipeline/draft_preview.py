"""声なしの仮編集を Remotion に配る（仮の尺で、BGM と効果音つき）

  python pipeline/draft_preview.py 009-gardner

自動で進める回（automation/）の確認用。003 の stage_draft.py（2026-11-25）を、どの回でも使えるようにしたもの。
声（ElevenLabs）は人の確認のあとに作るので、ここでは見積もりの尺（estimate_timeline.py）で並べる。
stage.py --draft は声がまだない仮の尺では BGM も効果音も入れない（曲の長さを声に合わせるため）。
ここでは仮の尺の長さで BGM を作り、香盤表の効果音を配る（BGM なしで見せない：F-005、F-031）。

やること
  1. 仮の尺と香盤表を作り直す（estimate_timeline.py、shotlist.py）
  2. assets/sfx/ に足りない効果音があれば fetch_sfx.py で取る（クラウドからは取れないことがある。そのときは効果音なし）
  3. remotion/src/data/timeline.json と current.json をこの回にする（Studio の Main がこの回になる）
  4. episode.yaml の bgm.tracks をつないだ BGM を remotion/public/bgm.wav に置く（曲が無い PC では BGM なし）

  python pipeline/draft_preview.py 003-db-cooper --scene-only   # 場面の確認（Scene-Check、Figure-Check）だけできるようにする

--scene-only：Remotion は src/data/current.json の回を読み込めないと、どの画面（Scene-Check を含む）も描けない。
クラウドの新しいセッションには current.json がないので、登録済みの回の仮の尺だけを置く（香盤表・BGM・効果音・資料の確認はしない）。
automation/setup.sh --render が、current.json がないときに 003 で実行する。

Studio を開いたまま実行しない（F-033。bgm.wav を書いている途中を Studio が読む）。
本番の声（build/narration.wav）がある回では使わない（見積もりの尺で build/timeline.json を上書きしてしまう）。
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import stage  # noqa: E402
from common import PUBLIC, ROOT, SRC_DATA, build_dir, load_config, write_json  # noqa: E402


def run(*args: str, check: bool = True) -> int:
    return subprocess.run([sys.executable, *args], cwd=ROOT, check=check).returncode


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("episode")
    ap.add_argument("--no-sfx-fetch", action="store_true", help="効果音を取りに行かない")
    ap.add_argument("--scene-only", action="store_true", help="場面の確認用に、仮の尺と current.json だけを置く")
    a = ap.parse_args()
    ep = a.episode
    out = build_dir(ep)
    if a.scene_only:
        run("pipeline/estimate_timeline.py", ep)
        stage.stage_terrain(load_config(ep))
        stage.stage_timeline(ep, out)
        au = load_config(ep)["audio"]
        write_json(SRC_DATA / "current.json", {"episode": ep, "bgm": False, "sfx": [],
                                               "mix": {"bgmSpeech": au["bgm_gain_speech"], "bgmGap": au["bgm_gain_gap"], "duckFrames": au["bgm_duck_frames"]}})
        print(f"場面の確認用に {ep} の仮の尺を置きました（Main は資料がないと描けない。Scene-Check・Figure-Check は描ける）")
        return
    if (out / "narration.wav").exists() or (out / "segments").exists():
        sys.exit(f"本番の声（build/narration.wav）があります。仮編集ではなく python pipeline/stage.py {ep} --draft を使ってください")
    run("pipeline/estimate_timeline.py", ep)
    run("pipeline/shotlist.py", ep)

    cfg = load_config(ep)
    cues_file = out / "sfx_cues.json"
    cues = json.loads(cues_file.read_text(encoding="utf-8"))["cues"] if cues_file.exists() else []
    sfx_src = ROOT / "assets" / "sfx"
    if not a.no_sfx_fetch and any(not (sfx_src / c["file"]).exists() for c in cues):
        if run("pipeline/fetch_sfx.py", check=False) != 0:
            print("注意: 効果音を取れませんでした（あるものだけ配ります）")

    stage.stage_terrain(cfg)
    stage.check_public(ep)
    tl = stage.stage_timeline(ep, out)

    bgm = False
    tracks = [ROOT / p for p in (cfg.get("bgm") or {}).get("tracks", [])]
    missing = [str(t.relative_to(ROOT)) for t in tracks if not t.exists()]
    if tracks and not missing:
        stage.write_wav(PUBLIC / "bgm.wav", stage.bgm_bed(tracks, tl["totalSeconds"], cfg["audio"]["bgm_lufs"]), out)
        bgm = True
    else:
        print(f"注意: BGM なしで準備しました（episode.yaml の bgm.tracks：{missing or 'なし'}。曲は assets/bgm/ にあり、Git に入らない）")
    au = cfg["audio"]
    sfx = stage.stage_sfx(ep, out, cfg)
    write_json(SRC_DATA / "current.json", {
        "episode": ep,
        "bgm": bgm,
        "sfx": sfx,
        "mix": {"bgmSpeech": au["bgm_gain_speech"], "bgmGap": au["bgm_gain_gap"], "duckFrames": au["bgm_duck_frames"]},
    })
    fps = cfg["video"]["fps"]
    write_json(out / "draft_info.json", {"episode": ep, "seconds": tl["totalSeconds"], "frames": int(round(tl["totalSeconds"] * fps)),
                                         "fps": fps, "bgm": bgm, "sfx": len(sfx)})
    print(f"仮編集の準備完了: {ep}（仮の尺 {tl['totalSeconds']:.1f}秒、声なし、{'BGM・' if bgm else 'BGMなし・'}効果音 {len(sfx)}回）")
    print("Remotion Studio：cd remotion && npx remotion studio → Main")


if __name__ == "__main__":
    main()
