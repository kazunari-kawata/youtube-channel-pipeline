"""地形・夜景・国境・フォントの元データを data/raw/ にダウンロードする（初回だけ。約700MB）

  python pipeline/fetch_data.py

取得元（すべて実データ。AI生成の地図は使わない）
  data/sources/glo90.txt        Copernicus DEM GLO-90（日本全体）
  data/sources/glo30.txt        Copernicus DEM GLO-30（関東）
  data/sources/blackmarble.txt  NASA Black Marble 2016（NASA GIBS WMTS 500m）
  Natural Earth 10m 国境（パブリックドメイン）
  Noto Sans JP（SIL Open Font License）。動画の文字はこのフォントで固定する
  Quaternius Universal Animation Library（CC0）。イメージ映像の人物（顔のないシルエット）
"""
import sys
import urllib.error
import urllib.request
import zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from common import DATA_RAW, PUBLIC, ROOT  # noqa: E402

NE_URL = "https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_0_countries.zip"
FONT_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/notosansjp/NotoSansJP%5Bwght%5D.ttf"
FIGURE_URL = "https://opengameart.org/sites/default/files/universal_animation_librarystandard.zip"


def get(url: str, dest: Path) -> str:
    if dest.exists() and dest.stat().st_size > 0:
        return "skip"
    dest.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "youtube-channel-pipeline"})
            with urllib.request.urlopen(req, timeout=120) as r:
                tmp = dest.with_suffix(dest.suffix + ".part")
                tmp.write_bytes(r.read())
                tmp.replace(dest)
            return "ok"
        except urllib.error.HTTPError as e:
            if e.code in (403, 404):
                return "none"  # 海だけのタイルは存在しない
            if attempt == 2:
                return f"error {e.code}"
        except Exception as e:  # noqa: BLE001
            if attempt == 2:
                return f"error {e}"
    return "error"


def jobs():
    for name, sub in (("glo90", "glo90"), ("glo30", "glo30")):
        for url in (ROOT / "data" / "sources" / f"{name}.txt").read_text().split():
            yield url, DATA_RAW / sub / url.rsplit("/", 1)[1]
    for url in (ROOT / "data" / "sources" / "blackmarble.txt").read_text().split():
        parts = url.removesuffix(".png").split("/")
        row, col = parts[-2], parts[-1]
        yield url, DATA_RAW / "bm" / f"bm_{row}_{col}.png"
    yield NE_URL, DATA_RAW / "ne" / "ne_10m_admin_0_countries.zip"
    yield FONT_URL, PUBLIC / "fonts" / "NotoSansJP.ttf"
    yield FIGURE_URL, DATA_RAW / "figures" / "universal_animation_library_standard.zip"


def main():
    todo = list(jobs())
    stats = {}
    with ThreadPoolExecutor(8) as ex:
        for (url, dest), res in zip(todo, ex.map(lambda j: get(*j), todo)):
            key = res if not res.startswith("error") else "error"
            stats[key] = stats.get(key, 0) + 1
            if res.startswith("error"):
                print(f"  失敗: {url} ({res})")
    z = DATA_RAW / "ne" / "ne_10m_admin_0_countries.zip"
    if z.exists() and not (DATA_RAW / "ne" / "ne_10m_admin_0_countries.shp").exists():
        zipfile.ZipFile(z).extractall(z.parent)
    fz = DATA_RAW / "figures" / "universal_animation_library_standard.zip"
    glb = PUBLIC / "figures" / "mannequin.glb"
    if fz.exists() and not glb.exists():
        with zipfile.ZipFile(fz) as z:
            name = next(n for n in z.namelist() if n.endswith("AnimationLibrary_Godot_Standard.glb"))
            glb.parent.mkdir(parents=True, exist_ok=True)
            glb.write_bytes(z.read(name))
    print("結果:", stats)
    if stats.get("error"):
        sys.exit("一部のダウンロードに失敗しました。もう一度実行すると続きから取得します。")


if __name__ == "__main__":
    main()
