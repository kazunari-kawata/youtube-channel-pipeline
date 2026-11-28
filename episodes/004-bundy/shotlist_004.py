"""004 の仮の尺・香盤表・読みやすい台本を作る（この回の場面の環境音と、切り出しの名前の見方を足してから、共有の pipeline を呼ぶ）

  python episodes/004-bundy/make_narration.py episodes/004-bundy/narration.json
  python episodes/004-bundy/shotlist_004.py        # 見積もり → 香盤表（注意0件にする）→ script.md

共有の pipeline/shotlist.py・config/sfx.yaml は、この回の新しい場面（remotion/src/inserts/Scenes004.tsx）をまだ知らない。
共有ファイルは変えず、ここで足す（006 の shotlist_006.py と同じやり方）。音は config/sfx.yaml にあるものだけを使う。
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "pipeline"))

import estimate_timeline  # noqa: E402
import script_md  # noqa: E402
import shotlist  # noqa: E402

EP = "004-bundy"

# イメージ映像の場面の環境音（2026-11-28。場面は Scenes004.tsx）
RULES = {
    "insert/campus":     [{"key": "amb_road", "at": 0.0}],     # 大学の中庭（風と虫。人の声は入れない）
    "insert/hotline":    [{"key": "amb_office", "at": 0.0}],   # 電話相談の部屋（呼び出し音・話し声は入れない）
    "insert/campaign":   [{"key": "amb_office", "at": 0.0}],   # 選挙事務所（話し声は入れない）
    "insert/carseat":    [{"key": "amb_road", "at": 0.0}],     # 止めた車の中（外の風と虫）
    "insert/college_street": [{"key": "amb_street", "at": 0.0}],  # 夜の大学町の通り
    "insert/courtroom_fed":  [{"key": "amb_room", "at": 0.0}],    # 1987年の連邦裁判所の法廷
    "insert/lakepark":   [{"key": "amb_road", "at": 0.0}],     # 夏の湖畔の駐車場（人の声は入れない）
    "insert/mall":       [{"key": "amb_street", "at": 0.0}],   # 夜のモールの駐車場
    "insert/courtroom":  [{"key": "amb_room", "at": 0.0}],     # 法廷（静かな室内。人の声は入れない）
    "insert/winterjail": [{"key": "amb_street", "at": 0.0}],   # 雪の町の夜
}

_load_sfx, _status = shotlist.load_sfx, shotlist.status


def load_sfx():
    lib = _load_sfx()
    for k, v in RULES.items():
        lib["rules"].setdefault(k, v)
    return lib


def status(ep, v):
    if v["kind"] in ("doc", "photo") and v.get("focus"):
        # この回の切り出しは <src>__<focus>.jpg（ep004-bundy.tsx の assetName と同じ）
        f = ROOT / "remotion" / "public" / ep.split("-")[0] / f"{v['src']}__{v['focus']}.jpg"
        return "あり" if f.exists() else "切り出し待ち"
    return _status(ep, v)


shotlist.load_sfx, shotlist.status = load_sfx, status


def main():
    for mod in (estimate_timeline, shotlist):
        sys.argv = [mod.__name__, EP]
        mod.main()
    sys.argv = [script_md.__name__, EP]
    script_md.main()


if __name__ == "__main__":
    main()
