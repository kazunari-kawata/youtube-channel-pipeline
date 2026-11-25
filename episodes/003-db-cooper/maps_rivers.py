"""003 D.B.クーパー：地図に川の線を足す（make_maps.py のあとに1回）

  python pipeline/make_maps.py 003-db-cooper
  python episodes/003-db-cooper/maps_rivers.py

Natural Earth には、ルイス川・ワシューガル川が入っていない（この回の話の中心は、ルイス川とコロンビア川に囲まれた一帯）。
米地質調査所（USGS）の National Hydrography Dataset（NHD、米連邦政府の著作物で著作権なし）の川の中心線を取り、
make_maps.py と同じ投影で remotion/public/003/map_<view>.json の rivers に足す。
川の線を描くのは remotion/src/episodes/ep003-map.tsx（共有の MapShot は変えない）。
"""
import json
import math
import sys
import urllib.parse
import urllib.request
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "pipeline"))
from make_maps import proj  # noqa: E402

EP = ROOT / "episodes" / "003-db-cooper"
OUT = ROOT / "remotion" / "public" / "003"
CACHE = ROOT / "data" / "raw" / "nhd" / "003_flowlines.json"
NHD = "https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer/6/query"  # Flowline - Large Scale
NAMES = {"Columbia River": "main", "Lewis River": "trib", "East Fork Lewis River": "trib", "Washougal River": "trib", "Cowlitz River": "trib", "Kalama River": "trib"}
VIEWS = ["flight", "dropzone", "columbia"]  # 川が見分けられる縮尺の地図だけ（pnw、puget は広すぎる・関係が薄い）


def fetch() -> dict:
    if CACHE.exists():
        return json.loads(CACHE.read_text(encoding="utf-8"))
    names = ",".join(f"'{n}'" for n in NAMES)
    q = urllib.parse.urlencode({
        "where": f"gnis_name IN ({names})", "geometry": "-123.9,45.3,-121.4,47.8", "geometryType": "esriGeometryEnvelope",
        "inSR": 4326, "outSR": 4326, "spatialRel": "esriSpatialRelIntersects", "outFields": "gnis_name",
        "returnGeometry": "true", "maxAllowableOffset": 0.002, "f": "json",
    })
    with urllib.request.urlopen(f"{NHD}?{q}", timeout=120) as r:
        d = json.load(r)
    if "error" in d:
        sys.exit(f"NHD の取得に失敗：{d['error']}")
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_text(json.dumps(d), encoding="utf-8")
    return d


def main() -> None:
    views = yaml.safe_load((EP / "maps.yaml").read_text(encoding="utf-8"))["views"]
    feats = fetch()["features"]
    for name in VIEWS:
        f = OUT / f"map_{name}.json"
        if not f.exists():
            sys.exit(f"{f} がありません（先に make_maps.py）")
        view = views[name]
        p = proj(view)
        lon0, lon1 = view["lon"]
        lat0, lat1 = view["lat"]
        mlon, mlat = (lon1 - lon0) * 0.6, (lat1 - lat0) * 0.6
        rivers = []
        for ft in feats:
            nm = ft["attributes"].get("gnis_name")
            for path in ft["geometry"].get("paths", []):
                if not any(lon0 - mlon < x < lon1 + mlon and lat0 - mlat < y < lat1 + mlat for x, y in path):
                    continue
                pts = [p(x, y) for x, y in path]
                d = "M" + "L".join(f"{x:.1f},{y:.1f}" for x, y in pts)
                rivers.append({"d": d, "name": nm, "kind": NAMES.get(nm, "trib")})
        # 同じ川の小さな線は1本の path にまとめる（画面の部品の数を減らす）
        merged: dict = {}
        for r in rivers:
            merged.setdefault((r["name"], r["kind"]), []).append(r["d"])
        rivers = [{"d": "".join(ds), "name": n, "kind": k} for (n, k), ds in merged.items()]
        data = json.loads(f.read_text(encoding="utf-8"))
        data["rivers"] = rivers
        if "USGS" not in data.get("source", ""):
            data["source"] = (data.get("source") or "地図：Natural Earth") + "、川：米地質調査所（USGS NHD）"
        f.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        print(f"map_{name}.json：川の線 {len(rivers)}本")


if __name__ == "__main__":
    main()
