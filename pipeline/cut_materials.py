"""素材台帳で使用可の素材から、画面に出す部分だけを切り出して remotion/public/<番号>/ に置く

  python pipeline/cut_materials.py 002-dahmer

切り出し方は episodes/<id>/cuts.yaml。PDFは pdftoppm（poppler）でページを画像にする。
"""
import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import yaml
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from common import ROOT, build_dir, episode_dir  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episode")
    a = ap.parse_args()
    src_dir = build_dir(a.episode) / "materials"
    out = ROOT / "remotion" / "public" / a.episode.split("-")[0]
    out.mkdir(parents=True, exist_ok=True)
    ledger = yaml.safe_load((episode_dir(a.episode) / "materials.yaml").read_text(encoding="utf-8"))
    usable = {i["file"] for i in ledger["items"] if i.get("file") and i["status"] in ("pd_federal", "pd_no_notice", "pd_other", "cc_by", "fair_use", "own")}
    for c in yaml.safe_load((episode_dir(a.episode) / "cuts.yaml").read_text(encoding="utf-8")):
        f = src_dir / c["file"]
        if c["file"] not in usable:
            sys.exit(f"{c['name']}：{c['file']} は素材台帳で使用可になっていません")
        if f.suffix.lower() == ".pdf":
            with tempfile.TemporaryDirectory() as td:
                subprocess.run(["pdftoppm", "-r", str(c.get("dpi", 150)), "-png", "-f", str(c["page"]), "-l", str(c["page"]),
                                str(f), f"{td}/p"], check=True)
                im = Image.open(next(Path(td).glob("p*.png"))).convert("RGB")
        else:
            im = Image.open(f).convert("RGB")
        if c.get("rotate"):
            im = im.rotate(c["rotate"], expand=True)
        if c.get("crop"):
            W, H = im.size
            x0, y0, x1, y1 = c["crop"]
            im = im.crop((int(x0 * W), int(y0 * H), int(x1 * W), int(y1 * H)))
        im.save(out / f"{c['name']}.jpg", quality=90)
        if c.get("meta"):
            shutil.copy(src_dir / c["meta"], out / f"{c['name']}.json")
        print(f"{c['name']:16s} {im.size[0]}x{im.size[1]}")


if __name__ == "__main__":
    main()
