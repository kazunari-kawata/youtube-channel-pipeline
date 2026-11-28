"""006 アルカトラズ：サンフランシスコ湾の地図を、実データ（米国勢調査局 TIGER/Line 2024）から作る

  python episodes/006-alcatraz/make_maps_006.py            → remotion/public/006/map_<view>.json
  python episodes/006-alcatraz/make_maps_006.py --preview  → 上に加えて build/maps_preview/<view>.png（確かめ用）

共有の pipeline/make_maps.py は Natural Earth 10m（1:1000万）を使うので、湾の中の島（アルカトラズ、エンジェル島）が描けない。
この回は、郡の形（tl_2024_us_county）から水域（tl_2024_<郡>_areawater：湾・太平洋・湖）を引いて陸地を作る。
どちらも連邦政府のデータで著作権なし。データは data/raw/tiger/（Git に入らない。下の URL から取り直せる）
  https://www2.census.gov/geo/tiger/TIGER2024/COUNTY/tl_2024_us_county.zip
  https://www2.census.gov/geo/tiger/TIGER2024/AREAWATER/tl_2024_<06075|06041|06001|06013|06081>_areawater.zip

出力の形は ep003 の地図と同じ（land は SVG のパス）。足したもの：
  points の kind（"area"：点ではなく範囲で描く、"text"：点を打たず文字だけ）
  areas：範囲の面（包み2つのおよその範囲、捜索の範囲の模式図）。どちらも水の上だけに塗る（陸地と重ねない）
  route_note：矢印（潮の向き）を出すときだけ注記に足す文
地図は北を上に固定し、動かさない（拡大・移動はチラつく。CLAUDE.md）。
"""
import argparse
import json
import math
import sys
import zipfile
from pathlib import Path

import shapefile
import yaml
from shapely.geometry import Point, Polygon, box, shape
from shapely.geometry.polygon import orient
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[2]
EP = Path(__file__).resolve().parent
TIGER = ROOT / "data" / "raw" / "tiger"
OUT = ROOT / "remotion" / "public" / "006"
W, H = 1280, 720
COUNTIES = ["06075", "06041", "06001", "06013", "06081"]  # サンフランシスコ、マリン、アラメダ、コントラコスタ、サンマテオ
SOURCE = "地図：米国勢調査局（TIGER/Line 2024）"


def read_zip_shapes(zpath: Path, keep=lambda rec: True):
    with zipfile.ZipFile(zpath) as z:
        base = next(n[:-4] for n in z.namelist() if n.endswith(".shp"))
        r = shapefile.Reader(shp=z.open(base + ".shp"), shx=z.open(base + ".shx"), dbf=z.open(base + ".dbf"))
        out = []
        for sr in r.iterShapeRecords():
            rec = sr.record.as_dict()
            if keep(rec):
                out.append(shape(sr.shape.__geo_interface__).buffer(0))
        return out


def load_land():
    counties = read_zip_shapes(TIGER / "tl_2024_us_county.zip", keep=lambda r: r["STATEFP"] + r["COUNTYFP"] in COUNTIES)
    water = []
    for c in COUNTIES:
        water += read_zip_shapes(TIGER / f"tl_2024_{c}_areawater.zip")
    return unary_union(counties).difference(unary_union(water))


def projector(view):
    lon0, lon1 = view["lon"]
    lat0, lat1 = view["lat"]
    c = math.cos(math.radians((lat0 + lat1) / 2))
    kx = W / ((lon1 - lon0) * c)
    ky = H / (lat1 - lat0)
    k = min(kx, ky) if view.get("fit") == "contain" else max(kx, ky)
    cx, cy = (lon0 + lon1) / 2, (lat0 + lat1) / 2
    f = lambda lon, lat: (W / 2 + (lon - cx) * c * k, H / 2 - (lat - cy) * k)
    inv = lambda x, y: (cx + (x - W / 2) / (c * k), cy - (y - H / 2) / k)
    return f, inv, c * k


def to_paths(geom, f):
    """面を SVG のパスに。外周と穴の向きを逆にして、塗りの既定（nonzero）で穴が抜けるようにする"""
    geom = transform(lambda x, y, z=None: f(x, y), geom)
    geom = geom.simplify(0.6, preserve_topology=True)
    polys = [geom] if geom.geom_type == "Polygon" else list(getattr(geom, "geoms", []))
    out = []
    for p in polys:
        if p.geom_type != "Polygon" or p.area < 2:
            continue
        p = orient(p, 1.0)
        d = ""
        for ring in [p.exterior, *p.interiors]:
            pts = list(ring.coords)
            d += "M" + "L".join(f"{x:.1f},{y:.1f}" for x, y in pts[:-1]) + "Z"
        out.append(d)
    return out


