"""004 テッド・バンディ：画面に出す資料と写真を作る（cuts_004.yaml → remotion/public/004/）

  python episodes/004-bundy/prepare_materials_004.py               # 作れるものを全部作り、ep004-assets.json を作り直す
  python episodes/004-bundy/prepare_materials_004.py --only a,b    # 名前を指定して作り直す
  python episodes/004-bundy/prepare_materials_004.py --force       # 全部作り直す

作るもの（cuts_004.yaml の kind）
  crop：素材台帳の file（PDF なら「#page=N」）のページを画像にし、黒塗り → 切り出し → JPEG 90（006 の prepare_materials_006.py と同じやり方）
  text：判決文の引用を、紙の上に文字を組み直して画像にする。裁判所の意見は著作権の対象外だが、FSU のデジタル版の紙面は
        「Not for Commercial Use」なので、紙面の画像は使わず、文の文字だけを組む（素材台帳の ct_* の note）。
        原文の文はそのまま（省いた所は [...]）。被害者の名前・体の部位の語は省く。画面の出典の行に「文字を組み直した引用」と出す（ep004-bundy.tsx）

もう remotion/public/004/ にある画像は作り直さない（--only か --force のときだけ）。クラウドで作り、Windows へは zip で写す（CLAUDE.md「書き出し環境」）。
作れないもの（台帳で使用可でない、元のファイルがない、crop が null）は理由を表示し、動画では「素材待ち」の仮の絵になる。
"""
import argparse
import json
import subprocess
import tempfile
import textwrap
from pathlib import Path

import yaml
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
EP = ROOT / "episodes" / "004-bundy"
MAT = EP / "build" / "materials"
PUB = ROOT / "remotion" / "public" / "004"
ASSETS = ROOT / "remotion" / "src" / "episodes" / "ep004-assets.json"
USABLE = ("pd_federal", "pd_no_notice", "pd_other", "cc_by", "fair_use", "own")
DPI = 200
MAX_SIDE = 2400

SERIF = "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf"
SERIF_B = "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf"
SERIF_I = "/usr/share/fonts/truetype/liberation/LiberationSerif-Italic.ttf"


def load(item: dict, page: int | None) -> Image.Image:
    f = MAT / item["file"].split("#")[0]
    if f.suffix.lower() == ".pdf":
        with tempfile.TemporaryDirectory() as td:
            subprocess.run(["pdftoppm", "-r", str(DPI), "-f", str(page or 1), "-l", str(page or 1), "-png", "-singlefile",
                            str(f), f"{td}/p"], check=True)
            return Image.open(f"{td}/p.png").convert("RGB")
    return Image.open(f).convert("RGB")


def paper(w: int, h: int, seed: int) -> Image.Image:
    """紙の地（わずかなむらと粒）。文字は動かさないので、模様も細かすぎないものにする"""
    import random
    rnd = random.Random(seed)
    base = Image.new("RGB", (w, h), (238, 232, 218))
    noise = Image.new("L", (w // 8 + 1, h // 8 + 1))
    noise.putdata([rnd.randint(118, 138) for _ in range((w // 8 + 1) * (h // 8 + 1))])
    noise = noise.resize((w, h), Image.BICUBIC).filter(ImageFilter.GaussianBlur(6))
    shade = Image.new("RGB", (w, h), (214, 206, 188))
    return Image.composite(shade, base, noise.point(lambda v: max(0, min(255, (v - 118) * 6))))


def text_card(c: dict, seed: int) -> Image.Image:
    """判決文の引用を紙の上に組む。c：caption（事件名）、court（裁判所と日付）、cite（判例集の番号）、paras（段落のリスト）"""
    W, pad = 1600, 70
    f_cap = ImageFont.truetype(SERIF_B, 34)
    f_court = ImageFont.truetype(SERIF, 28)
    f_body = ImageFont.truetype(SERIF, 38)
    lines: list[tuple[str, ImageFont.FreeTypeFont, int]] = []
    for p in c["paras"]:
        for ln in textwrap.wrap(p, width=c.get("wrap", 92)):
            lines.append((ln, f_body, 54))
        lines.append(("", f_body, 22))
    lines = lines[:-1]
    head_h = 34 + 12 + 28 + 26 + 4 + 34
    body_h = sum(lh for _, _, lh in lines)
    H = pad + head_h + body_h + pad
    im = paper(W, H, seed)
    d = ImageDraw.Draw(im)
    ink = (30, 28, 24)
    y = pad
    d.text((pad, y), c["caption"].upper(), font=f_cap, fill=ink)
    y += 34 + 12
    d.text((pad, y), f'{c["court"]}　{c["cite"]}'.replace("　", "  ·  "), font=f_court, fill=(70, 66, 60))
    y += 28 + 26
    d.line([(pad, y), (W - pad, y)], fill=(90, 84, 74), width=2)
    y += 4 + 34
    for ln, font, lh in lines:
        d.text((pad, y), ln, font=font, fill=ink)
        y += lh
    return im


def make_assets() -> None:
    """remotion/public/004/*.jpg の大きさを、動画の定義が読む一覧にする（縦横比を手で書かないため）"""
    out = {p.stem: list(Image.open(p).size) for p in sorted(PUB.glob("*.jpg"))}
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
    for n, c in enumerate(yaml.safe_load((EP / "cuts_004.yaml").read_text(encoding="utf-8"))):
        if only and c["name"] not in only:
            continue
        item = ledger.get(c["src"])
        if not item:
            waiting.append(f"{c['name']}：台帳に {c['src']} がない")
            continue
        if item["status"] not in USABLE:
            waiting.append(f"{c['name']}：台帳で {item['status']}（使用可になるまで作らない）")
            continue
        out = PUB / f"{c['name']}.jpg"
        if out.exists() and not (a.force or only):
            kept += 1
            continue
        if c.get("kind") == "text":
            im = text_card(c, seed=n)
        else:
            if not item.get("file"):
                waiting.append(f"{c['name']}：台帳に {c['src']} の file がない")
                continue
            path, _, frag = item["file"].partition("#")
            if not (MAT / path).exists():
                waiting.append(f"{c['name']}：{path} がまだない")
                continue
            if c.get("crop") is None:
                waiting.append(f"{c['name']}：切り出す位置がまだ決まっていない（画像で見て cuts_004.yaml に書く）")
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
        im.save(out, quality=90)
        made += 1
        print(f"{c['name']:28s} {im.size[0]}x{im.size[1]}  ← {item.get('file') or c.get('cite', '')}")
    print(f"作った {made}点、そのまま {kept}点、まだ作れない {len(waiting)}点")
    for w in waiting:
        print("  -", w)
    make_assets()


if __name__ == "__main__":
    main()
