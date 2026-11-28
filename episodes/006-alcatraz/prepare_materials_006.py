"""006 アルカトラズ脱獄：素材台帳の資料と写真から、画面に出す切り出しを作る（cuts_006.yaml → remotion/public/006/）

  python episodes/006-alcatraz/prepare_materials_006.py           # 作れるものを全部作り、ep006-assets.json を作り直す
  python episodes/006-alcatraz/prepare_materials_006.py --only a,b      # 切り出し位置を直したものだけ作り直す
  python episodes/006-alcatraz/prepare_materials_006.py --force          # 全部作り直す

もう remotion/public/006/ にある画像は作り直さない（--only か --force のときだけ）。
PDF を画像にする pdftoppm の版で幅が1画素変わり、Windows とクラウドで ep006-assets.json が食い違うため
（Windows へはクラウドで作った画像を zip で写す：CLAUDE.md「書き出し環境」）。

共有の pipeline/cut_materials.py は、台帳の file とファイル名が一致することを前提にしている。
この回の台帳は「fbi/alcatr2.pdf#page=35」のように1つの PDF の中のページを指すので、台帳の id で引くこの回用の版を使う
（共有ファイルは変えない。やり方は cut_materials.py と同じ：ページを画像にし、黒塗り → 切り出し → JPEG 90）。

作らないもの（理由を表示する）
  - 台帳で使用可になっていない（check など）
  - crop がまだ決まっていない（null）：画像で見て、台帳の note の「入れない段落」を外す位置を決めてから書く
  - 元のファイルがまだない（Mac にある fbi/・usms/ が届いていない）
作られなかったものは、動画の中で「素材待ち」の仮の絵になる（ep006-alcatraz.tsx の Pending）

3人の顔写真（台帳の fbi_mugshots = fbi/mugshots_three.jpg）は、ここで3枚を横に並べて作る（compose_mugshots）。
FBI の公式ページのクラレンスの写真は 111x113 と小さいので、連邦保安官局の手配書に入っている写真（480x524）を使う（F-040）
"""
import argparse
import json
import subprocess
import tempfile
from pathlib import Path

import yaml
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
EP = ROOT / "episodes" / "006-alcatraz"
MAT = EP / "build" / "materials"
PUB = ROOT / "remotion" / "public" / "006"
ASSETS = ROOT / "remotion" / "src" / "episodes" / "ep006-assets.json"
USABLE = ("pd_federal", "pd_no_notice", "pd_other", "cc_by", "fair_use", "own")
DPI = 200
MAX_SIDE = 2400   # 1920x1080 の画面で寄っても足りる大きさ。これより大きい写真は縮める


def load(item: dict, page: int | None) -> Image.Image:
    f = MAT / item["file"].split("#")[0]
    if f.suffix.lower() == ".pdf":
        with tempfile.TemporaryDirectory() as td:
            subprocess.run(["pdftoppm", "-r", str(DPI), "-f", str(page or 1), "-l", str(page or 1), "-png", "-singlefile",
                            str(f), f"{td}/p"], check=True)
            return Image.open(f"{td}/p.png").convert("RGB")
    return Image.open(f).convert("RGB")


MUGSHOTS = [  # 左から。ナレーションのラベルと同じ順（ジョン、クラレンス、モリス）
    ("fbi/mugshot_john.jpg", None),
    ("usms/poster_anglin_clarence.pdf", 0),   # 手配書の1枚目の写真（当時の顔写真。2枚目は年齢を進めた絵）
    ("fbi/mugshot_morris.jpg", None),
]