def area_shape(spec, f_ll):
    """範囲：circle（中心と半径m）か、polygon（緯度経度の並び）"""
    if "polygon" in spec:
        return Polygon([(lon, lat) for lat, lon in spec["polygon"]])
    lat, lon, r = spec["lat"], spec["lon"], spec["radius_m"]
    dlat = r / 111320
    dlon = r / (111320 * math.cos(math.radians(lat)))
    return Polygon([(lon + dlon * math.cos(t), lat + dlat * math.sin(t)) for t in [i * math.pi / 32 for i in range(64)]])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview", action="store_true")
    a = ap.parse_args()
    spec = yaml.safe_load((EP / "maps.yaml").read_text(encoding="utf-8"))
    land = load_land()
    OUT.mkdir(parents=True, exist_ok=True)
    places = spec["places"]
    for name, view in spec["views"].items():
        f, inv, _ = projector(view)
        x0, y1 = inv(-80, H + 80)
        x1, y0 = inv(W + 80, -80)
        vis = box(x0, y1, x1, y0)
        lv = land.intersection(vis)
        water = vis.difference(land)
        pts = {}
        for k, p in places.items():  # 台本が点と矢印を選ぶので、すべての場所を入れておく
            x, y = f(p["lon"], p["lat"])
            pts[k] = {"x": round(x, 1), "y": round(y, 1), "label": p["label"], "kind": p.get("kind", "point")}
        areas = []
        for k in view.get("points", []):
            p = places[k]
            if p.get("kind") == "area":
                g = area_shape(p, f).intersection(water)
                ds = to_paths(g, f)
                bb = transform(lambda x, y, z=None: f(x, y), g).bounds
                areas.append({"key": k, "d": "".join(ds), "label": p["label"], "bbox": [round(v, 1) for v in bb]})
        if "search_area" in view:
            g = area_shape(view["search_area"], f).intersection(water)
            bb = transform(lambda x, y, z=None: f(x, y), g).bounds
            areas.append({"key": "search", "d": "".join(to_paths(g, f)), "label": view["search_area"].get("label", ""), "bbox": [round(v, 1) for v in bb]})
        data = {
            "land": to_paths(lv, f),
            "lakes": [], "countries": [], "states": [],
            "points": pts,
            "labels": [{"x": round(f(l["lon"], l["lat"])[0], 1), "y": round(f(l["lon"], l["lat"])[1], 1), "text": l["text"], "kind": l.get("kind", "area")}
                       for l in view.get("labels", [])],
            "areas": areas,
            "note": view.get("note", ""),
            "route_note": view.get("route_note", ""),
            "source": SOURCE,
        }
        (OUT / f"map_{name}.json").write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        print(f"map_{name}: 陸の面 {len(data['land'])}、点 {len(pts)}、範囲 {len(areas)}（{(OUT / f'map_{name}.json').stat().st_size // 1024}KB）")
        if a.preview:
            preview(name, data)


def preview(name, data):
    """確かめ用の絵（陸・範囲・点だけ。文字は Remotion で描くので出さない）"""
    from PIL import Image, ImageDraw
    import re
    im = Image.new("RGB", (W, H), (19, 32, 58))
    d = ImageDraw.Draw(im)

    def rings(path):
        for sub in re.findall(r"M([^Z]+)Z", path):
            yield [tuple(map(float, p.split(","))) for p in sub.split("L")]

    for p in data["land"]:
        for i, r in enumerate(rings(p)):
            d.polygon(r, fill=(42, 42, 44) if i == 0 else (19, 32, 58))
    for a in data["areas"]:
        for r in rings(a["d"]):
            d.polygon(r, outline=(224, 80, 74))
    for k, p in data["points"].items():
        d.ellipse((p["x"] - 6, p["y"] - 6, p["x"] + 6, p["y"] + 6), fill=(230, 163, 90))
    out = EP / "build" / "maps_preview"
    out.mkdir(parents=True, exist_ok=True)
    im.save(out / f"{name}.png")


if __name__ == "__main__":
    main()
