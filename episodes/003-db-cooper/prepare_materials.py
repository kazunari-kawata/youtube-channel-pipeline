"""003 D.B.クーパー：FBI Vault の PDF から、台帳のファイル名どおりのページ画像を作る（cut_materials.py の前に1回）

  python episodes/003-db-cooper/prepare_materials.py          # ページ画像を作る
  python episodes/003-db-cooper/prepare_materials.py --assets # 切り出したあと、画面用の一覧（ep003-assets.json）を作り直す

PDF の置き場所：episodes/003-db-cooper/build/materials/fbi/vault/cooper_d_b_partNNN.pdf（Gitに入らない）
  取得元：FBI Vault（https://vault.fbi.gov/D-B-Cooper%20）。クラウドからは開けないので、同じ PDF を置いている
  GitHub の noops888/db-cooper-files-text（download_script/pdfs。文字起こしデータ ref_ocr_text の元）から取った。
ページ番号は PDF の通し番号（1始まり）。文字起こしの sourcepage は「その文の塊が始まるページ」なので、
本文が次のページにあることがある。下の番号は、2026-11-25 に画像で読んで確かめたもの。
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
EP = ROOT / "episodes" / "003-db-cooper"
MAT = EP / "build" / "materials"
VAULT = MAT / "fbi" / "vault"
PUB = ROOT / "remotion" / "public" / "003"
DPI = 200

# 台帳のファイル名 → (分冊, ページ...)。2ページあるものは縦につなぐ
PAGES = {
    "fbi/vault_p43_press_1980.png": (43, 136),
    "fbi/vault_p76_p76.png": (76, 76),
    "fbi/vault_p76_p77.png": (76, 77),
    "fbi/vault_p76_p78.png": (76, 78),
    "fbi/vault_p77_description.png": (77, 249),
    "fbi/vault_p77_p250.png": (77, 250),
    "fbi/vault_p64_p159.png": (64, 159),
    "fbi/vault_p64_p161.png": (64, 161),
    "fbi/vault_p26_p471.png": (26, 471),
    "fbi/vault_p41_p27.png": (41, 27),
    "fbi/vault_p10_p448.png": (10, 449),       # 本文は p.449（文字起こしでは p.448 の塊）
    "fbi/vault_p74_p257.png": (74, 258),       # 人物像は p.258（p.257 は爆発物の記述があるので使わない）
    "fbi/vault_p95_p293.png": (95, 293),
    "fbi/vault_p95_p257.png": (95, 257),       # シアトル支局のまとめ（SE 164-81）の HABITS・CLOTHES。ネクタイの値段と、よく使う人（8:09 のカードの代わり）
    "fbi/vault_p24_p307.png": (24, 307),
    "fbi/vault_p52_p038.png": (52, 38),
    "fbi/vault_p10_reno.png": (10, 336),       # テレタイプは p.336（p.335 は郡保安官事務所の書類なので使わない）
    "fbi/vault_p24_indictment.png": (24, 575), # 表題のページは p.575
    "fbi/vault_p24_indictment_p2.png": (24, 576),
    "fbi/vault_p42_letter_1978.png": (42, 213),
    "fbi/vault_p43_decal.png": (43, 18),       # 1ページ目は p.18（p.19 は2ページ目）
}
# 似顔絵：Part 77 p.250 の左の絵（次のページの見出しは「ORIGINAL MONTAGE」。右は1999年の姿に年を取らせた版なので使わない）
SKETCH = ("fbi/sketch.jpg", 77, 250, (0.19, 0.385, 0.45, 0.688))


def page(part: int, n: int, dpi: int = DPI) -> Image.Image:
    pdf = VAULT / f"cooper_d_b_part{part:03d}.pdf"
    if not pdf.exists():
        sys.exit(f"{pdf} がありません（このファイルの冒頭の取得元を参照）")
    with tempfile.TemporaryDirectory() as td:
        subprocess.run(["pdftoppm", "-r", str(dpi), "-f", str(n), "-l", str(n), "-png", "-singlefile", str(pdf), f"{td}/p"], check=True)
        return Image.open(f"{td}/p.png").convert("RGB")


def make_pages() -> None:
    for name, (part, *pages) in PAGES.items():
        dst = MAT / name
        if dst.exists():
            continue
        ims = [page(part, n) for n in pages]
        w = max(i.width for i in ims)
        out = Image.new("RGB", (w, sum(i.height for i in ims)), "white")
        y = 0
        for i in ims:
            out.paste(i, (0, y))
            y += i.height
        dst.parent.mkdir(parents=True, exist_ok=True)
        out.save(dst)
        print(f"{name}  Part {part} p.{'〜'.join(map(str, pages))}  {out.size[0]}x{out.size[1]}")
    name, part, n, box = SKETCH
    dst = MAT / name
    if not dst.exists():
        im = page(part, n, 400)
        W, H = im.size
        im.crop((int(box[0] * W), int(box[1] * H), int(box[2] * W), int(box[3] * H))).save(dst, quality=95)
        print(f"{name}  Part {part} p.{n}")


def make_assets() -> None:
    """remotion/public/003/*.jpg の大きさを、動画の定義が読む一覧にする（縦横比を手で書かないため）"""
    out = {p.stem: [Image.open(p).size[0], Image.open(p).size[1]] for p in sorted(PUB.glob("*.jpg"))}
    dst = ROOT / "remotion" / "src" / "episodes" / "ep003-assets.json"
    dst.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{dst.relative_to(ROOT)}：{len(out)}点")


if __name__ == "__main__":
    make_assets() if "--assets" in sys.argv else make_pages()
