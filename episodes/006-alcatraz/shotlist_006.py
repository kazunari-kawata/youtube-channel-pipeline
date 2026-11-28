"""006 の仮の尺・香盤表・読みやすい台本を作る（この回の環境音を足してから、共有の pipeline を呼ぶ）

2026-11-27：ユーザーが撮った映像は本編に使わないと決めた（F-057）。台本に video はもうない。
video を扱う部分は、ほかの回で実写を使うときのために残してある

  python episodes/006-alcatraz/make_narration.py episodes/006-alcatraz/narration.json
  python episodes/006-alcatraz/shotlist_006.py        # 見積もり → 香盤表（注意0件にする）→ script.md

共有の pipeline/shotlist.py・script_md.py・config/sfx.yaml は、まだ実写映像（video）とこの回の環境音を知らない。
共有ファイルを変えるときは先にユーザーに伝える決まりなので、この回の中で足してから呼ぶ（共有ファイルは1行も変えない）。
ユーザーのOKが出たら、下の KIND・SOUNDS・RULES を pipeline と config/sfx.yaml に移して、このファイルは消す。

video の書き方（narration.json の visual）
  {"kind": "video", "src": "own_0006_bay_a", "clip": "0006 3:46〜3:54", "len": 8, "where": "ext",
   "label": "2026年8月撮影", "note": "灰色の湾の向こうの島"}
  src    切り出したあとの名前（1カット＝1つ。同じカットは2回まで：F-021）
  clip   元の映像の番号と時刻（footage.md）
  len    使える長さ（秒）。これより長く出そうとすると注意を出す
  where  ext（外＝湾の環境音）／int（房棟の中＝建物の響き）。効果音の既定を決める
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "pipeline"))

import estimate_timeline  # noqa: E402
import script_md  # noqa: E402
import shotlist  # noqa: E402

EP = "006-alcatraz"

# ---- 実写映像（video）を画面の種類に足す ----
shotlist.KIND_JA["video"] = "実写映像"
script_md.KIND_JA["video"] = "実写映像"

# ---- この回の環境音（2026-11-28 に Mixkit から取得：config/sfx_sources.yaml と assets/sfx/LICENSES.md。短いループは loop_beds_006.py で30秒に）----
SOUNDS = {
    "amb_bay":       {"ja": "湾の環境音（波と風。人の声・船内放送は入れない）", "level": "bed", "variants": 1, "search": "bay waves wind ambience"},
    "amb_cellhouse": {"ja": "広い房棟の中の響き（遠い金属のきしみ、空調。人の声は入れない）", "level": "bed", "variants": 1, "search": "large empty hall room tone metal creak"},
    "amb_cell":      {"ja": "夜の房の静けさ（遠い足音、水道管の音。人の声は入れない）", "level": "bed", "variants": 1, "search": "prison cell night quiet distant footsteps pipes"},
    "amb_shore":     {"ja": "夜の岩場の波（暗い岸。人の声は入れない）", "level": "bed", "variants": 1, "search": "night rocky shore waves"},
    "amb_beach":     {"ja": "外海の浜の波と風（曇りの午後。人の声は入れない）", "level": "bed", "variants": 1, "search": "ocean beach waves wind overcast"},
    "amb_boat":      {"ja": "小型艇のエンジンの低い音と波（無線の声は入れない）", "level": "bed", "variants": 1, "search": "small patrol boat engine idle water"},
    "amb_hill":      {"ja": "草の斜面の風と、遠い波（人の声・号令は入れない）", "level": "bed", "variants": 1, "search": "grassy hillside wind distant surf"},
    "amb_corridor":  {"ja": "配管の通路の環境音（管の低いうなり、遠いしずく）", "level": "bed", "variants": 1, "search": "utility corridor pipes hum drip"},
}
# イメージ映像の場面（2026-11-27 に remotion/src/inserts/Scenes006a〜d.tsx で作り、registry.ts に登録した）
RULES = {
    "video/ext": [{"key": "amb_bay", "at": 0.0}],
    "video/int": [{"key": "amb_cellhouse", "at": 0.0}],
    "insert/tier_count":   [{"key": "amb_cellhouse", "at": 0.0}],
    "insert/cell_evening": [{"key": "amb_cell", "at": 0.0}],
    "insert/shore_night":  [{"key": "amb_shore", "at": 0.0}],
    "insert/bay_night":    [{"key": "amb_bay", "at": 0.0}],
    "insert/patrol_boat":  [{"key": "amb_boat", "at": 0.0}],
    "insert/beach_day":    [{"key": "amb_beach", "at": 0.0}],
    "insert/angel_search": [{"key": "amb_hill", "at": 0.0}],
    "insert/sf_office":     [{"key": "amb_office", "at": 0.0}],   # 003 で取った事務所の音（遠いタイプライター）をそのまま使う
    "insert/island_far":    [{"key": "amb_bay", "at": 0.0}],
    "insert/island_boat":   [{"key": "amb_bay", "at": 0.0}],
    "insert/cell_front":    [{"key": "amb_cellhouse", "at": 0.0}],
    "insert/cell_vent":     [{"key": "amb_cell", "at": 0.0}],
    "insert/pipe_corridor": [{"key": "amb_corridor", "at": 0.0}],
    "insert/cellhouse":     [{"key": "amb_cellhouse", "at": 0.0}],
}

_load_sfx, _rule_key, _material_key, _status = shotlist.load_sfx, shotlist.rule_key, shotlist.material_key, shotlist.status


def load_sfx():
    lib = _load_sfx()
    for k, v in SOUNDS.items():
        lib["sounds"].setdefault(k, v)
    for k, v in RULES.items():
        lib["rules"].setdefault(k, v)
    return lib


def rule_key(v):
    return f"video/{v.get('where', 'ext')}" if v["kind"] == "video" else _rule_key(v)


def material_key(v):
    return f"video:{v['src']}" if v.get("kind") == "video" else _material_key(v)


def status(ep, v):
    if v["kind"] == "video":
        f = ROOT / "remotion" / "public" / ep.split("-")[0] / f"{v['src']}.mp4"
        return "あり" if f.exists() else "切り出し待ち"
    return _status(ep, v)


shotlist.load_sfx, shotlist.rule_key, shotlist.material_key, shotlist.status = load_sfx, rule_key, material_key, status


def extra_warnings() -> list[str]:
    """実写映像が、使える長さ（len）を超えていないか。再現展示に表示があるか"""
    ep = ROOT / "episodes" / EP
    tl = json.loads((ep / "build" / "timeline.json").read_text(encoding="utf-8"))
    narr = {s["id"]: s for s in json.loads((ep / "narration.json").read_text(encoding="utf-8"))}
    segs = [{**s, "visual": narr[s["id"]].get("visual"), **{k: narr[s["id"]][k] for k in ("cut", "reveal", "reveal_at") if k in narr[s["id"]]}}
            for s in tl["segments"]]
    out, total = [], 0.0
    for sh in shotlist.shots_of(segs):
        v = sh["v"]
        if v["kind"] != "video":
            continue
        total += sh["dur"]
        if sh["dur"] > float(v.get("len", 0)) + 0.05:
            out.append(f"{sh['id']}：実写映像 {v['src']}（{v.get('clip')}）を {sh['dur']}秒出しているが、使える長さは {v.get('len')}秒")
        if "2026年" not in str(v.get("label", "")):
            out.append(f"{sh['id']}：実写映像 {v['src']} の label に撮影年（2026年8月撮影）がない")
    print(f"実写映像の合計 {total:.0f}秒")
    return out


def main():
    for mod in (estimate_timeline, shotlist):
        sys.argv = [mod.__name__, EP]
        mod.main()
    extra = extra_warnings()
    if extra:
        f = ROOT / "episodes" / EP / "shotlist.md"
        f.write_text(f.read_text(encoding="utf-8") + "\n## 注意（実写映像。shotlist_006.py）\n\n" + "\n".join(f"- {w}" for w in extra) + "\n", encoding="utf-8")
        for w in extra:
            print("  注意（実写）:", w)
    print(f"実写映像の注意 {len(extra)}件")
    sys.argv = [script_md.__name__, EP]
    script_md.main()


if __name__ == "__main__":
    main()
