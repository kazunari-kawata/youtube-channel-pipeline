"""
地理データ → 動画用テクスチャ/高さデータ変換スクリプト

  python pipeline/process_geo.py

入力（data/raw/、pipeline/fetch_data.py で取得）:
  glo90/*.tif  Copernicus DEM GLO-90（日本全体）
  glo30/*.tif  Copernicus DEM GLO-30（関東）
  bm/*.png     NASA Black Marble 2016（GIBS WMTS 500m, level 7タイル）

出力（data/processed/。pipeline/stage.py が Remotion に配る）:
  {region}_day.png     陰影付き段彩（昼の地形）
  {region}_night.png   夜の光
  {region}_h8.png      低標高用の高さテクスチャ（R=整数m+10, G=小数, -10〜245m）
  {region}_mesh.bin    メッシュ用の標高（Float32, 海=-9999）
  meta.json            範囲・解像度・統計
"""
import glob, json, os, sys
from pathlib import Path
import numpy as np
import rasterio
from rasterio.merge import merge
from rasterio.enums import Resampling
from rasterio.transform import from_origin
from rasterio.warp import reproject
from PIL import Image
from scipy.ndimage import gaussian_filter

sys.path.insert(0, str(Path(__file__).parent))
from common import DATA_PROCESSED, DATA_RAW  # noqa: E402

RAW = str(DATA_RAW)
OUT = str(DATA_PROCESSED)
os.makedirs(OUT, exist_ok=True)

# 夜景の階調（日本全体は明るめ、関東は飽和を避けて暗め）と、関東のぼかし（500m画素のカクカクを消す）
NIGHT_GAMMA = {"japan": 0.8, "kanto": 1.35}
NIGHT_BLUR = {"kanto": 2.2}

REGIONS = {
    # name: (west, south, east, north, tex_w, mesh_w, dem_dir)
    "japan": (128.6, 30.8, 146.0, 45.6, 1800, 600, "glo90"),
    "kanto": (138.7, 34.9, 140.95, 36.6, 1800, 640, "glo30"),
}

def size_for(w, s, e, n, width):
    """経度方向の幅から、km比率を保った高さを決める"""
    latc = np.deg2rad((s + n) / 2)
    kx = (e - w) * 111.32 * np.cos(latc)
    ky = (n - s) * 111.32
    height = int(round(width * ky / kx))
    return width, height, kx, ky

def load_dem(dem_dir, bounds, w, h):
    files = sorted(glob.glob(f"{RAW}/{dem_dir}/*.tif"))
    srcs = [rasterio.open(f) for f in files]
    west, south, east, north = bounds
    res = ((east - west) / w, (north - south) / h)
    arr, tr = merge(srcs, bounds=bounds, res=res, nodata=-9999,
                    resampling=Resampling.average)
    for s in srcs:
        s.close()
    dem = arr[0].astype(np.float32)
    dem = dem[:h, :w]
    return dem

def load_blackmarble(bounds, w, h):
    tiles = glob.glob(f"{RAW}/bm/bm_*.png")
    rows = sorted({int(os.path.basename(t).split("_")[1]) for t in tiles})
    cols = sorted({int(os.path.basename(t).split("_")[2].split(".")[0]) for t in tiles})
    T = 512
    mosaic = np.zeros((len(rows) * T, len(cols) * T, 3), np.uint8)
    for t in tiles:
        r = int(os.path.basename(t).split("_")[1]); c = int(os.path.basename(t).split("_")[2].split(".")[0])
        im = np.array(Image.open(t).convert("RGB"))
        mosaic[(r - rows[0]) * T:(r - rows[0] + 1) * T, (c - cols[0]) * T:(c - cols[0] + 1) * T] = im
    deg = 2.25 / T
    src_tr = from_origin(-180 + cols[0] * 2.25, 90 - rows[0] * 2.25, deg, deg)
    west, south, east, north = bounds
    dst_tr = from_origin(west, north, (east - west) / w, (north - south) / h)
    out = np.zeros((3, h, w), np.uint8)
    for b in range(3):
        reproject(mosaic[:, :, b], out[b], src_transform=src_tr, src_crs="EPSG:4326",
                  dst_transform=dst_tr, dst_crs="EPSG:4326", resampling=Resampling.cubic)
    return np.transpose(out, (1, 2, 0))

def hillshade(dem, cell_x, cell_y, az=315, alt=40, z=2.0):
    d = np.where(dem < -9000, 0, dem)
    gy, gx = np.gradient(d, cell_y, cell_x)
    gx, gy = gx * z, gy * z
    slope = np.pi / 2 - np.arctan(np.hypot(gx, gy))
    aspect = np.arctan2(-gx, gy)
    azr, altr = np.deg2rad(az), np.deg2rad(alt)
    hs = np.sin(altr) * np.sin(slope) + np.cos(altr) * np.cos(slope) * np.cos(azr - aspect)
    return np.clip(hs, 0, 1)

# 標高(m) → 色。低地の緑から高山の雪まで
STOPS = [(-10, (88, 128, 74)), (0, (92, 134, 76)), (50, (110, 148, 84)), (150, (146, 164, 98)),
         (400, (178, 170, 116)), (900, (160, 134, 98)), (1600, (132, 112, 96)),
         (2400, (168, 160, 152)), (3200, (236, 234, 230))]

def tint(dem):
    xs = np.array([s[0] for s in STOPS], np.float32)
    cs = np.array([s[1] for s in STOPS], np.float32)
    out = np.zeros(dem.shape + (3,), np.float32)
    for c in range(3):
        out[..., c] = np.interp(dem, xs, cs[:, c])
    return out

