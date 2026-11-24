"""実データの地図（Natural Earth）を、動画の画面座標の SVG パスにして書き出す

  python pipeline/make_maps.py 002-dahmer      → remotion/public/<番号>/map_<view>.json

地図の範囲・地名は episodes/<id>/maps.yaml。陸地・湖・国境・州境は Natural Earth 10m（パブリックドメイン）。
個人宅は地図に出さない（町・市の位置まで。CLAUDE.md）。
"""
import argparse
import json
import math
import sys
from pathlib import Path

import shapefile
import yaml

sys.path.insert(0, str(Path(__file__).parent))
from common import ROOT, episode_dir  # noqa: E402

NE = ROOT / "data" / "raw" / "ne"
W, H = 1280, 720


def proj(view):
    lon0, lon1 = view["lon"]
    lat0, lat1 = view["lat"]
    c = math.cos(math.radians((lat0 + lat1) / 2))
    kx = W / ((lon1 - lon0) * c)
    ky = H / (lat1 - lat0)
    k = min(kx, ky) if view.get("fit") == "contain" else max(kx, ky)  # 既定は画面いっぱい（はみ出す側は切れる）、contain は全体を入れる
    cx, cy = (lon0 + lon1) / 2, (lat0 + lat1) / 2

    def f(lon, lat):
        return (W / 2 + (lon - cx) * c * k, H / 2 - (lat - cy) * k)
    return f


def paths(shp: Path, view, keep=lambda rec: True, closed=True):
    f = proj(view)
    lon0, lon1 = view["lon"]
    lat0, lat1 = view["lat"]
    pad = 2.0
    out = []
    r = shapefile.Reader(str(shp), encoding="utf-8", encodingErrors="replace")
    for sr in r.iterShapeRecords():
        b = sr.shape.bbox
        if b[2] < lon0 - pad or b[0] > lon1 + pad or b[3] < lat0 - pad or b[1] > lat1 + pad:
            continue
        if not keep(sr.record.as_dict()):
            continue
        pts, parts = sr.shape.points, list(sr.shape.parts) + [len(sr.shape.points)]
        d = []
        for i in range(len(parts) - 1):
            ring = pts[parts[i]:parts[i + 1]]
            xs = [f(x, y) for x, y in ring]
            # 画面と重ならない輪は捨てる（画面をすっぽり囲む大陸の輪は残す）
            bx0, bx1 = min(p[0] for p in xs), max(p[0] for p in xs)
            by0, by1 = min(p[1] for p in xs), max(p[1] for p in xs)
            if bx1 < -50 or bx0 > W + 50 or by1 < -50 or by0 > H + 50:
                continue
            # 1.5px より細かい点は間引く（画面外は粗く）
            keep_pts = [xs[0]]
            for p in xs[1:]:
                far = p[0] < -100 or p[0] > W + 100 or p[1] < -100 or p[1] > H + 100
                if abs(p[0] - keep_pts[-1][0]) + abs(p[1] - keep_pts[-1][1]) > (40 if far else 1.5):
                    keep_pts.append(p)
            if len(keep_pts) < 3:
                continue
            d.append("M" + "L".join(f"{p[0]:.0f},{p[1]:.0f}" for p in keep_pts) + ("Z" if closed else ""))
        if d:
            out.append({"d": "".join(d), "name": sr.record.as_dict().get("name", "")})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episode")
    a = ap.parse_args()
    spec = yaml.safe_load((episode_dir(a.episode) / "maps.yaml").read_text(encoding="utf-8"))
    out_dir = ROOT / "remotion" / "public" / a.episode.split("-")[0]
    out_dir.mkdir(parents=True, exist_ok=True)
    places = spec["places"]
    for name, view in spec["views"].items():
        f = proj(view)
        hl = set(view.get("highlight", []))
        data = {
            "land": [p["d"] for p in paths(NE / "ne_10m_land.shp", view)],
            "lakes": [p["d"] for p in paths(NE / "ne_10m_lakes.shp", view, keep=lambda r: (9 if r.get("scalerank") is None else r["scalerank"]) <= view.get("lake_rank", 3))],
            "countries": [p["d"] for p in paths(NE / "ne_10m_admin_0_countries.shp", view)] if view.get("countries") else [],
            "states": [{"d": p["d"], "hl": p["name"] in hl} for p in
                       paths(NE / "ne_10m_admin_1_states_provinces.shp", view, keep=lambda r: r.get("adm0_a3") == "USA")] if view.get("states") else [],
            "points": {k: {"x": round(f(places[k]["lon"], places[k]["lat"])[0], 1), "y": round(f(places[k]["lon"], places[k]["lat"])[1], 1),
                           "label": places[k]["label"]} for k in view.get("points", [])},
            "labels": [{"x": round(f(l["lon"], l["lat"])[0], 1), "y": round(f(l["lon"], l["lat"])[1], 1), "text": l["text"], "kind": l.get("kind", "area")}
                       for l in view.get("labels", [])],
            "note": view.get("note", ""),
            "source": "地図：Natural Earth",
        }
        (out_dir / f"map_{name}.json").write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        size = (out_dir / f"map_{name}.json").stat().st_size
        print(f"map_{name}: 陸{len(data['land'])} 湖{len(data['lakes'])} 国{len(data['countries'])} 州{len(data['states'])} 点{len(data['points'])}（{size // 1024}KB）")


if __name__ == "__main__":
    main()
