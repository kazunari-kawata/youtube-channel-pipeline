"""素材台帳（episodes/<id>/materials.yaml）にある素材を取ってくる

  python pipeline/fetch_materials.py 002-dahmer          # 未取得のものだけ取得
  python pipeline/fetch_materials.py 002-dahmer --list   # 台帳の一覧と権利の状態だけ表示

置き場所：episodes/<id>/build/materials/（Gitには入らない）
台帳の書き方は episodes/002-dahmer/materials.yaml の冒頭を参照。

取得の種類
  url:   そのままダウンロード（Internet Archive、Wikimedia Commons など）
  naip:  米農務省の航空写真（NAIP、パブリックドメイン）を、緯度経度の周り half_m メートル四方で切り出す
"""
import argparse
import json
import sys
import time
import urllib.request
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).parent))
from common import build_dir, episode_dir  # noqa: E402

UA = "youtube-channel-pipeline/0.1 (+materials)"
PC_API = "https://planetarycomputer.microsoft.com/api"

# 権利の状態。use_ok だけが「動画に使ってよい」
STATUS = {
    "pd_federal": ("使用可", "米連邦政府の著作物（著作権なし）"),
    "pd_no_notice": ("使用可", "1978〜1989年3月に著作権表示なしで公表（米国でパブリックドメイン）"),
    "pd_other": ("使用可", "その他の理由でパブリックドメイン（note に理由）"),
    "cc_by": ("使用可・表示必要", "CC BY / CC BY-SA など。概要欄にクレジット"),
    "fair_use": ("使用可（フェアユース）", "権利者はいるが、ユーザーがフェアユースで使うと判断したもの。解説の文脈で必要な範囲だけ"),
    "own": ("使用可", "自分で作ったもの（地図・図解など）"),
    "check": ("要確認", "権利者・使用条件を確認するまで使わない"),
    "reference": ("参照のみ", "事実確認・台本用。画面には出さない"),
    "unusable": ("使用不可", "使わない（権利・倫理上の理由。note に理由）"),
}


def http_get(url: str, data: dict | None = None):
    req = urllib.request.Request(url, data=json.dumps(data).encode() if data else None,
                                 headers={"User-Agent": UA, "Content-Type": "application/json"})
    return urllib.request.urlopen(req, timeout=300).read()


def fetch_url(url: str, dest: Path) -> None:
    import urllib.error
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    for attempt in range(4):
        try:
            tmp.write_bytes(http_get(url))
            break
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < 3:  # 混んでいるときは待って再試行（Wikimedia など）
                time.sleep(15 * (attempt + 1))
                continue
            raise
    tmp.replace(dest)


def fetch_naip(spec: dict, dest: Path) -> dict:
    import numpy as np
    import rasterio
    from PIL import Image
    from rasterio.merge import merge
    from rasterio.warp import transform_bounds

    lat, lon, half = spec["lat"], spec["lon"], spec.get("half_m", 250)
    dlat = half / 111320
    dlon = half / (111320 * np.cos(np.radians(lat)))
    bbox = [lon - dlon, lat - dlat, lon + dlon, lat + dlat]
    token = json.loads(http_get(f"{PC_API}/sas/v1/token/naip"))["token"]
    feats = json.loads(http_get(f"{PC_API}/stac/v1/search", {"collections": ["naip"], "bbox": bbox, "limit": 50}))["features"]
    feats.sort(key=lambda f: f["properties"]["datetime"], reverse=True)
    srcs = [rasterio.open(f["assets"]["image"]["href"] + "?" + token) for f in feats[:6]]
    arr, _ = merge(srcs, bounds=transform_bounds("EPSG:4326", srcs[0].crs, *bbox), indexes=[1, 2, 3], nodata=0)
    dest.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(np.moveaxis(arr, 0, -1)).save(dest)
    return {"naip_items": [[f["id"], f["properties"]["datetime"][:10]] for f in feats[:6]]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episode")
    ap.add_argument("--list", action="store_true")
    a = ap.parse_args()
    ledger = yaml.safe_load((episode_dir(a.episode) / "materials.yaml").read_text(encoding="utf-8"))
    out = build_dir(a.episode) / "materials"
    counts: dict[str, int] = {}
    for m in ledger["items"]:
        st = m.get("status", "check")
        if st not in STATUS:
            sys.exit(f"{m['id']}: status '{st}' は未定義です（{', '.join(STATUS)}）")
        counts[st] = counts.get(st, 0) + 1
        label = STATUS[st][0]
        if a.list or st == "unusable" or not m.get("file"):
            print(f"[{label}] {m['id']}: {m['title']}")
            continue
        dest = out / m["file"]
        if dest.exists():
            print(f"[{label}] {m['id']}: 取得済み")
            continue
        try:
            if "url" in m:
                fetch_url(m["url"], dest)
            elif "naip" in m:
                info = fetch_naip(m["naip"], dest)
                (dest.with_suffix(".json")).write_text(json.dumps(info, ensure_ascii=False, indent=1), encoding="utf-8")
            else:
                print(f"[{label}] {m['id']}: 取得方法なし（手作業。note を参照）")
                continue
            print(f"[{label}] {m['id']}: 取得 → {dest.relative_to(out)}")
            time.sleep(1)
        except Exception as e:  # noqa: BLE001
            print(f"[{label}] {m['id']}: 失敗 {e}")
    print("\n権利の状態:", ", ".join(f"{STATUS[k][0]}({k}) {v}件" for k, v in counts.items()))


if __name__ == "__main__":
    main()