def compose_mugshots() -> str | None:
    """3人の顔写真を同じ高さにそろえて横に並べる。部品がそろっていなければ理由を返す"""
    out = MAT / "fbi" / "mugshots_three.jpg"
    if out.exists():
        return None
    ims = []
    for f, idx in MUGSHOTS:
        src = MAT / f
        if not src.exists():
            return f"fbi_mugshots：{f} がまだない"
        if idx is None:
            ims.append(Image.open(src))
        else:
            with tempfile.TemporaryDirectory() as td:
                subprocess.run(["pdfimages", "-f", "1", "-l", "1", "-j", str(src), f"{td}/i"], check=True)
                ims.append(Image.open(sorted(Path(td).glob("i-*"))[idx]).copy())
    h, gap = 560, 22
    ims = [im.convert("L").resize((round(im.size[0] * h / im.size[1]), h), Image.LANCZOS) for im in ims]
    canvas = Image.new("L", (sum(im.size[0] for im in ims) + gap * (len(ims) - 1), h), 236)
    x = 0
    for im in ims:
        canvas.paste(im, (x, 0))
        x += im.size[0] + gap
    canvas.convert("RGB").save(out, quality=92)
    print(f"fbi/mugshots_three.jpg {canvas.size[0]}x{canvas.size[1]}（{'、'.join(f for f, _ in MUGSHOTS)}）")
    return None


def make_assets() -> None:
    """remotion/public/006/*.jpg の大きさを、動画の定義が読む一覧にする（縦横比を手で書かないため）"""
    out = {p.stem: list(Image.open(p).size) for p in sorted(PUB.glob("*.jpg"))}
    # 中身が同じなら書かない（Windows の作業フォルダでは改行コードの違いだけで git の変更になり、次の取り込みが止まる）
    if not (ASSETS.exists() and json.loads(ASSETS.read_text(encoding="utf-8")) == out):
        ASSETS.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{ASSETS.relative_to(ROOT)}：{len(out)}点")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="作る name（カンマ区切り）。あっても作り直す")
    ap.add_argument("--force", action="store_true", help="あるものも全部作り直す")
    a = ap.parse_args()
    only = set(a.only.split(",")) if a.only else None
    ledger = {i["id"]: i for i in yaml.safe_load((EP / "materials.yaml").read_text(encoding="utf-8"))["items"]}
    PUB.mkdir(parents=True, exist_ok=True)
    made, kept, waiting = 0, 0, []
    if (msg := compose_mugshots()):
        waiting.append(msg)
    for c in yaml.safe_load((EP / "cuts_006.yaml").read_text(encoding="utf-8")):
        if only and c["name"] not in only:
            continue
        item = ledger.get(c["src"])
        if not item or not item.get("file"):
            waiting.append(f"{c['name']}：台帳に {c['src']} の file がない")
            continue
        if item["status"] not in USABLE:
            waiting.append(f"{c['name']}：台帳で {item['status']}（使用可になるまで作らない）")
            continue
        path, _, frag = item["file"].partition("#")
        if not (MAT / path).exists():
            waiting.append(f"{c['name']}：{path} がまだない")
            continue
        if c.get("crop") is None:
            waiting.append(f"{c['name']}：切り出す位置がまだ決まっていない（画像で見て cuts_006.yaml に書く）")
            continue
        if (PUB / f"{c['name']}.jpg").exists() and not (a.force or only):
            kept += 1
            continue
        page = int(frag.split("=")[1]) if frag.startswith("page=") else c.get("page")
        im = load(item, page)
        W, H = im.size
        for x0, y0, x1, y1 in c.get("redact", []):
            ImageDraw.Draw(im).rectangle((int(x0 * W), int(y0 * H), int(x1 * W), int(y1 * H)), fill=(0, 0, 0))
        x0, y0, x1, y1 = c["crop"]
        im = im.crop((int(x0 * W), int(y0 * H), int(x1 * W), int(y1 * H)))
        if max(im.size) > MAX_SIDE:
            im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
        im.save(PUB / f"{c['name']}.jpg", quality=90)
        made += 1
        print(f"{c['name']:28s} {im.size[0]}x{im.size[1]}  ← {item['file']}")
    print(f"作った {made}点、そのまま {kept}点、まだ作れない {len(waiting)}点")
    for w in waiting:
        print("  -", w)
    make_assets()


if __name__ == "__main__":
    main()
