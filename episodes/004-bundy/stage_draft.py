"""004 テッド・バンディ：声なしの仮編集を Remotion Studio で見る準備（映像・BGM・効果音）

  python episodes/004-bundy/stage_draft.py

2026-11-28 のユーザーの指示：「004と006は同時進行で…ナレーション以外のBGMと、3Dモデルを使ったイメージ映像とBGMと効果音を足したところまで」。
006 の stage_draft.py と同じやり方（共有の stage.py は変えない）。仮の尺は estimate_timeline.py の見積もり（声を作ると変わる）。

やること
  1. 仮の尺・香盤表・読みやすい台本を作り直す（shotlist_004.py：この回の場面に環境音を割り当ててから共有の pipeline を呼ぶ）
  2. assets/sfx/ に足りない効果音があれば fetch_sfx.py で取る（004 の環境音は既存の amb_road・amb_office・amb_street・amb_room）
  3. 資料の切り出しと、判決文の引用の組版を作る（prepare_materials_004.py。届いていない写真は「素材待ち」の仮の絵）
  4. remotion/src/data/timeline.json と current.json を 004 にする（Studio の Main が 004 になる）
  5. episode.yaml の bgm.tracks をつないだ BGM を remotion/public/bgm.wav に置く

Studio を開いたまま音のファイルを上書きしない（F-033）。stage.write_wav は中身が同じなら触らず、違うときは書き終えてから差し替える。
別の回に戻すときは：python pipeline/stage.py <回> --draft
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "pipeline"))
import stage  # noqa: E402
from common import PUBLIC, SRC_DATA, build_dir, load_config, write_json  # noqa: E402

EP = "004-bundy"
HERE = ROOT / "episodes" / EP


def run(*args: str) -> None:
    subprocess.run([sys.executable, *args], cwd=ROOT, check=True)


def main() -> None:
    # 本番の声ができたら、この仮編集は使わない（見積もりの尺で build/timeline.json を上書きしてしまう）
    b = build_dir(EP)
    if (b / "narration.wav").exists() or (b / "segments").exists():
        sys.exit(f"本番の声（build/narration.wav）があります。仮編集ではなく python pipeline/stage.py {EP} --draft を使ってください")
    run(str(HERE / "shotlist_004.py"))
    # Windows の作業フォルダでは、香盤表を回すと shotlist.md・script.md が書き換わって次の pull が止まる（003 と同じ）
    subprocess.run(["git", "-c", "safe.directory=*", "checkout", "--", f"episodes/{EP}/shotlist.md", f"episodes/{EP}/script.md"], cwd=ROOT)

    cfg = load_config(EP)
    sfx_src = ROOT / "assets" / "sfx"
    cues = json.loads((b / "sfx_cues.json").read_text(encoding="utf-8"))["cues"]
    if any(not (sfx_src / c["file"]).exists() for c in cues):
        run("pipeline/fetch_sfx.py")
    run(str(HERE / "prepare_materials_004.py"))

    stage.stage_terrain(cfg)
    stage.check_public(EP)
    tl = stage.stage_timeline(EP, b)

    bgm = False
    tracks = [ROOT / p for p in (cfg.get("bgm") or {}).get("tracks", [])]
    missing = [str(t.relative_to(ROOT)) for t in tracks if not t.exists()]
    if tracks and not missing:
        stage.write_wav(PUBLIC / "bgm.wav", stage.bgm_bed(tracks, tl["totalSeconds"], cfg["audio"]["bgm_lufs"]), b)
        bgm = True
    else:
        print(f"注意: BGM なしで準備しました（episode.yaml の bgm.tracks：{missing or 'なし'}）")
    a = cfg["audio"]
    write_json(SRC_DATA / "current.json", {
        "episode": EP,
        "bgm": bgm,
        "sfx": stage.stage_sfx(EP, b, cfg),
        "mix": {"bgmSpeech": a["bgm_gain_speech"], "bgmGap": a["bgm_gain_gap"], "duckFrames": a["bgm_duck_frames"]},
    })
    print(f"仮編集の準備完了: {EP}（仮の尺 {tl['totalSeconds']:.1f}秒、声なし、{'BGM・' if bgm else ''}効果音あり）")
    print("Remotion Studio：cd remotion && npx remotion studio → Main")


if __name__ == "__main__":
    main()
