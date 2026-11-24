"""パイプライン共通：パス、設定の読み込み、.env、ffmpeg 呼び出し"""
from __future__ import annotations

import copy
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
import yaml

ROOT = Path(__file__).resolve().parents[1]
DATA_RAW = ROOT / "data" / "raw"
DATA_PROCESSED = ROOT / "data" / "processed"
REMOTION = ROOT / "remotion"
PUBLIC = REMOTION / "public"
SRC_DATA = REMOTION / "src" / "data"

# Windows のコンソールでも日本語を表示できるようにする
for stream in (sys.stdout, sys.stderr):
    try:
        stream.reconfigure(encoding="utf-8")
    except Exception:
        pass


def load_env() -> None:
    """リポジトリ直下の .env を読む（無ければ何もしない）。値は表示しない。"""
    env = ROOT / ".env"
    if not env.exists():
        return
    try:
        from dotenv import load_dotenv
        load_dotenv(env, override=False)
    except ImportError:
        for line in env.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def require_env(name: str) -> str:
    load_env()
    v = os.environ.get(name, "").strip()
    if not v:
        sys.exit(f"{name} が設定されていません。.env.example をコピーして .env を作り、値を入れてください。")
    return v


def _merge(a: dict, b: dict) -> dict:
    out = copy.deepcopy(a)
    for k, v in (b or {}).items():
        out[k] = _merge(out[k], v) if isinstance(v, dict) and isinstance(out.get(k), dict) else v
    return out


def episode_dir(ep: str) -> Path:
    d = ROOT / "episodes" / ep
    if not d.exists():
        sys.exit(f"episodes/{ep} が見つかりません")
    return d


def build_dir(ep: str) -> Path:
    d = episode_dir(ep) / "build"
    d.mkdir(parents=True, exist_ok=True)
    return d


def load_config(ep: str | None = None) -> dict:
    """config/channel.yaml に episodes/<ep>/episode.yaml を上書きした設定"""
    cfg = yaml.safe_load((ROOT / "config" / "channel.yaml").read_text(encoding="utf-8"))
    if ep:
        f = episode_dir(ep) / "episode.yaml"
        if f.exists():
            cfg = _merge(cfg, yaml.safe_load(f.read_text(encoding="utf-8")) or {})
    return cfg


def load_narration(ep: str) -> list[dict]:
    return json.loads((episode_dir(ep) / "narration.json").read_text(encoding="utf-8"))


def ffmpeg_bin(name: str = "ffmpeg") -> str:
    p = shutil.which(name)
    if not p:
        sys.exit(f"{name} が見つかりません。Windowsなら winget install Gyan.FFmpeg で入れてください。")
    return p


def run(cmd: list[str], **kw) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, check=True, **kw)


def decode_audio(path: Path | str, sr: int = 48000, channels: int = 1) -> np.ndarray:
    """ffmpeg で任意の音声/動画ファイルを float32 に読み込む（shape: [n] または [n, ch]）"""
    out = subprocess.run(
        [ffmpeg_bin(), "-v", "error", "-i", str(path), "-vn", "-ac", str(channels), "-ar", str(sr), "-f", "f32le", "-"],
        check=True, capture_output=True,
    ).stdout
    a = np.frombuffer(out, np.float32)
    return a if channels == 1 else a.reshape(-1, channels)


def write_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=1), encoding="utf-8")