def make_day(dem, cell_x, cell_y):
    sea = dem <= 0
    hs = hillshade(dem, cell_x, cell_y)
    col = tint(dem) * (0.45 + 0.75 * hs[..., None])
    sea_col = np.array([14, 34, 58], np.float32)
    col[sea] = sea_col
    return np.clip(col, 0, 255).astype(np.uint8)

def make_h8(dem):
    v = np.clip(np.where(dem < -9000, -10, dem) + 10, 0, 255.99)
    r = np.floor(v)
    g = np.round((v - r) * 255)
    out = np.zeros(dem.shape + (3,), np.uint8)
    out[..., 0] = r.astype(np.uint8)
    out[..., 1] = g.astype(np.uint8)
    out[..., 2] = (dem > 0).astype(np.uint8) * 255  # B=陸地マスク
    return out

def fill_seams(dem):
    """タイルの継ぎ目に出る1ピクセル幅の欠損を、左右（上下）の平均で埋める"""
    d = dem.copy()
    for axis in (1, 0):
        gap = d < -9000
        a = np.roll(d, 1, axis=axis); b = np.roll(d, -1, axis=axis)
        ok = gap & (a > -9000) & (b > -9000)
        d[ok] = (a[ok] + b[ok]) / 2
    return d

def japan_mask(bounds, w, h):
    """Natural Earth 10m の国境から日本の範囲を塗り、海岸のずれを吸収するため少し膨らませる"""
    import shapefile
    from rasterio.features import rasterize
    from scipy.ndimage import binary_dilation
    sf = shapefile.Reader(f"{RAW}/ne/ne_10m_admin_0_countries.shp", encoding="utf-8")
    fields = [f[0] for f in sf.fields[1:]]
    geoms = []
    for sr in sf.shapeRecords():
        rec = dict(zip(fields, sr.record))
        if rec.get("ADM0_A3") == "JPN":
            geoms.append(sr.shape.__geo_interface__)
    west, south, east, north = bounds
    tr = from_origin(west, north, (east - west) / w, (north - south) / h)
    m = rasterize([(g, 1) for g in geoms], out_shape=(h, w), transform=tr, fill=0, dtype="uint8").astype(bool)
    return binary_dilation(m, iterations=4)

meta = {}
for name, (w_, s_, e_, n_, tex_w, mesh_w, dem_dir) in REGIONS.items():
    bounds = (w_, s_, e_, n_)
    tw, th, kx, ky = size_for(w_, s_, e_, n_, tex_w)
    print(f"[{name}] texture {tw}x{th}, extent {kx:.0f}x{ky:.0f} km")
    dem = load_dem(dem_dir, bounds, tw, th)
    dem = fill_seams(np.where(dem < -9000, -9999, dem))
    jp = japan_mask(bounds, tw, th)
    land = (dem > 0) & jp
    # 面積加重（緯度のcos）で、標高100m未満の陸地の割合を計算
    lats = np.linspace(n_, s_, th)[:, None]
    wgt = np.cos(np.deg2rad(lats)) * np.ones((1, tw))
    low = land & (dem < 100)
    share100 = float((wgt * low).sum() / (wgt * land).sum())
    cell_x = kx * 1000 / tw; cell_y = ky * 1000 / th
    day = make_day(dem, cell_x, cell_y).astype(np.float32)
    # 日本以外の陸地は暗く・彩度を落として、日本に目が行くようにする
    foreign = (dem > 0) & ~jp
    gray = day.mean(axis=2, keepdims=True)
    day = np.where(foreign[..., None], (0.55 * gray + 0.45 * day) * 0.55, day)
    Image.fromarray(np.clip(day, 0, 255).astype(np.uint8)).save(f"{OUT}/{name}_day.png", optimize=True)
    h8 = make_h8(dem)
    h8[..., 2] = (land * 255).astype(np.uint8)  # B=日本の陸地マスク
    Image.fromarray(h8).save(f"{OUT}/{name}_h8.png", optimize=True)
    night = load_blackmarble(bounds, tw, th).astype(np.float32)
    night = 255 * (night / 255) ** NIGHT_GAMMA[name]
    night = np.where(((dem > 0) & ~jp)[..., None], night * 0.5, night)
    if name in NIGHT_BLUR:
        night = gaussian_filter(night, sigma=(NIGHT_BLUR[name], NIGHT_BLUR[name], 0))
    Image.fromarray(np.clip(night, 0, 255).astype(np.uint8)).save(f"{OUT}/{name}_night.png", optimize=True)
    # メッシュ用（低解像度）
    mw, mh, _, _ = size_for(w_, s_, e_, n_, mesh_w)
    mesh = load_dem(dem_dir, bounds, mw, mh)
    mesh = fill_seams(np.where(mesh < -9000, -9999, mesh)).astype(np.float32)
    mesh.tofile(f"{OUT}/{name}_mesh.bin")
    meta[name] = dict(west=w_, south=s_, east=e_, north=n_, tex_w=tw, tex_h=th,
                      mesh_w=mw, mesh_h=mh, km_x=round(kx, 2), km_y=round(ky, 2),
                      land_share_below_100m=round(share100, 4),
                      max_elev=float(dem.max()))
    print(f"[{name}] below100m share of land = {share100:.3f}, max={dem.max():.0f} m")

json.dump(meta, open(f"{OUT}/meta.json", "w"), indent=2, ensure_ascii=False)
print("done")
